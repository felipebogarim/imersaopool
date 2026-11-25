// Guia de uma visita: resumo de performance, pontos de conversa, lembretes da imersão e a tela
// de metas do cliente (mesma do portal), com compartilhamento da imagem no WhatsApp.

import { useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ExternalLink, Lightbulb, ListChecks, NotebookPen, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtBRL, METAS_FAMILIES } from "@/lib/performance-metas";
import type { CanonicalFamily } from "@/lib/client-bi-familias";
import { repGetMetasGoals } from "@/lib/performance-metas.functions";
import { repAgendaLembretes } from "@/lib/rep-agenda.functions";
import {
  chaveCliente,
  fmtData,
  pontosDaVisita,
  resumoPerformance,
  type VisitaAgenda,
} from "@/lib/rep-agenda";
import { solicitacaoEmAberto } from "@/lib/rep-solicitacoes";
import type { PortalAction } from "@/lib/rep-portal.server";
import { RepMetasPerformanceChart } from "@/components/performance-metas/RepMetasClientVisuals";
import { MetasShareWhatsapp } from "@/components/performance-metas/MetasShareWhatsapp";
import { useRepSolicitacoes } from "./use-rep-solicitacoes";

const pctTxt = (r: number | null) => (r == null ? "—" : `${Math.round(r * 100)}%`);
const corRatio = (r: number | null) =>
  r == null
    ? "text-muted-foreground"
    : r >= 1
      ? "text-emerald-600 dark:text-emerald-400"
      : r >= 0.7
        ? "text-amber-600 dark:text-amber-400"
        : "text-rose-600 dark:text-rose-400";

export function RepVisitaGuia({
  visita,
  rowId,
  actions,
}: {
  visita: VisitaAgenda;
  rowId: string;
  actions: PortalAction[];
}) {
  const metasFn = useServerFn(repGetMetasGoals);
  const lembretesFn = useServerFn(repAgendaLembretes);
  const metas = useQuery({
    queryKey: ["rep-metas", rowId],
    queryFn: () => metasFn({ data: { rowId } }),
  });
  const lembretes = useQuery({
    queryKey: ["rep-portal", "agenda", "lembretes", rowId],
    queryFn: () => lembretesFn({ data: { rowId } }),
    staleTime: 5 * 60_000,
  });
  const { data: sol } = useRepSolicitacoes();
  const [selected, setSelected] = useState<CanonicalFamily>(METAS_FAMILIES[0]);
  const resumoRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const view = metas.data?.available ? metas.data.view : null;
  const resumo = useMemo(() => (view ? resumoPerformance(view) : null), [view]);
  const key = chaveCliente(visita.cliente);
  const acoesAbertas = actions.filter(
    (a) => chaveCliente(a.client) === key && a.acceptance === "aceita" && a.status !== "concluido",
  );
  const solicitacoesAbertas = sol?.available
    ? sol.items.filter((s) => chaveCliente(s.cliente) === key && solicitacaoEmAberto(s.status))
    : [];
  const pontos = pontosDaVisita({
    resumo,
    acoesAbertas,
    solicitacoesAbertas,
    revisaoPendente: view?.review?.status === "pendente" || view?.review?.status === "reaberto",
  });
  const periodo = view?.performance_period?.label ?? null;

  return (
    <div className="space-y-4">
      {/* 1. Resumo de performance (entra na imagem compartilhada) */}
      <div ref={resumoRef} className="rounded-xl border bg-background p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Resumo de performance
            </p>
            <p className="text-base font-bold">{view?.cliente || visita.cliente}</p>
            <p className="text-xs text-muted-foreground">
              {[view?.categoria && `Categoria ${view.categoria}`, periodo && `Período ${periodo}`]
                .filter(Boolean)
                .join(" · ") || "—"}
            </p>
          </div>
          {resumo?.geral != null && (
            <div className="text-right">
              <p className={cn("text-2xl font-extrabold tabular-nums", corRatio(resumo.geral))}>
                {pctTxt(resumo.geral)}
              </p>
              <p className="text-[10px] text-muted-foreground">atingimento geral da meta</p>
            </div>
          )}
        </div>
        {metas.isLoading ? (
          <p className="mt-3 text-xs text-muted-foreground">Carregando performance…</p>
        ) : !view ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Metas deste cliente ainda não disponíveis.
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {resumo!.portfolios.map((p) => (
              <div key={p.familia} className="rounded-lg border bg-muted/20 px-2.5 py-2">
                <p className="truncate text-[10px] font-semibold text-muted-foreground">
                  {p.label}
                </p>
                <p className={cn("text-sm font-bold tabular-nums", corRatio(p.ratio))}>
                  {pctTxt(p.ratio)}
                </p>
                <p className="text-[10px] tabular-nums text-muted-foreground">
                  {p.meta != null && p.meta > 0 ? `meta ${fmtBRL(p.meta)}/mês` : "sem meta"}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* 2. Pontos para a visita */}
        <div className="rounded-xl border bg-background p-4 shadow-sm">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <ListChecks className="h-4 w-4 text-primary" /> Pontos para a visita
          </p>
          {visita.objetivo && (
            <p className="mt-2 rounded-md bg-primary/5 px-2.5 py-1.5 text-xs">
              <strong>Seu objetivo:</strong> {visita.objetivo}
            </p>
          )}
          {pontos.length === 0 ? (
            <p className="mt-2 text-xs text-muted-foreground">Sem pontos automáticos.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-xs">
              {pontos.map((p, i) => (
                <li key={i} className="flex gap-2">
                  <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* 3. Lembretes da imersão */}
        <div className="rounded-xl border bg-background p-4 shadow-sm">
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <NotebookPen className="h-4 w-4 text-primary" /> Lembretes da imersão
          </p>
          {lembretes.isLoading ? (
            <p className="mt-2 text-xs text-muted-foreground">Buscando dados da imersão…</p>
          ) : lembretes.error ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Não foi possível carregar os lembretes.
            </p>
          ) : !lembretes.data?.imersao ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Este cliente ainda não passou por imersão.
            </p>
          ) : (
            <>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {lembretes.data.imersao.titulo}
                {lembretes.data.imersao.data && ` · ${fmtData(lembretes.data.imersao.data)}`}
              </p>
              {lembretes.data.itens.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  Sem anotações registradas na imersão.
                </p>
              ) : (
                <ul className="mt-2 space-y-2 text-xs">
                  {lembretes.data.itens.map((l, i) => (
                    <li key={i} className="flex gap-2">
                      <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                      <span>
                        <strong className="font-semibold">{l.rotulo}:</strong> {l.texto}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

      {/* 4. Tela de metas (mesma do portal) + compartilhar no WhatsApp */}
      {view && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">Tela de metas</p>
            <div className="flex flex-wrap items-center gap-2">
              <MetasShareWhatsapp
                clienteNome={view.cliente || visita.cliente}
                periodoReferencia={periodo ?? ""}
                categoria={view.categoria}
                blocks={[resumoRef, chartRef]}
              />
              <Link
                to="/portal-rep/metas/$rowId"
                params={{ rowId }}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                Abrir tela completa <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
          <div ref={chartRef}>
            <RepMetasPerformanceChart view={view} selected={selected} onSelect={setSelected} />
          </div>
        </div>
      )}
    </div>
  );
}
