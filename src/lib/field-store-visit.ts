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
    if (!line || line.startsWith("```") || line.startsWith("#")) continue;
    // Somente pares "chave: valor" reais: chave curta, sem pontuação de frase.
    const kv = line.match(/^[-*]?\s*([A-Za-zÀ-ÿ0-9_ ()/]{2,40}?)\s*:\s*(.*)$/);
    if (!kv) continue;

    const rawKey = kv[1].trim();
    // Chave de metadado tem no máximo 4 palavras e não termina em pontuação.
    if (rawKey.split(/\s+/).length > 4) continue;
    if (/[.,;!?]$/.test(rawKey)) continue;

    let key = rawKey.toLowerCase();
    const value = kv[2].trim();

    // Mapeamento de termos para chaves canônicas (match exato/prefixo, não substring solta)
    if (/^cliente\b/.test(key)) key = "cliente";
    else if (/^(local|unidade|cidade)\b/.test(key)) key = "local";
    else if (/^data\b/.test(key)) key = "data_visita";
    else if (/^representante\b/.test(key)) key = "representante";
    else if (/^consultor\b/.test(key)) key = "consultor";
    else if (/^(t[íi]tulo|assunto)\b/.test(key)) key = "titulo";

    // Primeira ocorrência vence: evita que prosa posterior sobrescreva metadados.
    if (value && meta[key] === undefined) meta[key] = value;
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
  let metaRawBuf: string[] = [];

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
      metaRawBuf.push(line);
      continue;
    }
  }
  flush();

  // Preservamos o conteúdo bruto dos metadados no objeto meta se houver blocos de código
  if (metaRawBuf.length > 0) {
    const metaRaw = metaRawBuf.join("\n");
    if (metaRaw.includes("```")) {
      meta["__raw_content__"] = metaRaw;
    }
  }

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

// ————————————————————————— Blocos editoriais opcionais —————————————————————————
// Retrocompatíveis: relatórios antigos (sem estas seções) continuam válidos.
// `executive_summary` e `executive_map` são lidos verbatim do relatório importado;
// o gerador de PDF nunca cria, resume ou classifica estes conteúdos.

export type ExecutiveSummary = {
  sintese_geral: string[];
  sinais_prioritarios: string[];
  leitura_executiva: string[];
};

export type ExecutiveMap = {
  strengths: string[];
  barriers: string[];
  opportunities: string[];
  attention_points: string[];
};

/** Extrai o corpo de uma seção H2 cujo título casa com `re`. */
function sectionBody(md: string, re: RegExp): string | null {
  const lines = String(md ?? "").replace(/\r\n?/g, "\n").split("\n");
  let buf: string[] | null = null;
  for (const raw of lines) {
    const h2 = raw.match(/^\s*##\s+(.*)$/);
    if (h2 && !/^\s*###/.test(raw)) {
      if (buf) break;
      if (re.test(h2[1])) buf = [];
      continue;
    }
    if (buf) buf.push(raw);
  }
  return buf ? buf.join("\n").trim() || null : null;
}

function items(body: string): string[] {
  return body
    .split(/\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^[-*•]\s+/, "").replace(/^\d+[.)]\s+/, "").trim())
    .filter(Boolean);
}

/** Divide o corpo em subseções por heading (###/####/linha em negrito). */
function subsections(body: string): { title: string; body: string }[] {
  const out: { title: string; body: string }[] = [];
  let cur: { title: string; body: string[] } | null = null;
  for (const raw of body.split(/\n/)) {
    const h = raw.match(/^\s*#{3,6}\s+(.*)$/) ?? raw.match(/^\s*\*\*(.+?)\*\*:?\s*$/);
    if (h) {
      if (cur) out.push({ title: cur.title, body: cur.body.join("\n").trim() });
      cur = { title: h[1].trim(), body: [] };
      continue;
    }
    if (cur) cur.body.push(raw);
  }
  if (cur) out.push({ title: cur.title, body: cur.body.join("\n").trim() });
  return out;
}

function jsonBlock<T>(md: string, name: string): T | null {
  const m = md.match(new RegExp("```\\s*" + name + "\\s*\\n([\\s\\S]*?)```", "i"));
  if (!m) return null;
  try {
    return JSON.parse(m[1]) as T;
  } catch {
    return null;
  }
}

const strList = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x ?? "").trim()).filter(Boolean) : [];

/** Sumário executivo explícito do relatório (ou null quando ausente). */
export function parseExecutiveSummary(md: string): ExecutiveSummary | null {
  const fromJson = jsonBlock<Partial<ExecutiveSummary>>(md, "executive_summary");
  if (fromJson) {
    const s: ExecutiveSummary = {
      sintese_geral: strList((fromJson as any).sintese_geral ?? (fromJson as any).general_synthesis),
      sinais_prioritarios: strList((fromJson as any).sinais_prioritarios ?? (fromJson as any).priority_signals),
      leitura_executiva: strList((fromJson as any).leitura_executiva ?? (fromJson as any).executive_reading),
    };
    return s.sintese_geral.length || s.sinais_prioritarios.length || s.leitura_executiva.length ? s : null;
  }

  const body = sectionBody(md, /sum[áa]rio\s+executivo/i);
  if (!body) return null;
  const out: ExecutiveSummary = { sintese_geral: [], sinais_prioritarios: [], leitura_executiva: [] };
  const subs = subsections(body);
  if (!subs.length) {
    out.sintese_geral = items(body);
  } else {
    const introLines: string[] = [];
    for (const l of body.split(/\n/)) {
      if (/^\s*#{3,6}\s+/.test(l) || /^\s*\*\*(.+?)\*\*:?\s*$/.test(l)) break;
      introLines.push(l);
    }
    const intro = introLines.join("\n").trim();
    if (intro) out.sintese_geral.push(...items(intro));
    for (const s of subs) {
      const list = items(s.body);
      if (/s[íi]ntese/i.test(s.title)) out.sintese_geral.push(...list);
      else if (/sinais?\s+priorit/i.test(s.title)) out.sinais_prioritarios.push(...list);
      else if (/leitura\s+executiva/i.test(s.title)) out.leitura_executiva.push(...list);
    }
  }
  return out.sintese_geral.length || out.sinais_prioritarios.length || out.leitura_executiva.length ? out : null;
}

/** Mapa executivo explícito (nunca inferido a partir de outros trechos). */
export function parseExecutiveMap(md: string): ExecutiveMap | null {
  const empty: ExecutiveMap = { strengths: [], barriers: [], opportunities: [], attention_points: [] };
  const fromJson = jsonBlock<Partial<ExecutiveMap>>(md, "executive_map");
  let map: ExecutiveMap | null = null;

  if (fromJson) {
    map = {
      strengths: strList(fromJson.strengths),
      barriers: strList(fromJson.barriers),
      opportunities: strList(fromJson.opportunities),
      attention_points: strList((fromJson as any).attention_points ?? (fromJson as any).attention),
    };
  } else {
    const body = sectionBody(md, /mapa\s+executivo/i);
    if (!body) return null;
    map = { ...empty };
    for (const s of subsections(body)) {
      const list = items(s.body);
      if (/for[çc]as?/i.test(s.title)) map.strengths.push(...list);
      else if (/barreira/i.test(s.title)) map.barriers.push(...list);
      else if (/oportunidade/i.test(s.title)) map.opportunities.push(...list);
      else if (/aten[çc][ãa]o/i.test(s.title)) map.attention_points.push(...list);
    }
  }

  const total =
    map.strengths.length + map.barriers.length + map.opportunities.length + map.attention_points.length;
  return total ? map : null;
}
