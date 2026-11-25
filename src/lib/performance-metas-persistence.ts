// Performance → METAS: formato do estado gravado no banco (tabelas performance_goal_*)
// e conversões puras entre o banco e os rascunhos da tela.
// Gravação/leitura: `performance-metas.functions.ts` (RPCs com checagem de papel).

import {
  CANONICAL_FAMILIES,
  normalizeFamilyName,
  normalizeText,
  type CanonicalFamily,
} from "./client-bi-familias";
import { getPerformancePortfolioTarget } from "./performance-portfolio-targets";
import type {
  AiConfianca,
  AiSuggestionTag,
  BaseFinanceira,
  BaseFonte,
  FamilyMetaDraft,
  MetaOrigem,
  SavePayload,
} from "./performance-metas";

export type GoalsCycle = {
  id: string;
  inicio: string; // YYYY-MM-01
  fim: string; // YYYY-MM-01 (último mês do ciclo)
  client_id?: string | null;
  vinculo_confirmado_em?: string | null;
};

export type GoalReviewStatus =
  | "nao_convidado"
  | "pendente"
  | "respondido"
  | "reabertura_solicitada"
  | "reaberto";

export type GoalReview = {
  status: GoalReviewStatus;
  invited_at?: string | null;
  submitted_at?: string | null;
  reopen_requested_at?: string | null;
  reopen_request_note?: string | null;
  reopened_at?: string | null;
};

type RawJson = Record<string, number | string | null>;

export type GoalsState = {
  /** Ciclo vigente (contém o mês corrente; ou o último, se vencido). */
  cycle: GoalsCycle | null;
  /** Próximo ciclo, já criado por renovação antecipada (só gestão). */
  proximo?: GoalsCycle | null;
  items: Array<{
    familia: string;
    meta_mensal: number | null;
    origem?: MetaOrigem;
    comentario_gestor?: string;
    vigente_desde?: string;
  }>;
  /** Versões já gravadas que passam a valer em competências futuras (só gestão). */
  agendadas?: Array<{ familia: string; meta_mensal: number | null; vigente_desde: string }>;
  rep_suggestions: Array<{
    familia: string;
    valor: number | null;
    justificativa: string;
    created_at?: string;
    updated_at?: string;
  }>;
  ai_suggestions: Array<{
    familia: string;
    valor: number;
    justificativa: string;
    tag: AiSuggestionTag;
    /** "simulacao" = registro antigo da fase de protótipo (ignorado na tela). */
    origem: "simulacao" | "modelo";
    /** Base da recomendação registrada junto com a sugestão. */
    base?: AiBase | null;
    modelo?: string | null;
    created_at?: string;
    confianca?: AiConfianca | null;
    participacao?: number | string | null;
    analise_id?: string | null;
  }>;
  /** Valores financeiros do upload (R$). Só na visão da gestão. */
  base?: { metas?: RawJson; realizado?: RawJson; media?: RawJson; familia_pct?: RawJson };
};

/** Base da recomendação da IA, montada no servidor a partir dos dados usados no prompt. */
export type AiBase = {
  fontes?: Array<"imersao" | "historico" | "perfil" | "comparaveis" | "upload">;
  imersao?: {
    entrevistas: number;
    formularios?: number;
    relatorios: number;
    ultima: string | null;
  };
  /** Leitura geral do cliente feita pela análise. */
  resumo?: string;
  historico?: { periodos: number };
  comparaveis?: { clientes: number; regiao: string | null; categoria: string | null };
  perfil?: { categoria: string | null; cidade: string | null; estado: string | null };
};

