import { createFileRoute } from "@tanstack/react-router";
import { RelatoriosExecutivosPage } from "@/components/executive-report/RelatoriosExecutivosPage";

export const Route = createFileRoute("/_authenticated/relatorios-executivos")({
  head: () => ({
    meta: [
      { title: "Relatórios Executivos | PoolFlux" },
      {
        name: "description",
        content: "Lista consolidada de relatórios executivos gerados a partir das imersões comerciais.",
      },
      { property: "og:title", content: "Relatórios Executivos | PoolFlux" },
      {
        property: "og:description",
        content: "Lista consolidada de relatórios executivos gerados a partir das imersões comerciais.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RelatoriosExecutivosPage,
});
