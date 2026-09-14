import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { summarize, variacao } from "@/lib/agenda-trade-metrics";
import type { TradeAction, TradeCostCenter, TradeInvestment } from "@/lib/agenda-trade-types";
import { brl } from "@/lib/agenda-trade-types";
import type { AgendaUser } from "@/lib/agenda-types";
import type { KanbanClientRow } from "@/lib/kanban-clients";

type Props = {
  actions: TradeAction[];
  tripInvestments: TradeInvestment[];
  clientNames: Map<string, string>;
  users: AgendaUser[];
  costCenters: TradeCostCenter[];
};

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-semibold">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function TradePanel({ actions, tripInvestments, clientNames, users, costCenters }: Props) {
  const summary = useMemo(() => summarize(actions, tripInvestments), [actions, tripInvestments]);
  const { diff, pct } = variacao(summary.total);
  const userNames = useMemo(() => new Map(users.map((u) => [u.id, u.full_name || u.email || "Usuário"])), [users]);
  const ccNames = useMemo(() => new Map(costCenters.map((c) => [c.id, c.nome])), [costCenters]);

  const totalCliente = summary.clientesAtendidos || 1;
  const totalAcoes = summary.acoes || 1;

  const clientesRows = [...summary.porCliente.entries()].sort((a, b) => b[1].realizado + b[1].planejado - (a[1].realizado + a[1].planejado));
  const tipoRows = [...summary.porTipo.entries()].sort((a, b) => b[1].planejado - a[1].planejado);
  const ccRows = [...summary.porCentroCusto.entries()].sort((a, b) => b[1].planejado - a[1].planejado);
  const respRows = [...summary.porResponsavel.entries()].sort((a, b) => b[1].planejado - a[1].planejado);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Investimento planejado" value={brl(summary.total.planejado)} />
        <Kpi label="Investimento realizado" value={brl(summary.total.realizado)} />
        <Kpi label="Diferença" value={brl(diff)} hint={`${pct.toFixed(1)}% em relação ao planejado`} />
        <Kpi label="Ações" value={String(summary.acoes)} hint={`${summary.clientesAtendidos} clientes atendidos`} />
        <Kpi label="Médio por cliente" value={brl((summary.total.realizado || summary.total.planejado) / totalCliente)} />
        <Kpi label="Médio por ação" value={brl((summary.total.realizado || summary.total.planejado) / totalAcoes)} />
        <Kpi label="Viagens" value={brl(summary.viagens.realizado || summary.viagens.planejado)} />
        <Kpi
          label="Eventos e treinamentos"
          value={brl(
            (summary.eventos.realizado || summary.eventos.planejado) + (summary.treinamentos.realizado || summary.treinamentos.planejado),
          )}
          hint={`Eventos ${brl(summary.eventos.realizado || summary.eventos.planejado)} · Treinamentos ${brl(summary.treinamentos.realizado || summary.treinamentos.planejado)}`}
        />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Por cliente</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-right">Ações</TableHead>
                <TableHead className="text-right">Planejado</TableHead>
                <TableHead className="text-right">Realizado</TableHead>
                <TableHead className="text-right">Direto</TableHead>
                <TableHead className="text-right">Rateado</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientesRows.map(([clientId, row]) => (
                <TableRow key={clientId} className="odd:bg-muted/20">
                  <TableCell className="max-w-[260px] truncate">{clientNames.get(clientId) ?? "Cliente"}</TableCell>
                  <TableCell className="text-right">{row.acoes}</TableCell>
                  <TableCell className="text-right">{brl(row.planejado)}</TableCell>
                  <TableCell className="text-right">{brl(row.realizado)}</TableCell>
                  <TableCell className="text-right">{brl(row.direto)}</TableCell>
                  <TableCell className="text-right">{brl(row.rateado)}</TableCell>
                  <TableCell className="text-right font-medium">{brl(row.direto + row.rateado)}</TableCell>
                </TableRow>
              ))}
              {clientesRows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground">Sem dados no período.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {[
          { title: "Por tipo de ação", rows: tipoRows.map(([key, value]) => [key, value] as const) },
          { title: "Por centro de custo", rows: ccRows.map(([key, value]) => [ccNames.get(key) ?? "Sem centro de custo", value] as const) },
          { title: "Por responsável", rows: respRows.map(([key, value]) => [userNames.get(key) ?? "Sem responsável", value] as const) },
        ].map((block) => (
          <Card key={block.title}>
            <CardHeader className="pb-2"><CardTitle className="text-base">{block.title}</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Planejado</TableHead>
                    <TableHead className="text-right">Realizado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {block.rows.map(([label, value], index) => (
                    <TableRow key={`${label}-${index}`} className="odd:bg-muted/20">
                      <TableCell className="max-w-[200px] truncate">{label}</TableCell>
                      <TableCell className="text-right">{brl(value.planejado)}</TableCell>
                      <TableCell className="text-right">{brl(value.realizado)}</TableCell>
                    </TableRow>
                  ))}
                  {block.rows.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-sm text-muted-foreground">Sem dados.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
