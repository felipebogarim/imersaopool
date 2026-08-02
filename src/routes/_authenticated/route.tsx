import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { getAuthGate } from "@/lib/auth-gate";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    // getSession() lê o token local (sem round-trip) — muito mais rápido por navegação
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) throw redirect({ to: "/auth" });

    const gate = await getAuthGate(user.id);
    const roleList = gate.roles;
    const isComercialOnly =
      roleList.length > 0 && roleList.every((r: string) => r === "comercial");

    const path = location.pathname;
    if (isComercialOnly) {
      if (path !== "/admin/gerador-performance") {
        throw redirect({ to: "/admin/gerador-performance" });
      }
      return { user };
    }

    // As páginas de aceite são etapas, não destinos permanentes. Se uma etapa
    // já estiver concluída, avance usando o estado atual do banco. Isso também
    // recupera automaticamente uma navegação interrompida após clicar em aceitar.
    if (path === "/aceite-termos" && gate.termsOk) {
      if (!gate.ndaAcceptedAt) throw redirect({ to: "/nda", replace: true });
      if (!gate.activeCompanyId) throw redirect({ to: "/empresas", replace: true });
      if (roleList.includes("admin") && gate.mustEnrollMfa) {
        throw redirect({ to: "/admin/mfa", replace: true });
      }
      throw redirect({ to: "/dashboard", replace: true });
    }

    if (path === "/nda" && gate.ndaAcceptedAt) {
      if (!gate.termsOk) throw redirect({ to: "/aceite-termos", replace: true });
      if (!gate.activeCompanyId) throw redirect({ to: "/empresas", replace: true });
      if (roleList.includes("admin") && gate.mustEnrollMfa) {
        throw redirect({ to: "/admin/mfa", replace: true });
      }
      throw redirect({ to: "/dashboard", replace: true });
    }

    // Aceite dos Termos de Uso (versão vigente) — bloqueia app até aceitar
    const ALLOWED_WITHOUT_TERMS = new Set(["/aceite-termos", "/termos-de-uso", "/nda"]);
    if (!ALLOWED_WITHOUT_TERMS.has(path) && !gate.termsOk) {
      throw redirect({ to: "/aceite-termos" });
    }

    if (!gate.ndaAcceptedAt && path !== "/nda" && !ALLOWED_WITHOUT_TERMS.has(path)) {
      throw redirect({ to: "/nda" });
    }
    if (gate.ndaAcceptedAt && !gate.activeCompanyId && path !== "/empresas" && !ALLOWED_WITHOUT_TERMS.has(path)) {
      throw redirect({ to: "/empresas" });
    }

    // MFA obrigatório para admins após o prazo de adaptação
    if (roleList.includes("admin")) {
      const ALLOWED_WITHOUT_MFA = new Set([
        "/admin/mfa",
        ...Array.from(ALLOWED_WITHOUT_TERMS),
      ]);
      if (!ALLOWED_WITHOUT_MFA.has(path) && gate.mustEnrollMfa) {
        throw redirect({ to: "/admin/mfa" });
      }
    }

    return { user };
  },


  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
});
