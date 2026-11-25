// Categoria do cliente (Silver / Gold / Black) com CORTE SEMESTRAL.
//
// A categoria é apurada por semestre (1º = jan–jun, 2º = jul–dez). Os pisos conhecidos são
// mensais (Silver R$ 3.000, Gold R$ 6.000, Black R$ 20.000); no corte valem multiplicados pelos
// 6 meses do semestre. Portanto o que falta para manter/subir de categoria é o ACUMULADO que
// falta no semestre — não a diferença na média mensal.
//
// Sem a venda mês a mês do cliente, o acumulado do semestre é estimado pela média mensal do
// período do upload × meses do semestre já cobertos pelos dados (sinalizado em `acumuladoEstimado`).

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

// Regra: o cliente mantém/alcança a categoria quando a MÉDIA MENSAL no semestre atinge o piso
// mensal (Silver 3k, Gold 6k, Black 20k) — equivalente a fechar o semestre com acumulado >= piso
// semestral (piso mensal × 6). Por isso o status usa a PROJEÇÃO de fechamento (acumulado até
// agora + média atual nos meses restantes), nunca o acumulado parcial contra o piso cheio.
// "Falta" = quanto falta no acumulado do semestre para o piso, no ritmo atual.

export type MetaSemestral = {
  categoria: CategoriaNome;
  /** Piso semestral (piso mensal × 6). */
  piso: number;
  pisoMensal: number;
  /** No ritmo atual, quanto falta no acumulado do semestre para o piso (0 se atinge). */
  falta: number;
  /** No ritmo atual, quanto o semestre fecha acima do piso. */
  sobra: number;
  /** Média mensal >= piso mensal (projeção do semestre >= piso semestral). */
  atingido: boolean;
  /** Acumulado do semestre já passou do piso (garantido mesmo sem novas compras). */
  garantido: boolean;
  /** Média mensal necessária nos meses restantes para fechar no piso (null se garantido/encerrado). */
  necessarioMes: number | null;
  /** Projeção ÷ piso (= média mensal ÷ piso mensal quando o acumulado é estimado). */
  atingimentoPct: number;
};

export type SituacaoSemestral = {
  semestre: SemestreCorte;
  categoria: CategoriaNome;
  mediaMensal: number;
  /** Acumulado do semestre até o último mês com dados. */
  acumulado: number;
  acumuladoEstimado: boolean;
  /** Fechamento do semestre mantendo a média atual nos meses restantes. */
  projecao: number;
  manter: MetaSemestral;
  upgrade: MetaSemestral | null;
  /** Piso semestral da categoria abaixo (null para Silver). */
  pisoAnterior: number | null;
  encerrado: boolean;
  risco: {
    nivel: "baixo" | "medio" | "alto";
    titulo: string;
    descricao: string;
  };
};

