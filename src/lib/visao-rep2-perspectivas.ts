/**
 * Modelo de leitura das oito Perspectivas da entrevista — exclusivo da Visão Rep.
 * Não altera parser, schema nem banco: apenas reorganiza o conteúdo já importado
 * para a navegação principal da página.
 */

import type { Perspective, VisaoRep2 } from "@/lib/visao-rep2-schema";
import { CONFIDENCE_LABEL } from "@/lib/visao-rep2-schema";
import type { BriefEntidades } from "@/components/visao-rep2/briefing-fabio";

export type PerspectivaMeta = { numero: number; nome: string; descricao: string };

export const PERSPECTIVAS_META: PerspectivaMeta[] = [
  { numero: 1, nome: "Marca e preço", descricao: "Percepção de marca e preço" },
  { numero: 2, nome: "Mix", descricao: "Mix ofertado e esforço de venda" },
  { numero: 3, nome: "Concorrência", descricao: "Competição de mercado" },
  { numero: 4, nome: "Argumento", descricao: "Argumento técnico no ponto de venda" },
  { numero: 5, nome: "Decisão", descricao: "Critério de decisão do cliente" },
  { numero: 6, nome: "Oportunidades", descricao: "Oportunidades, ameaças e cuidados" },
  { numero: 7, nome: "Governança", descricao: "Governança comercial e autonomia" },
  { numero: 8, nome: "Adicionais", descricao: "Informações adicionais" },
];

export type AgendaRef = { texto: string; indice?: number };

export type PerspectivaVM = {
  numero: number;
  nome: string;
  descricao: string;
  tituloConclusivo: string;
  contexto?: string | null;
  ondeAparece: string[];
  representa?: string | null;
  decisao?: AgendaRef | null;
  validacao?: AgendaRef | null;
  evidencia?: string | null;
  entidades: BriefEntidades;
  comparacao?: string | null;
  confianca?: string | null;
  conclusoes: string[];
  temConteudo: boolean;
};

const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Casa um texto de decisão/validação com a Agenda executiva para evitar repetição integral. */
export function matchAgenda(texto: string | null | undefined, agenda: string[]): AgendaRef | null {
  const t = txt(texto);
  if (!t) return null;
  const a = norm(t);
  const idx = agenda.findIndex(item => {
    const b = norm(item);
    if (!b) return false;
    return a.includes(b) || b.includes(a) || overlap(a, b) >= 0.6;
  });
  return idx >= 0 ? { texto: agenda[idx], indice: idx + 1 } : { texto: t };
}

function overlap(a: string, b: string) {
  const A = new Set(a.split(" ").filter(w => w.length > 3));
  const B = new Set(b.split(" ").filter(w => w.length > 3));
  if (!A.size || !B.size) return 0;
  let hits = 0;
  A.forEach(w => {
    if (B.has(w)) hits++;
  });
  return hits / Math.min(A.size, B.size);
}

const ENTIDADE_MAP: [RegExp, keyof BriefEntidades][] = [
  [/produto|familia|linha|sku/, "produtos"],
  [/concorrent|marca_rival|competid/, "concorrentes"],
  [/cliente|loja/, "clientes"],
  [/ferramenta|sistema|app/, "ferramentas"],
];

const CAMPOS_NARRATIVOS = /contexto|leitura|resumo|sintese|nota|observacao|instrucao|titulo|conclusao|decisao|validacao|evidencia|citacao/;

function valores(v: string | string[] | null | undefined): string[] {
  if (!v) return [];
  return (Array.isArray(v) ? v : [v]).map(s => String(s).trim()).filter(Boolean);
}

/** Constrói a leitura de uma perspectiva a partir do conteúdo já importado. */
export function buildPerspectivaVM(
  meta: PerspectivaMeta,
  p: Perspective | undefined,
  opts: { decisoes: string[]; validacoes: string[]; conclusoes?: string[] },
): PerspectivaVM {
  const sf = (p?.structured_fields ?? {}) as Record<string, string | string[]>;
  const get = (re: RegExp) => {
    const key = Object.keys(sf).find(k => re.test(norm(k).replace(/ /g, "_")));
    return key ? sf[key] : undefined;
  };

  const tituloConclusivo =
    txt(get(/titulo_conclusivo/) as string) ?? txt(p?.executive_finding) ?? meta.descricao;

  const contexto = txt(get(/^contexto/) as string) ?? txt(p?.full_reading) ?? txt(p?.executive_finding);

  const ondeExplicito = valores(get(/onde_(isso_)?aparece/) as string[]);
  const entidades: BriefEntidades = {};
  const genericos: string[] = [];

  for (const [k, v] of Object.entries(sf)) {
    const key = norm(k).replace(/ /g, "_");
    if (CAMPOS_NARRATIVOS.test(key)) continue;
    const grupo = ENTIDADE_MAP.find(([re]) => re.test(key))?.[1];
    const vals = valores(v);
    if (!vals.length) continue;
    if (grupo && grupo !== "nota") {
      const atual = (entidades[grupo] as string[]) ?? [];
      entidades[grupo] = Array.from(new Set([...atual, ...vals]));
    } else if (!ondeExplicito.length && vals.length > 1) {
      genericos.push(...vals);
    }
  }

  const ondeAparece = (ondeExplicito.length ? ondeExplicito : genericos).slice(0, 8);

  const decisao = matchAgenda(p?.recommended_action, opts.decisoes);
  const validacao = matchAgenda(txt(get(/validacao/) as string), opts.validacoes);

  const vm: PerspectivaVM = {
    ...meta,
    tituloConclusivo,
    contexto,
    ondeAparece,
    representa: txt(p?.business_impact),
    decisao,
    validacao,
    evidencia: txt(p?.source_quote) ?? txt(p?.evidence),
    entidades,
    comparacao: txt(p?.comparative_classification),
    confianca: p?.confidence_level ? CONFIDENCE_LABEL[p.confidence_level].replace("Confiança ", "") : null,
    conclusoes: opts.conclusoes ?? [],
    temConteudo: false,
  };
  vm.temConteudo = Boolean(
    vm.contexto || vm.representa || vm.evidencia || vm.ondeAparece.length || vm.decisao || vm.validacao,
  );
  return vm;
}

/** Oito perspectivas na ordem canônica, a partir de um relatório salvo. */
export function buildPerspectivasVM(visao: VisaoRep2): PerspectivaVM[] {
  const decisoes = visao.executive_view.decisions_required ?? [];
  const validacoes = visao.executive_view.validation_required ?? [];
  
  // Regra Visão Imersão 2: Em modo imersão, filtramos capítulos vazios?
  // Na verdade, buildPerspectivasVM é usado pela ExecutiveBriefV2 para renderizar os cards.
  // Mantenho a lógica original, o componente é que deve decidir se oculta.
  
  return PERSPECTIVAS_META.map(meta =>
    buildPerspectivaVM(
      meta,
      visao.perspectives.find(p => p.perspective_number === meta.numero),
      { decisoes, validacoes },
    ),
  );
}


/** Capitaliza rótulos de confiança vindos de fontes diversas. */
export function confiancaLabel(v: string | null | undefined) {
  const s = (v ?? "").trim();
  if (!s) return null;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
