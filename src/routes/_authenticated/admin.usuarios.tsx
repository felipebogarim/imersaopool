import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
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
  Users, UserCog, Send, Key, MessageSquare, Lock, MapPin, FileText, Trash2, Check, Loader2, UserPlus, LinkIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  inviteUser, updateUserProfile, deleteUserAccount, getUserAudit, createUserWithPassword, generateFirstAccessLink,
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

type AuditRow = {
  id: string;
  tipo: string;
  acao: string | null;
  recurso: string | null;
  resultado: string | null;
  nivel_risco: string | null;
  ip: string | null;
  user_agent: string | null;
  ocorrido_em: string;
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

function fmtDateTime(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR");
}

function roleLabel(r: string | null) {
  return ROLE_OPTIONS.find(o => o.value === r)?.label ?? "—";
}

function UsuariosPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [linkInfo, setLinkInfo] = useState<{ email: string; link: string } | null>(null);
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [auditRow, setAuditRow] = useState<Row | null>(null);
  const [localRow, setLocalRow] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

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

  async function removeUser(r: Row) {
    if (!confirm(`Remover definitivamente ${r.full_name ?? r.email}? Esta ação exclui a conta de acesso.`)) return;
    setBusy(true);
    try {
      await deleteUserAccount({ data: { user_id: r.id } });
      toast.success("Usuário removido");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao remover usuário");
    } finally {
      setBusy(false);
    }
  }

  async function firstAccess(r: Row) {
    setBusy(true);
    try {
      const res: any = await generateFirstAccessLink({
        data: { user_id: r.id, redirect_to: window.location.origin + "/" },
      });
      if (!res?.link) throw new Error("Não foi possível gerar o link");
      setLinkInfo({ email: res.email, link: res.link });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar link de primeiro acesso");
    } finally {
      setBusy(false);
    }
  }

  function message(r: Row) {
    if (!r.email) return toast.error("Usuário sem e-mail");
    window.location.href = `mailto:${r.email}?subject=${encodeURIComponent("Contato — Painel")}`;
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
                            : "bg-yellow-100 text-yellow-700"
                        )}
                      >
                        <Check className="h-3 w-3" />
                        {r.status === "aprovado" || r.status === "ativo" ? "Aprovado" : "Pendente"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{fmt(r.created_at)}</td>
                    <td className="px-6 py-4 text-muted-foreground">{fmt(r.last_sign_in_at)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <ActionIcon icon={Key} label="Resetar Senha" onClick={() => resetPassword(r.email)} />
                        {!r.last_sign_in_at && (
                          <ActionIcon
                            icon={LinkIcon}
                            label="Enviar convite de primeiro acesso"
                            disabled={busy}
                            onClick={() => firstAccess(r)}
                          />
                        )}
                        <ActionIcon icon={UserCog} label="Editar Perfil" onClick={() => setEditRow(r)} />
                        <ActionIcon icon={MessageSquare} label="Mensagem" onClick={() => message(r)} />
                        <ActionIcon
                          icon={Lock}
                          label="Acessos"
                          onClick={() => navigate({ to: "/admin/permissoes" })}
                        />
                        <ActionIcon icon={MapPin} label="Localização" onClick={() => setLocalRow(r)} />
                        <ActionIcon icon={FileText} label="Auditoria" onClick={() => setAuditRow(r)} />
                        <ActionIcon icon={Trash2} label="Remover" danger disabled={busy} onClick={() => removeUser(r)} />
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
      />
      <EditDialog
        row={editRow}
        onOpenChange={(o) => !o && setEditRow(null)}
        onDone={() => qc.invalidateQueries({ queryKey: ["admin-users"] })}
      />
      <FirstAccessDialog info={linkInfo} onOpenChange={(o) => !o && setLinkInfo(null)} />
      <AuditDialog row={auditRow} onOpenChange={(o) => !o && setAuditRow(null)} />
      <LocalizacaoDialog row={localRow} onOpenChange={(o) => !o && setLocalRow(null)} />
    </div>
  );
}

