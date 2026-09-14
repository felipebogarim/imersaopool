import type { TradeAction, TradeInvestment } from "@/lib/agenda-trade-types";
import { TIPOS_EVENTO, TIPOS_TREINAMENTO, TIPOS_VIAGEM, tipoLabel } from "@/lib/agenda-trade-types";

export type Totals = { planejado: number; realizado: number };

const zero = (): Totals => ({ planejado: 0, realizado: 0 });

function add(target: Totals, inv: TradeInvestment) {
  target.planejado += Number(inv.valor_planejado ?? 0);
  target.realizado += Number(inv.valor_realizado ?? 0);
}

export function investmentsOf(actions: TradeAction[], tripInvestments: TradeInvestment[]): TradeInvestment[] {
  return [...actions.flatMap((a) => a.investments ?? []), ...tripInvestments];
}

export type TradeSummary = {
  total: Totals;
  porCliente: Map<string, Totals & { direto: number; rateado: number; acoes: number }>;
  porTipo: Map<string, Totals>;
  porCentroCusto: Map<string, Totals>;
  porResponsavel: Map<string, Totals & { acoes: number }>;
  clientesAtendidos: number;
  acoes: number;
  viagens: Totals;
  eventos: Totals;
  treinamentos: Totals;
};

export function summarize(actions: TradeAction[], tripInvestments: TradeInvestment[]): TradeSummary {
  const total = zero();
  const porCliente = new Map<string, Totals & { direto: number; rateado: number; acoes: number }>();
  const porTipo = new Map<string, Totals>();
  const porCentroCusto = new Map<string, Totals>();
  const porResponsavel = new Map<string, Totals & { acoes: number }>();
  const viagens = zero();
  const eventos = zero();
  const treinamentos = zero();
  const clientes = new Set<string>();

  const bumpCliente = (clientId: string) => {
    if (!porCliente.has(clientId)) porCliente.set(clientId, { planejado: 0, realizado: 0, direto: 0, rateado: 0, acoes: 0 });
    return porCliente.get(clientId)!;
  };

  for (const action of actions) {
    const tipo = tipoLabel(action);
    const clientIds = (action.clients ?? []).map((c) => c.client_id);
    clientIds.forEach((id) => {
      clientes.add(id);
      bumpCliente(id).acoes += 1;
    });
    if (action.responsavel_id) {
      const resp = porResponsavel.get(action.responsavel_id) ?? { planejado: 0, realizado: 0, acoes: 0 };
      resp.acoes += 1;
      porResponsavel.set(action.responsavel_id, resp);
    }

    for (const inv of action.investments ?? []) {
      add(total, inv);
      const tipoTotals = porTipo.get(tipo) ?? zero();
      add(tipoTotals, inv);
      porTipo.set(tipo, tipoTotals);

      const ccKey = inv.cost_center_id ?? action.cost_center_id ?? "sem-centro";
      const cc = porCentroCusto.get(ccKey) ?? zero();
      add(cc, inv);
      porCentroCusto.set(ccKey, cc);

      if (action.responsavel_id) {
        const resp = porResponsavel.get(action.responsavel_id)!;
        add(resp, inv);
      }

      if (TIPOS_VIAGEM.includes(tipo) || action.trip_id) add(viagens, inv);
      if (TIPOS_EVENTO.includes(tipo as never)) add(eventos, inv);
      if (TIPOS_TREINAMENTO.includes(tipo as never)) add(treinamentos, inv);

      for (const alloc of inv.allocations ?? []) {
        const bucket = bumpCliente(alloc.client_id);
        clientes.add(alloc.client_id);
        bucket.planejado += Number(alloc.valor_planejado ?? 0);
        bucket.realizado += Number(alloc.valor_realizado ?? 0);
        if (inv.rateado) bucket.rateado += Number(alloc.valor_realizado ?? alloc.valor_planejado ?? 0);
        else bucket.direto += Number(alloc.valor_realizado ?? alloc.valor_planejado ?? 0);
      }
    }
  }

  for (const inv of tripInvestments) {
    add(total, inv);
    add(viagens, inv);
    const ccKey = inv.cost_center_id ?? "sem-centro";
    const cc = porCentroCusto.get(ccKey) ?? zero();
    add(cc, inv);
    porCentroCusto.set(ccKey, cc);
    for (const alloc of inv.allocations ?? []) {
      const bucket = bumpCliente(alloc.client_id);
      clientes.add(alloc.client_id);
      bucket.planejado += Number(alloc.valor_planejado ?? 0);
      bucket.realizado += Number(alloc.valor_realizado ?? 0);
      bucket.rateado += Number(alloc.valor_realizado ?? alloc.valor_planejado ?? 0);
    }
  }

  return {
    total,
    porCliente,
    porTipo,
    porCentroCusto,
    porResponsavel,
    clientesAtendidos: clientes.size,
    acoes: actions.length,
    viagens,
    eventos,
    treinamentos,
  };
}

export function variacao(t: Totals) {
  const diff = t.realizado - t.planejado;
  const pct = t.planejado > 0 ? (diff / t.planejado) * 100 : 0;
  return { diff, pct };
}
