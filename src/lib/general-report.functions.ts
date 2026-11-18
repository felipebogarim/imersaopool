import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  normalizeBlock,
  normalizeReport,
  parseSpreadsheet,
  summarizeSheet,
  type GeneralFileKind,
  type GeneralReportContent,
  type ParsedSheet,
} from "@/lib/general-report-lib";

const BUCKET = "general-reports";
const MAX_AI_BYTES = 20 * 1024 * 1024;
const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-2.5-flash";

async function callGateway(body: Record<string, unknown>): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY ausente");
  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, ...body }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`IA indisponível (${res.status}) ${t.slice(0, 200)}`);
  }
  const json = await res.json();
  return String(json?.choices?.[0]?.message?.content ?? "").trim();
}

const toB64 = (buf: ArrayBuffer) => Buffer.from(buf).toString("base64");

async function pptxText(buf: ArrayBuffer): Promise<string> {
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(buf);
  const slides = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  const out: string[] = [];
  for (const [i, name] of slides.entries()) {
    const xml = await zip.files[name].async("string");
    const parts = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
    out.push(
      `Slide ${i + 1}: ${parts.join(" ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")}`,
    );
  }
  return out.join("\n");
}

const IMAGE_PROMPT =
  "Analise esta imagem para compor um relatório comercial, em português. Descreva de forma objetiva: " +
  "(1) o que é (ambiente, loja, produto, material, documento, gráfico, print); (2) elementos visuais relevantes " +
  "(exposição, vitrine, iluminação, marcas, cores, organização, estado de conservação, pessoas, textos legíveis); " +
  "(3) pontos fortes e pontos de atenção que se veem; (4) todo texto/números visíveis, transcritos. " +
  "Não invente o que não aparece.";

/** Lê UM arquivo do relatório (planilha, imagem, áudio, vídeo, apresentação, PDF, texto) e grava o conteúdo extraído. */
export const processGeneralReportFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { fileId: string }) => d)
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const { data: file, error } = await supabase
      .from("general_report_files")
      .select("id, storage_path, file_name, mime_type, size_bytes, kind")
      .eq("id", data.fileId)
      .maybeSingle();
    if (error || !file) throw new Error(error?.message ?? "Arquivo não encontrado");

    await supabase
      .from("general_report_files")
      .update({ status: "processando", error_message: null })
      .eq("id", file.id);
    try {
      const dl = await supabase.storage.from(BUCKET).download(file.storage_path);
      if (dl.error || !dl.data) throw new Error(dl.error?.message ?? "Falha ao baixar o arquivo");
      const buf: ArrayBuffer = await dl.data.arrayBuffer();
      const kind = file.kind as GeneralFileKind;
      const mime = file.mime_type || "application/octet-stream";
      let extracted: Record<string, unknown>;

      if (kind === "sheet") {
        const sheets = parseSpreadsheet(new Uint8Array(buf));
        if (!sheets.length) throw new Error("Planilha vazia");
        extracted = { kind, sheets, text: sheets.map(summarizeSheet).join("\n\n") };
      } else if (kind === "text") {
        extracted = { kind, text: Buffer.from(buf).toString("utf-8").slice(0, 60000) };
      } else if (kind === "document" && file.file_name.toLowerCase().endsWith(".docx")) {
        const mammoth = await import("mammoth");
        const r = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
        extracted = { kind, text: r.value.slice(0, 60000) };
      } else if (kind === "presentation" && file.file_name.toLowerCase().endsWith(".pptx")) {
        extracted = { kind, text: (await pptxText(buf)).slice(0, 60000) };
      } else {
        if (buf.byteLength > MAX_AI_BYTES) {
          throw new Error(
            "Arquivo acima de 20 MB: a IA não consegue lê-lo. Envie uma versão menor.",
          );
        }
        const dataUrl = `data:${mime};base64,${toB64(buf)}`;
        let content: any[];
        if (kind === "image") {
          content = [
            { type: "text", text: IMAGE_PROMPT },
            { type: "image_url", image_url: { url: dataUrl } },
          ];
        } else {
          const prompt =
            kind === "audio" || kind === "video"
              ? "Transcreva a fala deste arquivo em português e, ao final, liste os principais assuntos, decisões, números e pendências citados. Texto corrido, sem inventar."
              : "Extraia o conteúdo relevante deste arquivo em português (títulos, textos, números, tabelas), de forma organizada e fiel.";
          content = [
            { type: "text", text: prompt },
            { type: "file", file: { filename: file.file_name, file_data: dataUrl } },
          ];
        }
        const text = await callGateway({ messages: [{ role: "user", content }] });
        if (!text) throw new Error("A IA não devolveu conteúdo para este arquivo");
        extracted = { kind, text: text.slice(0, 60000) };
      }

      await supabase
        .from("general_report_files")
        .update({ status: "lido", extracted, error_message: null })
        .eq("id", file.id);
      return { ok: true as const };
    } catch (e: any) {
      const message = String(e?.message ?? e).slice(0, 400);
      await supabase
        .from("general_report_files")
        .update({ status: "erro", error_message: message })
        .eq("id", file.id);
      return { ok: false as const, error: message };
    }
  });

