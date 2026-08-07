// Padrão canônico "field_immersion_v2" — relatório final de imersão em campo.
// Parser 100% determinístico: não usa IA, não reescreve, não resume.
// Suporta versões 1.0, 1.1 (field_store_visit_v1) e 2.0 (field_immersion_v2).

export const FIELD_IMMERSION_TEMPLATE_V2 = "field_immersion_v2";
export const FIELD_STORE_VISIT_TEMPLATE_V1 = "field_store_visit_v1";

export const FIELD_IMMERSION_CHAPTERS_V2: Record<string, { ordem: number; slug: string; titulo_padrao: string }> = {
  C1: { ordem: 1, slug: "contexto_dinamica_percepcao", titulo_padrao: "Contexto, dinâmica e percepção inicial" },
  C2: { ordem: 2, slug: "atores_influencia_decisao", titulo_padrao: "Atores, influência e processo de decisão" },
  C3: { ordem: 3, slug: "oferta_categorias_desempenho", titulo_padrao: "Oferta, categorias e desempenho percebido" },
  C4: { ordem: 4, slug: "posicionamento_diferenciacao_oportunidades", titulo_padrao: "Posicionamento, diferenciação e oportunidades" },
  C5: { ordem: 5, slug: "relacionamento_capacitacao_ativacao", titulo_padrao: "Relacionamento, capacitação e ativação" },
  C6: { ordem: 6, slug: "operacao_atendimento_experiencia", titulo_padrao: "Operação, atendimento e experiência" },
  C7: { ordem: 7, slug: "sintese_prioridades_proximos_passos", titulo_padrao: "Síntese, prioridades e próximos passos" },
};

export const FIELD_STORE_VISIT_CHAPTERS_V1: Record<number, { key: string; titulo: string }> = {
  1: { key: "percepcoes_marca_visao_inicial", titulo: "Percepções de marca e visão inicial" },
  2: { key: "arquitetos_vendedores_decisao", titulo: "Arquitetos, vendedores e decisão" },
  3: { key: "visao_por_familia", titulo: "Visão por família de produtos" },
  4: { key: "decorativo_posicionamento", titulo: "Decorativo e oportunidade de posicionamento" },
  5: { key: "arquitetos_treinamentos_relacionamento", titulo: "Arquitetos, treinamentos e relacionamento" },
  6: { key: "atendimento_velocidade", titulo: "Atendimento, velocidade e experiência operacional" },
  7: { key: "conclusoes_oportunidades_proximos_passos", titulo: "Conclusões, oportunidades e próximos passos" },
};

const REQUIRED_META = ["report_template", "cliente", "data_visita", "tipo_relatorio"] as const;

export type FieldImmersionMeta = Record<string, string>;

export type FieldImmersionChapter = {
  ordem: number;
  codigo: string;
  key: string;
  titulo: string;
  markdown: string;
};

export type FieldImmersionDoc = {
  meta: FieldImmersionMeta;
  chapters: FieldImmersionChapter[];
};

/** Detecta se o markdown pertence a um dos modelos de imersão. */
export function isFieldImmersion(md: string): boolean {
  const t = md.slice(0, 4000);
  return (
    /(^|\n)\s*[-*]?\s*report_template\s*:\s*(field_immersion_v2|field_store_visit_v1)\s*(\n|$)/i.test(t)
  );
}

// Para manter compatibilidade com o código existente que chama isFieldStoreVisit
export const isFieldStoreVisit = isFieldImmersion;

