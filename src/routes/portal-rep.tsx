import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  CalendarCheck,
  LogOut,
  Sparkles,
  Target,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getRepPortal } from "@/lib/rep-portal.functions";
import { RepMetasArea } from "@/components/performance-metas/RepMetasArea";
import { RepAcoesSugeridasView } from "@/components/acoes-reps/RepAcoesSugeridasView";
import { RepAcoesCalendarioView } from "@/components/acoes-reps/RepAcoesCalendarioView";

export const Route = createFileRoute("/portal-rep")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Portal do Representante | PoolFlux" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
  component: PortalRep,
});

type PortalTab = "metas" | "acoes_sugeridas" | "calendario";

function PortalRep() {
  const navigate = useNavigate();
  const portalFn = useServerFn(getRepPortal);
  const [activeTab, setActiveTab] = useState<PortalTab>("metas");

  const { data, isLoading, error } = useQuery({
    queryKey: ["rep-portal"],
    queryFn: () => portalFn(),
  });

  const actions = useMemo(() => data?.actions ?? [], [data]);

  // Sugestões pendentes de resposta do representante
  const pendingCount = useMemo(
    () => actions.filter((a) => a.acceptance !== "aceita" && a.acceptance !== "recusada").length,
    [actions],
  );

  // Ações aceitas e agendadas no calendário
  const acceptedCount = useMemo(
    () => actions.filter((a) => a.acceptance === "aceita").length,
    [actions],
  );

  async function signOut() {
    await supabase.auth.signOut();
    void navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Top Header */}
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <BrandMark className="h-8 w-8" />
            <div>
              <h1 className="text-base font-semibold leading-tight">Portal do Representante</h1>
              {data && (
                <p className="text-xs text-muted-foreground">
                  {data.rep.nome} · Painel de Gestão & Carteira
                </p>
              )}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void signOut()}>
            <LogOut className="mr-1 h-4 w-4" />
            Sair
          </Button>
        </div>
      </header>

      {/* Menu Fixo do Portal */}
      <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-sm shadow-xs">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2">
          <nav className="flex space-x-1 sm:space-x-2" aria-label="Menu Principal do Representante">
            <button
              type="button"
              onClick={() => setActiveTab("metas")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer select-none",
                activeTab === "metas"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Target className="h-4 w-4" />
              Metas
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("acoes_sugeridas")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer select-none relative",
                activeTab === "acoes_sugeridas"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Sparkles className="h-4 w-4" />
              Ações Sugeridas
              {pendingCount > 0 && (
                <span
                  className={cn(
                    "ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold leading-none",
                    activeTab === "acoes_sugeridas"
                      ? "bg-primary-foreground text-primary"
                      : "bg-amber-500 text-white",
                  )}
                >
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("calendario")}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer select-none relative",
                activeTab === "calendario"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <CalendarCheck className="h-4 w-4" />
              Calendário de Ações
              {acceptedCount > 0 && (
                <span
                  className={cn(
                    "ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold leading-none",
                    activeTab === "calendario"
                      ? "bg-primary-foreground text-primary"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300",
                  )}
                >
                  {acceptedCount}
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>

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
