// Identificação de linhas que NUNCA podem ser tratadas como cliente
// (totais, subtotais, somatórios, médias, legendas, observações e rodapés).
// Espelha a função SQL public.is_total_row para manter parser e banco coerentes.

const normalizeName = (v: unknown): string =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[.:;\-]+$/, "")
    .trim()
    .toUpperCase();

const EXACT = new Set([
  "TOTAL",
  "TOTAL GERAL",
  "TOTAL GERAL DA META",
  "TOTAL GERAL META",
  "TOTAL DA META",
  "TOTAL META",
  "TOTAIS",
  "SOMA",
  "SOMATORIO",
  "SUBTOTAL",
  "SUB TOTAL",
  "TOTAL DA CARTEIRA",
  "TOTAL CARTEIRA",
  "TOTAL DO REPRESENTANTE",
  "MEDIA",
  "MEDIA GERAL",
  "LEGENDA",
  "OBSERVACAO",
  "OBSERVACOES",
  "FAIXA",
  "FAIXA %",
]);

const PREFIX =
  /^(TOTAL|SUBTOTAL|SUB TOTAL|SOMA|SOMATORIO|MEDIA)( |$)|^(PARTICIPACAO|ATINGIMENTO|ESTIMATIVA|LEGENDA|OBSERVAC)/;

/** true quando a razão social indica linha de totalização/legenda (não é cliente). */
export function isTotalRowName(razaoSocial: unknown): boolean {
  const v = normalizeName(razaoSocial);
  if (!v) return true;
  if (EXACT.has(v)) return true;
  return PREFIX.test(v);
}

const INVALID_CAT = new Set(["", "NONE", "NULL", "NAN", "-", "UNDEFINED"]);

/** Linha só é cliente se tiver razão social válida e categoria explicitamente preenchida. */
export function isClientRow(row: { razao_social?: unknown; categoria?: unknown }): boolean {
  if (isTotalRowName(row?.razao_social)) return false;
  const cat = String(row?.categoria ?? "").trim().toUpperCase();
  return !INVALID_CAT.has(cat);
}

export type IgnoredRow = { razao_social: string; motivo: string };

/** Separa clientes válidos das linhas ignoradas (com motivo, para auditoria/pré-visualização). */
export function splitClientRows<T extends { razao_social?: unknown; categoria?: unknown }>(
  rows: T[],
): { clientes: T[]; ignoradas: IgnoredRow[] } {
  const clientes: T[] = [];
  const ignoradas: IgnoredRow[] = [];
  for (const r of rows ?? []) {
    const nome = String(r?.razao_social ?? "").trim();
    if (isTotalRowName(nome)) {
      ignoradas.push({ razao_social: nome, motivo: nome ? "Linha de totalização/legenda" : "Razão social vazia" });
      continue;
    }
    if (!isClientRow(r)) {
      ignoradas.push({ razao_social: nome, motivo: "Categoria ausente ou inválida" });
      continue;
    }
    clientes.push(r);
  }
  return { clientes, ignoradas };
}
