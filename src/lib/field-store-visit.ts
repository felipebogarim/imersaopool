// Padrão canônico "field_store_visit_v1" — relatório final de visita a loja/cliente.
// Parser 100% determinístico: não usa IA, não reescreve, não resume.
// Apenas identifica metadados, reconhece capítulos e preserva o markdown verbatim.

export const FIELD_STORE_VISIT_TEMPLATE = "field_store_visit_v1";
export const FIELD_STORE_VISIT_TIPO = "visita_loja";

export const FIELD_STORE_VISIT_CHAPTERS: Record<number, { key: string; titulo: string }> = {
  0: { key: "sumario_executivo", titulo: "Sumário executivo" },
  1: { key: "loja_observada", titulo: "A loja observada" },
  2: { key: "percepcao_grupo_newline", titulo: "Percepção do Grupo Newline" },
  3: { key: "arquitetos_vendedores_decisao", titulo: "Arquitetos, vendedores e decisão" },
  4: { key: "visao_por_familia", titulo: "Visão por família de produtos" },
  5: { key: "decorativo_posicionamento", titulo: "Decorativo e oportunidade de posicionamento" },
  6: { key: "arquitetos_treinamentos_relacionamento", titulo: "Arquitetos, treinamentos e relacionamento" },
  7: { key: "atendimento_velocidade", titulo: "Atendimento, velocidade e experiência operacional" },
  8: { key: "conclusoes_oportunidades_plano", titulo: "Conclusões, oportunidades e próximos passos" },
};

const REQUIRED_META = ["report_template", "tipo_relatorio", "cliente", "data_visita"] as const;
const REQUIRED_CHAPTERS = [0, 1, 8];

export type FieldStoreVisitMeta = Record<string, string>;

export type FieldStoreVisitChapter = {
  ordem: number;
  key: string;
  titulo: string;
  markdown: string;
};

export type FieldStoreVisitDoc = {
  meta: FieldStoreVisitMeta;
  chapters: FieldStoreVisitChapter[];
};

/** Detecta o modelo lendo os três metadados de identificação. */
export function isFieldStoreVisit(md: string): boolean {
  const t = md.slice(0, 4000);
  return (
    /(^|\n)\s*[-*]?\s*report_template\s*:\s*field_store_visit_v1\s*(\n|$)/i.test(t) &&
    /(^|\n)\s*[-*]?\s*tipo_relatorio\s*:\s*visita_loja\s*(\n|$)/i.test(t) &&
    /(^|\n)\s*[-*]?\s*schema_version\s*:/i.test(t)
  );
}

function parseMeta(md: string): FieldStoreVisitMeta {
  const meta: FieldStoreVisitMeta = {};
  const m = md.match(/^\s*##\s+metadados\s*$/im);
  const block = m ? md.slice(m.index! + m[0].length).split(/^\s*##\s+/m)[0] : md.slice(0, 3000);
  for (const raw of block.split(/\r?\n/)) {
    const line = raw.trim();
    const kv = line.match(/^[-*]?\s*([a-z_][a-z0-9_]*)\s*:\s*(.*)$/i);
    if (!kv) continue;
    const key = kv[1].toLowerCase();
    const value = kv[2].trim();
    if (value) meta[key] = value;
  }
  return meta;
}

const CHAPTER_RE = /^\s*##\s*(?:cap[íi]tulo\s*)?(\d{1,2})\s*[—–\-.:)]?\s*(.*)$/i;

/**
 * Parseia o documento. Erros retornados são objetivos e voltados ao usuário.
 * Nenhum conteúdo é criado, alterado ou reordenado.
 */
export function parseFieldStoreVisit(md: string): {
  doc: FieldStoreVisitDoc | null;
  errors: string[];
} {
  const errors: string[] = [];
  const meta = parseMeta(md);

  for (const k of REQUIRED_META) {
    if (!meta[k]) errors.push(`O campo ${k} não foi encontrado em Metadados.`);
  }

  const lines = md.split(/\r?\n/);
  const chapters: FieldStoreVisitChapter[] = [];
  let cur: { ordem: number; titulo: string; buf: string[] } | null = null;
  let inMeta = false;

  const flush = () => {
    if (!cur) return;
    const known = FIELD_STORE_VISIT_CHAPTERS[cur.ordem];
    chapters.push({
      ordem: cur.ordem,
      key: known?.key ?? `capitulo_${String(cur.ordem).padStart(2, "0")}`,
      titulo: cur.titulo || known?.titulo || `Capítulo ${cur.ordem}`,
      markdown: cur.buf.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    });
    cur = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    const isH2 = /^\s*##\s+/.test(line) && !/^\s*###/.test(line);
    if (isH2) {
      const cm = line.match(CHAPTER_RE);
      if (cm) {
        flush();
        inMeta = false;
        cur = { ordem: parseInt(cm[1], 10), titulo: cm[2].trim(), buf: [] };
        continue;
      }
      // heading H2 que não é capítulo (ex.: Metadados) encerra o capítulo atual
      flush();
      inMeta = /metadados/i.test(line);
      continue;
    }
    if (cur) cur.buf.push(line);
    else if (inMeta) continue;
  }
  flush();

  const found = new Set(chapters.map((c) => c.ordem));
  for (const req of REQUIRED_CHAPTERS) {
    if (!found.has(req)) {
      const label = FIELD_STORE_VISIT_CHAPTERS[req].titulo;
      errors.push(`O Capítulo ${String(req).padStart(2, "0")} — ${label} não foi encontrado no documento.`);
    }
  }

  chapters.sort((a, b) => a.ordem - b.ordem);
  if (errors.length) return { doc: null, errors };
  return { doc: { meta, chapters }, errors: [] };
}

const META_ORDER = [
  "schema_version",
  "report_template",
  "tipo_relatorio",
  "titulo",
  "cliente",
  "data_visita",
  "local",
  "representante",
  "consultor",
  "participantes",
  "responsavel_relatorio",
  "status_documento",
  "fonte",
];

/** Gera o markdown no mesmo padrão aceito pelo importador (exportação reimportável). */
export function serializeFieldStoreVisit(doc: FieldStoreVisitDoc): string {
  const meta: FieldStoreVisitMeta = {
    schema_version: "1.0",
    report_template: FIELD_STORE_VISIT_TEMPLATE,
    tipo_relatorio: FIELD_STORE_VISIT_TIPO,
    ...doc.meta,
  };
  const keys = [...META_ORDER.filter((k) => meta[k]), ...Object.keys(meta).filter((k) => !META_ORDER.includes(k))];
  const out: string[] = ["# RELATÓRIO FINAL DE IMERSÃO EM CAMPO", "", "## Metadados", ""];
  for (const k of keys) out.push(`- ${k}: ${meta[k]}`);
  out.push("");
  for (const c of [...doc.chapters].sort((a, b) => a.ordem - b.ordem)) {
    out.push(`## Capítulo ${String(c.ordem).padStart(2, "0")} — ${c.titulo}`, "", c.markdown.trim(), "");
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
