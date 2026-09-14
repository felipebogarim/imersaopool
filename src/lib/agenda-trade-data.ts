import { supabase } from "@/integrations/supabase/client";
import type {
  InvestmentDraft,
  TradeAction,
  TradeCategory,
  TradeCostCenter,
  TradeInvestment,
  TradeStatus,
  TradeTrip,
} from "@/lib/agenda-trade-types";
import { parseValor } from "@/lib/agenda-trade-types";

const ACTION_SELECT =
  "*, clients:trade_action_clients(client_id), investments:trade_investments(*, allocations:trade_investment_allocations(*))";

export async function fetchCostCenters(): Promise<TradeCostCenter[]> {
  const { data, error } = await supabase
    .from("trade_cost_centers")
    .select("id, nome, descricao, ativo")
    .order("nome");
  if (error) throw error;
  return (data ?? []) as TradeCostCenter[];
}

export async function fetchCategories(): Promise<TradeCategory[]> {
  const { data, error } = await supabase
    .from("trade_investment_categories")
    .select("id, nome, rateavel, ativo")
    .order("nome");
  if (error) throw error;
  return (data ?? []) as TradeCategory[];
}

export async function fetchTrips(): Promise<TradeTrip[]> {
  const { data, error } = await supabase
    .from("trade_trips")
    .select("id, titulo, cidade, data_inicio, data_fim, responsavel_id, observacoes")
    .order("data_inicio", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TradeTrip[];
}

export async function fetchActions(startISO: string, endISO: string): Promise<TradeAction[]> {
  const { data, error } = await supabase
    .from("trade_actions")
    .select(ACTION_SELECT)
    .gte("data_inicio", startISO)
    .lte("data_inicio", endISO)
    .order("data_inicio");
  if (error) throw error;
  return (data ?? []) as unknown as TradeAction[];
}

/** Despesas gerais lançadas direto numa viagem (sem ação). */
export async function fetchTripInvestments(startISO: string, endISO: string): Promise<TradeInvestment[]> {
  const { data, error } = await supabase
    .from("trade_investments")
    .select("*, allocations:trade_investment_allocations(*)")
    .is("action_id", null)
    .not("trip_id", "is", null)
    .gte("data", startISO)
    .lte("data", endISO)
    .order("data");
  if (error) throw error;
  return (data ?? []) as unknown as TradeInvestment[];
}

export type SaveActionPayload = {
  id?: string;
  trip_id: string | null;
  tipo_acao: string;
  tipo_acao_outro: string | null;
  descricao: string | null;
  data_inicio: string;
  data_fim: string | null;
  horario: string | null;
  cidade: string | null;
  status: TradeStatus;
  responsavel_id: string | null;
  representative_id: string | null;
  cost_center_id: string | null;
  clientIds: string[];
  investments: InvestmentDraft[];
};

export async function saveAction(payload: SaveActionPayload): Promise<string> {
  const row = {
    trip_id: payload.trip_id,
    tipo_acao: payload.tipo_acao,
    tipo_acao_outro: payload.tipo_acao_outro,
    descricao: payload.descricao,
    data_inicio: payload.data_inicio,
    data_fim: payload.data_fim,
    horario: payload.horario,
    cidade: payload.cidade,
    status: payload.status,
    responsavel_id: payload.responsavel_id,
    representative_id: payload.representative_id,
    cost_center_id: payload.cost_center_id,
  };

  let actionId = payload.id ?? "";
  if (actionId) {
    const { error } = await supabase.from("trade_actions").update(row).eq("id", actionId);
    if (error) throw error;
  } else {
    const { data, error } = await supabase.from("trade_actions").insert(row).select("id").single();
    if (error) throw error;
    actionId = data.id;
  }

  // clientes da ação
  const { data: existingClients, error: clientsError } = await supabase
    .from("trade_action_clients")
    .select("client_id")
    .eq("action_id", actionId);
  if (clientsError) throw clientsError;
  const current = new Set((existingClients ?? []).map((c) => c.client_id));
  const wanted = new Set(payload.clientIds);
  const toRemove = [...current].filter((id) => !wanted.has(id));
  const toAdd = [...wanted].filter((id) => !current.has(id));
  if (toRemove.length) {
    const { error } = await supabase
      .from("trade_action_clients")
      .delete()
      .eq("action_id", actionId)
      .in("client_id", toRemove);
    if (error) throw error;
  }
  if (toAdd.length) {
    const { error } = await supabase
      .from("trade_action_clients")
      .insert(toAdd.map((client_id) => ({ action_id: actionId, client_id })));
    if (error) throw error;
  }

  // investimentos
  const { data: existingInv, error: invError } = await supabase
    .from("trade_investments")
    .select("id")
    .eq("action_id", actionId);
  if (invError) throw invError;
  const keptIds = payload.investments.map((inv) => inv.id).filter(Boolean) as string[];
  const removedInv = (existingInv ?? []).map((i) => i.id).filter((id) => !keptIds.includes(id));
  if (removedInv.length) {
    const { error } = await supabase.from("trade_investments").delete().in("id", removedInv);
    if (error) throw error;
  }

  for (const inv of payload.investments) {
    const invRow = {
      action_id: actionId,
      trip_id: payload.trip_id,
      descricao: inv.descricao,
      category_id: inv.category_id,
      cost_center_id: inv.cost_center_id,
      data: inv.data || payload.data_inicio,
      valor_planejado: parseValor(inv.valor_planejado),
      valor_realizado: inv.valor_realizado === "" ? null : parseValor(inv.valor_realizado),
      status: inv.status,
      observacao: inv.observacao || null,
      anexo_path: inv.anexo_path,
      rateado: inv.rateado && inv.rateio_client_ids.length > 0,
    };
    let invId = inv.id ?? "";
    if (invId) {
      const { error } = await supabase.from("trade_investments").update(invRow).eq("id", invId);
      if (error) throw error;
    } else {
      const { data, error } = await supabase.from("trade_investments").insert(invRow).select("id").single();
      if (error) throw error;
      invId = data.id;
    }

    const { error: delAlloc } = await supabase
      .from("trade_investment_allocations")
      .delete()
      .eq("investment_id", invId);
    if (delAlloc) throw delAlloc;

    const rateioIds = invRow.rateado ? inv.rateio_client_ids : payload.clientIds;
    if (rateioIds.length > 0) {
      const qtd = rateioIds.length;
      const planejado = Number((invRow.valor_planejado / qtd).toFixed(2));
      const realizado = invRow.valor_realizado === null ? null : Number((invRow.valor_realizado / qtd).toFixed(2));
      const { error } = await supabase.from("trade_investment_allocations").insert(
        rateioIds.map((client_id) => ({
          investment_id: invId,
          client_id,
          valor_planejado: planejado,
          valor_realizado: realizado,
        })),
      );
      if (error) throw error;
    }
  }

  return actionId;
}

export async function deleteAction(id: string) {
  const { error } = await supabase.from("trade_actions").delete().eq("id", id);
  if (error) throw error;
}

export async function saveTrip(input: {
  id?: string;
  titulo: string;
  cidade: string | null;
  data_inicio: string;
  data_fim: string | null;
  observacoes: string | null;
}): Promise<string> {
  if (input.id) {
    const { error } = await supabase.from("trade_trips").update(input).eq("id", input.id);
    if (error) throw error;
    return input.id;
  }
  const { data, error } = await supabase.from("trade_trips").insert(input).select("id").single();
  if (error) throw error;
  return data.id;
}

export async function uploadComprovante(file: File): Promise<string> {
  const safe = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${crypto.randomUUID()}-${safe}`;
  const { error } = await supabase.storage.from("trade-comprovantes").upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export async function comprovanteUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from("trade-comprovantes").createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}
