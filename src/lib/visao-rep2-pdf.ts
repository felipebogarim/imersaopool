// Exporta a Visão Rep em PDF com o mesmo padrão visual da página do sistema:
// fundo azul-claro, cartões arredondados, faixas de seção escuras, badges e
// barras de performance — espelhando os blocos da tela.
import jsPDF from "jspdf";
import {
  CLASSIFICATION_LABEL,
  CONFIDENCE_LABEL,
  EVIDENCE_LABEL,
  type VisaoRep2,
} from "@/lib/visao-rep2-schema";
import { fmtPct, type PerfResumo } from "@/lib/visao-rep";

type RGB = [number, number, number];
type Style = "normal" | "bold" | "italic";

/** Tokens do design system convertidos de OKLCH (src/styles.css) para RGB. */
const C = {
  background: [225, 233, 239] as RGB,
  card: [240, 246, 250] as RGB,
  muted: [215, 223, 229] as RGB,
  border: [181, 191, 198] as RGB,
  foreground: [14, 28, 40] as RGB,
  mutedFg: [71, 84, 96] as RGB,
  primary: [0, 141, 173] as RGB,
  primaryDeep: [6, 40, 56] as RGB,
  success: [0, 148, 77] as RGB,
  warning: [215, 141, 0] as RGB,
  compare: [230, 140, 44] as RGB,
  white: [255, 255, 255] as RGB,
};

const has = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

type Line = { s: string; size: number; style: Style; color: RGB };

