import * as XLSX from "xlsx";

/** Tipos de material aceitos pelo Relatório Geral. */
export type GeneralFileKind =
  "sheet" | "image" | "audio" | "video" | "presentation" | "pdf" | "document" | "text" | "outro";

const EXT_KIND: Record<string, GeneralFileKind> = {
  xlsx: "sheet",
  xls: "sheet",
  xlsm: "sheet",
  csv: "sheet",
  ods: "sheet",
  tsv: "sheet",
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  gif: "image",
  heic: "image",
  mp3: "audio",
  wav: "audio",
  m4a: "audio",
  ogg: "audio",
  aac: "audio",
  opus: "audio",
  webm: "audio",
  mp4: "video",
  mov: "video",
  mkv: "video",
  avi: "video",
  m4v: "video",
  pptx: "presentation",
  ppt: "presentation",
  pdf: "pdf",
  docx: "document",
  doc: "document",
  txt: "text",
  md: "text",
  json: "text",
  rtf: "text",
};

export function detectKind(fileName: string, mime?: string | null): GeneralFileKind {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "webm" && mime?.startsWith("video/")) return "video";
  if (EXT_KIND[ext]) return EXT_KIND[ext];
  if (mime?.startsWith("image/")) return "image";
  if (mime?.startsWith("audio/")) return "audio";
  if (mime?.startsWith("video/")) return "video";
  if (mime?.startsWith("text/")) return "text";
  return "outro";
}

export const KIND_LABEL: Record<GeneralFileKind, string> = {
  sheet: "Planilha",
  image: "Imagem",
  audio: "Áudio",
  video: "Vídeo",
  presentation: "Apresentação",
  pdf: "PDF",
  document: "Documento",
  text: "Texto",
  outro: "Arquivo",
};

export type Cell = string | number | null;
export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: Cell[][];
  rowCount: number;
  truncated: boolean;
}

const MAX_ROWS = 3000;
const MAX_COLS = 40;
const MAX_SHEETS = 12;

/** Lê xlsx/xls/csv/ods e devolve abas limpas (cabeçalho = primeira linha não vazia). */
export function parseSpreadsheet(data: Uint8Array | ArrayBuffer): ParsedSheet[] {
  const wb = XLSX.read(data, { type: "array" });
  const out: ParsedSheet[] = [];
  for (const name of wb.SheetNames.slice(0, MAX_SHEETS)) {
    const raw = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name], {
      header: 1,
      blankrows: false,
      defval: null,
    });
    const first = raw.findIndex((r) => Array.isArray(r) && r.some((c) => c !== null && c !== ""));
    if (first < 0) continue;
    const headerRow = (raw[first] as unknown[]).slice(0, MAX_COLS);
    const headers = headerRow.map((h, i) =>
      h == null || h === "" ? `Coluna ${i + 1}` : String(h).trim(),
    );
    const body = raw.slice(first + 1);
    const rows: Cell[][] = body.slice(0, MAX_ROWS).map((r) =>
      headers.map((_, i) => {
        const v = (r as unknown[])[i];
        if (v == null || v === "") return null;
        if (typeof v === "number") return Number.isFinite(v) ? v : null;
        if (v instanceof Date) return v.toISOString().slice(0, 10);
        return String(v);
      }),
    );
    out.push({ name, headers, rows, rowCount: body.length, truncated: body.length > MAX_ROWS });
  }
  return out;
}

const num = (c: Cell): number | null => {
  if (typeof c === "number") return c;
  if (typeof c !== "string") return null;
  const s = c.replace(/[R$\s%]/g, "");
  if (!/^-?[\d.,]+$/.test(s)) return null;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) ? n : null;
};

