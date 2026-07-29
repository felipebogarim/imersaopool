import { createFileRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/price")({
  head: () => ({
    meta: [
      { title: "Price — PoolFlux" },
      { name: "description", content: "Módulo Price: competidores, tabelas de preços e comparativos." },
    ],
  }),
  component: PriceLayout,
});

const TABS = [
  { to: "/price/competidores", label: "Competidores" },
  { to: "/price/tabelas", label: "Tabelas" },
  { to: "/price/comparativos", label: "Comparativos" },
] as const;

function PriceLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div>
      <PageHeader title="Price" subtitle="Competidores, tabelas de preços e comparativos" />
      <div className="px-4 sm:px-8 pt-4">
        <nav className="flex gap-1 border-b border-border">
          {TABS.map((t) => {
            const active = pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={cn(
                  "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="p-4 sm:p-8">
        <Outlet />
      </div>
    </div>
  );
}