const SYSTEM = `Você é um analista sênior de inteligência comercial da PoolFlux. Recebe o conteúdo já extraído de vários arquivos (planilhas, imagens, áudios, vídeos, apresentações, textos) de uma imersão comercial com um representante e gera um RELATÓRIO OBJETIVO, PRÁTICO e MUITO VISUAL, organizado em capítulos.

Regras:
- Não existe modelo fixo: escolha os capítulos que o material pede (ex.: panorama, números, análise visual, falas e percepções, riscos, oportunidades, próximos passos). Material de planilha → capítulo(s) de números com gráficos; imagens → capítulo de análise visual; áudio/vídeo/texto → percepções e decisões.
- Seja objetivo: frases curtas, sem enrolação, sem repetir o que os blocos já mostram.
- Priorize blocos visuais: kpis, charts, tables, callouts. Use texto corrido só quando necessário.
- Nunca invente dados. Gráficos: você NÃO digita números; indique fileId, aba (sheet), coluna do eixo X (x), colunas numéricas (ys), agregação (agg: sum|avg|count|none) e tipo (kind: bar|line|area|pie), usando SOMENTE nomes exatos de colunas informados. Prefira line/area para séries no tempo, bar para rankings, pie para até 6 fatias.
- Para cada planilha relevante, crie ao menos 1 gráfico (idealmente 2–4 com ângulos diferentes) e acompanhe de um "insight" curto dizendo o que o gráfico mostra.
- Para cada imagem relevante, crie um bloco image (fileId exato) com caption e observations (o que se vê, pontos fortes e de atenção).
- Se algo estiver ilegível, ausente ou contraditório, registre em "gaps".

Responda SOMENTE com JSON:
{
 "title": string, "subtitle": string, "executive_summary": string (3-5 frases),
 "chapters": [ { "title": string, "summary": string (1 frase),
   "blocks": [
     {"type":"text","text":string},
     {"type":"bullets","title":string,"items":[string]},
     {"type":"kpis","items":[{"label":string,"value":string,"hint":string}]},
     {"type":"chart","kind":"bar|line|area|pie","title":string,"fileId":string,"sheet":string,"x":string,"ys":[string],"agg":"sum|avg|count|none","limit":number,"insight":string},
     {"type":"table","title":string,"columns":[string],"rows":[[string]]},
     {"type":"image","fileId":string,"caption":string,"observations":[string]},
     {"type":"callout","tone":"destaque|atencao|oportunidade","text":string}
   ] } ],
 "gaps": [string]
}`;

/** Carrega o material já lido (texto por arquivo, planilhas e ids de imagens) de um relatório. */
async function loadMaterial(supabase: any, reportId: string) {
  const { data: files } = await supabase
    .from("general_report_files")
    .select("id, file_name, kind, status, extracted")
    .eq("report_id", reportId)
    .order("created_at");
  const ready = (files ?? []).filter((f: any) => f.status === "lido" && f.extracted);
  const sheets = new Map<string, ParsedSheet[]>();
  const imageIds = new Set<string>();
  let budget = 120000;
  const sections = ready.map((f: any) => {
    if (f.kind === "sheet") sheets.set(f.id, f.extracted.sheets as ParsedSheet[]);
    if (f.kind === "image") imageIds.add(f.id);
    const text = String(f.extracted.text ?? "").slice(0, Math.max(2000, Math.min(30000, budget)));
    budget -= text.length;
    return `### ARQUIVO fileId="${f.id}" nome="${f.file_name}" tipo=${f.kind}\n${text}`;
  });
  return { ready, sheets, imageIds, material: sections.join("\n\n") };
}

