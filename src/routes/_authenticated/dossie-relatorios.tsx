import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dossie-relatorios")({
  beforeLoad: () => {
    throw redirect({
      to: "/gro/empresa/$section",
      params: { section: "relatorio-final" },
      replace: true,
    });
  },
});
