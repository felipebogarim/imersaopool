import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/price/")({
  beforeLoad: () => {
    throw redirect({ to: "/price/competidores" });
  },
});
