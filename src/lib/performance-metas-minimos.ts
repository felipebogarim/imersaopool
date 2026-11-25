// Mínimos de meta por categoria e portfólio (configurados pela gestão). Meta do gestor abaixo do
// mínimo da categoria do cliente gera alerta e bloqueia o salvamento (também checado no banco).

export const MINIMO_CATEGORIAS = ["Silver", "Gold", "Black"] as const;
export type MinimoCategoria = (typeof MINIMO_CATEGORIAS)[number];

export type MinimoItem = { categoria: string; familia: string; minimo: number };

/** Mínimo vigente para a categoria (sem diferenciar maiúsculas) e portfólio; null = sem mínimo. */
export function minimoPara(
  minimos: readonly MinimoItem[] | null | undefined,
  categoria: string | null | undefined,
  familia: string,
): number | null {
  if (!minimos || !categoria) return null;
  const cat = categoria.trim().toLowerCase();
  const m = minimos.find((x) => x.categoria.trim().toLowerCase() === cat && x.familia === familia);
  return m ? Number(m.minimo) : null;
}

/** Portfólios cuja meta definida está abaixo do mínimo (meta vazia não conta). */
export function abaixoDoMinimo<T extends { familia: string; metaOficial: number | null }>(
  drafts: readonly T[],
  minimos: readonly MinimoItem[] | null | undefined,
  categoria: string | null | undefined,
): Array<{ familia: string; meta: number; minimo: number }> {
  const out: Array<{ familia: string; meta: number; minimo: number }> = [];
  for (const d of drafts) {
    const min = minimoPara(minimos, categoria, d.familia);
    if (min != null && d.metaOficial != null && d.metaOficial < min) {
      out.push({ familia: d.familia, meta: d.metaOficial, minimo: min });
    }
  }
  return out;
}

// ------------------------- Pisos da categoria (régua) -------------------------
// O piso de cada categoria (média mensal total de compras) fica na MESMA configuração
// "Mínimos por categoria", numa linha especial ao lado dos portfólios. Nada fixo no código.

export const PISO_CATEGORIA_FAMILIA = "__PISO_MENSAL__";

export type PisosCategoria = Record<MinimoCategoria, number>;

/** Pisos configurados; `pisos` só existe quando as 3 categorias estão preenchidas e crescentes. */
export function pisosCategoria(minimos: readonly MinimoItem[] | null | undefined): {
  pisos: PisosCategoria | null;
  faltando: MinimoCategoria[];
  erro: string | null;
} {
  const valores = MINIMO_CATEGORIAS.map((c) => minimoPara(minimos, c, PISO_CATEGORIA_FAMILIA));
  const faltando = MINIMO_CATEGORIAS.filter((_, i) => valores[i] == null || valores[i]! <= 0);
  if (faltando.length) return { pisos: null, faltando, erro: null };
  const [s, g, b] = valores as number[];
  if (!(s < g && g < b))
    return {
      pisos: null,
      faltando: [],
      erro: "Os pisos devem crescer de Silver para Gold e Black.",
    };
  return { pisos: { Silver: s, Gold: g, Black: b }, faltando: [], erro: null };
}
