import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  TrendingUp, 
  FileSearch, 
  Tag, 
  LayoutGrid, 
  Users, 
  LineChart, 
  Briefcase, 
  Wrench,
  ArrowRight,
  Package
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({ meta: [{ title: "Home — PoolFlux" }] }),
  component: HomeComponent,
});

function HomeComponent() {
  const { data: profile } = useQuery({
    queryKey: ["active-company-home"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("active_company_id").eq("id", u.user.id).maybeSingle();
      if (!data?.active_company_id) return null;
      const { data: company } = await supabase.from("companies").select("nome").eq("id", data.active_company_id).maybeSingle();
      return { ...data, companyName: company?.nome };
    },
  });

  return (
    <div className="min-h-screen pb-12">
      <PageHeader
        title="Painel Executivo"
        subtitle={`Visão geral estratégica — ${profile?.companyName ?? "Imersão Comercial"}`}
      />

      <div className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">
        {/* Seção 1: PERFORMANCE */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-primary font-semibold">
            <TrendingUp className="h-5 w-5" />
            <h3>Performance Comercial</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="hover:border-primary transition-colors cursor-pointer" asChild>
              <Link to="/representantes/performance">
                <CardHeader>
                  <CardTitle className="text-base">Painel Geral de Performance</CardTitle>
                  <CardDescription>Atingimento de metas e rankings de participação por família.</CardDescription>
                </CardHeader>
              </Link>
            </Card>
            <Card className="hover:border-primary transition-colors cursor-pointer" asChild>
              <Link to="/performance/bi-clientes">
                <CardHeader>
                  <CardTitle className="text-base">Visão por Família</CardTitle>
                  <CardDescription>Matriz detalhada de gaps e oportunidades em clientes da carteira.</CardDescription>
                </CardHeader>
              </Link>
            </Card>
          </div>
        </section>

        {/* Seção 2: IMERSÕES */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-primary font-semibold">
            <FileSearch className="h-5 w-5" />
            <h3>Ecossistema de Imersões</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="hover:border-primary transition-colors cursor-pointer" asChild>
              <Link to="/sintese/tipos">
                <CardHeader>
                  <CardTitle className="text-base">Visões Consolidadas</CardTitle>
                  <CardDescription>Leitura integrada de sinais de mercado.</CardDescription>
                </CardHeader>
              </Link>
            </Card>
            <Card className="hover:border-primary transition-colors cursor-pointer" asChild>
              <Link to="/visao-rep-2">
                <CardHeader>
                  <CardTitle className="text-base">Teia de Posicionamento</CardTitle>
                  <CardDescription>Radar comparativo de força de marca e serviço.</CardDescription>
                </CardHeader>
              </Link>
            </Card>
            <Card className="hover:border-primary transition-colors cursor-pointer" asChild>
              <Link to="/visao-imersao-2">
                <CardHeader>
                  <CardTitle className="text-base">Visão Imersão</CardTitle>
                  <CardDescription>Aprofundamento qualitativo de cada visita técnica.</CardDescription>
                </CardHeader>
              </Link>
            </Card>
          </div>
        </section>

        {/* Seção 3: ESTRATÉGIA & PRICE */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-primary font-semibold">
            <Tag className="h-5 w-5" />
            <h3>Estratégia & Price</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="hover:border-primary transition-colors cursor-pointer" asChild>
              <Link to="/price/comparativos">
                <CardHeader>
                  <CardTitle className="text-base">Price Comparativos</CardTitle>
                  <CardDescription>Score técnico e posicionamento versus concorrência.</CardDescription>
                </CardHeader>
              </Link>
            </Card>
            <Card className="opacity-60 grayscale cursor-not-allowed">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base">Mercado & Concorrência</CardTitle>
                  <Badge variant="secondary" className="text-[10px]">Em breve</Badge>
                </div>
                <CardDescription>Mapas de share e monitoramento de competidores.</CardDescription>
              </CardHeader>
            </Card>
            <Card className="opacity-60 grayscale cursor-not-allowed">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base">Plano de Voo 2026</CardTitle>
                  <Badge variant="secondary" className="text-[10px]">Em breve</Badge>
                </div>
                <CardDescription>Projeção de crescimento e expansão geográfica.</CardDescription>
              </CardHeader>
            </Card>
          </div>
        </section>

        {/* Seção 4: GESTÃO & FERRAMENTAS */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 text-primary font-semibold">
            <LayoutGrid className="h-5 w-5" />
            <h3>Central de Ações e Gestão</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link to="/tarefas" className="flex items-center justify-between p-4 surface rounded-xl border border-border hover:border-primary transition-all">
              <div className="flex items-center gap-3">
                <ListChecks className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">Gestão de Tarefas</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link to="/admin/gerador-performance" className="flex items-center justify-between p-4 surface rounded-xl border border-border hover:border-primary transition-all">
              <div className="flex items-center gap-3">
                <Sparkles className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">Gerador Performance</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link to="/manuais" className="flex items-center justify-between p-4 surface rounded-xl border border-border hover:border-primary transition-all">
              <div className="flex items-center gap-3">
                <BookOpen className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">Manuais</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link to="/clientes" className="flex items-center justify-between p-4 surface rounded-xl border border-border hover:border-primary transition-all">
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium">Bases e Cadastros</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function Badge({ children, variant, className }: { children: React.ReactNode, variant?: string, className?: string }) {
  return (
    <span className={cn(
      "px-2 py-0.5 rounded text-[10px] font-bold uppercase",
      variant === "secondary" ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground",
      className
    )}>
      {children}
    </span>
  )
}
