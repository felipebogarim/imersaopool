/**
 * Converte qualquer relatório Visão Rep 2 (importado ou gerado) no mesmo
 * modelo de briefing executivo usado na tela. É o que garante que todos os
 * representantes sejam exibidos com a estrutura e a ordem padrão.
 */

import type { BriefingExecutivo } from "@/components/visao-rep2/briefing-fabio";
import type { VisaoRep2 } from "@/lib/visao-rep2-schema";

const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** Briefing derivado do próprio relatório — nada é inventado, campos vazios somem. */
export function buildBriefingFromVisao(visao: VisaoRep2): BriefingExecutivo {
  const ev = visao.executive_view;
  const ctx = visao.representative_context;

  return {
    contexto: {
      marcas: ctx.represented_brands ?? [],
      regiaoModelo:
        [txt(ctx.region_summary), txt(ctx.service_model), txt(ctx.regional_structure), txt(ctx.additional_context)]
          .filter(Boolean)
          .join(" ") || "",
    },
    clientes: (visao.strategic_clients ?? []).map((c, i) => ({
      nome: txt(c.client_name) ?? `Cliente ${i + 1}`,
      motivo:
        [txt(c.strategic_reason), txt(c.identified_opportunity), txt(c.recommended_next_action)]
          .filter(Boolean)
          .join(" ") || "",
    })),
    sintese: txt(ev.final_synthesis) ?? txt(ev.central_thesis) ?? "",
    temas: [],
    conclusoes: (ev.priority_signals ?? [])
      .map((s, i) => ({
        titulo: txt(s.title) ?? `Sinal ${i + 1}`,
        frase: txt(s.finding) ?? txt(s.business_impact) ?? "",
      }))
      .filter(c => !!c.frase),
    perspectivas: [],
    decisoes: (ev.decisions_required ?? []).map(t => ({ texto: t, status: "A decidir" as const })),
    validacoes: (ev.validation_required ?? []).map(t => ({ texto: t, status: "A validar" as const })),
  };
}

/**
 * Modelo padrão único: SEMPRE derivado exclusivamente do relatório selecionado.
 * Nunca usa briefing curado, cache ou conteúdo de outro representante.
 */
export function briefingPadrao(visao: VisaoRep2): BriefingExecutivo {
  return buildBriefingFromVisao(visao);
}
