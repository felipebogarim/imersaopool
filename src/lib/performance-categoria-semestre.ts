// Categoria do cliente (Silver / Gold / Black) com CORTE SEMESTRAL (1º jan–jun, 2º jul–dez).
//
// Regra: a categoria é mantida/alcançada quando a MÉDIA MENSAL DO SEMESTRE atinge o piso mensal
// (Silver R$ 3.000, Gold R$ 6.000, Black R$ 20.000) — equivalente a fechar o semestre com
// acumulado >= piso × 6.
//
// A média é apurada SÓ com meses do semestre de corte (ex.: 2º semestre com dados até outubro →
// jul–out). Fonte por mês: upload de 1 mês → realizado do mês; upload de vários meses contido no
// semestre → média mensal daquele período. Sem dados só do semestre (ex.: upload jan–out), a
// média do período do upload é usada como ESTIMATIVA e isso é sinalizado (`fonte: "estimada"`).
// Nada é misturado em silêncio: cada indicador sabe se é real ou estimado.

import { lookupFamilyNum } from "./performance-metas-persistence";

export type CategoriaNome = "Silver" | "Gold" | "Black";

export const MESES_SEMESTRE = 6;

export const PISO_MENSAL: Record<CategoriaNome, number> = {
  Silver: 3_000,
  Gold: 6_000,
  Black: 20_000,
};

export const CATEGORIAS_ORDEM: CategoriaNome[] = ["Silver", "Gold", "Black"];

export const pisoSemestral = (c: CategoriaNome) => PISO_MENSAL[c] * MESES_SEMESTRE;

const MES_ABREV = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function faixaMeses(de: number, ate: number): string {
  // de/ate: 1..12 inclusivos
  if (ate < de) return "";
  return de === ate ? MES_ABREV[de - 1] : `${MES_ABREV[de - 1]}–${MES_ABREV[ate - 1]}`;
}

export type SemestreCorte = {
  ano: number;
  semestre: 1 | 2;
  /** "2º semestre 2026" */
  label: string;
  /** "jul–dez" */
  mesesLabel: string;
  /** Meses do semestre já cobertos pelos dados (0..6). */
  mesesDecorridos: number;
  mesesRestantes: number;
  /** "jul–out" (vazio se nenhum mês decorrido) */
  decorridosLabel: string;
  /** "nov–dez" (vazio se o semestre está encerrado) */
  restantesLabel: string;
};

function parseAnoMes(ref: string | Date): { ano: number; mes: number } | null {
  if (ref instanceof Date) {
    return Number.isNaN(ref.getTime()) ? null : { ano: ref.getFullYear(), mes: ref.getMonth() + 1 };
  }
  const m = /^(\d{4})-(\d{2})/.exec(ref.trim());
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  return mes >= 1 && mes <= 12 ? { ano, mes } : null;
}

/**
 * Semestre de corte vigente para os dados. `dataFimDados` é o fim do período do upload
 * (ex.: "2026-10-31" → 2º semestre 2026, jul–out decorridos, nov–dez restantes).
 * Sem data: usa o mês anterior a `hoje` como último mês com dados.
 */
export function semestreDeCorte(
  dataFimDados: string | Date | null | undefined,
  hoje: Date = new Date(),
): SemestreCorte {
  let ref = dataFimDados ? parseAnoMes(dataFimDados) : null;
  let mesesDados: number;
  if (ref) {
    mesesDados = ref.mes;
  } else {
    const ano = hoje.getFullYear();
    const mes = hoje.getMonth() + 1;
    ref = { ano, mes };
    mesesDados = mes - 1; // mês corrente ainda em aberto
  }
  const semestre: 1 | 2 = ref.mes <= 6 ? 1 : 2;
  const inicio = semestre === 1 ? 1 : 7;
  const fim = inicio + MESES_SEMESTRE - 1;
  const mesesDecorridos = Math.min(MESES_SEMESTRE, Math.max(0, mesesDados - inicio + 1));
  const mesesRestantes = MESES_SEMESTRE - mesesDecorridos;
  return {
    ano: ref.ano,
    semestre,
    label: `${semestre}º semestre ${ref.ano}`,
    mesesLabel: faixaMeses(inicio, fim),
    mesesDecorridos,
    mesesRestantes,
    decorridosLabel: mesesDecorridos > 0 ? faixaMeses(inicio, inicio + mesesDecorridos - 1) : "",
    restantesLabel: mesesRestantes > 0 ? faixaMeses(inicio + mesesDecorridos, fim) : "",
  };
}

