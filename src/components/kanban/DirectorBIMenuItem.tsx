import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { setDirectorBIVisibility } from "@/lib/director-bi-data";
import type { KCard } from "@/lib/kanban-types";

export function DirectorBIMenuItem({ card }: { card: Pick<KCard, "id" | "metadata"> }) {
  const qc = useQueryClient();
  const selected = card.metadata?.show_in_director_bi === true;
  const mutation = useMutation({
    mutationFn: () => setDirectorBIVisibility(card.id, !selected),
    onSuccess: async () => {
      await Promise.all(
        ["director-bi", "kanban-cards", "kanban-cards-resumo", "acoes-rep", "acoes-cliente"].map(
          (key) => qc.invalidateQueries({ queryKey: [key] }),
        ),
      );
      toast.success(
        selected ? "Ação removida do BI Diretor" : "Ação selecionada para o BI Diretor",
      );
    },
    onError: (error) => toast.error(error.message),
  });

  return (
    <DropdownMenuItem disabled={mutation.isPending} onSelect={() => mutation.mutate()}>
      <BarChart3 className="mr-2 h-4 w-4" />
      {selected ? "Remover do BI Diretor" : "Mostrar no BI Diretor"}
    </DropdownMenuItem>
  );
}
