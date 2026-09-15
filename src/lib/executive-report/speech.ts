import {
  formatVisitDate,
  isCompactLayout,
  isCompactV2,
  type ExecutiveReportData,
} from "./types";

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

  push(`${data.report_title || "Relatório Executivo"}. Cliente ${data.client.display_name}.`);
  const meta = [
    data.client.visit_date ? `Visita em ${formatVisitDate(data.client.visit_date)}` : null,
    data.client.representative ? `Representante ${data.client.representative}` : null,
    data.client.consultant ? `Consultor ${data.client.consultant}` : null,
  ].filter(Boolean);
  if (meta.length) push(`${meta.join(". ")}.`);

  push("Capítulo um. Briefing executivo.");
  if (data.brands_observed?.length) push(`Marcas observadas: ${data.brands_observed.join(", ")}.`);

  push("Capítulo dois. Leitura executiva.");
  if (isCompactLayout(data)) {
    push(data.executive_summary);
    for (const t of data.executive_topics ?? []) {
      push(`${t.title}.`);
      for (const b of t.bullets ?? []) push(b);
    }
  } else {
    for (const p of String(data.executive_reading ?? "").split(/\n{2,}/)) push(p);
  }

  const v2 = isCompactV2(data);
  if (v2) {
    push("Capítulo três. Evidências e recomendações.");
    (data.evidence_recommendations ?? []).forEach((e) => {
      push(`${e.title}.`);
      if (e.perception) push(`Percepção. ${e.perception}`);
      if (e.evidence?.quote) {
        const autor = [e.evidence.author, e.evidence.role].filter(Boolean).join(", ");
        push(`Citação${autor ? ` de ${autor}` : ""}. ${e.evidence.quote}`);
      }
      if (e.opportunity) push(`Oportunidade. ${e.opportunity}`);
    });
    push("Capítulo quatro. Ações sugeridas.");
    for (const a of data.actions.slice(0, 3)) {
      push(`${a.title}.${a.description ? ` ${a.description}` : ""}`);
    }
  }

  if (!v2) {
  push("Capítulo três. Do diagnóstico à ação.");
  data.decision_blocks.forEach((b, i) => {
    push(`Diagnóstico ${i + 1}. ${b.title}.`);
    if (isCompactLayout(data)) {
      push(b.fact || b.cause);
    } else {
      if (b.cause) push(`Causa. ${b.cause}`);
      if (b.impact) push(`Impacto. ${b.impact}`);
    }
    if (b.evidence?.quote) {
      const autor = [b.evidence.author, b.evidence.role].filter(Boolean).join(", ");
      push(`Depoimento${autor ? ` de ${autor}` : ""}. ${b.evidence.quote}`);
    }
    for (const id of b.action_ids) {
      const a = data.actions.find((x) => x.id === id);
      if (a) push(`Ação. ${a.title}.${a.description ? ` ${a.description}` : ""}`);
    }
  });
  }

  if (data.do_not_prioritize?.length) {
    push(`Capítulo ${v2 ? "cinco" : "quatro"}. Onde não concentrar energia agora.`);
    for (const n of data.do_not_prioritize) {
      push(n.title);
      if (n.cause) push(`Causa. ${n.cause}`);
      if (n.decision) push(`Decisão recomendada. ${n.decision}`);
    }
  }

  push("Fim do relatório.");
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
