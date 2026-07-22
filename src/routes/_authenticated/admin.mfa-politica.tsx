import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { adminMfaSetPolicy } from "@/lib/admin-mfa.functions";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import { useAdminMfaStatus } from "@/hooks/use-admin-mfa";
import { MfaChallengeDialog } from "@/components/mfa/MfaChallengeDialog";

export const Route = createFileRoute("/_authenticated/admin/mfa-politica")({
  ssr: false,
  head: () => ({ meta: [{ title: "Política de MFA — PoolFlux" }] }),
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const { data: mfa } = useAdminMfaStatus();
  const setPolicy = useServerFn(adminMfaSetPolicy);
  const [graceDays, setGraceDays] = useState(7);
  const [justificativa, setJustificativa] = useState("");
  const [loading, setLoading] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [pendingEnforce, setPendingEnforce] = useState<boolean | null>(null);

  const { data: policy } = useQuery({
    queryKey: ["admin-mfa-policy"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_mfa_policy")
        .select("enforcement_started_at, grace_period_days, updated_by, updated_at")
        .maybeSingle();
      return data;
    },
  });

  const enforcing = !!policy?.enforcement_started_at;

  async function trigger(enforce: boolean) {
    if (justificativa.trim().length < 10)
      return toast.error("Justificativa mínima de 10 caracteres");
    if (mfa?.current_aal !== "aal2") {
      setPendingEnforce(enforce);
      setChallengeOpen(true);
      return;
    }
    await run(enforce);
  }

  async function run(enforce: boolean) {
    setLoading(true);
    try {
      await setPolicy({ data: { enforce, grace_days: graceDays, justificativa } });
      toast.success(enforce ? "Enforcement ativado. Contagem regressiva iniciada." : "Enforcement desativado.");
      setJustificativa("");
      qc.invalidateQueries();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao alterar política");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Política de MFA"
        subtitle="Ativa/desativa MFA obrigatório para administradores. Requer AAL2 e justificativa."
      />
      <div className="p-4 sm:p-8 space-y-6 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Status atual
              <Badge variant={enforcing ? "default" : "outline"}>
                {enforcing ? "Ativo" : "Desativado"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Iniciado em:{" "}
              <strong>
                {policy?.enforcement_started_at
                  ? new Date(policy.enforcement_started_at).toLocaleString("pt-BR")
                  : "—"}
              </strong>
            </p>
            <p>
              Prazo de adaptação: <strong>{policy?.grace_period_days ?? 7} dias</strong>
            </p>
            {mfa?.deadline && (
              <p>
                Fim do prazo: <strong>{new Date(mfa.deadline).toLocaleString("pt-BR")}</strong>{" "}
                {mfa.days_left != null && `(faltam ${mfa.days_left} dia(s))`}
              </p>
            )}
            <p className="text-muted-foreground">
              Você está em <Badge variant="outline">{mfa?.current_aal ?? "aal1"}</Badge>. Alterações
              exigem AAL2.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Alterar política</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-sm font-medium">Prazo de adaptação (dias)</label>
              <Input
                type="number"
                min={1}
                max={30}
                value={graceDays}
                onChange={(e) => setGraceDays(Number(e.target.value) || 7)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Justificativa (mín. 10 caracteres)</label>
              <Textarea
                value={justificativa}
                onChange={(e) => setJustificativa(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={() => trigger(true)} disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 mr-2" />
                )}
                Ativar enforcement
              </Button>
              <Button variant="outline" onClick={() => trigger(false)} disabled={loading}>
                <Pause className="h-4 w-4 mr-2" /> Desativar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <MfaChallengeDialog
        open={challengeOpen}
        onOpenChange={setChallengeOpen}
        onVerified={() => {
          if (pendingEnforce !== null) run(pendingEnforce);
        }}
      />
    </div>
  );
}
