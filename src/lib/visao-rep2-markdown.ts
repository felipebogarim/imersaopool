// Parser e serializador do formato Markdown canônico da Visão Rep 2.
// REGRA DE FIDELIDADE: o parser apenas reconhece campos, valida a estrutura,
// remove delimitadores externos e armazena os valores. Nada é resumido,
// reescrito, corrigido ou completado.

import {
  CLASSIFICATION_LABEL,
  PERSPECTIVE_TITLES,
  VISAO_REP_SCHEMA_VERSION,
  emptyPerspective,
  emptyVisaoRep2,
  type ConfidenceLevel,
  type ConsensusPoint,
  type Divergence,
  type EvidenceStatus,
  type ExclusiveReading,
  type LineClassification,
  type PrioritySignal,
  type ProductLineView,
  type StrategicClient,
  type UnaddressedTopic,
  type VisaoRep2,
} from "./visao-rep2-schema";

// ---------- utilidades de leitura (sem reescrever conteúdo) ----------

const stripFences = (t: string) =>
  t
    .replace(/^\uFEFF/, "")
    .replace(/^\s*```[a-z]*\s*\n/i, "")
    .replace(/\n```\s*$/i, "")
    .trim();

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

type Block = { level: number; title: string; lines: string[] };

function blocks(md: string): Block[] {
  const out: Block[] = [];
  let cur: Block = { level: 0, title: "", lines: [] };
  for (const raw of md.split(/\r?\n/)) {
    const h = /^(#{1,6})\s+(.*)$/.exec(raw.trim());
    if (h) {
      out.push(cur);
      cur = { level: h[1].length, title: h[2].trim(), lines: [] };
    } else cur.lines.push(raw);
  }
  out.push(cur);
  return out.filter(b => b.title || b.lines.some(l => l.trim()));
}

/** Pares "- chave: valor" (com continuação em linhas seguintes indentadas). */
function kv(lines: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  let key: string | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      key = null;
      continue;
    }
    const m = /^[-*]\s*([A-Za-zÀ-ÿ0-9_ ]+?)\s*:\s*(.*)$/.exec(line);
    if (m) {
      key = norm(m[1]);
      map[key] = m[2].trim();
      continue;
    }
    if (key && !/^\*\*/.test(line) && !/^[-*]\s/.test(line)) map[key] = `${map[key]} ${line}`.trim();
  }
  return map;
}

/** Blocos rotulados por **Título** dentro de uma seção. */
function labeled(lines: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  let key: string | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    const m = /^\*\*(.+?)\*\*\s*$/.exec(line);
    if (m) {
      key = norm(m[1]);
      out[key] = [];
      continue;
    }
    if (key) out[key].push(raw);
  }
  return out;
}

const text = (lines: string[] | undefined): string | null => {
  const t = (lines ?? [])
    .join("\n")
    .replace(/^\s*\[texto\]\s*$/gim, "")
    .trim();
  return t ? t : null;
};

const bullets = (lines: string[] | undefined): string[] =>
  (lines ?? [])
    .map(l => l.trim())
    .filter(l => /^[-*]\s+/.test(l))
    .map(l => l.replace(/^[-*]\s+/, "").trim())
    .filter(Boolean);

const nz = (s: string | undefined): string | null => {
  const v = (s ?? "").trim();
  return v && !/^\[.*\]$/.test(v) ? v : null;
};

const list = (s: string | undefined): string[] =>
  (nz(s) ?? "")
    .split(/[;,|]/)
    .map(v => v.trim())
    .filter(Boolean);

const num = (s: string | undefined): number | null => {
  const m = /-?\d+([.,]\d+)?/.exec(nz(s) ?? "");
  return m ? Number(m[0].replace(",", ".")) : null;
};

const bool = (s: string | undefined): boolean | null => {
  const v = norm(nz(s) ?? "");
  if (!v) return null;
  if (["sim", "true", "yes", "1"].includes(v)) return true;
  if (["nao", "false", "no", "0"].includes(v)) return false;
  return null;
};

const CONF: ConfidenceLevel[] = ["alto", "medio", "baixo"];
const conf = (s: string | undefined): ConfidenceLevel | null => {
  const v = norm(nz(s) ?? "") as ConfidenceLevel;
  return CONF.includes(v) ? v : null;
};

