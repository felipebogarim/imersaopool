import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Abre o Relatório Executivo vinculado a este relatório da Visão Imersão 2. */
export function ExecutiveReportButton({ reportId }: { reportId?: string | null }) {
  if (!reportId) return null;

  return (
    <Button
      variant="outline"
      onClick={() => window.open(`/visao-imersao-2/${reportId}/executivo`, "_blank", "noopener")}
    >
      <FileText className="mr-1 h-4 w-4" />
      Relatório Executivo
    </Button>
  );
}
