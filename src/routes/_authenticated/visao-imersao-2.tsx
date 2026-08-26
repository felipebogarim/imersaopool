import { createFileRoute } from "@tanstack/react-router";
import { VisaoImersao2Page } from "@/components/visao-imersao-2/VisaoImersao2Page";

export const Route = createFileRoute("/_authenticated/visao-imersao-2")({
  head: () => ({
    meta: [
      { title: "Visão Imersão 2 | PoolFlux" },
      {
        name: "description",
        content: "Nova arquitetura de relatórios executivos baseada em dados canônicos.",
      },
      { property: "og:title", content: "Visão Imersão 2 | PoolFlux" },
      { property: "og:description", content: "Relatórios executivos de imersão baseados em dados canônicos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => <VisaoImersao2Page />,
});
