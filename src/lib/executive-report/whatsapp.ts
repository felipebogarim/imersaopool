import {
  formatVisitDate,
  isCompactLayout,
  isCompactV2,
  type ExecutiveReportData,
} from "./types";

export interface FormatWhatsappOptions {
  appUrl?: string;
  immersionReportId?: string;
  introMessage?: string;
}

/** Formata um número de telefone para o padrão internacional do WhatsApp (ex: 5511999999999). */
export function formatWhatsappPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  // Se tem 10 ou 11 dígitos (DDD + número brasileiro sem código do país), prefixa 55
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  return digits;
}

/** Gera a URL do WhatsApp Web pronta para abertura no navegador. */
export function buildWhatsappWebUrl(text: string, phone?: string): string {
  const encodedText = encodeURIComponent(text);
  const cleanPhone = phone ? formatWhatsappPhone(phone) : "";
  if (cleanPhone) {
    return `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  }
  return `https://web.whatsapp.com/send?text=${encodedText}`;
}

/** Gera a URL nativa do WhatsApp Desktop instalado no Mac / Windows (protocolo whatsapp://). */
export function buildWhatsappDesktopUrl(text: string, phone?: string): string {
  const encodedText = encodeURIComponent(text);
  const cleanPhone = phone ? formatWhatsappPhone(phone) : "";
  if (cleanPhone) {
    return `whatsapp://send?phone=${cleanPhone}&text=${encodedText}`;
  }
  return `whatsapp://send?text=${encodedText}`;
}

/** Gera a URL da API do WhatsApp com direcionamento inteligente para aplicativo desktop e web. */
export function buildWhatsappApiUrl(text: string, phone?: string): string {
  const encodedText = encodeURIComponent(text);
  const cleanPhone = phone ? formatWhatsappPhone(phone) : "";
  if (cleanPhone) {
    return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
  }
  return `https://api.whatsapp.com/send?text=${encodedText}`;
}

/** Gera a URL do WhatsApp universal (wa.me) como alternativa mobile. */
export function buildWhatsappUniversalUrl(text: string, phone?: string): string {
  const encodedText = encodeURIComponent(text);
  const cleanPhone = phone ? formatWhatsappPhone(phone) : "";
  if (cleanPhone) {
    return `https://wa.me/${cleanPhone}?text=${encodedText}`;
  }
  return `https://wa.me/?text=${encodedText}`;
}

const DIVIDER = "━━━━━━━━━━━━━━━━━━━━━";

/**
 * Formata os dados do Relatório Executivo de Imersão em mensagem
 * textual com markdown otimizado para WhatsApp (negritos, tópicos, divisores e emojis).
 */
export function formatExecutiveReportForWhatsapp(
  data: ExecutiveReportData,
  options: FormatWhatsappOptions = {}
): string {
  const r = data;
  const compact = isCompactLayout(r);
  const v2 = isCompactV2(r);
  const company = (r.companyName || "Newline").toUpperCase();
  const client = r.client?.display_name || "Cliente";

  const lines: string[] = [];

  // 1. Cabeçalho Principal (sem emojis)
  lines.push(`*RELATÓRIO EXECUTIVO DE IMERSÃO*`);
  lines.push(`*${company}* · ${client}`);

  // Mensagem introdutória personalizada (se houver)
  if (options.introMessage && options.introMessage.trim()) {
    lines.push("");
    lines.push(options.introMessage.trim());
  }

  // 2. Dados do Briefing (diretos, sem cabeçalho nem divisória antes)
  const briefingLines: string[] = [];
  if (r.client?.trade_name) {
    briefingLines.push(`• *Nome fantasia:* ${r.client.trade_name}`);
  }
  if (r.client?.visit_date) {
    briefingLines.push(`• *Data:* ${formatVisitDate(r.client.visit_date)}`);
  }
  if (r.client?.location) {
    briefingLines.push(`• *Local:* ${r.client.location}`);
  }
  if (r.client?.representative) {
    briefingLines.push(`• *Representante:* ${r.client.representative}`);
  }
  if (r.client?.category) {
    briefingLines.push(`• *Categoria comercial:* ${r.client.category}`);
  }

  if (briefingLines.length > 0) {
    lines.push("");
    lines.push(...briefingLines);
  }

  // 3. Leitura Executiva / Síntese
  lines.push("");
  lines.push(DIVIDER);
  lines.push(`*LEITURA EXECUTIVA*`);

  if (compact) {
    if (r.executive_summary?.trim()) {
      lines.push(r.executive_summary.trim());
    }
    if ((r.executive_topics ?? []).length > 0) {
      for (const topic of r.executive_topics ?? []) {
        lines.push("");
        lines.push(`*${topic.title}*`);
        for (const b of topic.bullets) {
          lines.push(`  • ${b}`);
        }
      }
    }
  } else if (r.executive_reading?.trim()) {
    const paragraphs = r.executive_reading
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);

    for (const p of paragraphs) {
      if (/^#{1,6}\s/.test(p)) {
        const title = p.replace(/^#{1,6}\s*/, "").replace(/\*\*/g, "").trim();
        lines.push("");
        lines.push(`*${title}*`);
      } else {
        lines.push(p.replace(/\*\*/g, "*"));
      }
    }
  } else {
    lines.push("—");
  }

  // 4. Evidências e Recomendações (compact_v2) ou Blocos de Decisão
  if (v2 && (r.evidence_recommendations ?? []).length > 0) {
    lines.push("");
    lines.push(DIVIDER);
    lines.push(`*EVIDÊNCIAS & RECOMENDAÇÕES*`);

    r.evidence_recommendations?.forEach((item, idx) => {
      lines.push("");
      lines.push(`${idx + 1}. *${item.title}*`);
      if (item.perception?.trim()) {
        lines.push(`_Percepção:_ ${item.perception.trim()}`);
      }
      if (item.evidence?.quote?.trim()) {
        const author = item.evidence.author
          ? ` (${item.evidence.author}${item.evidence.role ? ` · ${item.evidence.role}` : ""})`
          : "";
        lines.push(` _Evidência:_ "${item.evidence.quote.trim()}"${author}`);
      }
      if (item.opportunity?.trim()) {
        lines.push(` _Oportunidade:_ ${item.opportunity.trim()}`);
      }
    });
  } else if (!v2 && (r.decision_blocks ?? []).length > 0) {
    lines.push("");
    lines.push(DIVIDER);
    lines.push(`*DIAGNÓSTICO E DECISÃO*`);

    r.decision_blocks.forEach((block, idx) => {
      lines.push("");
      lines.push(`${idx + 1}. *${block.title}*`);
      if (block.fact?.trim()) {
        lines.push(`   _Fato:_ ${block.fact.trim()}`);
      }
      if (block.cause?.trim()) {
        lines.push(`   _Causa:_ ${block.cause.trim()}`);
      }
      if (block.impact?.trim()) {
        lines.push(`   _Impacto:_ ${block.impact.trim()}`);
      }
      if (block.evidence?.quote?.trim()) {
        lines.push(`   _Evidência:_ "${block.evidence.quote.trim()}"`);
      }
    });
  }

  // 5. Rodapé com Link do Gráfico em Destaque (abre imagem com zoom sem acessar o sistema)
  const baseUrl = options.appUrl || "https://poolflux.app";
  const reportId = options.immersionReportId || r.immersion_report_id || r.id;
  if (reportId) {
    lines.push("");
    lines.push(DIVIDER);
    lines.push(`*Gráfico em alta resolução (abrir e dar zoom):*`);
    lines.push(`${baseUrl.replace(/\/+$/, "")}/grafico/${reportId}`);
  }

  return lines.join("\n");
}
