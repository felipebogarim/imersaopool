// Categoria do cliente na timeline: categoria CADASTRADA (nunca alterada aqui) × categoria em que
// a MÉDIA MENSAL de compras se enquadra, pela CLASSIFICAÇÃO COMERCIAL (Silver/Gold/Black).
// Manutenção e evolução são avaliadas pelo FECHAMENTO ANUAL (jan–dez): piso anual = piso mensal
// × 12, contra o acumulado do ano até o último mês consolidado da base importada.
// Independe de "Metas Mínimas" (referência de meta por portfólio, outro conceito) e do ciclo de
// metas comerciais selecionado.

import type { MediaCliente } from "./performance-media-cliente";

export type CategoriaNome = "Silver" | "Gold" | "Black";
export const CATEGORIAS: CategoriaNome[] = ["Silver", "Gold", "Black"];

export type PisosCategoria = Record<CategoriaNome, number>;

/** Classificação comercial: média mensal de compras a partir da qual o cliente se enquadra. */
export const PISOS_CATEGORIA: PisosCategoria = { Silver: 3000, Gold: 6000, Black: 20000 };

/** Categoria cadastrada normalizada ("BLACK", " Black ", "Cliente Black" → "Black"). */
export function categoriaCadastrada(c: string | null | undefined): CategoriaNome | null {
  const n = (c ?? "").trim().toLowerCase();
  if (!n) return null;
  return (
    CATEGORIAS.find((x) => x.toLowerCase() === n) ??
    CATEGORIAS.find((x) => new RegExp(`\\b${x.toLowerCase()}\\b`).test(n)) ??
    null
  );
}

/** Categoria pela média: a maior cujo piso a média alcança; null = abaixo do piso Silver. */
export function categoriaPelaMedia(media: number, pisos: PisosCategoria): CategoriaNome | null {
  let out: CategoriaNome | null = null;
  for (const c of CATEGORIAS) if (media >= pisos[c]) out = c;
  return out;
}

// ------------------------------- Régua (barra por faixas) -------------------------------

export type FaixaRegua = {
  /** null = faixa abaixo do piso Silver (neutra). */
  categoria: CategoriaNome | null;
  /** Início/fim da faixa em R$/mês. */
  de: number;
  ate: number;
  /** Início/fim da faixa na barra (0–100). */
  inicio: number;
  fim: number;
};

/** Teto visual da faixa Black (acima dele o marcador fica no fim da barra). */
export const TETO_BLACK_FATOR = 1.5;

/**
 * Quatro faixas de mesma largura, cada uma começando exatamente no piso da categoria:
 * 0 → Silver (neutra) · Silver → Gold · Gold → Black · Black → 1,5 × Black.
 */
export function faixasRegua(pisos: PisosCategoria = PISOS_CATEGORIA): FaixaRegua[] {
  const limites = [0, pisos.Silver, pisos.Gold, pisos.Black, pisos.Black * TETO_BLACK_FATOR];
  const cats: Array<CategoriaNome | null> = [null, "Silver", "Gold", "Black"];
  return cats.map((categoria, i) => ({
    categoria,
    de: limites[i],
    ate: limites[i + 1],
    inicio: i * 25,
    fim: (i + 1) * 25,
  }));
}

/** Posição (0–100) do marcador: proporcional DENTRO da faixa em que a média está. */
export function posicaoNaRegua(
  media: number | null,
  pisos: PisosCategoria = PISOS_CATEGORIA,
): number {
  if (media == null || media <= 0) return 0;
  for (const f of faixasRegua(pisos)) {
    if (media < f.ate) return f.inicio + ((media - f.de) / (f.ate - f.de)) * (f.fim - f.inicio);
  }
  return 100;
}

// ------------------------------- Fechamento anual -------------------------------

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

/** Rótulo dos meses restantes após o mês de referência ("nov/dez", "ago–dez"). */
export function rotuloMesesRestantes(mesRef: number): string {
  const resto = MES_ABREV.slice(mesRef);
  if (!resto.length) return "";
  if (resto.length <= 2) return resto.join("/");
  return `${resto[0]}–${resto[resto.length - 1]}`;
}

/** Meses decorridos até o mês de referência ("jan–out"; "jan" em janeiro). */
export function rotuloMesesDecorridos(mesRef: number): string {
  if (mesRef < 1 || mesRef > 12) return "";
  return mesRef === 1 ? "jan" : `jan–${MES_ABREV[mesRef - 1]}`;
}

export type MetaAnual = {
  categoria: CategoriaNome;
  pisoMensal: number;
  pisoAnual: number;
  /** Piso anual − acumulado, nunca negativo. */
  totalNecessario: number;
  /** Total necessário ÷ meses restantes; null quando não há meses restantes (fechamento). */
  mediaNecessaria: number | null;
  /** Acumulado do ano já alcançou o piso anual. */
  atingido: boolean;
};

