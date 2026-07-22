import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldOff, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAdminMfaStatus } from "@/hooks/use-admin-mfa";
import { MfaEnrollDialog } from "@/components/mfa/MfaEnrollDialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/admin/mfa")({
  ssr: false,
  head: () => ({ meta: [{ title: "Meu MFA — PoolFlux" }] }),
  component: MfaPage,
});

function MfaPage() {
  const qc = useQueryClient();
  const { data: status } = useAdminMfaStatus();
  const [enrollOpen, setEnrollOpen] = useState(false);

  const { data: factors, refetch } = useQuery({
    queryKey: ["mfa-my-factors"],
    queryFn: async () => {
      const { data } = await supabase.auth.mfa.listFactors();
      return data?.all ?? [];
    },
  });

  const [removingId, setRemovingId] = useState<string | null>(null);
  async function remove(id: string) {
    const verifiedCount = (factors ?? []).filter((f) => f.status === "verified").length;
    // Admins com política de MFA ativa não podem remover o próprio último fator;
    // isso exige recuperação por um superadministrador (com auditoria).
    if (status?.is_admin && status.enforcement_started_at && verifiedCount <= 1) {
      toast.error(
        "Com o MFA obrigatório ativo, apenas um superadministrador pode remover o seu fator. Solicite a recuperação em /admin/mfa-recuperacao."
      );
      return;
    }
    if (!confirm("Remover este fator? Você precisará configurar novamente.")) return;
    setRemovingId(id);
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    setRemovingId(null);
    if (error) return toast.error(error.message);
    toast.success("Fator removido.");
    refetch();
    qc.invalidateQueries({ queryKey: ["admin-mfa-status"] });
  }

  const hasVerified = (factors ?? []).some((f) => f.status === "verified");

  return (
    <div>
      <PageHeader
        title="Autenticação em duas etapas"
        subtitle="Proteção obrigatória para contas administrativas."
      />
      <div className="p-4 sm:p-8 max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {hasVerified ? (
                <>
                  <ShieldCheck className="h-5 w-5 text-primary" /> MFA ativo
                </>
              ) : (
                <>
                  <ShieldOff className="h-5 w-5 text-destructive" /> MFA não configurado
                </>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {status?.grace_active && !hasVerified && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                Faltam <strong>{status.days_left}</strong> dia(s) para bloqueio automático.
                Prazo: {status.deadline ? new Date(status.deadline).toLocaleString("pt-BR") : "—"}.
              </div>
            )}
            {status?.must_enroll_now && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
                Prazo encerrado. Ações administrativas sensíveis estão bloqueadas até que o MFA seja
                ativado.
              </div>
            )}
            <div className="text-sm text-muted-foreground">
              Nível de sessão atual:{" "}
              <Badge variant="outline">{status?.current_aal ?? "aal1"}</Badge>
            </div>
            <Button onClick={() => setEnrollOpen(true)}>
              {hasVerified ? "Adicionar novo dispositivo" : "Configurar MFA"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Meus fatores</CardTitle>
          </CardHeader>
          <CardContent>
            {(factors ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum fator configurado.</p>
            ) : (
              <ul className="divide-y divide-border">
                {(factors ?? []).map((f) => (
                  <li key={f.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {f.friendly_name ?? f.factor_type} · {f.factor_type.toUpperCase()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Status: {f.status} · Criado {new Date(f.created_at).toLocaleString("pt-BR")}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(f.id)}
                      disabled={removingId === f.id}
                    >
                      {removingId === f.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
      <MfaEnrollDialog
        open={enrollOpen}
        onOpenChange={setEnrollOpen}
        onSuccess={() => refetch()}
        mandatory={!!status?.must_enroll_now}
      />
    </div>
  );
}