function parseJson(raw: string): any {
  try {
    return JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
  } catch {
    throw new Error("A IA devolveu uma resposta em formato inválido. Tente novamente.");
  }
}

async function loadReport(supabase: any, reportId: string) {
  const { data: report, error } = await supabase
    .from("general_reports")
    .select("id, report_date, representative_id, report")
    .eq("id", reportId)
    .maybeSingle();
  if (error || !report) throw new Error(error?.message ?? "Relatório não encontrado");
  let repName = "";
  if (report.representative_id) {
    const { data: rep } = await supabase
      .from("representatives")
      .select("nome")
      .eq("id", report.representative_id)
      .maybeSingle();
    repName = rep?.nome ?? "";
  }
  return { report, repName };
}

const SCHEMA_HINT = SYSTEM.slice(SYSTEM.indexOf("Responda SOMENTE"));

/** Gera o relatório por capítulos a partir de todos os arquivos já lidos. */
export const generateGeneralReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reportId: string; instructions?: string }) => d)
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const { report, repName } = await loadReport(supabase, data.reportId);
    const { ready, sheets, imageIds, material } = await loadMaterial(supabase, report.id);
    if (!ready.length) throw new Error("Nenhum arquivo foi lido ainda. Envie ao menos um arquivo.");

    await supabase
      .from("general_reports")
      .update({ status: "gerando", error_message: null })
      .eq("id", report.id);
    try {
      const user = `Representante: ${repName || "não informado"}\nData da imersão: ${report.report_date}\n${
        data.instructions?.trim() ? `Instruções do usuário: ${data.instructions.trim()}\n` : ""
      }\nMATERIAL:\n\n${material}`;
      const raw = await callGateway({
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
      });
      const content = normalizeReport(parseJson(raw), { sheets, imageIds });
      if (!content.chapters.length)
        throw new Error("A IA não produziu capítulos aproveitáveis. Tente gerar novamente.");
      await supabase
        .from("general_reports")
        .update({
          status: "pronto",
          report: content,
          title: content.title,
          generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", report.id);
      return { ok: true as const };
    } catch (e: any) {
      const message = String(e?.message ?? e).slice(0, 400);
      await supabase
        .from("general_reports")
        .update({ status: "erro", error_message: message })
        .eq("id", report.id);
      return { ok: false as const, error: message };
    }
  });

/** Revisão GERAL: a IA reescreve o relatório inteiro seguindo as orientações, sem sair do material. */
export const reviseGeneralReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reportId: string; instructions: string }) => d)
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    if (!data.instructions?.trim())
      return { ok: false as const, error: "Escreva as orientações para a IA." };
    try {
      const { report, repName } = await loadReport(supabase, data.reportId);
      if (!report.report) throw new Error("Gere o relatório antes de revisar.");
      const { sheets, imageIds, material } = await loadMaterial(supabase, report.id);
      const user = `Representante: ${repName || "não informado"}\nData: ${report.report_date}\n\nORIENTAÇÕES DE REVISÃO (obrigatórias):\n${data.instructions.trim()}\n\nRELATÓRIO ATUAL (JSON; gráficos trazem "spec" com fileId/sheet/x/ys/agg — reaproveite-os no formato de entrada, sem digitar números):\n${JSON.stringify(report.report).slice(0, 60000)}\n\nMATERIAL ORIGINAL:\n\n${material}`;
      const raw = await callGateway({
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `${SYSTEM}\n\nVocê está REVISANDO um relatório existente: aplique as orientações, mantenha o que estiver correto e devolva o relatório COMPLETO atualizado.`,
          },
          { role: "user", content: user },
        ],
      });
      const content = normalizeReport(parseJson(raw), { sheets, imageIds });
      if (!content.chapters.length)
        throw new Error(
          "A revisão não produziu capítulos aproveitáveis. Tente reformular as orientações.",
        );
      await supabase
        .from("general_reports")
        .update({
          report: content,
          title: content.title,
          updated_at: new Date().toISOString(),
          error_message: null,
        })
        .eq("id", report.id);
      return { ok: true as const };
    } catch (e: any) {
      return { ok: false as const, error: String(e?.message ?? e).slice(0, 400) };
    }
  });

