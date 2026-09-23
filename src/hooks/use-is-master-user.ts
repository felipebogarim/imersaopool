import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MASTER_EMAIL } from "@/lib/nav-tree";

/** Mesma comparação já usada em AppShell.tsx, só que reutilizável fora dele. */
export function useIsMasterUser(): boolean {
  const { data } = useQuery({
    queryKey: ["is-master-user"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      return (u.user?.email ?? "").toLowerCase() === MASTER_EMAIL;
    },
    staleTime: 60_000,
  });
  return !!data;
}
