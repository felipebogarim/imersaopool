import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dossie")({
  beforeLoad: () => {
    throw redirect({
      to: "/gro/empresa/$section",
      params: { section: "relatorio-final" },
      replace: true,
    });
  },
});
