import {
  AREA_LABEL,
  PRIORITY_LABEL,
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

  // 1. Cabeçalho Principal
  lines.push(`📊 *RELATÓRIO EXECUTIVO DE IMERSÃO*`);
  lines.push(`🏢 *${company}* · ${client}`);

  // Mensagem introdutória personalizada (se houver)
  if (options.introMessage && options.introMessage.trim()) {
    lines.push("");
    lines.push(options.introMessage.trim());
  }

  // 2. Briefing Executivo
  lines.push("");
  lines.push(DIVIDER);
  lines.push(`📋 *BRIEFING EXECUTIVO*`);
  if (r.client?.visit_date) {
    lines.push(`• *Data:* ${formatVisitDate(r.client.visit_date)}`);
  }
  if (r.client?.location) {
    lines.push(`• *Local:* ${r.client.location}`);
  }
  if (r.client?.representative) {
    lines.push(`• *Representante:* ${r.client.representative}`);
  }
  if (r.client?.consultant) {
    lines.push(`• *Consultor:* ${r.client.consultant}`);
  }
  if (r.client?.category) {
    lines.push(`• *Categoria comercial:* ${r.client.category}`);
  }
  if (r.client?.attainment) {
    lines.push(`• *Atingimento geral:* ${r.client.attainment}`);
  }
  if ((r.brands_observed ?? []).length > 0) {
    lines.push(`• *Marcas observadas:* ${r.brands_observed.join(" · ")}`);
  }

  // 3. Leitura Executiva / Síntese
  lines.push("");
  lines.push(DIVIDER);
  lines.push(`📖 *LEITURA EXECUTIVA*`);

  if (compact) {
    if (r.executive_summary?.trim()) {
      lines.push(r.executive_summary.trim());
    }
    if ((r.executive_topics ?? []).length > 0) {
      for (const topic of r.executive_topics ?? []) {
        lines.push("");
        lines.push(`📌 *${topic.title}*`);
        for (const b of topic.bullets) {
          lines.push(`  • ${b}`);
        }
      }
    }
  } else if (r.executive_reading?.trim()) {
    // Normaliza markdown clássico (# -> negrito)
    const paragraphs = r.executive_reading
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);

    for (const p of paragraphs) {
      if (/^#{1,6}\s/.test(p)) {
        const title = p.replace(/^#{1,6}\s*/, "").replace(/\*\*/g, "").trim();
        lines.push(`📌 *${title}*`);
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
    lines.push(`💡 *EVIDÊNCIAS & RECOMENDAÇÕES*`);

    r.evidence_recommendations?.forEach((item, idx) => {
      lines.push("");
      lines.push(`${idx + 1}. *${item.title}*`);
      if (item.perception?.trim()) {
        lines.push(`   👁️ _Percepção:_ ${item.perception.trim()}`);
      }
      if (item.evidence?.quote?.trim()) {
        const author = item.evidence.author ? ` (${item.evidence.author}${item.evidence.role ? ` · ${item.evidence.role}` : ""})` : "";
        lines.push(`   💬 _Evidência:_ "${item.evidence.quote.trim()}"${author}`);
      }
      if (item.opportunity?.trim()) {
        lines.push(`   🎯 _Oportunidade:_ ${item.opportunity.trim()}`);
      }
    });
  } else if (!v2 && (r.decision_blocks ?? []).length > 0) {
    lines.push("");
    lines.push(DIVIDER);
    lines.push(`💡 *DIAGNÓSTICO E DECISÃO*`);

    r.decision_blocks.forEach((block, idx) => {
      lines.push("");
      lines.push(`${idx + 1}. *${block.title}*`);
      if (block.fact?.trim()) {
        lines.push(`   • _Fato:_ ${block.fact.trim()}`);
      }
      if (block.cause?.trim()) {
        lines.push(`   • _Causa:_ ${block.cause.trim()}`);
      }
      if (block.impact?.trim()) {
        lines.push(`   • _Impacto:_ ${block.impact.trim()}`);
      }
      if (block.evidence?.quote?.trim()) {
        lines.push(`   • _Evidência:_ "${block.evidence.quote.trim()}"`);
      }
    });
  }

  // 5. O que NÃO priorizar (se houver)
  if ((r.do_not_prioritize ?? []).length > 0) {
    lines.push("");
    lines.push(DIVIDER);
    lines.push(`🚫 *O QUE NÃO PRIORIZAR*`);
    for (const item of r.do_not_prioritize) {
      lines.push(`• *${item.title}*`);
      if (item.cause?.trim()) {
        lines.push(`  _Motivo:_ ${item.cause.trim()}`);
      }
      if (item.decision?.trim()) {
        lines.push(`  _Decisão:_ ${item.decision.trim()}`);
      }
    }
  }

  // 6. Ações Estratégicas / Sugeridas
  const activeActions = (r.actions ?? []).filter((a) => a.status !== "rejected");
  if (activeActions.length > 0) {
    lines.push("");
    lines.push(DIVIDER);
    lines.push(`🎯 *PLANO DE AÇÃO EXECUTIVO (${activeActions.length} ações)*`);

    activeActions.forEach((act, idx) => {
      lines.push("");
      const area = AREA_LABEL[act.area] || act.area;
      const prioridade = PRIORITY_LABEL[act.priority] || act.priority;
      const statusIcon =
        act.status === "validated" ? "✅ Validada" : act.status === "edited" ? "✏️ Editada" : "⏳ Sugerida";

      lines.push(`${idx + 1}. *${act.title}*`);
      lines.push(`   • Área: ${area} | Prioridade: *${prioridade}*`);
      const meta: string[] = [];
      if (act.owner?.trim()) meta.push(`Responsável: ${act.owner.trim()}`);
      if (act.due_date?.trim()) meta.push(`Prazo: ${act.due_date.trim()}`);
      meta.push(`Status: ${statusIcon}`);
      lines.push(`   • ${meta.join(" | ")}`);
      if (act.description?.trim()) {
        lines.push(`   _${act.description.trim()}_`);
      }
    });
  }

  // 7. Rodapé com Link para a Plataforma e Áudio
  const baseUrl = options.appUrl || "https://poolflux.app";
  const reportId = options.immersionReportId || r.immersion_report_id || r.id;
  if (reportId) {
    lines.push("");
    lines.push(DIVIDER);
    lines.push(`🔗 *Acesse o relatório completo e áudio na plataforma:*`);
    lines.push(`${baseUrl.replace(/\/+$/, "")}/visao-imersao-2/${reportId}/executivo`);
  }

  return lines.join("\n");
}