function FirstAccessDialog({
  info, onOpenChange,
}: { info: { email: string; link: string } | null; onOpenChange: (o: boolean) => void }) {
  const link = info?.link ?? "";
  const email = info?.email ?? "";
  const corpo = `Olá,\n\nSeu acesso ao painel foi criado. Use o link abaixo para entrar pela primeira vez (no primeiro acesso você definirá a sua própria senha):\n\n${link}\n\nO link é pessoal e tem validade limitada.`;

  return (
    <Dialog open={!!info} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Convite de primeiro acesso</DialogTitle>
          <DialogDescription>
            Link pessoal para <strong>{email}</strong> entrar pela primeira vez. Ao acessar, ele será obrigado a
            definir a própria senha. O link tem validade limitada (padrão: 1 hora).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs break-all font-mono">{link}</div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => { navigator.clipboard.writeText(link); toast.success("Link copiado"); }}
            >
              Copiar link
            </Button>
            <Button
              onClick={() => {
                window.location.href = `mailto:${email}?subject=${encodeURIComponent("Seu acesso ao painel")}&body=${encodeURIComponent(corpo)}`;
              }}
            >
              <Send className="h-4 w-4 mr-2" /> Enviar por e-mail
            </Button>
          </div>
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
  open, onOpenChange, onDone,
}: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [role, setRole] = useState<string>("agente");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!email.trim()) return toast.error("Informe o e-mail");
    setSaving(true);
    try {
      await inviteUser({
        data: {
          email: email.trim(),
          full_name: nome.trim(),
          cargo: cargo.trim(),
          role: role as any,
          redirect_to: window.location.origin + "/auth",
        },
      });
      toast.success("Convite enviado");
      setEmail(""); setNome(""); setCargo("");
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar convite");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enviar convite</DialogTitle>
          <DialogDescription>O usuário receberá um e-mail para definir a senha e acessar o painel.</DialogDescription>
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
  const [form, setForm] = useState({ full_name: "", cargo: "", phone: "", regiao: "", status: "pendente", role: "none" });
  const [loadedId, setLoadedId] = useState<string | null>(null);

  if (row && loadedId !== row.id) {
    setLoadedId(row.id);
    setForm({
      full_name: row.full_name ?? "",
      cargo: row.cargo ?? "",
      phone: row.phone ?? "",
      regiao: row.regiao ?? "",
      status: row.status ?? "pendente",
      role: row.role ?? "none",
    });
  }

  async function save() {
    if (!row) return;
    setSaving(true);
    try {
      await updateUserProfile({
        data: {
          user_id: row.id,
          full_name: form.full_name,
          cargo: form.cargo,
          phone: form.phone,
          regiao: form.regiao,
          status: form.status as any,
          role: form.role === "none" ? null : (form.role as any),
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="aprovado">Aprovado</SelectItem>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Perfil de acesso</Label>
            <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem perfil</SelectItem>
                {ROLE_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
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

function useAudit(row: Row | null) {
  return useQuery({
    queryKey: ["admin-user-audit", row?.id],
    enabled: !!row,
    queryFn: async () => (await getUserAudit({ data: { user_id: row!.id, limit: 50 } })) as AuditRow[],
  });
}

function AuditDialog({ row, onOpenChange }: { row: Row | null; onOpenChange: (o: boolean) => void }) {
  const { data, isLoading } = useAudit(row);
  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Auditoria — {row?.full_name ?? row?.email}</DialogTitle>
          <DialogDescription>Últimos 50 eventos de segurança registrados para este usuário.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-border">
          {isLoading && <div className="p-6 text-center text-muted-foreground text-sm">Carregando…</div>}
          {!isLoading && (data?.length ?? 0) === 0 && (
            <div className="p-6 text-center text-muted-foreground text-sm">Nenhum evento registrado</div>
          )}
          {(data ?? []).map(e => (
            <div key={e.id} className="border-b border-border last:border-0 px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{e.acao ?? e.tipo}</span>
                <span className="text-xs text-muted-foreground">{fmtDateTime(e.ocorrido_em)}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {[e.recurso, e.resultado, e.nivel_risco, e.ip].filter(Boolean).join(" · ") || "—"}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LocalizacaoDialog({ row, onOpenChange }: { row: Row | null; onOpenChange: (o: boolean) => void }) {
  const { data, isLoading } = useAudit(row);
  const acessos = (data ?? []).filter(e => e.ip).slice(0, 20);
  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Localização e dispositivos — {row?.full_name ?? row?.email}</DialogTitle>
          <DialogDescription>
            Região cadastrada: <strong>{row?.regiao ?? "não informada"}</strong>
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[55vh] overflow-y-auto rounded-lg border border-border">
          {isLoading && <div className="p-6 text-center text-muted-foreground text-sm">Carregando…</div>}
          {!isLoading && acessos.length === 0 && (
            <div className="p-6 text-center text-muted-foreground text-sm">Nenhum acesso com IP registrado</div>
          )}
          {acessos.map(e => (
            <div key={e.id} className="border-b border-border last:border-0 px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{e.ip}</span>
                <span className="text-xs text-muted-foreground">{fmtDateTime(e.ocorrido_em)}</span>
              </div>
              <div className="text-xs text-muted-foreground truncate">{e.user_agent ?? "—"}</div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ActionIcon({
  icon: Icon, label, onClick, danger, disabled,
}: { icon: any; label: string; onClick?: () => void; danger?: boolean; disabled?: boolean }) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={cn(
              "h-8 w-8 rounded-md flex items-center justify-center transition disabled:opacity-40",
              danger
                ? "text-red-500 hover:bg-red-50"
                : "text-foreground/70 hover:bg-primary hover:text-primary-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