export function normalizarCategoria(c: string | null | undefined): CategoriaNome {
  const n = (c ?? "").trim().toLowerCase();
  return CATEGORIAS_ORDEM.find((x) => x.toLowerCase() === n) ?? "Silver";
}

// ============================ Base: média do semestre ============================

export type UploadCategoria = {
  upload_id: string;
  atual?: boolean;
  periodo_label: string | null;
  periodo_inicio: string | null;
  periodo_fim: string | null;
  realizado: Record<string, unknown> | null;
  media: Record<string, unknown> | null;
};

export type FonteMedia = "semestre" | "semestre_parcial" | "estimada";

export type ComposicaoPortfolio = {
  familia: string;
  /** Média mensal do portfólio na base usada. */
  mediaMensal: number;
  origem: string;
};

export type BaseCategoria = {
  semestre: SemestreCorte;
  mediaMensal: number;
  fonte: FonteMedia;
  /** Meses do semestre com dados reais usados na média. */
  mesesObservados: number;
  /** Rótulo do período efetivamente usado na média (ex.: "jul–out/2026" ou "Janeiro a Outubro 2026"). */
  periodoMedia: string;
  /** Acumulado REAL do semestre (todos os meses decorridos com dados); null se estimado. */
  acumuladoReal: number | null;
  composicao: ComposicaoPortfolio[];
  /** Memória de cálculo, linha a linha. */
  memoria: string[];
};

const mesIdx = (iso: string) => {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : NaN;
};
const mesLabel = (k: number) => `${MES_ABREV[k % 12]}/${Math.floor(k / 12)}`;

