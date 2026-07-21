import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useIsMasterAdmin() {
  const { data } = useQuery({
    queryKey: ["is-master-admin"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id);
      return (roles ?? []).some((r: any) => r.role === "admin");
    },
    staleTime: 60_000,
  });
  return !!data;
}
