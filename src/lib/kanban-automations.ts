import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "./kanban-activity";
import { sendKanbanAutomationEmail } from "./kanban-notify.functions";

type TriggerKind =
  | "card_moved_to_list"
  | "card_created"
  | "due_date_approaching"
  | "checklist_completed";

interface RunOpts {
  /** list the card is now in (used by card_moved_to_list / card_created filters) */
  listId?: string;
  cardTitle?: string;
  boardName?: string;
}

/**
 * Client-side execution of board automations for a given trigger.
 */
export async function runAutomations(
  boardId: string,
  cardId: string,
  trigger: TriggerKind,
  opts: RunOpts = {},
) {
  const { data: automations } = await supabase
    .from("kanban_automations")
    .select("*")
    .eq("board_id", boardId)
    .eq("enabled", true)
    .eq("trigger", trigger);
  if (!automations || automations.length === 0) return;

  let cardTitle = opts.cardTitle;
  if (!cardTitle) {
    const { data: c } = await supabase.from("kanban_cards").select("title").eq("id", cardId).maybeSingle();
    cardTitle = c?.title ?? "";
  }

  for (const a of automations) {
    const cfg = (a.trigger_config ?? {}) as any;
    if (cfg.list_id && opts.listId && cfg.list_id !== opts.listId) continue;

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
    } else if (action === "send_notification" && (acfg.user_id || acfg.email)) {
      if (acfg.user_id) {
        await (supabase as any).rpc("kanban_notify", {
          _user_id: acfg.user_id,
          _board_id: boardId,
          _card_id: cardId,
          _type: "automation",
          _title: a.name,
          _body: acfg.message ?? "Automação disparada",
        });
      }
      // e-mail notification (best effort)
      await sendKanbanAutomationEmail({
        data: {
          userId: acfg.user_id ?? null,
          email: acfg.email ?? null,
          automationName: a.name,
          cardTitle: cardTitle ?? "",
          boardName: opts.boardName ?? null,
          boardId,
          message: acfg.message ?? null,
        },
      }).catch((e) => console.error("[kanban] automation email failed", e));
    }
    await logActivity(boardId, "automation_run", { automation_id: a.id, name: a.name }, cardId);
  }
}

export async function runAutomationsForMove(boardId: string, cardId: string, newListId: string) {
  return runAutomations(boardId, cardId, "card_moved_to_list", { listId: newListId });
}

export async function runAutomationsForCreate(
  boardId: string,
  cardId: string,
  listId: string,
  cardTitle: string,
) {
  return runAutomations(boardId, cardId, "card_created", { listId, cardTitle });
}
