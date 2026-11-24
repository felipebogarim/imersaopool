// Portal do representante → metas de um cliente da própria carteira.
// Mostra meta oficial, atingimento (com a origem quando não é venda realizada) e a sugestão
// do representante; nunca meta padrão, comentário do gestor ou sugestões da IA.

import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Loader2, Save, Target } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FAROL_CELL_CLASS, statusFromRatio } from "@/lib/performance-farol";
import type { CanonicalFamily } from "@/lib/client-bi-familias";
import {
  BASE_FONTE_LABEL,
  METAS_FAMILIES,
  METAS_FAMILY_LABEL,
  fmtBRL,
  fmtPct,
  parseMetaInput,
} from "@/lib/performance-metas";
import { cycleInfo, type RepGoalsView } from "@/lib/performance-metas-persistence";
import {
  repGetMetasGoals,
  repListMetas,
  repSaveMetasSuggestions,
} from "@/lib/performance-metas.functions";

type Sugestao = { valor: number | null; justificativa: string };
type Sugestoes = Record<CanonicalFamily, Sugestao>;

const fromView = (v: RepGoalsView | null): Sugestoes =>
  Object.fromEntries(
    METAS_FAMILIES.map((f) => {
      const s = v?.rep_suggestions.find((x) => x.familia === f);
      return [f, { valor: s?.valor ?? null, justificativa: s?.justificativa ?? "" }];
    }),
  ) as Sugestoes;

export function RepMetasCliente({ rowId }: { rowId: string }) {
  const qc = useQueryClient();
  const getFn = useServerFn(repGetMetasGoals);
  const saveFn = useServerFn(repSaveMetasSuggestions);
  const { data, isLoading, error } = useQuery({
    queryKey: ["rep-metas", rowId],
    queryFn: () => getFn({ data: { rowId } }),
  });
  const view = data?.available ? data.view : null;
  const [salvo, setSalvo] = useState<Sugestoes>(() => fromView(null));
  const [edit, setEdit] = useState<Sugestoes>(() => fromView(null));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!view) return;
    setSalvo(fromView(view));
    setEdit(fromView(view));
  }, [view]);

  const alterados = useMemo(
    () =>
      METAS_FAMILIES.filter(
        (f) => edit[f].valor !== salvo[f].valor || edit[f].justificativa !== salvo[f].justificativa,
      ),
    [edit, salvo],
  );

  async function salvar() {
    setSaving(true);
    try {
      const res = await saveFn({
        data: {
          rowId,
          sugestoes: alterados.map((f) => ({
            familia: f,
            valor: edit[f].valor,
            justificativa: edit[f].justificativa,
          })),
        },
      });
      if (!res.available) throw new Error("Persistência das metas indisponível.");
      qc.setQueryData(["rep-metas", rowId], {
        available: true,
        view: { ...res.view, cliente: view?.cliente },
      });
      toast.success("Sugestões enviadas ao gestor.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  const ciclo = view?.cycle ? cycleInfo(view.cycle) : null;

  return (
    <div className="space-y-4">
      <Link
        to="/portal-rep"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar ao portal
      </Link>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {error && (
        <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          {error instanceof Error ? error.message : "Não foi possível carregar as metas."}
        </p>
      )}
      {data && !data.available && (
        <p className="rounded-md border bg-background p-4 text-sm text-muted-foreground">
          As metas deste cliente ainda não estão disponíveis.
        </p>
      )}

      {view && (
        <div className="rounded-xl border bg-background shadow-sm">
          <div className="border-b px-5 py-4">
            <h2 className="text-lg font-semibold">{view.cliente || "Cliente"}</h2>
            <p className="text-xs text-muted-foreground">
              {ciclo ? `Ciclo ${ciclo.label} · ${ciclo.meses} meses` : "Ciclo ainda não iniciado"}
              {" · "}metas mensais por portfólio
            </p>
          </div>

          <div className="divide-y">
            {METAS_FAMILIES.map((f) => {
              const item = view.items.find((i) => i.familia === f);
              const at = view.atingimento[f];
              const status = statusFromRatio(at?.ratio ?? null);
              return (
                <div key={f} className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_1.4fr]">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold">{METAS_FAMILY_LABEL[f]}</p>
                    <p className="text-xs text-muted-foreground">
                      Meta oficial:{" "}
                      <span className="font-medium text-foreground tabular-nums">
                        {fmtBRL(item?.meta_mensal ?? null)}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Atingimento:{" "}
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 font-medium tabular-nums",
                          status && FAROL_CELL_CLASS[status],
                        )}
                      >
                        {fmtPct(at?.ratio ?? null)}
                      </span>
                      {at && at.fonte !== "realizado" && (
                        <span className="ml-1">· {BASE_FONTE_LABEL[at.fonte].toLowerCase()}</span>
                      )}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        R$
                      </span>
                      <Input
                        type="number"
                        min={0}
                        step={50}
                        placeholder="Sua sugestão de meta mensal"
                        value={edit[f].valor ?? ""}
                        onChange={(e) =>
                          setEdit((p) => ({
                            ...p,
                            [f]: { ...p[f], valor: parseMetaInput(e.target.value) },
                          }))
                        }
                        className="pl-9 tabular-nums"
                      />
                    </div>
                    <Textarea
                      placeholder="Justificativa"
                      value={edit[f].justificativa}
                      maxLength={4000}
                      onChange={(e) =>
                        setEdit((p) => ({ ...p, [f]: { ...p[f], justificativa: e.target.value } }))
                      }
                      className="min-h-[60px] text-sm"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-3 border-t px-5 py-3">
            <span className="text-xs text-muted-foreground">
              {alterados.length > 0
                ? `${alterados.length} portfólio(s) alterado(s)`
                : "Sugestões em dia"}
            </span>
            <Button size="sm" onClick={() => void salvar()} disabled={saving || !alterados.length}>
              {saving ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-4 w-4" />
              )}
              Enviar sugestões
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Lista de clientes com metas para revisar (página inicial do portal). */
export function RepMetasLista() {
  const listFn = useServerFn(repListMetas);
  const { data } = useQuery({ queryKey: ["rep-metas-lista"], queryFn: () => listFn() });
  if (!data?.length) return null;
  return (
    <div className="rounded-lg border bg-background p-4">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
        <Target className="h-4 w-4" /> Metas para revisar
      </p>
      <ul className="space-y-1">
        {data.map((r) => (
          <li key={r.rowId}>
            <Link
              to="/portal-rep/metas/$rowId"
              params={{ rowId: r.rowId }}
              className="text-sm text-primary hover:underline"
            >
              {r.cliente}
            </Link>
            {r.periodo && <span className="ml-2 text-xs text-muted-foreground">{r.periodo}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
