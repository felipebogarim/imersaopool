// Importador EXCLUSIVO do Relatório Executivo.
// Reconhece somente o bloco ```relatorio_executivo_imersao com
// schema executive_field_visit_report_v1. Sem fallback para outros
// importadores do sistema.

import {
  AREAS,
  PRIORITIES,
  STATUSES,
  type ExecArea,
  type ExecPriority,
  type ExecStatus,
  type ExecutiveAction,
  type ExecutiveDecisionBlock,
  type ExecutiveNonPriority,
  type ExecutiveReportData,
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
      reject_reason: null,
      history: [],
      ordem: i,
    };
  });

  const knownIds = new Set(actions.map((a) => a.id));

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
      evidence:
        ev && sanitize(ev.quote ?? ev.text)
          ? {
              quote: sanitize(ev.quote ?? ev.text),
              author: sanitize(ev.author) || null,
              role: sanitize(ev.role) || null,
            }
          : null,
      action_ids,
    };
  });

  const rawNon: any[] = Array.isArray(json.do_not_prioritize) ? json.do_not_prioritize : [];
  const do_not_prioritize: ExecutiveNonPriority[] = rawNon.map((n, i) => ({
    id: sanitize(n?.id) || `nao-prioridade-${i + 1}`,
    title: sanitize(n?.title ?? n?.subject) || `Item ${i + 1}`,
    cause: sanitize(n?.cause ?? n?.causa) || null,
    decision: sanitize(n?.decision ?? n?.recommended_decision ?? n?.decisao) || null,
  }));

  if (!decision_blocks.length && !actions.length) {
    throw new ExecutiveParseError(
      "O arquivo foi reconhecido, mas não contém decisões nem ações. Verifique os campos `decision_blocks` e `actions`.",
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
