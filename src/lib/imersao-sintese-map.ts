/**
 * Camada consolidável do universo VISITA DE CAMPO.
 *
 * Converte relatórios Visão Imersão 2 (schema visao_imersao_2_data_v1) em:
 *  1. fontes de insight com as 8 lentes canônicas (tipo = visita_campo);
 *  2. mapa por família específico das imersões em clientes.
 *
 * NÃO toca no pipeline de entrevistas. Nenhum dado é compartilhado entre os
 * universos: aqui só entram relatórios de imersão em campo.
 */
import type { Immersion2Data } from "./visao-imersao-2-parser";
import { LENTES, type Lente, type SinteseCampos } from "./insight-lentes";

export type ImersaoFonte = {
  id: string;
  client_name: string;
  visit_date: string;
  source_filename: string;
  data: Immersion2Data;
};

const norm = (s: string) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/* ------------------------------------------------------------------ *
 * Famílias canônicas
 * ------------------------------------------------------------------ */

export const FAMILIAS_CANON: { nome: string; aliases: string[] }[] = [
  { nome: "DECOR NEWLINE", aliases: ["decor newline", "decor new line", "decorativos newline"] },
  { nome: "DECOR STUDIO", aliases: ["decor studio", "studio decor"] },
  {
    nome: "SISTEMAS E MÓDULOS",
    aliases: [
      "sistemas e modulos", "sistemas", "sistemas newline", "modulos", "modulares",
      "fit10", "fit 10", "fit15", "fit 15", "fit40", "fit 40", "fit20", "fit 20", "linha fit",
    ],
  },
  { nome: "PRO LED", aliases: ["pro led", "proled", "linha pro led"] },
  { nome: "PRO LAMP", aliases: ["pro lamp", "prolamp", "lampadas", "lampada"] },
  { nome: "PERFIL", aliases: ["perfil", "perfis", "perfis de led", "perfilaria"] },
  { nome: "FITAS E FONTES", aliases: ["fitas e fontes", "fitas", "fita led", "fonte", "fontes", "drivers", "driver"] },
];

/** Normaliza qualquer menção textual para a família canônica, quando reconhecida. */
export function normalizeFamilia(raw: string): string | null {
  const n = norm(raw);
  if (!n) return null;
  for (const f of FAMILIAS_CANON) {
    if (f.aliases.some(a => n === a || n.includes(a))) return f.nome;
  }
  return null;
}

/** Família consolidada preservando nomes novos que aparecerem nos relatórios. */
export function resolveFamilia(raw: string): string {
  return normalizeFamilia(raw) ?? String(raw ?? "").trim().toUpperCase();
}

/* ------------------------------------------------------------------ *
 * Extração de trechos do relatório
 * ------------------------------------------------------------------ */

type Trecho = {
  texto: string;
  implicacao?: string | null;
  citacao?: string | null;
  origem: "sinal" | "capitulo" | "perspectiva";
  concorrentes: string[];
};

function quoteText(data: Immersion2Data, id: string): string | null {
  const q = data.quotes.find(x => x.id === id);
  if (!q) return null;
  const autor = q.reported_by
    ? `${q.original_author} · relato por ${q.reported_by}`
    : `${q.original_author}${q.original_author_role ? ` (${q.original_author_role})` : ""}`;
  return `“${q.text}” — ${autor}`;
}

