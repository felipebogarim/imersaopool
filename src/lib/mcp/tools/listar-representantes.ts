import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "listar_representantes",
  title: "Listar representantes",
  description: "Lista os representantes visíveis para o usuário autenticado, com busca opcional por nome.",
  inputSchema: {
    busca: z.string().trim().optional().describe("Texto para filtrar pelo nome do representante."),
    limite: z.number().int().min(1).max(200).optional().describe("Máximo de registros (padrão 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ busca, limite }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("representatives")
      .select("id, nome, regiao, email, telefone")
      .order("nome")
      .limit(limite ?? 50);
    if (busca) query = query.ilike("nome", `%${busca}%`);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { representantes: data ?? [] },
    };
  },
});
