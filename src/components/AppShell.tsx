import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { BarChart3, Users, Briefcase, Tag, UserCog, LogOut, FileSearch, TrendingUp, Building2, MessageSquare, Repeat, Shield, ShieldCheck, Database, Package, ChevronDown, ChevronRight, Inbox, BookOpen, Lightbulb, Sparkles } from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BrandMark } from "@/components/Brand";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV = [
  { to: "/dashboard", label: "BI", icon: BarChart3 },
] as const;

const INPUTS = [
  { to: "/imersoes", label: "Imersões em Campo", icon: FileSearch },
  { to: "/entrevistas", label: "Entrevistas", icon: MessageSquare },
  { to: "/roteiros", label: "Roteiros", icon: BookOpen },
  { to: "/perspectivas", label: "Perspectivas", icon: Lightbulb },
  { to: "/compilacoes", label: "Compilações IA", icon: Sparkles },
] as const;

const NAV_BOTTOM = [
  { to: "/price", label: "Price", icon: Tag },
  { to: "/representantes", label: "Representantes", icon: Users },
  { to: "/agentes", label: "Agentes", icon: UserCog },
  { to: "/projecao", label: "Projeção Categoria / Benefício", icon: TrendingUp },
  { to: "/novo-corp", label: "Novo Corp", icon: Building2 },
] as const;

const BASES = [
  { to: "/clientes", label: "Clientes", icon: Briefcase },
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/familias", label: "Famílias", icon: Package },
] as const;

// Label span: hidden when sidebar is collapsed, shown on hover.
const LBL = "hidden group-hover/sidebar:inline whitespace-nowrap";
// Chevron / secondary UI: only when expanded.
const ONLY_EXPANDED = "hidden group-hover/sidebar:flex";

function NavItem({ to, label, Icon, active }: { to: string; label: string; Icon: typeof BarChart3; active: boolean }) {
  return (
    <Link
      to={to}
      title={label}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary"
          : "text-sidebar-foreground hover:bg-sidebar-accent/50"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className={LBL}>{label}</span>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: s => s.location.pathname });
  const [basesOpen, setBasesOpen] = useState(() => BASES.some(b => pathname.startsWith(b.to)));
  const [inputsOpen, setInputsOpen] = useState(() => INPUTS.some(b => pathname.startsWith(b.to)));

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
      {/* Spacer to reserve the collapsed rail width in layout */}
      <div className="w-16 shrink-0" aria-hidden />
      <aside
        className="group/sidebar fixed inset-y-0 left-0 z-40 w-16 hover:w-60 border-r border-sidebar-border bg-sidebar flex flex-col overflow-hidden transition-[width] duration-200 ease-out"
      >
        <div className="p-3 border-b border-sidebar-border flex items-center gap-3 h-[73px]">
          <BrandMark className="h-8 shrink-0" />
          <p className={cn("text-[10px] uppercase tracking-widest text-muted-foreground", LBL)}>Imersões Comerciais</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto overflow-x-hidden">
          {NAV.map(item => (
            <NavItem key={item.to} to={item.to} label={item.label} Icon={item.icon} active={pathname === item.to || pathname.startsWith(item.to + "/")} />
          ))}

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setInputsOpen(o => !o)}
              title="Inputs"
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition"
            >
              <Inbox className="h-4 w-4 shrink-0" />
              <span className={cn("flex-1 text-left", LBL)}>Inputs</span>
              {inputsOpen ? <ChevronDown className={cn("h-3.5 w-3.5", ONLY_EXPANDED)} /> : <ChevronRight className={cn("h-3.5 w-3.5", ONLY_EXPANDED)} />}
            </button>
            {inputsOpen && (
              <div className="mt-1 ml-3 pl-3 border-l border-sidebar-border space-y-1">
                {INPUTS.map(item => (
                  <NavItem key={item.to} to={item.to} label={item.label} Icon={item.icon} active={pathname === item.to || pathname.startsWith(item.to + "/")} />
                ))}
              </div>
            )}
          </div>

          {NAV_BOTTOM.map(item => (
            <NavItem key={item.to} to={item.to} label={item.label} Icon={item.icon} active={pathname === item.to || pathname.startsWith(item.to + "/")} />
          ))}

          <div className="pt-2">
            <button
              type="button"
              onClick={() => setBasesOpen(o => !o)}
              title="Bases"
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition"
            >
              <Database className="h-4 w-4 shrink-0" />
              <span className={cn("flex-1 text-left", LBL)}>Bases</span>
              {basesOpen ? <ChevronDown className={cn("h-3.5 w-3.5", ONLY_EXPANDED)} /> : <ChevronRight className={cn("h-3.5 w-3.5", ONLY_EXPANDED)} />}
            </button>
            {basesOpen && (
              <div className="mt-1 ml-3 pl-3 border-l border-sidebar-border space-y-1">
                {BASES.map(item => (
                  <NavItem key={item.to} to={item.to} label={item.label} Icon={item.icon} active={pathname === item.to || pathname.startsWith(item.to + "/")} />
                ))}
              </div>
            )}
          </div>

          {workspace?.isAdmin && (
            <div className="pt-4">
              <div className={cn("px-3 pb-2 items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground", ONLY_EXPANDED)}>
                <Shield className="h-3 w-3" /> Admin
              </div>
              {[
                { to: "/admin/usuarios", label: "Usuários", icon: UserCog },
                { to: "/admin/permissoes", label: "Permissões", icon: ShieldCheck },
              ].map(item => (
                <NavItem key={item.to} to={item.to} label={item.label} Icon={item.icon} active={pathname === item.to || pathname.startsWith(item.to + "/")} />
              ))}
            </div>
          )}
        </nav>
        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className={cn("px-2 py-1.5 rounded-md bg-sidebar-accent/30", "hidden group-hover/sidebar:block")}>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Empresa ativa</p>
            <p className="text-sm font-semibold truncate">{workspace?.companyName ?? "—"}</p>
          </div>
          {workspace?.isAdmin && (
            <Button asChild variant="outline" size="sm" className="w-full justify-start px-2" title="Trocar empresa">
              <Link to="/empresas">
                <Repeat className="h-4 w-4 shrink-0" />
                <span className={cn("ml-2", LBL)}>Trocar empresa</span>
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start px-2 text-muted-foreground" title="Sair">
            <LogOut className="h-4 w-4 shrink-0" />
            <span className={cn("ml-2", LBL)}>Sair</span>
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
