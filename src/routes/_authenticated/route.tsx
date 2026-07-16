import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    const [{ data: p }, { data: roles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("active_company_id, nda_accepted_at")
        .eq("id", data.user.id)
        .maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", data.user.id),
    ]);

    const roleList = (roles ?? []).map((r: any) => r.role);
    const isComercialOnly = roleList.length > 0 && roleList.every((r: string) => r === "comercial");

    const path = location.pathname;
    if (isComercialOnly) {
      if (path !== "/admin/gerador-performance") {
        throw redirect({ to: "/admin/gerador-performance" });
      }
      return { user: data.user };
    }

    if (!p?.nda_accepted_at && path !== "/nda") {
      throw redirect({ to: "/nda" });
    }
    if (p?.nda_accepted_at && !p?.active_company_id && path !== "/empresas" && path !== "/nda") {
      throw redirect({ to: "/empresas" });
    }
    return { user: data.user };
  },

  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
