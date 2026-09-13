import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "performance_representante",
  title: "Performance do representante",
  description:
    "Retorna o resumo da performance ativa de um representante (período, atingimento geral e famílias).",
  inputSchema: {
    representante_id: z.string().uuid().describe("ID do representante (use listar_representantes)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ representante_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("rep_performance_uploads")
      .select(
        "id, periodo_label, periodo_inicio, periodo_fim, atingimento_geral, familias, calculation_version, created_at",
      )
      .eq("representative_id", representante_id)
      .is("substituida_em", null)
      .order("created_at", { ascending: false })
      .limit(5);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data?.length) {
      return { content: [{ type: "text", text: "Nenhuma performance ativa para este representante." }] };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { performances: data },
    };
  },
});
