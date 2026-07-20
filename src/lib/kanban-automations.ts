import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "./kanban-activity";

/**
 * Client-side execution of automations when a card is moved.
 * Simplified: runs enabled automations with trigger=card_moved_to_list matching new list.
 */
export async function runAutomationsForMove(boardId: string, cardId: string, newListId: string) {
  const { data: automations } = await supabase
    .from("kanban_automations")
    .select("*")
    .eq("board_id", boardId)
    .eq("enabled", true)
    .eq("trigger", "card_moved_to_list");
  if (!automations || automations.length === 0) return;

  for (const a of automations) {
    const cfg = (a.trigger_config ?? {}) as any;
    if (cfg.list_id && cfg.list_id !== newListId) continue;

    const action = a.action;
    const acfg = (a.action_config ?? {}) as any;

    if (action === "move_to_list" && acfg.list_id) {
      await supabase.from("kanban_cards").update({ list_id: acfg.list_id }).eq("id", cardId);
    } else if (action === "assign_member" && acfg.user_id) {
      await supabase.from("kanban_card_members").upsert({ card_id: cardId, user_id: acfg.user_id });
    } else if (action === "add_label" && acfg.label_id) {
      await supabase.from("kanban_card_labels").upsert({ card_id: cardId, label_id: acfg.label_id });
    } else if (action === "archive_card") {
      await supabase.from("kanban_cards").update({ archived_at: new Date().toISOString() }).eq("id", cardId);
    } else if (action === "send_notification" && acfg.user_id) {
      await supabase.from("kanban_notifications").insert({
        user_id: acfg.user_id, card_id: cardId, board_id: boardId,
        type: "automation", title: a.name, body: acfg.message ?? "Automação disparada",
      });
    }
    await logActivity(boardId, "automation_run", { automation_id: a.id, name: a.name }, cardId);
  }
}
