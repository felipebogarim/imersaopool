// Gerador de PDF do RELATÓRIO FINAL DE IMERSÃO EM CAMPO.
// 100% determinístico: lê apenas o conteúdo já salvo (capítulos reais do relatório
// importado). Não usa IA, não reescreve, não resume, não cria capítulos.
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";

type RGB = [number, number, number];

const BG: RGB = [6, 14, 26];
const SURFACE: RGB = [14, 26, 44];
const SURFACE_2: RGB = [20, 36, 58];
const CYAN: RGB = [0, 229, 255];
const CYAN_DEEP: RGB = [120, 225, 240];
const INK: RGB = [232, 240, 250];
const MUTED: RGB = [140, 160, 185];
const HAIRLINE: RGB = [32, 54, 82];

// ————————————————————————— Markdown → blocos —————————————————————————

export type Block =
  | { type: "h3"; text: string }
  | { type: "h4"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[]; start: number }
  | { type: "quote"; text: string; source?: string };

const AUTHORSHIP_RE =
  /autoria\s+individual\s+n[ãa]o\s+identificada|n[ãa]o\s+identificad[oa]\s+na\s+transcri[çc][ãa]o/i;

export const NOTA_AUTORIA =
  "Quando a transcrição não permite identificar com segurança o interlocutor, a fala é atribuída à equipe participante.";

