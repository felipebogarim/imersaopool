// Importação de relatório pronto (Relatório Geral): contrato JSON v1, validação e formatação.
// Regra de ouro: aqui só se VALIDA e FORMATA. Nenhum indicador é recalculado ou deduzido.

export const IMPORT_SCHEMA_VERSION = 1;

export interface ImportPeriod {
  /** Texto aprovado do período (ex.: "Novembro de 2025 a Outubro de 2026 versus mesmo período ano anterior"). */
  label?: string;
  /** Datas confirmadas (AAAA-MM-DD). Nunca deduzidas. */
  start?: string;
  end?: string;
}

export interface IntroTheme {
  headline: string;
  detail?: string;
}
export interface UfResult {
  uf: string;
  previous_cents: number;
  current_cents: number;
  change_cents: number;
  change_pct: number;
}
export interface LossRow {
  position: number;
  account: string;
  uf: string;
  previous_cents: number;
  current_cents: number;
  change_cents: number;
  change_pct: number;
  note?: string;
}
export interface GrowthItem {
  account: string;
  uf: string;
  gain_cents: number;
}
export interface NoBaseItem {
  account: string;
  uf: string;
  current_cents: number;
}
export interface ComparisonItem {
  account: string;
  uf: string;
  previous_cents: number;
  current_cents: number;
  gain_cents: number;
  gain_pct: number;
}
export interface ReasonItem {
  account: string;
  uf: string;
  previous_cents: number;
  current_cents: number;
  gain_cents: number;
  note?: string;
}

export type ImportBlock =
  | { type: "intro"; title?: string; subtitle?: string; themes: IntroTheme[] }
  | {
      type: "overall_result";
      title?: string;
      previous_cents: number;
      current_cents: number;
      change_cents: number;
      change_pct: number;
    }
  | { type: "monthly_by_state"; title?: string; items: UfResult[] }
  | {
      type: "loss_concentration";
      title?: string;
      scope_gross_loss_cents: number;
      scope_share_pct: number;
      scope_records: number;
      rows: LossRow[];
    }
  | { type: "top10_growth"; title?: string; items: GrowthItem[]; no_base?: NoBaseItem[] }
  | { type: "top6_comparison"; title?: string; items: ComparisonItem[] }
  | { type: "top6_reasons"; title?: string; items: ReasonItem[] };

export interface ImportedReport {
  schema_version: 1;
  report_id: string;
  title: string;
  representative_name: string;
  company?: string;
  period: ImportPeriod;
  blocks: ImportBlock[];
}

export const BLOCK_TYPES = [
  "intro",
  "overall_result",
  "monthly_by_state",
  "loss_concentration",
  "top10_growth",
  "top6_comparison",
  "top6_reasons",
] as const;

export interface ImportIssue {
  /** Caminho do campo/bloco afetado, ex.: blocks[2].rows[0].current_cents */
  path: string;
  message: string;
}
export type ImportResult =
  | { ok: true; data: ImportedReport; issues: [] }
  | { ok: false; data: null; issues: ImportIssue[] };

/* ---------------------------- validação ---------------------------- */

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;
const isDate = (v: unknown): v is string =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(new Date(`${v}T12:00:00Z`).getTime()) &&
  new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v;

