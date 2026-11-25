// Flag "Em investigação" (gestão): marcado quando foi aberto um processo de investigação mais
// detalhada sobre o cliente antes de definir a meta. Vale para o cliente (todos os portfólios),
// grava na hora e aparece como alerta na coluna de status da carteira de metas.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { getMetasInvestigacao, setMetasInvestigacao } from "@/lib/performance-metas.functions";

export const INVESTIGACAO_NOTA =
  "Aberto processo de investigação mais detalhada sobre o cliente antes de definir a meta.";

export function MetasInvestigacaoToggle({ rowId }: { rowId: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(getMetasInvestigacao);
  const setFn = useServerFn(setMetasInvestigacao);
  const key = ["performance-metas", "investigacao", rowId];

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => getFn({ data: { rowId } }),
    staleTime: 60_000,
  });

  const mut = useMutation({
    mutationFn: (ativo: boolean) => setFn({ data: { rowId, ativo } }),
    onSuccess: (res) => {
      if (!res.available) {
        toast.error("Recurso indisponível: aplique a migration de investigação no banco.");
        return;
      }
      qc.setQueryData(key, res);
      void qc.invalidateQueries({ queryKey: ["performance-metas", "investigacoes"] });
    },
    onError: (e) =>
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar a marcação."),
  });

  if (data && !data.available) return null;
  const ativo = mut.isPending ? mut.variables === true : data?.available && data.emInvestigacao;
  const id = `investigacao-${rowId}`;

  return (
    <div
      className={cn(
        "rounded-md border px-2.5 py-2 transition-colors",
        ativo ? "border-amber-300 bg-amber-500/10 dark:border-amber-700" : "border-border/70",
      )}
    >
      <label htmlFor={id} className="flex cursor-pointer items-center gap-2 text-sm font-medium">
        <Checkbox
          id={id}
          checked={!!ativo}
          disabled={isLoading || mut.isPending}
          onCheckedChange={(v) => mut.mutate(v === true)}
        />
        {ativo && <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />}
        Em investigação
        {(isLoading || mut.isPending) && (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        )}
      </label>
      <p className="mt-1 pl-6 text-[11px] leading-snug text-muted-foreground">
        {INVESTIGACAO_NOTA}
      </p>
    </div>
  );
}
