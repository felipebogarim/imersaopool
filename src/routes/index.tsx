import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BarChart3, Brain, Users } from "lucide-react";
import { BrandLogo } from "@/components/Brand";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PoolFlux Imersões Comerciais" },
      { name: "description", content: "Prepare, conduza e analise imersões comerciais com diagnóstico estratégico gerado por IA." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border/40 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto flex items-center justify-between px-6 py-4">
          <BrandLogo />
          <nav className="flex items-center gap-3">
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground">Entrar</Link>
            <Link
              to="/auth"
              className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground glow-cyan hover:opacity-90"
            >
              Acessar plataforma <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-6">
        <section className="py-24 md:py-32 max-w-4xl">
          <span className="inline-block text-xs font-medium tracking-widest text-cyan uppercase mb-6">
            Imersão Comercial Pool
          </span>
          <h1 className="text-5xl md:text-7xl font-bold leading-[1.05] tracking-tight">
            Transforme visitas comerciais em <span className="text-cyan">diagnóstico estratégico</span>.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-2xl">
            Reúna histórico, visão do representante, registros de campo e comparativo de preços.
            A IA cruza tudo e entrega oportunidades, ameaças e plano de ação.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground glow-cyan hover:opacity-90"
            >
              Começar agora <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3 pb-24">
          {[
            { icon: Users, title: "Visão do representante", desc: "Link seguro para o representante preencher percepções por texto, áudio e anexos." },
            { icon: Brain, title: "Diagnóstico com IA", desc: "Cruzamento de histórico, campo e preços competitivos para gerar plano de ação." },
            { icon: BarChart3, title: "BI consolidado", desc: "Indicadores por grupo, categoria, status, oportunidades e ameaças identificadas." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="surface rounded-2xl p-6">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-cyan mb-4">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-semibold mb-2">{title}</h3>
              <p className="text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
