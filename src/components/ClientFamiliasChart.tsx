import { useEffect, useMemo, useRef, useState } from "react";
import { BarChart3, Camera, Check, Loader2 } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FAROL_HEX, FAROL_LABEL } from "@/lib/performance-farol";
import { useClientBI } from "@/lib/use-performance-bi";
import {
  generateFamiliasChartBlob,
  uploadChartImageToStorage,
} from "@/lib/executive-report/chart-image";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const fmtPct = (n: number | null | undefined) =>
  n == null || Number.isNaN(n) ? "—" : `${n.toFixed(1).replace(".", ",")}%`;

export function ClientFamiliasChart({
  repId,
  razaoSocial,
  filterFams,
  versionId = null,
  reportId,
  clientName,
}: {
  repId: string;
  razaoSocial: string;
  companyId: string | null;
  filterFams: string[];
  versionId?: string | null;
  reportId?: string;
  clientName?: string;
}) {
  // Fonte única: exatamente os mesmos dados derivados usados pelos cards.
  const { data: bi = null, isLoading } = useClientBI(repId, razaoSocial, versionId);
  const [savingOg, setSavingOg] = useState(false);
  const [savedOg, setSavedOg] = useState(false);
  const autoSavedRef = useRef<string | null>(null);

  const chartData = useMemo(() => {
    const wanted = new Set(filterFams);
    return (bi?.familias ?? [])
      .filter((f) => (filterFams.length === 0 ? true : wanted.has(f.familia)))
      .map((f) => ({
        familia: f.familia,
        atingimento: f.atingimento_ratio != null ? f.atingimento_ratio * 100 : 0,
        farol: f.farol ? FAROL_LABEL[f.farol] : "—",
        fill: FAROL_HEX[f.farol ?? "sem_compra"],
      }));
  }, [bi, filterFams]);

  // Sincroniza automaticamente o print em alta resolução para ser a imagem do card de WhatsApp
  useEffect(() => {
    if (!reportId || chartData.length === 0 || autoSavedRef.current === reportId) return;
    autoSavedRef.current = reportId;

    void (async () => {
      try {
        const blob = await generateFamiliasChartBlob(chartData, {
          clientName: clientName || razaoSocial,
        });
        if (blob) {
          const url = await uploadChartImageToStorage(reportId, blob);
          if (url) setSavedOg(true);
        }
      } catch (err) {
        console.warn("Auto-sync do print do gráfico para WhatsApp:", err);
      }
    })();
  }, [reportId, chartData, clientName, razaoSocial]);

  async function handleSavePrint() {
    if (chartData.length === 0) return;
    setSavingOg(true);
    try {
      const blob = await generateFamiliasChartBlob(chartData, {
        clientName: clientName || razaoSocial,
      });
      if (!blob) throw new Error("Não foi possível gerar a imagem");

      if (reportId) {
        const url = await uploadChartImageToStorage(reportId, blob);
        if (url) {
          setSavedOg(true);
          toast.success("Print do Resultado por família salvo para o WhatsApp!");
          return;
        }
      }
      // Fallback: download direto da imagem
      const u = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = u;
      a.download = `resultado-familias-${razaoSocial.slice(0, 20)}.png`;
      a.click();
      URL.revokeObjectURL(u);
      toast.success("Print do gráfico baixado!");
    } catch {
      toast.error("Erro ao gerar print do gráfico.");
    } finally {
      setSavingOg(false);
    }
  }

  return (
    <div className="surface rounded-xl overflow-hidden">
      <div className="w-full px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Resultado por família
          </p>
        </div>
        {chartData.length > 0 && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => void handleSavePrint()}
            disabled={savingOg}
            className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5"
            title="Salvar print do gráfico para o card de pré-visualização do WhatsApp"
          >
            {savingOg ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : savedOg ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
            <span>{savedOg ? "Print salvo p/ WhatsApp" : "Salvar print p/ WhatsApp"}</span>
          </Button>
        )}
      </div>
      <div className="p-4">
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando…</div>
        ) : chartData.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Sem dados de Performance para este cliente na versão selecionada.
          </div>
        ) : (
          <div className="h-[380px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="familia"
                  angle={-25}
                  textAnchor="end"
                  interval={0}
                  height={70}
                  tick={{ fontSize: 11 }}
                />
                <YAxis tickFormatter={(v) => `${v}%`} domain={[0, (max: number) => Math.max(120, max)]} />
                <Tooltip
                  formatter={(value: any, _name: any, item: any) => [
                    `${fmtPct(value as number)} · ${item?.payload?.farol ?? ""}`,
                    "Atingimento real",
                  ]}
                />
                <ReferenceLine y={100} stroke="#94a3b8" strokeDasharray="4 4" />
                <Bar dataKey="atingimento" name="Atingimento real" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={`#${entry.fill}`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