function num(rec: Record<string, unknown> | null | undefined, familia: string): number | null {
  const v = lookupFamilyNum(rec, familia);
  return v != null && Number.isFinite(v) && v >= 0 ? v : null;
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

/**
 * Apura a média mensal do semestre de corte a partir dos uploads do cliente.
 * O semestre é o que contém o fim do período do upload atual.
 */
export function baseCategoriaSemestral(
  uploads: readonly UploadCategoria[],
  familias: readonly string[],
  hoje: Date = new Date(),
): BaseCategoria {
  const atual =
    uploads.find((u) => u.atual) ??
    [...uploads].sort((a, b) => (a.periodo_fim ?? "").localeCompare(b.periodo_fim ?? "")).pop();
  const semestre = semestreDeCorte(atual?.periodo_fim ?? null, hoje);
  const semIni = semestre.ano * 12 + (semestre.semestre === 1 ? 0 : 6);
  const dataFim = semIni + semestre.mesesDecorridos - 1;

  // Uploads inteiramente contidos nos meses decorridos do semestre.
  const contidos = uploads
    .map((u) => ({
      u,
      ini: u.periodo_inicio ? mesIdx(u.periodo_inicio) : NaN,
      fim: u.periodo_fim ? mesIdx(u.periodo_fim) : NaN,
    }))
    .filter((x) => Number.isFinite(x.ini) && Number.isFinite(x.fim))
    .filter((x) => x.ini >= semIni && x.fim <= dataFim && x.fim >= x.ini);

  // Para cada mês decorrido, o upload contido de menor período que o cobre.
  const porMes = new Map<number, (typeof contidos)[number]>();
  for (let k = semIni; k <= dataFim; k++) {
    const c = contidos
      .filter((x) => x.ini <= k && x.fim >= k)
      .sort((a, b) => a.fim - a.ini - (b.fim - b.ini))[0];
    if (c) porMes.set(k, c);
  }

  const valorMes = (x: (typeof contidos)[number], f: string): { v: number | null; o: string } => {
    const unico = x.fim === x.ini;
    const real = num(x.u.realizado, f);
    const media = num(x.u.media, f);
    if (unico) return real != null ? { v: real, o: "realizado do mês" } : { v: media, o: "média" };
    return media != null
      ? { v: media, o: "média do período" }
      : { v: real, o: "realizado do período" };
  };

  const memoria: string[] = [];
  const meses = [...porMes.keys()].sort((a, b) => a - b);
  if (meses.length > 0) {
    let acumulado = 0;
    const porFamilia = new Map<string, { soma: number; origens: Set<string> }>();
    for (const k of meses) {
      const x = porMes.get(k)!;
      let totalMes = 0;
      for (const f of familias) {
        const { v, o } = valorMes(x, f);
        if (v == null) continue;
        totalMes += v;
        const pf = porFamilia.get(f) ?? { soma: 0, origens: new Set<string>() };
        pf.soma += v;
        pf.origens.add(o);
        porFamilia.set(f, pf);
      }
      acumulado += totalMes;
      memoria.push(
        `${mesLabel(k)}: ${brl(totalMes)} (upload "${x.u.periodo_label ?? "sem rótulo"}", ${
          x.fim === x.ini ? "realizado do mês" : "média mensal do período"
        })`,
      );
    }
    const completo = meses.length === semestre.mesesDecorridos;
    const mediaMensal = acumulado / meses.length;
    const periodoMedia = `${mesLabel(meses[0])} a ${mesLabel(meses[meses.length - 1])}`;
    memoria.push(
      `Média mensal do semestre = ${brl(acumulado)} ÷ ${meses.length} ${
        meses.length === 1 ? "mês" : "meses"
      } = ${brl(mediaMensal)}`,
    );
    if (!completo) {
      memoria.push(
        `Sem dados de ${semestre.mesesDecorridos - meses.length} mês(es) decorrido(s) do semestre: acumulado do semestre estimado.`,
      );
    }
    return {
      semestre,
      mediaMensal,
      fonte: completo ? "semestre" : "semestre_parcial",
      mesesObservados: meses.length,
      periodoMedia,
      acumuladoReal: completo ? acumulado : null,
      composicao: familias.map((f) => {
        const pf = porFamilia.get(f);
        return {
          familia: f,
          mediaMensal: pf ? pf.soma / meses.length : 0,
          origem: pf ? [...pf.origens].join(" + ") : "sem dado",
        };
      }),
      memoria,
    };
  }

  // Sem dados só do semestre: estimativa pela média do período do upload atual.
  const composicao = familias.map((f) => {
    const media = num(atual?.media, f);
    const real = num(atual?.realizado, f);
    return media != null
      ? { familia: f, mediaMensal: media, origem: "média do período do upload" }
      : real != null
        ? { familia: f, mediaMensal: real, origem: "realizado do upload (sem média)" }
        : { familia: f, mediaMensal: 0, origem: "sem dado" };
  });
  const mediaMensal = composicao.reduce((s, c) => s + c.mediaMensal, 0);
  const periodoMedia = atual?.periodo_label ?? "período do upload";
  memoria.push(
    `Não há upload só com meses do ${semestre.label} (${semestre.decorridosLabel || "nenhum mês decorrido"}).`,
    `Média ESTIMADA = Σ da média mensal por portfólio do upload "${periodoMedia}" = ${brl(mediaMensal)}.`,
  );
  return {
    semestre,
    mediaMensal,
    fonte: "estimada",
    mesesObservados: 0,
    periodoMedia,
    acumuladoReal: null,
    composicao,
    memoria,
  };
}

/** Base estimada a partir de uma média já conhecida (sem a RPC de uploads). */
export function baseEstimada(
  mediaMensal: number,
  periodoFim: string | null | undefined,
  periodoLabel: string | null | undefined,
  hoje: Date = new Date(),
): BaseCategoria {
  const semestre = semestreDeCorte(periodoFim ?? null, hoje);
  const periodoMedia = periodoLabel ?? "período do upload";
  return {
    semestre,
    mediaMensal,
    fonte: "estimada",
    mesesObservados: 0,
    periodoMedia,
    acumuladoReal: null,
    composicao: [],
    memoria: [
      `Média ESTIMADA pela média mensal do upload "${periodoMedia}" = ${brl(mediaMensal)}.`,
    ],
  };
}

// ============================ Situação da categoria ============================

export type EstadoCategoria = "garantida" | "manutencao" | "risco";

export type MetaCategoria = {
  categoria: CategoriaNome;
  pisoMensal: number;
  /** Piso semestral = piso mensal × 6. */
  piso: number;
  /** Média mensal atual ÷ piso mensal × 100. */
  atingimentoPct: number;
  /** Média mensal atual >= piso mensal. */
  atingido: boolean;
  /** Projeção do fechamento − piso semestral (negativo = déficit, positivo = excedente). */
  saldoProjetado: number;
  /** Compras ainda necessárias até o fim do semestre para chegar ao piso (0 se já chegou). */
  volumeNecessario: number;
  /** Média mensal necessária nos meses restantes (null se nada falta ou semestre encerrado). */
  necessarioMes: number | null;
};

export type SituacaoCategoria = {
  base: BaseCategoria;
  semestre: SemestreCorte;
  categoria: CategoriaNome;
  mediaMensal: number;
  /** A média (e tudo que deriva dela) é estimada. */
  mediaEstimada: boolean;
  /** Acumulado do semestre até o último mês com dados. */
  acumulado: number;
  acumuladoEstimado: boolean;
  /** Fechamento do semestre: acumulado + média atual × meses restantes. */
  projecao: number;
  encerrado: boolean;
  estado: EstadoCategoria;
  /** Média mensal compatível com a próxima categoria. */
  evolucaoProjetada: boolean;
  manter: MetaCategoria;
  proxima: MetaCategoria | null;
  anterior: CategoriaNome | null;
  risco: { nivel: "baixo" | "medio" | "alto"; titulo: string; descricao: string };
};

function metaCategoria(
  categoria: CategoriaNome,
  media: number,
  acumulado: number,
  projecao: number,
  restantes: number,
): MetaCategoria {
  const pisoMensal = PISO_MENSAL[categoria];
  const piso = pisoMensal * MESES_SEMESTRE;
  const volumeNecessario = Math.max(0, piso - acumulado);
  return {
    categoria,
    pisoMensal,
    piso,
    atingimentoPct: (media / pisoMensal) * 100,
    atingido: media >= pisoMensal,
    saldoProjetado: projecao - piso,
    volumeNecessario,
    necessarioMes: volumeNecessario > 0 && restantes > 0 ? volumeNecessario / restantes : null,
  };
}

export const ESTADO_LABEL: Record<EstadoCategoria, string> = {
  garantida: "Categoria garantida",
  manutencao: "Em manutenção",
  risco: "Em risco",
};

export function situacaoCategoria(
  categoriaAtual: string | null | undefined,
  base: BaseCategoria,
): SituacaoCategoria {
  const { semestre } = base;
  const categoria = normalizarCategoria(categoriaAtual);
  const media = Math.max(0, base.mediaMensal || 0);
  const acumulado = base.acumuladoReal ?? media * semestre.mesesDecorridos;
  const restantes = semestre.mesesRestantes;
  const projecao = acumulado + media * restantes;
  const idx = CATEGORIAS_ORDEM.indexOf(categoria);
  const proxNome = CATEGORIAS_ORDEM[idx + 1] ?? null;
  const anterior = idx > 0 ? CATEGORIAS_ORDEM[idx - 1] : null;
  const manter = metaCategoria(categoria, media, acumulado, projecao, restantes);
  const proxima = proxNome ? metaCategoria(proxNome, media, acumulado, projecao, restantes) : null;
  const encerrado = restantes === 0;

  const estado: EstadoCategoria =
    base.acumuladoReal != null && base.acumuladoReal >= manter.piso
      ? "garantida"
      : manter.atingido
        ? "manutencao"
        : "risco";
  const evolucaoProjetada = !!proxima && proxima.atingido;
  const est = base.fonte === "estimada" ? " (estimada)" : "";
  const quando = semestre.restantesLabel ? ` em ${semestre.restantesLabel}` : "";

  let risco: SituacaoCategoria["risco"];
  if (estado === "garantida") {
    risco = {
      nivel: "baixo",
      titulo: ESTADO_LABEL.garantida,
      descricao: `Acumulado real de ${brl(acumulado)} no semestre já supera o piso ${categoria} de ${brl(manter.piso)}.`,
    };
  } else if (estado === "manutencao") {
    risco = {
      nivel: "baixo",
      titulo: ESTADO_LABEL.manutencao,
      descricao: `Média mensal${est} de ${brl(media)} ≥ piso de ${brl(manter.pisoMensal)}/mês. Mantido o ritmo, o semestre fecha com excedente de ${brl(manter.saldoProjetado)}; ainda não é garantia definitiva.`,
    };
  } else {
    const abaixoAnterior =
      anterior != null ? media < PISO_MENSAL[anterior] : manter.atingimentoPct < 50;
    const porMes =
      manter.necessarioMes != null
        ? ` Precisa de ${brl(manter.volumeNecessario)} em compras até o fim do semestre (${brl(manter.necessarioMes)}/mês${quando}).`
        : "";
    risco = {
      nivel: encerrado || abaixoAnterior ? "alto" : "medio",
      titulo: encerrado
        ? anterior
          ? "Degrade no corte"
          : "Abaixo do piso"
        : abaixoAnterior
          ? anterior
            ? "Alto risco de degrade"
            : "Alto risco de inativação"
          : "Em risco",
      descricao: encerrado
        ? `Semestre encerrado com média de ${brl(media)}/mês, abaixo do piso ${categoria} de ${brl(manter.pisoMensal)}/mês.`
        : `Média mensal${est} de ${brl(media)} abaixo do piso de ${brl(manter.pisoMensal)}/mês (${manter.atingimentoPct.toFixed(0)}%). Déficit projetado de ${brl(-manter.saldoProjetado)} no fechamento.${porMes}`,
    };
  }

  return {
    base,
    semestre,
    categoria,
    mediaMensal: media,
    mediaEstimada: base.fonte === "estimada",
    acumulado,
    acumuladoEstimado: base.acumuladoReal == null,
    projecao,
    encerrado,
    estado,
    evolucaoProjetada,
    manter,
    proxima,
    anterior,
    risco,
  };
}

/** Posição (0..100) de uma média MENSAL na régua: pisos 3k (33%), 6k (66%) e 20k (100%). */
export function posicaoReguaMensal(valor: number): number {
  if (valor <= 0) return 0;
  const s = PISO_MENSAL.Silver;
  const g = PISO_MENSAL.Gold;
  const b = PISO_MENSAL.Black;
  if (valor < s) return Math.max(2, (valor / s) * 33.3);
  if (valor < g) return 33.3 + ((valor - s) / (g - s)) * 33.3;
  if (valor < b) return 66.6 + ((valor - g) / (b - g)) * 31.4;
  return 100;
}
