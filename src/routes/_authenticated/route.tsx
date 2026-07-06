import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    if (location.pathname !== "/empresas") {
      const { data: p } = await supabase
        .from("profiles")
        .select("active_company_id")
        .eq("id", data.user.id)
        .maybeSingle();
      if (!p?.active_company_id) throw redirect({ to: "/empresas" });
    }
    return { user: data.user };
  },
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
