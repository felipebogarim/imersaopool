import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { executePurgeAction } from "@/lib/lgpd-purge.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { PasswordConfirmDialog } from "@/components/PasswordConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldAlert, LogOut, UserX, Trash2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/lgpd")({
  head: () => ({
    meta: [
      { title: "LGPD e Expurgo — Imersões Comerciais" },
      { name: "description", content: "Gestão de direitos do titular LGPD com auditoria imutável." },
    ],
  }),
  component: LgpdPage,
});

type ActionType = "revoke_sessions" | "anonymize" | "delete";

const ACTION_META: Record<ActionType, { label: string; icon: typeof LogOut; danger: boolean; help: string }> = {
  revoke_sessions: {
    label: "Revogar sessões ativas",
    icon: LogOut,
    danger: false,
    help: "Encerra imediatamente todas as sessões do usuário. Ele precisará entrar novamente.",
  },
  anonymize: {
    label: "Anonimizar dados pessoais",
    icon: UserX,
    danger: true,
    help: "Substitui nome e e-mail por identificador anônimo irreversível. O usuário mantém o histórico mas perde identificação.",
  },
  delete: {
    label: "Excluir conta definitivamente",
    icon: Trash2,
    danger: true,
    help: "Remove o usuário e todos os dados vinculados por cascata. Ação irreversível.",
  },
};

function LgpdPage() {
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<{ id: string; email: string; name: string } | null>(null);
  const [action, setAction] = useState<ActionType | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [busy, setBusy] = useState(false);
  const runPurge = useServerFn(executePurgeAction);
  const qc = useQueryClient();

  const users = useQuery({
    queryKey: ["admin-users-lgpd"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users");
      if (error) throw error;
      return data ?? [];
    },
  });

  const history = useQuery({
    queryKey: ["lgpd-history"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("data_purge_requests" as any)
        .select("*")
        .order("executed_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const filtered = (users.data ?? []).filter((u: any) =>
    !search ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  function openAction(user: any, act: ActionType) {
    setTarget({ id: user.id, email: user.email, name: user.full_name ?? user.email });
    setAction(act);
    setJustificativa("");
  }

  async function proceed() {
    if (!target || !action) return;
    if (justificativa.trim().length < 10) {
      toast.error("Justificativa mínima de 10 caracteres");
      return;
    }
    setShowPwd(true);
  }

  async function confirmed() {
    if (!target || !action) return;
    setBusy(true);
    try {
      await runPurge({ data: { target_user_id: target.id, request_type: action, justificativa: justificativa.trim() } });
      toast.success("Ação executada e registrada em auditoria");
      setTarget(null);
      setAction(null);
      setJustificativa("");
      qc.invalidateQueries({ queryKey: ["lgpd-history"] });
      qc.invalidateQueries({ queryKey: ["admin-users-lgpd"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao executar ação");
    } finally {
      setBusy(false);
      setShowPwd(false);
    }
  }

  return (
    <AppShell>
      <PageHeader title="LGPD e Expurgo" subtitle="Direitos do titular: revogar sessões, anonimizar ou excluir dados. Toda ação exige justificativa e fica registrada de forma imutável." />
      <div className="p-4 sm:p-8 space-y-6">
        <div className="rounded-lg border-2 border-destructive/40 bg-destructive/5 p-4 flex gap-3">
          <ShieldAlert className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-destructive">Ações irreversíveis</p>
            <p className="text-muted-foreground mt-1">
              Anonimização e exclusão não podem ser desfeitas. Toda execução é registrada com sua identidade, justificativa e horário, e disponibilizada para auditoria.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Usuários</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative max-w-sm">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por nome ou e-mail" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Papel</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.isLoading && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Carregando…</TableCell></TableRow>
                  )}
                  {filtered.map((u: any) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.full_name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{u.email}</TableCell>
                      <TableCell><Badge variant="outline">{u.role ?? "—"}</Badge></TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button size="sm" variant="ghost" onClick={() => openAction(u, "revoke_sessions")}><LogOut className="h-3.5 w-3.5 mr-1" />Revogar</Button>
                        <Button size="sm" variant="ghost" onClick={() => openAction(u, "anonymize")}><UserX className="h-3.5 w-3.5 mr-1" />Anonimizar</Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => openAction(u, "delete")}><Trash2 className="h-3.5 w-3.5 mr-1" />Excluir</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Histórico de expurgos (imutável)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quando</TableHead>
                    <TableHead>Alvo</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Solicitante</TableHead>
                    <TableHead>Justificativa</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.isLoading && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Carregando…</TableCell></TableRow>
                  )}
                  {(history.data ?? []).length === 0 && !history.isLoading && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhuma ação registrada.</TableCell></TableRow>
                  )}
                  {(history.data ?? []).map((h) => (
                    <TableRow key={h.id}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(h.executed_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-xs">{h.target_email}</TableCell>
                      <TableCell><Badge variant="outline">{ACTION_META[h.request_type as ActionType]?.label ?? h.request_type}</Badge></TableCell>
                      <TableCell className="text-xs">{h.requester_email}</TableCell>
                      <TableCell className="text-xs max-w-xs truncate" title={h.justificativa}>{h.justificativa}</TableCell>
                      <TableCell>
                        <Badge variant={h.status === "executado" ? "default" : "destructive"}>{h.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!target && !!action} onOpenChange={(o) => { if (!o) { setTarget(null); setAction(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {action && (() => { const Icon = ACTION_META[action].icon; return <Icon className="h-5 w-5" />; })()}
              {action && ACTION_META[action].label}
            </DialogTitle>
            <DialogDescription>{action && ACTION_META[action].help}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border p-3 bg-muted/30 text-sm">
              <p className="font-medium">{target?.name}</p>
              <p className="text-muted-foreground">{target?.email}</p>
            </div>
            <div className="space-y-2">
              <Label>Justificativa (mín. 10 caracteres)</Label>
              <Textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} rows={3} placeholder="Ex.: Solicitação formal do titular via e-mail em 22/07/2026, protocolo #123." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setTarget(null); setAction(null); }}>Cancelar</Button>
            <Button variant={action && ACTION_META[action].danger ? "destructive" : "default"} onClick={proceed} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Prosseguir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PasswordConfirmDialog
        open={showPwd}
        onOpenChange={setShowPwd}
        title="Confirmação de gestor master"
        description="Digite sua senha para autorizar a ação LGPD."
        onConfirmed={confirmed}
      />
    </AppShell>
  );
}
