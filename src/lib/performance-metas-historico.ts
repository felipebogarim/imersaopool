// Histórico de metas de um cliente: períodos (semestres e mudanças dentro deles) com a meta
// mensal de cada portfólio vigente no período. Lógica pura, a partir dos ciclos e das versões
// gravadas (performance_goal_cycles / performance_goal_items).

export type HistItem = {
  familia: string;
  vigente_desde: string;
  meta_mensal: number | null;
  origem?: string | null;
};

export type HistCycle = {
  id: string;
  inicio: string;
  fim: string;
  items: HistItem[];
};

export type HistPeriodo = {
  cicloId: string;
  /** YYYY-MM-01 */
  inicio: string;
  /** YYYY-MM-01 (último mês do período) */
  fim: string;
  metas: Record<string, number | null>;
  total: number;
  situacao: "passado" | "vigente" | "futuro";
};

const idx = (iso: string) => {
  const [y, m] = iso.slice(0, 7).split("-").map(Number);
  return y * 12 + m - 1;
};
const iso = (k: number) => `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, "0")}-01`;

/** Períodos do mais recente para o mais antigo. Meses antes da 1ª meta gravada são omitidos. */
export function historicoPeriodos(cycles: HistCycle[], hoje: Date = new Date()): HistPeriodo[] {
  const atual = hoje.getFullYear() * 12 + hoje.getMonth();
  const out: HistPeriodo[] = [];
  for (const c of cycles) {
    const ini = idx(c.inicio);
    const fim = idx(c.fim);
    const versoes = c.items
      .map((i) => ({ ...i, k: Math.min(fim, Math.max(ini, idx(i.vigente_desde))) }))
      .sort((a, b) => a.k - b.k);
    const cortes = [...new Set([ini, ...versoes.map((v) => v.k)])].sort((a, b) => a - b);
    for (let n = 0; n < cortes.length; n++) {
      const a = cortes[n];
      const b = n + 1 < cortes.length ? cortes[n + 1] - 1 : fim;
      const metas: Record<string, number | null> = {};
      for (const v of versoes) if (v.k <= a) metas[v.familia] = v.meta_mensal;
      if (Object.keys(metas).length === 0) continue;
      const total = Object.values(metas).reduce<number>((s, x) => s + (x ?? 0), 0);
      out.push({
        cicloId: c.id,
        inicio: iso(a),
        fim: iso(b),
        metas,
        total,
        situacao: b < atual ? "passado" : a > atual ? "futuro" : "vigente",
      });
    }
  }
  return out.sort((x, y) => idx(y.inicio) - idx(x.inicio));
}
