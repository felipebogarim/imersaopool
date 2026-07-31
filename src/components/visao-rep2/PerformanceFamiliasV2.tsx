// Performance por família de produtos — barras horizontais no padrão da Visão Rep.
// Apenas percentuais e faróis: nenhum valor monetário é exibido.

import { fmtPct, type PerfResumo } from "@/lib/visao-rep";

export function PerformanceFamiliasV2({ perf }: { perf: PerfResumo | null }) {
  if (!perf || !perf.familias.length) return null;
  const max = Math.max(100, ...perf.familias.map(f => f.pct ?? 0));

  return (
    <section className="rounded-xl border bg-card p-5 sm:p-6" aria-labelledby="vr2-familias">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3
            id="vr2-familias"
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
          >
            Performance por família de produtos
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Leitura relativa da carteira do representante no período ativo.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5 text-xs text-muted-foreground">
          <span className="rounded-md border px-2 py-0.5">{perf.periodoLabel}</span>
          <span className="rounded-md border px-2 py-0.5">Geral {fmtPct(perf.geralPct)}</span>
        </div>
      </div>

      <ul className="mt-5 space-y-2.5">
        {perf.familias.map(f => {
          const pct = Math.max(0, Math.min(max, f.pct ?? 0));
          return (
            <li key={f.familia} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3">
              <span className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{f.familia}</span>
              <span className="h-2 min-w-0 rounded-full bg-muted">
                <span
                  className="block h-2 rounded-full bg-primary"
                  style={{ width: `${(pct / max) * 100}%` }}
                  aria-hidden
                />
              </span>
              <span className="shrink-0 text-xs font-semibold tabular-nums">{fmtPct(f.pct)}</span>
            </li>
          );
        })}
      </ul>

      {perf.criticas.length ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Famílias mais pressionadas: {perf.criticas.map(f => f.familia).join(", ")}.
        </p>
      ) : null}
    </section>
  );
}
