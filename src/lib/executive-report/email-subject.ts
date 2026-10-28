const clean = (v?: string | null) => (v ?? "").trim();

/**
 * Assunto padrão do e-mail do relatório executivo: "Imersão [região] - [representante]".
 * Sem região ou representante, omite o trecho; sem nenhum dos dois devolve `fallback`.
 */
export function buildExecutiveEmailSubject(
  regiao?: string | null,
  representante?: string | null,
  fallback = "Relatório Executivo de Imersão",
): string {
  const reg = clean(regiao);
  const rep = clean(representante);
  if (!reg && !rep) return fallback;
  return `Imersão${reg ? ` ${reg}` : ""}${rep ? ` - ${rep}` : ""}`;
}
