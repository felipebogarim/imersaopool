import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Printer } from "lucide-react";
import { BrandLogo } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { ImportedReportView } from "@/components/general-report/ImportedReportView";
import type { ImportedReport } from "@/lib/general-report-import";
import { PublicImageUrls, ReportView } from "@/components/general-report/ReportView";
import { getPublicGeneralReport } from "@/lib/general-report.functions";

const SITE = "https://poolflux.app";

export const Route = createFileRoute("/relatorio/$token")({
  head: ({ params }) => {
    const title = "Relatório de Performance Comercial | PoolFlux";
    const description = "Veja o relatório online, com gráficos e quadros.";
    const image = `${SITE}/api/og-relatorio/${String((params as { token?: string })?.token ?? "")}.png`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "noindex, nofollow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:image", content: image },
        { property: "og:image:secure_url", content: image },
        { property: "og:image:type", content: "image/png" },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:image", content: image },
      ],
    };
  },
  component: PublicGeneralReport,
});

function PublicGeneralReport() {
  const { token } = Route.useParams();
  const load = useServerFn(getPublicGeneralReport);
  const { data, isLoading, error } = useQuery({
    queryKey: ["public-general-report", token],
    retry: false,
    queryFn: () => load({ data: { token } }),
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-8">
          <BrandLogo className="h-8" />
          {data && (
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-1 h-4 w-4" />
              Imprimir / PDF
            </Button>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-8">
        {isLoading && <p className="text-sm text-muted-foreground">Carregando relatório…</p>}
        {error && (
          <div className="rounded-lg border border-border p-6 text-sm">
            <p className="font-medium">Relatório indisponível</p>
            <p className="text-muted-foreground">
              O link é inválido ou foi desativado. Peça um novo link a quem compartilhou.
            </p>
          </div>
        )}
        {data && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {data.rep ? `${data.rep} · ` : ""}
              {new Date(`${data.report_date}T12:00:00`).toLocaleDateString("pt-BR")}
            </p>
            <PublicImageUrls.Provider value={data.imageUrls}>
              {data.imported ? (
                <ImportedReportView report={data.imported as ImportedReport} />
              ) : (
                <ReportView report={data.report} />
              )}
            </PublicImageUrls.Provider>
          </div>
        )}
      </main>
    </div>
  );
}
