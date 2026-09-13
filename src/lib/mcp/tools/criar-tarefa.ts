import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "criar_tarefa",
  title: "Criar tarefa",
  description:
    "Cria uma tarefa (card) em um quadro de Gestão de Tarefas. Sem lista informada, usa a primeira lista do quadro.",
  inputSchema: {
    quadro_id: z.string().uuid().describe("ID do quadro (use listar_quadros_tarefas)."),
    titulo: z.string().trim().min(1).max(200).describe("Título da tarefa."),
    descricao: z.string().trim().max(4000).optional().describe("Detalhes da tarefa."),
    prioridade: z.enum(["low", "medium", "high", "urgent"]).optional().describe("Prioridade da tarefa."),
    prazo: z.string().trim().optional().describe("Data limite no formato ISO (AAAA-MM-DD)."),
    lista_id: z.string().uuid().optional().describe("ID da lista/coluna de destino."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ quadro_id, titulo, descricao, prioridade, prazo, lista_id }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);

    let listId = lista_id;
    if (!listId) {
      const { data: lists, error: listError } = await supabase
        .from("kanban_lists")
        .select("id")
        .eq("board_id", quadro_id)
        .is("archived_at", null)
        .order("position")
        .limit(1);
      if (listError) return { content: [{ type: "text", text: listError.message }], isError: true };
      listId = lists?.[0]?.id;
    }
    if (!listId) {
      return { content: [{ type: "text", text: "Este quadro não possui listas disponíveis." }], isError: true };
    }

    const { data, error } = await supabase
      .from("kanban_cards")
      .insert({
        board_id: quadro_id,
        list_id: listId,
        created_by: ctx.getUserId()!,
        title: titulo,
        description: descricao ?? null,
        due_date: prazo ?? null,
        ...(prioridade ? { priority: prioridade } : {}),
      })
      .select("id, title, list_id, priority, due_date")
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data) }],
      structuredContent: { tarefa: data },
    };
  },
});
