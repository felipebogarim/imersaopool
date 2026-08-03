import { createFileRoute, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, ExternalLink } from "lucide-react";
import { ManualContentSchema, type ManualContent } from "@/lib/manual-schema";
import { getManualPdfUrl } from "@/lib/manual-public.functions";

type LoaderData = {
  slug: string;
  titulo: string;
  descricao: string;
  tipo: string;
  conteudo: ManualContent;
  temPdf: boolean;
};

export const Route = createFileRoute("/m/$slug")({
  ssr: false,
  loader: async ({ params }): Promise<LoaderData> => {
    const { data, error } = await supabase
      .from("manuais")
      .select("slug, titulo, descricao, tipo, conteudo, pdf_path, publicado")
      .eq("slug", params.slug)
      .eq("publicado", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw notFound();
    const parsed = ManualContentSchema.safeParse(data.conteudo ?? {});
    return {
      slug: data.slug,
      titulo: data.titulo,
      descricao: data.descricao ?? "",
      tipo: data.tipo,
      conteudo: parsed.success ? parsed.data : ManualContentSchema.parse({}),
      temPdf: !!data.pdf_path,
    };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.titulo} — Manual PoolFlux` : "Manual — PoolFlux" },
      { name: "description", content: loaderData?.descricao || "Manual de uso da plataforma PoolFlux." },
      { property: "og:title", content: loaderData ? `${loaderData.titulo} — Manual PoolFlux` : "Manual" },
      { property: "og:description", content: loaderData?.descricao || "Manual de uso da plataforma PoolFlux." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: () => <Shell><p className="text-muted-foreground">Não foi possível carregar este manual.</p></Shell>,
  notFoundComponent: () => <Shell><p className="text-muted-foreground">Manual não encontrado.</p></Shell>,
  component: ManualPublico,
});

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b py-4">
        <div className="max-w-3xl mx-auto px-4">
          <p className="text-sm font-semibold tracking-tight">PoolFlux · Manuais</p>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-10">{children}</main>
    </div>
  );
}

function ManualPublico() {
  const m = Route.useLoaderData();
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!m.temPdf) return;
    getManualPdfUrl({ data: { slug: m.slug } })
      .then(r => setPdfUrl(r.url))
      .catch(() => setPdfUrl(null));
  }, [m.slug, m.temPdf]);

  const c: ManualContent = m.conteudo as ManualContent;

  return (
    <Shell>
      <article className="space-y-8">
        <header className="space-y-3">
          <Badge variant="secondary">Manual</Badge>
          <h1 className="text-3xl font-semibold tracking-tight">{m.titulo}</h1>
          {c.subtitulo ? <p className="text-lg text-muted-foreground">{c.subtitulo}</p> : null}
          {m.descricao ? <p className="text-muted-foreground">{m.descricao}</p> : null}
          {pdfUrl ? (
            <Button asChild>
              <a href={pdfUrl} target="_blank" rel="noreferrer">
                <FileText className="mr-2 h-4 w-4" /> Abrir manual em PDF
              </a>
            </Button>
          ) : null}
        </header>

        {c.resumo ? (
          <Card>
            <CardContent className="pt-6 space-y-2">
              <h2 className="text-sm font-medium uppercase text-muted-foreground">Resumo</h2>
              <p className="leading-relaxed">{c.resumo}</p>
              {c.publico_alvo ? (
                <p className="text-sm text-muted-foreground">Para quem: {c.publico_alvo}</p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {c.pre_requisitos.length ? (
          <section className="space-y-2">
            <h2 className="text-xl font-semibold">Antes de começar</h2>
            <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
              {c.pre_requisitos.map((p, i) => <li key={i}>{p}</li>)}
            </ul>
          </section>
        ) : null}

        {c.secoes.map((s, i) => (
          <section key={i} className="space-y-3">
            <h2 className="text-xl font-semibold">{s.titulo || `Etapa ${i + 1}`}</h2>
            {s.texto ? <p className="leading-relaxed">{s.texto}</p> : null}
            {s.passos.length ? (
              <ol className="list-decimal pl-5 space-y-1">{s.passos.map((p, j) => <li key={j}>{p}</li>)}</ol>
            ) : null}
            {s.dicas.length ? (
              <div className="rounded-lg border bg-muted/40 p-4 space-y-1">
                <p className="text-sm font-medium">Dicas</p>
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  {s.dicas.map((d, j) => <li key={j}>{d}</li>)}
                </ul>
              </div>
            ) : null}
          </section>
        ))}

        {c.faq.length ? (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Perguntas frequentes</h2>
            {c.faq.map((f, i) => (
              <div key={i} className="space-y-1">
                <p className="font-medium">{f.pergunta}</p>
                <p className="text-muted-foreground">{f.resposta}</p>
              </div>
            ))}
          </section>
        ) : null}

        {!c.secoes.length && !c.resumo && m.temPdf ? (
          <p className="text-muted-foreground">
            Este manual está disponível em PDF. <ExternalLink className="inline h-3 w-3" />
          </p>
        ) : null}
      </article>
    </Shell>
  );
}
