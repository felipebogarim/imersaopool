import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  normalizeReport,
  parseSpreadsheet,
  summarizeSheet,
  type GeneralFileKind,
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

/** Gera o relatório por capítulos a partir de todos os arquivos já lidos. */
export const generateGeneralReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { reportId: string; instructions?: string }) => d)
  .handler(async ({ data, context }) => {
    const supabase = context.supabase as any;
    const { data: report, error } = await supabase
      .from("general_reports")
      .select("id, report_date, representative_id")
      .eq("id", data.reportId)
      .maybeSingle();
    if (error || !report) throw new Error(error?.message ?? "Relatório não encontrado");

    const { data: files } = await supabase
      .from("general_report_files")
      .select("id, file_name, kind, status, extracted")
      .eq("report_id", report.id)
      .order("created_at");
    const ready = (files ?? []).filter((f: any) => f.status === "lido" && f.extracted);
    if (!ready.length) throw new Error("Nenhum arquivo foi lido ainda. Envie ao menos um arquivo.");

    let repName = "";
    if (report.representative_id) {
      const { data: rep } = await supabase
        .from("representatives")
        .select("nome")
        .eq("id", report.representative_id)
        .maybeSingle();
      repName = rep?.nome ?? "";
    }

    await supabase
      .from("general_reports")
      .update({ status: "gerando", error_message: null })
      .eq("id", report.id);
    try {
      const sheets = new Map<string, ParsedSheet[]>();
      const imageIds = new Set<string>();
      let budget = 120000;
      const sections = ready.map((f: any) => {
        if (f.kind === "sheet") sheets.set(f.id, f.extracted.sheets as ParsedSheet[]);
        if (f.kind === "image") imageIds.add(f.id);
        const text = String(f.extracted.text ?? "").slice(
          0,
          Math.max(2000, Math.min(30000, budget)),
        );
        budget -= text.length;
        return `### ARQUIVO fileId="${f.id}" nome="${f.file_name}" tipo=${f.kind}\n${text}`;
      });

      const user = `Representante: ${repName || "não informado"}\nData da imersão: ${report.report_date}\n${
        data.instructions?.trim() ? `Instruções do usuário: ${data.instructions.trim()}\n` : ""
      }\nMATERIAL:\n\n${sections.join("\n\n")}`;

      const raw = await callGateway({
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: user },
        ],
      });
      let parsed: any;
      try {
        parsed = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
      } catch {
        throw new Error("A IA devolveu um relatório em formato inválido. Tente gerar novamente.");
      }
      const content = normalizeReport(parsed, { sheets, imageIds });
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
