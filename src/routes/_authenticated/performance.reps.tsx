import { createFileRoute } from "@tanstack/react-router";
import { PerformancePageContent } from "./representantes.performance";

export const Route = createFileRoute("/_authenticated/performance/reps")({
  head: () => ({ meta: [{ title: "Performance Reps — PoolFlux" }] }),
  validateSearch: (search: Record<string, unknown>): { rep?: string; bi?: boolean } => ({
    rep: typeof search.rep === "string" ? search.rep : undefined,
    bi: search.bi === "1" || search.bi === true ? true : undefined,
  }),
  component: PerformanceRepsWrapper,
});

function PerformanceRepsWrapper() {
  return <PerformancePageContent />;
}
