import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowRight } from "lucide-react";
import backgroundVideoAsset from "@/assets/background-video.mp4.asset.json";
import newlineLogo from "@/assets/newline-logo.png.asset.json";
import { useNavAccess } from "@/hooks/useNavAccess";
import { buildHome2Sections, isHome2User } from "@/lib/home2";

export const Route = createFileRoute("/_authenticated/home-2")({
  // Home 2 é exclusiva de usuários listados em HOME2_EMAILS; os demais voltam à Home.
  beforeLoad: ({ context }) => {
    const email = (context as { user?: { email?: string | null } }).user?.email;
    if (!isHome2User(email)) throw redirect({ to: "/home", replace: true });
  },
  head: () => ({
    meta: [
      { title: "Home 2 — PoolFlux" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Home2Component,
});

function Home2Component() {
  const access = useNavAccess();
  const sections = buildHome2Sections(access.can);

  const { data: companyName } = useQuery({
    queryKey: ["active-company-home"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("active_company_id")
        .eq("id", u.user.id)
        .maybeSingle();
      if (!data?.active_company_id) return null;
      const { data: company } = await supabase
        .from("companies")
        .select("nome")
        .eq("id", data.active_company_id)
        .maybeSingle();
      return company?.nome ?? null;
    },
  });

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0b0b0b] font-sans text-white">
      <div className="absolute inset-0 z-0">
        <video autoPlay loop muted playsInline className="h-full w-full object-cover brightness-[0.3] saturate-[0.6]">
          <source src={backgroundVideoAsset.url} type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/40 to-black/90" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex items-start justify-between p-6 md:p-10">
          <img src={newlineLogo.url} alt="Newline" className="h-6 w-auto object-contain opacity-70" />
          <div className="hidden text-right md:block">
            <div className="text-[10px] font-light uppercase tracking-[0.35em] text-white/35">
              {companyName ?? "Imersão Comercial"}
            </div>
            <div className="mt-1 text-sm font-light text-white/70">Estratégia &amp; Performance</div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-7xl flex-grow flex-col justify-center px-6 py-12 md:px-12">
          <div className="space-y-12">
            <div className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="h-px w-10 bg-nl-gold" />
                <span className="text-[11px] font-light uppercase tracking-[0.45em] text-white/45">Newline</span>
              </div>
              <h1 className="text-3xl font-light leading-[1.05] tracking-tight md:text-5xl">
                Dados e tomada de <span className="text-nl-gold">decisão</span>
              </h1>
              <p className="max-w-xl text-base font-light text-white/55 md:text-lg">
                Suas áreas liberadas no PoolFlux.
              </p>
            </div>

            {access.loading ? (
              <p className="text-sm font-light text-white/50">Carregando áreas…</p>
            ) : sections.length === 0 ? (
              <p className="text-sm font-light text-white/50">
                Nenhuma área liberada para o seu usuário no momento.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sections.map((section) => (
                  <div
                    key={section.key}
                    className="group flex flex-col rounded-xl border border-white/10 bg-white/[0.04] p-8 backdrop-blur-md transition-all hover:border-nl-gold/40 hover:bg-white/[0.07]"
                  >
                    <div className="mb-8 flex items-start justify-between">
                      <ArrowRight className="h-5 w-auto text-nl-gold" strokeWidth={1.5} />
                    </div>
                    <h2 className="mb-6 text-3xl font-light leading-none tracking-tight text-white">
                      {section.title}
                    </h2>
                    <div className="mt-auto flex flex-col gap-2.5">
                      {section.links.map((link) => (
                        <Link
                          key={link.key}
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
            )}
          </div>
        </main>

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
