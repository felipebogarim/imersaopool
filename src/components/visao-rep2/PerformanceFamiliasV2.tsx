// Performance por família de produtos — barras horizontais no padrão da Visão Rep.
// Apenas percentuais e faróis: nenhum valor monetário é exibido.

import { useMemo, useState } from "react";
import { fmtPct, type PerfResumo } from "@/lib/visao-rep";
import { cn } from "@/lib/utils";
import { BlocoExpansivel } from "./BlocoExpansivel";

type Modo = "participacao" | "atingimento";

/** Paleta de séries: uma cor por família (tokens em src/styles.css). */
const FAM_COLORS = [
  "var(--fam-1)",
  "var(--fam-2)",
  "var(--fam-3)",
  "var(--fam-4)",
  "var(--fam-5)",
  "var(--fam-6)",
  "var(--fam-7)",
  "var(--fam-8)",
];

export function PerformanceFamiliasV2({ perf, contexto }: { perf: PerfResumo | null; contexto?: string }) {
  const [modo, setModo] = useState<Modo>("participacao");

  /**
   * Participação estimada (denominador único): índice ponderado da família ÷
   * soma dos índices de todas as famílias. Sempre fecha 100%.
   */
  const itens = useMemo(() => {
    const familias = perf?.familias ?? [];
    const soma = familias.reduce((a, f) => a + Math.max(0, f.pct ?? 0), 0);
    return familias.map((f, i) => ({
      familia: f.familia,
      cor: FAM_COLORS[i % FAM_COLORS.length],
      atingimento: f.pct ?? 0,
      participacao: soma > 0 ? (Math.max(0, f.pct ?? 0) / soma) * 100 : null,
    }));
  }, [perf]);

  if (!perf || !itens.length) return null;

  const valorDe = (i: (typeof itens)[number]) => (modo === "participacao" ? i.participacao : i.atingimento);
  const max =
    modo === "participacao"
      ? Math.max(1, ...itens.map(i => i.participacao ?? 0))
      : Math.max(120, ...itens.map(i => i.atingimento));

  return (
    <BlocoExpansivel
      defaultOpen={false}
      titulo="Performance por família de produtos"
      descricao="Leitura relativa da carteira do representante no período ativo."
      contexto={contexto}
      acessorio={
        <span className="hidden flex-wrap gap-1.5 text-xs text-muted-foreground sm:flex">
          <span className="rounded-md border px-2 py-0.5">{perf.periodoLabel}</span>
          <span className="rounded-md border px-2 py-0.5">Geral {fmtPct(perf.geralPct)}</span>
        </span>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Visualizar</span>
        <div className="inline-flex rounded-full border bg-muted/40 p-0.5" role="group" aria-label="Modo de visualização">
          {(
            [
              { id: "participacao", label: "Participação estimada" },
              { id: "atingimento", label: "Atingimento da meta" },
            ] as const
          ).map(op => (
            <button
              key={op.id}
              type="button"
              onClick={() => setModo(op.id)}
              aria-pressed={modo === op.id}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                modo === op.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {op.label}
            </button>
          ))}
        </div>
      </div>

      <ul className="space-y-2.5">
        {itens.map(i => {
          const v = valorDe(i);
          const pct = Math.max(0, Math.min(max, v ?? 0));
          return (
            <li key={i.familia} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3">
              <span className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">{i.familia}</span>
              <span className="h-2 min-w-0 rounded-full bg-muted">
                <span
                  className="block h-2 rounded-full transition-[width] duration-300"
                  style={{ width: `${(pct / max) * 100}%`, backgroundColor: i.cor }}
                  aria-hidden
                />
              </span>
              <span className="shrink-0 text-xs font-semibold tabular-nums">{fmtPct(v)}</span>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 text-[11px] text-muted-foreground">
        {modo === "participacao"
          ? "Participação estimada de cada família na carteira (soma 100%)."
          : "Atingimento da meta por família no período."}
      </p>

      {perf.criticas.length ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Famílias mais pressionadas: {perf.criticas.map(f => f.familia).join(", ")}.
        </p>
      ) : null}
    </BlocoExpansivel>
  );
}
