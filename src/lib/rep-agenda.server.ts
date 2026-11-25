// Server-only: Guia de Agenda do portal do representante. Service role, SEMPRE escopado ao
// representante vinculado ao usuário logado (mesma regra do restante do portal).
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { PortalRep } from "@/lib/rep-portal.server";
import { chaveCliente } from "@/lib/rep-agenda";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;

export async function repCompanyId(repId: string): Promise<string | null> {
  const { data } = await admin
    .from("representatives")
    .select("company_id")
    .eq("id", repId)
    .maybeSingle();
  return (data?.company_id as string | null) ?? null;
}

/** Linha de performance da carteira do representante (qualquer upload dele); senão, erro. */
export async function rowDoRep(rep: PortalRep, rowId: string) {
  const { data } = await admin
    .from("rep_performance_rows")
    .select("id, razao_social, company_id, rep_performance_uploads!inner(representative_id)")
    .eq("id", rowId)
    .eq("rep_performance_uploads.representative_id", rep.id)
    .maybeSingle();
  if (!data) throw new Error("Cliente fora da sua carteira.");
  return {
    id: data.id as string,
    cliente: String(data.razao_social ?? "").trim(),
    companyId: (data.company_id as string | null) ?? null,
  };
}

export type LembreteImersao = { rotulo: string; texto: string; data: string | null };
export type LembretesResult = {
  imersao: { titulo: string; data: string | null } | null;
  itens: LembreteImersao[];
};

const curto = (s: unknown, max = 420) => {
  const t = typeof s === "string" ? s.replace(/\s+/g, " ").trim() : "";
  if (!t) return null;
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};
const likeExato = (s: string) => s.replace(/[\\%_]/g, (c) => `\\${c}`);

/**
 * Lembretes da imersão do cliente (quando houver): o que foi levantado no campo e nas respostas
 * do representante. Não expõe transcrições/entrevistas nem relatórios internos.
 */
export async function lembretesImersao(rep: PortalRep, rowId: string): Promise<LembretesResult> {
  const row = await rowDoRep(rep, rowId);
  const companyId = row.companyId ?? (await repCompanyId(rep.id));
  if (!companyId || !row.cliente) return { imersao: null, itens: [] };
  const key = chaveCliente(row.cliente);

  const { data: clients } = await admin
    .from("clients")
    .select("id, razao_social")
    .eq("company_id", companyId)
    .ilike("razao_social", likeExato(row.cliente));
  const clientIds = ((clients ?? []) as Array<{ id: string; razao_social: string | null }>)
    .filter((c) => chaveCliente(c.razao_social) === key)
    .map((c) => c.id);

  const imm = new Set<string>();
  if (clientIds.length) {
    const { data } = await admin
      .from("immersions")
      .select("id")
      .eq("company_id", companyId)
      .in("client_id", clientIds);
    for (const r of data ?? []) imm.add(r.id);
  }
  const { data: entrevistas } = await admin
    .from("interviews")
    .select("immersion_id, empresa_nome")
    .eq("company_id", companyId)
    .not("immersion_id", "is", null)
    .ilike("empresa_nome", likeExato(row.cliente));
  for (const e of (entrevistas ?? []) as Array<{ immersion_id: string; empresa_nome: string }>)
    if (chaveCliente(e.empresa_nome) === key) imm.add(e.immersion_id);
  if (imm.size === 0) return { imersao: null, itens: [] };

  const ids = [...imm];
  const [{ data: imersoes }, { data: repInputs }, { data: campo }] = await Promise.all([
    admin
      .from("immersions")
      .select("id, titulo, data_visita, created_at")
      .in("id", ids)
      .order("created_at", { ascending: false })
      .limit(1),
    admin
      .from("representative_inputs")
      .select(
        "oportunidades, potencial_aumento, negociacao, ameacas, marcas_concorrentes, familias_mais_compradas, acoes_faturamento, cuidados, perfil_comprador, submitted_at, created_at",
      )
      .in("immersion_id", ids)
      .order("created_at", { ascending: false })
      .limit(2),
    admin
      .from("field_visit_inputs")
      .select(
        "oportunidades, observacoes_comerciais, observacoes_concorrentes, observacoes_exposicao, observacoes_loja, created_at",
      )
      .in("immersion_id", ids)
      .order("created_at", { ascending: false })
      .limit(2),
  ]);

  const ultima = (imersoes ?? [])[0] as
    | { titulo: string; data_visita: string | null; created_at: string }
    | undefined;
  const itens: LembreteImersao[] = [];
  const add = (rotulo: string, v: unknown, data: string | null) => {
    const texto = curto(v);
    if (texto && !itens.some((i) => i.texto === texto)) itens.push({ rotulo, texto, data });
  };
  for (const c of (campo ?? []) as Array<Record<string, string | null>>) {
    const d = c.created_at?.slice(0, 10) ?? null;
    add("Oportunidades levantadas na visita", c.oportunidades, d);
    add("Observações comerciais", c.observacoes_comerciais, d);
    add("Concorrência", c.observacoes_concorrentes, d);
    add("Exposição / loja", c.observacoes_exposicao ?? c.observacoes_loja, d);
  }
  for (const r of (repInputs ?? []) as Array<Record<string, string | null>>) {
    const d = (r.submitted_at ?? r.created_at)?.slice(0, 10) ?? null;
    add("Oportunidades (suas respostas)", r.oportunidades, d);
    add("Potencial de aumento", r.potencial_aumento, d);
    add("Negociação", r.negociacao, d);
    add("Ameaças", r.ameacas, d);
    add("Marcas concorrentes", r.marcas_concorrentes, d);
    add("Famílias mais compradas", r.familias_mais_compradas, d);
    add("Ações para faturamento", r.acoes_faturamento, d);
    add("Cuidados", r.cuidados, d);
    add("Perfil do comprador", r.perfil_comprador, d);
  }

  return {
    imersao: ultima
      ? { titulo: ultima.titulo, data: ultima.data_visita ?? ultima.created_at.slice(0, 10) }
      : null,
    itens: itens.slice(0, 10),
  };
}
