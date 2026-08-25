import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
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

const fmtPct = (n: number | null | undefined) =>
  n == null || Number.isNaN(n) ? "—" : `${n.toFixed(1).replace(".", ",")}%`;

export function ClientFamiliasChart({
  repId,
  razaoSocial,
  filterFams,
  versionId = null,
}: {
  repId: string;
  razaoSocial: string;
  companyId: string | null;
  filterFams: string[];
  versionId?: string | null;
}) {
  // Fonte única: exatamente os mesmos dados derivados usados pelos cards.
  const { data: bi = null, isLoading } = useClientBI(repId, razaoSocial, versionId);

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

  return (
    <div className="surface rounded-xl overflow-hidden">
      <div className="w-full px-4 py-3 border-b border-border flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          Resultado por família
        </p>
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
