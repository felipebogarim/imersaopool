// Importador EXCLUSIVO do Relatório Executivo.
// Reconhece somente o bloco ```relatorio_executivo_imersao com
// schema executive_field_visit_report_v1. Sem fallback para outros
// importadores do sistema.

import {
  AREAS,
  COMPACT_LAYOUT,
  COMPACT_LAYOUT_V2,
  COMPACT_V2_MAX_ACTIONS,
  PRIORITIES,
  STATUSES,
  type ExecArea,
  type ExecPriority,
  type ExecStatus,
  type ExecutiveAction,
  type ExecutiveDecisionBlock,
  type ExecutiveEvidenceRecommendation,
  type ExecutiveNonPriority,
  type ExecutiveReportData,
  type ExecutiveTopic,
} from "./types";

export const EXECUTIVE_BLOCK = "relatorio_executivo_imersao";
export const EXECUTIVE_SCHEMA = "executive_field_visit_report_v1";

export class ExecutiveParseError extends Error {}

const BLOCK_RE = new RegExp("```\\s*" + EXECUTIVE_BLOCK + "\\s*\\r?\\n([\\s\\S]*?)```", "i");

/** Remove qualquer marcação HTML: o arquivo traz dados, nunca HTML executável. */
function sanitize(value: unknown): string {
  if (value == null) return "";
  const s = String(value);
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/\u0000/g, "")
    .trim();
}

function sanitizeList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => sanitize(v)).filter(Boolean);
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  const v = sanitize(value).toLowerCase();
  return (allowed as readonly string[]).includes(v) ? (v as T) : fallback;
}

