import { splitSummary, type GeneralReportContent } from "./general-report-lib";

export interface GeneralWhatsappOptions {
  representative?: string;
  dateLabel?: string;
  link?: string;
  introMessage?: string;
}

/** Texto do relatório geral no formato do WhatsApp (*negrito*, tópicos), resumido por capítulo. */
export function formatGeneralReportForWhatsapp(
  r: GeneralReportContent,
  o: GeneralWhatsappOptions = {},
): string {
  const out: string[] = [];
  if (o.introMessage?.trim()) out.push(o.introMessage.trim(), "");
  out.push(`*${r.title}*`);
  const meta = [o.representative, o.dateLabel].filter(Boolean).join(" · ");
  if (meta) out.push(`_${meta}_`);
  for (const t of splitSummary(r.executive_summary)) {
    out.push("", `*${t.headline}*`);
    if (t.detail) out.push(t.detail);
  }
  r.chapters.forEach((ch, i) => {
    out.push("", `*${i + 1}. ${ch.title}*`);
    if (ch.summary) out.push(ch.summary);
    for (const b of ch.blocks) {
      if (b.type === "kpis")
        b.items.slice(0, 6).forEach((k) => out.push(`• ${k.label}: *${k.value}*`));
      else if (b.type === "bullets") b.items.slice(0, 5).forEach((it) => out.push(`• ${it}`));
      else if (b.type === "callout") out.push(`➡ ${b.text}`);
      else if (b.type === "chart" && b.insight) out.push(`📊 ${b.title}: ${b.insight}`);
      else if (b.type === "image" && b.caption) out.push(`🖼 ${b.caption}`);
    }
  });
  if (o.link) out.push("", `Relatório completo: ${o.link}`);
  return out.join("\n").trim();
}
