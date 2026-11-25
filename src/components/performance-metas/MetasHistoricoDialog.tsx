// Botão discreto no rodapé do painel + diálogo com o histórico de metas do cliente:
// cada período (semestre ou mudança dentro dele) com a meta mensal por portfólio e o total.

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { fmtBRL, METAS_FAMILIES, METAS_FAMILY_LABEL } from "@/lib/performance-metas";
import { monthLabel } from "@/lib/performance-metas-persistence";
import { historicoPeriodos, type HistCycle } from "@/lib/performance-metas-historico";

const SITUACAO = {
  vigente: { label: "Vigente", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  futuro: { label: "Programada", cls: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  passado: { label: "Encerrada", cls: "bg-muted text-muted-foreground" },
} as const;

export function MetasHistoricoButton({
  repId,
  razaoSocial,
}: {
  repId: string | null;
  razaoSocial: string;
}) {
  const [open, setOpen] = useState(false);
  const clienteKey = razaoSocial.trim().toUpperCase();

  const { data, isLoading, error } = useQuery({
    queryKey: ["performance-metas", "historico", repId, clienteKey],
    enabled: open && !!repId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("performance_goal_cycles")
        .select(
          "id, inicio, fim, performance_goal_items(familia, vigente_desde, meta_mensal, origem)",
        )
        .eq("representative_id", repId as string)
        .eq("cliente_key", clienteKey)
        .order("inicio");
      if (error) throw new Error(error.message);
      const cycles: HistCycle[] = (data ?? []).map((c) => ({
        id: c.id,
        inicio: c.inicio,
        fim: c.fim,
        items: (c.performance_goal_items ?? []) as HistCycle["items"],
      }));
      return historicoPeriodos(cycles);
    },
  });

  if (!repId) return null;

  return (
    <>
      <div className="flex justify-center border-t border-border/50 pt-4">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <History className="h-3.5 w-3.5" />
          Ver histórico de metas
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-4 w-4" /> Histórico de metas
            </DialogTitle>
            <DialogDescription>
              {razaoSocial} · meta mensal por portfólio em cada período (semestres e mudanças dentro
              deles).
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando histórico…
            </div>
          ) : error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              {error instanceof Error ? error.message : "Não foi possível carregar o histórico."}
            </p>
          ) : !data || data.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma meta definida ainda para este cliente.
            </p>
          ) : (
            <div className="max-h-[60vh] overflow-auto rounded-md border border-border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-semibold">Período</th>
                    {METAS_FAMILIES.map((f) => (
                      <th key={f} className="px-2 py-2 text-right font-semibold">
                        {METAS_FAMILY_LABEL[f]}
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right font-semibold">Total/mês</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {data.map((p) => (
                    <tr
                      key={`${p.cicloId}-${p.inicio}`}
                      className={cn(p.situacao === "vigente" && "bg-emerald-500/5")}
                    >
                      <td className="whitespace-nowrap px-3 py-2">
                        <div className="font-semibold tabular-nums">
                          {p.inicio === p.fim
                            ? monthLabel(p.inicio)
                            : `${monthLabel(p.inicio)} – ${monthLabel(p.fim)}`}
                        </div>
                        <span
                          className={cn(
                            "mt-0.5 inline-block rounded px-1.5 py-0.5 text-[9px] font-bold",
                            SITUACAO[p.situacao].cls,
                          )}
                        >
                          {SITUACAO[p.situacao].label}
                        </span>
                      </td>
                      {METAS_FAMILIES.map((f) => (
                        <td key={f} className="px-2 py-2 text-right tabular-nums">
                          {p.metas[f] != null ? (
                            fmtBRL(p.metas[f])
                          ) : (
                            <span className="text-muted-foreground/50">—</span>
                          )}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right font-bold tabular-nums">
                        {fmtBRL(p.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
