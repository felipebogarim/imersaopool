// Cabeçalho + menu fixo do Portal do Representante, compartilhados entre o portal (/portal-rep)
// e as páginas internas (ex.: metas de um cliente), para o menu aparecer em todo o portal.

import { useMemo } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarCheck, Inbox, LogOut, Sparkles, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BrandMark } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getRepPortal } from "@/lib/rep-portal.functions";
import { solicitacaoEmAberto } from "@/lib/rep-solicitacoes";
import { useRepSolicitacoes } from "./use-rep-solicitacoes";

export type PortalTab = "metas" | "acoes_sugeridas" | "calendario" | "solicitacoes";

export const PORTAL_TABS: readonly PortalTab[] = [
  "metas",
  "acoes_sugeridas",
  "calendario",
  "solicitacoes",
];

/** Dados do portal (mesma query do /portal-rep: cache compartilhado entre as páginas). */
export function useRepPortalData() {
  const portalFn = useServerFn(getRepPortal);
  const query = useQuery({
    queryKey: ["rep-portal"],
    queryFn: () => portalFn(),
    staleTime: 0,
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const actions = useMemo(() => query.data?.actions ?? [], [query.data]);
  // Sugestões pendentes de resposta e ações aceitas (agendadas no calendário).
  const pendingCount = useMemo(
    () => actions.filter((a) => a.acceptance !== "aceita" && a.acceptance !== "recusada").length,
    [actions],
  );
  const acceptedCount = useMemo(
    () => actions.filter((a) => a.acceptance === "aceita").length,
    [actions],
  );
  return { ...query, actions, pendingCount, acceptedCount };
}

export function RepPortalChrome({
  activeTab,
  onTabChange,
  repName,
  pendingCount,
  acceptedCount,
}: {
  activeTab: PortalTab;
  /** Sem handler: navega para a aba correspondente do portal. */
  onTabChange?: (tab: PortalTab) => void;
  repName?: string | null;
  pendingCount: number;
  acceptedCount: number;
}) {
  const navigate = useNavigate();
  const { data: solicitacoes } = useRepSolicitacoes();
  const solicitacoesAbertas = solicitacoes?.available
    ? solicitacoes.items.filter((s) => solicitacaoEmAberto(s.status)).length
    : 0;

  async function signOut() {
    await supabase.auth.signOut();
    void navigate({ to: "/auth" });
  }

  const go = (tab: PortalTab) => {
    if (onTabChange) onTabChange(tab);
    else void navigate({ to: "/portal-rep", search: tab === "metas" ? {} : { tab } });
  };

  const tabClass = (tab: PortalTab) =>
    cn(
      "relative flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all cursor-pointer select-none",
      activeTab === tab
        ? "bg-primary text-primary-foreground shadow-sm"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  return (
    <>
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-3">
            <BrandMark className="h-8 w-8" />
            <div>
              <h1 className="text-base font-semibold leading-tight">Portal do Representante</h1>
              {repName && (
                <p className="text-xs text-muted-foreground">
                  {repName} · Painel de Gestão & Carteira
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

      {/* Menu fixo do portal */}
      <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-sm shadow-xs">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2">
          <nav
            className="flex flex-wrap gap-1 sm:gap-2"
            aria-label="Menu Principal do Representante"
          >
            <button type="button" onClick={() => go("metas")} className={tabClass("metas")}>
              <Target className="h-4 w-4" />
              Metas
            </button>

            <button
              type="button"
              onClick={() => go("acoes_sugeridas")}
              className={tabClass("acoes_sugeridas")}
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
              onClick={() => go("calendario")}
              className={tabClass("calendario")}
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

            <button
              type="button"
              onClick={() => go("solicitacoes")}
              className={tabClass("solicitacoes")}
            >
              <Inbox className="h-4 w-4" />
              Solicitações
              {solicitacoesAbertas > 0 && (
                <span
                  className={cn(
                    "ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold leading-none",
                    activeTab === "solicitacoes"
                      ? "bg-primary-foreground text-primary"
                      : "bg-sky-100 text-sky-700 dark:bg-sky-900/60 dark:text-sky-300",
                  )}
                >
                  {solicitacoesAbertas}
                </span>
              )}
            </button>
          </nav>
        </div>
      </div>
    </>
  );
}
