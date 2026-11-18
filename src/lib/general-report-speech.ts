import type { GeneralReportContent, ReportBlock } from "./general-report-lib";

const MAX_CHUNK = 4000;
const clean = (s?: string | null) =>
  String(s ?? "")
    .replace(/[*_#>`|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
const num = (v: unknown) =>
  typeof v === "number"
    ? v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
    : clean(String(v ?? ""));
const sentence = (s: string) => (/[.!?:]$/.test(s) ? s : `${s}.`);

/** Quadros e gráficos viram um resumo curto e falado (destaques), nunca a leitura de todos os dados. */
function blockSpeech(b: ReportBlock): string {
  switch (b.type) {
    case "text":
      return clean(b.text);
    case "bullets":
      return [b.title ? sentence(clean(b.title)) : "", ...b.items.map((i) => sentence(clean(i)))]
        .filter(Boolean)
        .join(" ");
    case "kpis":
      return `Indicadores. ${b.items.map((k) => `${clean(k.label)}: ${clean(k.value)}`).join(". ")}.`;
    case "chart": {
      const s = b.series[0];
      const top = [...b.data].sort((a, c) => Number(c[s]) - Number(a[s])).slice(0, 3);
      const parts = [`Gráfico: ${clean(b.title)}.`];
      if (top.length) {
        parts.push(
          `Em destaque: ${top.map((d) => `${clean(String(d[b.x]))}, com ${num(d[s])}`).join("; ")}.`,
        );
      }
      if (b.insight) parts.push(sentence(clean(b.insight)));
      return parts.join(" ");
    }
    case "table": {
      const first = b.rows[0] ? `Por exemplo: ${b.rows[0].map(clean).join(", ")}.` : "";
      return `Quadro${b.title ? `: ${clean(b.title)}` : ""}, com ${b.rows.length} ${
        b.rows.length === 1 ? "linha" : "linhas"
      } sobre ${b.columns.map(clean).join(", ")}. ${first}`.trim();
    }
    case "image":
      return [
        b.caption ? `Imagem: ${sentence(clean(b.caption))}` : "Imagem.",
        ...b.observations.slice(0, 2).map((o) => sentence(clean(o))),
      ].join(" ");
    case "callout": {
      const label =
        b.tone === "atencao" ? "Atenção" : b.tone === "oportunidade" ? "Oportunidade" : "Destaque";
      return `${label}. ${clean(b.text)}`;
    }
  }
}

function split(text: string): string[] {
  if (text.length <= MAX_CHUNK) return [text];
  const out: string[] = [];
  let cur = "";
  for (const s of text.split(/(?<=[.!?])\s+/)) {
    if ((cur + " " + s).length > MAX_CHUNK && cur) {
      out.push(cur);
      cur = s;
    } else cur = cur ? `${cur} ${s}` : s;
  }
  if (cur) out.push(cur);
  return out.flatMap((c) =>
    c.length > MAX_CHUNK ? (c.match(new RegExp(`.{1,${MAX_CHUNK}}`, "g")) ?? []) : [c],
  );
}

/** Roteiro de leitura em voz alta do Relatório Geral: um trecho por bloco, com pausas entre eles. */
export function buildGeneralSpeechScript(
  r: GeneralReportContent,
  o: { representative?: string; dateLabel?: string } = {},
): string[] {
  const parts: string[] = [];
  const push = (s?: string | null) => {
    const t = clean(s);
    if (t) parts.push(...split(t));
  };
  push(`${sentence(clean(r.title))} ${[o.representative, o.dateLabel].filter(Boolean).join(", ")}`);
  push(r.subtitle);
  push(r.executive_summary);
  r.chapters.forEach((ch, i) => {
    push(`Capítulo ${i + 1}. ${sentence(clean(ch.title))} ${clean(ch.summary)}`);
    for (const b of ch.blocks) push(blockSpeech(b));
  });
  if (r.gaps?.length)
    push(`Limitações do material. ${r.gaps.map((g) => sentence(clean(g))).join(" ")}`);
  return parts;
}
