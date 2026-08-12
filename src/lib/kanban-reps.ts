import { supabase } from "@/integrations/supabase/client";

export type KanbanRepRow = {
  id: string;
  nome: string | null;
  regiao: string | null;
};

/** Lista de representantes para vínculo em cards da Gestão de Tarefas. */
export async function fetchAllKanbanReps(): Promise<KanbanRepRow[]> {
  const { data, error } = await supabase
    .from("representatives")
    .select("id, nome, regiao")
    .order("nome", { ascending: true });
  if (error) throw error;
  return (data ?? []) as KanbanRepRow[];
}
