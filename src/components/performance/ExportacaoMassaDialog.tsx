import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { exportAllPerformanceXlsx } from "@/lib/performance-export";
import { exportAllPerformanceReport } from "@/lib/performance-report";
import type { FarolStatus } from "@/lib/performance-farol";

type Rep = { id: string; nome: string };

type ExportRow = {
  razao_social: string;
  categoria: string | null;
  metas: Record<string, number>;
  metas_status: Record<string, FarolStatus>;
  metas_cores: Record<string, string>;
  realizado: Record<string, number>;
  familia_pct: Record<string, number>;
  total_pct: number | null;
  total_pct_status: FarolStatus | null;
  total_meta: number | null;
};

export function ExportacaoMassaDialog({
  open,
  onOpenChange,
  reps,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reps: Rep[];
}) {
  const [format, setFormat] = useState<"excel" | "pdf">("excel");
  const [periodoLabel, setPeriodoLabel] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const { data: periodos = [] } = useQuery({
    queryKey: ["perf-periodos-disponiveis"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rep_performance_uploads")
        .select("periodo_label")
        .is("substituida_em", null)
        .order("periodo_label", { ascending: false });
      return Array.from(
        new Set((data ?? []).map((d: any) => d.periodo_label).filter(Boolean)),
      ) as string[];
    },
    enabled: open,
  });

  async function handleExport() {
    if (!periodoLabel) {
      toast.error("Selecione o período.");
      return;
    }
    setBusy(true);
    try {
      const { data: uploads } = await supabase
        .from("rep_performance_uploads")
        .select("id, representative_id, familias")
        .is("substituida_em", null)
        .eq("periodo_label", periodoLabel);

      if (!uploads?.length) {
        toast.error("Nenhum representante com dados para o período selecionado.");
        return;
      }

      const repData: Array<{
        representante: string;
        familias: string[];
        rows: ExportRow[];
        totals: { perFamilia: Record<string, number>; grand: number };
      }> = [];

      for (const up of uploads) {
        const rep = reps.find((r) => r.id === up.representative_id);
        if (!rep) continue;

        const { data: dbRows } = await supabase
          .from("rep_performance_rows")
          .select("*")
          .eq("upload_id", up.id)
          .order("ordem");

        const fams: string[] = (up.familias as string[]) ?? [];
        const rows: ExportRow[] = (dbRows ?? []).map((r: any) => ({
          razao_social: r.razao_social,
          categoria: r.categoria,
          metas: r.metas ?? {},
          metas_status: r.metas_status ?? {},
          metas_cores: r.metas_cores ?? {},
          realizado: r.realizado ?? {},
          familia_pct: r.familia_pct ?? {},
          total_pct: r.total_pct ?? null,
          total_pct_status: r.total_pct_status ?? null,
          total_meta: r.total_meta,
        }));

        const perFamilia: Record<string, number> = {};
        let grand = 0;
        for (const r of rows) {
          for (const f of fams) perFamilia[f] = (perFamilia[f] ?? 0) + (Number(r.metas?.[f]) || 0);
          grand +=
            fams.reduce((s, f) => s + (Number(r.metas?.[f]) || 0), 0) || Number(r.total_meta) || 0;
        }

        repData.push({
          representante: rep.nome,
          familias: fams,
          rows,
          totals: { perFamilia, grand },
        });
      }

      if (!repData.length) {
        toast.error("Nenhum dado encontrado para exportar.");
        return;
      }

      const slug = periodoLabel.replace(/[^a-z0-9]+/gi, "-").toLowerCase();

      if (format === "excel") {
        exportAllPerformanceXlsx({
          filename: `performance-em-massa-${slug}`,
          periodo: periodoLabel,
          reps: repData,
        });
        toast.success(`${repData.length} relatório(s) exportado(s) em um arquivo Excel.`);
      } else {
        exportAllPerformanceReport({ periodo: periodoLabel, reps: repData });
        toast.success(`${repData.length} relatório(s) abertos para impressão como PDF.`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao exportar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (!busy ? onOpenChange(v) : null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Exportar todos os relatórios</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <Label className="mb-1.5 block">Período</Label>
            <Select value={periodoLabel} onValueChange={setPeriodoLabel}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                {periodos.length === 0 ? (
                  <SelectItem value="__none__" disabled>
                    Nenhum período disponível
                  </SelectItem>
                ) : (
                  periodos.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Serão exportados todos os representantes com performance ativa para o período
              escolhido.
            </p>
          </div>

          <div>
            <Label className="mb-1.5 block">Formato</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={format === "excel" ? "default" : "outline"}
                onClick={() => setFormat("excel")}
                className="flex-1"
              >
                <FileSpreadsheet className="h-4 w-4 mr-2" /> Excel (.xlsx)
              </Button>
              <Button
                type="button"
                variant={format === "pdf" ? "default" : "outline"}
                onClick={() => setFormat("pdf")}
                className="flex-1"
              >
                <FileText className="h-4 w-4 mr-2" /> PDF (relatório)
              </Button>
            </div>
            {format === "excel" && (
              <p className="text-xs text-muted-foreground mt-1">
                Gera um único arquivo .xlsx com uma aba por representante.
              </p>
            )}
            {format === "pdf" && (
              <p className="text-xs text-muted-foreground mt-1">
                Abre uma página com todos os relatórios prontos para "Salvar como PDF" pelo
                navegador.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={handleExport} disabled={busy || !periodoLabel}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" /> Exportando…
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-1" /> Exportar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
