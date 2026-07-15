import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Ingesta de "Relatório final": documento já pronto e formatado.
 * A IA NÃO analisa, resume ou reescreve — apenas parseia estrutura conhecida
 * e copia trechos verbatim para os campos visuais (leitura_estrategica,
 * sintese{campo}, evidência).
 *
 * Formato esperado (Markdown):
 *   ## Capítulo N — Título              (ou "## N. Título", "## Capítulo N – Título")
 *   **Percepção relatada** | **Leitura estratégica**
 *   <parágrafos livres>
 *   **Pontos levantados**
 *   - chave: valor
 *   - outra_chave: valor
 *   **Evidência:** "trecho literal"
 */

function stripBase64ToText(base64: string, mime: string, filename: string): Promise<string> {
  const isPlain =
    (mime && (mime.startsWith("text/") || mime === "application/json")) ||
    /\.(txt|md|markdown|csv)$/i.test(filename);
  if (isPlain) {
    try {
      // decodifica utf-8
      const bin = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      return Promise.resolve(new TextDecoder("utf-8").decode(bin));
    } catch {
      return Promise.resolve(atob(base64));
    }
  }
  // DOCX
  if (/\.docx$/i.test(filename) || mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return import("fflate").then(({ unzipSync, strFromU8 }) => {
      const bin = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      const files = unzipSync(bin, { filter: (f) => f.name === "word/document.xml" });
      const xml = files["word/document.xml"] ? strFromU8(files["word/document.xml"]) : "";
      if (!xml) throw new Error("Não foi possível ler o conteúdo do DOCX");
      // Cada <w:p> vira um parágrafo. Detecta "bold" para marcar cabeçalhos como **texto**.
      const paragraphs = xml.split(/<\/w:p>/).map((para) => {
        const runs = [...para.matchAll(/<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g)].map((rm) => {
          const runXml = rm[1];
          const isBold = /<w:b\b(?:\s[^/>]*)?\/>|<w:b\s+w:val="(?:true|1)"\s*\/>/.test(runXml);
          const text = [...runXml.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)]
            .map((tm) => tm[1])
            .join("")
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'");
          if (!text) return "";
          return isBold ? `**${text}**` : text;
        });
        // Detecta se é item de lista
        const isList = /<w:numPr\b/.test(para);
        const line = runs.join("").trim();
        if (!line) return "";
        return isList ? `- ${line}` : line;
      });
      return paragraphs.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    });
  }
  throw new Error("Formato não suportado no modo Relatório final. Envie .md, .txt ou .docx.");
}

// Normaliza um cabeçalho de capítulo em código canônico ou label a comparar.
function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

type ParsedChapter = {
  ordem: number | null;
  titulo: string;
  leitura: string;
  sintese: Record<string, string>;
  evidencia: string;
};

export type SumarioExecutivo = {
  sintese_geral?: string;
  sinais_prioritarios?: Array<{ key: string; value: string }>;
  risco_estrategico?: string;
  agenda_prioritaria?: Array<{ key: string; value: string }>;
  sintese_final?: string;
};

