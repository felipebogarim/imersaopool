import { createFileRoute, useNavigate, useRouter, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { clearAuthGateCache } from "@/lib/auth-gate";

export const Route = createFileRoute("/_authenticated/aceite-termos")({
  head: () => ({ meta: [{ title: "Aceite dos Termos" }, { name: "robots", content: "noindex" }] }),
  component: AceitePage,
});

function AceitePage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: active, isLoading } = useQuery({
    queryKey: ["terms-active-accept"],
    queryFn: async () => {
      const { data, error } = await supabase.from("terms_versions").select("*").eq("is_active", true).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  async function accept() {
    setSubmitting(true);
    try {
      const sessionId = (await supabase.auth.getSession()).data.session?.access_token?.slice(-16);
      const { error } = await supabase.rpc("record_terms_acceptance", {
        _session_id: sessionId ?? undefined,
        _user_agent: navigator.userAgent.slice(0, 500),
      });
      if (error) throw error;
      clearAuthGateCache();
      toast.success("Aceite registrado.");
      await router.invalidate();
      await navigate({ to: "/home", replace: true });
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível registrar seu aceite. Verifique sua conexão e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-xl sm:text-2xl font-bold">Aceite dos Termos de Uso, Privacidade e Confidencialidade</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Para continuar usando a plataforma, leia integralmente e aceite a versão vigente dos Termos.
        </p>

        {isLoading || !active ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
        ) : (
          <>
            <div className="text-xs text-muted-foreground">
              Versão {active.version} • Publicada em {new Date(active.published_at).toLocaleString("pt-BR")}
            </div>
            <article className="rounded-lg border border-border bg-card p-6 max-h-[55vh] overflow-y-auto">
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">{active.content}</pre>
            </article>

            <label className="flex items-start gap-3 p-3 rounded-md border border-border bg-muted/30 cursor-pointer">
              <Checkbox checked={checked} onCheckedChange={(v) => setChecked(v === true)} className="mt-0.5" />
              <span className="text-sm">Li e concordo com os Termos de Uso, Privacidade e Confidencialidade.</span>
            </label>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <Link to="/termos-de-uso" className="text-sm text-primary hover:underline">
                Abrir página completa dos Termos
              </Link>
              <Button onClick={accept} disabled={!checked || submitting} size="lg">
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                ACEITAR E ACESSAR A PLATAFORMA
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
