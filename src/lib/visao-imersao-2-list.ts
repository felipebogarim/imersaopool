import { normalizeRepKey } from "@/lib/estrutura-rep/dedupe-reps";

export interface ListRep {
  nome: string;
  representacao?: string | null;
  regiao?: string | null;
}

export interface ListClient {
  id: string;
  categoria?: string | null;
  representatives?: ListRep | null;
}

export interface ReportListMeta {
  representante: string;
  regiao: string;
  categoria: string;
}

const clean = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function reportClientId(structured: any): string {
  return clean(
    structured?.resolved_client_id ??
      structured?.data?.resolved_client_id ??
      structured?.data?.client?.resolved_client_id,
  );
}

/** Representante, região e categoria exibidos/filtrados em cada linha da lista. */
export function reportListMeta(
  report: { structured_data?: any },
  clientsById: ReadonlyMap<string, ListClient>,
  reps: readonly ListRep[],
): ReportListMeta {
  const sd = report.structured_data;
  const client = clientsById.get(reportClientId(sd));
  const informed = clean(sd?.data?.client?.representative);
  const linkedRep = client?.representatives ?? null;

  let rep: ListRep | null = linkedRep;
  if (informed) {
    const key = normalizeRepKey(informed);
    rep =
      reps.find(
        (r) =>
          key.length >= 2 &&
          (normalizeRepKey(r.nome) === key ||
            normalizeRepKey(r.representacao).includes(key) ||
            (normalizeRepKey(r.nome).length >= 2 && key.includes(normalizeRepKey(r.nome)))),
      ) ?? linkedRep;
  }

  return {
    representante: rep?.nome?.trim() || informed,
    regiao: clean(rep?.regiao) || clean(sd?.data?.client?.location),
    categoria: clean(client?.categoria),
  };
}

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export interface ReportListFilters {
  representante: string;
  regiao: string;
  categoria: string;
  busca: string;
  /** Período da data da visita (AAAA-MM-DD), inclusivo. */
  dataDe: string;
  dataAte: string;
}

export const EMPTY_LIST_FILTERS: ReportListFilters = {
  representante: "",
  regiao: "",
  categoria: "",
  busca: "",
  dataDe: "",
  dataAte: "",
};

/** Filtros por igualdade + busca por nome ou palavra-chave (nome, arquivo, texto do relatório). */
export function matchesListFilters(
  report: { client_name?: string | null; visit_date?: string | null; source_filename?: string | null; content_markdown?: string | null },
  meta: ReportListMeta,
  f: ReportListFilters,
): boolean {
  if (f.representante && meta.representante !== f.representante) return false;
  if (f.regiao && meta.regiao !== f.regiao) return false;
  if (f.categoria && meta.categoria !== f.categoria) return false;
  if (f.dataDe || f.dataAte) {
    const d = clean(report.visit_date).slice(0, 10);
    if (!d) return false;
    if (f.dataDe && d < f.dataDe) return false;
    if (f.dataAte && d > f.dataAte) return false;
  }
  const q = fold(f.busca.trim());
  if (!q) return true;
  const hay = fold(
    [report.client_name, report.source_filename, meta.representante, meta.regiao, meta.categoria, report.content_markdown]
      .filter(Boolean)
      .join(" \n "),
  );
  return q.split(/\s+/).every((t) => hay.includes(t));
}
