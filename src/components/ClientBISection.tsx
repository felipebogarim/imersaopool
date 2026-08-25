import { useMemo } from "react";
import { BarChart3, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { FAROL_CELL_CLASS, FAROL_LABEL, catBadge } from "@/lib/performance-farol";
import { useClientBI } from "@/lib/use-performance-bi";
import { validateClientBIResult } from "@/lib/performance-bi-engine";
import { METRIC_DEFS } from "@/lib/performance-metrics";

const fmtRatio = (r: number | null | undefined) =>
  r == null || Number.isNaN(r) ? "—" : `${(r * 100).toFixed(1).replace(".", ",")}%`;

export function ClientBISection({
  repId,
  razaoSocial,
  versionId = null,
}: {
  repId: string;
  razaoSocial: string;
  companyId: string | null;
  versionId?: string | null;
}) {
  const { data: bi = null, isLoading } = useClientBI(repId, razaoSocial, versionId);

  const famsSorted = useMemo(
    () =>
      (bi?.familias ?? [])
        .slice()
        .sort((a, b) => (b.atingimento_ratio ?? -1) - (a.atingimento_ratio ?? -1)),
    [bi],
  );

  const problemas = useMemo(() => (bi ? validateClientBIResult(bi) : []), [bi]);

  return (
    <div className="surface rounded-xl overflow-hidden">
      <div className="w-full px-4 py-3 border-b border-border flex items-center gap-2 flex-wrap">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          BI do cliente
        </p>
        {bi?.atingimento_geral_ratio != null && (
          <span className="ml-2 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            Atingimento real:{" "}
            <strong className="tabular-nums">{fmtRatio(bi.atingimento_geral_ratio)}</strong>
          </span>
        )}
        {bi?.periodo_label && (
          <span className="text-[11px] text-muted-foreground">
            Período: {bi.periodo_label} · calculado da Performance ativa
          </span>
        )}
      </div>

      <div className="p-4 space-y-6">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : !bi ? (
          <div className="text-sm text-muted-foreground">
            Este cliente não existe na versão de Performance ativa deste representante. Importe uma
            planilha de Performance para gerar o BI.
          </div>
        ) : (
          <>
            {problemas.length > 0 && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">
                <div className="flex items-center gap-1 font-medium mb-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> Validação do cálculo
                </div>
                <ul className="list-disc pl-4 space-y-0.5">
                  {problemas.slice(0, 6).map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Destaques */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div
                className="rounded-xl border border-border p-4 bg-primary/5"
                title={METRIC_DEFS.real_achievement.tooltip}
              >
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Atingimento real
                </div>
                <div className="mt-1 text-3xl font-semibold tabular-nums">
                  {fmtRatio(bi.atingimento_geral_ratio)}
                </div>
                <div
                  className="mt-1 text-[11px] text-muted-foreground"
                  title={METRIC_DEFS.weighted_farol_index.tooltip}
                >
                  Índice ponderado do farol: {fmtRatio(bi.indice_geral)}
                </div>
                <div
                  className="text-[11px] text-muted-foreground"
                  title={METRIC_DEFS.portfolio_balance_index.tooltip}
                >
                  Índice de equilíbrio do portfólio: {fmtRatio(bi.metrics?.portfolio_balance_index)}
                </div>
              </div>
              <div className="rounded-xl border border-border p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Categoria do cliente
                </div>
                <div className="mt-2">
                  <span
                    className={cn(
                      "inline-flex px-2 py-0.5 rounded-full text-xs border",
                      catBadge(bi.categoria ?? ""),
                    )}
                  >
                    {bi.categoria ?? "—"}
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-border p-4" title="Família com maior atingimento real.">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Melhor família {(bi.melhor_familia.labels?.length ?? 0) > 1 ? "(empate)" : ""}
                </div>
                <div className="mt-1 text-sm truncate" title={(bi.melhor_familia.labels ?? []).join(" · ")}>
                  {(bi.melhor_familia.labels ?? []).join(" · ") || bi.melhor_familia.label || "—"}
                </div>
                <div className="text-lg font-semibold tabular-nums">
                  {fmtRatio(bi.melhor_familia.atingimento_ratio)}
                </div>
              </div>
              <div className="rounded-xl border border-border p-4" title="Família com menor atingimento real.">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Pior família {(bi.pior_familia.labels?.length ?? 0) > 1 ? "(empate)" : ""}
                </div>
                <div className="mt-1 text-sm truncate" title={(bi.pior_familia.labels ?? []).join(" · ")}>
                  {(bi.pior_familia.labels ?? []).join(" · ") || bi.pior_familia.label || "—"}
                </div>
                <div className="text-lg font-semibold tabular-nums">
                  {fmtRatio(bi.pior_familia.atingimento_ratio)}
                </div>
              </div>

            </div>

            {/* Famílias */}
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Participação das famílias no resultado do cliente
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {famsSorted.map((f) => (
                  <div key={f.familia} className="rounded-xl border border-border p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-xs border bg-muted text-muted-foreground border-border truncate">
                        {f.familia}
                      </span>
                      {f.farol && (
                        <span
                          className={cn(
                            "inline-flex px-2 py-0.5 rounded text-[10px] border",
                            FAROL_CELL_CLASS[f.farol],
                          )}
                        >
                          {FAROL_LABEL[f.farol]}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 text-2xl font-semibold tabular-nums">
                      {fmtRatio(f.atingimento_ratio)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">Atingimento real</div>
                    <div className="mt-1 text-[11px] text-muted-foreground flex items-center justify-between gap-2">
                      <span>Coeficiente do farol: {fmtRatio(f.coeficiente_farol)}</span>
                      <span>Participação: {fmtRatio(f.participacao)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Distribuição do farol */}
            {bi.distribuicao_farol.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Distribuição dos grupos do farol
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {bi.distribuicao_farol.map((f) => (
                    <div
                      key={f.grupo}
                      className={cn(
                        "rounded-xl p-3 border border-border/60 flex flex-col gap-1",
                        FAROL_CELL_CLASS[f.status],
                      )}
                    >
                      <div className="text-[11px] uppercase tracking-wider opacity-80">
                        {f.grupo}
                      </div>
                      <div className="text-xl font-semibold tabular-nums">{f.quantidade}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
