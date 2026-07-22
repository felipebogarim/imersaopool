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

    // Aceite dos Termos de Uso (versão vigente) — bloqueia app até aceitar
    const ALLOWED_WITHOUT_TERMS = new Set(["/aceite-termos", "/termos-de-uso", "/nda"]);
    if (!ALLOWED_WITHOUT_TERMS.has(path)) {
      const { data: st } = await supabase.rpc("get_my_terms_status");
      const row = Array.isArray(st) ? st[0] : st;
      if (row && row.status !== "aceito") {
        throw redirect({ to: "/aceite-termos" });
      }
    }

    if (!p?.nda_accepted_at && path !== "/nda" && !ALLOWED_WITHOUT_TERMS.has(path)) {
      throw redirect({ to: "/nda" });
    }
    if (p?.nda_accepted_at && !p?.active_company_id && path !== "/empresas" && !ALLOWED_WITHOUT_TERMS.has(path)) {
      throw redirect({ to: "/empresas" });
    }

    // MFA obrigatório para admins após o prazo de adaptação
    if (roleList.includes("admin")) {
      const ALLOWED_WITHOUT_MFA = new Set([
        "/admin/mfa",
        ...Array.from(ALLOWED_WITHOUT_TERMS),
      ]);
      if (!ALLOWED_WITHOUT_MFA.has(path)) {
        const { data: mfaSt } = await supabase.rpc("get_admin_mfa_status");
        const mfaRow: any = Array.isArray(mfaSt) ? mfaSt[0] : mfaSt;
        if (mfaRow?.must_enroll_now) {
          throw redirect({ to: "/admin/mfa" });
        }
      }
    }

    return { user: data.user };
  },

  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