const inline = (s: string) =>
  s
    .replace(/`{1,3}([^`]*)`{1,3}/g, "$1")
    .replace(/\*\*\*([^*]+)\*\*\*/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(?<!\w)_([^_\n]+)_(?!\w)/g, "$1")
    .replace(/(?<!\w)\*([^*\n]+)\*(?!\w)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();

/** Converte o markdown salvo do capítulo em blocos com hierarquia visual. */
export function parseBlocks(markdown: string): Block[] {
  const lines = String(markdown ?? "").replace(/\r\n?/g, "\n").split("\n");
  const out: Block[] = [];
  let para: string[] = [];
  let ul: string[] = [];
  let ol: string[] = [];
  let quote: string[] = [];

  // Numeração contínua: itens numerados separados por linha em branco continuam a sequência.
  let olNext = 1;
  const resetOl = () => {
    olNext = 1;
  };

  const flushPara = () => {
    if (para.length) {
      out.push({ type: "p", text: inline(para.join(" ")) });
      resetOl();
    }
    para = [];
  };
  const flushList = () => {
    if (ul.length) {
      out.push({ type: "ul", items: ul.map(inline).filter(Boolean) });
      resetOl();
    }
    if (ol.length) {
      const items = ol.map(inline).filter(Boolean);
      out.push({ type: "ol", items, start: olNext });
      olNext += items.length;
    }
    ul = [];
    ol = [];
  };
  const flushQuote = () => {
    if (quote.length) {
      const text = inline(quote.join(" ")).replace(/^["“”']+|["“”']+$/g, "");
      if (text) {
        out.push({ type: "quote", text });
        resetOl();
      }
    }
    quote = [];
  };
  const flushAll = () => {
    flushQuote();
    flushList();
    flushPara();
  };

  for (const raw of lines) {
    const line = raw.trim();

    if (!line) {
      flushAll();
      continue;
    }

    // Citação (blockquote)
    if (/^>\s?/.test(line)) {
      flushList();
      flushPara();
      quote.push(line.replace(/^>\s?/, ""));
      continue;
    }
    flushQuote();

    // Subtítulos markdown
    const h = line.match(/^(#{3,6})\s+(.*)$/);
    if (h) {
      flushAll();
      out.push({ type: h[1].length <= 3 ? "h3" : "h4", text: inline(h[2]) });
      resetOl();
      continue;
    }

    // Linhas totalmente em negrito funcionam como rótulo/subtítulo no relatório
    const boldOnly = line.match(/^\*\*(.+?)\*\*:?$/);
    if (boldOnly) {
      const label = boldOnly[1].trim();
      // Rótulo "Citação" é redundante (a citação já vira card próprio)
      if (/^cita[çc][ãa]o(\s*\d+)?$/i.test(label)) {
        flushAll();
        continue;
      }
      // Autoria longa vira fonte da citação anterior
      if (AUTHORSHIP_RE.test(label) || /^(equipe|fonte)\b/i.test(label)) {
        flushList();
        flushPara();
        const fonte = label.split(",")[0].trim();
        for (let i = out.length - 1; i >= 0; i--) {
          if (out[i].type === "quote") {
            (out[i] as any).source = (out[i] as any).source ?? fonte;
            break;
          }
          if (out[i].type === "h3" || out[i].type === "h4") break;
        }
        continue;
      }
      flushAll();
      out.push({ type: "h4", text: inline(label) });
      resetOl();
      continue;
    }

    // Listas
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    if (bullet) {
      flushPara();
      if (ol.length) flushList();
      ul.push(bullet[1]);
      continue;
    }
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (numbered) {
      flushPara();
      if (ul.length) flushList();
      ol.push(numbered[1]);
      continue;
    }
    if ((ul.length || ol.length) && /^\s{2,}/.test(raw)) {
      // continuação de item de lista
      const arr = ol.length ? ol : ul;
      arr[arr.length - 1] = `${arr[arr.length - 1]} ${line}`;
      continue;
    }
    flushList();

    // Linha de autoria sem negrito
    if (AUTHORSHIP_RE.test(line) && line.length < 200) {
      flushPara();
      const fonte = inline(line).split(",")[0].trim();
      for (let i = out.length - 1; i >= 0; i--) {
        if (out[i].type === "quote") {
          (out[i] as any).source = (out[i] as any).source ?? fonte;
          break;
        }
        if (out[i].type === "h3" || out[i].type === "h4") break;
      }
      continue;
    }

    para.push(line);
  }
  flushAll();
  return out;
}

// ————————————————————————— Dados —————————————————————————

export type ImmersionChapter = { ordem: number; titulo: string; markdown: string };

export type ImmersionPdfData = {
  cliente: string;
  dataVisita: string | null;
  local: string | null;
  representante: string | null;
  consultor: string | null;
  participantes: string | null;
  chapters: ImmersionChapter[];
};

const clean = (s?: string | null) => {
  const v = String(s ?? "").trim();
  return v && !/^n[ãa]o informado$/i.test(v) ? v : null;
};

/** Formata datas mantendo o que veio do relatório (dd/mm/aaaa). */
export function formatVisitDate(raw?: string | null): string | null {
  const v = clean(raw);
  if (!v) return null;
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return v;
}

export async function loadImmersionPdfData(interviewId: string): Promise<ImmersionPdfData> {
  const { data: interview } = await supabase
    .from("interviews")
    .select("id, roteiro_id, respostas, client_id, data_entrevista, entrevistado_nome")
    .eq("id", interviewId)
    .maybeSingle();
  if (!interview) throw new Error("Sessão não encontrada");

  const fsv = ((interview.respostas as any)?.__field_store_visit__ ?? null) as any;
  const meta = (fsv?.meta ?? {}) as Record<string, string>;

  const [capsRes, respRes, clientRes] = await Promise.all([
    interview.roteiro_id
      ? supabase
          .from("capitulos")
          .select("id, ordem, titulo")
          .eq("roteiro_id", interview.roteiro_id)
          .order("ordem")
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from("sessao_capitulos")
      .select("capitulo_id, leitura_estrategica, sintese")
      .eq("sessao_id", interviewId),
    interview.client_id
      ? supabase
          .from("clients")
          .select("razao_social, nome_fantasia")
          .eq("id", interview.client_id)
          .maybeSingle()
      : Promise.resolve({ data: null as any }),
  ]);

  const respByCap = new Map((respRes.data ?? []).map((r: any) => [r.capitulo_id, r]));
  const chapters: ImmersionChapter[] = [];
  for (const cap of (capsRes.data ?? []) as any[]) {
    const r: any = respByCap.get(cap.id);
    const markdown = String(r?.leitura_estrategica ?? "").trim();
    if (!markdown) continue; // capítulo vazio: não entra no índice nem gera página
    const s = (r?.sintese ?? {}) as Record<string, any>;
    const codigo = String(s.__chapter_codigo__ ?? "");
    const ordemReal = /^C(\d+)$/i.test(codigo) ? Number(codigo.slice(1)) : Number(cap.ordem);
    chapters.push({
      ordem: ordemReal,
      titulo: String(s.__chapter_titulo__ ?? cap.titulo ?? "").trim(),
      markdown,
    });
  }
  chapters.sort((a, b) => a.ordem - b.ordem);

  const clienteCadastro =
    clean((clientRes as any)?.data?.razao_social) ?? clean((clientRes as any)?.data?.nome_fantasia);
  const clienteMeta = clean(meta["cliente"]);
  const cliente =
    clienteCadastro && clienteMeta && clienteCadastro.toUpperCase().includes(clienteMeta.toUpperCase())
      ? clienteCadastro
      : clienteCadastro ?? clienteMeta ?? clean(interview.entrevistado_nome) ?? "—";

  return {
    cliente,
    dataVisita: formatVisitDate(meta["data_visita"] ?? interview.data_entrevista),
    local: clean(meta["local"]),
    representante: clean(meta["representante"]),
    consultor: clean(meta["consultor"]) ?? clean(meta["responsavel_relatorio"]),
    participantes: clean(meta["participantes"]),
    chapters,
  };
}

// ————————————————————————— Sumário executivo (determinístico) —————————————————————————

export type SumarioExecutivo = {
  sinteseGeral: string[];
  sinaisPrioritarios: string[];
  leituraExecutiva: string[];
};

const SECTION_MATCH = {
  conclusoes: /conclus/i,
  prioridades: /priorida/i,
  proximos: /pr[óo]ximos\s+passos/i,
};

/** Extrai o sumário executivo do próprio conteúdo salvo (capítulo de síntese). */
export function buildSumario(chapters: ImmersionChapter[]): SumarioExecutivo {
  const last = chapters[chapters.length - 1];
  const empty = { sinteseGeral: [], sinaisPrioritarios: [], leituraExecutiva: [] };
  if (!last) return empty;

  const blocks = parseBlocks(last.markdown);
  const sinteseGeral: string[] = [];
  const sinais: string[] = [];
  const leitura: string[] = [];

  let section: "intro" | "conclusoes" | "prioridades" | "proximos" | "outro" = "intro";
  for (const b of blocks) {
    if (b.type === "h3" || b.type === "h4") {
      if (SECTION_MATCH.conclusoes.test(b.text)) section = "conclusoes";
      else if (SECTION_MATCH.prioridades.test(b.text)) section = "prioridades";
      else if (SECTION_MATCH.proximos.test(b.text)) section = "proximos";
      else section = "outro";
      continue;
    }
    if (section === "intro" && b.type === "p") {
      if (sinteseGeral.length < 3) sinteseGeral.push(b.text);
      continue;
    }
    if (section === "conclusoes" && (b.type === "ol" || b.type === "ul")) {
      sinais.push(...b.items);
      continue;
    }
    if ((section === "prioridades" || section === "proximos") && (b.type === "ol" || b.type === "ul")) {
      leitura.push(...b.items);
      continue;
    }
  }

  return {
    sinteseGeral,
    sinaisPrioritarios: sinais.slice(0, 8),
    leituraExecutiva: leitura.slice(0, 8),
  };
}

// ————————————————————————— Mapa executivo (organização visual) —————————————————————————

export type MapaExecutivo = { titulo: string; itens: string[] }[];

const BUCKETS: { titulo: string; re: RegExp }[] = [
  { titulo: "Forças atuais", re: /\b(melhor|melhora|ganho|for[çc]a|avan[çc]|competitiv|segurança|confian|reconhec)/i },
  { titulo: "Barreiras", re: /\b(barreira|dificuldade|complexidade|resist|h[áa]bito|obst[áa]cul|desafio|falta)/i },
  { titulo: "Oportunidades", re: /\b(oportunidade|potencial|espa[çc]o|crescimento|ampliar|explorar|expans)/i },
  { titulo: "Pontos de atenção", re: /\b(risco|aten[çc][ãa]o|amea[çc]a|cuidado|press[ãa]o|perda|queda|conflito)/i },
];

/** Organiza visualmente elementos já existentes no relatório (sem criar conteúdo). */
export function buildMapaExecutivo(chapters: ImmersionChapter[]): MapaExecutivo {
  const candidates: string[] = [];
  for (const c of chapters) {
    for (const b of parseBlocks(c.markdown)) {
      if (b.type === "ul" || b.type === "ol") candidates.push(...b.items);
    }
  }
  const used = new Set<string>();
  return BUCKETS.map(({ titulo, re }) => {
    const itens: string[] = [];
    for (const raw of candidates) {
      const item = raw.trim();
      if (!item || item.length < 12 || item.length > 220) continue;
      if (used.has(item)) continue;
      if (!re.test(item)) continue;
      used.add(item);
      itens.push(item);
      if (itens.length === 4) break;
    }
    return { titulo, itens };
  }).filter((b) => b.itens.length > 0);
}

// ————————————————————————— Render —————————————————————————

export async function exportImmersionFinalPdf(interviewId: string) {
  const data = await loadImmersionPdfData(interviewId);
  const doc = buildImmersionPdfDoc(data);
  const slug = data.cliente
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  doc.save(`relatorio-imersao-${slug || "campo"}.pdf`);
  return { pages: doc.getNumberOfPages(), chapters: data.chapters.length };
}

export function buildImmersionPdfDoc(data: ImmersionPdfData): jsPDF {
  if (!data.chapters.length) throw new Error("Nenhum capítulo com conteúdo neste relatório.");

  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 52;
  const maxW = pageW - margin * 2;
  let y = margin;

  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
  const text = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
  const draw = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);

  const bottom = () => pageH - margin - 30;

  const paintPage = () => {
    fill(BG);
    doc.rect(0, 0, pageW, pageH, "F");
    fill(SURFACE_2);
    doc.rect(0, 0, 5, pageH, "F");
    fill(CYAN);
    doc.rect(0, 0, 5, 110, "F");
  };

  const newPage = () => {
    doc.addPage();
    paintPage();
    y = margin + 6;
  };

  const need = (h: number) => {
    if (y + h > bottom()) newPage();
  };

  const lines = (s: string, size: number, style: "normal" | "bold" | "italic", w: number) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    return doc.splitTextToSize(s, w) as string[];
  };

  const writeLines = (
    ls: string[],
    size: number,
    style: "normal" | "bold" | "italic",
    color: RGB,
    x: number,
    lh: number,
  ) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    text(color);
    for (const l of ls) {
      need(lh);
      doc.text(l, x, y + size);
      y += lh;
    }
  };

  // ————— Página 1 · Capa —————
  paintPage();
  fill(SURFACE);
  doc.rect(0, 0, pageW, 250, "F");
  fill(CYAN);
  doc.rect(margin, 96, 54, 4, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  text(CYAN);
  doc.text("RELATÓRIO DE IMERSÃO EM CAMPO", margin, 78, { charSpace: 2.4 });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(30);
  text(INK);
  let cy = 150;
  for (const l of lines(data.cliente, 30, "bold", maxW).slice(0, 3)) {
    doc.text(l, margin, cy);
    cy += 36;
  }

  const fichaTop = 300;
  const ficha: [string, string | null][] = [
    ["Data da visita", data.dataVisita],
    ["Local", data.local],
    ["Representante", data.representante],
    ["Consultor", data.consultor],
    ["Participantes", data.participantes],
  ];
  let fy = fichaTop;
  for (const [label, value] of ficha) {
    if (!value) continue;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    text(CYAN_DEEP);
    doc.text(label.toUpperCase(), margin, fy, { charSpace: 1.6 });
    const vls = lines(value, 12, "normal", maxW).slice(0, 3);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    text(INK);
    let vy = fy + 16;
    for (const l of vls) {
      doc.text(l, margin, vy);
      vy += 16;
    }
    fy = vy + 12;
    draw(HAIRLINE);
    doc.setLineWidth(0.4);
    doc.line(margin, fy - 8, margin + maxW, fy - 8);
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  text(MUTED);
  doc.text(
    `Relatório emitido em ${new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}`,
    margin,
    pageH - margin,
  );

  // ————— Página 2 · Sumário executivo —————
  const sumario = buildSumario(data.chapters);
  newPage();

  const sectionTitle = (eyebrow: string, title: string) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    text(CYAN_DEEP);
    doc.text(eyebrow.toUpperCase(), margin, y + 8, { charSpace: 2 });
    y += 26;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    text(INK);
    for (const l of lines(title, 24, "bold", maxW - 40)) {
      doc.text(l, margin, y + 18);
      y += 30;
    }
    fill(CYAN);
    doc.rect(margin, y + 4, 44, 3, "F");
    y += 22;
  };

  sectionTitle("00", "Sumário executivo");

  const cardList = (label: string, items: string[], numbered: boolean) => {
    if (!items.length) return;
    need(60);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    text(CYAN);
    doc.text(label.toUpperCase(), margin, y + 8, { charSpace: 1.4 });
    y += 18;
    items.forEach((it, i) => {
      const bulletW = 18;
      const ls = lines(it, 10, "normal", maxW - bulletW - 12);
      need(ls.length * 13 + 8);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      text(CYAN_DEEP);
      doc.text(numbered ? `${String(i + 1).padStart(2, "0")}` : "•", margin, y + 10);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      text(INK);
      let ly = y;
      for (const l of ls) {
        doc.text(l, margin + bulletW, ly + 10);
        ly += 13;
      }
      y = ly + 8;
    });
    y += 6;
  };

  if (sumario.sinteseGeral.length) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    text(CYAN);
    doc.text("SÍNTESE GERAL", margin, y + 8, { charSpace: 1.4 });
    y += 18;
    for (const p of sumario.sinteseGeral) {
      writeLines(lines(p, 10.5, "normal", maxW), 10.5, "normal", INK, margin, 14);
      y += 8;
    }
    y += 4;
  }
  cardList("Sinais prioritários", sumario.sinaisPrioritarios, true);
  cardList("Leitura executiva", sumario.leituraExecutiva, false);

  // ————— Página 3 · Mapa executivo + índice —————
  const mapa = buildMapaExecutivo(data.chapters);
  if (mapa.length) {
    newPage();
    sectionTitle("Mapa", "Mapa executivo da imersão");

    const colGap = 16;
    const colW = (maxW - colGap) / 2;
    let col = 0;
    let rowTop = y;
    let rowH = 0;
    for (const bucket of mapa) {
      const x = margin + col * (colW + colGap);
      const itemLines = bucket.itens.map((i) => lines(i, 9, "normal", colW - 30));
      const h = 40 + itemLines.reduce((a, ls) => a + ls.length * 11.5 + 8, 0);
      if (col === 0 && rowTop + h > bottom()) {
        newPage();
        rowTop = y;
        rowH = 0;
      }
      fill(SURFACE);
      doc.roundedRect(x, rowTop, colW, h, 8, 8, "F");
      fill(CYAN);
      doc.rect(x, rowTop + 6, 3, h - 12, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      text(CYAN);
      doc.text(bucket.titulo.toUpperCase(), x + 14, rowTop + 22, { charSpace: 1.3 });
      let iy = rowTop + 38;
      bucket.itens.forEach((_, idx) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        text(INK);
        doc.text("•", x + 14, iy);
        for (const l of itemLines[idx]) {
          doc.text(l, x + 24, iy);
          iy += 11.5;
        }
        iy += 8;
      });
      rowH = Math.max(rowH, h);
      col = col === 0 ? 1 : 0;
      if (col === 0) {
        rowTop += rowH + colGap;
        rowH = 0;
        y = rowTop;
      }
    }
    y = rowTop + rowH + (rowH ? colGap : 0);
  }

  // Índice — somente capítulos existentes
  need(120);
  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  text(CYAN);
  doc.text("ÍNDICE", margin, y + 8, { charSpace: 2 });
  y += 20;
  draw(HAIRLINE);
  doc.setLineWidth(0.5);
  doc.line(margin, y, margin + maxW, y);
  y += 14;
  for (const c of data.chapters) {
    need(26);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    text(CYAN);
    doc.text(String(c.ordem).padStart(2, "0"), margin, y + 10);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    text(INK);
    const tls = lines(c.titulo, 11, "normal", maxW - 40);
    let ly = y;
    for (const l of tls) {
      doc.text(l, margin + 34, ly + 10);
      ly += 14;
    }
    y = ly + 8;
    draw(HAIRLINE);
    doc.setLineWidth(0.3);
    doc.line(margin, y - 4, margin + maxW, y - 4);
  }

  // Nota metodológica única sobre autoria das citações
  need(40);
  y += 10;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  text(MUTED);
  for (const l of lines(NOTA_AUTORIA, 8, "italic", maxW)) {
    doc.text(l, margin, y + 8);
    y += 11;
  }

  // ————— Capítulos —————
  for (const cap of data.chapters) {
    // Nova página apenas se não houver espaço razoável para a abertura do capítulo
    if (y + 200 > bottom()) newPage();
    else y += 18;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    text(CYAN_DEEP);
    doc.text(`CAPÍTULO ${String(cap.ordem).padStart(2, "0")}`, margin, y + 8, { charSpace: 2 });
    y += 24;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(21);
    text(INK);
    for (const l of lines(cap.titulo, 21, "bold", maxW - 20)) {
      need(28);
      doc.text(l, margin, y + 16);
      y += 27;
    }
    fill(CYAN);
    doc.rect(margin, y + 6, 44, 3, "F");
    y += 24;

    for (const b of parseBlocks(cap.markdown)) {
      if (b.type === "h3") {
        need(96);
        y += 8;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(13);
        text(CYAN);
        for (const l of lines(b.text, 13, "bold", maxW)) {
          need(20);
          doc.text(l, margin, y + 12);
          y += 19;
        }
        y += 6;
        continue;
      }
      if (b.type === "h4") {
        need(72);
        y += 6;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        text(INK);
        for (const l of lines(b.text, 10, "bold", maxW)) {
          need(16);
          doc.text(l, margin, y + 10);
          y += 15;
        }
        y += 4;
        continue;
      }
      if (b.type === "p") {
        writeLines(lines(b.text, 10.5, "normal", maxW), 10.5, "normal", INK, margin, 14);
        y += 8;
        continue;
      }
      if (b.type === "ul" || b.type === "ol") {
        const startAt = b.type === "ol" ? b.start : 0;
        b.items.forEach((it, i) => {
          const ls = lines(it, 10, "normal", maxW - 24);
          need(Math.min(ls.length, 3) * 13 + 6);
          doc.setFont("helvetica", "bold");
          doc.setFontSize(9.5);
          text(CYAN_DEEP);
          doc.text(startAt ? `${startAt + i}.` : "•", margin + 2, y + 10);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10);
          text(INK);
          for (const l of ls) {
            need(13);
            doc.text(l, margin + 24, y + 10);
            y += 13;
          }
          y += 5;
        });
        y += 6;
        continue;
      }
      // Citação em bloco visual próprio
      const quoteText = `“${b.text}”`;
      const qls = lines(quoteText, 12, "italic", maxW - 48);
      const srcH = b.source ? 14 : 0;
      const boxH = qls.length * 16 + 30 + srcH;
      if (y + boxH > bottom()) newPage();
      fill(SURFACE);
      doc.roundedRect(margin, y, maxW, boxH, 8, 8, "F");
      fill(CYAN);
      doc.rect(margin, y + 6, 3, boxH - 12, "F");
      doc.setFont("helvetica", "italic");
      doc.setFontSize(12);
      text(INK);
      let qy = y + 24;
      for (const l of qls) {
        doc.text(l, margin + 22, qy);
        qy += 16;
      }
      if (b.source) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        text(CYAN_DEEP);
        doc.text(`Fonte: ${b.source}`, margin + 22, qy + 6, { charSpace: 0.8 });
      }
      y += boxH + 14;
    }
  }

  // ————— Cabeçalho / rodapé —————
  const total = doc.getNumberOfPages();
  for (let p = 2; p <= total; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    text(MUTED);
    doc.text("RELATÓRIO DE IMERSÃO EM CAMPO", margin, 30, { charSpace: 1.4 });
    text(INK);
    doc.text(data.cliente.toUpperCase(), pageW - margin, 30, { align: "right", charSpace: 1 });
    draw(HAIRLINE);
    doc.setLineWidth(0.4);
    doc.line(margin, 38, pageW - margin, 38);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    text(MUTED);
    doc.text(
      data.dataVisita ? `Visita em ${data.dataVisita}` : "",
      margin,
      pageH - margin + 12,
    );
    doc.text(`${p} / ${total}`, pageW - margin, pageH - margin + 12, { align: "right" });
  }

  return doc;
}