export function parseExecutiveReportFile(raw: string): ExecutiveReportData {
  const match = raw.match(BLOCK_RE);
  if (!match) {
    throw new ExecutiveParseError(
      `Bloco \`${EXECUTIVE_BLOCK}\` não encontrado no arquivo. Este importador é exclusivo do Relatório Executivo e não aceita arquivos da Visão Imersão 2, de visitas de loja ou de entrevistas.`,
    );
  }

  let json: any;
  try {
    json = JSON.parse(match[1]);
  } catch (err) {
    throw new ExecutiveParseError(
      `O bloco \`${EXECUTIVE_BLOCK}\` não contém um JSON válido: ${
        err instanceof Error ? err.message : "erro de leitura"
      }`,
    );
  }

  const schema = sanitize(json.schema);
  if (schema !== EXECUTIVE_SCHEMA) {
    throw new ExecutiveParseError(
      `Schema não reconhecido: "${schema || "ausente"}". Esperado "${EXECUTIVE_SCHEMA}".`,
    );
  }

  const rawActions: any[] = Array.isArray(json.actions) ? json.actions : [];
  const actions: ExecutiveAction[] = rawActions.map((a, i) => {
    const id = sanitize(a?.id) || `acao-${i + 1}`;
    return {
      id,
      source_decision_id: sanitize(a?.source_decision_id) || null,
      area: pick<ExecArea>(a?.area, AREAS, "commercial"),
      priority: pick<ExecPriority>(a?.priority, PRIORITIES, "medium"),
      title: sanitize(a?.title) || `Ação ${i + 1}`,
      description: sanitize(a?.description) || null,
      status: pick<ExecStatus>(a?.status, STATUSES, "suggested"),
      owner: sanitize(a?.owner) || null,
      due_date: sanitize(a?.due_date) || null,
      note: sanitize(a?.note) || null,
      source_opportunity_ids: sanitizeList(a?.source_opportunity_ids),
      reject_reason: null,
      history: [],
      ordem: i,
    };
  });

  const knownIds = new Set(actions.map((a) => a.id));

  const layout_version = sanitize(json.layout_version) || null;
  const compactV2 = layout_version === COMPACT_LAYOUT_V2;
  const compact = layout_version === COMPACT_LAYOUT;

  const rawER: any[] = Array.isArray(json.evidence_recommendations)
    ? json.evidence_recommendations
    : [];
  const evidence_recommendations: ExecutiveEvidenceRecommendation[] = rawER
    .map((e, i) => {
      const ev = e?.evidence;
      const quote = sanitize(ev?.quote ?? ev?.text);
      return {
        id: sanitize(e?.id) || `ER${String(i + 1).padStart(2, "0")}`,
        order: Number.isFinite(Number(e?.order)) ? Number(e.order) : i + 1,
        title: sanitize(e?.title) || `Evidência ${i + 1}`,
        perception: sanitize(e?.perception ?? e?.percepcao) || null,
        evidence: quote
          ? {
              quote,
              author: sanitize(ev?.author) || null,
              role: sanitize(ev?.author_role ?? ev?.role) || null,
            }
          : null,
        opportunity: sanitize(e?.opportunity ?? e?.oportunidade) || null,
      };
    })
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (compactV2) {
    if (actions.length > COMPACT_V2_MAX_ACTIONS) {
      throw new ExecutiveParseError(
        `No modelo compact_v2 são aceitas no máximo ${COMPACT_V2_MAX_ACTIONS} ações sugeridas. O arquivo trouxe ${actions.length}.`,
      );
    }
    for (const a of actions) a.status = "suggested";
  }

  const rawBlocks: any[] = Array.isArray(json.decision_blocks) ? json.decision_blocks : [];
  const decision_blocks: ExecutiveDecisionBlock[] = rawBlocks.map((b, i) => {
    const id = sanitize(b?.id) || `decisao-${i + 1}`;
    const declared = sanitizeList(b?.action_ids).filter((x) => knownIds.has(x));
    const derived = actions.filter((a) => a.source_decision_id === id).map((a) => a.id);
    // União: nenhuma ação do arquivo pode ficar de fora do relatório.
    const action_ids = Array.from(new Set([...declared, ...derived]));
    const ev = b?.evidence;
    return {
      id,
      title: sanitize(b?.title) || `Decisão ${i + 1}`,
      cause: sanitize(b?.cause ?? b?.causa),
      impact: sanitize(b?.impact ?? b?.what_it_generates ?? b?.impacto),
      fact: sanitize(b?.fact ?? b?.fato) || null,
      order: Number.isFinite(Number(b?.order)) ? Number(b.order) : i + 1,
      evidence:
        ev && sanitize(ev.quote ?? ev.text)
          ? {
              quote: sanitize(ev.quote ?? ev.text),
              author: sanitize(ev.author) || null,
              role: sanitize(ev.role ?? ev.author_role) || null,
            }
          : null,
      action_ids,
    };
  });

  if (compact) {
    decision_blocks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const invalid = decision_blocks.filter((b) => b.action_ids.length !== 1);
    if (invalid.length) {
      throw new ExecutiveParseError(
        `No modelo compacto cada diagnóstico deve ter exatamente 1 ação vinculada. Verifique: ${invalid
          .map((b) => b.id)
          .join(", ")}.`,
      );
    }
    const linked = new Set(decision_blocks.flatMap((b) => b.action_ids));
    const orphans = actions.filter((a) => !linked.has(a.id));
    if (orphans.length) {
      throw new ExecutiveParseError(
        `Todas as ações devem estar vinculadas a um diagnóstico. Sem vínculo: ${orphans
          .map((a) => a.id)
          .join(", ")}.`,
      );
    }
  }

  const executive_summary = sanitize(json.executive_summary) || null;
  const rawTopics: any[] = Array.isArray(json.executive_topics) ? json.executive_topics : [];
  const executive_topics: ExecutiveTopic[] = rawTopics
    .map((t) => ({ title: sanitize(t?.title), bullets: sanitizeList(t?.bullets) }))
    .filter((t) => t.title || t.bullets.length);

  if ((compact || compactV2) && !executive_summary) {
    throw new ExecutiveParseError(
      "No modelo compacto o campo `executive_summary` é obrigatório (até duas frases).",
    );
  }

  const rawNon: any[] = Array.isArray(json.do_not_prioritize) ? json.do_not_prioritize : [];
  const do_not_prioritize: ExecutiveNonPriority[] = rawNon.map((n, i) => ({
    id: sanitize(n?.id) || `nao-prioridade-${i + 1}`,
    title: sanitize(n?.title ?? n?.subject) || `Item ${i + 1}`,
    cause: sanitize(n?.cause ?? n?.causa) || null,
    decision: sanitize(n?.decision ?? n?.recommended_decision ?? n?.decisao) || null,
  }));

  if (!decision_blocks.length && !actions.length && !evidence_recommendations.length) {
    throw new ExecutiveParseError(
      "O arquivo foi reconhecido, mas não contém decisões nem ações. Verifique os campos `decision_blocks`, `evidence_recommendations` e `actions`.",
    );
  }

  const client = json.client ?? {};

  return {
    status: "review",
    report_title: sanitize(json.report_title) || "Relatório Executivo",
    source_schema: schema,
    client: {
      display_name: sanitize(client.display_name ?? client.name),
      visit_date: sanitize(client.visit_date) || null,
      location: sanitize(client.location) || null,
      representative: sanitize(client.representative) || null,
      consultant: sanitize(client.consultant) || null,
      category: sanitize(client.category) || null,
      attainment: sanitize(client.attainment) || null,
    },
    executive_reading: sanitize(json.executive_reading),
    layout_version,
    executive_summary,
    executive_topics,
    evidence_recommendations,
    brands_observed: sanitizeList(json.brands_observed),
    decision_blocks,
    do_not_prioritize,
    actions,
    email: {
      subject: sanitize(json.email?.subject) || null,
      intro: sanitize(json.email?.intro ?? json.email?.message) || null,
    },
    current_version: 0,
  };
}
