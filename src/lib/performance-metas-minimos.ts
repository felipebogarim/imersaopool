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
