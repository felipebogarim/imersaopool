// Comparação "dentro do perfil": compara um cliente com a média dos clientes
// da MESMA categoria, MESMO representante, MESMO período e versão ativa.
// Toda a lógica de filtragem/cálculo vive aqui — os componentes só renderizam.

import {
  CANONICAL_FAMILIES,
  CANONICAL_ORDER,
  getFamiliasCliente,
  normalizeFamilyName,
  normalizeTrafficLightGroup,
  toPercent,
  validateFamilias,
  type ClientBIData,
  type FamiliaResultado,
} from "./client-bi-familias";
import { FAROL_LABEL, FAROL_ORDER, statusFromPercent, type FarolStatus } from "./performance-farol";

// ============= Tipos =============

/** Registro cru vindo de `client_bi_uploads` (kind='bi', versão ativa). Sem nomes de terceiros. */
export type ComparableRecord = {
  representative_id: string;
  periodo_label: string | null;
  substituida_em: string | null;
  kind?: string;
  data: ClientBIData | null;
};

export type ComparableFilter = {
  representativeId: string;
  categoria: string;
  periodoLabel: string | null;
};

export type FamilyComparison = {
  familia: string;
  cliente: number | null;
  media: number | null;
  diffPp: number | null;
  situacao: Situacao | null;
  farolCliente: string | null;
};

export type Situacao = "acima" | "proximo" | "abaixo";

export type FarolDistributionItem = {
  status: FarolStatus;
  grupo: string;
  clienteQtd: number;
  categoriaPct: number | null;
};

export type ProfileComparison = {
  ok: boolean;
  motivo?: "cliente_invalido" | "sem_base";
  mensagem?: string;
  categoria: string;
  periodoLabel: string | null;
  baseSize: number;
  excluidos: number;
  soCliente: boolean;
  clienteGeral: number | null;
  mediaGeral: number | null;
  mediaGeralSemCliente: number | null;
  diffGeralPp: number | null;
  situacaoGeral: Situacao | null;
  posicao: number | null;
  familias: FamilyComparison[];
  maiorVantagem: FamilyComparison | null;
  maiorLacuna: FamilyComparison | null;
  destaquesMensagem: string | null;
  farol: FarolDistributionItem[];
  leituraExecutiva: string;
};

// ============= Helpers =============

export const PP_NEUTRAL_BAND = 5;

const round1 = (n: number) => Math.round(n * 10) / 10;

export function situacaoFromDiff(diffPp: number | null): Situacao | null {
  if (diffPp == null || Number.isNaN(diffPp)) return null;
  if (diffPp > PP_NEUTRAL_BAND) return "acima";
  if (diffPp < -PP_NEUTRAL_BAND) return "abaixo";
  return "proximo";
}

export const SITUACAO_LABEL: Record<Situacao, string> = {
  acima: "Acima da média",
  proximo: "Próximo da média",
  abaixo: "Abaixo da média",
};

export function formatPct(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  return `${round1(n).toFixed(1).replace(".", ",")}%`;
}

export function formatPp(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return "—";
  const v = round1(Math.abs(n)).toFixed(1).replace(".", ",");
  if (Math.abs(round1(n)) < 0.05) return "0,0 p.p.";
  return `${n > 0 ? "+" : "−"}${v} p.p.`;
}

/** Atingimento geral do cliente em percentual (aceita decimal ou percentual). */
export function generalPercent(bi: ClientBIData | null | undefined): number | null {
  return toPercent(bi?.geral ?? null);
}

/** Mapa família → atingimento em %, apenas se o BI tiver as 7 famílias válidas. */
export function familyPercentMap(bi: ClientBIData | null | undefined): Record<string, number> | null {
  if (!bi) return null;
  const fams = getFamiliasCliente(bi);
  if (validateFamilias(fams as FamiliaResultado[]) !== null) return null;
  const map: Record<string, number> = {};
  for (const f of fams) {
    const canon = normalizeFamilyName(f.familia);
    const pct = toPercent(f.atingimento);
    if (!canon || pct == null) return null;
    map[canon] = pct;
  }
  return map;
}

/** Um registro só entra na base se é válido: 7 famílias oficiais + geral numérico. */
export function isValidRecord(bi: ClientBIData | null | undefined): boolean {
  return generalPercent(bi) != null && familyPercentMap(bi) != null;
}

