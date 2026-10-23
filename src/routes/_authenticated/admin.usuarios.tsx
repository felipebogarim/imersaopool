import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Users, UserCog, Send, KeyRound, MessageSquare, Check, Loader2, UserPlus, MoreVertical, Pencil, ShieldCheck,
  Ban, UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ALL_NAV_KEYS, NAV_TREE } from "@/lib/nav-tree";
import {
  inviteUser, updateUserProfile, createUserWithPassword, sendFirstAccessEmail, setUserSuspended,
} from "@/lib/admin-usuarios.functions";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: UsuariosPage,
});

type Row = {
  id: string;
  full_name: string | null;
  email: string | null;
  cargo: string | null;
  phone: string | null;
  regiao: string | null;
  status: string;
  created_at: string;
  role: string | null;
  last_sign_in_at: string | null;
};

const ROLE_OPTIONS = [
  { value: "admin", label: "Gestão" },
  { value: "gestor", label: "Diretoria" },
  { value: "agente", label: "Liderança" },
  { value: "comercial", label: "Comercial" },
];

function fmt(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function roleLabel(r: string | null) {
  return ROLE_OPTIONS.find(o => o.value === r)?.label ?? "—";
}

function UsuariosPage() {
  const qc = useQueryClient();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [linkInfo, setLinkInfo] = useState<{ email: string; link: string; userId: string; name?: string | null; phone?: string | null } | null>(null);
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [roleRow, setRoleRow] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: isGlobalAdmin = false } = useQuery({
    queryKey: ["current-user-is-global-admin"],
    queryFn: async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return false;
      const { data: role } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authData.user.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!role;
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, cargo, phone, regiao, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (profiles ?? []).map(p => p.id);
      const { data: roles } = ids.length
        ? await supabase.from("user_roles").select("user_id, role").in("user_id", ids)
        : { data: [] as { user_id: string; role: string }[] };
      const byUser = new Map<string, string>((roles ?? []).map(r => [r.user_id, r.role]));

      let lastSign = new Map<string, string | null>();
      const { data: adminList } = await supabase.rpc("admin_list_users");
      if (Array.isArray(adminList)) {
        lastSign = new Map(adminList.map((u: any) => [u.id, u.last_sign_in_at ?? null]));
      }

      return (profiles ?? []).map<Row>(p => ({
        ...p,
        role: byUser.get(p.id) ?? null,
        last_sign_in_at: lastSign.get(p.id) ?? null,
      }));
    },
  });

  async function resetPassword(email: string | null) {
    if (!email) return toast.error("Usuário sem e-mail");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/auth",
    });
    if (error) return toast.error(error.message);
    toast.success("E-mail de redefinição enviado");
  }

  async function toggleSuspension(r: Row) {
    const suspended = r.status !== "inativo";
    const verb = suspended ? "suspender" : "reativar";
    if (!confirm(`Deseja ${verb} ${r.full_name ?? r.email}?`)) return;
    setBusy(true);
    try {
      await setUserSuspended({ data: { user_id: r.id, suspended } });
      toast.success(suspended ? "Usuário suspenso" : "Usuário reativado");
      await qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) {
      toast.error(e?.message ?? `Falha ao ${verb} usuário`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="border-b border-border px-4 sm:px-8 py-6">
        <div className="flex items-center gap-3">
          <UserCog className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Usuários e Permissões</h1>
            <p className="text-sm text-muted-foreground">Gerencie usuários, aprovações e permissões de acesso</p>
          </div>
        </div>
      </div>

      <PageHeader
        title="Aprovação de Usuários"
        subtitle="Gerencie solicitações de acesso ao painel"
        actions={
          <>
            <Button variant="outline" onClick={() => setCreateOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" /> Criar usuário
            </Button>
            <Button className="bg-primary hover:bg-primary/90" onClick={() => setInviteOpen(true)}>
              <Send className="h-4 w-4 mr-2" /> Enviar convite
            </Button>
          </>
        }
      />

      <div className="p-4 sm:p-8">
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-border">
            <Users className="h-5 w-5" />
            <h2 className="font-semibold">Solicitações de Cadastro</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="px-6 py-3 font-normal">Nome</th>
                  <th className="px-6 py-3 font-normal">Setor</th>
                  <th className="px-6 py-3 font-normal">Perfil</th>
                  <th className="px-6 py-3 font-normal">Status</th>
                  <th className="px-6 py-3 font-normal">Cadastro</th>
                  <th className="px-6 py-3 font-normal">Último Acesso</th>
                  <th className="px-6 py-3 font-normal text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={7} className="px-6 py-10 text-center text-muted-foreground">Carregando…</td></tr>
                )}
                {!isLoading && (data?.length ?? 0) === 0 && (
                  <tr><td colSpan={7} className="px-6 py-10 text-center text-muted-foreground">Nenhum usuário cadastrado</td></tr>
                )}
                {data?.map(r => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                        <span className="font-medium">{r.full_name ?? r.email ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{r.cargo ?? "—"}</td>
                    <td className="px-6 py-4">{roleLabel(r.role)}</td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                          r.status === "aprovado" || r.status === "ativo"
                            ? "bg-green-100 text-green-700"
                            : r.status === "inativo"
                              ? "bg-red-100 text-red-700"
                              : "bg-yellow-100 text-yellow-700"
                        )}
                      >
                        <Check className="h-3 w-3" />
                        {r.status === "aprovado" || r.status === "ativo"
                          ? "Aprovado"
                          : r.status === "inativo" ? "Suspenso" : "Pendente"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{fmt(r.created_at)}</td>
                    <td className="px-6 py-4 text-muted-foreground">{fmt(r.last_sign_in_at)}</td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={`Ações de ${r.full_name ?? r.email}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem onSelect={() => setEditRow(r)}>
                              <Pencil /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => resetPassword(r.email)}>
                              <KeyRound /> Alterar senha
                            </DropdownMenuItem>
                            {isGlobalAdmin && (
                              <DropdownMenuItem onSelect={() => setRoleRow(r)}>
                                <ShieldCheck /> Papel
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={busy}
                              onSelect={() => toggleSuspension(r)}
                              className={r.status === "inativo" ? "text-emerald-700 focus:text-emerald-700" : "text-destructive focus:text-destructive"}
                            >
                              {r.status === "inativo" ? <UserCheck /> : <Ban />}
                              {r.status === "inativo" ? "Reativar" : "Suspender"}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onDone={() => qc.invalidateQueries({ queryKey: ["admin-users"] })}
      />
      <InviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onDone={() => qc.invalidateQueries({ queryKey: ["admin-users"] })}
        onInvited={(info) => setLinkInfo(info)}
      />
      <EditDialog
        row={editRow}
        onOpenChange={(o) => !o && setEditRow(null)}
        onDone={() => qc.invalidateQueries({ queryKey: ["admin-users"] })}
      />
      <RoleAccessDialog
        row={roleRow}
        onOpenChange={(o) => !o && setRoleRow(null)}
        onDone={() => qc.invalidateQueries({ queryKey: ["admin-users"] })}
      />
      <FirstAccessDialog info={linkInfo} onOpenChange={(o) => !o && setLinkInfo(null)} />
    </div>
  );
}

function FirstAccessDialog({
  info, onOpenChange,
}: {
  info: { email: string; link: string; userId: string; name?: string | null; phone?: string | null } | null;
  onOpenChange: (o: boolean) => void;
}) {
  const link = info?.link ?? "";
  const email = info?.email ?? "";
  const [sending, setSending] = useState(false);
  const [fone, setFone] = useState("");

  const primeiroNome = (info?.name ?? "").trim().split(/\s+/)[0] ?? "";
  const texto =
    `Olá${primeiroNome ? ` ${primeiroNome}` : ""}! Seu acesso ao painel PoolFlux foi criado. ` +
    `Clique no link abaixo para cadastrar a sua senha e entrar:\n${link}\n\nO convite é pessoal e vale por 14 dias.`;

  async function enviarEmail() {
    if (!info) return;
    setSending(true);
    try {
      await sendFirstAccessEmail({ data: { user_id: info.userId, origin: window.location.origin } });
      toast.success(`Convite enviado para ${email}`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar o e-mail");
    } finally {
      setSending(false);
    }
  }

  function enviarWhats() {
    const num = (fone || info?.phone || "").replace(/\D/g, "");
    if (num.length < 10) return toast.error("Informe o WhatsApp com DDD (ex.: 5511999999999)");
    const numero = num.startsWith("55") ? num : `55${num}`;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
    onOpenChange(false);
  }

  return (
    <Dialog open={!!info} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Convite de primeiro acesso</DialogTitle>
          <DialogDescription>
            Convite pessoal para <strong>{email}</strong>. Não há senha temporária: ao clicar no link, a primeira
            ação é cadastrar a própria senha (letras, números e símbolos).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs break-all font-mono">{link}</div>

          <div className="rounded-lg border border-border p-3 space-y-2">
            <p className="text-sm font-medium">Enviar por e-mail</p>
            <p className="text-xs text-muted-foreground">Mensagem formatada enviada para {email}.</p>
            <Button onClick={enviarEmail} disabled={sending}>
              <Send className="h-4 w-4 mr-2" /> {sending ? "Enviando..." : "Enviar por e-mail"}
            </Button>
          </div>

          <div className="rounded-lg border border-border p-3 space-y-2">
            <p className="text-sm font-medium">Enviar por WhatsApp</p>
            <div className="space-y-1.5">
              <Label htmlFor="fone-whats">Número com DDD</Label>
              <Input
                id="fone-whats"
                value={fone || info?.phone || ""}
                onChange={(e) => setFone(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>
            <Button variant="outline" onClick={enviarWhats}>
              <MessageSquare className="h-4 w-4 mr-2" /> Abrir WhatsApp com a mensagem
            </Button>
          </div>

          <Button
            variant="ghost"
            onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado"); }}
          >
            Copiar link
          </Button>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}



function CreateUserDialog({
  open, onOpenChange, onDone,
}: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState<string>("admin");
  const [forcar, setForcar] = useState(true);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!email.trim()) return toast.error("Informe o e-mail");
    if (senha.length < 8) return toast.error("A senha temporária deve ter ao menos 8 caracteres");
    setSaving(true);
    try {
      await createUserWithPassword({
        data: {
          email: email.trim(),
          password: senha,
          full_name: nome.trim(),
          cargo: cargo.trim(),
          role: role as any,
          must_change_password: forcar,
        },
      });
      toast.success("Usuário criado");
      setEmail(""); setNome(""); setCargo(""); setSenha("");
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao criar usuário");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar usuário</DialogTitle>
          <DialogDescription>
            Crie a conta com uma senha temporária. No primeiro acesso o usuário será obrigado a definir a própria senha.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@empresa.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Setor / cargo</Label>
              <Input value={cargo} onChange={e => setCargo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Perfil</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Senha temporária</Label>
            <Input value={senha} onChange={e => setSenha(e.target.value)} placeholder="Mínimo de 8 caracteres" />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" checked={forcar} onChange={e => setForcar(e.target.checked)} />
            Exigir troca de senha no primeiro acesso
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Criar usuário
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function InviteDialog({
  open, onOpenChange, onDone, onInvited,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: () => void;
  onInvited: (info: { email: string; link: string; userId: string; name?: string | null; phone?: string | null }) => void;
}) {
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [fone, setFone] = useState("");
  const [role, setRole] = useState<string>("agente");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!email.trim()) return toast.error("Informe o e-mail");
    setSaving(true);
    try {
      const res: any = await inviteUser({
        data: {
          email: email.trim(),
          full_name: nome.trim(),
          cargo: cargo.trim(),
          phone: fone.trim(),
          role: role as any,
          origin: window.location.origin,
        },
      });
      toast.success("Convite gerado — escolha como enviar");
      setEmail(""); setNome(""); setCargo(""); setFone("");
      onOpenChange(false);
      onDone();
      onInvited({ email: res.email, link: res.link, userId: res.user_id, name: res.name, phone: res.phone });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar convite");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar convite</DialogTitle>
          <DialogDescription>
            A conta é criada sem senha. Depois você escolhe enviar o convite por e-mail ou WhatsApp — o usuário
            cadastra a própria senha ao abrir o link.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>E-mail</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@empresa.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>WhatsApp (opcional)</Label>
            <Input value={fone} onChange={e => setFone(e.target.value)} placeholder="(11) 99999-9999" />
          </div>
          <div className="space-y-1.5">
            <Label>Setor / cargo</Label>
            <Input value={cargo} onChange={e => setCargo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Perfil</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Enviar convite
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  row, onOpenChange, onDone,
}: { row: Row | null; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ email: "", full_name: "", cargo: "", phone: "", regiao: "" });
  const [loadedId, setLoadedId] = useState<string | null>(null);

  if (row && loadedId !== row.id) {
    setLoadedId(row.id);
    setForm({
      email: row.email ?? "",
      full_name: row.full_name ?? "",
      cargo: row.cargo ?? "",
      phone: row.phone ?? "",
      regiao: row.regiao ?? "",
    });
  }

  async function save() {
    if (!row) return;
    setSaving(true);
    try {
      await updateUserProfile({
        data: {
          user_id: row.id,
          email: form.email.trim(),
          full_name: form.full_name,
          cargo: form.cargo,
          phone: form.phone,
          regiao: form.regiao,
        },
      });
      toast.success("Perfil atualizado");
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar perfil</DialogTitle>
          <DialogDescription>{row?.email ?? ""}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>E-mail de acesso</Label>
            <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <p className="text-xs text-muted-foreground">Corrigir o e-mail altera o login do usuário.</p>
          </div>
          <div className="space-y-1.5">
            <Label>Nome</Label>
            <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Setor / cargo</Label>
              <Input value={form.cargo} onChange={e => setForm({ ...form, cargo: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Região</Label>
              <Input value={form.regiao} onChange={e => setForm({ ...form, regiao: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Telefone</Label>
            <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function accessForRole(role: string, permissions: { role: string; nav_key: string; allowed: boolean }[]) {
  if (role === "admin") return Object.fromEntries(ALL_NAV_KEYS.map(key => [key, true]));
  const allowed = new Set(permissions.filter(p => p.role === role && p.allowed).map(p => p.nav_key));
  return Object.fromEntries(ALL_NAV_KEYS.map(key => [key, allowed.has(key)]));
}

function propagateAccess(map: Record<string, boolean>, key: string, value: boolean) {
  const next = { ...map, [key]: value };
  const group = NAV_TREE.find(g => g.key === key);
  if (group) {
    for (const child of group.children) next[child.key] = value;
  } else if (value) {
    const parent = NAV_TREE.find(g => g.children.some(child => child.key === key));
    if (parent) next[parent.key] = true;
  }
  return next;
}

function RoleAccessDialog({
  row, onOpenChange, onDone,
}: { row: Row | null; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const qc = useQueryClient();
  const [role, setRole] = useState("none");
  const [access, setAccess] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-role-access", row?.id],
    enabled: !!row,
    queryFn: async () => {
      const [rolePermissions, userPermissions] = await Promise.all([
        supabase.from("role_permissions").select("role, nav_key, allowed"),
        (supabase as any).from("user_nav_permissions").select("nav_key, allowed").eq("user_id", row!.id),
      ]);
      if (rolePermissions.error) throw rolePermissions.error;
      if (userPermissions.error) throw userPermissions.error;
      return {
        rolePermissions: (rolePermissions.data ?? []) as { role: string; nav_key: string; allowed: boolean }[],
        userPermissions: (userPermissions.data ?? []) as { nav_key: string; allowed: boolean }[],
      };
    },
  });

  useEffect(() => {
    if (!row || !data) return;
    const selectedRole = row.role ?? "none";
    const next = accessForRole(selectedRole, data.rolePermissions);
    for (const permission of data.userPermissions) next[permission.nav_key] = permission.allowed;
    setRole(selectedRole);
    setAccess(next);
  }, [row, data]);

  function changeRole(nextRole: string) {
    setRole(nextRole);
    setAccess(accessForRole(nextRole, data?.rolePermissions ?? []));
  }

  async function save() {
    if (!row) return;
    setSaving(true);
    try {
      await updateUserProfile({
        data: { user_id: row.id, role: role === "none" ? null : role as "admin" | "gestor" | "agente" | "comercial" },
      });
      const rows = ALL_NAV_KEYS.map(navKey => ({ user_id: row.id, nav_key: navKey, allowed: !!access[navKey] }));
      const { error } = await (supabase as any)
        .from("user_nav_permissions")
        .upsert(rows, { onConflict: "user_id,nav_key" });
      if (error) throw error;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["user-permissions", row.id] }),
        qc.invalidateQueries({ queryKey: ["nav-access"] }),
      ]);
      toast.success("Papel e níveis de acesso atualizados");
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar papel e acessos");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Papel e níveis de acesso</DialogTitle>
          <DialogDescription>
            Defina o papel e os acessos permitidos para {row?.full_name ?? row?.email}.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Carregando acessos…</div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Papel</Label>
              <Select value={role} onValueChange={changeRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem papel</SelectItem>
                  {ROLE_OPTIONS.map(option => (
                    <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Acessos permitidos</Label>
              <div className="max-h-[48vh] overflow-y-auto rounded-lg border border-border">
                {NAV_TREE.map(group => (
                  <div key={group.key} className="border-b border-border last:border-0">
                    <label className="flex cursor-pointer items-center gap-3 px-4 py-3 font-medium hover:bg-muted/40">
                      <Checkbox
                        checked={!!access[group.key]}
                        onCheckedChange={value => setAccess(current => propagateAccess(current, group.key, !!value))}
                      />
                      {group.label}
                    </label>
                    {group.children.map(child => (
                      <label key={child.key} className="flex cursor-pointer items-center gap-3 border-t border-border/60 px-4 py-2.5 pl-10 text-sm text-muted-foreground hover:bg-muted/30">
                        <Checkbox
                          checked={!!access[child.key]}
                          onCheckedChange={value => setAccess(current => propagateAccess(current, child.key, !!value))}
                        />
                        {child.label}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving || isLoading}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} Salvar papel e acessos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
