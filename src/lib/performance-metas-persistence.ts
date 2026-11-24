// Performance → METAS: formato do estado gravado no banco (tabelas performance_goal_*)
// e conversões puras entre o banco e os rascunhos da tela.
// Gravação/leitura: `performance-metas.functions.ts` (RPCs com checagem de papel).

import { CANONICAL_FAMILIES, type CanonicalFamily } from "./client-bi-familias";
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
  rep_suggestions: Array<{ familia: string; valor: number | null; justificativa: string }>;
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

/**
 * Valor vendido comparável à meta mensal, por portfólio, a partir do backend:
 * venda realizada (R$) → média histórica (R$) → atingimento × meta do upload (estimado).
 */
export function baseFromBackend(base: GoalsState["base"]): BaseFinanceira {
  const out: BaseFinanceira = {};
  if (!base) return out;
  for (const f of CANONICAL_FAMILIES) {
    const real = num(base.realizado?.[f]);
    const media = num(base.media?.[f]);
    const pct = num(base.familia_pct?.[f]);
    const meta = num(base.metas?.[f]);
    if (real != null && real >= 0) out[f] = { valor: real, fonte: "realizado" };
    else if (media != null && media >= 0) out[f] = { valor: media, fonte: "media" };
    else if (pct != null && pct >= 0 && meta != null && meta > 0)
      out[f] = { valor: pct * meta, fonte: "estimado" };
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
      ...(rep && { sugestaoRep: rep.valor, justificativaRep: rep.justificativa }),
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
};

/**
 * Visão do representante: atingimento calculado no servidor sobre a meta oficial gravada,
 * sem enviar valores do upload (metas padrão/realizado) nem sugestões da IA.
 */
export function repView(state: GoalsState): RepGoalsView {
  const base = baseFromBackend(state.base);
  const atingimento: RepGoalsView["atingimento"] = {};
  for (const it of state.items) {
    const b = isFamily(it.familia) ? base[it.familia] : null;
    if (b && it.meta_mensal != null && it.meta_mensal > 0 && isFamily(it.familia))
      atingimento[it.familia] = { ratio: b.valor / it.meta_mensal, fonte: b.fonte };
  }
  return {
    cycle: state.cycle && { id: state.cycle.id, inicio: state.cycle.inicio, fim: state.cycle.fim },
    items: state.items.map((i) => ({ familia: i.familia, meta_mensal: i.meta_mensal })),
    rep_suggestions: state.rep_suggestions,
    atingimento,
  };
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
export const monthLabel = (iso: string) => {
  const [y, m] = iso.split("-").map(Number);
  return `${MESES[m - 1]}/${String(y).slice(-2)}`;
};

/** "nov/26 – abr/27 · 6 meses"; `vencido` quando o último mês já passou. */
export function cycleInfo(cycle: GoalsCycle, today = new Date()) {
  const [y1, m1] = cycle.inicio.split("-").map(Number);
  const [y2, m2] = cycle.fim.split("-").map(Number);
  const meses = (y2 - y1) * 12 + (m2 - m1) + 1;
  const atual = today.getFullYear() * 12 + today.getMonth();
  return {
    label: `${monthLabel(cycle.inicio)} – ${monthLabel(cycle.fim)}`,
    meses,
    vencido: y2 * 12 + (m2 - 1) < atual,
    podeEstender: meses < 12,
  };
}

/** Competências (YYYY-MM-01) disponíveis para uma nova meta: meses do ciclo vigente e do
 *  próximo (se já renovado), ou de um ciclo de 6 meses a partir do mês corrente quando ainda
 *  não há ciclo. Padrão: mês corrente (ou o primeiro mês disponível depois dele). */
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
  const faixas: Array<[number, number]> = cycle
    ? [[idx(cycle.inicio), idx(cycle.fim)]]
    : [[atual, atual + 5]];
  if (cycle && proximo) faixas.push([idx(proximo.inicio), idx(proximo.fim)]);
  const meses: string[] = [];
  for (const [a, b] of faixas) for (let k = a; k <= b; k++) meses.push(iso(k));
  const padrao = meses.find((m) => idx(m) >= atual) ?? meses[meses.length - 1];
  return { meses, padrao };
}
