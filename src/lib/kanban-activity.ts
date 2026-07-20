import { supabase } from "@/integrations/supabase/client";

export async function logActivity(
  boardId: string,
  type: string,
  payload: Record<string, unknown>,
  cardId?: string,
) {
  const { data: u } = await supabase.auth.getUser();
  await supabase.from("kanban_activities").insert({
    board_id: boardId,
    card_id: cardId ?? null,
    user_id: u.user?.id ?? null,
    type: type as any,
    payload,
  });
}
