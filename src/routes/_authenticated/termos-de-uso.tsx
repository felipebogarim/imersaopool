import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/termos-de-uso")({
  head: () => ({
    meta: [
      { title: "Termos de Uso — Imersão Comercial" },
      { name: "description", content: "Termos de Uso, Privacidade e Confidencialidade da plataforma." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TermosPage,
});

function statusLabel(s?: string) {
  switch (s) {
    case "aceito": return { label: "Aceito", variant: "default" as const };
    case "aceite_pendente": return { label: "Aceite pendente", variant: "destructive" as const };
    case "nova_versao_disponivel": return { label: "Nova versão disponível", variant: "secondary" as const };
    default: return { label: "—", variant: "outline" as const };
  }
}

function TermosPage() {
  const { data: active, isLoading } = useQuery({
    queryKey: ["terms-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("terms_versions")
        .select("*")
        .eq("is_active", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: status } = useQuery({
    queryKey: ["terms-status"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_my_terms_status");
      if (error) throw error;
      return Array.isArray(data) ? data[0] : data;
    },
  });

  const st = statusLabel(status?.status);

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Termos de Uso, Privacidade e Confidencialidade"
        subtitle="Regras de utilização, sigilo e proteção de dados da plataforma"
      />
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 space-y-6">
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
        ) : !active ? (
          <p className="text-muted-foreground">Nenhuma versão ativa publicada.</p>
        ) : (
          <>
            <div className="rounded-lg border border-border bg-card p-4 grid gap-2 sm:grid-cols-2 text-sm">
              <div><span className="text-muted-foreground">Versão vigente:</span> <strong>{active.version}</strong></div>
              <div><span className="text-muted-foreground">Publicada em:</span> {new Date(active.published_at).toLocaleString("pt-BR")}</div>
              <div><span className="text-muted-foreground">Vigência:</span> {new Date(active.effective_at).toLocaleString("pt-BR")}</div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Seu status:</span>
                <Badge variant={st.variant}>{st.label}</Badge>
              </div>
              {status?.last_accepted_at && (
                <div className="sm:col-span-2 text-muted-foreground">
                  Último aceite: {new Date(status.last_accepted_at).toLocaleString("pt-BR")} (versão {status.last_accepted_version})
                </div>
              )}
            </div>

            {status?.status !== "aceito" && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm flex items-center justify-between gap-3">
                <span>É necessário aceitar a versão vigente para continuar utilizando a plataforma.</span>
                <Link to="/aceite-termos" className="inline-flex items-center gap-1 rounded-md bg-primary text-primary-foreground px-3 py-1.5 text-sm font-medium hover:opacity-90">
                  Revisar e aceitar
                </Link>
              </div>
            )}

            <article className="rounded-lg border border-border bg-card p-6">
              <div className="flex items-center gap-2 mb-4 text-muted-foreground text-xs uppercase tracking-widest">
                <FileText className="h-3.5 w-3.5" /> Conteúdo integral
              </div>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                {active.content}
              </pre>
            </article>
          </>
        )}
      </div>
    </div>
  );
}
