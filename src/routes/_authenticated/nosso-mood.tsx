import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/nosso-mood")({
  beforeLoad: () => {
    throw redirect({
      to: "/gro/empresa/$section",
      params: { section: "nossa-cultura" },
      replace: true,
    });
  },
});
