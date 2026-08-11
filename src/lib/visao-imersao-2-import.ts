// Importador EXCLUSIVO da Visão Imersão 2.
// Não importa, não chama e não depende de field_store_visit_v1 nem do
// adaptador da Visão Imersão antiga. Fluxo: upload -> parser V2 -> validação
// V2 -> view-model V2.
import { Immersion2DataSchema, validateSignalV2, type Immersion2Data } from "./visao-imersao-2-parser";
import { emptyVisaoRep2, type VisaoRep2, type PrioritySignal } from "./visao-rep2-schema";
import { buildBrandPositioningFromImmersion2 } from "./visao-imersao-2-teia-scores";

export const V2_INCOMPATIBLE_MESSAGE = "Arquivo incompatível com Visão Imersão 2.";

/**
 * Procura EXCLUSIVAMENTE o fenced block ```visao_imersao_2 e valida o
 * contrato canônico. Nenhum fallback para formatos legados.
 */
export function parseVisaoImersao2File(text: string): Immersion2Data {
  const raw = String(text ?? "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const fence = /```[ \t]*(?:json[ \t]+)?visao_imersao_2[^\n]*\n([\s\S]*?)```/gi;

  for (const m of Array.from(raw.matchAll(fence))) {
    let body = m[1].replace(/^\uFEFF/, "");
    const a = body.indexOf("{");
    const b = body.lastIndexOf("}");
    if (a === -1 || b === -1) continue;
    let parsed: any;
    try {
      parsed = JSON.parse(body.slice(a, b + 1));
    } catch {
      continue;
    }
    const candidate = parsed?.schema === "visao_imersao_2_data_v1" ? parsed : parsed?.visao_imersao_2_data_v1;
    if (!candidate) continue;
    if (candidate.block && candidate.block !== "visao_imersao_2") continue;
    if (candidate.schema !== "visao_imersao_2_data_v1") continue;
    return Immersion2DataSchema.parse(candidate);
  }

  throw new Error(V2_INCOMPATIBLE_MESSAGE);
}

/** Capítulos editoriais: leitura opcional apenas para aprofundamento. */
export type V2Chapter = { codigo: string; titulo: string; markdown: string };

export function extractEditorialChapters(text: string): V2Chapter[] {
  const raw = String(text ?? "").replace(/\r\n/g, "\n");
  const out: V2Chapter[] = [];
  const re = /^##\s+\**\s*(?:C|Cap[ií]tulo)\s*(\d+)\s*\**\s*[—–:.-]?\s*([^\n]*)$/gim;
  const matches = Array.from(raw.matchAll(re));
  matches.forEach((m, i) => {
    const start = (m.index ?? 0) + m[0].length;
    const end = i + 1 < matches.length ? matches[i + 1].index ?? raw.length : raw.length;
    out.push({
      codigo: `C${m[1]}`,
      titulo: m[2].trim().replace(/\*+/g, ""),
      markdown: raw.slice(start, end).trim(),
    });
  });
  return out;
}

/** Monta o view-model executivo APENAS a partir do JSON canônico V2. */
export function buildVisaoImersao2ViewModel(data: Immersion2Data, chapters: V2Chapter[] = []): VisaoRep2 {
  const visao = emptyVisaoRep2({
    schema_version: "3.0",
    view_model: "visao_imersao_2_executiva",
    representative_name: data.client.representative || null,
    client_name: data.client.name,
    region: data.client.location,
    interview_date: data.client.visit_date,
    report_date: new Date().toISOString().split('T')[0],
  });


  visao.representative_context.additional_context = [
    `Cliente: ${data.client.name}`,
    `Local: ${data.client.location}`,
    `Data da visita: ${data.client.visit_date}`,
    data.client.representative ? `Representante: ${data.client.representative}` : null,
    data.client.consultant ? `Consultor: ${data.client.consultant}` : null,
  ].filter(Boolean).join("\n");

  visao.representative_context.represented_brands = data.brands_observed;

  const signalValidations = data.signals.map((signal) => ({ signal, validation: validateSignalV2(signal, data) }));
  const invalidSignal = signalValidations.find(({ validation }) => !validation.isValid);
  if (invalidSignal) {
    throw new Error(`Sinal ${invalidSignal.signal.id} inválido: ${invalidSignal.validation.errors.join(" ")}`);
  }
  const validSignals = signalValidations.map(({ signal }) => signal);

  visao.executive_view.priority_signals = validSignals.map((s) => {
    const evidenceText = s.evidence_quotes
      .map((qid) => {
        const q = data.quotes.find((item) => item.id === qid);
        if (!q) return null;
        const authorInfo = q.reported_by
          ? `${q.original_author} · fala relatada por ${q.reported_by}`
          : `${q.original_author}${q.original_author_role ? ` (${q.original_author_role})` : ""}`;
        return `“${q.text}”\n— ${authorInfo}${q.quote_type === "reported" ? " (fala relatada)" : ""}`;
      })
      .filter(Boolean)
      .join("\n\n");

    const perspectiveIndices = s.perspectives
      .map((pid) => data.perspectives.find((item) => item.id === pid)?.chapter ?? null)
      .filter((idx): idx is number => idx !== null);

    return {
      signal_id: s.id,
      title: s.title,
      finding: s.conclusion,
      business_impact: s.business_impact,
      recommended_action: null,
      confidence_level: s.confidence === "high" ? "alto" : s.confidence === "medium" ? "medio" : "baixo",
      evidence_status: "validado_por_dados",
      source_chapter: "V2_JSON",
      source_quote: evidenceText,
      related_perspectives: perspectiveIndices,
      group_comparison: null,
      comparison_classification: "não abordado",
      appearances: s.appearances?.map(a => ({
        perspective_id: a.perspective_id,
        label: a.label,
        specific_finding: a.specific_finding,
        added_detail: a.added_detail,
        quote_ids: a.quote_ids
      }))
    } as PrioritySignal & { appearances?: any[] };
  });

  visao.chapter_review = data.chapter_review;
  visao.chapter_review_policy = data.chapter_review_policy;


  visao.perspectives = data.perspectives.map((p) => {
    const chapter = chapters.find((c) => c.codigo === `C${p.chapter}`);
    const relatedQuoteIds = new Set(
      validSignals
        .filter((signal) => signal.perspectives.includes(p.id))
        .flatMap((signal) => signal.evidence_quotes),
    );
    const relatedQuotes = data.quotes
      .filter((quote) => relatedQuoteIds.has(quote.id))
      .map((quote) => {
        const author = quote.reported_by
          ? `${quote.original_author} · fala relatada por ${quote.reported_by}`
          : `${quote.original_author}${quote.original_author_role ? ` (${quote.original_author_role})` : ""}`;
        return `“${quote.text}” — ${author}`;
      });
    const relatedSignals = validSignals.filter((signal) => signal.perspectives.includes(p.id));
    return {
      perspective_number: p.chapter,
      perspective_title: p.title,
      executive_finding: relatedSignals.map((signal) => signal.conclusion).join("\n\n") || null,
      business_impact: relatedSignals.map((signal) => signal.business_impact).join("\n\n") || null,
      recommended_action: null,
      evidence: relatedQuotes.join("\n\n") || null,
      source_quote: relatedQuotes.join("\n\n") || null,
      confidence_level: "alto",
      evidence_status: "relato_individual",
      comparative_classification: "Base comparável insuficiente",
      full_reading: chapter?.markdown || null,
      structured_fields: {},
      signal_ids: validSignals.filter((s) => s.perspectives.includes(p.id)).map((s) => s.id),
      source_chapter: `C${p.chapter}`,
    };
  });

  visao.performance_connection = {
    upload_id: null,
    periodo_label: "1º Semestre 2026",
    linked: true,
    geral_pct: 42.9,
    comparativo_grupo_pct: null,
    periodo_referencia: "1º Semestre 2026",
    status_atendimento: null,
    oportunidades_identificadas: [],
    ameacas_identificadas: [],
  };

  visao.executive_brief = {
    presidential_synthesis: validSignals.map((signal) => signal.conclusion).join("\n\n"),
    themes: [],
  };

  if (!visao.brand_positioning) {
    visao.brand_positioning = buildBrandPositioningFromImmersion2(data);
  }

  return visao;
}