export function validateImport(raw: unknown): ImportResult {
  const issues: ImportIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });

  const str = (o: Record<string, unknown>, k: string, p: string, required = true) => {
    const v = o[k];
    if (v === undefined || v === null) {
      if (required) add(`${p}.${k}`, "campo obrigatório ausente");
    } else if (typeof v !== "string") add(`${p}.${k}`, "deve ser texto");
    else if (required && !v.trim()) add(`${p}.${k}`, "não pode ficar vazio");
  };
  const cents = (o: Record<string, unknown>, k: string, p: string) => {
    const v = o[k];
    if (v === undefined || v === null) add(`${p}.${k}`, "valor ausente (não é assumido como zero)");
    else if (typeof v !== "number" || !Number.isSafeInteger(v))
      add(`${p}.${k}`, "deve ser um número inteiro em centavos");
  };
  const pct = (o: Record<string, unknown>, k: string, p: string) => {
    const v = o[k];
    if (v === undefined || v === null) add(`${p}.${k}`, "valor ausente (não é assumido como zero)");
    else if (typeof v !== "number" || !Number.isFinite(v))
      add(`${p}.${k}`, "deve ser número em pontos percentuais (ex.: -18.3)");
  };
  const optStr = (o: Record<string, unknown>, k: string, p: string) => {
    const v = o[k];
    if (v !== undefined && v !== null && typeof v !== "string") add(`${p}.${k}`, "deve ser texto");
  };
  const list = (o: Record<string, unknown>, k: string, p: string, min = 1) => {
    const v = o[k];
    if (!Array.isArray(v)) {
      add(`${p}.${k}`, "deve ser uma lista");
      return [] as unknown[];
    }
    if (v.length < min) add(`${p}.${k}`, `deve ter ao menos ${min} item(ns)`);
    return v as unknown[];
  };

  if (!isObj(raw)) {
    return { ok: false, data: null, issues: [{ path: "$", message: "o JSON deve ser um objeto" }] };
  }
  if (raw.schema_version !== IMPORT_SCHEMA_VERSION)
    add("schema_version", `versão não suportada (esperado ${IMPORT_SCHEMA_VERSION})`);
  str(raw, "report_id", "$");
  str(raw, "title", "$");
  str(raw, "representative_name", "$");
  optStr(raw, "company", "$");

  const period = raw.period;
  if (!isObj(period)) add("period", "campo obrigatório ausente");
  else {
    const hasLabel = isStr(period.label);
    if (period.label !== undefined && period.label !== null && typeof period.label !== "string")
      add("period.label", "deve ser texto");
    for (const k of ["start", "end"] as const)
      if (period[k] !== undefined && period[k] !== null && !isDate(period[k]))
        add(`period.${k}`, "data inválida (use AAAA-MM-DD)");
    const hasS = isDate(period.start);
    const hasE = isDate(period.end);
    if (hasS !== hasE) add("period", "informe início e fim juntos (ou apenas o texto aprovado)");
    else if (hasS && hasE && String(period.start) > String(period.end))
      add("period", "a data de início é posterior à data de fim");
    if (!hasLabel && !(hasS && hasE))
      add("period", "informe o texto aprovado (label) ou as datas confirmadas (start e end)");
  }

  const blocks = Array.isArray(raw.blocks) ? raw.blocks : null;
  if (!blocks || !blocks.length) add("blocks", "deve ser uma lista com ao menos um bloco");

  (blocks ?? []).forEach((b, i) => {
    const p = `blocks[${i}]`;
    if (!isObj(b)) return add(p, "bloco inválido");
    const type = b.type;
    if (!BLOCK_TYPES.includes(type as never))
      return add(`${p}.type`, `tipo de bloco não reconhecido: ${JSON.stringify(type)}`);
    optStr(b, "title", p);
    switch (type) {
      case "intro": {
        optStr(b, "subtitle", p);
        list(b, "themes", p).forEach((t, k) => {
          const q = `${p}.themes[${k}]`;
          if (!isObj(t)) return add(q, "tema inválido");
          str(t, "headline", q);
          optStr(t, "detail", q);
        });
        break;
      }
      case "overall_result":
        for (const k of ["previous_cents", "current_cents", "change_cents"]) cents(b, k, p);
        pct(b, "change_pct", p);
        break;
      case "monthly_by_state":
        list(b, "items", p).forEach((it, k) => {
          const q = `${p}.items[${k}]`;
          if (!isObj(it)) return add(q, "item inválido");
          str(it, "uf", q);
          for (const f of ["previous_cents", "current_cents", "change_cents"]) cents(it, f, q);
          pct(it, "change_pct", q);
        });
        break;
      case "loss_concentration": {
        cents(b, "scope_gross_loss_cents", p);
        pct(b, "scope_share_pct", p);
        const n = b.scope_records;
        if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 0)
          add(
            `${p}.scope_records`,
            "deve ser um número inteiro (quantidade de registros do recorte)",
          );
        list(b, "rows", p).forEach((r, k) => {
          const q = `${p}.rows[${k}]`;
          if (!isObj(r)) return add(q, "linha inválida");
          if (typeof r.position !== "number" || !Number.isSafeInteger(r.position))
            add(`${q}.position`, "deve ser um número inteiro");
          str(r, "account", q);
          str(r, "uf", q);
          for (const f of ["previous_cents", "current_cents", "change_cents"]) cents(r, f, q);
          pct(r, "change_pct", q);
          optStr(r, "note", q);
        });
        break;
      }
      case "top10_growth": {
        list(b, "items", p).forEach((it, k) => {
          const q = `${p}.items[${k}]`;
          if (!isObj(it)) return add(q, "item inválido");
          str(it, "account", q);
          str(it, "uf", q);
          cents(it, "gain_cents", q);
        });
        if (b.no_base !== undefined && b.no_base !== null)
          list(b, "no_base", p, 0).forEach((it, k) => {
            const q = `${p}.no_base[${k}]`;
            if (!isObj(it)) return add(q, "item inválido");
            str(it, "account", q);
            str(it, "uf", q);
            cents(it, "current_cents", q);
          });
        break;
      }
      case "top6_comparison":
        list(b, "items", p).forEach((it, k) => {
          const q = `${p}.items[${k}]`;
          if (!isObj(it)) return add(q, "item inválido");
          str(it, "account", q);
          str(it, "uf", q);
          for (const f of ["previous_cents", "current_cents", "gain_cents"]) cents(it, f, q);
          pct(it, "gain_pct", q);
        });
        break;
      case "top6_reasons":
        list(b, "items", p).forEach((it, k) => {
          const q = `${p}.items[${k}]`;
          if (!isObj(it)) return add(q, "item inválido");
          str(it, "account", q);
          str(it, "uf", q);
          for (const f of ["previous_cents", "current_cents", "gain_cents"]) cents(it, f, q);
          optStr(it, "note", q);
        });
        break;
    }
  });

  // Top 6: o quadro de motivos precisa ter as mesmas contas, na mesma ordem, do comparativo.
  if (blocks) {
    const idxC = blocks.findIndex((b) => isObj(b) && b.type === "top6_comparison");
    const idxR = blocks.findIndex((b) => isObj(b) && b.type === "top6_reasons");
    if (idxC >= 0 !== idxR >= 0) {
      add(
        "blocks",
        "o Top 6 exige os dois blocos: top6_comparison (comparativo) e top6_reasons (motivos)",
      );
    } else if (idxC >= 0) {
      const a = (blocks[idxC] as Record<string, unknown>).items;
      const r = (blocks[idxR] as Record<string, unknown>).items;
      if (Array.isArray(a) && Array.isArray(r)) {
        const key = (x: unknown) =>
          isObj(x) ? `${String(x.account ?? "").trim()}|${String(x.uf ?? "").trim()}` : "?";
        if (a.length !== r.length)
          add(
            `blocks[${idxR}].items`,
            `o quadro de motivos tem ${r.length} conta(s) e o comparativo tem ${a.length}`,
          );
        a.slice(0, Math.max(a.length, r.length)).forEach((x, k) => {
          if (r[k] !== undefined && key(x) !== key(r[k]))
            add(
              `blocks[${idxR}].items[${k}]`,
              `conta/UF diferente do comparativo na posição ${k + 1} (esperado "${key(x).replace("|", " · ")}", recebido "${key(r[k]).replace("|", " · ")}")`,
            );
        });
        if (r.length > a.length)
          r.slice(a.length).forEach((_x, k) =>
            add(`blocks[${idxR}].items[${a.length + k}]`, "conta que não existe no comparativo"),
          );
      }
    }
  }

  return issues.length
    ? { ok: false, data: null, issues }
    : { ok: true, data: raw as unknown as ImportedReport, issues: [] };
}