/** Resumo compacto de uma aba para o prompt da IA (colunas, tipos, estatísticas, amostra). */
export function summarizeSheet(sheet: ParsedSheet): string {
  const cols = sheet.headers.map((h, i) => {
    const vals = sheet.rows.map((r) => r[i]).filter((v) => v !== null);
    const nums = vals.map(num).filter((n): n is number => n !== null);
    if (vals.length && nums.length / vals.length > 0.8) {
      const sum = nums.reduce((a, b) => a + b, 0);
      return `- "${h}" (número) soma=${round(sum)} média=${round(sum / nums.length)} mín=${round(Math.min(...nums))} máx=${round(Math.max(...nums))}`;
    }
    const distinct = new Set(vals.map(String));
    const top = [...distinct].slice(0, 6).join(" | ");
    return `- "${h}" (texto) ${distinct.size} valores distintos: ${top}`;
  });
  const sample = sheet.rows
    .slice(0, 8)
    .map((r) => r.map((c) => (c === null ? "" : String(c))).join(" ; "))
    .join("\n");
  return `Aba "${sheet.name}" — ${sheet.rowCount} linhas${sheet.truncated ? ` (analisadas as ${sheet.rows.length} primeiras)` : ""}\nColunas:\n${cols.join("\n")}\nAmostra:\n${sample}`;
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

export type ChartKind = "bar" | "line" | "area" | "pie";
export type ChartAgg = "sum" | "avg" | "count" | "none";
export interface ChartSpecInput {
  kind: ChartKind;
  title?: string;
  fileId: string;
  sheet: string;
  x: string;
  ys: string[];
  agg?: ChartAgg;
  limit?: number;
  insight?: string;
}
export interface ResolvedChart {
  kind: ChartKind;
  title: string;
  x: string;
  series: string[];
  data: Array<Record<string, string | number>>;
  insight?: string;
  source?: string;
  /** Referência para recalcular o gráfico a partir da planilha (revisão por IA). */
  spec?: Pick<ChartSpecInput, "fileId" | "sheet" | "x" | "ys" | "agg" | "limit">;
}

/**
 * Monta os dados de um gráfico a partir da planilha real — a IA só escolhe colunas e agregação,
 * nunca digita os números. Devolve null quando a referência é inválida.
 */
export function resolveChart(spec: ChartSpecInput, sheet: ParsedSheet): ResolvedChart | null {
  const xi = sheet.headers.indexOf(spec.x);
  const yis = (spec.ys ?? []).map((y) => sheet.headers.indexOf(y)).filter((i) => i >= 0);
  const agg: ChartAgg = spec.agg ?? "sum";
  if (xi < 0 || (agg !== "count" && !yis.length)) return null;
  const seriesNames = agg === "count" ? ["Quantidade"] : yis.map((i) => sheet.headers[i]);
  const groups = new Map<string, { n: number; sums: number[]; counts: number[] }>();
  for (const r of sheet.rows) {
    const k = r[xi] == null ? "(vazio)" : String(r[xi]);
    const g = groups.get(k) ?? {
      n: 0,
      sums: seriesNames.map(() => 0),
      counts: seriesNames.map(() => 0),
    };
    g.n += 1;
    if (agg !== "count") {
      yis.forEach((yi, j) => {
        const v = num(r[yi]);
        if (v !== null) {
          g.sums[j] += v;
          g.counts[j] += 1;
        }
      });
    }
    groups.set(k, g);
  }
  let data = [...groups.entries()].map(([k, g]) => {
    const row: Record<string, string | number> = { [spec.x]: k };
    seriesNames.forEach((s, j) => {
      row[s] =
        agg === "count"
          ? g.n
          : agg === "avg"
            ? g.counts[j]
              ? round(g.sums[j] / g.counts[j])
              : 0
            : round(g.sums[j]);
    });
    return row;
  });
  if (agg === "none" && groups.size !== sheet.rows.length) {
    // sem agregação: uma linha por registro
    data = sheet.rows.map((r) => {
      const row: Record<string, string | number> = {
        [spec.x]: r[xi] == null ? "(vazio)" : String(r[xi]),
      };
      yis.forEach((yi, j) => (row[seriesNames[j]] = num(r[yi]) ?? 0));
      return row;
    });
  }
  const limit = Math.min(Math.max(spec.limit ?? 12, 2), 30);
  // ordem cronológica/original para linhas e áreas; ranking para barras e pizza
  if (spec.kind === "bar" || spec.kind === "pie") {
    data.sort((a, b) => Number(b[seriesNames[0]]) - Number(a[seriesNames[0]]));
  }
  data = data.slice(0, limit);
  if (!data.length) return null;
  return {
    kind: spec.kind,
    title: spec.title?.trim() || `${seriesNames.join(", ")} por ${spec.x}`,
    x: spec.x,
    series: seriesNames,
    data,
    insight: spec.insight?.trim() || undefined,
    source: `${sheet.name}`,
    spec: {
      fileId: spec.fileId,
      sheet: sheet.name,
      x: spec.x,
      ys: spec.ys ?? [],
      agg,
      limit: spec.limit,
    },
  };
}

// ---------------------------------------------------------------------------
// Relatório (estrutura devolvida pela IA, normalizada)
// ---------------------------------------------------------------------------
export type ReportBlock =
  | { type: "text"; text: string }
  | { type: "bullets"; title?: string; items: string[] }
  | { type: "kpis"; items: Array<{ label: string; value: string; hint?: string }> }
  | ({ type: "chart" } & ResolvedChart)
  | { type: "table"; title?: string; columns: string[]; rows: string[][] }
  | { type: "image"; fileId: string; caption: string; observations: string[] }
  | { type: "callout"; tone: "destaque" | "atencao" | "oportunidade"; text: string };

export interface ReportChapter {
  title: string;
  summary?: string;
  blocks: ReportBlock[];
}
export interface GeneralReportContent {
  title: string;
  subtitle?: string;
  executive_summary: string;
  chapters: ReportChapter[];
  gaps?: string[];
}

const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strs = (v: unknown, max = 20) =>
  Array.isArray(v)
    ? v
        .map((x) => str(x, 600))
        .filter(Boolean)
        .slice(0, max)
    : [];

export interface NormalizeCtx {
  sheets: Map<string, ParsedSheet[]>; // fileId -> abas
  imageIds: Set<string>;
}

/** Valida/limpa o JSON da IA: descarta blocos inválidos e resolve gráficos com dados reais. */
export function normalizeReport(raw: any, ctx: NormalizeCtx): GeneralReportContent {
  const chapters: ReportChapter[] = [];
  for (const ch of Array.isArray(raw?.chapters) ? raw.chapters.slice(0, 14) : []) {
    const blocks: ReportBlock[] = [];
    for (const b of Array.isArray(ch?.blocks) ? ch.blocks.slice(0, 24) : []) {
      switch (b?.type) {
        case "text": {
          const text = str(b.text, 4000);
          if (text) blocks.push({ type: "text", text });
          break;
        }
        case "bullets": {
          const items = strs(b.items);
          if (items.length)
            blocks.push({ type: "bullets", title: str(b.title, 200) || undefined, items });
          break;
        }
        case "kpis": {
          const items = (Array.isArray(b.items) ? b.items : [])
            .map((k: any) => ({
              label: str(k?.label, 80),
              value: str(k?.value, 40),
              hint: str(k?.hint, 160) || undefined,
            }))
            .filter((k: any) => k.label && k.value)
            .slice(0, 8);
          if (items.length) blocks.push({ type: "kpis", items });
          break;
        }
        case "chart": {
          const sheets = ctx.sheets.get(String(b.fileId));
          const sheet = sheets?.find((s) => s.name === b.sheet) ?? sheets?.[0];
          if (!sheet || !["bar", "line", "area", "pie"].includes(b.kind)) break;
          const resolved = resolveChart(
            {
              kind: b.kind,
              title: str(b.title, 160),
              fileId: String(b.fileId),
              sheet: sheet.name,
              x: str(b.x, 120),
              ys: strs(b.ys, 4),
              agg: ["sum", "avg", "count", "none"].includes(b.agg) ? b.agg : "sum",
              limit: Number(b.limit) || undefined,
              insight: str(b.insight, 400),
            },
            sheet,
          );
          if (resolved) blocks.push({ type: "chart", ...resolved });
          break;
        }
        case "table": {
          const columns = strs(b.columns, 8);
          const rows = (Array.isArray(b.rows) ? b.rows : [])
            .slice(0, 30)
            .map((r: unknown) =>
              Array.isArray(r) ? r.slice(0, columns.length).map((c) => str(c, 200)) : [],
            )
            .filter((r: string[]) => r.length);
          if (columns.length && rows.length)
            blocks.push({ type: "table", title: str(b.title, 200) || undefined, columns, rows });
          break;
        }
        case "image": {
          const fileId = String(b.fileId ?? "");
          if (!ctx.imageIds.has(fileId)) break;
          blocks.push({
            type: "image",
            fileId,
            caption: str(b.caption, 300),
            observations: strs(b.observations, 6),
          });
          break;
        }
        case "callout": {
          const text = str(b.text, 800);
          const tone = ["destaque", "atencao", "oportunidade"].includes(b.tone)
            ? b.tone
            : "destaque";
          if (text) blocks.push({ type: "callout", tone, text });
          break;
        }
      }
    }
    const title = str(ch?.title, 160);
    if (title && blocks.length)
      chapters.push({ title, summary: str(ch?.summary, 600) || undefined, blocks });
  }
  return {
    title: str(raw?.title, 200) || "Relatório Geral",
    subtitle: str(raw?.subtitle, 300) || undefined,
    executive_summary: str(raw?.executive_summary, 3000),
    chapters,
    gaps: strs(raw?.gaps, 10),
  };
}

/** Normaliza um único bloco devolvido pela IA (revisão de bloco). */
export function normalizeBlock(raw: unknown, ctx: NormalizeCtx): ReportBlock | null {
  const r = normalizeReport({ chapters: [{ title: "x", blocks: [raw] }] }, ctx);
  return r.chapters[0]?.blocks[0] ?? null;
}
