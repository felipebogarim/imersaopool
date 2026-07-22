import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { adminMfaRecoverUser } from "@/lib/admin-mfa.functions";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { useAdminMfaStatus } from "@/hooks/use-admin-mfa";
import { MfaChallengeDialog } from "@/components/mfa/MfaChallengeDialog";

export const Route = createFileRoute("/_authenticated/admin/mfa-recuperacao")({
  ssr: false,
  head: () => ({ meta: [{ title: "Recuperação de MFA — PoolFlux" }] }),
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const { data: mfa } = useAdminMfaStatus();
  const recover = useServerFn(adminMfaRecoverUser);
  const [search, setSearch] = useState("");
  const [targetId, setTargetId] = useState<string | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [loading, setLoading] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [audit, setAudit] = useState<null | (() => Promise<void>)>(null);

  const { data: users } = useQuery({
    queryKey: ["admin-users-mfa"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (users ?? []) as any[];
    if (!q) return list.slice(0, 50);
    return list.filter(
      (u) =>
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.full_name ?? "").toLowerCase().includes(q),
    );
  }, [users, search]);

  async function submit() {
    if (!targetId) return toast.error("Selecione um usuário");
    if (justificativa.trim().length < 10)
      return toast.error("Justificativa mínima de 10 caracteres");
    if (mfa?.current_aal !== "aal2") {
      setAudit(() => async () => {
        await runRecovery();
      });
      setChallengeOpen(true);
      return;
    }
    await runRecovery();
  }

  async function runRecovery() {
    setLoading(true);
    try {
      const r = await recover({ data: { target_user_id: targetId!, justificativa } });
      toast.success(`MFA removido. Fatores: ${r.factors_removed}. Usuário deslogado.`);
      setJustificativa("");
      setTargetId(null);
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na recuperação");
    } finally {
      setLoading(false);
    }
  }

  const { data: auditLog } = useQuery({
    queryKey: ["mfa-audit"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_mfa_audit")
        .select("id, created_at, actor_id, user_id, event_type, metadata")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  return (
    <div>
      <PageHeader
        title="Recuperação de MFA"
        subtitle="Remoção emergencial de fatores por superadmin com justificativa auditada."
      />
      <div className="p-4 sm:p-8 space-y-6 max-w-4xl">
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm flex gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5 text-destructive" />
          <div>
            Esta ação remove <strong>todos</strong> os fatores TOTP do usuário e força o logout em
            todos os dispositivos. Ela exige que você esteja em AAL2 e é registrada de forma
            imutável.
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Selecionar usuário</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Pesquisar por e-mail ou nome"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-64 overflow-y-auto rounded-md border border-border divide-y divide-border">
              {filtered.map((u: any) => (
                <label
                  key={u.id}
                  className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent/40 ${
                    targetId === u.id ? "bg-accent/50" : ""
                  }`}
                >
                  <input
                    type="radio"
                    name="target"
                    checked={targetId === u.id}
                    onChange={() => setTargetId(u.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{u.full_name || u.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  {u.role && <Badge variant="outline">{u.role}</Badge>}
                </label>
              ))}
              {filtered.length === 0 && (
                <p className="p-3 text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Justificativa (mín. 10 caracteres)</label>
              <Textarea
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                rows={3}
                placeholder="Motivo da recuperação emergencial"
              />
            </div>
            <Button variant="destructive" onClick={submit} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Remover MFA do usuário
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Últimas 50 entradas de auditoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="text-left text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-3">Quando</th>
                    <th className="py-1 pr-3">Evento</th>
                    <th className="py-1 pr-3">Ator</th>
                    <th className="py-1 pr-3">Alvo</th>
                    <th className="py-1">Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {(auditLog ?? []).map((r: any) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="py-1 pr-3 whitespace-nowrap">
                        {new Date(r.created_at).toLocaleString("pt-BR")}
                      </td>
                      <td className="py-1 pr-3">{r.event_type}</td>
                      <td className="py-1 pr-3 font-mono">{(r.actor_id ?? "").slice(0, 8)}</td>
                      <td className="py-1 pr-3 font-mono">{(r.user_id ?? "").slice(0, 8)}</td>
                      <td className="py-1 font-mono max-w-[280px] truncate">
                        {JSON.stringify(r.metadata ?? {})}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
      <MfaChallengeDialog
        open={challengeOpen}
        onOpenChange={setChallengeOpen}
        onVerified={() => {
          if (audit) audit();
        }}
      />
    </div>
  );
}
