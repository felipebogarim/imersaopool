import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "buscar_clientes",
  title: "Buscar clientes",
  description: "Busca clientes por nome fantasia ou razão social, retornando dados cadastrais básicos.",
  inputSchema: {
    busca: z.string().trim().min(2).describe("Parte do nome fantasia ou da razão social."),
    limite: z.number().int().min(1).max(100).optional().describe("Máximo de registros (padrão 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ busca, limite }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("clients")
      .select("id, nome_fantasia, razao_social, cidade, uf, status, categoria, grupo_nome")
      .or(`nome_fantasia.ilike.%${busca}%,razao_social.ilike.%${busca}%`)
      .order("nome_fantasia")
      .limit(limite ?? 20);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { clientes: data ?? [] },
    };
  },
});