const EVID: EvidenceStatus[] = [
  "relato_individual",
  "corroborado_por_outras_entrevistas",
  "validado_por_documento",
  "validado_por_dados",
  "hipotese_a_validar",
];
const evid = (s: string | undefined): EvidenceStatus | null => {
  const v = norm(nz(s) ?? "") as EvidenceStatus;
  return EVID.includes(v) ? v : null;
};

const CLASSES = Object.keys(CLASSIFICATION_LABEL) as LineClassification[];
const cls = (s: string | undefined): LineClassification | null => {
  const v = norm(nz(s) ?? "") as LineClassification;
  return CLASSES.includes(v) ? v : null;
};

// ---------- parser ----------

export function parseVisaoRepMarkdown(input: string): VisaoRep2 {
  const md = stripFences(input);
  const v = emptyVisaoRep2();
  v.metadata.creation_mode = "imported_ready";
  v.source_control.creation_mode = "imported_ready";

  const bs = blocks(md);
  const secOf = (re: RegExp) => bs.find(b => b.level === 2 && re.test(norm(b.title)));
  const childrenOf = (sec: Block | undefined): Block[] => {
    if (!sec) return [];
    const i = bs.indexOf(sec);
    const out: Block[] = [];
    for (let j = i + 1; j < bs.length; j++) {
      if (bs[j].level <= 2) break;
      out.push(bs[j]);
    }
    return out;
  };

  // Metadados
  const meta = kv(secOf(/^metadados?$/)?.lines ?? []);
  v.metadata.schema_version = nz(meta.schema_version) ?? VISAO_REP_SCHEMA_VERSION;
  v.metadata.representative_name = nz(meta.representante) ?? nz(meta.representative_name);
  v.metadata.region = nz(meta.regiao) ?? nz(meta.region);
  v.metadata.interview_date = nz(meta.data_entrevista);
  v.metadata.report_date = nz(meta.data_relatorio);

  // 00 — Visão executiva
  const exec = secOf(/visao_executiva/);
  if (exec) {
    const lb = labeled(exec.lines);
    v.executive_view.central_thesis = text(lb.tese_central);
    v.executive_view.strategic_risk = text(lb.risco_estrategico);
    v.executive_view.decisions_required = bullets(lb.decisoes_requeridas).slice(0, 3);
    v.executive_view.validation_required = bullets(lb.validacoes_necessarias).slice(0, 3);
    v.executive_view.final_synthesis = text(lb.sintese_final);

    const sinais: PrioritySignal[] = childrenOf(exec)
      .filter(b => /^sinal/.test(norm(b.title)))
      .slice(0, 5)
      .map(b => {
        const f = kv(b.lines);
        return {
          title: nz(f.titulo) ?? b.title.replace(/^Sinal\s*\d*\s*[—-]?\s*/i, "").trim() || null,
          finding: nz(f.achado),
          business_impact: nz(f.impacto_comercial),
          recommended_action: nz(f.acao_recomendada),
          confidence_level: conf(f.nivel_confianca),
          evidence_status: evid(f.status_evidencia),
          source_chapter: nz(f.capitulo_origem),
          source_quote: nz(f.citacao),
        };
      });
    v.executive_view.priority_signals = sinais;
  }

  // 01 — Contexto do representante
  const ctx = secOf(/contexto_do_representante|contexto_representante/);
  if (ctx) {
    const lb = labeled(ctx.lines);
    const marcasKey = Object.keys(lb).find(k => k.includes("marcas"));
    v.representative_context.represented_brands = marcasKey ? bullets(lb[marcasKey]) : [];
    const regKey = Object.keys(lb).find(k => k.includes("regiao") && k.includes("modelo"));
    v.representative_context.region_summary = regKey ? text(lb[regKey]) : null;
    v.representative_context.service_model = text(lb.modelo_de_atendimento);
    v.representative_context.regional_structure = text(lb.estrutura_regional);
    v.representative_context.additional_context = text(lb.contexto_adicional);
  }

  // 02 — Clientes estratégicos
  const cli = secOf(/clientes_estrategicos/);
  const clients: StrategicClient[] = childrenOf(cli)
    .filter(b => /^cliente/.test(norm(b.title)))
    .slice(0, 5)
    .map(b => {
      const f = kv(b.lines);
      return {
        client_name: nz(f.nome) ?? b.title.replace(/^Cliente\s*\d*\s*[—-]?\s*/i, "").trim() || null,
        strategic_reason: nz(f.motivo_estrategico),
        perceived_potential: nz(f.potencial_percebido),
        identified_opportunity: nz(f.oportunidade),
        priority_product_lines: nz(f.linhas_prioritarias),
        main_competitor: nz(f.concorrente_principal),
        recommended_next_action: nz(f.proxima_acao),
        attention_point: nz(f.ponto_de_atencao),
      };
    });
  v.strategic_clients = clients;

  // 03 — Visão por linha de produto
  const lin = secOf(/visao_por_linha_de_produto|linhas_de_produto/);
  const linhas: ProductLineView[] = childrenOf(lin)
    .filter(b => /^linha/.test(norm(b.title)))
    .map(b => {
      const f = kv(b.lines);
      return {
        product_line: b.title.replace(/^Linha\s*[—-]?\s*/i, "").trim() || null,
        summary: nz(f.leitura_resumida),
        classification: cls(f.classificacao),
        what_works: nz(f.o_que_funciona),
        main_barrier: nz(f.principal_barreira),
        main_competitor: nz(f.concorrente_principal),
        competitor_advantage: nz(f.vantagem_do_concorrente),
        opportunity: nz(f.oportunidade),
        recommended_action: nz(f.acao_recomendada),
        evidence: nz(f.evidencia),
        source_quote: nz(f.citacao),
      };
    });
  v.product_line_views = linhas;

  // 04 — Perspectivas
  const per = secOf(/perspectivas/);
  for (const b of childrenOf(per).filter(x => /^perspectiva/.test(norm(x.title)))) {
    const n = Number(/(\d{1,2})/.exec(b.title)?.[1] ?? 0);
    if (!n || n < 1 || n > 8) continue;
    const f = kv(b.lines);
    const lb = labeled(b.lines);
    const base = emptyPerspective(n - 1);
    v.perspectives[n - 1] = {
      ...base,
      perspective_title: b.title.replace(/^Perspectiva\s*\d+\s*[—-]?\s*/i, "").trim() || PERSPECTIVE_TITLES[n - 1],
      executive_finding: nz(f.achado_executivo),
      business_impact: nz(f.impacto_comercial),
      recommended_action: nz(f.acao_recomendada),
      evidence: nz(f.evidencia),
      source_quote: nz(f.citacao),
      confidence_level: conf(f.nivel_confianca),
      evidence_status: evid(f.status_evidencia),
      comparative_classification: nz(f.classificacao_comparativa),
      full_reading: text(lb.leitura_completa),
      structured_fields: {},
    };
  }

  // 05 — Paralelo com o grupo
  const par = secOf(/paralelo/);
  if (par) {
    const lb = labeled(par.lines);
    const base = kv(lb.base_comparavel ?? []);
    v.comparative_view.comparable_source_count = num(base.quantidade_de_fontes);
    v.comparative_view.comparable_point_count = num(base.quantidade_de_pontos_comparaveis);
    v.comparative_view.supported_points = num(base.quantidade_de_pontos_sustentados);
    v.comparative_view.methodology_note = text(lb.nota_metodologica);

    const kids = childrenOf(par);
    const consensos: ConsensusPoint[] = kids
      .filter(b => /^consenso/.test(norm(b.title)))
      .map(b => {
        const f = kv(b.lines);
        return {
          statement: nz(f.afirmacao),
          supporting_source_count: num(f.fontes_que_sustentam),
          comparable_source_count: num(f.total_de_fontes_comparaveis),
          supporting_sources: list(f.fontes),
        };
      });
    const temas: UnaddressedTopic[] = kids
      .filter(b => /^tema/.test(norm(b.title)))
      .map(b => {
        const f = kv(b.lines);
        return {
          statement: nz(f.afirmacao),
          question_was_asked: bool(f.pergunta_foi_feita),
          comparison_is_valid: bool(f.comparacao_valida),
          classification: nz(f.classificacao),
          methodological_note: nz(f.nota_metodologica),
        };
      });
    const divs: Divergence[] = kids
      .filter(b => /^divergencia/.test(norm(b.title)))
      .map(b => {
        const f = kv(b.lines);
        return {
          topic: nz(f.tema),
          predominant_view: nz(f.leitura_predominante),
          representative_view: nz(f.leitura_do_representante),
          sources_supporting_predominant_view: list(f.fontes_leitura_predominante),
          sources_supporting_representative_view: list(f.fontes_leitura_representante),
          evidence: nz(f.evidencia),
        };
      });
    const excl: ExclusiveReading[] = kids
      .filter(b => /^leitura/.test(norm(b.title)))
      .map(b => {
        const f = kv(b.lines);
        return {
          statement: nz(f.afirmacao),
          region: nz(f.regiao),
          supporting_evidence: nz(f.evidencia),
          validation_required: nz(f.validacao_necessaria),
        };
      });

    v.comparative_view.consensus_points = consensos;
    v.comparative_view.unaddressed_topics = temas;
    v.comparative_view.divergences = divs;
    v.comparative_view.exclusive_readings = excl;
  }

  return v;
}

