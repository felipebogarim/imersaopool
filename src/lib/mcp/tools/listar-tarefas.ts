import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "listar_tarefas",
  title: "Listar tarefas de um quadro",
  description: "Lista as tarefas (cards) ativas de um quadro de Gestão de Tarefas.",
  inputSchema: {
    quadro_id: z.string().uuid().describe("ID do quadro (use listar_quadros_tarefas)."),
    limite: z.number().int().min(1).max(200).optional().describe("Máximo de tarefas (padrão 50)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ quadro_id, limite }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("kanban_cards")
      .select("id, title, description, priority, due_date, completed_at, list_id, updated_at")
      .eq("board_id", quadro_id)
      .is("archived_at", null)
      .order("position")
      .limit(limite ?? 50);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { tarefas: data ?? [] },
    };
  },
});