/** Revisão de UM bloco: a IA recebe só o bloco (e a fonte dele) e devolve o bloco substituto. */
export const reviseGeneralReportBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { reportId: string; chapterIdx: number; blockIdx: number; instruction: string }) => d,
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    if (!data.instruction?.trim())
      return { ok: false as const, error: "Escreva o que deve ser alterado." };
    try {
      const { report } = await loadReport(supabase, data.reportId);
      const content = report.report as GeneralReportContent | null;
      const chapter = content?.chapters?.[data.chapterIdx];
      const block = chapter?.blocks?.[data.blockIdx];
      if (!content || !chapter || !block)
        throw new Error("Bloco não encontrado (o relatório mudou). Recarregue a página.");

      const { ready, sheets, imageIds } = await loadMaterial(supabase, report.id);
      // Fonte do bloco: planilha do gráfico ou descrição da imagem; nos demais, o texto dos arquivos.
      let source = "";
      const fileId = (block as any).spec?.fileId ?? (block as any).fileId;
      const file = ready.find((f: any) => f.id === fileId);
      if (file)
        source = `FONTE DO BLOCO (fileId="${file.id}" nome="${file.file_name}"):\n${String(file.extracted.text ?? "").slice(0, 20000)}`;
      else
        source = `MATERIAL:\n${ready
          .map(
            (f: any) =>
              `### fileId="${f.id}" ${f.file_name}\n${String(f.extracted.text ?? "").slice(0, 6000)}`,
          )
          .join("\n\n")
          .slice(0, 40000)}`;

      const system = `Você revisa UM bloco de um relatório comercial, em português, de forma objetiva. Altere SOMENTE este bloco conforme o pedido, sem inventar dados que não estejam na fonte. Para gráficos, não digite números: informe fileId, sheet, x, ys, agg (sum|avg|count|none), kind (bar|line|area|pie), title, limit e insight com nomes exatos de colunas. Responda SOMENTE com o JSON de um bloco, no mesmo formato dos blocos do relatório (type: text|bullets|kpis|chart|table|image|callout).\n${SCHEMA_HINT}`;
      const user = `Capítulo: ${chapter.title}\n\nBLOCO ATUAL:\n${JSON.stringify(block)}\n\nPEDIDO DE ALTERAÇÃO:\n${data.instruction.trim()}\n\n${source}`;
      const raw = await callGateway({
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      const parsed = parseJson(raw);
      const next = normalizeBlock(parsed?.block ?? parsed, { sheets, imageIds });
      if (!next) throw new Error("A IA não devolveu um bloco válido. Reformule o pedido.");

      const chapters = content.chapters.map((c, ci) =>
        ci === data.chapterIdx
          ? { ...c, blocks: c.blocks.map((b, bi) => (bi === data.blockIdx ? next : b)) }
          : c,
      );
      await supabase
        .from("general_reports")
        .update({ report: { ...content, chapters }, updated_at: new Date().toISOString() })
        .eq("id", report.id);
      return { ok: true as const };
    } catch (e: any) {
      return { ok: false as const, error: String(e?.message ?? e).slice(0, 400) };
    }
  });

/** Revisão só da introdução (título, subtítulo e resumo), usando os capítulos e o material como fonte. */
export const reviseGeneralReportIntro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reportId: string; instruction: string }) => d)
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    if (!data.instruction?.trim())
      return { ok: false as const, error: "Escreva o que deve ser alterado." };
    try {
      const { report } = await loadReport(supabase, data.reportId);
      const content = report.report as GeneralReportContent | null;
      if (!content) throw new Error("Gere o relatório antes de revisar.");
      const { material } = await loadMaterial(supabase, report.id);
      const outline = content.chapters
        .map((c, i) => `${i + 1}. ${c.title}${c.summary ? ` — ${c.summary}` : ""}`)
        .join("\n");
      const raw = await callGateway({
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'Você revisa a INTRODUÇÃO de um relatório comercial, em português, objetiva e sem inventar dados que não estejam no material. Responda SOMENTE com JSON: {"title": string, "subtitle": string, "executive_summary": string}.',
          },
          {
            role: "user",
            content: `INTRODUÇÃO ATUAL:\n${JSON.stringify({ title: content.title, subtitle: content.subtitle ?? "", executive_summary: content.executive_summary })}\n\nCAPÍTULOS:\n${outline}\n\nPEDIDO DE ALTERAÇÃO:\n${data.instruction.trim()}\n\nMATERIAL:\n${material.slice(0, 50000)}`,
          },
        ],
      });
      const p = parseJson(raw);
      const title = String(p?.title ?? "")
        .trim()
        .slice(0, 200);
      const summary = String(p?.executive_summary ?? "")
        .trim()
        .slice(0, 3000);
      if (!title || !summary)
        throw new Error("A IA não devolveu uma introdução válida. Reformule o pedido.");
      const next = {
        ...content,
        title,
        subtitle:
          String(p?.subtitle ?? "")
            .trim()
            .slice(0, 300) || undefined,
        executive_summary: summary,
      };
      await supabase
        .from("general_reports")
        .update({ report: next, title, updated_at: new Date().toISOString() })
        .eq("id", report.id);
      return { ok: true as const };
    } catch (e: any) {
      return { ok: false as const, error: String(e?.message ?? e).slice(0, 400) };
    }
  });

/** Cria um bloco NOVO no capítulo a partir do que o usuário descreve, usando o material enviado como fonte. */
export const createGeneralReportBlock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { reportId: string; chapterIdx: number; afterIdx: number; instruction: string }) => d,
  )
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    if (!data.instruction?.trim())
      return { ok: false as const, error: "Descreva o que você quer neste bloco." };
    try {
      const { report } = await loadReport(supabase, data.reportId);
      const content = report.report as GeneralReportContent | null;
      const chapter = content?.chapters?.[data.chapterIdx];
      if (!content || !chapter)
        throw new Error("Capítulo não encontrado (o relatório mudou). Recarregue a página.");
      const { sheets, imageIds, material } = await loadMaterial(supabase, report.id);
      const system = `Você cria UM bloco novo para um relatório comercial, em português, objetivo e visual, conforme o pedido do usuário. Use SOMENTE dados do material enviado; não invente. Escolha o tipo de bloco que melhor atende ao pedido (text|bullets|kpis|chart|table|image|callout). Para gráficos, não digite números: informe fileId, sheet, x, ys, agg (sum|avg|count|none), kind (bar|line|area|pie), title, limit e insight com nomes exatos de colunas. Para imagem, use o fileId exato. Responda SOMENTE com o JSON do bloco.\n${SCHEMA_HINT}`;
      const user = `Capítulo onde o bloco entrará: ${chapter.title}\nBlocos já existentes no capítulo (resumo): ${chapter.blocks.map((b) => b.type).join(", ")}\n\nPEDIDO DO USUÁRIO:\n${data.instruction.trim()}\n\nMATERIAL:\n\n${material}`;
      const raw = await callGateway({
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      const parsed = parseJson(raw);
      const block = normalizeBlock(parsed?.block ?? parsed, { sheets, imageIds });
      if (!block)
        throw new Error(
          "A IA não conseguiu montar o bloco com o material disponível. Reformule o pedido.",
        );
      const at = Math.min(Math.max(data.afterIdx + 1, 0), chapter.blocks.length);
      const chapters = content.chapters.map((c, ci) =>
        ci === data.chapterIdx
          ? { ...c, blocks: [...c.blocks.slice(0, at), block, ...c.blocks.slice(at)] }
          : c,
      );
      await supabase
        .from("general_reports")
        .update({ report: { ...content, chapters }, updated_at: new Date().toISOString() })
        .eq("id", report.id);
      return { ok: true as const };
    } catch (e: any) {
      return { ok: false as const, error: String(e?.message ?? e).slice(0, 400) };
    }
  });
