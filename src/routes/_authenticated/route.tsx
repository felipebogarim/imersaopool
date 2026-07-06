import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    const { data: p } = await supabase
      .from("profiles")
      .select("active_company_id, nda_accepted_at")
      .eq("id", data.user.id)
      .maybeSingle();

    const path = location.pathname;
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
