const clean = (v?: string | null) => (v ?? "").trim();

/**
 * Assunto padrão do e-mail do relatório executivo:
 * "[cliente] - Imersão [região] - [representante]".
 * Omite o que faltar; sem nenhum dos três devolve `fallback`.
 */
export function buildExecutiveEmailSubject(
  regiao?: string | null,
  representante?: string | null,
  fallback = "Relatório Executivo de Imersão",
  cliente?: string | null,
): string {
  const cli = clean(cliente);
  const reg = clean(regiao);
  const rep = clean(representante);
  if (!cli && !reg && !rep) return fallback;
  return `${cli ? `${cli} - ` : ""}Imersão${reg ? ` ${reg}` : ""}${rep ? ` - ${rep}` : ""}`;
}