function parseSumarioExecutivo(md: string): SumarioExecutivo | null {
  // Locate "## Sumário executivo" block; ends at next "## " heading.
  const re = /^\s*##\s+sum[aá]rio\s+executivo\s*$/im;
  const m = md.match(re);
  if (!m) return null;
  const start = m.index! + m[0].length;
  const rest = md.slice(start);
  const nextH = rest.search(/^\s*##\s+/m);
  const block = nextH === -1 ? rest : rest.slice(0, nextH);

  const lines = block.split(/\r?\n/);
  const sum: SumarioExecutivo = {};
  type Sec = "sintese_geral" | "sinais" | "risco" | "agenda" | "final" | null;
  let sec: Sec = null;
  const textBuf: Record<string, string[]> = {
    sintese_geral: [],
    risco: [],
    final: [],
  };
  const sinais: Array<{ key: string; value: string }> = [];
  const agenda: Array<{ key: string; value: string }> = [];

  const matchLabel = (raw: string): Sec | undefined => {
    const t = raw.replace(/^\s*\*+\s*|\s*\*+\s*:?\s*$/g, "").trim();
    const n = normalize(t);
    if (!n) return undefined;
    if (n.startsWith("sintese geral")) return "sintese_geral";
    if (n.startsWith("sinais prioritarios") || n.startsWith("sinais")) return "sinais";
    if (n.startsWith("risco estrategico") || n.startsWith("risco")) return "risco";
    if (n.startsWith("agenda prioritaria") || n.startsWith("agenda")) return "agenda";
    if (n.startsWith("sintese final")) return "final";
    return undefined;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) continue;
    // Label lines: **Something** or **Something:** possibly on own line
    const lbl = line.match(/^\s*\*\*(.+?)\*\*\s*:?\s*$/);
    if (lbl) {
      const s = matchLabel(lbl[1]);
      if (s !== undefined) {
        sec = s;
        continue;
      }
    }
    if (sec === "sinais" || sec === "agenda") {
      const item = line.match(/^\s*[-*•]\s*([^:]+?)\s*:\s*(.+)$/);
      if (item) {
        const key = item[1].trim().toLowerCase().replace(/\s+/g, "_");
        const value = item[2].trim();
        (sec === "sinais" ? sinais : agenda).push({ key, value });
      }
    } else if (sec === "sintese_geral" || sec === "risco" || sec === "final") {
      textBuf[sec === "sintese_geral" ? "sintese_geral" : sec === "risco" ? "risco" : "final"].push(line);
    }
  }

  if (textBuf.sintese_geral.length) sum.sintese_geral = textBuf.sintese_geral.join("\n").trim();
  if (textBuf.risco.length) sum.risco_estrategico = textBuf.risco.join("\n").trim();
  if (textBuf.final.length) sum.sintese_final = textBuf.final.join("\n").trim();
  if (sinais.length) sum.sinais_prioritarios = sinais;
  if (agenda.length) sum.agenda_prioritaria = agenda;

  const hasAny =
    sum.sintese_geral ||
    sum.risco_estrategico ||
    sum.sintese_final ||
    (sum.sinais_prioritarios && sum.sinais_prioritarios.length) ||
    (sum.agenda_prioritaria && sum.agenda_prioritaria.length);
  return hasAny ? sum : null;
}



