import { createFileRoute, Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, FileSearch, Tag, Map as MapIcon, ArrowRight, Target, BarChart3, Settings2 } from "lucide-react";
import { GrowUpSaudeLogo, JornadaProdutosLogo, PoolFlowLogo } from "@/components/Brand";
import backgroundVideoAsset from "@/assets/background-video.mp4.asset.json";
import newlineLogo from "@/assets/newline-logo.png.asset.json";

export const Route = createFileRoute("/_authenticated/home")({
  head: () => ({
    meta: [
      { title: "Dados e tomada de decisão. — PoolFlux" },
      { name: "description", content: "Painel executivo PoolFlux: performance, imersões, preços e mapa de ações em um único fluxo de decisão." },
      { property: "og:title", content: "Dados e tomada de decisão. — PoolFlux" },
      { property: "og:description", content: "Painel executivo PoolFlux: performance, imersões, preços e mapa de ações." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
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
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0b0b0b] font-sans text-white">
      {/* Background Video */}
      <div className="absolute inset-0 z-0">
        <video autoPlay loop muted playsInline className="h-full w-full object-cover brightness-[0.3] saturate-[0.6]">
          <source src={backgroundVideoAsset.url} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/90" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Header — apenas a marca newline, discreta */}
        <header className="flex items-start justify-between p-6 md:p-10">
          <img src={newlineLogo.url} alt="Newline" className="h-6 w-auto object-contain opacity-70" />
          <div className="hidden text-right md:block">
            <div className="text-[10px] font-light uppercase tracking-[0.35em] text-white/35">
              {profile?.companyName ?? "Imersão Comercial"}
            </div>
            <div className="mt-1 text-sm font-light text-white/70">Estratégia &amp; Performance</div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-7xl flex-grow flex-col justify-center px-6 py-12 md:px-12">
          <div className="grid grid-cols-1 items-stretch gap-12 lg:grid-cols-12">
            {/* Left Column */}
            <div className="space-y-12 lg:col-span-8">
              <div className="space-y-5">
                <div className="flex items-center gap-4">
                  <div className="h-px w-10 bg-nl-gold" />
                  <span className="text-[11px] font-light uppercase tracking-[0.45em] text-white/45">Newline</span>
                </div>
                <h1 className="text-3xl font-light leading-[1.05] tracking-tight md:text-5xl">
                  Dados e tomada de <span className="text-nl-gold">decisão.</span>
                </h1>
                <p className="max-w-xl text-base font-light text-white/55 md:text-lg">
                  Dados e indicadores para potencializar a operação comercial Newline.
                </p>
              </div>

              {/* NÍVEL 1: DADOS E TOMADA DE DECISÃO. */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                  {
                    title: "Performance",
                    links: [
                      { label: "Performance Reps", to: "/representantes/performance" },
                      { label: "BI Clientes", to: "/performance/bi-clientes" },
                    ],
                    icon: GrowUpSaudeLogo,
                  },
                  {
                    title: "Imersões",
                    links: [
                      { label: "Visão Reps", to: "/visao-rep-2" },
                      { label: "Imersões Campo", to: "/visao-imersao-2" },
                      { label: "Consolidados", to: "/sintese/tipos" },
                    ],
                    icon: JornadaProdutosLogo,
                  },
                  {
                    title: "Preços",
                    links: [
                      { label: "Mapa Preços", to: "/price/mapa" },
                      { label: "Simulador", to: "/price/simulador" },
                      { label: "Comparativos", to: "/price/comparativos" },
                    ],
                    icon: Settings2,
                  },
                ].map((group) => (

                  <div
                    key={group.title}
                    className="group flex flex-col rounded-xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur-md transition-all hover:border-nl-gold/40 hover:bg-white/[0.07]"
                  >
                    <div className="mb-8 flex items-start justify-between">
                      <group.icon className={cn("h-6 w-auto", group.title === "Preços" ? "text-nl-gold" : "")} />
                    </div>
                    <h2 className="mb-6 text-3xl font-light leading-none tracking-tight text-white">{group.title}</h2>
                    <div className="mt-auto flex flex-col gap-2.5">
                      {group.links.map((link) => (
                        <Link
                          key={link.label}
                          to={link.to as any}
                          className="flex items-center gap-2 text-sm font-light text-white/55 transition-colors hover:text-nl-gold"
                        >
                          <div className="h-px w-3 bg-white/25" />
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column */}
            <div className="flex flex-col lg:col-span-4">
              <Link
                to="/mapa-acoes"
                className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-nl-gold/40 bg-nl-gold/[0.08] p-8 transition-all hover:bg-nl-gold/[0.14]"
              >
                <div className="absolute right-8 top-8">
                  <ArrowRight className="h-8 w-8 text-nl-gold/60 transition-transform group-hover:translate-x-1" strokeWidth={1.5} />
                </div>
                <span className="mb-8 block text-[10px] font-light uppercase tracking-[0.35em] text-nl-gold/80">
                  Decisão Central
                </span>
                <h2 className="text-3xl font-light leading-none tracking-tight text-white">
                  Mapa de <br /> Ações
                </h2>
                <div className="mt-auto flex items-center gap-3">
                  <div className="h-px flex-grow bg-white/15" />
                  <span className="text-[9px] font-light uppercase tracking-[0.25em] text-white/40">
                    Execução em tempo real
                  </span>
                </div>
              </Link>

              <div className="hidden grid-cols-2 gap-4">
                {[
                  { label: "Comercial", icon: PoolFlowLogo },
                  { label: "Produto", icon: JornadaProdutosLogo },
                  { label: "Marketing", icon: PoolFlowLogo },
                  { label: "Governança", icon: MapIcon },
                ].map((item) => (
                  <Link
                    key={item.label}
                    to="/mapa-acoes"
                    className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/[0.04] p-6 text-center backdrop-blur-md transition-all hover:border-nl-gold/40 hover:bg-white/[0.07]"
                  >
                    <item.icon className="h-4 w-auto text-white/40" />

                    <h3 className="text-[11px] font-light uppercase tracking-[0.2em] text-white/80">{item.label}</h3>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="flex flex-col items-center justify-between gap-5 p-8 text-white/30 md:flex-row md:p-12">
          <div className="flex gap-8 text-[9px] font-light uppercase tracking-[0.3em]">
            <span>PoolFlux © 2026</span>
            <span>Inteligência de Mercado</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden h-px w-8 bg-white/15 md:block" />
            <div className="h-px w-8 bg-nl-gold/70" />
          </div>
        </footer>
      </div>
    </div>
  );
}
