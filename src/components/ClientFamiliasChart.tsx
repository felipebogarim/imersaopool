import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Upload, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { parseClientFamiliasWorkbook, type ClientFamiliasData } from "@/lib/client-bi-parser";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { FAROL_HEX, statusFromPercent } from "@/lib/performance-farol";

const fmtBRL = (n: number | null | undefined) =>
  n == null || Number.isNaN(n)
    ? "—"
    : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const fmtPct = (n: number | null | undefined) => {
  if (n == null || Number.isNaN(n)) return "—";
  const v = Math.abs(n) <= 1.5 ? n * 100 : n;
  return `${v.toFixed(1).replace(".", ",")}%`;
};

export function ClientFamiliasChart({
  repId,
  razaoSocial,
  companyId,
  filterFams,
}: {
  repId: string;
  razaoSocial: string;
  companyId: string | null;
  filterFams: string[];
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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

  const upload = useMutation({
    mutationFn: async (file: File) => {
      if (!companyId) throw new Error("Cliente sem empresa associada.");
      const buf = await file.arrayBuffer();
      const parsed: ClientFamiliasData = parseClientFamiliasWorkbook(buf);
      const { data: userRes } = await supabase.auth.getUser();
      if (up?.id) {
        await (supabase as any)
          .from("client_bi_uploads")
          .update({ substituida_em: new Date().toISOString() })
          .eq("id", up.id);
      }
      const { error } = await (supabase as any).from("client_bi_uploads").insert({
        representative_id: repId,
        razao_social: razaoSocial,
        company_id: companyId,
        kind: "familias",
        filename: file.name,
        data: parsed,
        uploaded_by: userRes.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Planilha de resultado por família importada.");
      qc.invalidateQueries({ queryKey: ["client-familias", repId, razaoSocial] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao importar planilha."),
    onSettled: () => setBusy(false),
  });

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setBusy(true);
    upload.mutate(f);
  }

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
            : r.meta && r.realizado != null
              ? (r.realizado / r.meta) * 100
              : null;
        return {
          familia: r.familia,
          meta: r.meta ?? 0,
          realizado: r.realizado ?? 0,
          atingimento: pct,
          fill: FAROL_HEX[statusFromPercent(pct) ?? "sem_compra"],
        };
      });
  }, [d, filterFams]);

  return (
    <div className="surface rounded-xl overflow-hidden">
      <div className="w-full px-4 py-3 border-b border-border flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Resultado por família
          </p>
        </div>
        <div className="flex items-center gap-2">
          {up?.filename && (
            <span className="hidden md:inline text-xs text-muted-foreground truncate max-w-[240px]">
              {up.filename}
            </span>
          )}
          <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={onFile} />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
            <Upload className="h-3.5 w-3.5 mr-1" />
            {up ? "Atualizar planilha" : "Carregar planilha"}
          </Button>
        </div>
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
                <XAxis dataKey="familia" angle={-25} textAnchor="end" interval={0} height={70} tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => (typeof v === "number" ? v.toLocaleString("pt-BR") : v)} />
                <Tooltip
                  formatter={(value: any, name: any) => {
                    if (name === "atingimento") return [fmtPct(value as number), "Atingimento"];
                    return [fmtBRL(value as number), name === "meta" ? "Meta" : "Realizado"];
                  }}
                />
                <Legend />
                <Bar dataKey="meta" name="Meta" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="realizado" name="Realizado" radius={[4, 4, 0, 0]}>
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