export type EstadoCategoria =
  | "sem_base"
  | "risco_queda" // média mensal abaixo do piso da categoria cadastrada
  | "garantida" // acumulado REAL do ano já atingiu o piso anual
  | "garantida_estimada" // acumulado ESTIMADO atingiu o piso anual (não é fato confirmado)
  | "mantida_ritmo"; // média ≥ piso, mas ainda há compras necessárias até dezembro

export type SituacaoCategoria = {
  estado: EstadoCategoria;
  cadastrada: CategoriaNome | null;
  enquadrada: CategoriaNome | null;
  media: number | null;
  /** Média mensal com portfólio estimado (% × meta original). */
  mediaEstimada: boolean;
  pisoCadastrada: number | null;
  proxima: CategoriaNome | null;
  pisoProxima: number | null;
  /** Média − piso mensal da cadastrada (positivo = folga, negativo = falta por mês). */
  saldoManutencao: number | null;
  // Fechamento anual
  ano: number | null;
  /** Último mês consolidado na base (1–12). */
  mesRef: number | null;
  mesesRestantes: number | null;
  rotuloRestantes: string;
  acumulado: number | null;
  /** O acumulado (e o que depende dele) é estimado. */
  acumuladoEstimado: boolean;
  manter: MetaAnual | null;
  /** Só Silver e Gold: categoria imediatamente superior. */
  evoluir: MetaAnual | null;
  /** Possibilidade concreta de alcançar a categoria superior. */
  oportunidadeEvolucao: boolean;
};

function metaAnual(
  categoria: CategoriaNome,
  pisos: PisosCategoria,
  acumulado: number | null,
  mesesRestantes: number | null,
): MetaAnual | null {
  if (acumulado == null || mesesRestantes == null) return null;
  const pisoAnual = pisos[categoria] * 12;
  const totalNecessario = Math.max(0, pisoAnual - acumulado);
  return {
    categoria,
    pisoMensal: pisos[categoria],
    pisoAnual,
    totalNecessario,
    mediaNecessaria: mesesRestantes > 0 ? totalNecessario / mesesRestantes : null,
    atingido: totalNecessario === 0,
  };
}

export function situacaoCategoria(
  categoria: string | null | undefined,
  mediaCliente: MediaCliente,
  acumuladoAno: { valor: number; meses: number; ano: number; estimado: boolean } | null = null,
  pisos: PisosCategoria = PISOS_CATEGORIA,
): SituacaoCategoria {
  const cadastrada = categoriaCadastrada(categoria);
  const media = mediaCliente.total;
  const idxCad = cadastrada ? CATEGORIAS.indexOf(cadastrada) : -1;
  const proxima = cadastrada ? (CATEGORIAS[idxCad + 1] ?? null) : null;
  const mesRef = acumuladoAno?.meses ?? null;
  const mesesRestantes = mesRef != null ? 12 - mesRef : null;
  const acumulado = media != null ? (acumuladoAno?.valor ?? null) : null;
  const acumuladoEstimado = (acumuladoAno?.estimado ?? true) || mediaCliente.estimado;

  const manter = cadastrada ? metaAnual(cadastrada, pisos, acumulado, mesesRestantes) : null;
  const evoluir = proxima ? metaAnual(proxima, pisos, acumulado, mesesRestantes) : null;
  const enquadrada = media != null ? categoriaPelaMedia(media, pisos) : null;
  const idxEnq = enquadrada ? CATEGORIAS.indexOf(enquadrada) : -1;

  let estado: EstadoCategoria;
  if (media == null) estado = "sem_base";
  else if (cadastrada && media < pisos[cadastrada]) estado = "risco_queda";
  else if (manter?.atingido) estado = acumuladoEstimado ? "garantida_estimada" : "garantida";
  else estado = "mantida_ritmo";

  // Evolução possível: a média já é compatível com a categoria superior, ou o acumulado já
  // alcançou o piso anual dela, ou o ritmo atual cobre a média necessária nos meses restantes.
  const oportunidadeEvolucao =
    !!evoluir &&
    media != null &&
    (idxEnq > idxCad ||
      evoluir.atingido ||
      (evoluir.mediaNecessaria != null && media >= evoluir.mediaNecessaria));

  return {
    estado,
    cadastrada,
    enquadrada,
    media,
    mediaEstimada: mediaCliente.estimado,
    pisoCadastrada: cadastrada ? pisos[cadastrada] : null,
    proxima,
    pisoProxima: proxima ? pisos[proxima] : null,
    saldoManutencao: media != null && cadastrada ? media - pisos[cadastrada] : null,
    ano: acumuladoAno?.ano ?? null,
    mesRef,
    mesesRestantes,
    rotuloRestantes: mesRef != null ? rotuloMesesRestantes(mesRef) : "",
    acumulado,
    acumuladoEstimado,
    manter,
    evoluir,
    oportunidadeEvolucao,
  };
}
