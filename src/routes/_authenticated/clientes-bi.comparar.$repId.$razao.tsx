import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowDownRight, ArrowUpRight, Minus, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { FAROL_CELL_CLASS, catBadge } from "@/lib/performance-farol";
import {
  SITUACAO_LABEL,
  buildProfileComparison,
  formatPct,
  formatPp,
  type ComparableRecord,
  type Situacao,
} from "@/lib/client-profile-comparison";
import { useAllClientBIs } from "@/lib/use-performance-bi";
import { toLegacyClientBIData } from "@/lib/performance-bi-engine";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export const Route = createFileRoute("/_authenticated/clientes-bi/comparar/$repId/$razao")({
  head: () => ({
    meta: [
      { title: "Comparação dentro do perfil — PoolFlux" },
      {
        name: "description",
        content:
          "Comparação do desempenho do cliente com a média dos clientes da mesma categoria na carteira do representante.",
      },
      { property: "og:title", content: "Comparação dentro do perfil — PoolFlux" },
      {
        property: "og:description",
        content: "Comparação interna da carteira do representante por categoria e período.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CompararPerfilPage,
});

const SIT_ICON: Record<Situacao, typeof ArrowUpRight> = {
  acima: ArrowUpRight,
  proximo: Minus,
  abaixo: ArrowDownRight,
};

const SIT_CLASS: Record<Situacao, string> = {
  acima: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
  proximo: "bg-muted text-muted-foreground border-border",
  abaixo: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
};

function SituacaoChip({ s }: { s: Situacao | null }) {
  if (!s) return <span className="text-muted-foreground">—</span>;
  const Icon = SIT_ICON[s];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border whitespace-nowrap",
        SIT_CLASS[s],
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {SITUACAO_LABEL[s]}
    </span>
  );
}

function CompararPerfilPage() {
  const { repId, razao } = Route.useParams();
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
      (await supabase.from("representatives").select("id, nome").eq("id", repId).single()).data,
  });

  // Base comparável derivada exclusivamente da versão ativa de Performance.
  const { data: base = null, isLoading } = useAllClientBIs(repId);

  const clienteBI = useMemo(() => {
    const target = razaoSocial.trim().toUpperCase();
    return (base?.bis ?? []).find((b) => b.cliente.trim().toUpperCase() === target) ?? null;
  }, [base, razaoSocial]);

  const periodoLabel: string | null = base?.version.periodo_label ?? null;

  const clienteRow = useMemo(
    () => (clienteBI ? { data: toLegacyClientBIData(clienteBI), periodo_label: periodoLabel } : null),
    [clienteBI, periodoLabel],
  );

  const rows: ComparableRecord[] = useMemo(
    () =>
      (base?.bis ?? []).map((b) => ({
        representative_id: repId,
        periodo_label: periodoLabel,
        substituida_em: null,
        kind: "bi",
        data: toLegacyClientBIData(b),
      })) as ComparableRecord[],
    [base, repId, periodoLabel],
  );


  const result = useMemo(
    () =>
      buildProfileComparison({
        cliente: clienteRow?.data ?? null,
        rows,
        representativeId: repId,
        representante: rep?.nome ?? "—",
        periodoLabel,
      }),
    [clienteRow, rows, repId, rep?.nome, periodoLabel],
  );

  const chartData = useMemo(
    () =>
      result.familias.map((f) => ({
        familia: f.familia,
        Cliente: f.cliente ?? 0,
        [`Média ${result.categoria || "categoria"}`]: f.media ?? 0,
      })),
    [result],
  );
  const mediaKey = `Média ${result.categoria || "categoria"}`;

  const voltarTo = "/clientes-bi/$repId/$razao";

  return (
    <div>
      <PageHeader
        title="Comparação dentro do perfil"
        actions={
          <Button variant="ghost" asChild>
            <Link to={voltarTo} params={{ repId, razao }}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar ao BI do cliente
            </Link>
          </Button>
        }
      />

      <div className="p-4 sm:p-6 md:p-8 max-w-7xl mx-auto space-y-4">
        <p className="text-sm text-muted-foreground">
          {isLoading
            ? "Carregando comparação…"
            : `Cliente comparado com a média dos clientes ${result.categoria || "—"} da carteira de ${
                rep?.nome ?? "—"
              }${periodoLabel ? ` no período ${periodoLabel}` : ""}.`}
        </p>

        {isLoading ? (
          <div className="surface rounded-xl p-6 text-sm text-muted-foreground">Carregando…</div>
        ) : !result.ok ? (
          <div className="surface rounded-xl p-6 text-sm text-muted-foreground">
            {result.mensagem}
          </div>
        ) : (
          <>
            {/* BLOCO 1 — Identificação */}
            <div className="surface rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-sm">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Cliente</div>
                <div className="font-medium">{razaoSocial}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Representante
                </div>
                <div className="font-medium">{rep?.nome ?? "—"}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Categoria
                </div>
                <span
                  className={cn(
                    "inline-flex px-2 py-0.5 rounded-full text-xs border",
                    catBadge(result.categoria),
                  )}
                >
                  {result.categoria || "—"}
                </span>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Período</div>
                <div className="font-medium">{periodoLabel ?? "—"}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Base comparável
                </div>
                <div className="font-medium">
                  {result.baseSize} cliente{result.baseSize === 1 ? "" : "s"} {result.categoria}
                </div>
                {result.excluidos > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {result.excluidos} registro{result.excluidos === 1 ? "" : "s"} excluído
                    {result.excluidos === 1 ? "" : "s"} por inconsistência
                  </div>
                )}
              </div>
            </div>

            {result.soCliente && (
              <div className="surface rounded-xl p-4 flex items-start gap-2 text-sm">
                <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" aria-hidden />
                <span>
                  Não há outros clientes da categoria {result.categoria} nesta carteira e período
                  para formar uma base comparável.
                </span>
              </div>
            )}

            {/* BLOCO 2 — Visão geral */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="surface rounded-xl p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Cliente</div>
                <div className="mt-1 text-3xl font-semibold tabular-nums">
                  {formatPct(result.clienteGeral)}
                </div>
              </div>
              <div className="surface rounded-xl p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Média do perfil
                </div>
                <div className="mt-1 text-3xl font-semibold tabular-nums">
                  {result.soCliente ? "Indisponível" : formatPct(result.mediaGeral)}
                </div>
              </div>
              <div className="surface rounded-xl p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Diferença
                </div>
                <div className="mt-1 text-2xl font-semibold tabular-nums">
                  {result.soCliente ? "Indisponível" : formatPp(result.diffGeralPp)}
                </div>
                <div className="mt-2">
                  <SituacaoChip s={result.soCliente ? null : result.situacaoGeral} />
                </div>
              </div>
              <div className="surface rounded-xl p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Posição no perfil
                </div>
                <div className="mt-1 text-2xl font-semibold">
                  {result.posicao == null
                    ? "Indisponível"
                    : `${result.posicao}º de ${result.baseSize} clientes ${result.categoria}`}
                </div>
              </div>
            </div>

            {/* BLOCO 3 — Gráfico comparativo por família */}
            <div className="surface rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Comparação por família
                </p>
              </div>
              <div className="p-4">
                <div className="h-[420px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData}
                      layout="vertical"
                      margin={{ top: 10, right: 24, left: 8, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis type="number" tickFormatter={(v) => `${v}%`} domain={[0, (max: number) => Math.max(120, max)]} />
                      <YAxis type="category" dataKey="familia" width={140} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={(v: any) => formatPct(v as number)} />
                      <Legend />
                      <ReferenceLine x={100} stroke="#94a3b8" strokeDasharray="4 4" />
                      <Bar dataKey="Cliente" fill="var(--primary)" radius={[0, 4, 4, 0]} />
                      {!result.soCliente && (
                        <Bar dataKey={mediaKey} fill="var(--chart-compare)" radius={[0, 4, 4, 0]} />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* BLOCO 4 — Tabela comparativa */}
            <div className="surface rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Detalhe por família
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border">
                      <th className="px-4 py-2 font-medium">Família</th>
                      <th className="px-4 py-2 font-medium text-right">Cliente</th>
                      <th className="px-4 py-2 font-medium text-right">Média do perfil</th>
                      <th className="px-4 py-2 font-medium text-right">Diferença</th>
                      <th className="px-4 py-2 font-medium">Situação</th>
                      <th className="px-4 py-2 font-medium">Farol do cliente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.familias.map((f) => (
                      <tr key={f.familia} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-2">{f.familia}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatPct(f.cliente)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatPct(f.media)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatPp(f.diffPp)}</td>
                        <td className="px-4 py-2">
                          <SituacaoChip s={f.situacao} />
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{f.farolCliente ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* BLOCO 5 — Destaques */}
            {!result.soCliente && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {result.vantagemLabel && result.maiorVantagem && (
                  <div className="surface rounded-xl p-4">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {result.vantagemLabel}
                    </div>
                    <div className="mt-1 text-lg font-semibold">{result.maiorVantagem.familia}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatPp(result.maiorVantagem.diffPp)} em relação à média dos clientes{" "}
                      {result.categoria}
                    </div>
                  </div>
                )}
                {result.lacunaLabel && result.maiorLacuna && (
                  <div className="surface rounded-xl p-4">
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {result.lacunaLabel}
                    </div>
                    <div className="mt-1 text-lg font-semibold">{result.maiorLacuna.familia}</div>
                    <div className="text-sm text-muted-foreground">
                      {formatPp(result.maiorLacuna.diffPp)} em relação à média dos clientes{" "}
                      {result.categoria}
                    </div>
                  </div>
                )}
                {result.destaquesMensagem && (
                  <div className="surface rounded-xl p-4 text-sm text-muted-foreground md:col-span-2">
                    {result.destaquesMensagem}
                  </div>
                )}
              </div>
            )}

            {/* BLOCO 6 — Distribuição dos faróis */}
            <div className="surface rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Distribuição dos grupos do farol
                </p>
              </div>
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {result.farol.map((f) => (
                  <div
                    key={f.status}
                    className={cn("rounded-xl p-3 border border-border/60", FAROL_CELL_CLASS[f.status])}
                  >
                    <div className="text-[11px] uppercase tracking-wider opacity-80">{f.grupo}</div>
                    <div className="text-xl font-semibold tabular-nums">{f.clienteQtd} de 7</div>
                    <div className="text-[11px] opacity-80">
                      {result.soCliente || f.categoriaPct == null
                        ? "Categoria: —"
                        : `Categoria: ${formatPct(f.categoriaPct)} das observações`}
                    </div>
                  </div>
                ))}
              </div>
              {!result.soCliente && (
                <div className="px-4 pb-4 text-xs text-muted-foreground">
                  Observações da categoria: {result.baseSize} × 7 = {result.baseSize * 7} registros de
                  família.
                </div>
              )}
            </div>

            {/* BLOCO 7 — Leitura executiva */}
            <div className="surface rounded-xl p-4">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                Leitura executiva
              </div>
              <p className="text-sm leading-relaxed">{result.leituraExecutiva}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
