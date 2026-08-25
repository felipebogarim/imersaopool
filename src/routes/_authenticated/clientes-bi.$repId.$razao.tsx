import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BarChart2, FileDown, RefreshCw } from "lucide-react";
import { ClientBISection } from "@/components/ClientBISection";
import { ClientFamiliasChart } from "@/components/ClientFamiliasChart";
import { catBadge } from "@/lib/performance-farol";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { exportClientBIPdf } from "@/lib/client-bi-pdf";
import { useClientBI, useRecalcBI } from "@/lib/use-performance-bi";
import { toLegacyClientBIData } from "@/lib/performance-bi-engine";

export const Route = createFileRoute("/_authenticated/clientes-bi/$repId/$razao")({
  head: () => ({
    meta: [
      { title: "BI do cliente — PoolFlux" },
      {
        name: "description",
        content:
          "BI do cliente calculado diretamente da versão ativa de Performance: atingimento real, farol e participação por família.",
      },
      { property: "og:title", content: "BI do cliente — PoolFlux" },
      {
        property: "og:description",
        content: "Indicadores do cliente derivados da Performance ativa.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClientBIPage,
});

function ClientBIPage() {
  const { repId, razao } = Route.useParams();
  const razaoSocial = useMemo(() => {
    try {
      return decodeURIComponent(razao);
    } catch {
      return razao;
    }
  }, [razao]);

  const recalc = useRecalcBI();

  const { data: rep } = useQuery({
    queryKey: ["rep-info", repId],
    queryFn: async () =>
      (await supabase.from("representatives").select("id, nome, company_id").eq("id", repId).single())
        .data,
  });

  const { data: bi = null } = useClientBI(repId, razaoSocial);

  function exportarRelatorio() {
    if (!bi) {
      toast.error("Sem dados de Performance", {
        description: "Importe a Performance deste representante para gerar o BI.",
      });
      return;
    }
    try {
      exportClientBIPdf({
        razaoSocial,
        representante: rep?.nome ?? null,
        categoria: bi.categoria ?? null,
        data: toLegacyClientBIData(bi) as any,
      });
      toast.success("Relatório visual gerado");
    } catch (e: any) {
      toast.error("Falha ao gerar o relatório", { description: e?.message ?? String(e) });
    }
  }

  const familias = useMemo(() => (bi?.familias ?? []).map((f) => f.familia), [bi]);
  const [filterFams, setFilterFams] = useState<string[]>([]);

  return (
    <div>
      <PageHeader
        title={razaoSocial}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                recalc();
                toast.success("BI recalculado a partir da Performance ativa");
              }}
              aria-label="Atualizar BI"
            >
              <RefreshCw className="h-4 w-4 mr-1" /> Atualizar BI
            </Button>
            <Button variant="outline" onClick={exportarRelatorio} aria-label="Exportar relatório visual">
              <FileDown className="h-4 w-4 mr-1" /> Exportar relatório
            </Button>
            <Button asChild aria-label="Comparar dentro do perfil">
              <Link to="/clientes-bi/comparar/$repId/$razao" params={{ repId, razao }}>
                <BarChart2 className="h-4 w-4 mr-1" /> Comparar dentro do perfil
              </Link>
            </Button>
            <Button variant="ghost" asChild>
              <Link to="/representantes/performance">
                <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
              </Link>
            </Button>
          </div>
        }
      />
      <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-4">
        <div className="surface rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="text-sm text-muted-foreground">Representante</div>
          <div className="font-medium">{rep?.nome ?? "—"}</div>
          {bi?.categoria && (
            <span
              className={cn("inline-flex px-2 py-0.5 rounded-full text-xs border", catBadge(bi.categoria))}
            >
              {bi.categoria}
            </span>
          )}
          {bi && (
            <span className="text-[11px] text-muted-foreground">
              Versão da Performance: {bi.periodo_label ?? bi.performance_version_id.slice(0, 8)} ·
              metodologia {bi.calculation_version}
            </span>
          )}
        </div>

        <ClientBISection repId={repId} razaoSocial={razaoSocial} companyId={rep?.company_id ?? null} />

        {familias.length > 0 && (
          <div className="surface rounded-xl px-4 py-3 flex flex-wrap items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-muted-foreground mr-1">
              Filtrar famílias:
            </span>
            <button
              type="button"
              onClick={() => setFilterFams([])}
              className={cn(
                "text-xs px-2 py-0.5 rounded-full border",
                filterFams.length === 0
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted text-muted-foreground border-border",
              )}
            >
              Todas
            </button>
            {familias.map((f) => {
              const active = filterFams.includes(f);
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() =>
                    setFilterFams((cur) =>
                      cur.includes(f) ? cur.filter((x) => x !== f) : [...cur, f],
                    )
                  }
                  className={cn(
                    "text-xs px-2 py-0.5 rounded-full border transition",
                    active
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-muted-foreground border-border hover:bg-muted/70",
                  )}
                >
                  {f}
                </button>
              );
            })}
          </div>
        )}

        <ClientFamiliasChart
          repId={repId}
          razaoSocial={razaoSocial}
          companyId={rep?.company_id ?? null}
          filterFams={filterFams}
        />
      </div>
    </div>
  );
}
