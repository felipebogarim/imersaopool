import * as XLSX from "xlsx";

/** Tipos de material aceitos pelo Relatório Geral. */
export type GeneralFileKind =
  | "sheet"
  | "image"
  | "audio"
  | "video"
  | "presentation"
  | "pdf"
  | "document"
  | "text"
  | "outro";

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
export type FilterOp = ">" | ">=" | "<" | "<=" | "=" | "!=";
/** Coluna calculada linha a linha: a (op) b, onde b é outra coluna ou um número. */
export interface ComputedColumn {
  name: string;
  a: string;
  op: "-" | "+" | "*" | "/";
  b: string | number;
}
/** Filtro de linhas: column (op) value, onde value é número, texto ou {column} para comparar colunas. */
export interface RowFilter {
  column: string;
  op: FilterOp;
  value: string | number | { column: string };
}
export interface ChartSpecInput {
  kind: ChartKind;
  computed?: ComputedColumn[];
  where?: RowFilter[];
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
  spec?: Pick<
    ChartSpecInput,
    "fileId" | "sheet" | "x" | "ys" | "agg" | "limit" | "computed" | "where"
  >;
}

/**
 * Monta os dados de um gráfico a partir da planilha real — a IA só escolhe colunas e agregação,
 * nunca digita os números. Devolve null quando a referência é inválida.
 */
const FILTER_OPS: FilterOp[] = [">", ">=", "<", "<=", "=", "!="];
const COMPUTE_OPS = ["-", "+", "*", "/"] as const;

/** Acrescenta colunas calculadas e aplica filtros de linha, sempre sobre os dados reais da planilha. */
export function prepareSheet(
  sheet: ParsedSheet,
  computed: ComputedColumn[] = [],
  where: RowFilter[] = [],
): ParsedSheet | null {
  const headers = [...sheet.headers];
  let rows = sheet.rows.map((r) => [...r]);
  for (const c of computed) {
    if (!c?.name || headers.includes(c.name) || !COMPUTE_OPS.includes(c.op as any)) return null;
    const ai = headers.indexOf(c.a);
    const bi = typeof c.b === "string" ? headers.indexOf(c.b) : -1;
    const bConst = typeof c.b === "number" ? c.b : num(c.b as Cell);
    if (ai < 0 || (bi < 0 && bConst === null)) return null;
    headers.push(c.name);
    rows = rows.map((r) => {
      const a = num(r[ai]);
      const b = bi >= 0 ? num(r[bi]) : bConst;
      let v: number | null = null;
      if (a !== null && b !== null) {
        v = c.op === "-" ? a - b : c.op === "+" ? a + b : c.op === "*" ? a * b : b ? a / b : null;
      }
      return [...r, v === null ? null : round(v)];
    });
  }
  for (const f of where) {
    const ci = headers.indexOf(f?.column);
    if (ci < 0 || !FILTER_OPS.includes(f.op)) return null;
    const other =
      f.value && typeof f.value === "object" ? headers.indexOf((f.value as any).column) : -1;
    if (f.value && typeof f.value === "object" && other < 0) return null;
    rows = rows.filter((r) => {
      const left = r[ci];
      const right = other >= 0 ? r[other] : (f.value as string | number);
      const ln = num(left);
      const rn = typeof right === "number" ? right : num(right as Cell);
      if (ln !== null && rn !== null) {
        switch (f.op) {
          case ">":
            return ln > rn;
          case ">=":
            return ln >= rn;
          case "<":
            return ln < rn;
          case "<=":
            return ln <= rn;
          case "=":
            return ln === rn;
          case "!=":
            return ln !== rn;
        }
      }
      if (f.op !== "=" && f.op !== "!=") return false;
      const eq =
        String(left ?? "")
          .trim()
          .toLowerCase() ===
        String(right ?? "")
          .trim()
          .toLowerCase();
      return f.op === "=" ? eq : !eq;
    });
  }
  return { ...sheet, headers, rows };
}

export function resolveChart(spec: ChartSpecInput, original: ParsedSheet): ResolvedChart | null {
  const sheet = prepareSheet(original, spec.computed, spec.where);
  if (!sheet) return null;
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
      ...(spec.computed?.length ? { computed: spec.computed } : {}),
      ...(spec.where?.length ? { where: spec.where } : {}),
    },
  };
}