function parseMeta(md: string): FieldImmersionMeta {
  const meta: FieldImmersionMeta = {};
  const m = md.match(/^\s*##\s+metadados\s*$/im);
  const block = m ? md.slice(m.index! + m[0].length).split(/^\s*##\s+/m)[0] : md.slice(0, 3000);
  const lines = block.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    // Regex mais flexível para capturar "Chave: Valor" mesmo com espaços ou hífens no início
    const kv = line.match(/^[-*]?\s*([^:]+)\s*:\s*(.*)$/i);
    if (!kv) continue;
    
    let key = kv[1].trim().toLowerCase();
    const value = kv[2].trim();
    
    // Mapeamento de termos para chaves canônicas
    if (key.includes("cliente")) key = "cliente";
    if (key.includes("local") || key.includes("unidade") || key.includes("cidade")) key = "local";
    if (key.includes("data")) key = "data_visita";
    if (key.includes("representante")) key = "representante";
    if (key.includes("consultor")) key = "consultor";
    if (key.includes("título") || key.includes("assunto")) key = "titulo";
    
    if (value) meta[key] = value;
  }
  return meta;
}

/** 
 * Regex para capturar capítulos.
 * Prioriza [C#] mas aceita "Capítulo #" para compatibilidade.
 */
const CHAPTER_RE_V2 = /^\s*##\s*(?:\[(C\d)\]|(?:cap[íi]tulo\s*)(\d+))\s*[—–\-.:)]?\s*(.*)$/i;

export function parseFieldStoreVisit(md: string): {
  doc: FieldImmersionDoc | null;
  errors: string[];
  detected_version: string;
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const meta = parseMeta(md);
  const template = meta["report_template"] || "";
  const schema_version = meta["schema_version"] || "1.0";
  const detected_version = schema_version;

  for (const k of REQUIRED_META) {
    if (!meta[k]) {
      // No V2, tipo_relatorio não é mais obrigatório em metadados se tiver o template correto
      if (k === "tipo_relatorio" && template === FIELD_IMMERSION_TEMPLATE_V2) continue;
      errors.push(`O campo ${k} não foi encontrado em Metadados.`);
    }
  }

  // Se versão for antiga mas template novo, ou vice-versa, avisar.
  if (template === FIELD_IMMERSION_TEMPLATE_V2 && parseFloat(schema_version) < 2.0) {
    warnings.push("A versão informada no arquivo difere da estrutura detectada. O relatório foi reconhecido como V2.");
  }

  const lines = md.split(/\r?\n/);
  const chapters: FieldImmersionChapter[] = [];
  let cur: { ordem: number; codigo: string; titulo: string; buf: string[] } | null = null;
  let inMeta = false;

  const flush = () => {
    if (!cur) return;
    
    let key = "";
    let finalTitulo = cur.titulo;
    
    if (template === FIELD_IMMERSION_TEMPLATE_V2 || parseFloat(schema_version) >= 2.0) {
      const config = FIELD_IMMERSION_CHAPTERS_V2[cur.codigo];
      key = config?.slug ?? `capitulo_${cur.codigo.toLowerCase()}`;
      if (!finalTitulo) finalTitulo = config?.titulo_padrao ?? `Capítulo ${cur.codigo}`;
    } else {
      const config = FIELD_STORE_VISIT_CHAPTERS_V1[cur.ordem];
      key = config?.key ?? `capitulo_${String(cur.ordem).padStart(2, "0")}`;
      if (!finalTitulo) finalTitulo = config?.titulo ?? `Capítulo ${cur.ordem}`;
    }

    chapters.push({
      ordem: cur.ordem,
      codigo: cur.codigo,
      key,
      titulo: finalTitulo,
      markdown: cur.buf.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    });
    cur = null;
  };

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    
    // Regra central: somente ## (H2) que contenha código válido [CX] ou Capítulo X
    // Ignora ###, ####, etc.
    const isH2 = /^\s*##\s+/.test(line) && !/^\s*##\d+/.test(line) && !/^\s*###/.test(line);
    
    if (isH2) {
      const cm = line.match(CHAPTER_RE_V2);
      if (cm) {
        flush();
        inMeta = false;
        
        let codigo = "";
        let ordem = 0;
        
        if (cm[1]) {
          // [C1] format
          codigo = cm[1].toUpperCase();
          ordem = parseInt(codigo.replace("C", ""), 10);
        } else {
          // Capítulo 1 format
          ordem = parseInt(cm[2], 10);
          codigo = `C${ordem}`;
        }
        
        cur = { ordem, codigo, titulo: cm[3].trim(), buf: [] };
        continue;
      }
      
      // Heading H2 que não é capítulo (ex.: Metadados) encerra o capítulo atual
      flush();
      inMeta = /metadados/i.test(line);
      continue;
    }
    
    if (cur) {
      cur.buf.push(line);
    } else if (inMeta) {
      continue;
    }
  }
  flush();

  const foundCodes = new Set(chapters.map((c) => c.codigo));
  
  // Validação: C1 e C7 são obrigatórios. C2-C6 são opcionais.
  if (!foundCodes.has("C1")) {
    errors.push("O Capítulo 01 — Contexto e percepção não foi encontrado.");
  }
  if (!foundCodes.has("C7")) {
    errors.push("O Capítulo 07 — Síntese e plano de ação não foi encontrado.");
  }

  // Verificar duplicados
  const counts = new Map<string, number>();
  for (const c of chapters) {
    counts.set(c.codigo, (counts.get(c.codigo) || 0) + 1);
  }
  for (const [code, count] of counts.entries()) {
    if (count > 1) errors.push(`O código de capítulo ${code} está duplicado no arquivo.`);
  }

  chapters.sort((a, b) => a.ordem - b.ordem);
  
  if (errors.length) return { doc: null, errors, detected_version, warnings };
  return { doc: { meta, chapters }, errors: [], detected_version, warnings };
}

const META_ORDER = [
  "schema_version",
  "report_template",
  "immersion_profile",
  "cliente",
  "data_visita",
  "representante",
  "local",
  "participantes",
];

/** Gera o markdown no padrão V2. */
export function serializeFieldStoreVisit(doc: FieldImmersionDoc): string {
  const meta: FieldImmersionMeta = {
    schema_version: "2.0",
    report_template: FIELD_IMMERSION_TEMPLATE_V2,
    immersion_profile: "store_visit",
    ...doc.meta,
  };
  
  const keys = [...META_ORDER.filter((k) => meta[k]), ...Object.keys(meta).filter((k) => !META_ORDER.includes(k))];
  const out: string[] = ["# RELATÓRIO FINAL DE IMERSÃO EM CAMPO", "", "## Metadados", ""];
  
  for (const k of keys) {
    out.push(`- ${k}: ${meta[k]}`);
  }
  
  out.push("");
  
  for (const c of [...doc.chapters].sort((a, b) => a.ordem - b.ordem)) {
    // No V2, usamos o formato ## [C#] Título
    out.push(`## [${c.codigo}] ${c.titulo}`, "", c.markdown.trim(), "");
  }
  
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}
