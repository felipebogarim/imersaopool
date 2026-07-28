import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BarChart2 } from "lucide-react";
import { ClientBISection } from "@/components/ClientBISection";
import { ClientFamiliasChart } from "@/components/ClientFamiliasChart";
import { catBadge } from "@/lib/performance-farol";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/clientes-bi/$repId/$razao")({
  head: () => ({ meta: [{ title: "BI do cliente — PoolFlux" }] }),
  component: ClientBIPage,
});

function ClientBIPage() {
  const { repId, razao } = Route.useParams();
  const navigate = useNavigate();
  const razaoSocial = useMemo(() => {
    try {
      return decodeURIComponent(razao);
    } catch {
      return razao;
    }
  }, [razao]);

  const { data: rep } = useQuery({
    queryKey: ["rep-info", repId],
    queryFn: async () =>
      (await supabase.from("representatives").select("id, nome, company_id").eq("id", repId).single()).data,
  });

  // Recupera categoria e famílias a partir da última planilha de performance ativa
  const { data: rowInfo } = useQuery({
    queryKey: ["client-row-info", repId, razaoSocial],
    enabled: !!repId && !!razaoSocial,
    queryFn: async () => {
      const { data: up } = await supabase
        .from("rep_performance_uploads")
        .select("id")
        .eq("representative_id", repId)
        .is("substituida_em", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!up?.id) return null;
      const { data: row } = await supabase
        .from("rep_performance_rows")
        .select("*")
        .eq("upload_id", up.id)
        .eq("razao_social", razaoSocial)
        .maybeSingle();
      return row ?? null;
    },
  });

  const familias = useMemo(
    () => (rowInfo ? Object.keys((rowInfo as any).metas ?? {}) : []),
    [rowInfo],
  );
  const [filterFams, setFilterFams] = useState<string[]>([]);

  return (
    <div>
      <PageHeader
        title={razaoSocial}
        actions={
          <div className="flex items-center gap-2">
            <Button asChild aria-label="Comparar dentro do perfil">
              <Link
                to="/clientes-bi/comparar/$repId/$razao"
                params={{ repId, razao }}
              >
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
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-4">
        <div className="surface rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="text-sm text-muted-foreground">Representante</div>
          <div className="font-medium">{rep?.nome ?? "—"}</div>
          {rowInfo?.categoria && (
            <span
              className={cn(
                "inline-flex px-2 py-0.5 rounded-full text-xs border",
                catBadge(rowInfo.categoria),
              )}
            >
              {rowInfo.categoria}
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

// keep import for Badge type usage (avoids tree-shake warning); noop
void Badge;
