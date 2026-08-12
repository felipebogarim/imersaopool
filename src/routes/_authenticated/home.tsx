import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, FileSearch, Tag, Map as MapIcon, ArrowRight } from "lucide-react";

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
        subtitle={"Arquitetura Gerencial — " + (profile?.companyName ?? "Imersão Comercial")}
      />

      <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-16">
        {/* NÍVEL 1: ÁREAS DE ANÁLISE */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative">
          {/* PERFORMANCE */}
          <div className="space-y-8 flex flex-col items-center">
            <div className="w-full bg-white border border-slate-200 rounded-lg p-6 text-center shadow-sm relative z-10">
              <span className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase block mb-1">Análise</span>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">PERFORMANCE</h2>
            </div>
            <div className="flex flex-col items-center space-y-4 w-full">
              <Link 
                to="/representantes/performance" 
                className="text-sm font-medium text-slate-600 hover:text-primary transition-all hover:translate-x-1"
              >
                Performance Reps
              </Link>
              <Link 
                to="/performance/bi-clientes" 
                className="text-sm font-medium text-slate-600 hover:text-primary transition-all hover:translate-x-1"
              >
                BI Clientes
              </Link>
            </div>
          </div>

          {/* IMERSÕES */}
          <div className="space-y-8 flex flex-col items-center">
            <div className="w-full bg-white border border-slate-200 rounded-lg p-6 text-center shadow-sm relative z-10">
              <span className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase block mb-1">Análise</span>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">IMERSÕES</h2>
            </div>
            <div className="flex flex-col items-center space-y-4 w-full">
              <Link 
                to="/visao-rep-2" 
                className="text-sm font-medium text-slate-600 hover:text-primary transition-all hover:translate-x-1"
              >
                Visão Reps
              </Link>
              <Link 
                to="/visao-imersao-2" 
                className="text-sm font-medium text-slate-600 hover:text-primary transition-all hover:translate-x-1 text-center"
              >
                Visão Imersões em Campo
              </Link>
              <Link 
                to="/sintese/tipos" 
                className="text-sm font-medium text-slate-600 hover:text-primary transition-all hover:translate-x-1"
              >
                Visões Consolidadas
              </Link>
            </div>
          </div>

          {/* PREÇOS */}
          <div className="space-y-8 flex flex-col items-center">
            <div className="w-full bg-white border border-slate-200 rounded-lg p-6 text-center shadow-sm relative z-10">
              <span className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase block mb-1">Análise</span>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight">PREÇOS</h2>
            </div>
            <div className="flex flex-col items-center space-y-4 w-full">
              <Link 
                to="/precos/mapa" 
                className="text-sm font-medium text-slate-600 hover:text-primary transition-all hover:translate-x-1"
              >
                Mapa de Preços
              </Link>
              <Link 
                to="/precos/simulador" 
                className="text-sm font-medium text-slate-600 hover:text-primary transition-all hover:translate-x-1 text-center"
              >
                Simulador, R$ + Características
              </Link>
              <Link 
                to="/price/comparativos" 
                className="text-sm font-medium text-slate-600 hover:text-primary transition-all hover:translate-x-1"
              >
                Comparativos
              </Link>
            </div>
          </div>

          {/* Conectores Visuais Nível 1 -> 2 (Desktop) */}
          <div className="hidden md:block absolute top-[100%] left-0 right-0 h-16 pointer-events-none -mt-4">
             <svg className="w-full h-full" preserveAspectRatio="none">
                <path d="M 16.6% 0 L 50% 100%" stroke="#CBD5E1" strokeWidth="1.5" fill="none" strokeDasharray="4 4" />
                <path d="M 50% 0 L 50% 100%" stroke="#CBD5E1" strokeWidth="1.5" fill="none" strokeDasharray="4 4" />
                <path d="M 83.3% 0 L 50% 100%" stroke="#CBD5E1" strokeWidth="1.5" fill="none" strokeDasharray="4 4" />
             </svg>
          </div>
        </div>

        {/* NÍVEL 2: CONVERGÊNCIA */}
        <div className="flex justify-center pt-8">
          <Link 
            to="/mapa-acoes"
            className="w-full md:w-3/5 lg:w-1/2 bg-slate-900 text-white border border-slate-800 rounded-xl p-8 text-center shadow-lg hover:bg-slate-800 transition-all group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="text-[10px] font-bold tracking-[0.3em] text-slate-500 uppercase block mb-2">Decisão</span>
            <h2 className="text-2xl font-bold tracking-widest flex items-center justify-center gap-3">
              MAPA DE AÇÕES
              <ArrowRight className="h-6 w-6 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </h2>
          </Link>
        </div>

        {/* NÍVEL 3: DESDOBRAMENTO */}
        <div className="relative">
          {/* Conector Nível 2 -> 3 (Desktop) */}
          <div className="hidden md:block absolute -top-12 left-0 right-0 h-12 pointer-events-none">
            <svg className="w-full h-full" preserveAspectRatio="none">
              <path d="M 50% 0 L 50% 50% M 12.5% 50% L 87.5% 50% M 12.5% 50% L 12.5% 100% M 37.5% 50% L 37.5% 100% M 62.5% 50% L 62.5% 100% M 87.5% 50% L 87.5% 100%" stroke="#CBD5E1" strokeWidth="1.5" fill="none" strokeDasharray="4 4" />
            </svg>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-4">
            {[
              { label: "COMERCIAL", icon: TrendingUp },
              { label: "PRODUTO", icon: Tag },
              { label: "MARKETING", icon: FileSearch },
              { label: "GOVERNANÇA", icon: MapIcon }
            ].map((item) => (
              <Link
                key={item.label}
                to="/mapa-acoes"
                className="bg-white border border-slate-200 rounded-lg p-8 text-center shadow-sm flex flex-col items-center gap-4 hover:border-slate-400 transition-all hover:scale-[1.02]"
              >
                <span className="text-[10px] font-bold tracking-[0.2em] text-slate-400 uppercase">Ação</span>
                <h3 className="text-xs font-bold text-slate-800 tracking-[0.15em]">{item.label}</h3>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