const fmtData = (iso: string | null | undefined) => {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y.slice(-2)}` : null;
};

/** Resumo legível da base da recomendação. */
export function fundamentoLabel(base: AiBase | null | undefined): string {
  if (!base) return "";
  const out: string[] = [];
  const im = base.imersao;
  if (im && im.entrevistas + (im.formularios ?? 0) + im.relatorios > 0) {
    const partes = [
      im.entrevistas ? `${im.entrevistas} entrevista(s)` : null,
      im.formularios ? `${im.formularios} formulário(s)` : null,
      im.relatorios ? `${im.relatorios} relatório(s) de campo` : null,
    ].filter(Boolean);
    const data = fmtData(im.ultima);
    out.push(`Imersão${data ? ` ${data}` : ""}: ${partes.join(", ")}`);
  }
  if (base.historico?.periodos) out.push(`${base.historico.periodos} período(s) de histórico`);
  if (base.comparaveis?.clientes)
    out.push(
      `${base.comparaveis.clientes} comparáveis${base.comparaveis.regiao ? ` (${base.comparaveis.regiao})` : ""}`,
    );
  if (base.perfil?.categoria) out.push(`perfil ${base.perfil.categoria}`);
  return out.join(" · ");
}

/** `available: false` = migration ainda não aplicada (funções inexistentes no banco). */
export type MetasLoadResult = { available: false } | { available: true; state: GoalsState };

const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && v !== "" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

export function lookupFamilyNum(record: unknown, family: string): number | null {
  if (!record || typeof record !== "object") return null;
  const rec = record as Record<string, unknown>;
  if (rec[family] !== undefined) return num(rec[family]);
  const normTarget = normalizeText(family);
  for (const [k, v] of Object.entries(rec)) {
    if (normalizeText(k) === normTarget) return num(v);
  }
  return null;
}

/**
 * Valor vendido comparável à meta mensal, por portfólio, a partir do backend:
 * venda realizada (R$) → média histórica (R$) → atingimento × meta do upload (estimado).
 */
export function baseFromBackend(
  base: GoalsState["base"],
  categoria?: string | null,
): BaseFinanceira {
  const out: BaseFinanceira = {};
  if (!base) return out;
  for (const f of CANONICAL_FAMILIES) {
    const real = lookupFamilyNum(base.realizado, f);
    const media = lookupFamilyNum(base.media, f);
    const pct = lookupFamilyNum(base.familia_pct, f);
    const meta = lookupFamilyNum(base.metas, f) ?? getPerformancePortfolioTarget(categoria, f);
    if (real != null && real >= 0) out[f] = { valor: real, fonte: "realizado" };
    else if (media != null && media >= 0) out[f] = { valor: media, fonte: "media" };
    else if (pct != null && pct >= 0 && meta != null && meta > 0)
      out[f] = { valor: (Math.abs(pct) <= 2.5 ? pct : pct / 100) * meta, fonte: "estimado" };
  }
  return out;
}

const isFamily = (f: string): f is CanonicalFamily =>
  (CANONICAL_FAMILIES as readonly string[]).includes(f);

/** Aplica o que está gravado sobre os rascunhos iniciais (portfólios sem registro ficam no padrão). */
export function hydrateDrafts(initial: FamilyMetaDraft[], state: GoalsState): FamilyMetaDraft[] {
  const items = new Map(state.items.filter((i) => isFamily(i.familia)).map((i) => [i.familia, i]));
  const reps = new Map(state.rep_suggestions.map((s) => [s.familia, s]));
  // Registros "simulacao" são da fase de protótipo: não aparecem como sugestão real.
  const ais = new Map(
    state.ai_suggestions.filter((s) => s.origem === "modelo").map((s) => [s.familia, s]),
  );
  return initial.map((d) => {
    const it = items.get(d.familia);
    const rep = reps.get(d.familia);
    const ai = ais.get(d.familia);
    return {
      ...d,
      ...(it && {
        metaOficial: it.meta_mensal,
        origem: it.origem ?? d.origem,
        comentarioGestor: it.comentario_gestor ?? "",
      }),
      ...(rep && {
        sugestaoRep: rep.valor,
        justificativaRep: rep.justificativa,
        sugestaoRepEnviadaEm: rep.updated_at ?? rep.created_at ?? null,
      }),
      ...(ai && {
        sugestaoIa: {
          valor: ai.valor,
          justificativa: ai.justificativa,
          tag: ai.tag,
          fundamento: fundamentoLabel(ai.base),
          confianca: ai.confianca ?? null,
          participacao: num(ai.participacao),
          resumo: ai.base?.resumo ?? "",
          geradaEm: ai.created_at,
        },
      }),
    };
  });
}

/** Argumentos da RPC da gestão a partir do payload do gestor. */
export function gestorRpcArgs(payload: Extract<SavePayload, { perfil: "gestor" }>) {
  return {
    metas: payload.metas.map((m) => ({
      familia: m.familia,
      meta_mensal: m.meta_oficial,
      origem: m.origem,
      comentario_gestor: m.comentario_gestor,
      referencia: m.referencia,
    })),
  };
}

export type RepGoalsView = Omit<GoalsState, "base" | "ai_suggestions" | "agendadas" | "proximo"> & {
  atingimento: Partial<Record<CanonicalFamily, { ratio: number; fonte: BaseFonte }>>;
  /** Razão social do cliente (preenchida pelo servidor do portal). */
  cliente?: string;
  /** Categoria do cliente (Black, Gold, Silver). */
  categoria?: string | null;
  /** Período da Performance usada para calcular o atingimento. */
  performance_period?: {
    label: string | null;
    inicio: string | null;
    fim: string | null;
  };
  /** Envios anteriores, sanitizados e agrupados por transação. */
  suggestion_history?: RepSuggestionSubmission[];
  review: GoalReview;
};

export type RepSuggestionSubmission = {
  sent_at: string;
  items: Array<{
    familia: CanonicalFamily;
    valor: number | null;
    justificativa: string;
  }>;
};

export type RepSuggestionHistorySource = {
  changed_at: string;
  familia: string | null;
  dados_novos: unknown;
};

/** Agrupa as linhas do histórico gravadas na mesma transação em um único envio seguro. */
export function groupRepSuggestionHistory(
  rows: readonly RepSuggestionHistorySource[],
): RepSuggestionSubmission[] {
  const groups = new Map<string, RepSuggestionSubmission>();
  for (const row of rows) {
    if (!row.familia || !isFamily(row.familia) || !row.changed_at) continue;
    const raw =
      row.dados_novos && typeof row.dados_novos === "object"
        ? (row.dados_novos as Record<string, unknown>)
        : {};
    const parsed = raw.valor == null || raw.valor === "" ? null : Number(raw.valor);
    const item = {
      familia: row.familia,
      valor: parsed != null && Number.isFinite(parsed) ? parsed : null,
      justificativa: typeof raw.justificativa === "string" ? raw.justificativa : "",
    };
    const group = groups.get(row.changed_at) ?? { sent_at: row.changed_at, items: [] };
    group.items.push(item);
    groups.set(row.changed_at, group);
  }
  return [...groups.values()].sort((a, b) => b.sent_at.localeCompare(a.sent_at));
}

/**
 * Visão do representante: atingimento calculado no servidor sobre a meta oficial gravada,
 * sem enviar valores do upload (metas padrão/realizado) nem sugestões da IA.
 * Se a gestão ainda não personalizou as metas, utiliza como meta oficial a meta padrão da categoria.
 */
export function repView(
  state: GoalsState,
  categoria?: string | null,
  fallbackFamiliaPct?: Record<string, unknown> | null,
): RepGoalsView {
  const base = baseFromBackend(state.base, categoria);
  const atingimento: RepGoalsView["atingimento"] = {};

  const savedMap = new Map(
    (state.items ?? []).filter((i) => isFamily(i.familia)).map((i) => [i.familia, i.meta_mensal]),
  );

  const effectiveItems = CANONICAL_FAMILIES.map((familia) => {
    const savedMeta = savedMap.get(familia);
    const meta_mensal =
      savedMeta !== undefined ? savedMeta : getPerformancePortfolioTarget(categoria, familia);
    return {
      familia,
      meta_mensal,
    };
  });

  for (const it of effectiveItems) {
    const b = base[it.familia];
    if (b && it.meta_mensal != null && it.meta_mensal > 0) {
      atingimento[it.familia] = { ratio: b.valor / it.meta_mensal, fonte: b.fonte };
    } else {
      const pct =
        lookupFamilyNum(state.base?.familia_pct, it.familia) ??
        lookupFamilyNum(fallbackFamiliaPct, it.familia);
      if (pct != null && pct >= 0) {
        const ratio = Math.abs(pct) <= 2.5 ? pct : pct / 100;
        atingimento[it.familia] = { ratio, fonte: "estimado" };
      }
    }
  }

  return {
    cycle: state.cycle && { id: state.cycle.id, inicio: state.cycle.inicio, fim: state.cycle.fim },
    items: effectiveItems,
    rep_suggestions: state.rep_suggestions ?? [],
    atingimento,
    review: { status: "nao_convidado" },
    categoria: categoria ?? null,
  };
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const monthLabel = (iso: string) => {
  const [y, m] = iso.split("-").map(Number);
  return `${MESES[m - 1]}/${String(y).slice(-2)}`;
};

/** "2º semestre 2026 (jul/26 – dez/26)"; `vencido` quando o último mês já passou. */
export function cycleInfo(cycle: GoalsCycle, today = new Date()) {
  const [y1, m1] = cycle.inicio.split("-").map(Number);
  const [y2, m2] = cycle.fim.split("-").map(Number);
  const meses = (y2 - y1) * 12 + (m2 - m1) + 1;
  const atual = today.getFullYear() * 12 + today.getMonth();
  const range = `${monthLabel(cycle.inicio)} – ${monthLabel(cycle.fim)}`;
  // Ciclo semestral fixo: 1º semestre (jan–jun) ou 2º semestre (jul–dez).
  const semestral = meses === 6 && (m1 === 1 || m1 === 7);
  const sem = m1 <= 6 ? 1 : 2;
  const proxSem = sem === 1 ? 2 : 1;
  const proxAno = sem === 1 ? y1 : y1 + 1;
  return {
    label: semestral ? `${sem}º semestre ${y1} (${range})` : range,
    meses,
    vencido: y2 * 12 + (m2 - 1) < atual,
    proximoLabel: `${proxSem}º semestre ${proxAno}`,
  };
}

/** Competências (YYYY-MM-01) disponíveis para uma nova meta: meses do ciclo vigente e do
 *  próximo (se já renovado), ou do semestre corrente quando ainda não há ciclo. Padrão: mês corrente (ou o primeiro mês disponível depois dele). */
export function competenciasDoCiclo(
  cycle: GoalsCycle | null,
  proximo: GoalsCycle | null = null,
  today = new Date(),
) {
  const idx = (iso: string) => {
    const [y, m] = iso.split("-").map(Number);
    return y * 12 + m - 1;
  };
  const iso = (k: number) => `${Math.floor(k / 12)}-${String((k % 12) + 1).padStart(2, "0")}-01`;
  const atual = today.getFullYear() * 12 + today.getMonth();
  // Sem ciclo: o semestre corrente (jan–jun ou jul–dez), que é o ciclo criado ao salvar.
  const semIni = today.getFullYear() * 12 + (today.getMonth() < 6 ? 0 : 6);
  const faixas: Array<[number, number]> = cycle
    ? [[idx(cycle.inicio), idx(cycle.fim)]]
    : [[semIni, semIni + 5]];
  if (cycle && proximo) faixas.push([idx(proximo.inicio), idx(proximo.fim)]);
  const meses: string[] = [];
  for (const [a, b] of faixas) for (let k = a; k <= b; k++) meses.push(iso(k));
  const padrao = meses.find((m) => idx(m) >= atual) ?? meses[meses.length - 1];
  return { meses, padrao };
}
