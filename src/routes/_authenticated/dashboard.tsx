import { createFileRoute } from "@tanstack/react-router";
import { GuiaGerencial } from "@/components/guia/GuiaGerencial";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Guia de Uso Gerencial — PoolFlux" },
      {
        name: "description",
        content:
          "Trilha em 8 etapas para transformar informações comerciais em decisões, prioridades e ações no Imersão Comercial.",
      },
      { property: "og:title", content: "Guia de Uso Gerencial — PoolFlux" },
      {
        property: "og:description",
        content: "Siga a trilha gerencial: entrevistas, visão rep, performance, clientes, price, tarefas e ferramentas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuiaGerencial,
});