function trechos(data: Immersion2Data): Trecho[] {
  const out: Trecho[] = [];

  for (const s of data.signals ?? []) {
    out.push({
      texto: [s.title, s.conclusion].filter(Boolean).join(" — "),
      implicacao: s.business_impact ?? null,
      citacao: (s.evidence_quotes ?? []).map(q => quoteText(data, q)).filter(Boolean)[0] ?? null,
      origem: "sinal",
      concorrentes: [],
    });
    for (const a of s.appearances ?? []) {
      if (a.specific_finding) {
        out.push({
          texto: a.specific_finding,
          implicacao: a.added_detail ?? null,
          citacao: (a.quote_ids ?? []).map(q => quoteText(data, q)).filter(Boolean)[0] ?? null,
          origem: "perspectiva",
          concorrentes: [],
        });
      }
    }
  }

  for (const c of data.chapter_review ?? []) {
    for (const item of c.items ?? []) {
      out.push({
        texto: [item.headline, item.executive_reading].filter(Boolean).join(" — "),
        implicacao: item.implication ?? null,
        citacao: (item.quote_ids ?? []).map(q => quoteText(data, q)).filter(Boolean)[0] ?? null,
        origem: "capitulo",
        concorrentes: item.entities?.concorrentes ?? [],
      });
    }
  }

  // Deduplicação editorial: a mesma conclusão não é repetida só porque
  // apareceu em campos diferentes do relatório.
  const vistos = new Set<string>();
  return out.filter(t => {
    const k = norm(t.texto).slice(0, 140);
    if (!k || vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

/* ------------------------------------------------------------------ *
 * Fonte de insight (8 lentes) a partir da imersão
 * ------------------------------------------------------------------ */

const KW = {
  preco: ["preco", "caro", "custo", "margem", "valor", "tabela", "desconto", "barato", "competitivo"],
  positivo: ["funciona", "forte", "forca", "sucesso", "gira", "bem aceito", "vende bem", "destaque", "preferencia", "preferido", "qualidade", "aprovad", "referencia", "carro chefe"],
  negativo: ["nao funciona", "dificuldade", "barreira", "problema", "falta", "atraso", "ruptura", "complex", "desconhec", "prazo", "indisponi", "fraco", "parado", "sem giro", "confus"],
  concorrencia: ["concorrent", "competidor", "mercado", "marca rival", "perde para", "ganha de"],
  argumento: ["argument", "objec", "tecnic", "especifica", "treinamento", "capacita", "demonstra"],
  decisao: ["decis", "criterio", "escolha", "compra por", "opta"],
  oportunidade: ["oportunidade", "potencial", "poderia", "recomend", "ampliar", "crescer", "explorar", "sugest"],
  ameaca: ["ameaca", "risco", "perda", "queda", "migra"],
  governanca: ["governanca", "autonomia", "politica", "diretriz", "processo", "aprovacao", "alcada"],
};

const hit = (t: string, keys: string[]) => {
  const n = norm(t);
  return keys.some(k => n.includes(k));
};

const cut = (arr: string[], n = 8) => (arr.length ? [...new Set(arr.map(s => s.trim()).filter(Boolean))].slice(0, n) : null);

export type LenteBundle = {
  leitura_estrategica: string | null;
  sintese_campos: SinteseCampos;
  highlights: string[];
};

/** Monta as 8 lentes canônicas a partir de um relatório Visão Imersão 2. */
export function imersaoToLentes(fonte: ImersaoFonte): Record<Lente, LenteBundle> {
  const data = fonte.data;
  const ts = trechos(data);
  const texto = (t: Trecho) => (t.implicacao ? `${t.texto} (${t.implicacao})` : t.texto);
  const cits = ts.map(t => t.citacao).filter((s): s is string => !!s);

  const concorrentes = [
    ...new Set(ts.flatMap(t => t.concorrentes).map(s => s.trim()).filter(Boolean)),
  ];

  const pos = ts.filter(t => hit(texto(t), KW.positivo)).map(texto);
  const neg = ts.filter(t => hit(texto(t), KW.negativo)).map(texto);
  const preco = ts.filter(t => hit(texto(t), KW.preco)).map(texto);
  const conc = ts.filter(t => hit(texto(t), KW.concorrencia) || t.concorrentes.length).map(texto);
  const arg = ts.filter(t => hit(texto(t), KW.argumento)).map(texto);
  const dec = ts.filter(t => hit(texto(t), KW.decisao)).map(texto);
  const opo = ts.filter(t => hit(texto(t), KW.oportunidade)).map(texto);
  const ame = ts.filter(t => hit(texto(t), KW.ameaca)).map(texto);
  const gov = ts.filter(t => hit(texto(t), KW.governanca)).map(texto);

  const sinais = (data.signals ?? []).map(s => s.conclusion).filter(Boolean);
  const leituraGeral = sinais.slice(0, 4).join("\n\n") || null;

  const base = (): SinteseCampos => ({});

  const out = {} as Record<Lente, LenteBundle>;
  for (const l of LENTES) out[l] = { leitura_estrategica: null, sintese_campos: base(), highlights: [] };

  out.marca_preco = {
    leitura_estrategica: preco.slice(0, 3).join("\n\n") || leituraGeral,
    sintese_campos: {
      top_of_mind: cut(data.brands_observed ?? [], 5)?.join(", ") ?? null,
      percepcao_preco: preco[0] ?? null,
      checou_tabela: null,
      evidencia: cits[0] ?? null,
    },
    highlights: cits.slice(0, 3),
  };

  out.mix = {
    leitura_estrategica: [pos[0], neg[0]].filter(Boolean).join("\n\n") || null,
    sintese_campos: {
      o_que_funciona: cut(pos),
      o_que_nao_funciona: cut(neg),
      skus_adormecidos: null,
      motivo: neg[1] ?? null,
      evidencia: cits[1] ?? cits[0] ?? null,
    },
    highlights: cits.slice(0, 3),
  };

  out.concorrencia = {
    leitura_estrategica: conc.slice(0, 3).join("\n\n") || null,
    sintese_campos: {
      concorrente: cut(concorrentes, 10),
      categorias_onde_ganha: cut(conc),
      evidencia: cits.find(c => hit(c, KW.concorrencia)) ?? null,
    },
    highlights: cits.slice(0, 3),
  };

  out.argumento = {
    leitura_estrategica: arg.slice(0, 3).join("\n\n") || null,
    sintese_campos: {
      produto: cut(data.families_analyzed ?? [], 10),
      objecao: cut(neg),
      argumento_usado: cut(arg),
      qualidade_argumento: null,
      evidencia: cits.find(c => hit(c, KW.argumento)) ?? null,
    },
    highlights: cits.slice(0, 3),
  };

  out.decisao = {
    leitura_estrategica: dec.slice(0, 3).join("\n\n") || null,
    sintese_campos: {
      criterio_declarado: dec[0] ?? null,
      criterio_revelado: dec[1] ?? null,
      valor_defensavel: pos[0] ?? null,
      evidencia: cits.find(c => hit(c, KW.decisao)) ?? null,
    },
    highlights: [],
  };

  out.oportunidades = {
    leitura_estrategica: opo.slice(0, 3).join("\n\n") || null,
    sintese_campos: {
      oportunidade: cut(opo, 10),
      ameaca: cut(ame),
      cuidado: null,
      acao_sugerida: cut(
        (data.signals ?? []).map(s => s.business_impact).filter(Boolean) as string[],
        6,
      ),
      evidencia: cits.find(c => hit(c, KW.oportunidade)) ?? null,
    },
    highlights: cits.slice(0, 3),
  };

  out.governanca = {
    leitura_estrategica: gov.slice(0, 3).join("\n\n") || null,
    sintese_campos: {
      decisao_mencionada: cut(gov),
      sinal_autonomia: gov[0] ?? null,
      impacto_relatado: (data.signals ?? [])[0]?.business_impact ?? null,
      evidencia: cits.find(c => hit(c, KW.governanca)) ?? null,
    },
    highlights: [],
  };

  out.adicionais = {
    leitura_estrategica: leituraGeral,
    sintese_campos: {
      perfil_carteira: data.client?.location ?? null,
      clientes_estrategicos: cut([data.client?.name ?? ""], 1),
      evidencias_documentais: cut([fonte.source_filename], 1),
    },
    highlights: [],
  };

  return out;
}

/* ------------------------------------------------------------------ *
 * Mapa por família — Visitas de campo
 * ------------------------------------------------------------------ */

export const COLUNAS_FAMILIA_CAMPO = [
  { key: "funciona", label: "O QUE FUNCIONA", tone: "positivo" as const },
  { key: "nao_funciona", label: "O QUE NÃO FUNCIONA", tone: "negativo" as const },
  { key: "vantagem_concorrente", label: "VANTAGEM DOS CONCORRENTES", tone: "concorrente" as const },
  { key: "leitura_preco", label: "LEITURA DE PREÇO", tone: "preco" as const },
  { key: "concorrentes_citados", label: "CONCORRENTES MAIS CITADOS", tone: "competidor" as const },
  { key: "oportunidades", label: "OPORTUNIDADES", tone: "positivo" as const },
];

export type EvidenciaFamilia = {
  texto: string;
  cliente: string;
  data: string;
  regiao: string;
  citacao: string | null;
  relatorio: string;
};

export type LinhaFamiliaCampo = {
  familia: string;
  clientes: string[];
  celulas: Record<string, EvidenciaFamilia[]>;
};

export type MapaFamiliaCampo = {
  linhas: LinhaFamiliaCampo[];
  fontes: number;
  clientes: string[];
};

function familiasDoTrecho(t: Trecho, conhecidas: string[]): string[] {
  const n = norm(texto(t));
  const achadas = new Set<string>();
  for (const f of FAMILIAS_CANON) {
    if (f.aliases.some(a => n.includes(a))) achadas.add(f.nome);
  }
  for (const c of conhecidas) {
    const cn = norm(c);
    if (cn && cn.length > 3 && n.includes(cn)) achadas.add(resolveFamilia(c));
  }
  return [...achadas];

  function texto(x: Trecho) {
    return x.implicacao ? `${x.texto} ${x.implicacao}` : x.texto;
  }
}

/** Mapa por família construído EXCLUSIVAMENTE a partir das imersões em campo. */
export function buildMapaFamiliaCampo(fontes: (ImersaoFonte & { regiao?: string })[]): MapaFamiliaCampo {
  const linhas = new Map<string, LinhaFamiliaCampo>();
  const clientesGerais = new Set<string>();

  const garante = (familia: string) => {
    if (!linhas.has(familia)) {
      linhas.set(familia, {
        familia,
        clientes: [],
        celulas: Object.fromEntries(COLUNAS_FAMILIA_CAMPO.map(c => [c.key, [] as EvidenciaFamilia[]])),
      });
    }
    return linhas.get(familia)!;
  };

  for (const fonte of fontes) {
    const data = fonte.data;
    const cliente = data.client?.name ?? fonte.client_name;
    const regiao = fonte.regiao ?? data.client?.location ?? "";
    const dataVisita = data.client?.visit_date ?? fonte.visit_date;
    clientesGerais.add(cliente);

    const declaradas = (data.families_analyzed ?? []).map(resolveFamilia).filter(Boolean);
    for (const f of declaradas) garante(f);

    const ts = trechos(data);
    for (const t of ts) {
      const alvo = familiasDoTrecho(t, data.families_analyzed ?? []);
      const familias = alvo.length ? alvo : declaradas;
      if (!familias.length) continue;

      const texto = t.implicacao ? `${t.texto} (${t.implicacao})` : t.texto;
      const ev: EvidenciaFamilia = {
        texto,
        cliente,
        data: dataVisita,
        regiao,
        citacao: t.citacao ?? null,
        relatorio: fonte.source_filename,
      };

      const buckets: string[] = [];
      if (hit(texto, KW.preco)) buckets.push("leitura_preco");
      if (hit(texto, KW.oportunidade)) buckets.push("oportunidades");
      if (t.concorrentes.length || hit(texto, KW.concorrencia)) buckets.push("vantagem_concorrente");
      if (hit(texto, KW.negativo)) buckets.push("nao_funciona");
      if (hit(texto, KW.positivo) && !hit(texto, KW.negativo)) buckets.push("funciona");
      if (!buckets.length) buckets.push("funciona");

      for (const familia of familias) {
        const linha = garante(familia);
        if (!linha.clientes.includes(cliente)) linha.clientes.push(cliente);
        for (const b of buckets) {
          const lista = linha.celulas[b];
          const chave = norm(texto).slice(0, 120) + "|" + cliente;
          if (lista.some(x => norm(x.texto).slice(0, 120) + "|" + x.cliente === chave)) continue;
          lista.push(ev);
        }
        for (const c of t.concorrentes) {
          const lista = linha.celulas["concorrentes_citados"];
          if (lista.some(x => norm(x.texto) === norm(c) && x.cliente === cliente)) continue;
          lista.push({ ...ev, texto: c });
        }
      }
    }
  }

  return {
    linhas: [...linhas.values()].sort((a, b) => a.familia.localeCompare(b.familia, "pt-BR")),
    fontes: fontes.length,
    clientes: [...clientesGerais],
  };
}
