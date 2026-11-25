import { useMemo, useState } from "react";
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
import { RepAcoesUteis } from "@/components/rep-portal/RepAcoesUteis";
import { RepAgendaView } from "@/components/rep-portal/RepAgendaView";
import { RepSolicitacoesView } from "@/components/rep-portal/RepSolicitacoesView";
import {
  RepSolicitacaoDialog,
  type SolicitacaoPreset,
} from "@/components/rep-portal/RepSolicitacaoDialog";
import { useRepSolicitacoes } from "@/components/rep-portal/use-rep-solicitacoes";
import { solicitacaoEmAberto } from "@/lib/rep-solicitacoes";

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
  const { data: solicitacoes } = useRepSolicitacoes();
  const solicitacoesAbertas = solicitacoes?.available
    ? solicitacoes.items.filter((s) => solicitacaoEmAberto(s.status)).length
    : 0;
  // Formulário de solicitação de apoio (atalhos, card de ação ou aba Solicitações).
  const [preset, setPreset] = useState<SolicitacaoPreset | null>(null);
  const clientes = useMemo(
    () => [...new Set(actions.map((a) => a.client?.trim()).filter((c): c is string => !!c))].sort(),
    [actions],
  );

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

        {/* Guia de Agenda: visitas da semana e o guia de cada cliente */}
        {activeTab === "agenda" && <RepAgendaView actions={actions} />}

        {/* Aba 2: Ações Sugeridas (cards das ações sugeridas com botão intuitivo de aceite) */}
        {activeTab === "acoes_sugeridas" && (
          <RepAcoesSugeridasView
            actions={actions}
            onNavigateToCalendar={() => setActiveTab("calendario")}
            onSolicitarApoio={(a) =>
              setPreset({
                tipo: "material_evento",
                cliente: a.client ?? null,
                cardId: a.id,
                titulo: a.title,
                acaoVinculada: a.title,
              })
            }
            topo={
              <RepAcoesUteis
                onSolicitar={(tipo) => setPreset({ tipo })}
                onVerSolicitacoes={() => setActiveTab("solicitacoes")}
                emAberto={solicitacoesAbertas}
              />
            }
          />
        )}

        {/* Aba 3: Calendário de Ações (cronograma de ações aceitas, prazos e andamento) */}
        {activeTab === "calendario" && (
          <RepAcoesCalendarioView
            actions={actions}
            onNavigateToSuggestions={() => setActiveTab("acoes_sugeridas")}
          />
        )}

        {/* Aba 4: Solicitações de apoio (materiais para eventos, trade, PDV, amostras) */}
        {activeTab === "solicitacoes" && (
          <RepSolicitacoesView onSolicitar={(tipo) => setPreset({ tipo })} />
        )}
      </main>

      <RepSolicitacaoDialog
        preset={preset}
        clientes={clientes}
        onClose={() => setPreset(null)}
        onCreated={() => setActiveTab("solicitacoes")}
      />
    </div>
  );
}
export default PortalRep;
