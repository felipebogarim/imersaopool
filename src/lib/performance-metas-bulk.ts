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

// ------------------------- Metas mínimas aplicadas em massa -------------------------
// Preenche a META DO GESTOR com o mínimo da tabela "Metas Mínimas" (categoria × portfólio) nos
// portfólios ainda SEM meta gravada. Grava como origem "ia" + esta marca no comentário: conta em
// todos os cálculos, mas a carteira mostra "IA" azul (não o check verde de revisado). Quando o
// gestor salva o painel do cliente, a marca é removida e a meta passa a contar como revisada.

export const MARCA_MINIMO_MASSA =
  "Meta mínima da categoria aplicada em massa (aguardando revisão).";

type ItemMeta = {
  familia: string;
  meta_mensal: number | null;
  origem?: string | null;
  comentario_gestor?: string | null;
  vigente_desde?: string | null;
};

export const ehMetaMinimaMassa = (i: Pick<ItemMeta, "origem" | "comentario_gestor">) =>
  i.origem === "ia" && (i.comentario_gestor ?? "").trim() === MARCA_MINIMO_MASSA;

/** Comentário a gravar quando o gestor salva o painel: a marca de massa sai (vira revisada). */
export const comentarioRevisado = (c: string) => (c.trim() === MARCA_MINIMO_MASSA ? "" : c);

/** Situação de revisão por portfólio (última versão de cada um). */
export function statusRevisao(items: readonly ItemMeta[]): {
  revisadas: number;
  emMassa: number;
} {
  const ultima = new Map<string, ItemMeta>();
  for (const i of items) {
    const atual = ultima.get(i.familia);
    if (!atual || (i.vigente_desde ?? "") >= (atual.vigente_desde ?? "")) ultima.set(i.familia, i);
  }
  let revisadas = 0;
  let emMassa = 0;
  for (const i of ultima.values()) {
    if (i.meta_mensal == null) continue;
    if (ehMetaMinimaMassa(i)) emMassa += 1;
    else revisadas += 1;
  }
  return { revisadas, emMassa };
}

const categoriaDe = (c: string | null | undefined) => {
  const n = (c ?? "").trim().toLowerCase();
  return n === "silver" || n === "gold" || n === "black" ? n : null;
};

/** Metas a gravar: mínimo da categoria nos portfólios SEM meta (nunca sobrescreve). */
export function minimosParaFaltantes(
  state: Pick<GoalsState, "items" | "agendadas"> | null,
  categoria: string | null | undefined,
  minimos: ReadonlyArray<{ categoria: string; familia: string; minimo: number }>,
): Array<{
  familia: CanonicalFamily;
  meta_mensal: number;
  origem: "ia";
  comentario_gestor: string;
  referencia: null;
}> {
  const cat = categoriaDe(categoria);
  if (!cat) return [];
  const definidas = new Set(
    [...(state?.items ?? []), ...(state?.agendadas ?? [])]
      .filter((i) => i.meta_mensal != null)
      .map((i) => i.familia),
  );
  return CANONICAL_FAMILIES.flatMap((familia) => {
    if (definidas.has(familia)) return [];
    const m = minimos.find((x) => x.categoria.toLowerCase() === cat && x.familia === familia);
    if (!m || !Number.isFinite(m.minimo) || m.minimo <= 0) return [];
    return [
      {
        familia,
        meta_mensal: m.minimo,
        origem: "ia" as const,
        comentario_gestor: MARCA_MINIMO_MASSA,
        referencia: null,
      },
    ];
  });
}
