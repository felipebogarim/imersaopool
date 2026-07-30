// Visão Rep — raio-x estratégico de um representante.
// Toda a lógica de casamento (representante ↔ fonte de insight), montagem do
// quadro das 8 lentes, paralelo com a Síntese por tipo e leitura da performance
// vive aqui. Os componentes apenas renderizam.

import { LENTES, LENTE_DEF, toValues, type Lente, type SinteseCampos } from "@/lib/insight-lentes";
import type { SinteseResultado } from "@/lib/sintese-engine";
import { FAROL_LABEL, FAROL_ORDER, type FarolStatus } from "@/lib/performance-farol";

// ============ Matching representante ↔ fonte ============

export function normNome(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type FonteLite = {
  id: string;
  tipo: string;
  titulo: string;
  pessoa: string | null;
  regiao: string | null;
  perfil_carteira: string | null;
  interview_id: string | null;
  updated_at: string;
};

/** Casa a fonte pelo nome da pessoa (ou título) com o nome do representante. */
export function findFonteDoRep(fontes: FonteLite[], nomeRep: string): FonteLite | null {
  const alvo = normNome(nomeRep);
  if (!alvo) return null;
  const exata = fontes.find(f => normNome(f.pessoa) === alvo || normNome(f.titulo) === alvo);
  if (exata) return exata;
  return (
    fontes.find(f => {
      const p = normNome(f.pessoa) || normNome(f.titulo);
      return !!p && (p.includes(alvo) || alvo.includes(p));
    }) ?? null
  );
}

// ============ Quadro das 8 lentes ============

export type LenteRow = {
  lente: string;
  leitura_estrategica: string | null;
  sintese_campos: SinteseCampos | null;
  highlights: unknown;
};

export type QuadroCampo = { label: string; valores: string[] };
export type QuadroLente = {
  lente: Lente;
  label: string;
  descricao: string;
  leitura: string | null;
  campos: QuadroCampo[];
  highlights: string[];
  vazia: boolean;
};

export function buildQuadroRep(rows: LenteRow[]): QuadroLente[] {
  const byLente = new Map(rows.map(r => [r.lente, r]));
  return LENTES.map(l => {
    const def = LENTE_DEF[l];
    const row = byLente.get(l);
    const campos: QuadroCampo[] = [];
    for (const c of def.campos) {
      const valores = toValues((row?.sintese_campos ?? {})[c.key] as any);
      if (valores.length) campos.push({ label: c.label, valores });
    }
    const highlights = Array.isArray(row?.highlights)
      ? (row!.highlights as unknown[]).map(h => (typeof h === "string" ? h : String((h as any)?.texto ?? ""))).filter(Boolean)
      : [];
    return {
      lente: l,
      label: def.label,
      descricao: def.descricao,
      leitura: row?.leitura_estrategica?.trim() || null,
      campos,
      highlights,
      vazia: !campos.length && !row?.leitura_estrategica,
    };
  });
}

// ============ Paralelo com a Síntese por tipo ============

export type ParaleloItem = { texto: string; campo: string; peso: number; total: number };
export type ParaleloDivergencia = {
  tema: string;
  posicaoRep: string | null;
  outras: { posicao: string; fonte: string; regiao: string | null }[];
};
export type ParaleloLente = {
  lente: Lente;
  label: string;
  alinhado: ParaleloItem[];
  foraDaCurva: ParaleloItem[];
  divergencias: ParaleloDivergencia[];
  unicos: { texto: string; campo: string }[];
};
export type ParaleloRep = {
  lentes: ParaleloLente[];
  totalFontes: number;
  alinhamentos: number;
  lacunas: number;
  divergencias: number;
  unicos: number;
  indiceAlinhamento: number | null;
  leitura: string;
};

export function buildParaleloRep(
  resultado: SinteseResultado | null | undefined,
  fonteId: string | null,
  nomeRep: string,
): ParaleloRep | null {
  if (!resultado || !fonteId) return null;
  const lentes: ParaleloLente[] = [];
  let alinhamentos = 0;
  let lacunas = 0;
  let divergencias = 0;
  let unicos = 0;

  for (const l of LENTES) {
    const r = resultado.lentes?.[l];
    if (!r) continue;
    const alinhado: ParaleloItem[] = [];
    const foraDaCurva: ParaleloItem[] = [];
    for (const c of r.convergencia ?? []) {
      const item = { texto: c.texto, campo: c.campo, peso: c.peso, total: c.total };
      if ((c.fontes ?? []).some(f => f.id === fonteId)) alinhado.push(item);
      else if (c.peso >= 2) foraDaCurva.push(item);
    }
    const divs: ParaleloDivergencia[] = [];
    for (const d of r.divergencia ?? []) {
      const minha = (d.posicoes ?? []).find(p => p.fonteId === fonteId);
      if (!minha) continue;
      divs.push({
        tema: d.tema,
        posicaoRep: minha.posicao,
        outras: (d.posicoes ?? [])
          .filter(p => p.fonteId !== fonteId)
          .map(p => ({ posicao: p.posicao, fonte: p.fonte, regiao: p.regiao })),
      });
    }
    const uni = (r.especifico ?? [])
      .filter(e => e.fonteId === fonteId)
      .map(e => ({ texto: e.texto, campo: e.campo }));

    alinhamentos += alinhado.length;
    lacunas += foraDaCurva.length;
    divergencias += divs.length;
    unicos += uni.length;

    lentes.push({ lente: l, label: LENTE_DEF[l].label, alinhado, foraDaCurva, divergencias: divs, unicos: uni });
  }

  const denom = alinhamentos + lacunas;
  const indice = denom > 0 ? (alinhamentos / denom) * 100 : null;

  const partes: string[] = [];
  if (indice != null) {
    const perfil = indice >= 66 ? "fortemente alinhada" : indice >= 33 ? "parcialmente alinhada" : "descolada";
    partes.push(
      `A leitura de ${nomeRep} está ${perfil} ao consenso das demais entrevistas (${indice.toFixed(0)}% dos pontos convergentes são sustentados por ele).`,
    );
  }
  if (lacunas) partes.push(`${lacunas} ponto(s) de consenso do grupo não aparecem na fala dele — possíveis pontos cegos.`);
  if (divergencias) partes.push(`${divergencias} tema(s) em que ele se posiciona de forma oposta a outro representante.`);
  if (unicos) partes.push(`${unicos} leitura(s) exclusiva(s) da região dele, sem paralelo no grupo.`);

  return {
    lentes,
    totalFontes: resultado.meta?.total_fontes ?? 0,
    alinhamentos,
    lacunas,
    divergencias,
    unicos,
    indiceAlinhamento: indice,
    leitura: partes.join(" "),
  };
}

// ============ Performance do representante ============

export type UploadLite = {
  id: string;
  representative_id: string;
  periodo_label: string;
  atingimento_geral: number | null;
  familias: string[] | null;
  familia_atingimento_categoria: unknown;
};
export type PerfRowLite = {
  categoria: string | null;
  metas_status: unknown;
  total_pct: number | null;
  total_pct_status: string | null;
};

export type PerfFamilia = { familia: string; pct: number };
export type PerfResumo = {
  periodoLabel: string;
  geralPct: number | null;
  mediaGrupoPct: number | null;
  diffPp: number | null;
  posicao: number | null;
  totalReps: number;
  clientes: number;
  familias: PerfFamilia[];
  destaques: PerfFamilia[];
  criticas: PerfFamilia[];
  farol: { status: FarolStatus; label: string; pct: number }[];
  /** true quando os percentuais vieram do farol (planilha sem atingimento consolidado). */
  estimado: boolean;
};

const toPct = (n: number | null | undefined): number | null =>
  n == null || Number.isNaN(n) ? null : n <= 1.5 ? n * 100 : n;

/** Índice representativo de cada faixa do farol (usado quando não há % consolidado). */
export const FAROL_SCORE: Record<FarolStatus, number> = {
  sem_compra: 0,
  abaixo_meta: 25,
  pode_melhorar: 60,
  proximo: 80,
  otimo: 95,
  excelente: 105,
};

/** Média simples das categorias disponíveis para cada família. */
export function familiaMedias(fac: unknown, familias: string[] | null): PerfFamilia[] {
  const obj = (fac && typeof fac === "object" ? fac : {}) as Record<string, Record<string, number>>;
  const acc = new Map<string, number[]>();
  for (const cat of Object.values(obj)) {
    if (!cat || typeof cat !== "object") continue;
    for (const [fam, v] of Object.entries(cat)) {
      const p = toPct(typeof v === "number" ? v : Number(v));
      if (p == null) continue;
      acc.set(fam, [...(acc.get(fam) ?? []), p]);
    }
  }
  const ordem = familias ?? [...acc.keys()];
  return ordem
    .filter(f => acc.has(f))
    .map(f => {
      const vals = acc.get(f)!;
      return { familia: f, pct: vals.reduce((a, b) => a + b, 0) / vals.length };
    });
}

/** Fallback: média do índice de farol por família, a partir das células da matriz. */
export function familiaMediasPorFarol(rows: PerfRowLite[], familias: string[] | null): PerfFamilia[] {
  const acc = new Map<string, number[]>();
  for (const r of rows) {
    const st = (r.metas_status && typeof r.metas_status === "object" ? r.metas_status : {}) as Record<string, string>;
    for (const [fam, v] of Object.entries(st)) {
      if (!FAROL_ORDER.includes(v as FarolStatus)) continue;
      acc.set(fam, [...(acc.get(fam) ?? []), FAROL_SCORE[v as FarolStatus]]);
    }
  }
  const ordem = (familias ?? []).filter(f => acc.has(f));
  const extras = [...acc.keys()].filter(f => !ordem.includes(f));
  return [...ordem, ...extras].map(f => {
    const vals = acc.get(f)!;
    return { familia: f, pct: vals.reduce((a, b) => a + b, 0) / vals.length };
  });
}

export function buildPerfResumo(params: {
  upload: UploadLite | null;
  rows: PerfRowLite[];
  todosUploads: UploadLite[];
}): PerfResumo | null {
  const { upload, rows, todosUploads } = params;
  if (!upload) return null;

  const count = new Map<FarolStatus, number>();
  let total = 0;
  for (const r of rows) {
    const st = (r.metas_status && typeof r.metas_status === "object" ? r.metas_status : {}) as Record<string, string>;
    for (const v of Object.values(st)) {
      if (!FAROL_ORDER.includes(v as FarolStatus)) continue;
      count.set(v as FarolStatus, (count.get(v as FarolStatus) ?? 0) + 1);
      total += 1;
    }
  }

  const familiasFac = familiaMedias(upload.familia_atingimento_categoria, upload.familias);
  const estimado = familiasFac.length === 0 && total > 0;
  const familias = estimado ? familiaMediasPorFarol(rows, upload.familias) : familiasFac;

  const geralInformado = toPct(upload.atingimento_geral);
  const mediaFamilias = familias.length
    ? familias.reduce((a, f) => a + f.pct, 0) / familias.length
    : null;
  const geralPct = estimado || geralInformado == null ? mediaFamilias : geralInformado;

  const pares = todosUploads
    .filter(u => u.periodo_label === upload.periodo_label)
    .map(u => ({ id: u.representative_id, pct: toPct(u.atingimento_geral) }))
    .filter((u): u is { id: string; pct: number } => u.pct != null && u.pct > 0);
  const mediaGrupoPct = pares.length ? pares.reduce((a, b) => a + b.pct, 0) / pares.length : null;
  const posicao =
    !estimado && geralPct != null && pares.length > 1
      ? pares.filter(p => p.pct > geralPct + 1e-9).length + 1
      : null;

  const ordenadas = familias.slice().sort((a, b) => b.pct - a.pct);

  return {
    periodoLabel: upload.periodo_label,
    geralPct,
    mediaGrupoPct,
    diffPp: geralPct != null && mediaGrupoPct != null ? geralPct - mediaGrupoPct : null,
    posicao,
    totalReps: pares.length,
    clientes: rows.length,
    familias,
    destaques: ordenadas.slice(0, 3),
    criticas: ordenadas.slice(-3).reverse(),
    farol: FAROL_ORDER.map(s => ({
      status: s,
      label: FAROL_LABEL[s],
      pct: total ? ((count.get(s) ?? 0) / total) * 100 : 0,
    })),
    estimado,
  };
}

export function fmtPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${(Math.round(n * 10) / 10).toFixed(1).replace(".", ",")}%`;
}

export function fmtPp(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const v = (Math.round(Math.abs(n) * 10) / 10).toFixed(1).replace(".", ",");
  if (Math.abs(n) < 0.05) return "0,0 p.p.";
  return `${n > 0 ? "+" : "−"}${v} p.p.`;
}

/** Leitura executiva cruzando discurso (síntese) e resultado (performance). */
export function leituraCruzada(nomeRep: string, par: ParaleloRep | null, perf: PerfResumo | null): string {
  const partes: string[] = [];
  if (perf?.geralPct != null) {
    const rel =
      perf.diffPp == null
        ? ""
        : Math.abs(perf.diffPp) < 0.05
          ? ", em linha com a média do grupo"
          : `, ${fmtPp(perf.diffPp).replace("+", "").replace("−", "")} ${perf.diffPp > 0 ? "acima" : "abaixo"} da média do grupo`;
    partes.push(
      `No período ${perf.periodoLabel}, o atingimento geral da carteira é ${fmtPct(perf.geralPct)}${rel}${perf.posicao ? ` (${perf.posicao}º entre ${perf.totalReps} representantes)` : ""}.`,
    );
  }
  if (par?.indiceAlinhamento != null && perf?.diffPp != null) {
    const alto = par.indiceAlinhamento >= 50;
    const bom = perf.diffPp >= 0;
    if (alto && bom) partes.push("Discurso alinhado ao grupo e resultado acima da média: leitura consistente, priorize escalar as ações já convergentes.");
    else if (alto && !bom) partes.push("Discurso alinhado ao grupo, mas resultado abaixo da média: o diagnóstico está correto e a lacuna é de execução.");
    else if (!alto && bom) partes.push("Discurso descolado do grupo com resultado acima da média: possível prática regional replicável.");
    else partes.push("Discurso descolado do grupo e resultado abaixo da média: revisar o diagnóstico antes de definir o plano.");
  }
  if (par?.leitura) partes.push(par.leitura);
  if (!partes.length) partes.push(`Ainda não há dados suficientes para o raio-x de ${nomeRep}.`);
  return partes.join(" ");
}

// ============ Raio-x visual ============

export type RaioXCapitulo = {
  titulo: string;
  tipo: "leitura" | "campo" | "citacao";
  itens: string[];
};

export type RaioXLente = {
  lente: Lente;
  label: string;
  descricao: string;
  leitura: string | null;
  campos: QuadroCampo[];
  termos: string[];
  highlight: string | null;
  highlights: string[];
  capitulos: RaioXCapitulo[];
  sinais: number;
  intensidade: number; // 0-100, relativo à lente mais densa
  vazia: boolean;
};

const curto = (s: string) => s.trim().replace(/\s+/g, " ");

/** Quebra um texto longo em blocos curtos de leitura (sub-capítulos). */
function fatiar(texto: string, porBloco = 2): string[] {
  const frases = curto(texto)
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < frases.length; i += porBloco) {
    out.push(frases.slice(i, i + porBloco).join(" "));
  }
  return out;
}

/** Converte o quadro em dados prontos para representação visual (radar + anéis). */
export function buildRaioX(quadro: QuadroLente[]): RaioXLente[] {
  const sinaisDe = (q: QuadroLente) =>
    q.campos.reduce((a, c) => a + c.valores.length, 0) + q.highlights.length;
  const max = Math.max(1, ...quadro.map(sinaisDe));
  return quadro.map(q => {
    const sinais = sinaisDe(q);
    const termos = q.campos
      .flatMap(c => c.valores)
      .map(curto)
      .filter(v => v.length > 0 && v.length <= 42)
      .slice(0, 5);

    const capitulos: RaioXCapitulo[] = [];
    if (q.leitura?.trim()) {
      const partes = fatiar(q.leitura);
      partes.forEach((p, i) =>
        capitulos.push({
          titulo: partes.length > 1 ? `Leitura estratégica ${i + 1}/${partes.length}` : "Leitura estratégica",
          tipo: "leitura",
          itens: [p],
        }),
      );
    }
    for (const c of q.campos) {
      capitulos.push({ titulo: c.label, tipo: "campo", itens: c.valores.map(curto) });
    }
    if (q.highlights.length) {
      capitulos.push({ titulo: "Nas palavras do representante", tipo: "citacao", itens: q.highlights.map(curto) });
    }

    return {
      lente: q.lente,
      label: q.label,
      descricao: q.descricao,
      leitura: q.leitura,
      campos: q.campos,
      termos,
      highlight: q.highlights[0] ?? null,
      highlights: q.highlights,
      capitulos,
      sinais,
      intensidade: Math.round((sinais / max) * 100),
      vazia: q.vazia,
    };
  });
}


/** Introdução curta que antecede as representações visuais do raio-x. */
export function introRaioX(nomeRep: string, raiox: RaioXLente[]): string {
  const ativas = raiox.filter(r => !r.vazia);
  if (!ativas.length) return `Ainda não há entrevista processada para compor o raio-x de ${nomeRep}.`;
  const ordenadas = ativas.slice().sort((a, b) => b.sinais - a.sinais);
  const fortes = ordenadas.slice(0, 2).map(r => r.label.toLowerCase());
  const fracas = raiox.filter(r => r.vazia || r.intensidade <= 25).map(r => r.label.toLowerCase());
  const total = raiox.reduce((a, r) => a + r.sinais, 0);
  const p1 = `${nomeRep} deixou ${total} sinais registrados em ${ativas.length} das 8 perspectivas da entrevista.`;
  const p2 = fortes.length ? ` A fala se concentra em ${fortes.join(" e ")}.` : "";
  const p3 = fracas.length ? ` Cobertura fraca em ${fracas.slice(0, 3).join(", ")}.` : "";
  return p1 + p2 + p3;
}