/** Lê o texto do arquivo JSON; erro de sintaxe vira uma pendência legível. */
export function parseImportJson(text: string): ImportResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text.replace(/^\uFEFF/, ""));
  } catch (e) {
    return {
      ok: false,
      data: null,
      issues: [
        {
          path: "$",
          message: `JSON inválido: ${e instanceof Error ? e.message : "erro de sintaxe"}`,
        },
      ],
    };
  }
  return validateImport(raw);
}

/* ---------------------------- formatação pt-BR ---------------------------- */

const MINUS = "−";

/** Centavos inteiros → "R$ 573.200,16" (sinal opcional: "−R$ 105.013,97" / "+R$ 83.825,00"). */
export function formatBRL(cents: number, opts: { sign?: boolean } = {}): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const int = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const dec = String(abs % 100).padStart(2, "0");
  const sign = neg ? MINUS : opts.sign && cents > 0 ? "+" : "";
  return `${sign}R$ ${int},${dec}`;
}

/** Pontos percentuais → "−18,3%" (uma casa decimal; sinal opcional para ganhos). */
export function formatPct(p: number, opts: { sign?: boolean } = {}): string {
  const rounded = Math.round(Math.abs(p) * 10) / 10;
  const body = rounded.toFixed(1).replace(".", ",");
  const sign = p < 0 && rounded !== 0 ? MINUS : opts.sign && p > 0 && rounded !== 0 ? "+" : "";
  return `${sign}${body}%`;
}

export type Trend = "down" | "up" | "flat";
export const trendOf = (changeCents: number): Trend =>
  changeCents < 0 ? "down" : changeCents > 0 ? "up" : "flat";

/** Texto do período: label aprovado; senão as datas confirmadas. Nunca deduz nada. */
export function periodText(period: ImportPeriod): string {
  if (period.label?.trim()) return period.label.trim();
  if (period.start && period.end) {
    const f = (d: string) => d.split("-").reverse().join("/");
    return `${f(period.start)} a ${f(period.end)}`;
  }
  return "";
}

/** Relato comercial exatamente como veio; ausente vira traço (nunca texto inventado). */
export const noteText = (n: string | undefined | null) => (n && n.trim() ? n : "—");

/** SHA-256 hex (identidade do PDF anexado). */
export async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** O arquivo é um PDF de verdade (assinatura %PDF-), não só uma extensão. */
export function looksLikePdf(head: Uint8Array): boolean {
  return head.length >= 5 && String.fromCharCode(...head.slice(0, 5)) === "%PDF-";
}
