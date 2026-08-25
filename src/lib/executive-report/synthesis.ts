// Síntese estratégica na íntegra, vinda do relatório de Imersão em Campo
// (bloco visao_imersao_2_data_v1). Usada como "Leitura executiva" do
// Relatório Executivo, com o mesmo texto exibido na Visão Imersão 2.

type RawSignal = {
  id?: string;
  title?: string;
  conclusion?: string;
  business_impact?: string;
  confidence?: string;
};

function clean(v: unknown): string {
  if (v == null) return "";
  return String(v)
    .replace(/<[^>]*>/g, "")
    .replace(/\u0000/g, "")
    .trim();
}

/**
 * Monta o texto completo da síntese estratégica em markdown leve:
 * título do sinal + conclusão + impacto no negócio.
 */
export function buildExecutiveReadingFromImmersion(structuredData: unknown): string {
  const root: any = structuredData ?? {};
  const data: any = root?.data ?? root;
  const signals: RawSignal[] = Array.isArray(data?.signals) ? data.signals : [];
  if (!signals.length) return "";

  const parts: string[] = [];
  for (const s of signals) {
    const title = clean(s?.title);
    const conclusion = clean(s?.conclusion);
    const impact = clean(s?.business_impact);
    if (!conclusion && !impact && !title) continue;
    const block: string[] = [];
    if (title) block.push(`### ${title}`);
    if (conclusion) block.push(conclusion);
    if (impact) block.push(`**O que isso gera:** ${impact}`);
    parts.push(block.join("\n\n"));
  }
  return parts.join("\n\n");
}
