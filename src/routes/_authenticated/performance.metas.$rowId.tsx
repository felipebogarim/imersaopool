import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { MetasPainel, type MetasClienteInfo } from "@/components/performance-metas/MetasPainel";
import { useMetasViewer } from "@/components/performance-metas/use-metas-viewer";
import { getMetasGoals } from "@/lib/performance-metas.functions";

export const Route = createFileRoute("/_authenticated/performance/metas/$rowId")({
  head: () => ({ meta: [{ title: "Metas do cliente — PoolFlux" }] }),
  component: MetasClientePage,
});

function MetasClientePage() {
  const { rowId } = Route.useParams();
  const viewer = useMetasViewer();
  const [previewRep, setPreviewRep] = useState(false);

  const { data: cliente, isLoading } = useQuery({
    queryKey: ["performance-metas", "cliente", rowId],
    queryFn: async (): Promise<MetasClienteInfo | null> => {
      const { data: row } = await supabase
        .from("rep_performance_rows")
        .select("id, upload_id, razao_social, categoria, total_pct, familia_pct")
        .eq("id", rowId)
        .maybeSingle();
      if (!row) return null;
      const { data: upload } = await supabase
        .from("rep_performance_uploads")
        .select("representative_id, periodo_label")
        .eq("id", row.upload_id)
        .maybeSingle();
      let repName = "—";
      if (upload?.representative_id) {
        const { data: rep } = await supabase
          .from("representatives")
          .select("nome")
          .eq("id", upload.representative_id)
          .maybeSingle();
        repName = rep?.nome ?? "—";
      }
      return {
        razaoSocial: row.razao_social,
        categoria: row.categoria,
        repId: upload?.representative_id ?? null,
        repName,
        periodoLabel: upload?.periodo_label ?? null,
        totalPct: row.total_pct,
        familiaPct: (row.familia_pct ?? {}) as Record<string, number | null>,
      };
    },
  });

  const isGestor = viewer.role === "gestor";
  // Metas gravadas (gestão). Sem a migration aplicada → { available: false } (simulação local).
  const { data: persisted, isLoading: loadingGoals } = useQuery({
    queryKey: ["performance-metas", "goals", rowId],
    enabled: !viewer.loading && isGestor,
    staleTime: Infinity,
    queryFn: () => getMetasGoals({ data: { rowId } }),
  });
  const role = isGestor && !previewRep ? "gestor" : "representante";
  const forbidden =
    !viewer.loading &&
    !isGestor &&
    cliente != null &&
    !(cliente.repId && viewer.repIds.includes(cliente.repId));

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title={cliente?.razaoSocial ?? "Metas do cliente"}
        subtitle={
          cliente
            ? `${cliente.repName} · ${cliente.categoria ?? "Sem categoria"} · Metas mensais`
            : undefined
        }
      />
      <div className="p-3 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-4">
        <Link
          to="/performance/metas"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Voltar para a carteira
        </Link>

        {isLoading || viewer.loading || (isGestor && loadingGoals) ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : !cliente ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Cliente não encontrado.</p>
        ) : forbidden ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Este cliente não pertence à sua carteira.
          </p>
        ) : (
          <MetasPainel
            rowId={rowId}
            persisted={persisted ?? { available: false }}
            cliente={cliente}
            role={role}
            canPreview={isGestor}
            previewRep={previewRep}
            onPreviewChange={setPreviewRep}
          />
        )}
      </div>
    </div>
  );
}