// ---------------------------------------------------------------------------
// Relatório (estrutura devolvida pela IA, normalizada)
// ---------------------------------------------------------------------------
/** Bloco do usuário: "criado" (Novo bloco) ou "editado" (edição manual). Sobrevive a regerar/revisar. */
export type BlockLock = "criado" | "editado";
export type ReportBlock = (
  | { type: "text"; text: string }
  | { type: "bullets"; title?: string; items: string[] }
  | { type: "kpis"; items: Array<{ label: string; value: string; hint?: string }> }
  | ({ type: "chart" } & ResolvedChart)
  | { type: "table"; title?: string; columns: string[]; rows: string[][] }
  | { type: "image"; fileId: string; caption: string; observations: string[] }
  | { type: "callout"; tone: "destaque" | "atencao" | "oportunidade"; text: string }
) & { locked?: BlockLock };

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
  /** Introdução editada à mão pelo usuário: regerar/revisar mantém título, subtítulo e resumo. */
  intro_locked?: boolean;
}

const str = (v: unknown, max = 2000) =>
  typeof v === "string"
    ? v.trim().slice(0, max)
    : typeof v === "number" && Number.isFinite(v)
      ? String(v)
      : "";
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
              computed: Array.isArray(b.computed) ? b.computed.slice(0, 3) : undefined,
              where: Array.isArray(b.where) ? b.where.slice(0, 4) : undefined,
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

/**
 * Extrai os blocos candidatos de uma resposta da IA, que pode vir como bloco solto,
 * {block}, {blocks:[...]} ou até um relatório inteiro ({chapters:[{blocks}]}).
 */
export function candidateBlocks(raw: any): unknown[] {
  if (!raw || typeof raw !== "object") return [];
  if (Array.isArray(raw)) return raw.flatMap(candidateBlocks);
  if (typeof raw.type === "string") return [raw];
  if (raw.block) return candidateBlocks(raw.block);
  if (Array.isArray(raw.blocks)) return raw.blocks;
  if (Array.isArray(raw.chapters)) return raw.chapters.flatMap((c: any) => c?.blocks ?? []);
  return [];
}

