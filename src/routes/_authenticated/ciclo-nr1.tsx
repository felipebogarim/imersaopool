import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/ciclo-nr1")({
  beforeLoad: () => {
    throw redirect({ to: "/gro/empresa/$section", params: { section: "panorama" }, replace: true });
  },
});