export function exportVisaoRep2Pdf(visao: VisaoRep2, perf: PerfResumo | null) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const M = 40;
  const PW = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const W = PW - M * 2;
  const BOTTOM = H - M - 22;
  let y = M;

  const repNome = visao.metadata.representative_name ?? "Representante";

  const paintBg = () => {
    doc.setFillColor(...C.background);
    doc.rect(0, 0, PW, H, "F");
  };
  const newPage = () => {
    doc.addPage();
    paintBg();
    y = M;
  };
  const br = (h: number) => {
    if (y + h > BOTTOM) newPage();
  };
  const lines = (s: string, size: number, style: Style, width: number) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    return doc.splitTextToSize(s, width) as string[];
  };
  const text = (s: string, size: number, style: Style, color: RGB, indent = 0) => {
    doc.setTextColor(...color);
    for (const line of lines(s, size, style, W - indent)) {
      br(size + 4);
      doc.setFont("helvetica", style);
      doc.setFontSize(size);
      doc.text(line, M + indent, y);
      y += size + 4;
    }
  };

  const card = (h: number, opts: { accent?: RGB; fill?: RGB } = {}) => {
    doc.setFillColor(...(opts.fill ?? C.card));
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.7);
    doc.roundedRect(M, y, W, h, 8, 8, "FD");
    if (opts.accent) {
      doc.setFillColor(...opts.accent);
      doc.roundedRect(M, y, 3.5, h, 2, 2, "F");
    }
  };

  const secao = (titulo: string) => {
    br(46);
    y += 14;
    doc.setFillColor(...C.primaryDeep);
    doc.roundedRect(M, y - 12, W, 24, 6, 6, "F");
    doc.setFillColor(...C.primary);
    doc.roundedRect(M, y - 12, 4, 24, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...C.white);
    doc.text(titulo.toUpperCase(), M + 14, y + 4);
    y += 26;
  };

  /** Pílulas no padrão dos Badges da tela. */
  const chips = (items: { label: string; color?: RGB; outline?: boolean }[]) => {
    if (!items.length) return;
    let x = M;
    const h = 15;
    br(h + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    for (const it of items) {
      const w = doc.getTextWidth(it.label) + 14;
      if (x + w > M + W) {
        y += h + 5;
        br(h + 6);
        x = M;
      }
      if (it.outline) {
        doc.setDrawColor(...(it.color ?? C.border));
        doc.setLineWidth(0.7);
        doc.roundedRect(x, y - h + 4, w, h, 7, 7, "S");
        doc.setTextColor(...(it.color ?? C.mutedFg));
      } else {
        doc.setFillColor(...(it.color ?? C.primary));
        doc.roundedRect(x, y - h + 4, w, h, 7, 7, "F");
        doc.setTextColor(...C.white);
      }
      doc.text(it.label, x + 7, y + 3.5);
      x += w + 6;
    }
    y += h + 4;
  };

  const blocoCard = (titulo: string | null, corpo: Line[], accent: RGB = C.primary) => {
    const body = corpo.filter(c => has(c.s));
    if (!body.length && !titulo) return;
    const pad = 10;
    const inner = W - pad * 2 - 4;
    const tLines = titulo ? lines(titulo, 9.5, "bold", inner) : [];
    const parts = body.map(c => ({ ...c, ls: lines(c.s, c.size, c.style, inner) }));
    const h =
      pad * 2 +
      tLines.length * 13 +
      (titulo ? 4 : 0) +
      parts.reduce((acc, p) => acc + p.ls.length * (p.size + 4), 0);

    if (h > BOTTOM - M) {
      if (titulo) text(titulo, 9.5, "bold", C.primaryDeep, 14);
      for (const p of parts) text(p.s, p.size, p.style, p.color, 14);
      y += 6;
      return;
    }
    br(h + 8);
    card(h, { accent });
    let cy = y + pad + 8;
    const draw = (s: string, size: number, style: Style, color: RGB, lh: number) => {
      doc.setFont("helvetica", style);
      doc.setFontSize(size);
      doc.setTextColor(...color);
      doc.text(s, M + pad + 4, cy);
      cy += lh;
    };
    for (const l of tLines) draw(l, 9.5, "bold", C.primaryDeep, 13);
    if (titulo) cy += 3;
    for (const p of parts) for (const l of p.ls) draw(l, p.size, p.style, p.color, p.size + 4);
    y += h + 8;
  };

  /** Campo rotulado no padrão <Field label value /> da tela. */
  const campo = (label: string, value: string | null | undefined): Line[] =>
    has(value) ? [{ s: `${label}: ${value.trim()}`, size: 9, style: "normal", color: C.foreground }] : [];

  const citacao = (value: string | null | undefined): Line[] =>
    has(value) ? [{ s: `“${value.trim()}”`, size: 9, style: "italic", color: C.mutedFg }] : [];

  // ---------- Capa ----------
  paintBg();
  doc.setFillColor(...C.primaryDeep);
  doc.roundedRect(M, y, W, 78, 10, 10, "F");
  doc.setFillColor(...C.primary);
  doc.roundedRect(M, y, 5, 78, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...C.primary);
  doc.text("POOLFLUX · ANÁLISES", M + 18, y + 22);
  doc.setFontSize(19);
  doc.setTextColor(...C.white);
  doc.text("Visão Rep — leitura executiva", M + 18, y + 45);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(196, 214, 224);
  const meta = [
    repNome,
    visao.metadata.region ?? null,
    visao.metadata.interview_date ? `entrevista ${visao.metadata.interview_date}` : null,
    `gerado em ${new Date().toLocaleString("pt-BR")}`,
  ]
    .filter(Boolean)
    .join(" · ");
  doc.text(lines(meta, 9, "normal", W - 36)[0], M + 18, y + 63);
  y += 78 + 6;

  chips([
    {
      label: visao.source_control.creation_mode === "imported_ready" ? "Relatório importado" : "Gerado com IA",
      color: C.primary,
    },
    { label: visao.metadata.schema_version, outline: true },
    ...(visao.source_control.content_hash
      ? [{ label: `hash ${visao.source_control.content_hash.slice(0, 12)}`, outline: true }]
      : []),
  ]);

  // ---------- Visão executiva ----------
  const ev = visao.executive_view;
  secao("Visão executiva");
  blocoCard(null, [...campo("Tese central", ev.central_thesis), ...campo("Risco estratégico", ev.strategic_risk)]);

  ev.priority_signals.forEach((s, i) => {
    const tags = [s.confidence_level ? CONFIDENCE_LABEL[s.confidence_level] : null, s.evidence_status ? EVIDENCE_LABEL[s.evidence_status] : null]
      .filter(Boolean)
      .join(" · ");
    blocoCard(
      `${i + 1}. ${s.title ?? `Sinal ${i + 1}`}${tags ? ` — ${tags}` : ""}`,
      [
        ...campo("Achado", s.finding),
        ...campo("Impacto comercial", s.business_impact),
        ...campo("Ação recomendada", s.recommended_action),
        ...campo("Capítulo de origem", s.source_chapter),
        ...citacao(s.source_quote),
      ],
      C.primary,
    );
  });

  if (ev.decisions_required.length) {
    blocoCard(
      "Decisões requeridas",
      ev.decisions_required.map(d => ({ s: `• ${d}`, size: 9, style: "normal" as Style, color: C.foreground })),
      C.warning,
    );
  }
  if (ev.validation_required.length) {
    blocoCard(
      "Validações necessárias",
      ev.validation_required.map(d => ({ s: `• ${d}`, size: 9, style: "normal" as Style, color: C.foreground })),
      C.compare,
    );
  }
  blocoCard(null, campo("Síntese final", ev.final_synthesis), C.primaryDeep);

  // ---------- Contexto ----------
  const ctx = visao.representative_context;
  if (
    ctx.represented_brands.length ||
    has(ctx.region_summary) ||
    has(ctx.service_model) ||
    has(ctx.regional_structure) ||
    has(ctx.additional_context)
  ) {
    secao("Contexto do representante");
    if (ctx.represented_brands.length) {
      text("Marcas que representa além da Newline", 9, "bold", C.mutedFg);
      y += 2;
      chips(ctx.represented_brands.map(m => ({ label: m, outline: true })));
    }
    blocoCard(null, [
      ...campo("Região e modelo de atendimento", ctx.region_summary),
      ...campo("Modelo de atendimento", ctx.service_model),
      ...campo("Estrutura regional", ctx.regional_structure),
      ...campo("Contexto adicional", ctx.additional_context),
    ]);
  }

  // ---------- Clientes estratégicos ----------
  if (visao.strategic_clients.length) {
    secao("Clientes estratégicos");
    visao.strategic_clients.forEach((c, i) => {
      blocoCard(c.client_name ?? `Cliente ${i + 1}`, [
        ...campo("Motivo estratégico", c.strategic_reason),
        ...campo("Potencial percebido", c.perceived_potential),
        ...campo("Oportunidade", c.identified_opportunity),
        ...campo("Linhas prioritárias", c.priority_product_lines),
        ...campo("Concorrente principal", c.main_competitor),
        ...campo("Próxima ação", c.recommended_next_action),
        ...campo("Ponto de atenção", c.attention_point),
      ]);
    });
  }

  // ---------- Linhas de produto ----------
  if (visao.product_line_views.length) {
    secao("Visão por linha de produto");
    const corDaClasse: Record<string, RGB> = {
      forte: C.success,
      potencial: C.primary,
      pressionada: C.compare,
      sem_evidencia_suficiente: C.border,
    };
    for (const l of visao.product_line_views) {
      const cls = l.classification;
      blocoCard(
        `${l.product_line ?? "Linha"}${cls ? ` · ${CLASSIFICATION_LABEL[cls]}` : ""}`,
        [
          ...campo("Leitura resumida", l.summary),
          ...campo("O que funciona", l.what_works),
          ...campo("Principal barreira", l.main_barrier),
          ...campo("Concorrente principal", l.main_competitor),
          ...campo("Vantagem do concorrente", l.competitor_advantage),
          ...campo("Oportunidade", l.opportunity),
          ...campo("Ação recomendada", l.recommended_action),
          ...campo("Evidência", l.evidence),
          ...citacao(l.source_quote),
        ],
        (cls && corDaClasse[cls]) || C.primary,
      );
    }
  }

  // ---------- Perspectivas ----------
  secao("Perspectivas da entrevista");
  for (const p of visao.perspectives) {
    const vazia = !has(p.executive_finding) && !has(p.full_reading);
    const num = String(p.perspective_number).padStart(2, "0");
    br(40);
    y += 4;
    doc.setFillColor(...C.muted);
    doc.roundedRect(M, y - 10, W, 22, 6, 6, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...C.primaryDeep);
    doc.text(`${num}  ${p.perspective_title}`, M + 10, y + 4);
    const tags = [p.confidence_level ? CONFIDENCE_LABEL[p.confidence_level] : null, p.evidence_status ? EVIDENCE_LABEL[p.evidence_status] : null]
      .filter(Boolean)
      .join(" · ");
    if (tags) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(...C.mutedFg);
      doc.text(tags, M + W - 10, y + 4, { align: "right" });
    }
    y += 24;

    if (vazia) {
      blocoCard(null, [{ s: "Sem conteúdo informado.", size: 9, style: "italic", color: C.mutedFg }], C.border);
      continue;
    }
    blocoCard(null, [
      ...campo("Achado executivo", p.executive_finding),
      ...campo("Impacto comercial", p.business_impact),
      ...campo("Ação recomendada", p.recommended_action),
      ...campo("Evidência", p.evidence),
      ...campo("Classificação comparativa", p.comparative_classification),
      ...citacao(p.source_quote),
    ]);
    if (has(p.full_reading)) {
      blocoCard(
        "Análise completa",
        [{ s: p.full_reading, size: 9, style: "normal", color: C.foreground }],
        C.primaryDeep,
      );
    }
  }

  // ---------- Paralelo ----------
  const cv = visao.comparative_view;
  if (
    cv.consensus_points.length ||
    cv.divergences.length ||
    cv.unaddressed_topics.length ||
    cv.exclusive_readings.length ||
    cv.comparable_source_count != null
  ) {
    secao("Paralelo com o grupo");
    chips([
      ...(cv.supported_points != null && cv.comparable_point_count != null
        ? [{ label: `${cv.supported_points} de ${cv.comparable_point_count} pontos sustentados`, color: C.primary }]
        : []),
      ...(cv.comparable_source_count != null
        ? [{ label: `Base de ${cv.comparable_source_count} entrevistas`, outline: true }]
        : []),
    ]);

    if (cv.consensus_points.length) {
      blocoCard(
        "Consensos",
        cv.consensus_points.map(c => ({
          s: `• ${c.statement ?? ""}${c.supporting_source_count != null ? ` (${c.supporting_source_count}${c.comparable_source_count != null ? ` de ${c.comparable_source_count}` : ""} fontes)` : ""}`,
          size: 9,
          style: "normal" as Style,
          color: C.success,
        })),
        C.success,
      );
    }
    if (cv.unaddressed_topics.length) {
      blocoCard(
        "Temas não abordados",
        cv.unaddressed_topics.flatMap(t => [
          {
            s: `• ${t.statement ?? ""}${t.classification ? ` — ${t.classification}` : ""}${t.question_was_asked === false ? " · pergunta não foi feita" : ""}`,
            size: 9,
            style: "normal" as Style,
            color: C.mutedFg,
          },
          ...campo("   Nota metodológica", t.methodological_note),
        ]),
        C.border,
      );
    }
    if (cv.divergences.length) {
      blocoCard(
        "Divergências",
        cv.divergences.flatMap(d => [
          { s: `• ${d.topic ?? ""}`, size: 9, style: "bold" as Style, color: C.compare },
          ...campo("   Leitura predominante", d.predominant_view),
          ...campo("   Leitura do representante", d.representative_view),
          ...campo("   Evidência", d.evidence),
        ]),
        C.compare,
      );
    }
    if (cv.exclusive_readings.length) {
      blocoCard(
        "Hipótese regional ou leitura exclusiva",
        cv.exclusive_readings.flatMap(e => [
          { s: `• ${e.statement ?? ""}`, size: 9, style: "normal" as Style, color: C.foreground },
          ...campo("   Região", e.region),
          ...campo("   Evidência", e.supporting_evidence),
          ...campo("   Validação necessária", e.validation_required),
        ]),
        C.foreground,
      );
    }
    blocoCard(null, campo("Nota metodológica", cv.methodology_note), C.border);
  }

  // ---------- Performance ----------
  secao("Conexão com a Performance");
  if (!perf) {
    blocoCard(
      null,
      [
        {
          s: "Ainda não há uma Performance ativa vinculada a este representante.",
          size: 9.5,
          style: "italic",
          color: C.mutedFg,
        },
      ],
      C.border,
    );
  } else {
    chips([
      { label: perf.periodoLabel, color: C.primary },
      { label: `Resultado geral ${fmtPct(perf.geralPct)}`, outline: true },
      { label: `${perf.clientes} clientes`, outline: true },
    ]);
    if (perf.familias.length) {
      const maxPct = Math.max(100, ...perf.familias.map(f => f.pct ?? 0));
      for (const f of perf.familias) {
        br(20);
        const labelW = 150;
        const barW = W - labelW - 60;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...C.foreground);
        doc.text(doc.splitTextToSize(f.familia, labelW - 8)[0], M, y + 8);
        doc.setFillColor(...C.muted);
        doc.roundedRect(M + labelW, y, barW, 9, 4.5, 4.5, "F");
        const pct = Math.max(0, Math.min(maxPct, f.pct ?? 0));
        const w = (pct / maxPct) * barW;
        if (w > 1) {
          doc.setFillColor(...(pct >= 90 ? C.success : pct >= 70 ? C.primary : C.compare));
          doc.roundedRect(M + labelW, y, w, 9, 4.5, 4.5, "F");
        }
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...C.mutedFg);
        doc.text(fmtPct(f.pct), M + labelW + barW + 8, y + 8);
        y += 16;
      }
      y += 4;
    }
    if (perf.criticas.length) {
      blocoCard(
        null,
        [
          {
            s: `Famílias mais pressionadas: ${perf.criticas.map(f => f.familia).join(", ")}.`,
            size: 9,
            style: "normal",
            color: C.mutedFg,
          },
        ],
        C.compare,
      );
    }
  }

  // ---------- Rodapé ----------
  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.7);
    doc.line(M, H - 32, PW - M, H - 32);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...C.mutedFg);
    doc.text(`PoolFlux · Visão Rep · ${repNome} · confidencial`, M, H - 20);
    doc.text(`Página ${i} de ${total}`, PW - M, H - 20, { align: "right" });
  }

  const slug = repNome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  doc.save(`visao-rep-2-${slug || "relatorio"}.pdf`);
}
