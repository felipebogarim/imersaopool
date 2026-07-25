import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { BarChart3, Users, Briefcase, Tag, UserCog, LogOut, FileSearch, TrendingUp, Building2, MessageSquare, Repeat, Shield, ShieldCheck, Database, Package, ChevronDown, ChevronRight, Inbox, BookOpen, Lightbulb, Sparkles, ListChecks, HardDriveDownload, FileText, ScrollText, KeyRound, LineChart, Wrench, Menu, X } from "lucide-react";
import { useState, useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BrandMark } from "@/components/Brand";
import newlineLogo from "@/assets/newline-logo.png.asset.json";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ConfidentialityModal } from "@/components/ConfidentialityModal";
import { Watermark } from "@/components/Watermark";
import { AdminMfaBanner } from "@/components/mfa/AdminMfaBanner";
import { SensitiveAdminGate } from "@/components/mfa/SensitiveAdminGate";

const NAV = [
  { to: "/dashboard", label: "BI", icon: BarChart3 },
] as const;

const INPUTS = [
  { to: "/imersoes", label: "Imersões em Campo", icon: FileSearch },
  { to: "/entrevistas", label: "Entrevistas", icon: MessageSquare },
  { to: "/forms", label: "Forms", icon: FileText },
] as const;


const ANALISES = [
  { to: "/perspectivas", label: "Perspectivas", icon: Lightbulb },
  { to: "/compilacoes", label: "Compilações IA", icon: Sparkles },
] as const;

const PRICE = [
  { to: "/price/competidores", label: "Competidores", icon: Users },
  { to: "/price/tabelas", label: "Tabelas", icon: FileText },
  { to: "/price/comparativos", label: "Comparativos", icon: BarChart3 },
] as const;


const REPS = [
  { to: "/representantes", label: "Atuais Reps", icon: Users },
  { to: "/representantes/performance", label: "Performance", icon: TrendingUp },
] as const;

const CLIENTES = [
  { to: "/clientes", label: "Clientes", icon: Briefcase },
  { to: "/projecao", label: "Projeção de Categorias / Benefícios", icon: TrendingUp },
  { to: "/novo-corp", label: "Novo Corp", icon: Building2 },
] as const;

