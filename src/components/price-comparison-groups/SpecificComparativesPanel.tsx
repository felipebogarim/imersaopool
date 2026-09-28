// Painel lateral recolhível de "Comparativos Específicos salvos" (item 17),
// usado dentro da tela de Validação de Comparáveis. Preferência de
// recolhido/expandido é mantida só durante a sessão (sessionStorage).
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComparativeCard } from "./ComparativeCard";
import type { ComparisonGroup } from "@/lib/price-comparison-groups";

const STORAGE_KEY = "price-comparison-groups:panel-expanded";

export function SpecificComparativesPanel({
  groups,
  itemCounts,
  onOpen,
  onEdit,
  onDuplicate,
  onSubstitute,
  onReport,
  onSaveOfficial,
  onRename,
  onDelete,
  canManage,
}: {
  groups: ComparisonGroup[];
  itemCounts: Record<string, number>;
  onOpen: (g: ComparisonGroup) => void;
  onEdit: (g: ComparisonGroup) => void;
  onDuplicate: (g: ComparisonGroup) => void;
  onSubstitute: (g: ComparisonGroup) => void;
  onReport: (g: ComparisonGroup) => void;
  onSaveOfficial: (g: ComparisonGroup) => void;
  onRename: (g: ComparisonGroup) => void;
  onDelete: (g: ComparisonGroup) => void;
  canManage: boolean;
}) {
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved != null) setExpanded(saved === "1");
    } catch {
      /* sessionStorage indisponível — mantém padrão expandido */
    }
  }, []);

  const toggle = () => {
    setExpanded((prev) => {
      const next = !prev;
      try {
        sessionStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* ignorar */
      }
      return next;
    });
  };

  if (!expanded) {
    return (
      <div className="w-10 shrink-0 rounded-xl border bg-card flex flex-col items-center py-3 gap-2">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggle} title="Expandir">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-[10px] text-muted-foreground [writing-mode:vertical-rl]">
          Estudos ({groups.length})
        </span>
      </div>
    );
  }

  return (
    <div className="w-full lg:w-72 shrink-0 rounded-xl border bg-card p-3 space-y-3 max-h-[80vh] overflow-y-auto">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Comparativos específicos salvos
        </p>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={toggle} title="Recolher">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      {groups.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhum estudo salvo ainda.</p>
      )}
      <div className="space-y-2">
        {groups.map((g) => (
          <ComparativeCard
            key={g.id}
            group={g}
            itemCount={itemCounts[g.id] ?? 0}
            onOpen={() => onOpen(g)}
            onEdit={() => onEdit(g)}
            onDuplicate={() => onDuplicate(g)}
            onSubstitute={() => onSubstitute(g)}
            onReport={() => onReport(g)}
            onSaveOfficial={() => onSaveOfficial(g)}
            onRename={() => onRename(g)}
            onDelete={() => onDelete(g)}
            canManage={canManage}
          />
        ))}
      </div>
    </div>
  );
}
