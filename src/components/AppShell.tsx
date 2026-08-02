import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { BarChart3, Users, Briefcase, Tag, UserCog, LogOut, FileSearch, TrendingUp, Building2, MessageSquare, Repeat, Shield, ShieldCheck, Database, Package, ChevronDown, ChevronRight, Inbox, BookOpen, Lightbulb, Sparkles, ListChecks, HardDriveDownload, FileText, ScrollText, KeyRound, LineChart, Wrench, Menu, X, Lock, User } from "lucide-react";
import { useState, useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BrandMark } from "@/components/Brand";
import newlineLogo from "@/assets/newline-logo.png.asset.json";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfidentialityModal } from "@/components/ConfidentialityModal";
import { ForcePasswordChange } from "@/components/ForcePasswordChange";
import { Watermark } from "@/components/Watermark";
import { AdminMfaBanner } from "@/components/mfa/AdminMfaBanner";
import { SensitiveAdminGate } from "@/components/mfa/SensitiveAdminGate";
import { NAV_TREE, navKeyForPath, type NavGroup } from "@/lib/nav-tree";
import { useNavAccess } from "@/hooks/useNavAccess";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ICONS: Record<string, typeof BarChart3> = {
  bi: BarChart3,
  inputs: Inbox,
  "inputs.imersoes": FileSearch,
  "inputs.fontes": Lightbulb,
  "inputs.entrevistas": MessageSquare,
  "inputs.forms": FileText,
  analises: LineChart,
  "analises.sintese-tipos": LineChart,
  "analises.visao-rep": Users,
  "analises.visao-rep-2": Users,
  "analises.perspectivas": Lightbulb,
  "analises.compilacoes": Sparkles,
  price: Tag,
  "price.competidores": Users,
  "price.tabelas": FileText,
  "price.comparativos": BarChart3,
  representantes: Users,
  "representantes.lista": Users,
  "representantes.performance": TrendingUp,
  clientes: Briefcase,
  "clientes.lista": Briefcase,
  "clientes.projecao": TrendingUp,
  "clientes.novo-corp": Building2,
  bases: Database,
  "bases.produtos": Package,
  "bases.familias": Package,
  "bases.roteiros": BookOpen,
  ferramentas: Wrench,
  "ferramentas.gerador-performance": Sparkles,
  "ferramentas.tarefas": ListChecks,
  admin: Shield,
  "admin.usuarios": UserCog,
  "admin.agentes": UserCog,
  "admin.permissoes": ShieldCheck,
  "admin.conformidade": FileText,
  "admin.mfa": KeyRound,
  "admin.mfa-politica": Shield,
  "admin.mfa-recuperacao": KeyRound,
  "admin.auditoria-seguranca": Shield,
  "admin.lgpd": ShieldCheck,
  "admin.criterios-seguranca": ShieldCheck,
  "admin.backup": HardDriveDownload,
};

// Label span: hidden when sidebar is collapsed on desktop; shown on hover or when mobile drawer is open.
const LBL = "hidden group-hover/sidebar:inline group-data-[mobile-open=true]/sidebar:inline whitespace-nowrap";
// Chevron / secondary UI: only when expanded (hover or mobile-open).
const ONLY_EXPANDED = "hidden group-hover/sidebar:flex group-data-[mobile-open=true]/sidebar:flex";

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

