import { createFileRoute } from "@tanstack/react-router";
import { VisaoImersao2Page } from "@/components/visao-imersao-2/VisaoImersao2Page";

export const Route = createFileRoute("/_authenticated/visao-imersao-2_/$reportId/")({
  head: () => ({
    meta: [
      { title: "Análise da Imersão em Campo | PoolFlux" },
      {
        name: "description",
        content: "Endereço próprio da análise executiva desta imersão em campo por cliente.",
      },
      { property: "og:title", content: "Análise da Imersão em Campo | PoolFlux" },
      {
        property: "og:description",
        content: "Endereço próprio da análise executiva desta imersão em campo por cliente.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VisaoImersao2ReportRoute,
});

function VisaoImersao2ReportRoute() {
  const { reportId } = Route.useParams();
  return <VisaoImersao2Page reportId={reportId} />;
}
