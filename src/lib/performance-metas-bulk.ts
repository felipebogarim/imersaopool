// Convite em massa ao representante (área Metas): avalia, por cliente, se o gestor já gravou a
// meta dos 7 portfólios e monta o que falta a partir da sugestão IA. Lógica pura (sem I/O).

import { CANONICAL_FAMILIES, type CanonicalFamily } from "@/lib/client-bi-familias";
import type { GoalsState } from "@/lib/performance-metas-persistence";

export type BulkRowStatus = {
  rowId: string;
  /** Ciclo de metas já criado (o representante só vê clientes com metas gravadas). */
  temCiclo: boolean;
  /** Portfólios com meta gravada no ciclo vigente. */
  salvas: CanonicalFamily[];
  /** Portfólios ainda sem meta gravada pelo gestor. */
  faltando: CanonicalFamily[];
  /** Dos que faltam, quais já têm sugestão IA registrada. */
  faltandoComIa: CanonicalFamily[];
  /** Falha ao consultar (permissão, vínculo etc.). */
  erro?: string;
};

export type BulkCategoria = "completo" | "parcial" | "pendente" | "erro";

export function bulkRowStatus(rowId: string, state: GoalsState | null): BulkRowStatus {
  if (!state) {
    return {
      rowId,
      temCiclo: false,
      salvas: [],
      faltando: [...CANONICAL_FAMILIES],
      faltandoComIa: [],
    };
  }
  const gravadas = new Set(
    state.items.filter((i) => i.meta_mensal != null).map((i) => i.familia as string),
  );
  const comIa = new Set(
    state.ai_suggestions.filter((s) => s.origem === "modelo").map((s) => s.familia),
  );
  const salvas = CANONICAL_FAMILIES.filter((f) => gravadas.has(f));
  const faltando = CANONICAL_FAMILIES.filter((f) => !gravadas.has(f));
  return {
    rowId,
    temCiclo: state.cycle != null,
    salvas,
    faltando,
    faltandoComIa: faltando.filter((f) => comIa.has(f)),
  };
}

export function bulkCategoria(s: BulkRowStatus): BulkCategoria {
  if (s.erro) return "erro";
  if (s.temCiclo && s.faltando.length === 0) return "completo";
  if (s.salvas.length > 0) return "parcial";
  return "pendente";
}

export type BulkResumo = Record<BulkCategoria, string[]>;

export function bulkResumo(statuses: readonly BulkRowStatus[]): BulkResumo {
  const r: BulkResumo = { completo: [], parcial: [], pendente: [], erro: [] };
  for (const s of statuses) r[bulkCategoria(s)].push(s.rowId);
  return r;
}

/** Metas a gravar com a sugestão IA nos portfólios que faltam (origem "ia"). */
export function aiFillForMissing(state: GoalsState): Array<{
  familia: CanonicalFamily;
  meta_mensal: number;
  origem: "ia";
  comentario_gestor: string;
  referencia: null;
}> {
  const { faltando } = bulkRowStatus("", state);
  const ia = new Map(
    state.ai_suggestions.filter((s) => s.origem === "modelo").map((s) => [s.familia, s]),
  );
  return faltando.flatMap((familia) => {
    const s = ia.get(familia);
    const valor = s == null ? NaN : Number(s.valor);
    if (!Number.isFinite(valor) || valor < 0) return [];
    return [
      {
        familia,
        meta_mensal: valor,
        origem: "ia" as const,
        comentario_gestor: "Sugestão IA aceita no convite em massa ao representante.",
        referencia: null,
      },
    ];
  });
}
