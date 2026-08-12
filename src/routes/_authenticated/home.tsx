import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, FileSearch, Tag, Map as MapIcon, ArrowRight, LayoutDashboard, Target, BarChart3, Settings2 } from "lucide-react";
import backgroundVideoAsset from "@/assets/background-video.mp4.asset.json";

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
    <div className="relative min-h-screen w-full overflow-hidden font-sans text-white">
      {/* Background Video */}
      <div className="absolute inset-0 z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="h-full w-full object-cover brightness-[0.4]"
        >
          <source src={backgroundVideoAsset.url} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Header */}
        <header className="p-6 md:p-10 flex justify-between items-start">
          <div className="space-y-1">
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter uppercase italic text-primary">
              POOLFLUX
            </h1>
            <p className="text-[10px] md:text-xs font-bold tracking-[0.4em] text-white/60 uppercase">
              {profile?.companyName ?? "Imersão Comercial"}
            </p>
          </div>
          <div className="hidden md:block text-right">
            <div className="text-[10px] font-bold tracking-[0.2em] text-white/40 uppercase">Arquitetura Gerencial</div>
            <div className="text-sm font-medium text-white/80">Estratégia & Performance</div>
          </div>
        </header>

        <main className="flex-grow flex flex-col justify-center px-6 md:px-12 py-12 max-w-7xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Column: Strategic Vision */}
            <div className="lg:col-span-7 space-y-12">
              <div className="space-y-4">
                <h2 className="text-5xl md:text-7xl font-black tracking-tighter leading-none uppercase">
                  DIRETRIZ <br />
                  <span className="text-primary italic">ESTRATÉGICA</span>
                </h2>
                <div className="h-1 w-24 bg-primary" />
              </div>

              {/* NÍVEL 1: ÁREAS DE ANÁLISE (Grid) */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  {
                    title: "PERFORMANCE",
                    links: [
                      { label: "Performance Reps", to: "/representantes/performance" },
                      { label: "BI Clientes", to: "/performance/bi-clientes" }
                    ],
                    icon: BarChart3
                  },
                  {
                    title: "IMERSÕES",
                    links: [
                      { label: "Visão Reps", to: "/visao-rep-2" },
                      { label: "Imersões Campo", to: "/visao-imersao-2" },
                      { label: "Consolidados", to: "/sintese/tipos" }
                    ],
                    icon: Target
                  },
                  {
                    title: "PREÇOS",
                    links: [
                      { label: "Mapa Preços", to: "/precos/mapa" },
                      { label: "Simulador", to: "/precos/simulador" },
                      { label: "Comparativos", to: "/price/comparativos" }
                    ],
                    icon: Settings2
                  }
                ].map((group) => (
                  <div key={group.title} className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl hover:bg-white/10 transition-all group">
                    <div className="flex justify-between items-start mb-4">
                      <group.icon className="h-5 w-5 text-primary" />
                      <span className="text-[9px] font-bold tracking-widest text-white/40 uppercase">Análise</span>
                    </div>
                    <h3 className="text-sm font-black tracking-wider mb-4">{group.title}</h3>
                    <div className="flex flex-col gap-2">
                      {group.links.map((link) => (
                        <Link 
                          key={link.label}
                          to={link.to as any} 
                          className="text-xs font-bold text-white/60 hover:text-primary transition-colors flex items-center gap-2"
                        >
                          <div className="h-1 w-1 rounded-full bg-white/20 group-hover:bg-primary/40" />
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column: Execution Hub */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              {/* NÍVEL 2: MAPA DE AÇÕES */}
              <Link 
                to="/mapa-acoes"
                className="group relative bg-primary p-8 rounded-3xl overflow-hidden transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <div className="absolute top-0 right-0 p-4">
                  <ArrowRight className="h-8 w-8 text-black/20 group-hover:text-black/40 transition-colors" />
                </div>
                <span className="text-[10px] font-black tracking-[0.3em] text-black/60 uppercase block mb-2">Decisão Central</span>
                <h2 className="text-4xl font-black text-black tracking-tighter uppercase leading-none">
                  MAPA DE <br /> AÇÕES
                </h2>
                <div className="mt-8 flex items-center gap-2">
                  <div className="h-1 flex-grow bg-black/10" />
                  <span className="text-[9px] font-black text-black/40 uppercase tracking-widest">Execução em tempo real</span>
                </div>
              </Link>

              {/* NÍVEL 3: DESDOBRAMENTO */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "COMERCIAL", icon: TrendingUp },
                  { label: "PRODUTO", icon: Tag },
                  { label: "MARKETING", icon: FileSearch },
                  { label: "GOVERNANÇA", icon: MapIcon }
                ].map((item) => (
                  <Link
                    key={item.label}
                    to="/mapa-acoes"
                    className="bg-white/5 backdrop-blur-md border border-white/10 p-6 rounded-2xl flex flex-col items-center gap-3 hover:bg-white/10 hover:border-white/20 transition-all text-center"
                  >
                    <item.icon className="h-4 w-4 text-white/40" />
                    <h3 className="text-[10px] font-black tracking-widest text-white uppercase">{item.label}</h3>
                  </Link>
                ))}
              </div>
            </div>

          </div>
        </main>

        {/* Footer */}
        <footer className="p-8 md:p-12 flex flex-col md:flex-row justify-between items-center gap-6 text-white/40">
          <div className="flex gap-8 text-[9px] font-bold tracking-[0.3em] uppercase">
            <span>PoolFlux © 2026</span>
            <span>Inteligência de Mercado</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-px w-12 bg-white/10 hidden md:block" />
            <span className="text-[10px] italic font-medium">Elevating performance through data-driven store visits</span>
          </div>
        </footer>
      </div>

      {/* Aesthetic Grain Overlay */}
      <div className="fixed inset-0 pointer-events-none z-50 opacity-[0.03] mix-blend-overlay bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
    </div>
  );
}