/** Primeiro bloco válido da resposta da IA (ver candidateBlocks). */
export function pickBlock(raw: unknown, ctx: NormalizeCtx): ReportBlock | null {
  for (const c of candidateBlocks(raw)) {
    const b = normalizeBlock(c, ctx);
    if (b) return b;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Análise determinística de comparação de períodos (atual × anterior)
// ---------------------------------------------------------------------------
const PREV_RE = /\b(ly|ano anterior|anterior|aa|py)\b/i;
const pairKey = (h: string) =>
  h
    .toLowerCase()
    .replace(/\b(ly|ano anterior|anterior|atual|aa|py)\b/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s+([).])/g, "$1")
    .trim();

function isNumericCol(sheet: ParsedSheet, i: number) {
  const vals = sheet.rows.map((r) => r[i]).filter((v) => v !== null);
  return vals.length > 0 && vals.map(num).filter((n) => n !== null).length / vals.length > 0.8;
}

/** Pares de colunas numéricas "atual" × "anterior" (ex.: "Média (R$)" × "Média LY (R$)"). */
export function findPeriodPairs(sheet: ParsedSheet): Array<{ cur: number; prev: number }> {
  const out: Array<{ cur: number; prev: number }> = [];
  sheet.headers.forEach((h, pi) => {
    if (!PREV_RE.test(h) || /%|var/i.test(h) || !isNumericCol(sheet, pi)) return;
    const key = pairKey(h);
    const ci = sheet.headers.findIndex(
      (o, i) => i !== pi && !PREV_RE.test(o) && pairKey(o) === key && isNumericCol(sheet, i),
    );
    if (ci >= 0) out.push({ cur: ci, prev: pi });
  });
  // valores em R$ primeiro
  return out.sort(
    (a, b) =>
      Number(/r\$|valor|fatur/i.test(sheet.headers[b.cur])) -
      Number(/r\$|valor|fatur/i.test(sheet.headers[a.cur])),
  );
}

const fmt = (n: number) => Math.round(n).toLocaleString("pt-BR");
const pct = (a: number, b: number) =>
  b ? `${((a / b - 1) * 100).toFixed(1).replace(".", ",")}%` : "n/a";

interface Delta {
  label: string;
  cur: number;
  prev: number;
  d: number;
}
function stats(items: Delta[]) {
  const cur = items.reduce((s, i) => s + i.cur, 0);
  const prev = items.reduce((s, i) => s + i.prev, 0);
  const down = items.filter((i) => i.d < 0).sort((a, b) => a.d - b.d);
  const up = items.filter((i) => i.d > 0).sort((a, b) => b.d - a.d);
  return {
    cur,
    prev,
    net: cur - prev,
    loss: down.reduce((s, i) => s + i.d, 0),
    gain: up.reduce((s, i) => s + i.d, 0),
    down,
    up,
    n: items.length,
  };
}
const who = (list: Delta[], k: number) =>
  list
    .slice(0, k)
    .map((i) => `${i.label} ${i.d > 0 ? "+" : ""}${fmt(i.d)} (${fmt(i.prev)}→${fmt(i.cur)})`)
    .join("; ") || "nenhum";

/**
 * Calcula, a partir das linhas reais, a comparação atual × anterior no total e por grupo (UF,
 * categoria, cidade...): variação líquida, perdas brutas, ganhos brutos e os maiores ofensores.
 * Assim a IA não precisa somar de cabeça e não confunde variação líquida com quedas individuais.
 */
export function periodAnalysis(sheet: ParsedSheet): string {
  const pairs = findPeriodPairs(sheet).slice(0, 2);
  if (!pairs.length) return "";
  const textCols = sheet.headers.map((_, i) => i).filter((i) => !isNumericCol(sheet, i));
  const distinct = (i: number) =>
    new Set(sheet.rows.map((r) => r[i]).filter((v) => v !== null && v !== "")).size;
  const labelCol = textCols.sort((a, b) => distinct(b) - distinct(a))[0] ?? -1;
  const rows = sheet.rows.filter(
    (r) => !/^\s*(total|soma|geral)\b/i.test(String(labelCol >= 0 ? (r[labelCol] ?? "") : "")),
  );
  const groupCols = sheet.headers
    .map((_, i) => i)
    .filter((i) => !isNumericCol(sheet, i) && i !== labelCol)
    .filter((i) => {
      const d = distinct(i);
      const filled = rows.filter((r) => r[i] !== null && r[i] !== "").length;
      return d >= 2 && d <= 20 && filled >= rows.length * 0.6;
    })
    .slice(0, 4);

  const out: string[] = [];
  for (const { cur, prev } of pairs) {
    const items: Delta[] = rows
      .map((r) => {
        const c = num(r[cur]) ?? 0;
        const p = num(r[prev]) ?? 0;
        return {
          label: labelCol >= 0 ? String(r[labelCol] ?? "(sem nome)") : "",
          cur: c,
          prev: p,
          d: c - p,
          row: r,
        };
      })
      .filter((i) => i.cur || i.prev);
    const all = stats(items);
    const hc = sheet.headers[cur];
    const hp = sheet.headers[prev];
    out.push(
      `ANÁLISE CALCULADA (exata, use estes números) — "${hc}" (atual) × "${hp}" (anterior), aba "${sheet.name}", ${all.n} registros:`,
      `- TOTAL: anterior ${fmt(all.prev)} → atual ${fmt(all.cur)} | variação LÍQUIDA ${fmt(all.net)} (${pct(all.cur, all.prev)}) | perdas BRUTAS ${fmt(all.loss)} em ${all.down.length} registros | ganhos BRUTOS +${fmt(all.gain)} em ${all.up.length} registros`,
      `- Maiores quedas: ${who(all.down, 8)}`,
      `- Maiores crescimentos: ${who(all.up, 8)}`,
    );
    for (const gi of groupCols) {
      const groups = new Map<string, Delta[]>();
      for (const it of items) {
        const k = String((it as any).row[gi] ?? "(vazio)");
        groups.set(k, [...(groups.get(k) ?? []), it]);
      }
      out.push(`- Por "${sheet.headers[gi]}":`);
      for (const [k, list] of [...groups.entries()].sort(
        (a, b) => stats(a[1]).net - stats(b[1]).net,
      )) {
        const s = stats(list);
        out.push(
          `  · ${k}: ${s.n} registros | anterior ${fmt(s.prev)} → atual ${fmt(s.cur)} | líquida ${fmt(s.net)} (${pct(s.cur, s.prev)}) | perdas brutas ${fmt(s.loss)} (${s.down.length}) | ganhos brutos +${fmt(s.gain)} (${s.up.length}) | quedas: ${who(s.down, 3)} | crescimentos: ${who(s.up, 3)}`,
        );
      }
    }
  }
  return out.join("\n");
}

/** Todas as linhas da aba (até maxChars), para a IA enxergar cada registro e não só a amostra. */
export function sheetRowsText(sheet: ParsedSheet, maxChars = 30000): string {
  const cell = (c: Cell) =>
    c === null ? "" : typeof c === "number" ? String(round(c)) : String(c).slice(0, 140);
  const lines = [`Linhas da aba "${sheet.name}" (${sheet.headers.join(" ; ")}):`];
  let size = lines[0].length;
  let shown = 0;
  for (const r of sheet.rows) {
    const line = r.map(cell).join(" ; ");
    if (size + line.length > maxChars) break;
    lines.push(line);
    size += line.length + 1;
    shown += 1;
  }
  if (shown < sheet.rows.length) lines.push(`(+${sheet.rows.length - shown} linhas não listadas)`);
  return lines.join("\n");
}

/** Texto completo de uma aba para a IA: resumo de colunas, análise calculada e linhas. */
export function sheetMaterial(sheet: ParsedSheet, maxChars = 30000): string {
  const analysis = periodAnalysis(sheet);
  const head = [summarizeSheet(sheet), analysis].filter(Boolean).join("\n");
  return `${head}\n${sheetRowsText(sheet, Math.max(4000, maxChars - head.length))}`;
}

// ---------------------------------------------------------------------------
// Preservação das alterações do usuário ao regerar / revisar
// ---------------------------------------------------------------------------
export interface LockedBlock {
  chapterIdx: number;
  chapterTitle: string;
  blockIdx: number;
  block: ReportBlock;
}

/** Blocos criados ou editados pelo usuário, com a posição original. */
export function lockedBlocks(content: GeneralReportContent | null | undefined): LockedBlock[] {
  const out: LockedBlock[] = [];
  content?.chapters?.forEach((ch, ci) =>
    ch.blocks.forEach((b, bi) => {
      if (b.locked) out.push({ chapterIdx: ci, chapterTitle: ch.title, blockIdx: bi, block: b });
    }),
  );
  return out;
}

/** Cópia do relatório sem os blocos do usuário (para a IA reescrever só o resto). */
export function withoutLocked(content: GeneralReportContent): GeneralReportContent {
  return {
    ...content,
    chapters: content.chapters
      .map((ch) => ({ ...ch, blocks: ch.blocks.filter((b) => !b.locked) }))
      .filter((ch) => ch.blocks.length),
  };
}

const normTitle = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/**
 * Junta o relatório novo da IA com as alterações do usuário do relatório anterior: blocos
 * criados/editados voltam ao capítulo de mesmo título (ou de mesma posição; se não houver, a um
 * capítulo com o título antigo) na posição original; introdução editada à mão é mantida.
 */
export function mergeUserChanges(
  prev: GeneralReportContent | null | undefined,
  next: GeneralReportContent,
): GeneralReportContent {
  if (!prev) return next;
  const chapters = next.chapters.map((c) => ({ ...c, blocks: [...c.blocks] }));
  for (const lb of lockedBlocks(prev)) {
    let target = chapters.find((c) => normTitle(c.title) === normTitle(lb.chapterTitle));
    if (!target) target = chapters[lb.chapterIdx];
    if (!target) {
      target = { title: lb.chapterTitle, blocks: [] };
      chapters.push(target);
    }
    target.blocks.splice(Math.min(lb.blockIdx, target.blocks.length), 0, lb.block);
  }
  const merged: GeneralReportContent = { ...next, chapters };
  if (prev.intro_locked) {
    merged.title = prev.title;
    merged.subtitle = prev.subtitle;
    merged.executive_summary = prev.executive_summary;
    merged.intro_locked = true;
  }
  return merged;
}

/** Texto para o prompt: o que o usuário fez e que será mantido (a IA não deve repetir). */
export function userChangesPrompt(prev: GeneralReportContent | null | undefined): string {
  if (!prev) return "";
  const blocks = lockedBlocks(prev);
  const parts: string[] = [];
  if (prev.intro_locked)
    parts.push(
      `INTRODUÇÃO ESCRITA PELO USUÁRIO (será mantida como está; alinhe o relatório a ela): ${JSON.stringify({ title: prev.title, subtitle: prev.subtitle ?? "", executive_summary: prev.executive_summary })}`,
    );
  if (blocks.length)
    parts.push(
      `BLOCOS DO USUÁRIO (serão mantidos como estão, nos capítulos indicados; NÃO crie blocos que repitam o mesmo conteúdo):\n${blocks
        .map((b) => {
          const { data: _d, ...rest } = b.block as any;
          return `- capítulo "${b.chapterTitle}": ${JSON.stringify(rest).slice(0, 1500)}`;
        })
        .join("\n")}`,
    );
  return parts.join("\n\n");
}
