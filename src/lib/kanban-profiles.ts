import { supabase } from "@/integrations/supabase/client";

/**
 * As FKs de user_id nas tabelas do Kanban apontam para auth.users (não para profiles),
 * então o embed do PostgREST falha. Buscamos os perfis separadamente.
 */
export async function fetchProfilesMap(userIds: (string | null | undefined)[]) {
  const ids = [...new Set(userIds.filter(Boolean) as string[])];
  if (!ids.length) return {} as Record<string, { id: string; full_name: string | null; email: string | null }>;
  const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
  return Object.fromEntries((data ?? []).map((p: any) => [p.id, p])) as Record<
    string,
    { id: string; full_name: string | null; email: string | null }
  >;
}
