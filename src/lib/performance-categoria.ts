// Categoria do cliente na timeline: categoria CADASTRADA (nunca alterada aqui) × categoria em que
// a MÉDIA MENSAL de compras se enquadra, contra os pisos configurados em "Mínimos por categoria".
// O corte semestral é só informação complementar (estimada), nunca o critério da timeline.

import type { MediaCliente } from "./performance-media-cliente";
import type { PisosCategoria } from "./performance-metas-minimos";

export type CategoriaNome = "Silver" | "Gold" | "Black";
export const CATEGORIAS: CategoriaNome[] = ["Silver", "Gold", "Black"];

export function categoriaCadastrada(c: string | null | undefined): CategoriaNome | null {
  const n = (c ?? "").trim().toLowerCase();
  return CATEGORIAS.find((x) => x.toLowerCase() === n) ?? null;
}

/** Categoria pela média: a maior cujo piso a média alcança; null = abaixo do piso Silver. */
export function categoriaPelaMedia(media: number, pisos: PisosCategoria): CategoriaNome | null {
  let out: CategoriaNome | null = null;
  for (const c of CATEGORIAS) if (media >= pisos[c]) out = c;
  return out;
}

/**
 * Posição (0–100) na barra POR FAIXAS (padrão original): 0 → piso Silver ocupa o 1º terço,
 * Silver → Gold o 2º, Gold → Black o 3º; a partir do piso Black, 100%.
 */
export function posicaoNaRegua(media: number | null, pisos: PisosCategoria): number {
  if (media == null || media <= 0) return 0;
  const { Silver: s, Gold: g, Black: b } = pisos;
  if (media < s) return (media / s) * 33.3;
  if (media < g) return 33.3 + ((media - s) / (g - s)) * 33.3;
  if (media < b) return 66.6 + ((media - g) / (b - g)) * 33.4;
  return 100;
}

export type EstadoCategoria =
  | "sem_base"
  | "evolucao" // média compatível com categoria acima da cadastrada
  | "proximo_evoluir" // mantém a cadastrada e está a ≥ 85% do próximo piso
  | "manutencao" // mantém a cadastrada com folga
  | "atencao" // mantém a cadastrada, mas com folga < 10% do piso
  | "risco_queda"; // média abaixo do piso da categoria cadastrada

export type SituacaoCategoria = {
  estado: EstadoCategoria;
  cadastrada: CategoriaNome | null;
  enquadrada: CategoriaNome | null;
  /** Piso da categoria em que a média se enquadra. */
  pisoEnquadrada: number | null;
  media: number | null;
  estimado: boolean;
  pisoCadastrada: number | null;
  proxima: CategoriaNome | null;
  pisoProxima: number | null;
  /** Média − piso da cadastrada (positivo = folga, negativo = falta por mês). */
  saldoManutencao: number | null;
  /** Quanto falta por mês para o próximo piso (0 se já alcançou). */
  faltaProxima: number | null;
  /** % da média sobre o piso da cadastrada. */
  pctPiso: number | null;
};

const PROXIMO_EVOLUIR = 0.85;
const FOLGA_ATENCAO = 0.1;

export function situacaoCategoria(
  categoria: string | null | undefined,
  mediaCliente: MediaCliente,
  pisos: PisosCategoria,
): SituacaoCategoria {
  const cadastrada = categoriaCadastrada(categoria);
  const media = mediaCliente.total;
  const idxCad = cadastrada ? CATEGORIAS.indexOf(cadastrada) : -1;
  const proxima = CATEGORIAS[idxCad + 1] ?? null;
  const base = {
    cadastrada,
    media,
    estimado: mediaCliente.estimado,
    pisoCadastrada: cadastrada ? pisos[cadastrada] : null,
    proxima,
    pisoProxima: proxima ? pisos[proxima] : null,
  };
  if (media == null) {
    return {
      ...base,
      estado: "sem_base",
      enquadrada: null,
      pisoEnquadrada: null,
      saldoManutencao: null,
      faltaProxima: null,
      pctPiso: null,
    };
  }
  const enquadrada = categoriaPelaMedia(media, pisos);
  const idxEnq = enquadrada ? CATEGORIAS.indexOf(enquadrada) : -1;
  const saldoManutencao = base.pisoCadastrada != null ? media - base.pisoCadastrada : null;
  const faltaProxima = base.pisoProxima != null ? Math.max(0, base.pisoProxima - media) : null;
  const pctPiso = base.pisoCadastrada ? media / base.pisoCadastrada : null;

  let estado: EstadoCategoria;
  if (idxEnq > idxCad) estado = "evolucao";
  else if (idxEnq < idxCad) estado = "risco_queda";
  else if (base.pisoProxima != null && media >= base.pisoProxima * PROXIMO_EVOLUIR)
    estado = "proximo_evoluir";
  else if (
    base.pisoCadastrada != null &&
    saldoManutencao != null &&
    saldoManutencao < base.pisoCadastrada * FOLGA_ATENCAO
  )
    estado = "atencao";
  else estado = "manutencao";

  return {
    ...base,
    estado,
    enquadrada,
    pisoEnquadrada: enquadrada ? pisos[enquadrada] : null,
    saldoManutencao,
    faltaProxima,
    pctPiso,
  };
}

/** Complemento: projeção do semestre de corte mantida a média (estimativa). */
export function complementoSemestral(
  media: number | null,
  periodoFim: string | null | undefined,
  pisoMensal: number | null,
): { label: string; projecao: number; piso: number } | null {
  if (media == null || pisoMensal == null || !periodoFim) return null;
  const m = /^(\d{4})-(\d{2})/.exec(periodoFim);
  if (!m) return null;
  const sem = Number(m[2]) <= 6 ? 1 : 2;
  return {
    label: `${sem}º semestre ${m[1]}`,
    projecao: media * 6,
    piso: pisoMensal * 6,
  };
}
