import { formatVisitDate, isCompactLayout, isCompactV2, type ExecutiveReportData } from "./types";

/**
 * Monta o roteiro de leitura em voz alta do relatório executivo, capítulo a
 * capítulo. Cada item da lista é lido separadamente, criando pausas naturais.
 */
export function buildSpeechScript(data: ExecutiveReportData): string[] {
  const parts: string[] = [];
  const push = (s?: string | null) => {
    const t = String(s ?? "")
      .replace(/[*_#>`]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (t) parts.push(t);
  };

  const company = data.companyName ? `${data.companyName.trim()}. ` : "";
  const clientDisplay = data.client?.display_name || "Cliente";
  push(`Relatório Executivo de Imersão. ${company}${clientDisplay}.`);

  const briefing: string[] = [];
  if (data.client?.trade_name) {
    briefing.push(`Nome fantasia: ${data.client.trade_name}.`);
  }
  if (data.client?.visit_date) {
    briefing.push(`Data: ${formatVisitDate(data.client.visit_date)}.`);
  }
  if (data.client?.location) {
    briefing.push(`Local: ${data.client.location}.`);
  }
  if (data.client?.representative) {
    briefing.push(`Representante: ${data.client.representative}.`);
  }
  if (data.client?.category) {
    briefing.push(`Categoria comercial: ${data.client.category}.`);
  }

  if (briefing.length) {
    push("Briefing executivo.");
    for (const b of briefing) push(b);
  }

  push("Leitura executiva.");
  if (isCompactLayout(data)) {
    if (data.executive_summary?.trim()) push(data.executive_summary.trim());
    for (const t of data.executive_topics ?? []) {
      if (t.title?.trim()) push(`${t.title.trim()}.`);
      for (const b of t.bullets ?? []) {
        if (b?.trim()) push(b.trim());
      }
    }
  } else if (data.executive_reading?.trim()) {
    for (const p of data.executive_reading.split(/\n{2,}/)) {
      if (p?.trim()) push(p.trim());
    }
  }

  const v2 = isCompactV2(data);
  if (v2 && (data.evidence_recommendations ?? []).length > 0) {
    push("Evidências e recomendações.");
    (data.evidence_recommendations ?? []).forEach((e, idx) => {
      push(`${idx + 1}. ${e.title}.`);
      if (e.perception?.trim()) push(`Percepção. ${e.perception.trim()}`);
      if (e.evidence?.quote?.trim()) {
        const autor = [e.evidence.author?.trim(), e.evidence.role?.trim()]
          .filter(Boolean)
          .join(", ");
        push(`Evidência${autor ? ` de ${autor}` : ""}. "${e.evidence.quote.trim()}"`);
      }
      if (e.opportunity?.trim()) push(`Oportunidade. ${e.opportunity.trim()}`);
    });
  } else if (!v2 && (data.decision_blocks ?? []).length > 0) {
    push("Diagnóstico e decisão.");
    data.decision_blocks.forEach((b, idx) => {
      push(`${idx + 1}. ${b.title}.`);
      if (b.fact?.trim()) push(`Fato. ${b.fact.trim()}`);
      if (b.cause?.trim()) push(`Causa. ${b.cause.trim()}`);
      if (b.impact?.trim()) push(`Impacto. ${b.impact.trim()}`);
      if (b.evidence?.quote?.trim()) {
        const autor = [b.evidence.author?.trim(), b.evidence.role?.trim()]
          .filter(Boolean)
          .join(", ");
        push(`Evidência${autor ? ` de ${autor}` : ""}. "${b.evidence.quote.trim()}"`);
      }
    });
  }

  const companyName = data.companyName?.trim() || "Newline";
  push(
    `Este foi um resumo da imersão em campo. Acesse o relatório completo e áudio na plataforma na Imersão Comercial ${companyName}.`
  );

  return chunkScript(parts);
}

/** Agrupa os trechos respeitando o limite de caracteres por requisição. */
function chunkScript(parts: string[], maxChars = 1800): string[] {
  const out: string[] = [];
  let cur = "";
  for (const p of parts) {
    const piece = p.length > maxChars ? p.slice(0, maxChars) : p;
    if (cur && cur.length + piece.length + 2 > maxChars) {
      out.push(cur);
      cur = "";
    }
    cur = cur ? `${cur}\n\n${piece}` : piece;
  }
  if (cur) out.push(cur);
  return out;
}
