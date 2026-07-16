import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3 } from "lucide-react";
import type { ClientFamiliasData } from "@/lib/client-bi-parser";
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
import { FAROL_HEX, FAROL_LABEL, FAROL_ORDER, statusFromPercent, type FarolStatus } from "@/lib/performance-farol";

const fmtPct = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(1).replace(".", ",")}%`;
};

const farolKey = (grupo: string | null | undefined): FarolStatus | null => {
  if (!grupo) return null;
  const g = grupo.toLowerCase();
  const found = FAROL_ORDER.find((k) => FAROL_LABEL[k].toLowerCase() === g);
  return (found as FarolStatus) ?? null;
};

export function ClientFamiliasChart({
  repId,
  razaoSocial,
  filterFams,
}: {
  repId: string;
  razaoSocial: string;
  companyId: string | null;
  filterFams: string[];
}) {
  const { data: up = null, isLoading } = useQuery({
    queryKey: ["client-familias", repId, razaoSocial],
    enabled: !!repId && !!razaoSocial,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("client_bi_uploads")
        .select("*")
        .eq("representative_id", repId)
        .eq("razao_social", razaoSocial)
        .eq("kind", "familias")
        .is("substituida_em", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
  });

  const d: ClientFamiliasData | null = (up?.data as ClientFamiliasData) ?? null;

  const chartData = useMemo(() => {
    const itens = d?.itens ?? [];
    const wanted = new Set(filterFams);
    return itens
      .filter((r) => (filterFams.length === 0 ? true : wanted.has(r.familia)))
      .map((r) => {
        const pct =
          r.atingimento != null
            ? Math.abs(r.atingimento) <= 1.5
              ? r.atingimento * 100
              : r.atingimento
            : null;
        const st = r.farol ? farolKey(r.farol) : statusFromPercent(pct);
        return {
          familia: r.familia,
          atingimento: pct ?? 0,
          farol: st ? FAROL_LABEL[st] : "—",
          fill: FAROL_HEX[st ?? "sem_compra"],
        };
      });
  }, [d, filterFams]);

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
        ) : !d || chartData.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            Nenhuma planilha de resultado por família carregada.
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
                    "Atingimento",
                  ]}
                />
                <ReferenceLine y={100} stroke="#94a3b8" strokeDasharray="4 4" />
                <Bar dataKey="atingimento" name="Atingimento" radius={[4, 4, 0, 0]}>
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