// ---------- serializador (mesmo padrão aceito pelo importador) ----------

const S = (v: unknown) => (v == null || v === "" ? "" : String(v));

export function toVisaoRepMarkdown(v: VisaoRep2): string {
  const L: string[] = [];
  L.push("# VISÃO REP — RELATÓRIO FINAL", "");
  L.push("## Metadados", "");
  L.push(`- schema_version: ${S(v.metadata.schema_version)}`);
  L.push(`- representante: ${S(v.metadata.representative_name)}`);
  L.push(`- regiao: ${S(v.metadata.region)}`);
  L.push(`- data_entrevista: ${S(v.metadata.interview_date)}`);
  L.push(`- data_relatorio: ${S(v.metadata.report_date)}`);
  L.push(`- base_comparativa: ${S(v.comparative_view.comparable_source_count)}`);
  L.push(`- creation_mode: ${S(v.metadata.creation_mode)}`, "");

  L.push("## 00 — Visão executiva", "");
  L.push("**Tese central**", "", S(v.executive_view.central_thesis), "");
  L.push("**Risco estratégico**", "", S(v.executive_view.strategic_risk), "");
  L.push("**Sinais prioritários**", "");
  v.executive_view.priority_signals.forEach((s, i) => {
    L.push(`### Sinal ${i + 1}`, "");
    L.push(`- titulo: ${S(s.title)}`);
    L.push(`- achado: ${S(s.finding)}`);
    L.push(`- impacto_comercial: ${S(s.business_impact)}`);
    L.push(`- acao_recomendada: ${S(s.recommended_action)}`);
    L.push(`- nivel_confianca: ${S(s.confidence_level)}`);
    L.push(`- status_evidencia: ${S(s.evidence_status)}`);
    L.push(`- capitulo_origem: ${S(s.source_chapter)}`);
    L.push(`- citacao: ${S(s.source_quote)}`, "");
  });
  L.push("**Decisões requeridas**", "");
  v.executive_view.decisions_required.forEach(d => L.push(`- ${d}`));
  L.push("", "**Validações necessárias**", "");
  v.executive_view.validation_required.forEach(d => L.push(`- ${d}`));
  L.push("", "**Síntese final**", "", S(v.executive_view.final_synthesis), "");

  L.push("## 01 — Contexto do representante", "");
  L.push("**Marcas que representa além da Newline**", "");
  v.representative_context.represented_brands.forEach(m => L.push(`- ${m}`));
  L.push("", "**Região e modelo de atendimento**", "", S(v.representative_context.region_summary), "");
  L.push("**Estrutura regional**", "", S(v.representative_context.regional_structure), "");

  L.push("## 02 — Clientes estratégicos", "");
  v.strategic_clients.forEach((c, i) => {
    L.push(`### Cliente ${i + 1}`, "");
    L.push(`- nome: ${S(c.client_name)}`);
    L.push(`- motivo_estrategico: ${S(c.strategic_reason)}`);
    L.push(`- potencial_percebido: ${S(c.perceived_potential)}`);
    L.push(`- oportunidade: ${S(c.identified_opportunity)}`);
    L.push(`- linhas_prioritarias: ${S(c.priority_product_lines)}`);
    L.push(`- concorrente_principal: ${S(c.main_competitor)}`);
    L.push(`- proxima_acao: ${S(c.recommended_next_action)}`);
    L.push(`- ponto_de_atencao: ${S(c.attention_point)}`, "");
  });

  L.push("## 03 — Visão por linha de produto", "");
  v.product_line_views.forEach(p => {
    L.push(`### Linha — ${S(p.product_line)}`, "");
    L.push(`- leitura_resumida: ${S(p.summary)}`);
    L.push(`- classificacao: ${S(p.classification)}`);
    L.push(`- o_que_funciona: ${S(p.what_works)}`);
    L.push(`- principal_barreira: ${S(p.main_barrier)}`);
    L.push(`- concorrente_principal: ${S(p.main_competitor)}`);
    L.push(`- vantagem_do_concorrente: ${S(p.competitor_advantage)}`);
    L.push(`- oportunidade: ${S(p.opportunity)}`);
    L.push(`- acao_recomendada: ${S(p.recommended_action)}`);
    L.push(`- evidencia: ${S(p.evidence)}`);
    L.push(`- citacao: ${S(p.source_quote)}`, "");
  });

  L.push("## 04 — Perspectivas da entrevista", "");
  v.perspectives.forEach(p => {
    L.push(`### Perspectiva ${String(p.perspective_number).padStart(2, "0")} — ${p.perspective_title}`, "");
    L.push(`- achado_executivo: ${S(p.executive_finding)}`);
    L.push(`- impacto_comercial: ${S(p.business_impact)}`);
    L.push(`- acao_recomendada: ${S(p.recommended_action)}`);
    L.push(`- evidencia: ${S(p.evidence)}`);
    L.push(`- citacao: ${S(p.source_quote)}`);
    L.push(`- nivel_confianca: ${S(p.confidence_level)}`);
    L.push(`- status_evidencia: ${S(p.evidence_status)}`);
    L.push(`- classificacao_comparativa: ${S(p.comparative_classification)}`, "");
    L.push("**Leitura completa**", "", S(p.full_reading), "");
  });

  L.push("## 05 — Paralelo com o grupo", "");
  L.push("**Base comparável**", "");
  L.push(`- quantidade_de_fontes: ${S(v.comparative_view.comparable_source_count)}`);
  L.push(`- quantidade_de_pontos_comparaveis: ${S(v.comparative_view.comparable_point_count)}`);
  L.push(`- quantidade_de_pontos_sustentados: ${S(v.comparative_view.supported_points)}`, "");
  L.push("**Consensos**", "");
  v.comparative_view.consensus_points.forEach((c, i) => {
    L.push(`### Consenso ${i + 1}`, "");
    L.push(`- afirmacao: ${S(c.statement)}`);
    L.push(`- fontes_que_sustentam: ${S(c.supporting_source_count)}`);
    L.push(`- total_de_fontes_comparaveis: ${S(c.comparable_source_count)}`, "");
  });
  L.push("**Temas não abordados**", "");
  v.comparative_view.unaddressed_topics.forEach((t, i) => {
    L.push(`### Tema ${i + 1}`, "");
    L.push(`- afirmacao: ${S(t.statement)}`);
    L.push(`- pergunta_foi_feita: ${t.question_was_asked == null ? "" : t.question_was_asked ? "sim" : "nao"}`);
    L.push(`- comparacao_valida: ${t.comparison_is_valid == null ? "" : t.comparison_is_valid ? "sim" : "nao"}`);
    L.push(`- classificacao: ${S(t.classification)}`);
    L.push(`- nota_metodologica: ${S(t.methodological_note)}`, "");
  });
  L.push("**Divergências**", "");
  v.comparative_view.divergences.forEach((d, i) => {
    L.push(`### Divergência ${i + 1}`, "");
    L.push(`- tema: ${S(d.topic)}`);
    L.push(`- leitura_predominante: ${S(d.predominant_view)}`);
    L.push(`- leitura_do_representante: ${S(d.representative_view)}`);
    L.push(`- fontes_leitura_predominante: ${d.sources_supporting_predominant_view.join(", ")}`);
    L.push(`- fontes_leitura_representante: ${d.sources_supporting_representative_view.join(", ")}`);
    L.push(`- evidencia: ${S(d.evidence)}`, "");
  });
  L.push("**Leituras exclusivas**", "");
  v.comparative_view.exclusive_readings.forEach((e, i) => {
    L.push(`### Leitura ${i + 1}`, "");
    L.push(`- afirmacao: ${S(e.statement)}`);
    L.push(`- regiao: ${S(e.region)}`);
    L.push(`- evidencia: ${S(e.supporting_evidence)}`);
    L.push(`- validacao_necessaria: ${S(e.validation_required)}`, "");
  });

  return L.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/** Hash simples e estável do conteúdo importado (auditoria de origem). */
export async function contentHash(text: string): Promise<string | null> {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}
