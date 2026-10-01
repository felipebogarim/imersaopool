import { createFileRoute } from "@tanstack/react-router";
import { GroWorkspace } from "@/components/gro/GroWorkspace";

export const Route = createFileRoute("/_authenticated/gro/empresa/$section")({
  head: () => ({ meta: [{ title: "GRO NR1 — PoolFlux" }] }),
  component: GroCompanyWorkspaceRoute,
});

function GroCompanyWorkspaceRoute() {
  const { section } = Route.useParams();
  return <GroWorkspace section={section} />;
}