function stripSumarioBlock(md: string): string {
  const re = /^\s*##\s+sum[aá]rio\s+executivo\s*$/im;
  const m = md.match(re);
  if (!m) return md;
  const start = m.index!;
  const rest = md.slice(start + m[0].length);
  const nextH = rest.search(/^\s*##\s+/m);
  if (nextH === -1) return md.slice(0, start).trimEnd();
  return md.slice(0, start) + rest.slice(nextH);
}

function parseFinalReport(md: string): {
  chapters: ParsedChapter[];
  observacoes: string;
  sumario: SumarioExecutivo | null;
} {
  const sumario = parseSumarioExecutivo(md);
  const cleaned = stripSumarioBlock(md);
  const lines = cleaned.split(/\r?\n/);

  const chapters: ParsedChapter[] = [];
  let cur: ParsedChapter | null = null;
  type Section = "leitura" | "sintese" | "evidencia" | null;
  let section: Section = null;


  // Linhas separadoras markdown (---, ***, ___). Nunca fazem parte de conteúdo.
  const separatorRe = /^\s*(?:[-*_]\s*){3,}\s*$/;

  const flushLeituraBuffer = (buf: string[]) => {
    if (!cur) return;
    const txt = buf.join("\n").trim();
    if (txt) cur.leitura = cur.leitura ? `${cur.leitura}\n\n${txt}` : txt;
  };
  let leituraBuf: string[] = [];

  const commitSectionSwitch = () => {
    if (section === "leitura") {
      flushLeituraBuffer(leituraBuf);
      leituraBuf = [];
    }
  };

  // Texto fora de qualquer capítulo (antes do 1º ou após um heading não-capítulo)
  // vira "observações gerais", separado dos capítulos.
  const observacoesBuf: string[] = [];
  let outsideMode = false;

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");

    // Separador markdown — encerra qualquer seção aberta e é ignorado.
    if (separatorRe.test(line)) {
      commitSectionSwitch();
      section = null;
      continue;
    }

    // Só reconhece cabeçalho de capítulo se começar com "Capítulo N" ou "N." / "N —".
    const chapterHeaderRe = /^\s*#{1,3}\s*(?:cap[ií]tulo\s+(\d+)|(\d+))\s*[—\-–.:)]?\s*(.+?)\s*$/i;
    const h = line.match(/^\s*#{1,3}\s+/);
    if (h) {
      const m = line.match(chapterHeaderRe);
      if (m) {
        commitSectionSwitch();
        if (cur) chapters.push(cur);
        const ordem = parseInt(m[1] ?? m[2], 10);
        cur = { ordem, titulo: m[3].trim(), leitura: "", sintese: {}, evidencia: "" };
        section = null;
        outsideMode = false;
        continue;
      }
      // Heading não-capítulo (ex: "## Nota final"): fecha o capítulo atual
      // e o conteúdo seguinte é acumulado como observação geral do documento.
      commitSectionSwitch();
      if (cur) {
        chapters.push(cur);
        cur = null;
      }
      section = null;
      outsideMode = true;
      const label = line.replace(/^\s*#{1,3}\s*/, "").trim();
      if (label) observacoesBuf.push(`**${label}**`);
      continue;
    }

    if (!cur) {
      if (outsideMode) {
        const t = line.trim();
        if (t) observacoesBuf.push(line);
      }
      continue;
    }

    // Marcadores de seção — linhas do tipo **Título** ou **Título:**
    const marker = line.match(/^\s*\*\*(.+?)\*\*\s*:?\s*(.*)$/);
    if (marker) {
      const label = normalize(marker[1]);
      const rest = marker[2].trim();

      if (
        label.startsWith("percepcao relatada") ||
        label.startsWith("leitura estrategica") ||
        label.startsWith("leitura")
      ) {
        commitSectionSwitch();
        section = "leitura";
        if (rest) leituraBuf.push(rest);
        continue;
      }
      if (label.startsWith("pontos levantados") || label.startsWith("sintese")) {
        commitSectionSwitch();
        section = "sintese";
        continue;
      }
      if (label.startsWith("evidencia")) {
        commitSectionSwitch();
        section = "evidencia";
        if (rest) cur.evidencia = rest.replace(/^["“”']+|["“”']+$/g, "");
        continue;
      }
    }

    if (section === "leitura") {
      leituraBuf.push(line);
    } else if (section === "sintese") {
      // linhas tipo "- chave: valor" ou "chave: valor"
      const item = line.match(/^\s*[-*•]?\s*([A-Za-z0-9_ ][A-Za-z0-9_ \-]*?)\s*:\s*(.+)$/);
      if (item) {
        const key = item[1].trim().toLowerCase().replace(/\s+/g, "_");
        cur.sintese[key] = item[2].trim();
      }
    } else if (section === "evidencia") {
      const t = line.trim();
      if (t) cur.evidencia = (cur.evidencia ? `${cur.evidencia} ${t}` : t).replace(/^["“”']+|["“”']+$/g, "");
    }
  }
  commitSectionSwitch();
  if (cur) chapters.push(cur);
  return { chapters, observacoes: observacoesBuf.join("\n").trim(), sumario };
}



export const ingestFinalReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { sessaoId: string; base64: string; mime: string; filename: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const text = await stripBase64ToText(data.base64, data.mime, data.filename);
    if (!text.trim()) throw new Error("Documento vazio");

    const { chapters: parsed, observacoes, sumario } = parseFinalReport(text);
    if (!parsed.length)
      throw new Error(
        'Nenhum capítulo reconhecido. Use cabeçalhos "## Capítulo N — Título" no documento.',
      );


    const { data: interview, error: iErr } = await supabase
      .from("interviews")
      .select("id, roteiro_id")
      .eq("id", data.sessaoId)
      .maybeSingle();
    if (iErr) throw new Error(iErr.message);
    if (!interview?.roteiro_id) throw new Error("Sessão sem roteiro vinculado");

    const { data: capitulos, error: cErr } = await supabase
      .from("capitulos")
      .select("id, codigo, titulo, ordem, campos_matriz")
      .eq("roteiro_id", interview.roteiro_id)
      .order("ordem");
    if (cErr) throw new Error(cErr.message);
    if (!capitulos?.length) throw new Error("Roteiro sem capítulos");

    // Casa parsed→capítulo por ordem, depois por título normalizado, depois por código.
    const byOrdem = new Map<number, any>();
    const byTitulo = new Map<string, any>();
    const byCodigo = new Map<string, any>();
    for (const c of capitulos as any[]) {
      if (c.ordem != null) byOrdem.set(c.ordem, c);
      byTitulo.set(normalize(c.titulo ?? ""), c);
      byCodigo.set(normalize(c.codigo ?? ""), c);
    }

    let filled = 0;
    const unmatched: string[] = [];
    for (const p of parsed) {
      let cap: any = null;
      if (p.ordem != null) cap = byOrdem.get(p.ordem) ?? null;
      if (!cap) {
        const n = normalize(p.titulo);
        cap = byTitulo.get(n) ?? byCodigo.get(n) ?? null;
      }
      if (!cap) {
        unmatched.push(`${p.ordem ?? "?"} — ${p.titulo}`);
        continue;
      }

      // Filtra síntese só para campos válidos do capítulo (não inventa nada).
      const camposValidos: string[] = Array.isArray(cap.campos_matriz) ? cap.campos_matriz : [];
      const sintese: Record<string, any> = {};
      for (const k of camposValidos) if (p.sintese[k] != null) sintese[k] = p.sintese[k];

      // Highlights editoriais: lidos verbatim, apenas removendo aspas externas.
      const stripQuotes = (s: string) =>
        String(s).trim().replace(/^["“”'‘’]+|["“”'‘’]+$/g, "").trim();
      const highlights: string[] = [];
      if (p.sintese["highlight_1"]) highlights.push(stripQuotes(p.sintese["highlight_1"]));
      if (p.sintese["highlight_2"]) highlights.push(stripQuotes(p.sintese["highlight_2"]));
      if (highlights.length) sintese.highlights = highlights;

      const respostaTexto = p.evidencia ? `Evidência: "${p.evidencia}"` : "";

      const { data: existing } = await supabase
        .from("sessao_capitulos")
        .select("id")
        .eq("sessao_id", interview.id)
        .eq("capitulo_id", cap.id)
        .maybeSingle();

      const payload: any = {
        sessao_id: interview.id,
        capitulo_id: cap.id,
        leitura_estrategica: p.leitura,
        resposta_texto: respostaTexto,
        sintese,
        origem: "final",
        status_revisao: "revisado",
      };

      if (existing?.id) {
        await supabase.from("sessao_capitulos").update(payload).eq("id", existing.id);
      } else {
        await supabase.from("sessao_capitulos").insert(payload);
      }
      filled++;
    }

    // Se houver texto fora de qualquer capítulo, anexa em interviews.observacoes.
    if (observacoes) {
      const { data: cur } = await supabase
        .from("interviews")
        .select("observacoes")
        .eq("id", interview.id)
        .maybeSingle();
      const prev = (cur?.observacoes ?? "").trim();
      const merged = prev
        ? `${prev}\n\n---\n[Do relatório final] ${observacoes}`
        : `[Do relatório final] ${observacoes}`;
      await supabase.from("interviews").update({ observacoes: merged }).eq("id", interview.id);
    }

    // Persiste Sumário Executivo em interviews.respostas.__sumario_executivo__
    if (sumario) {
      const { data: curInt } = await supabase
        .from("interviews")
        .select("respostas")
        .eq("id", interview.id)
        .maybeSingle();
      const prev = (curInt?.respostas ?? {}) as Record<string, any>;
      const nextRespostas = { ...prev, __sumario_executivo__: sumario };
      await supabase.from("interviews").update({ respostas: nextRespostas }).eq("id", interview.id);
    }

    return { filled, total: capitulos.length, unmatched, observacoes, sumario };
  });

