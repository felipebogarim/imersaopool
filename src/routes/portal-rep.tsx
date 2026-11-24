import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { RepMetasArea } from "@/components/performance-metas/RepMetasArea";
import { RepAcoesSugeridasView } from "@/components/acoes-reps/RepAcoesSugeridasView";
import { RepAcoesCalendarioView } from "@/components/acoes-reps/RepAcoesCalendarioView";
import {
  PORTAL_TABS,
  RepPortalChrome,
  useRepPortalData,
  type PortalTab,
} from "@/components/rep-portal/RepPortalChrome";

export const Route = createFileRoute("/portal-rep")({
  ssr: false,
  // Aba ativa na URL: o menu das páginas internas do portal abre a aba certa.
  validateSearch: (search: Record<string, unknown>): { tab?: PortalTab } =>
    PORTAL_TABS.includes(search.tab as PortalTab) && search.tab !== "metas"
      ? { tab: search.tab as PortalTab }
      : {},
  head: () => ({
    meta: [{ title: "Portal do Representante | PoolFlux" }, { name: "robots", content: "noindex" }],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
  component: PortalRep,
});

function PortalRep() {
  const navigate = useNavigate();
  const { tab } = Route.useSearch();
  const activeTab: PortalTab = tab ?? "metas";
  const setActiveTab = (t: PortalTab) =>
    void navigate({ to: "/portal-rep", search: t === "metas" ? {} : { tab: t }, replace: true });

  const { data, isLoading, error, actions, pendingCount, acceptedCount } = useRepPortalData();

  return (
    <div className="min-h-screen bg-muted/30">
      <RepPortalChrome
        activeTab={activeTab}
        onTabChange={setActiveTab}
        repName={data?.rep.nome}
        pendingCount={pendingCount}
        acceptedCount={acceptedCount}
      />

      {/* Conteúdo Principal */}
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando dados…</p>}
        {error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            {error instanceof Error ? error.message : "Não foi possível carregar as informações."}
          </p>
        )}

        {/* Aba 1: Metas (dashboard, lista de clientes, gauges, timeline) */}
        {activeTab === "metas" && <RepMetasArea />}

        {/* Aba 2: Ações Sugeridas (cards das ações sugeridas com botão intuitivo de aceite) */}
        {activeTab === "acoes_sugeridas" && (
          <RepAcoesSugeridasView
            actions={actions}
            onNavigateToCalendar={() => setActiveTab("calendario")}
          />
        )}

        {/* Aba 3: Calendário de Ações (cronograma de ações aceitas, prazos e andamento) */}
        {activeTab === "calendario" && (
          <RepAcoesCalendarioView
            actions={actions}
            onNavigateToSuggestions={() => setActiveTab("acoes_sugeridas")}
          />
        )}
      </main>
    </div>
  );
}
export default PortalRep;
