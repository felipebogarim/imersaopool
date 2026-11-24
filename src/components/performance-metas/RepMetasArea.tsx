import { useState } from "react";
import { BarChart3, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";
import { RepMetasBiPanel } from "./RepMetasBiPanel";
import { RepMetasLista } from "./RepMetasPortal";

type View = "carteira" | "bi";

/** Navegação de metas do representante: operação por cliente e visão consolidada. */
export function RepMetasArea() {
  const [view, setView] = useState<View>("carteira");

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap gap-2 border-b" role="tablist" aria-label="Visões de metas">
        <ViewTab
          active={view === "carteira"}
          icon={ListChecks}
          label="Carteira de metas"
          onClick={() => setView("carteira")}
        />
        <ViewTab
          active={view === "bi"}
          icon={BarChart3}
          label="BI Metas"
          onClick={() => setView("bi")}
        />
      </div>

      {view === "carteira" ? <RepMetasLista /> : <RepMetasBiPanel />}
    </section>
  );
}

function ViewTab({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof ListChecks;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
