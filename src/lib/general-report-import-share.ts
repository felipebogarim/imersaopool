// Compartilhamento do relatório IMPORTADO: áudio, e-mail, WhatsApp e imagem de prévia.
// Só formata dados já aprovados; nada é recalculado.
import {
  formatBRL,
  formatPct,
  noteText,
  periodText,
  type ImportedReport,
} from "./general-report-import";
import type { GeneralReportContent, ReportBlock, ReportChapter } from "./general-report-lib";

const MAX_CHUNK = 4000;
const sentence = (s: string) => (/[.!?:]$/.test(s.trim()) ? s.trim() : `${s.trim()}.`);

/** Valor falado: reais inteiros, sem centavos ("573.200 reais"). */
function spokenBRL(cents: number): string {
  const reais = Math.round(Math.abs(cents) / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${reais} ${Math.round(Math.abs(cents) / 100) === 1 ? "real" : "reais"}`;
}
const spokenPct = (p: number) => `${formatPct(Math.abs(p)).replace("%", "")} por cento`;
const dir = (cents: number, up = "alta", down = "queda") =>
  cents < 0 ? down : cents > 0 ? up : "estabilidade";

/** Texto aprovado (ex.: "−R$ 15.000,00/mês", "15,0%") em forma falada. */
function speakable(t: string): string {
  return t
    .replace(/([−-]?)\s?R\$\s?(\d[\d.]*)(?:,\d{2})?/g, (_m, neg: string, int: string) => {
      const n = int.replace(/\./g, "");
      return `${neg ? "menos " : ""}${int} ${n === "1" ? "real" : "reais"}`;
    })
    .replace(/([\d,]+)\s?%/g, "$1 por cento")
    .replace(/\/mês/g, " por mês");
}

function chunk(text: string): string[] {
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
  return out;
}

/**
 * Roteiro falado: introdução por tema e um resumo curto dos gráficos e quadros
 * (destaques), nunca a leitura de todas as linhas.
 */
export function buildImportedSpeechScript(r: ImportedReport): string[] {
  const parts: string[] = [];
  const push = (s: string) => {
    const t = speakable(s).replace(/\s+/g, " ").trim();
    if (t) parts.push(...chunk(t));
  };
  push(sentence(r.title));
  push(sentence(periodText(r.period)));
  for (const b of r.blocks) {
    switch (b.type) {
      case "intro":
        for (const t of b.themes)
          push(`${sentence(t.headline)} ${t.detail ? sentence(t.detail) : ""}`);
        break;
      case "overall_result":
        push(
          `Resultado geral. A média mensal foi de ${spokenBRL(b.previous_cents)} no período anterior e de ${spokenBRL(b.current_cents)} no atual, ${dir(b.change_cents)} líquida de ${spokenBRL(b.change_cents)} por mês, ${spokenPct(b.change_pct)}.`,
        );
        break;
      case "monthly_by_state": {
        const worst = [...b.items].sort((a, c) => a.change_cents - c.change_cents).slice(0, 3);
        push(
          `Média mensal por estado. ${b.items.length} estados. Maiores variações: ${worst
            .map(
              (i) =>
                `${i.uf}, ${dir(i.change_cents)} de ${spokenBRL(i.change_cents)} por mês, ${spokenPct(i.change_pct)}`,
            )
            .join("; ")}.`,
        );
        break;
      }
      case "loss_concentration":
        push(
          `Concentração das perdas. ${b.scope_records} registros concentram ${spokenPct(b.scope_share_pct)} da perda bruta, ${spokenBRL(b.scope_gross_loss_cents)} por mês. Maiores quedas: ${b.rows
            .slice(0, 3)
            .map((r2) => `${r2.account}, ${r2.uf}, queda de ${spokenBRL(r2.change_cents)} por mês`)
            .join("; ")}.`,
        );
        break;
      case "top10_growth":
        push(
          `Maiores crescimentos. Em destaque: ${b.items
            .slice(0, 3)
            .map((i) => `${i.account}, ${i.uf}, com mais ${spokenBRL(i.gain_cents)} por mês`)
            .join(
              "; ",
            )}.${b.no_base?.length ? ` ${b.no_base.length} registros não têm base no ano anterior.` : ""}`,
        );
        break;
      case "top6_comparison":
        push(
          `Os seis maiores crescimentos. ${b.items
            .map(
              (i) =>
                `${i.account}, ${i.uf}, mais ${spokenBRL(i.gain_cents)} por mês, ${spokenPct(i.gain_pct)}`,
            )
            .join("; ")}.`,
        );
        break;
      case "top6_reasons": {
        const withNote = b.items.filter(
          (i) => noteText(i.note) !== "—" && !/ainda não inputados/i.test(i.note ?? ""),
        );
        if (withNote.length)
          push(
            `Motivos de crescimento. ${withNote
              .slice(0, 3)
              .map((i) => `${i.account}: ${sentence(i.note ?? "")}`)
              .join(" ")}`,
          );
        break;
      }
    }
  }
  return parts;
}

/** Mensagem de WhatsApp: introdução por tema (destaque em negrito) e o link público. */
export function formatImportedForWhatsapp(
  r: ImportedReport,
  o: { link?: string; introMessage?: string } = {},
): string {
  const out: string[] = [];
  if (o.introMessage?.trim()) out.push(o.introMessage.trim(), "");
  out.push(`*${r.title}*`);
  const period = periodText(r.period);
  if (period) out.push(`_${period}_`);
  const intro = r.blocks.find((b) => b.type === "intro");
  if (intro && intro.type === "intro")
    for (const t of intro.themes) {
      out.push("", `*${t.headline}*`);
      if (t.detail) out.push(t.detail);
    }
  if (o.link) out.push("", "Relatório completo com gráficos:", o.link);
  return out.join("\n");
}

/** Conteúdo do relatório importado no formato do e-mail do Relatório Geral (quadros por bloco). */
export function importedToEmailContent(r: ImportedReport): GeneralReportContent {
  const intro = r.blocks.find((b) => b.type === "intro");
  const themes = intro && intro.type === "intro" ? intro.themes : [];
  const chapters: ReportChapter[] = [];
  const table = (title: string | undefined, columns: string[], rows: string[][]): ReportBlock => ({
    type: "table",
    title,
    columns,
    rows,
  });
  for (const b of r.blocks) {
    switch (b.type) {
      case "overall_result":
        chapters.push({
          title: b.title ?? "Resultado geral",
          blocks: [
            {
              type: "kpis",
              items: [
                { label: "Média anterior", value: formatBRL(b.previous_cents) },
                { label: "Média atual", value: formatBRL(b.current_cents) },
                {
                  label: "Variação líquida",
                  value: formatBRL(b.change_cents, { sign: true }),
                  hint: formatPct(b.change_pct, { sign: true }),
                },
              ],
            },
          ],
        });
        break;
      case "monthly_by_state":
        chapters.push({
          title: b.title ?? "Média mensal por estado",
          blocks: [
            table(
              undefined,
              ["UF", "Média anterior", "Média atual", "Variação (R$)", "Variação (%)"],
              b.items.map((i) => [
                i.uf,
                formatBRL(i.previous_cents),
                formatBRL(i.current_cents),
                formatBRL(i.change_cents, { sign: true }),
                formatPct(i.change_pct, { sign: true }),
              ]),
            ),
          ],
        });
        break;
      case "loss_concentration":
        chapters.push({
          title: b.title ?? "Concentração das perdas",
          summary: `${b.scope_records} registros · perda bruta do recorte ${formatBRL(b.scope_gross_loss_cents)}/mês · ${formatPct(b.scope_share_pct)} da perda bruta`,
          blocks: [
            table(
              undefined,
              ["#", "Conta", "UF", "Anterior", "Atual", "Queda mensal", "Relato comercial"],
              b.rows.map((x) => [
                `${x.position}º`,
                x.account,
                x.uf,
                formatBRL(x.previous_cents),
                formatBRL(x.current_cents),
                `${formatBRL(x.change_cents, { sign: true })} (${formatPct(x.change_pct, { sign: true })})`,
                noteText(x.note),
              ]),
            ),
          ],
        });
        break;
      case "top10_growth": {
        const blocks: ReportBlock[] = [
          table(
            undefined,
            ["Conta", "UF", "Ganho mensal"],
            b.items.map((i) => [i.account, i.uf, formatBRL(i.gain_cents, { sign: true })]),
          ),
        ];
        if (b.no_base?.length)
          blocks.push(
            table(
              "Sem base no ano anterior",
              ["Conta", "UF", "Média atual"],
              b.no_base.map((i) => [i.account, i.uf, formatBRL(i.current_cents)]),
            ),
          );
        chapters.push({ title: b.title ?? "Top 10 crescimentos", blocks });
        break;
      }
      case "top6_comparison":
        chapters.push({
          title: b.title ?? "Top 6 crescimentos · Comparativo",
          blocks: [
            table(
              undefined,
              ["Conta", "UF", "Anterior", "Atual", "Ganho"],
              b.items.map((i) => [
                i.account,
                i.uf,
                formatBRL(i.previous_cents),
                formatBRL(i.current_cents),
                `${formatBRL(i.gain_cents, { sign: true })} (${formatPct(i.gain_pct, { sign: true })})`,
              ]),
            ),
          ],
        });
        break;
      case "top6_reasons":
        chapters.push({
          title: b.title ?? "Motivos de crescimento · Top 6",
          blocks: [
            table(
              undefined,
              ["Conta", "UF", "Anterior", "Atual", "Crescimento", "Relato comercial"],
              b.items.map((i) => [
                i.account,
                i.uf,
                formatBRL(i.previous_cents),
                formatBRL(i.current_cents),
                formatBRL(i.gain_cents, { sign: true }),
                noteText(i.note),
              ]),
            ),
          ],
        });
        break;
    }
  }
  return {
    title: r.title,
    subtitle: periodText(r.period) || undefined,
    executive_summary: themes
      .map((t) => (t.detail ? `${t.headline}\n${t.detail}` : t.headline))
      .join("\n\n"),
    chapters,
  };
}

/** Print do card "Resultado geral" (tela) numa imagem 1200x630 para a prévia do WhatsApp. */
export async function captureOverallResultPng(el: HTMLElement): Promise<Blob> {
  const { default: html2canvas } = await import("html2canvas-pro");
  const shot = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    onclone: (d, cloned) => {
      d.documentElement.classList.remove("dark");
      (cloned as HTMLElement).style.width = "760px";
      (cloned as HTMLElement).style.maxWidth = "760px";
    },
  });
  if (!shot.width || !shot.height) throw new Error("Não foi possível capturar o gráfico.");
  const W = 1200;
  const H = 630;
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponível.");
  ctx.fillStyle = "#eef2f7";
  ctx.fillRect(0, 0, W, H);
  const pad = 28;
  const scale = Math.min((W - pad * 2) / shot.width, (H - pad * 2) / shot.height);
  const w = shot.width * scale;
  const h = shot.height * scale;
  ctx.drawImage(shot, (W - w) / 2, (H - h) / 2, w, h);
  return await new Promise<Blob>((resolve, reject) =>
    out.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao gerar a imagem."))),
      "image/png",
    ),
  );
}