// ============= 1. Base comparável =============

export function getComparableClients(
  rows: ComparableRecord[],
  filter: ComparableFilter,
): { validos: ClientBIData[]; excluidos: number } {
  const doFilter = rows.filter(
    (r) =>
      r.representative_id === filter.representativeId &&
      r.substituida_em == null &&
      (r.kind == null || r.kind === "bi") &&
      (r.periodo_label ?? null) === (filter.periodoLabel ?? null) &&
      (r.data?.categoria ?? null) === filter.categoria,
  );
  const validos: ClientBIData[] = [];
  let excluidos = 0;
  for (const r of doFilter) {
    if (r.data && isValidRecord(r.data)) validos.push(r.data);
    else excluidos += 1;
  }
  return { validos, excluidos };
}

export function validateComparableGroup(group: ClientBIData[]): boolean {
  return group.length > 0 && group.every((b) => isValidRecord(b));
}

// ============= 2. Médias =============

export function calculateCategoryAverageIncludingClient(group: ClientBIData[]): number | null {
  const vals = group.map(generalPercent).filter((v): v is number => v != null);
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function calculateCategoryAverageExcludingClient(
  group: ClientBIData[],
  cliente: ClientBIData,
): number | null {
  const clienteGeral = generalPercent(cliente);
  const vals = group.map(generalPercent).filter((v): v is number => v != null);
  if (vals.length <= 1 || clienteGeral == null) return null;
  const idx = vals.indexOf(clienteGeral);
  const rest = idx >= 0 ? [...vals.slice(0, idx), ...vals.slice(idx + 1)] : vals;
  if (!rest.length) return null;
  return rest.reduce((a, b) => a + b, 0) / rest.length;
}

/** Alias público (a interface usa a média COM o cliente). */
export const calculateCategoryAverage = calculateCategoryAverageIncludingClient;

export function calculateCategoryFamilyAverages(group: ClientBIData[]): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  const maps = group.map(familyPercentMap).filter((m): m is Record<string, number> => m != null);
  for (const fam of CANONICAL_FAMILIES) {
    const vals = maps.map((m) => m[fam]).filter((v): v is number => v != null);
    out[fam] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  return out;
}

// ============= 3. Diferenças por família =============

export function calculateClientDifferences(
  cliente: ClientBIData,
  group: ClientBIData[],
): FamilyComparison[] {
  const cMap = familyPercentMap(cliente);
  const avg = calculateCategoryFamilyAverages(group);
  const farolByFam = new Map<string, string | null>();
  for (const f of getFamiliasCliente(cliente)) {
    const canon = normalizeFamilyName(f.familia);
    if (canon) farolByFam.set(canon, normalizeTrafficLightGroup(f.farol));
  }
  return CANONICAL_FAMILIES.map((familia) => {
    const c = cMap?.[familia] ?? null;
    const m = group.length > 1 ? avg[familia] : null;
    const diff = c != null && m != null ? c - m : null;
    return {
      familia,
      cliente: c,
      media: m,
      diffPp: diff,
      situacao: situacaoFromDiff(diff),
      farolCliente: farolByFam.get(familia) ?? null,
    };
  });
}

// ============= 4. Ranking competitivo =============

export function calculateClientRanking(
  cliente: ClientBIData,
  group: ClientBIData[],
): number | null {
  if (group.length <= 1) return null;
  const c = generalPercent(cliente);
  if (c == null) return null;
  const vals = group.map(generalPercent).filter((v): v is number => v != null);
  const melhores = vals.filter((v) => v > c + 1e-9).length;
  return melhores + 1;
}

// ============= 5. Distribuição do farol =============

function farolOfPercent(pct: number | null): FarolStatus | null {
  return pct == null ? null : statusFromPercent(pct);
}

export function calculateProfileFarolDistribution(
  cliente: ClientBIData,
  group: ClientBIData[],
): FarolDistributionItem[] {
  const cMap = familyPercentMap(cliente);
  const clienteCount = new Map<FarolStatus, number>();
  if (cMap) {
    for (const fam of CANONICAL_FAMILIES) {
      const st = farolOfPercent(cMap[fam]);
      if (st) clienteCount.set(st, (clienteCount.get(st) ?? 0) + 1);
    }
  }
  const groupCount = new Map<FarolStatus, number>();
  let totalObs = 0;
  for (const bi of group) {
    const m = familyPercentMap(bi);
    if (!m) continue;
    for (const fam of CANONICAL_FAMILIES) {
      const st = farolOfPercent(m[fam]);
      if (!st) continue;
      groupCount.set(st, (groupCount.get(st) ?? 0) + 1);
      totalObs += 1;
    }
  }
  return FAROL_ORDER.map((status) => ({
    status,
    grupo: FAROL_LABEL[status],
    clienteQtd: clienteCount.get(status) ?? 0,
    categoriaPct: totalObs > 0 ? ((groupCount.get(status) ?? 0) / totalObs) * 100 : null,
  }));
}

// ============= 6. Destaques =============

const byOfficialOrder = (a: FamilyComparison, b: FamilyComparison) =>
  (CANONICAL_ORDER[a.familia] ?? 99) - (CANONICAL_ORDER[b.familia] ?? 99);

export function getLargestAdvantage(fams: FamilyComparison[]): FamilyComparison | null {
  const withDiff = fams.filter((f) => f.diffPp != null);
  if (!withDiff.length) return null;
  return withDiff
    .slice()
    .sort((a, b) => (b.diffPp as number) - (a.diffPp as number) || byOfficialOrder(a, b))[0];
}

export function getLargestGap(fams: FamilyComparison[]): FamilyComparison | null {
  const withDiff = fams.filter((f) => f.diffPp != null);
  if (!withDiff.length) return null;
  return withDiff
    .slice()
    .sort((a, b) => (a.diffPp as number) - (b.diffPp as number) || byOfficialOrder(a, b))[0];
}

// ============= 7. Leitura executiva (determinística) =============

const famLabel = (s: string) =>
  s
    .toLowerCase()
    .split(" ")
    .map((w) => (w.length <= 2 ? w : w[0].toUpperCase() + w.slice(1)))
    .join(" ");

const ppTxt = (n: number) =>
  `${round1(Math.abs(n)).toFixed(1).replace(".", ",")} pontos percentuais`;

export function generateExecutiveComparisonText(input: {
  categoria: string;
  representante: string;
  periodoLabel: string | null;
  clienteGeral: number | null;
  mediaGeral: number | null;
  diffGeralPp: number | null;
  maiorVantagem: FamilyComparison | null;
  maiorLacuna: FamilyComparison | null;
  soCliente: boolean;
}): string {
  const per = input.periodoLabel ? ` no período ${input.periodoLabel}` : "";
  if (input.soCliente) {
    return `Não há outros clientes da categoria ${input.categoria} na carteira de ${input.representante}${per} para formar uma base comparável. O atingimento geral do cliente é ${formatPct(input.clienteGeral)}.`;
  }
  const parts: string[] = [];
  const d = input.diffGeralPp;
  if (d == null) {
    parts.push(`O cliente apresenta atingimento geral de ${formatPct(input.clienteGeral)}.`);
  } else if (Math.abs(round1(d)) < 0.05) {
    parts.push(
      `O cliente apresenta atingimento geral igual à média dos clientes ${input.categoria} da carteira de ${input.representante}${per}.`,
    );
  } else {
    parts.push(
      `O cliente apresenta atingimento geral ${ppTxt(d)} ${d > 0 ? "acima" : "abaixo"} da média dos clientes ${input.categoria} da carteira de ${input.representante}${per}.`,
    );
  }
  const v = input.maiorVantagem;
  if (v?.diffPp != null && v.diffPp > 0) {
    parts.push(
      `Seu principal destaque está em ${famLabel(v.familia)}, com resultado ${ppTxt(v.diffPp)} acima da média.`,
    );
  }
  const g = input.maiorLacuna;
  if (g?.diffPp != null && g.diffPp < 0) {
    parts.push(
      `A maior lacuna está em ${famLabel(g.familia)}, ${ppTxt(g.diffPp)} abaixo do grupo comparável.`,
    );
  }
  if (
    v?.diffPp != null &&
    g?.diffPp != null &&
    Math.abs(round1(v.diffPp)) < 0.05 &&
    Math.abs(round1(g.diffPp)) < 0.05
  ) {
    parts.push("Desempenho alinhado à média em todas as famílias.");
  }
  return parts.join(" ");
}

// ============= 8. Orquestração =============

export function buildProfileComparison(params: {
  cliente: ClientBIData | null;
  rows: ComparableRecord[];
  representativeId: string;
  representante: string;
  periodoLabel: string | null;
}): ProfileComparison {
  const { cliente, rows, representativeId, representante, periodoLabel } = params;
  const categoria = cliente?.categoria ?? "";

  const base: ProfileComparison = {
    ok: false,
    categoria,
    periodoLabel,
    baseSize: 0,
    excluidos: 0,
    soCliente: false,
    clienteGeral: generalPercent(cliente),
    mediaGeral: null,
    mediaGeralSemCliente: null,
    diffGeralPp: null,
    situacaoGeral: null,
    posicao: null,
    familias: [],
    maiorVantagem: null,
    maiorLacuna: null,
    destaquesMensagem: null,
    farol: [],
    leituraExecutiva: "",
  };

  if (!cliente || !isValidRecord(cliente)) {
    return {
      ...base,
      motivo: "cliente_invalido",
      mensagem:
        "Os dados do cliente estão inconsistentes (as sete famílias oficiais não foram encontradas). Não é possível gerar a comparação.",
    };
  }

  const { validos, excluidos } = getComparableClients(rows, {
    representativeId,
    categoria,
    periodoLabel,
  });

  if (!validos.length) {
    return {
      ...base,
      excluidos,
      motivo: "sem_base",
      mensagem:
        "Não foi possível formar a base de comparação. Não foram encontrados clientes válidos da mesma categoria, representante e período.",
    };
  }

  const soCliente = validos.length === 1;
  const familias = calculateClientDifferences(cliente, validos);
  const mediaGeral = soCliente ? null : calculateCategoryAverageIncludingClient(validos);
  const mediaGeralSemCliente = calculateCategoryAverageExcludingClient(validos, cliente);
  const clienteGeral = generalPercent(cliente);
  const diffGeralPp =
    clienteGeral != null && mediaGeral != null ? clienteGeral - mediaGeral : null;

  const withDiff = familias.filter((f) => f.diffPp != null);
  const todasAcima = withDiff.length > 0 && withDiff.every((f) => (f.diffPp as number) > 0);
  const todasAbaixo = withDiff.length > 0 && withDiff.every((f) => (f.diffPp as number) < 0);
  const todasIguais =
    withDiff.length > 0 && withDiff.every((f) => Math.abs(round1(f.diffPp as number)) < 0.05);

  let maiorVantagem = getLargestAdvantage(familias);
  let maiorLacuna = getLargestGap(familias);
  let destaquesMensagem: string | null = null;
  if (todasIguais) {
    maiorVantagem = null;
    maiorLacuna = null;
    destaquesMensagem = "Desempenho alinhado à média em todas as famílias.";
  } else if (todasAcima) {
    // Não existe lacuna: o segundo card vira "Ponto de menor diferenciação".
    destaquesMensagem = "Ponto de menor diferenciação";
  } else if (todasAbaixo) {
    // Não existe vantagem: o primeiro card vira "Resultado mais próximo da média".
    destaquesMensagem = "Resultado mais próximo da média";
  }

  return {
    ok: true,
    categoria,
    periodoLabel,
    baseSize: validos.length,
    excluidos,
    soCliente,
    clienteGeral,
    mediaGeral,
    mediaGeralSemCliente,
    diffGeralPp,
    situacaoGeral: situacaoFromDiff(diffGeralPp),
    posicao: calculateClientRanking(cliente, validos),
    familias,
    maiorVantagem,
    maiorLacuna,
    destaquesMensagem,
    farol: calculateProfileFarolDistribution(cliente, validos),
    leituraExecutiva: generateExecutiveComparisonText({
      categoria,
      representante,
      periodoLabel,
      clienteGeral,
      mediaGeral,
      diffGeralPp,
      maiorVantagem: todasAbaixo || todasIguais ? null : getLargestAdvantage(familias),
      maiorLacuna: todasAcima || todasIguais ? null : getLargestGap(familias),
      soCliente,
    }),
  };
}
