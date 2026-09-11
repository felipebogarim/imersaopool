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
      // base: permissões do(s) perfil(is)
      const base = new Set<string>();
      const isAdmin = roles.includes("admin");
      if (isAdmin) {
        ALL_NAV_KEYS.forEach((key) => base.add(key));
      } else if (roles.length) {
        const { data: perms } = await supabase
          .from("role_permissions")
          .select("role, nav_key, allowed")
          .in("role", roles as any);
        for (const p of (perms ?? []) as any[]) {
          if (p.allowed) base.add(p.nav_key as string);
        }
      }

      // 'home' deve estar sempre liberada por padrão
      base.add("home");
      // override individual do usuário (libera ou bloqueia por pessoa)
      const { data: userPerms } = await supabase
        .from("user_nav_permissions")
        .select("nav_key, allowed")
        .eq("user_id", uid);
      for (const p of (userPerms ?? []) as any[]) {
        if (p.allowed) base.add(p.nav_key as string);
        else base.delete(p.nav_key as string);
      }

      // Agenda é uma ferramenta pessoal disponível a todos os usuários autenticados.
      base.add("ferramentas");
      base.add("ferramentas.agenda");

      return { isAdmin, keys: Array.from(base) };
    },
  });

  const allowed = new Set(data?.keys ?? []);
  const isAdmin = data?.isAdmin ?? false;
  return {
    isAdmin,
    allowed,
    loading: isLoading,
    can: (key: string) => allowed.has(key),
  };
}
