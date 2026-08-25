import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

/** Abre o Relatório Executivo vinculado a este relatório da Visão Imersão 2. */
export function ExecutiveReportButton({ reportId }: { reportId?: string | null }) {
  const { data: status } = useQuery({
    queryKey: ["exec-status", reportId],
    enabled: !!reportId,
    queryFn: async () => {
      const { data } = await supabase
        .from("executive_reports")
        .select("status")
        .eq("immersion_report_id", reportId!)
        .maybeSingle();
      return data?.status ?? null;
    },
  });

  if (!reportId) return null;

  return (
    <Button
      variant="outline"
      onClick={() => window.open(`/visao-imersao-2/${reportId}/executivo`, "_blank", "noopener")}
    >
      <FileText className="mr-1 h-4 w-4" />
      Relatório Executivo
      {status && (
        <Badge variant={status === "closed" ? "default" : "secondary"} className="ml-2">
          {status === "closed" ? "Finalizado" : "Em revisão"}
        </Badge>
      )}
    </Button>
  );
}
