import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { BarChart3, Users, Briefcase, Tag, UserCog, LogOut, FileSearch, TrendingUp, Building2, MessageSquare, Repeat } from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BrandLogo } from "@/components/Brand";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", label: "BI", icon: BarChart3 },
  { to: "/imersoes", label: "Imersões", icon: FileSearch },
  { to: "/entrevistas", label: "Entrevistas", icon: MessageSquare },
  { to: "/price", label: "Price", icon: Tag },
  { to: "/clientes", label: "Clientes", icon: Briefcase },
  { to: "/representantes", label: "Representantes", icon: Users },
  { to: "/agentes", label: "Agentes", icon: UserCog },
  { to: "/projecao", label: "Projeção Categoria / Benefício", icon: TrendingUp },
  { to: "/novo-corp", label: "Novo Corp", icon: Building2 },
] as const;


export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: s => s.location.pathname });

  const { data: workspace } = useQuery({
    queryKey: ["workspace-header"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return null;
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("active_company_id").eq("id", uid).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", uid),
      ]);
      const isAdmin = (roles ?? []).some(r => r.role === "admin");
      let companyName: string | null = null;
      if (profile?.active_company_id) {
        const { data: c } = await supabase.from("companies").select("nome").eq("id", profile.active_company_id).maybeSingle();
        companyName = c?.nome ?? null;
      }
      return { isAdmin, companyName };
    },
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 border-r border-sidebar-border bg-sidebar flex flex-col">
        <div className="p-5 border-b border-sidebar-border">
          <BrandLogo />
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-2">Imersões Comerciais</p>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(item => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className="px-2 py-1.5 rounded-md bg-sidebar-accent/30">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Empresa ativa</p>
            <p className="text-sm font-semibold truncate">{workspace?.companyName ?? "—"}</p>
          </div>
          {workspace?.isAdmin && (
            <Button asChild variant="outline" size="sm" className="w-full justify-start">
              <Link to="/empresas"><Repeat className="h-4 w-4 mr-2" /> Trocar empresa</Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start text-muted-foreground">
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-x-hidden">{children}</main>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="border-b border-border px-8 py-6 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}
