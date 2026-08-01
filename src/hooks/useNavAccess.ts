import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ALL_NAV_KEYS } from "@/lib/nav-tree";

export type NavAccess = {
  isAdmin: boolean;
  allowed: Set<string>;
  can: (key: string) => boolean;
  loading: boolean;
};

export function useNavAccess(): NavAccess {
  const { data, isLoading } = useQuery({
    queryKey: ["nav-access"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return { isAdmin: false, keys: [] as string[] };
      const { data: roleRows } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      const roles = (roleRows ?? []).map((r: any) => r.role as string);
      if (roles.includes("admin")) return { isAdmin: true, keys: ALL_NAV_KEYS };
      if (roles.length === 0) return { isAdmin: false, keys: [] as string[] };
      const { data: perms } = await supabase
        .from("role_permissions")
        .select("role, nav_key, allowed")
        .in("role", roles as any);
      const keys = (perms ?? []).filter((p: any) => p.allowed).map((p: any) => p.nav_key as string);
      return { isAdmin: false, keys: Array.from(new Set(keys)) };
    },
  });

  const allowed = new Set(data?.keys ?? []);
  const isAdmin = data?.isAdmin ?? false;
  return {
    isAdmin,
    allowed,
    loading: isLoading,
    can: (key: string) => isAdmin || allowed.has(key),
  };
}
