import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "listar_quadros_tarefas",
  title: "Listar quadros de tarefas",
  description: "Lista os quadros de Gestão de Tarefas (Kanban) acessíveis ao usuário autenticado.",
  inputSchema: {
    limite: z.number().int().min(1).max(100).optional().describe("Máximo de quadros (padrão 30)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limite }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("kanban_boards")
      .select("id, name, description, visibility, updated_at")
      .is("archived_at", null)
      .order("position")
      .limit(limite ?? 30);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { quadros: data ?? [] },
    };
  },
});