function meta(
  categoria: CategoriaNome,
  acumulado: number,
  projecao: number,
  restantes: number,
): MetaSemestral {
  const piso = pisoSemestral(categoria);
  const garantido = acumulado >= piso;
  return {
    categoria,
    piso,
    pisoMensal: PISO_MENSAL[categoria],
    falta: Math.max(0, piso - projecao),
    sobra: Math.max(0, projecao - piso),
    atingido: projecao >= piso,
    garantido,
    necessarioMes: !garantido && restantes > 0 ? (piso - acumulado) / restantes : null,
    atingimentoPct: piso > 0 ? (projecao / piso) * 100 : 0,
  };
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function situacaoSemestral(args: {
  categoria: string | null | undefined;
  mediaMensal: number;
  semestre: SemestreCorte;
  /** Acumulado real do semestre, quando conhecido. */
  acumulado?: number | null;
}): SituacaoSemestral {
  const { semestre } = args;
  const categoria = normalizarCategoria(args.categoria);
  const media = Math.max(0, args.mediaMensal || 0);
  const real = typeof args.acumulado === "number" && args.acumulado >= 0 ? args.acumulado : null;
  const acumulado = real ?? media * semestre.mesesDecorridos;
  const restantes = semestre.mesesRestantes;
  const projecao = acumulado + media * restantes;
  const idx = CATEGORIAS_ORDEM.indexOf(categoria);
  const proxima = CATEGORIAS_ORDEM[idx + 1] ?? null;
  const anterior = idx > 0 ? CATEGORIAS_ORDEM[idx - 1] : null;
  const manter = meta(categoria, acumulado, projecao, restantes);
  const upgrade = proxima ? meta(proxima, acumulado, projecao, restantes) : null;
  const pisoAnterior = anterior ? pisoSemestral(anterior) : null;
  const encerrado = restantes === 0;

  const quando = semestre.restantesLabel ? ` em ${semestre.restantesLabel}` : "";
  const porMes =
    manter.necessarioMes != null
      ? ` Para fechar no piso, o cliente precisa comprar ${brl(manter.necessarioMes)}/mês${quando}.`
      : "";
  const pisoTxt = `piso ${categoria} de ${brl(manter.pisoMensal)}/mês (${brl(manter.piso)} no semestre)`;

  let risco: SituacaoSemestral["risco"];
  if (manter.atingido) {
    risco = {
      nivel: "baixo",
      titulo: manter.garantido ? "Categoria Garantida" : "Categoria Mantida",
      descricao: manter.garantido
        ? `Acumulado de ${brl(acumulado)} no semestre já supera o ${pisoTxt}.`
        : `Média de ${brl(media)}/mês acima do ${pisoTxt}. No ritmo atual o semestre fecha em ${brl(projecao)} (+${brl(manter.sobra)}).`,
    };
  } else if (encerrado) {
    risco = {
      nivel: "alto",
      titulo: anterior ? "Degrade no Corte" : "Abaixo do Piso",
      descricao: `Semestre encerrado com ${brl(acumulado)}, ${brl(manter.falta)} abaixo do ${pisoTxt}.`,
    };
  } else if (anterior && pisoAnterior != null && projecao >= pisoAnterior) {
    risco = {
      nivel: "medio",
      titulo: "Risco Moderado de Degrade",
      descricao: `Média de ${brl(media)}/mês abaixo do ${pisoTxt}. No ritmo atual faltam ${brl(manter.falta)} no acumulado do semestre.${porMes}`,
    };
  } else if (!anterior && manter.atingimentoPct >= 50) {
    risco = {
      nivel: "medio",
      titulo: "Atenção ao Ritmo",
      descricao: `Média de ${brl(media)}/mês abaixo do ${pisoTxt}. No ritmo atual faltam ${brl(manter.falta)} no acumulado do semestre.${porMes}`,
    };
  } else {
    risco = {
      nivel: "alto",
      titulo: anterior ? "Alto Risco de Degrade" : "Alto Risco de Inativação",
      descricao: anterior
        ? `Média de ${brl(media)}/mês abaixo até do piso ${anterior} (${brl(PISO_MENSAL[anterior])}/mês). No ritmo atual faltam ${brl(manter.falta)} no acumulado do semestre para manter ${categoria}.${porMes}`
        : `Média de ${brl(media)}/mês bem abaixo do ${pisoTxt}. No ritmo atual faltam ${brl(manter.falta)} no acumulado do semestre.${porMes}`,
    };
  }

  return {
    semestre,
    categoria,
    mediaMensal: media,
    acumulado,
    acumuladoEstimado: real == null,
    projecao,
    manter,
    upgrade,
    pisoAnterior,
    encerrado,
    risco,
  };
}

/** Posição (0..100) de um valor semestral (ex.: projeção = média × 6) na régua Silver / Gold / Black. */
export function posicaoReguaSemestral(valor: number): number {
  if (valor <= 0) return 0;
  const s = pisoSemestral("Silver");
  const g = pisoSemestral("Gold");
  const b = pisoSemestral("Black");
  if (valor < s) return Math.max(2, (valor / s) * 33.3);
  if (valor < g) return 33.3 + ((valor - s) / (g - s)) * 33.3;
  if (valor < b) return 66.6 + ((valor - g) / (b - g)) * 31.4;
  return 100;
}
