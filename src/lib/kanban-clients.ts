import { supabase } from "@/integrations/supabase/client";

export type KanbanClientRow = {
  id: string;
  nome_fantasia: string | null;
  razao_social: string | null;
};

/** Busca TODOS os clientes paginando (o backend limita 1000 por requisição). */
export async function fetchAllKanbanClients(): Promise<KanbanClientRow[]> {
  const pageSize = 1000;
  const all: KanbanClientRow[] = [];
  for (let page = 0; page < 50; page++) {
    const from = page * pageSize;
    const { data, error } = await supabase
      .from("clients")
      .select("id, nome_fantasia, razao_social")
      .order("razao_social", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const rows = (data ?? []) as KanbanClientRow[];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}
