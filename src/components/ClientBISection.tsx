import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClientBIData } from "@/lib/client-bi-parser";
import { FAROL_CELL_CLASS, FAROL_LABEL, FAROL_ORDER, catBadge, type FarolStatus } from "@/lib/performance-farol";

const fmtPct = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(n)) return "—";
  const v = Math.abs(n) <= 1.5 ? n * 100 : n;
  return `${v.toFixed(1).replace(".", ",")}%`;
};

const farolKey = (grupo: string | null | undefined): FarolStatus | null => {
  if (!grupo) return null;
  const g = grupo.toLowerCase();
  const found = FAROL_ORDER.find((k) => FAROL_LABEL[k].toLowerCase() === g);
  return (found as FarolStatus) ?? null;
};

export function ClientBISection({
  repId,
  razaoSocial,
}: {
  repId: string;
  razaoSocial: string;
  companyId: string | null;
}) {
  const { data: bi = null, isLoading } = useQuery({
    queryKey: ["client-bi", repId, razaoSocial],
    enabled: !!repId && !!razaoSocial,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("client_bi_uploads")
        .select("*")
        .eq("representative_id", repId)
        .eq("razao_social", razaoSocial)
        .eq("kind", "bi")
        .is("substituida_em", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
  });

  const d: ClientBIData | null = (bi?.data as ClientBIData) ?? null;

  const famsSorted = useMemo(
    () => (d?.familias ?? []).slice().sort((a, b) => (b.atingimento ?? -1) - (a.atingimento ?? -1)),
    [d],
  );
  const farolSorted = useMemo(
    () =>
      (d?.distribuicao_farol ?? [])
        .slice()
        .sort(
          (a, b) =>
            (FAROL_ORDER.indexOf(farolKey(a.grupo) as FarolStatus) + 999) -
            (FAROL_ORDER.indexOf(farolKey(b.grupo) as FarolStatus) + 999),
        ),
    [d],
  );

  return (
    <div className="surface rounded-xl overflow-hidden">
      <div className="w-full px-4 py-3 border-b border-border flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          BI do cliente
        </p>
        {d?.geral != null && (
          <span className="ml-2 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            Atingimento geral: <strong className="tabular-nums">{fmtPct(d.geral)}</strong>
          </span>
        )}
      </div>

      <div className="p-4 space-y-6">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : !d ? (
          <div className="text-sm text-muted-foreground">
            Nenhuma planilha de BI carregada para este cliente. Carregue as planilhas no botão{" "}
            <strong>BI dos clientes</strong> na página de Performance.
          </div>
        ) : (
          <>
            {/* Destaques */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="rounded-xl border border-border p-4 bg-primary/5">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Atingimento geral
                </div>
                <div className="mt-1 text-3xl font-semibold tabular-nums">{fmtPct(d.geral)}</div>
              </div>
              <div className="rounded-xl border border-border p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Categoria do cliente
                </div>
                <div className="mt-2">
                  <span
                    className={cn(
                      "inline-flex px-2 py-0.5 rounded-full text-xs border",
                      catBadge(d.categoria ?? ""),
                    )}
                  >
                    {d.categoria ?? "—"}
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-border p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Melhor família
                </div>
                <div className="mt-1 text-sm truncate">{d.melhor_familia.label ?? "—"}</div>
                <div className="text-lg font-semibold tabular-nums">
                  {fmtPct(d.melhor_familia.atingimento)}
                </div>
              </div>
              <div className="rounded-xl border border-border p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Pior família
                </div>
                <div className="mt-1 text-sm truncate">{d.pior_familia.label ?? "—"}</div>
                <div className="text-lg font-semibold tabular-nums">
                  {fmtPct(d.pior_familia.atingimento)}
                </div>
              </div>
            </div>

            {/* Participação das famílias no resultado (atingimento por família) */}
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Participação das famílias no resultado do cliente
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {famsSorted.map((f) => {
                  const k = farolKey(f.farol);
                  return (
                    <div key={f.familia} className="rounded-xl border border-border p-4">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs border bg-muted text-muted-foreground border-border truncate">
                          {f.familia}
                        </span>
                        {k && (
                          <span
                            className={cn(
                              "inline-flex px-2 py-0.5 rounded text-[10px] border",
                              FAROL_CELL_CLASS[k],
                            )}
                          >
                            {FAROL_LABEL[k]}
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-2xl font-semibold tabular-nums">
                        {fmtPct(f.atingimento)}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">Atingimento</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Distribuição do farol */}
            {farolSorted.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                  Distribuição dos grupos do farol
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                  {farolSorted.map((f) => {
                    const k = farolKey(f.grupo);
                    return (
                      <div
                        key={f.grupo}
                        className={cn(
                          "rounded-xl p-3 border border-border/60 flex flex-col gap-1",
                          k && FAROL_CELL_CLASS[k],
                        )}
                      >
                        <div className="text-[11px] uppercase tracking-wider opacity-80">
                          {f.grupo}
                        </div>
                        <div className="text-xl font-semibold tabular-nums">{f.quantidade}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
