// Guia de Agenda do representante: semana de visitas e pontos de conversa por cliente.
// Funções puras (testadas) compartilhadas entre o portal e o servidor.

import { METAS_FAMILIES, METAS_FAMILY_LABEL } from "@/lib/performance-metas";
import type { CanonicalFamily } from "@/lib/client-bi-familias";

export type VisitaAgenda = {
  id: string;
  rowId: string | null;
  cliente: string;
  data: string; // YYYY-MM-DD
  hora: string | null;
  objetivo: string | null;
};

const DIA_SEMANA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};

/** Semana (segunda a domingo) que contém a data. */
export function semanaDe(dataIso: string): {
  inicio: string;
  fim: string;
  dias: Array<{ data: string; label: string }>;
} {
  const d = parse(dataIso);
  const seg = new Date(d);
  seg.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const dias = Array.from({ length: 7 }, (_, i) => {
    const x = new Date(seg);
    x.setDate(seg.getDate() + i);
    return {
      data: iso(x),
      label: `${DIA_SEMANA[x.getDay()]}, ${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}`,
    };
  });
  return { inicio: dias[0].data, fim: dias[6].data, dias };
}

export function deslocarSemana(dataIso: string, semanas: number): string {
  const d = parse(dataIso);
  d.setDate(d.getDate() + semanas * 7);
  return iso(d);
}

export const hojeIso = () => iso(new Date());

/** Visitas ordenadas por data e hora (sem hora vai para o fim do dia). */
export function ordenarVisitas<T extends Pick<VisitaAgenda, "data" | "hora" | "cliente">>(
  v: readonly T[],
): T[] {
  return [...v].sort(
    (a, b) =>
      a.data.localeCompare(b.data) ||
      (a.hora ?? "99:99").localeCompare(b.hora ?? "99:99") ||
      a.cliente.localeCompare(b.cliente, "pt-BR"),
  );
}

// ------------------------------ Resumo de performance ------------------------------

export type PerformanceVisita = {
  items: Array<{ familia: string; meta_mensal: number | null }>;
  atingimento: Partial<Record<CanonicalFamily, { ratio: number }>>;
};

export type ResumoPortfolio = {
  familia: CanonicalFamily;
  label: string;
  meta: number | null;
  ratio: number | null;
};

export type ResumoPerformance = {
  portfolios: ResumoPortfolio[];
  /** Atingimento geral ponderado pela meta (null sem metas com atingimento). */
  geral: number | null;
  destaques: ResumoPortfolio[]; // ≥ 100%
  atencao: ResumoPortfolio[]; // < 70%
  semMeta: number;
};

export function resumoPerformance(view: PerformanceVisita): ResumoPerformance {
  const portfolios = METAS_FAMILIES.map((familia) => ({
    familia,
    label: METAS_FAMILY_LABEL[familia],
    meta: view.items.find((i) => i.familia === familia)?.meta_mensal ?? null,
    ratio: view.atingimento[familia]?.ratio ?? null,
  }));
  let soma = 0;
  let peso = 0;
  for (const p of portfolios) {
    if (p.meta != null && p.meta > 0 && p.ratio != null) {
      soma += p.ratio * p.meta;
      peso += p.meta;
    }
  }
  const comMeta = portfolios.filter((p) => p.meta != null && p.meta > 0 && p.ratio != null);
  return {
    portfolios,
    geral: peso > 0 ? soma / peso : null,
    destaques: comMeta.filter((p) => p.ratio! >= 1).sort((a, b) => b.ratio! - a.ratio!),
    atencao: comMeta.filter((p) => p.ratio! < 0.7).sort((a, b) => a.ratio! - b.ratio!),
    semMeta: portfolios.filter((p) => p.meta == null || p.meta <= 0).length,
  };
}

const pct = (r: number) => `${Math.round(r * 100)}%`;

/** Pontos de conversa da visita, a partir da performance e do que está em aberto. */
export function pontosDaVisita(args: {
  resumo: ResumoPerformance | null;
  acoesAbertas: Array<{ title: string; due_date: string | null }>;
  solicitacoesAbertas: Array<{ titulo: string }>;
  revisaoPendente?: boolean;
}): string[] {
  const out: string[] = [];
  const r = args.resumo;
  if (r) {
    if (r.geral != null)
      out.push(
        r.geral >= 1
          ? `Cliente acima da meta no geral (${pct(r.geral)}): reconhecer o resultado e buscar ampliação de mix.`
          : `Atingimento geral de ${pct(r.geral)}: alinhar o plano para fechar o período na meta.`,
      );
    if (r.atencao.length)
      out.push(
        `Reforçar ${r.atencao.map((p) => `${p.label} (${pct(p.ratio!)})`).join(", ")}: portfólios abaixo de 70% da meta.`,
      );
    if (r.destaques.length)
      out.push(`Destaques: ${r.destaques.map((p) => `${p.label} (${pct(p.ratio!)})`).join(", ")}.`);
    if (r.semMeta > 0 && r.semMeta < r.portfolios.length)
      out.push(
        `${r.semMeta} portfólio(s) sem meta definida: oportunidade de apresentar linhas ainda não trabalhadas.`,
      );
  }
  if (args.revisaoPendente)
    out.push("Metas aguardando a sua revisão: aproveite para validar com o cliente.");
  for (const a of args.acoesAbertas.slice(0, 3))
    out.push(
      `Ação em andamento: ${a.title}${a.due_date ? ` (prazo ${fmtData(a.due_date)})` : ""}.`,
    );
  for (const s of args.solicitacoesAbertas.slice(0, 2))
    out.push(`Solicitação de apoio em aberto: ${s.titulo}.`);
  return out;
}

export function fmtData(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

export const chaveCliente = (s: string | null | undefined) => (s ?? "").trim().toUpperCase();
