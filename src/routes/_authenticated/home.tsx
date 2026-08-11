import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { TrendingUp, FileSearch, Tag, Map, ArrowRight } from "lucide-react";

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
    <div className="min-h-screen bg-[#F8FAFC]">
      <PageHeader
        title="Home"
        subtitle={\`Arquitetura Gerencial — \${profile?.companyName ?? "Imersão Comercial"}\`}
      />

      <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-12">
        {/* NÍVEL 1: ÁREAS DE ANÁLISE */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* PERFORMANCE */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-lg p-4 text-center shadow-sm relative z-10">
              <span className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase block mb-1">Análise</span>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">PERFORMANCE</h2>
            </div>
            <div className="space-y-3 px-2">
              <Link 
                to="/representantes/performance" 
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-primary transition-colors group"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-slate-300 group-hover:bg-primary" />
                Performance Reps
              </Link>
              <Link 
                to="/performance/bi-clientes" 
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-primary transition-colors group"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-slate-300 group-hover:bg-primary" />
                BI Clientes
              </Link>
            </div>
          </div>

          {/* IMERSÕES */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-lg p-4 text-center shadow-sm relative z-10">
              <span className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase block mb-1">Análise</span>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">IMERSÕES</h2>
            </div>
            <div className="space-y-3 px-2">
              <Link 
                to="/visao-rep-2" 
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-primary transition-colors group"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-slate-300 group-hover:bg-primary" />
                Visão Reps
              </Link>
              <Link 
                to="/visao-imersao-2" 
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-primary transition-colors group"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-slate-300 group-hover:bg-primary" />
                Visão Imersões em Campo
              </Link>
              <Link 
                to="/sintese/tipos" 
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-primary transition-colors group"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-slate-300 group-hover:bg-primary" />
                Visões Consolidadas
              </Link>
            </div>
          </div>

          {/* PREÇOS */}
          <div className="space-y-6">
            <div className="bg-white border border-slate-200 rounded-lg p-4 text-center shadow-sm relative z-10">
              <span className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase block mb-1">Análise</span>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">PREÇOS</h2>
            </div>
            <div className="space-y-3 px-2">
              <Link 
                to="/precos/mapa" 
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-primary transition-colors group"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-slate-300 group-hover:bg-primary" />
                Mapa de Preços
              </Link>
              <Link 
                to="/precos/simulador" 
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-primary transition-colors group"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-slate-300 group-hover:bg-primary" />
                Simulador, R$ + Características
              </Link>
              <Link 
                to="/price/comparativos" 
                className="flex items-center gap-2 text-sm text-slate-600 hover:text-primary transition-colors group"
              >
                <div className="h-1.5 w-1.5 rounded-full bg-slate-300 group-hover:bg-primary" />
                Comparativos
              </Link>
            </div>
          </div>

          {/* Conectores Visuais Nível 1 -> 2 (Desktop only) */}
          <div className="hidden md:block absolute top-[100%] left-0 right-0 h-12 pointer-events-none">
             <svg className="w-full h-full" preserveAspectRatio="none">
                <path d="M 20% 0 L 50% 100%" stroke="#E2E8F0" strokeWidth="1" fill="none" />
                <path d="M 50% 0 L 50% 100%" stroke="#E2E8F0" strokeWidth="1" fill="none" />
                <path d="M 80% 0 L 50% 100%" stroke="#E2E8F0" strokeWidth="1" fill="none" />
             </svg>
          </div>
        </div>

        {/* NÍVEL 2: CONVERGÊNCIA */}
        <div className="flex justify-center pt-8">
          <Link 
            to="/mapa-acoes"
            className="w-full md:w-2/3 lg:w-1/2 bg-slate-900 text-white border border-slate-800 rounded-lg p-6 text-center shadow-md hover:bg-slate-800 transition-all group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase block mb-1">Decisão</span>
            <h2 className="text-xl font-bold tracking-tight flex items-center justify-center gap-2">
              MAPA DE AÇÕES
              <ArrowRight className="h-5 w-5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </h2>
          </Link>
        </div>

        {/* NÍVEL 3: DESDOBRAMENTO */}
        <div className="relative pt-4">
          {/* Conector Nível 2 -> 3 (Desktop only) */}
          <div className="hidden md:block absolute -top-8 left-0 right-0 h-12 pointer-events-none">
            <svg className="w-full h-full" preserveAspectRatio="none">
              <path d="M 50% 0 L 50% 30% M 12.5% 30% L 87.5% 30% M 12.5% 30% L 12.5% 100% M 37.5% 30% L 37.5% 100% M 62.5% 30% L 62.5% 100% M 87.5% 30% L 87.5% 100%" stroke="#E2E8F0" strokeWidth="1" fill="none" />
            </svg>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:pt-4">
            {[
              { label: "COMERCIAL", icon: TrendingUp },
              { label: "PRODUTO", icon: Tag },
              { label: "MARKETING", icon: FileSearch },
              { label: "GOVERNANÇA", icon: Map }
            ].map((item) => (
              <div key={item.label} className="bg-white border border-slate-200 rounded-lg p-6 text-center shadow-sm flex flex-col items-center gap-3">
                <span className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">Ação</span>
                <h3 className="text-xs font-bold text-slate-700 tracking-widest">{item.label}</h3>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
