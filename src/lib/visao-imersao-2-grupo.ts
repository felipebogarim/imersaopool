// Comparação com o grupo (Visão Imersão 2).
// Os relatórios V2 chegam por cliente e não trazem `comparative_view`.
// Este módulo constrói o paralelo com o grupo em tempo de leitura, comparando
// os sinais do relatório aberto com os sinais dos demais relatórios salvos.

import type { VisaoRep2, ConsensusPoint, ExclusiveReading, UnaddressedTopic } from "./visao-rep2-schema";

const STOPWORDS = new Set([
  "para", "como", "esta", "este", "essa", "esse", "sobre", "entre", "quando", "porque", "pelos", "pelas",
  "mais", "menos", "muito", "pouco", "onde", "ainda", "sendo", "seja", "seus", "suas", "pela", "pelo",
  "com", "sem", "dos", "das", "que", "uma", "uns", "umas", "nao", "não", "por", "mas", "nos", "nas",
  "cliente", "clientes", "empresa", "newline", "marca", "produto", "produtos", "loja", "lojas",
  "precisa", "pode", "tem", "ter", "ser", "foi", "sao", "são", "isso", "aqui", "casa",
]);

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function tokens(text: string): Set<string> {
  return new Set(
    norm(text)
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(w => w.length >= 4 && !STOPWORDS.has(w)),
  );
}

function similarity(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  return inter / Math.min(a.size, b.size);
}

type OutroSinal = {
  cliente: string;
  titulo: string;
  conclusao: string;
  tokens: Set<string>;
};

const LIMIAR = 0.28;

function nomeCliente(v: VisaoRep2): string {
  return (v.metadata.client_name ?? v.metadata.representative_name ?? "Outro relatório").trim();
}

function sinaisDe(v: VisaoRep2): OutroSinal[] {
  const cliente = nomeCliente(v);
  return v.executive_view.priority_signals.map(s => {
    const titulo = (s.title ?? "").trim();
    const conclusao = (s.finding ?? "").trim();
    return { cliente, titulo, conclusao, tokens: tokens(`${titulo} ${conclusao}`) };
  });
}

/**
 * Devolve uma cópia do relatório com `comparative_view` calculado contra os
 * demais relatórios de imersão já carregados (um por cliente).
 */
export function withGroupComparison(visao: VisaoRep2, outros: VisaoRep2[]): VisaoRep2 {
  const base = outros.filter(o => nomeCliente(o) && nomeCliente(o) !== nomeCliente(visao));
  if (!base.length) return visao;

  const universo = base.flatMap(sinaisDe).filter(s => s.tokens.size > 0);
  const comparaveis = base.length;

  const consensus_points: ConsensusPoint[] = [];
  const exclusive_readings: ExclusiveReading[] = [];
  const unaddressed_topics: UnaddressedTopic[] = [];
  const cobertos = new Set<OutroSinal>();

  for (const s of visao.executive_view.priority_signals) {
    const id = s.signal_id ?? null;
    const titulo = (s.title ?? "").trim();
    const conclusao = (s.finding ?? "").trim();
    const tk = tokens(`${titulo} ${conclusao}`);
    if (!tk.size) continue;

    // Melhor correspondência por cliente do grupo.
    const porCliente = new Map<string, { sinal: OutroSinal; score: number }>();
    for (const o of universo) {
      const score = similarity(tk, o.tokens);
      if (score < LIMIAR) continue;
      const atual = porCliente.get(o.cliente);
      if (!atual || score > atual.score) porCliente.set(o.cliente, { sinal: o, score });
    }

    if (porCliente.size) {
      for (const { sinal } of porCliente.values()) cobertos.add(sinal);
      consensus_points.push({
        signal_id: id,
        statement: titulo || conclusao,
        supporting_source_count: porCliente.size,
        comparable_source_count: comparaveis,
        supporting_sources: [...porCliente.keys()],
      });
    } else {
      exclusive_readings.push({
        signal_id: id,
        statement: titulo || conclusao,
        region: visao.metadata.region ?? null,
        supporting_evidence: conclusao || null,
        validation_required:
          comparaveis > 1
            ? `Nenhum dos ${comparaveis} relatórios comparáveis trouxe leitura equivalente.`
            : "Base comparável ainda pequena — confirmar em novas imersões.",
      });
    }
  }

  // Temas recorrentes no grupo (2+ clientes) que este relatório não trouxe.
  const naoCobertos = universo.filter(o => !cobertos.has(o));
  const clusters: { rep: OutroSinal; clientes: Set<string> }[] = [];
  for (const o of naoCobertos) {
    const c = clusters.find(x => similarity(x.rep.tokens, o.tokens) >= LIMIAR);
    if (c) c.clientes.add(o.cliente);
    else clusters.push({ rep: o, clientes: new Set([o.cliente]) });
  }
  const sinaisAtuais = visao.executive_view.priority_signals;
  for (const c of clusters
    .filter(x => x.clientes.size >= 2)
    .sort((a, b) => b.clientes.size - a.clientes.size)
    .slice(0, 3)) {
    // Ancoramos o tema no sinal mais próximo para que apareça no painel do sinal.
    let ancora: string | null = sinaisAtuais[0]?.signal_id ?? null;
    let melhor = -1;
    for (const s of sinaisAtuais) {
      const score = similarity(tokens(`${s.title ?? ""} ${s.finding ?? ""}`), c.rep.tokens);
      if (score > melhor) {
        melhor = score;
        ancora = s.signal_id ?? ancora;
      }
    }
    unaddressed_topics.push({
      signal_id: ancora,
      statement: c.rep.titulo || c.rep.conclusao,
      question_was_asked: null,
      comparison_is_valid: true,
      classification: `Recorrente em ${c.clientes.size} clientes do grupo`,
      methodological_note: `Presente em: ${[...c.clientes].join(", ")}. Não apareceu nesta imersão.`,
    });
  }

  return {
    ...visao,
    comparative_view: {
      ...visao.comparative_view,
      comparable_source_count: comparaveis,
      comparable_point_count: consensus_points.length + exclusive_readings.length,
      supported_points: consensus_points.length,
      consensus_points,
      unaddressed_topics,
      divergences: visao.comparative_view.divergences,
      exclusive_readings,
      methodology_note:
        `Paralelo calculado automaticamente sobre ${comparaveis} relatório(s) de imersão de outros clientes já carregados na plataforma.`,
    },
  };
}