function NavGroupBlock({
  group,
  pathname,
  visibleChildren,
}: {
  group: NavGroup;
  pathname: string;
  visibleChildren: NavGroup["children"];
}) {
  const Icon = ICONS[group.key] ?? Database;
  const [open, setOpen] = useState(() => visibleChildren.some(c => pathname === c.to || pathname.startsWith(c.to + "/")));
  return (
    <div className="pt-2">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        title={group.label}
        className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition"
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className={cn("flex-1 text-left", LBL)}>{group.label}</span>
        {open ? <ChevronDown className={cn("h-3.5 w-3.5", ONLY_EXPANDED)} /> : <ChevronRight className={cn("h-3.5 w-3.5", ONLY_EXPANDED)} />}
      </button>
      {open && (
        <div className="mt-1 ml-3 pl-3 border-l border-sidebar-border space-y-1">
          {visibleChildren.map(item => (
            <NavItem
              key={item.key}
              to={item.to}
              label={item.label}
              Icon={ICONS[item.key] ?? Database}
              active={pathname === item.to || (item.to !== "/representantes" && item.to !== "/clientes" && pathname.startsWith(item.to + "/"))}
            />
          ))}
          {group.key === "ferramentas" && (
            <button
              type="button"
              onClick={() => toast.info("Tabela de Preços", { description: "Área em construção." })}
              title="Tabela de Preços"
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition text-left"
            >
              <Tag className="h-4 w-4 shrink-0" />
              <span className={LBL}>Tabela de Preços</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3 px-6 text-center">
      <Lock className="h-10 w-10 text-muted-foreground" />
      <h2 className="text-xl font-semibold">Acesso não liberado</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Seu perfil não tem permissão para esta seção. Solicite liberação ao administrador em
        <strong> Admin → Permissões</strong>.
      </p>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: s => s.location.pathname });
  const isAccessGatePage = pathname === "/nda" || pathname === "/aceite-termos";
  const [mobileOpen, setMobileOpen] = useState(false);
  const access = useNavAccess();
  // Close mobile drawer on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

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
      const roleList = (roles ?? []).map((r: any) => r.role);
      const isAdmin = roleList.includes("admin");
      const isComercialOnly = roleList.length > 0 && roleList.every((r: string) => r === "comercial");
      let companyName: string | null = null;
      if (profile?.active_company_id) {
        const { data: c } = await supabase.from("companies").select("nome").eq("id", profile.active_company_id).maybeSingle();
        companyName = c?.nome ?? null;
      }
      return { isAdmin, isComercialOnly, companyName };
    },
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const required = navKeyForPath(pathname);
  const blocked =
    !access.loading &&
    !access.isAdmin &&
    !!required &&
    (!access.can(required.groupKey) || (required.itemKey ? !access.can(required.itemKey) : false));

  const visibleGroups = NAV_TREE.map(g => {
    if (g.adminOnly && !workspace?.isAdmin) return null;
    if (!access.can(g.key)) return null;
    const children = g.children.filter(c => access.can(c.key));
    if (g.children.length > 0 && children.length === 0) return null;
    return { group: g, children };
  }).filter(Boolean) as { group: NavGroup; children: NavGroup["children"] }[];

  return (
    <div className="min-h-screen flex">
      {/* Spacer to reserve the collapsed rail width in layout (desktop only) */}
      <div className="hidden md:block w-16 shrink-0" aria-hidden />
      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
        />
      )}
      <aside
        data-mobile-open={mobileOpen ? "true" : "false"}
        className={cn(
          "group/sidebar fixed inset-y-0 left-0 z-40 border-r border-sidebar-border bg-sidebar flex flex-col overflow-hidden transition-[width,transform] duration-200 ease-out",
          // Desktop: rail that expands on hover
          "md:w-16 md:hover:w-60 md:translate-x-0",
          // Mobile: full drawer, off-canvas by default
          mobileOpen ? "w-64 translate-x-0" : "w-16 -translate-x-full md:translate-x-0"
        )}
      >
        <div className="p-3 border-b border-sidebar-border flex items-center gap-3 h-[73px]">
          {workspace?.companyName?.toLowerCase().includes("newline") ? (
            <img src={newlineLogo.url} alt="Newline" className="h-8 w-auto shrink-0 object-contain" />
          ) : (
            <BrandMark className="h-8 shrink-0" />
          )}
          <p className={cn("text-[10px] uppercase tracking-widest text-muted-foreground", LBL)}>Imersões Comerciais</p>
        </div>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto overflow-x-hidden">
          {workspace?.isComercialOnly ? (
            <NavItem
              to="/admin/gerador-performance"
              label="Gerador de Performance"
              Icon={Sparkles}
              active={pathname === "/admin/gerador-performance"}
            />
          ) : (
            <>
              {visibleGroups.map(({ group, children }) =>
                group.children.length === 0 && group.to ? (
                  <NavItem
                    key={group.key}
                    to={group.to}
                    label={group.label}
                    Icon={ICONS[group.key] ?? Database}
                    active={pathname === group.to || pathname.startsWith(group.to + "/")}
                  />
                ) : (
                  <NavGroupBlock key={group.key} group={group} pathname={pathname} visibleChildren={children} />
                )
              )}
            </>
          )}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className={cn("px-2 py-1.5 rounded-md bg-sidebar-accent/30", "hidden group-hover/sidebar:block group-data-[mobile-open=true]/sidebar:block")}>
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
          <Button asChild variant="ghost" size="sm" className="w-full justify-start px-2 text-muted-foreground" title="Termos de Uso">
            <Link to="/termos-de-uso">
              <ScrollText className="h-4 w-4 shrink-0" />
              <span className={cn("ml-2", LBL)}>Termos de Uso</span>
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start px-2 text-muted-foreground" title="Sair">
            <LogOut className="h-4 w-4 shrink-0" />
            <span className={cn("ml-2", LBL)}>Sair</span>
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 overflow-x-hidden relative">
        {/* Mobile top bar with hamburger */}
        <div className="md:hidden sticky top-0 z-20 flex items-center gap-2 h-12 px-3 border-b border-border bg-background/95 backdrop-blur">
          <button
            type="button"
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
            onClick={() => setMobileOpen(o => !o)}
            className="inline-flex items-center justify-center h-9 w-9 rounded-md hover:bg-muted transition"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="flex items-center gap-2 min-w-0">
            {workspace?.companyName?.toLowerCase().includes("newline") ? (
              <img src={newlineLogo.url} alt="Newline" className="h-6 w-auto shrink-0 object-contain" />
            ) : (
              <BrandMark className="h-6 shrink-0" />
            )}
            <span className="text-xs uppercase tracking-widest text-muted-foreground truncate">Imersões</span>
          </div>
        </div>
        {!isAccessGatePage && <AdminMfaBanner />}
        {blocked ? <AccessDenied /> : children}
      </main>
      {!isAccessGatePage && <ForcePasswordChange />}
      {!isAccessGatePage && <ConfidentialityModal />}
      {!isAccessGatePage && <SensitiveAdminGate />}
      <Watermark />
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="border-b border-border px-4 sm:px-8 py-5 sm:py-6 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 sm:gap-4">
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">{actions}</div>}
    </div>
  );
}
