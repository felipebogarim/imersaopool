import { supabase } from "@/integrations/supabase/client";
import { fetchAllKanbanReps } from "@/lib/kanban-reps";
import { fetchProfilesMap } from "@/lib/kanban-profiles";
import { directorArea, metaText, type DirectorAction } from "@/lib/director-bi";
import type { KCard } from "@/lib/kanban-types";

type SourceAction = KCard & {
  kanban_boards: { name: string };
  kanban_lists: { name: string };
  kanban_checklists: { kanban_checklist_items: { done: boolean }[] }[];
};

export async function fetchDirectorBI() {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error("Entre novamente para consultar as ações.");
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("active_company_id")
    .eq("id", auth.user.id)
    .single();
  if (profileError) throw profileError;
  if (!profile.active_company_id) throw new Error("Selecione uma empresa para consultar as ações.");

  const source: SourceAction[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase
      .from("kanban_cards")
      .select(
        `*, kanban_boards!inner(name, archived_at, kanban_workspaces!inner(company_id, archived_at)),
        kanban_lists!inner(name, archived_at), kanban_checklists(kanban_checklist_items(done))`,
      )
      .contains("metadata", { show_in_director_bi: true })
      .is("archived_at", null)
      .is("kanban_boards.archived_at", null)
      .is("kanban_boards.kanban_workspaces.archived_at", null)
      // O Kanban permite workspaces sem empresa; o acesso continua sujeito ao RLS.
      .or(`company_id.eq.${profile.active_company_id},company_id.is.null`, {
        referencedTable: "kanban_boards.kanban_workspaces",
      })
      .is("kanban_lists.archived_at", null)
      .order("id")
      .range(offset, offset + 499);
    if (error) throw error;
    source.push(...(data as unknown as SourceAction[]));
    if (data.length < 500) break;
  }
  const [reps, profiles] = await Promise.all([
    fetchAllKanbanReps(),
    fetchProfilesMap(source.map((card) => metaText(card.metadata, "responsible_id"))),
  ]);
  const repNames = new Map(reps.map((rep) => [rep.id, rep.nome]));
  const actions: DirectorAction[] = source.map((card) => {
    const ownerId = metaText(card.metadata, "responsible_id");
    const items = card.kanban_checklists.flatMap((list) => list.kanban_checklist_items);
    return {
      ...card,
      area: directorArea(card.kanban_boards.name),
      stage: card.kanban_lists.name,
      responsible:
        profiles[ownerId]?.full_name ||
        repNames.get(ownerId) ||
        metaText(card.metadata, "responsible_name") ||
        "Não definido",
      representative:
        repNames.get(metaText(card.metadata, "rep_id")) || metaText(card.metadata, "rep_name"),
      checklistDone: items.filter((item) => item.done).length,
      checklistTotal: items.length,
    };
  });
  return { actions, reps };
}

export async function setDirectorBIVisibility(cardId: string, visible: boolean) {
  // Releitura + controle de concorrência preservam alterações nos demais metadados.
  const { data: current, error: readError } = await supabase
    .from("kanban_cards")
    .select("metadata, updated_at, kanban_boards(name)")
    .eq("id", cardId)
    .single();
  if (readError) throw readError;
  if (visible && !directorArea(current.kanban_boards?.name ?? "")) {
    throw new Error(
      "A ação deve pertencer a um quadro Comercial, Governança, Marketing ou Produto.",
    );
  }
  const metadata = {
    ...(current.metadata as Record<string, unknown>),
    show_in_director_bi: visible,
  };
  const { data, error } = await supabase
    .from("kanban_cards")
    .update({ metadata })
    .eq("id", cardId)
    .eq("updated_at", current.updated_at)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data)
    throw new Error(
      "A ação foi alterada ou você não tem permissão para editá-la. Atualize e tente novamente.",
    );
}