const BASES = [
  { to: "/produtos", label: "Produtos", icon: Package },
  { to: "/familias", label: "Famílias", icon: Package },
  { to: "/roteiros", label: "Roteiros", icon: BookOpen },
] as const;

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

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: s => s.location.pathname });
  const [basesOpen, setBasesOpen] = useState(() => BASES.some(b => pathname.startsWith(b.to)));
  const [inputsOpen, setInputsOpen] = useState(() => INPUTS.some(b => pathname.startsWith(b.to)));
  const [analisesOpen, setAnalisesOpen] = useState(() => ANALISES.some(b => pathname.startsWith(b.to)));
  const [repsOpen, setRepsOpen] = useState(() => REPS.some(b => pathname === b.to || pathname.startsWith(b.to + "/")));
  const [clientesOpen, setClientesOpen] = useState(() => CLIENTES.some(b => pathname === b.to || pathname.startsWith(b.to + "/")));
  const [ferramentasOpen, setFerramentasOpen] = useState(() => pathname.startsWith("/admin/gerador-performance") || pathname.startsWith("/tarefas"));
  const [priceOpen, setPriceOpen] = useState(() => pathname.startsWith("/price"));

  const [adminOpen, setAdminOpen] = useState(() => pathname.startsWith("/admin") || pathname.startsWith("/agentes"));
  const [mobileOpen, setMobileOpen] = useState(false);
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

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setAnalisesOpen(o => !o)}
                  title="Análises"
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition"
                >
                  <LineChart className="h-4 w-4 shrink-0" />
                  <span className={cn("flex-1 text-left", LBL)}>Análises</span>
                  {analisesOpen ? <ChevronDown className={cn("h-3.5 w-3.5", ONLY_EXPANDED)} /> : <ChevronRight className={cn("h-3.5 w-3.5", ONLY_EXPANDED)} />}
                </button>
                {analisesOpen && (
                  <div className="mt-1 ml-3 pl-3 border-l border-sidebar-border space-y-1">
                    {ANALISES.map(item => (
                      <NavItem key={item.to} to={item.to} label={item.label} Icon={item.icon} active={pathname === item.to || pathname.startsWith(item.to + "/")} />
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setPriceOpen(o => !o)}
                  title="Price"
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition"
                >
                  <Tag className="h-4 w-4 shrink-0" />
                  <span className={cn("flex-1 text-left", LBL)}>Price</span>
                  {priceOpen ? <ChevronDown className={cn("h-3.5 w-3.5", ONLY_EXPANDED)} /> : <ChevronRight className={cn("h-3.5 w-3.5", ONLY_EXPANDED)} />}
                </button>
                {priceOpen && (
                  <div className="mt-1 ml-3 pl-3 border-l border-sidebar-border space-y-1">
                    {PRICE.map(item => (
                      <NavItem key={item.to} to={item.to} label={item.label} Icon={item.icon} active={pathname === item.to || pathname.startsWith(item.to + "/")} />
                    ))}
                  </div>
                )}
              </div>



              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setRepsOpen(o => !o)}
                  title="Representantes"
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition"
                >
                  <Users className="h-4 w-4 shrink-0" />
                  <span className={cn("flex-1 text-left", LBL)}>Representantes</span>
                  {repsOpen ? <ChevronDown className={cn("h-3.5 w-3.5", ONLY_EXPANDED)} /> : <ChevronRight className={cn("h-3.5 w-3.5", ONLY_EXPANDED)} />}
                </button>
                {repsOpen && (
                  <div className="mt-1 ml-3 pl-3 border-l border-sidebar-border space-y-1">
                    {REPS.map(item => (
                      <NavItem key={item.to} to={item.to} label={item.label} Icon={item.icon} active={pathname === item.to || (item.to !== "/representantes" && pathname.startsWith(item.to + "/"))} />
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setClientesOpen(o => !o)}
                  title="Clientes"
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition"
                >
                  <Briefcase className="h-4 w-4 shrink-0" />
                  <span className={cn("flex-1 text-left", LBL)}>Clientes</span>
                  {clientesOpen ? <ChevronDown className={cn("h-3.5 w-3.5", ONLY_EXPANDED)} /> : <ChevronRight className={cn("h-3.5 w-3.5", ONLY_EXPANDED)} />}
                </button>
                {clientesOpen && (
                  <div className="mt-1 ml-3 pl-3 border-l border-sidebar-border space-y-1">
                    {CLIENTES.map(item => (
                      <NavItem key={item.to} to={item.to} label={item.label} Icon={item.icon} active={pathname === item.to || pathname.startsWith(item.to + "/")} />
                    ))}
                  </div>
                )}
              </div>

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

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setFerramentasOpen(o => !o)}
                  title="Ferramentas"
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition"
                >
                  <Wrench className="h-4 w-4 shrink-0" />
                  <span className={cn("flex-1 text-left", LBL)}>Ferramentas</span>
                  {ferramentasOpen ? <ChevronDown className={cn("h-3.5 w-3.5", ONLY_EXPANDED)} /> : <ChevronRight className={cn("h-3.5 w-3.5", ONLY_EXPANDED)} />}
                </button>
                {ferramentasOpen && (
                  <div className="mt-1 ml-3 pl-3 border-l border-sidebar-border space-y-1">
                    <NavItem
                      to="/admin/gerador-performance"
                      label="Gerador de Performance"
                      Icon={Sparkles}
                      active={pathname === "/admin/gerador-performance"}
                    />
                    <NavItem
                      to="/tarefas"
                      label="Gestão de Tarefas"
                      Icon={ListChecks}
                      active={pathname.startsWith("/tarefas")}
                    />

                    <button
                      type="button"
                      onClick={() => toast.info("Tabela de Preços", { description: "Área em construção." })}
                      title="Tabela de Preços"
                      className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition text-left"
                    >
                      <Tag className="h-4 w-4 shrink-0" />
                      <span className={LBL}>Tabela de Preços</span>
                    </button>
                  </div>
                )}
              </div>

              {workspace?.isAdmin && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setAdminOpen(o => !o)}
                    title="Admin"
                    className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent/50 transition"
                  >
                    <Shield className="h-4 w-4 shrink-0" />
                    <span className={cn("flex-1 text-left", LBL)}>Admin</span>
                    {adminOpen ? <ChevronDown className={cn("h-3.5 w-3.5", ONLY_EXPANDED)} /> : <ChevronRight className={cn("h-3.5 w-3.5", ONLY_EXPANDED)} />}
                  </button>
                  {adminOpen && (
                    <div className="mt-1 ml-3 pl-3 border-l border-sidebar-border space-y-1">
                      {[
                        { to: "/admin/usuarios", label: "Usuários", icon: UserCog },
                        { to: "/agentes", label: "Agentes", icon: UserCog },
                        { to: "/admin/permissoes", label: "Permissões", icon: ShieldCheck },
                        { to: "/admin/conformidade", label: "Conformidade e Aceites", icon: FileText },
                        { to: "/admin/mfa", label: "Meu MFA", icon: KeyRound },
                        { to: "/admin/mfa-politica", label: "Política de MFA", icon: Shield },
                        { to: "/admin/mfa-recuperacao", label: "Recuperação de MFA", icon: KeyRound },
                        { to: "/admin/auditoria-seguranca", label: "Auditoria de Segurança", icon: Shield },
                        { to: "/admin/lgpd", label: "LGPD e Expurgo", icon: ShieldCheck },
                        { to: "/admin/criterios-seguranca", label: "Critérios de Segurança", icon: ShieldCheck },
                        { to: "/admin/backup", label: "Backup", icon: HardDriveDownload },

                      ].map(item => (
                        <NavItem key={item.to} to={item.to} label={item.label} Icon={item.icon} active={pathname === item.to || pathname.startsWith(item.to + "/")} />
                      ))}
                    </div>
                  )}
                </div>
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
        <AdminMfaBanner />
        {children}
      </main>
      <ConfidentialityModal />
      <SensitiveAdminGate />
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

