// "Metas Mínimas" (gestão): valor mínimo de meta mensal por portfólio para cada categoria.
// Vira a base: meta do gestor abaixo do mínimo gera alerta e bloqueio no painel do cliente.

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { METAS_FAMILIES, METAS_FAMILY_LABEL } from "@/lib/performance-metas";
import { MINIMO_CATEGORIAS, minimoPara } from "@/lib/performance-metas-minimos";
import { saveMetasMinimos } from "@/lib/performance-metas.functions";
import { MINIMOS_QUERY_KEY, useMetasMinimos } from "./use-metas-minimos";

type Grade = Record<string, string>; // `${categoria}|${familia}` → texto do campo

const chave = (c: string, f: string) => `${c}|${f}`;

export function MinimosCategoriaButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Badge
        variant="outline"
        className="cursor-pointer gap-1 px-2.5 py-1 text-[10px] font-bold uppercase tracking-tight hover:bg-muted"
        onClick={() => setOpen(true)}
        title="Configurar a meta mínima por portfólio para cada categoria"
      >
        <ShieldCheck className="inline h-3 w-3" />
        Metas Mínimas
      </Badge>
      {open && <MinimosCategoriaDialog open={open} onOpenChange={setOpen} />}
    </>
  );
}

function MinimosCategoriaDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const saveFn = useServerFn(saveMetasMinimos);
  const { data, isLoading } = useMetasMinimos(open);
  const [grade, setGrade] = useState<Grade>({});

  useEffect(() => {
    if (!data?.available) return;
    const g: Grade = {};
    for (const c of MINIMO_CATEGORIAS)
      for (const f of METAS_FAMILIES) {
        const v = minimoPara(data.itens, c, f);
        g[chave(c, f)] = v != null ? String(v) : "";
      }
    setGrade(g);
  }, [data]);

  const mut = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          itens: MINIMO_CATEGORIAS.flatMap((c) =>
            METAS_FAMILIES.map((f) => {
              const t = (grade[chave(c, f)] ?? "").replace(/\./g, "").replace(",", ".").trim();
              const n = t === "" ? null : Number(t);
              return { categoria: c, familia: f, minimo: n != null && n >= 0 ? n : null };
            }),
          ).filter((i) => i.minimo != null),
        },
      }),
    onSuccess: (res) => {
      if (!res.available) {
        toast.error("Recurso indisponível: aplique a migration de mínimos no banco.");
        return;
      }
      qc.setQueryData(MINIMOS_QUERY_KEY, res);
      toast.success("Metas mínimas salvas.");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Metas Mínimas
          </DialogTitle>
          <DialogDescription>
            Meta mensal mínima (R$) por portfólio em cada categoria. Metas do gestor abaixo do
            mínimo ficam bloqueadas até serem ajustadas. Deixe em branco para não exigir mínimo.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        ) : data && !data.available ? (
          <p className="rounded-md border border-amber-300 bg-amber-500/10 p-3 text-sm">
            Recurso indisponível: aplique a migration{" "}
            <code>20261125200000_performance_goal_minimos.sql</code> no banco.
          </p>
        ) : (
          <div className="overflow-auto rounded-md border border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/60">
                <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-3 py-2 font-semibold">Categoria</th>
                  {METAS_FAMILIES.map((f) => (
                    <th key={f} className="px-2 py-2 text-center font-semibold">
                      {METAS_FAMILY_LABEL[f]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {MINIMO_CATEGORIAS.map((c) => (
                  <tr key={c}>
                    <td className="px-3 py-2 font-bold">{c}</td>
                    {METAS_FAMILIES.map((f) => (
                      <td key={f} className="px-1.5 py-1.5">
                        <div className="relative">
                          <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">
                            R$
                          </span>
                          <Input
                            inputMode="decimal"
                            value={grade[chave(c, f)] ?? ""}
                            onChange={(e) =>
                              setGrade((g) => ({
                                ...g,
                                [chave(c, f)]: e.target.value.replace(/[^\d.,]/g, ""),
                              }))
                            }
                            placeholder="—"
                            className="h-8 pl-7 text-right text-xs tabular-nums"
                            aria-label={`Mínimo ${c} · ${METAS_FAMILY_LABEL[f]}`}
                          />
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || isLoading || !data?.available}
          >
            {mut.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-1.5 h-4 w-4" />
            )}
            Salvar mínimos
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
