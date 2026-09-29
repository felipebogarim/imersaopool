// Price › Validação de Comparáveis / Comparativos Específicos — acesso a dados.
// Segue o mesmo padrão do módulo (cliente do navegador + RLS), e o mesmo
// mecanismo de "tabela ainda não existe" usado em director-rep-notes.ts:
// enquanto a migration `20260928200026_price_comparison_groups.sql` não for
// aplicada manualmente no Supabase real, a UI degrada com `schemaAvailable=false`
// em vez de quebrar.

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { SpecValue } from "@/lib/price-comparativos-core";
import {
  fetchProducts,
  type ProductRow,
  type LoadedProduct,
  loadProducts,
} from "@/lib/price-comparativos-data";

// ============ Tipos ============

export type GroupStatus = "rascunho" | "finalizado";
export type GroupDestino = "oficial" | "especifico" | "oficial_e_especifico";
export type ItemStatus = "em_analise" | "validado" | "incompativel";
export type ItemClassification =
  | "equivalente_direto"
  | "equivalente_aproximado"
  | "alternativo"
  | "incompativel";

export const ITEM_STATUS_LABEL: Record<ItemStatus, string> = {
  em_analise: "Em análise",
  validado: "Validado",
  incompativel: "Incompatível",
};

export const ITEM_CLASSIFICATION_LABEL: Record<ItemClassification, string> = {
  equivalente_direto: "Equivalente direto",
  equivalente_aproximado: "Equivalente aproximado",
  alternativo: "Alternativo",
  incompativel: "Incompatível",
};

export type ComparisonGroup = {
  id: string;
  company_id: string;
  name: string;
  familia: string;
  categoria: string | null;
  base_brand: string;
  base_price_table: string | null;
  status: GroupStatus;
  destino: GroupDestino | null;
  is_official: boolean;
  notes: string | null;
  source_group_id: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
  deleted_by: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  finalized_at: string | null;
  saved_official_at: string | null;
  saved_specific_at: string | null;
};

export type ItemSpecsSnapshot = {
  base?: Record<string, SpecValue>;
  competitor_a?: Record<string, SpecValue>;
  competitor_b?: Record<string, SpecValue>;
  /** Preço original (ex.: bobina) e unidade do preço comparável gravado, por lado. */
  price_meta?: Partial<
    Record<
      "base" | "competitor_a" | "competitor_b",
      {
        original_price: number | null;
        original_unit: string | null;
        comparable_unit: string | null;
      }
    >
  >;
};

export type ComparisonGroupItem = {
  id: string;
  company_id: string;
  group_id: string;
  position: number;
  base_code: string;
  base_brand: string;
  base_product_id: string | null;
  base_price: number | null;
  base_adjustment_percent: number | null;
  two_competitors: boolean;
  competitor_a_brand: string;
  competitor_a_code: string;
  competitor_a_product_id: string | null;
  competitor_a_price: number | null;
  competitor_a_price_table: string | null;
  competitor_a_price_date: string | null;
  competitor_a_region: string | null;
  competitor_a_source: string | null;
  competitor_a_adjustment_percent: number | null;
  competitor_b_brand: string | null;
  competitor_b_code: string | null;
  competitor_b_product_id: string | null;
  competitor_b_price: number | null;
  competitor_b_price_table: string | null;
  competitor_b_price_date: string | null;
  competitor_b_region: string | null;
  competitor_b_source: string | null;
  competitor_b_adjustment_percent: number | null;
  status: ItemStatus;
  classification: ItemClassification | null;
  voltage_note: string | null;
  notes: string | null;
  specs_snapshot: ItemSpecsSnapshot;
  is_deleted: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type AuditAction =
  | "create_group"
  | "update_group"
  | "add_item"
  | "update_item"
  | "remove_item"
  | "finalize_group"
  | "duplicate_group"
  | "save_official"
  | "save_specific"
  | "substitute_competitor"
  | "delete_group";

// ============ Shadow client (tabelas novas, ainda fora de types.ts gerado) ============

type NewTablesDatabase = {
  public: {
    Tables: {
      price_comparison_groups: {
        Row: ComparisonGroup;
        Insert: Partial<ComparisonGroup> & {
          name: string;
          familia: string;
          base_brand: string;
        };
        Update: Partial<ComparisonGroup>;
        Relationships: [];
      };
      price_comparison_group_items: {
        Row: ComparisonGroupItem;
        Insert: Partial<ComparisonGroupItem> & {
          group_id: string;
          base_code: string;
          base_brand: string;
          competitor_a_brand: string;
          competitor_a_code: string;
        };
        Update: Partial<ComparisonGroupItem>;
        Relationships: [];
      };
      price_comparison_audit_log: {
        Row: {
          id: string;
          company_id: string;
          group_id: string | null;
          item_id: string | null;
          action: AuditAction;
          before_json: unknown;
          after_json: unknown;
          user_id: string;
          created_at: string;
        };
        Insert: {
          group_id?: string | null;
          item_id?: string | null;
          action: AuditAction;
          before_json?: unknown;
          after_json?: unknown;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const groupsClient = supabase as unknown as SupabaseClient<NewTablesDatabase>;

// `price_equivalences` já existe (migration de agosto), mas `group_id`/`relation_context`
// foram adicionadas por esta migration e ainda não estão no types.ts gerado — shadow local
// só para essas leituras/escritas, nos mesmos moldes de `groupsClient` acima.
type EquivalenceRowShadow = {
  id: string;
  base_product_id: string;
  compared_product_id: string;
  equivalence_level: "direto" | "aproximado" | "alternativo" | "incompativel" | "insuficiente";
  status: ItemStatus;
  manually_edited: boolean;
  validation_notes: string | null;
  group_id: string | null;
  relation_context: string | null;
  is_deleted: boolean;
};

type EquivDatabase = {
  public: {
    Tables: {
      price_equivalences: {
        Row: EquivalenceRowShadow;
        Insert: Partial<EquivalenceRowShadow> & {
          base_product_id: string;
          compared_product_id: string;
        };
        Update: Partial<EquivalenceRowShadow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const equivClient = supabase as unknown as SupabaseClient<EquivDatabase>;

function isMissingTable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return (
    error.code === "PGRST205" ||
    error.code === "42P01" ||
    (error.message ?? "").includes("price_comparison_groups") ||
    (error.message ?? "").includes("price_comparison_group_items")
  );
}

export class ComparisonSchemaUnavailableError extends Error {
  constructor() {
    super(
      "A migration de Grupos de Comparação ainda não foi aplicada no banco. " +
        "Peça para aplicar supabase/migrations/20260928200026_price_comparison_groups.sql.",
    );
    this.name = "ComparisonSchemaUnavailableError";
  }
}

// ============ Leitura ============

export async function fetchGroups(params: {
  familia?: string;
  destino?: GroupDestino[];
  includeDrafts?: boolean;
}): Promise<{ groups: ComparisonGroup[]; schemaAvailable: boolean }> {
  let q = groupsClient
    .from("price_comparison_groups")
    .select("*")
    .eq("is_deleted", false)
    .order("updated_at", { ascending: false });
  if (params.familia) q = q.eq("familia", params.familia);
  if (params.destino?.length) q = q.in("destino", params.destino);
  if (!params.includeDrafts) q = q.not("destino", "is", null);
  const { data, error } = await q;
  if (error) {
    if (isMissingTable(error)) return { groups: [], schemaAvailable: false };
    throw error;
  }
  return { groups: (data ?? []) as ComparisonGroup[], schemaAvailable: true };
}

export async function fetchGroup(
  id: string,
): Promise<{ group: ComparisonGroup | null; schemaAvailable: boolean }> {
  const { data, error } = await groupsClient
    .from("price_comparison_groups")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) return { group: null, schemaAvailable: false };
    throw error;
  }
  return { group: (data as ComparisonGroup) ?? null, schemaAvailable: true };
}

export async function fetchGroupItems(groupId: string): Promise<ComparisonGroupItem[]> {
  const { data, error } = await groupsClient
    .from("price_comparison_group_items")
    .select("*")
    .eq("group_id", groupId)
    .eq("is_deleted", false)
    .order("position", { ascending: true });
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  return (data ?? []) as ComparisonGroupItem[];
}

// ============ Escrita: grupo ============

export async function createGroup(input: {
  name: string;
  familia: string;
  categoria: string | null;
  base_brand: string;
  base_price_table: string | null;
}): Promise<ComparisonGroup> {
  const { data, error } = await groupsClient
    .from("price_comparison_groups")
    .insert(input)
    .select("*")
    .single();
  if (error) throw isMissingTable(error) ? new ComparisonSchemaUnavailableError() : error;
  await logAudit({ group_id: data.id, action: "create_group", after_json: data });
  return data as ComparisonGroup;
}

export async function updateGroup(
  id: string,
  patch: Partial<
    Pick<ComparisonGroup, "name" | "notes" | "base_price_table" | "status" | "finalized_at">
  >,
): Promise<ComparisonGroup> {
  const { data, error } = await groupsClient
    .from("price_comparison_groups")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  await logAudit({ group_id: id, action: "update_group", after_json: patch });
  return data as ComparisonGroup;
}

export async function finalizeGroup(id: string): Promise<ComparisonGroup> {
  const group = await updateGroup(id, {
    status: "finalizado",
    finalized_at: new Date().toISOString(),
  });
  await logAudit({ group_id: id, action: "finalize_group" });
  return group;
}

export async function softDeleteGroup(id: string): Promise<void> {
  const patch: Partial<ComparisonGroup> = {
    is_deleted: true,
    deleted_at: new Date().toISOString(),
  };
  const { error } = await groupsClient.from("price_comparison_groups").update(patch).eq("id", id);
  if (error) throw error;
  await logAudit({ group_id: id, action: "delete_group" });
}

export async function duplicateGroup(id: string, newName: string): Promise<ComparisonGroup> {
  const { group } = await fetchGroup(id);
  if (!group) throw new Error("Comparativo original não encontrado.");
  const items = await fetchGroupItems(id);

  const copy = await createGroup({
    name: newName,
    familia: group.familia,
    categoria: group.categoria,
    base_brand: group.base_brand,
    base_price_table: group.base_price_table,
  });
  await groupsClient
    .from("price_comparison_groups")
    .update({ source_group_id: id })
    .eq("id", copy.id);

  for (const item of items) {
    await addItem(copy.id, stripItemForCopy(item));
  }
  await logAudit({
    group_id: copy.id,
    action: "duplicate_group",
    before_json: { source_group_id: id },
  });
  return { ...copy, source_group_id: id };
}

function stripItemForCopy(item: ComparisonGroupItem): NewItemInput {
  const {
    id: _id,
    company_id: _c,
    group_id: _g,
    created_at: _ca,
    updated_at: _ua,
    created_by: _cb,
    is_deleted: _del,
    ...rest
  } = item;
  return rest;
}

// ============ Escrita: itens ============

export type NewItemInput = Omit<
  ComparisonGroupItem,
  "id" | "company_id" | "group_id" | "created_at" | "updated_at" | "created_by" | "is_deleted"
>;

export async function addItem(
  groupId: string,
  input: Partial<NewItemInput> & {
    base_code: string;
    base_brand: string;
    competitor_a_brand: string;
    competitor_a_code: string;
  },
): Promise<ComparisonGroupItem> {
  const { data: existing } = await groupsClient
    .from("price_comparison_group_items")
    .select("position")
    .eq("group_id", groupId)
    .order("position", { ascending: false })
    .limit(1);
  const nextPosition = ((existing?.[0] as { position: number } | undefined)?.position ?? -1) + 1;

  const { data, error } = await groupsClient
    .from("price_comparison_group_items")
    .insert({ ...input, group_id: groupId, position: nextPosition })
    .select("*")
    .single();
  if (error) throw error;
  await logAudit({ group_id: groupId, item_id: data.id, action: "add_item", after_json: data });
  return data as ComparisonGroupItem;
}

export async function updateItem(
  id: string,
  patch: Partial<ComparisonGroupItem>,
  groupId?: string,
): Promise<ComparisonGroupItem> {
  const { data, error } = await groupsClient
    .from("price_comparison_group_items")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  await logAudit({
    group_id: groupId ?? data.group_id,
    item_id: id,
    action: "update_item",
    after_json: patch,
  });
  return data as ComparisonGroupItem;
}

export async function removeItem(id: string, groupId: string): Promise<void> {
  const { error } = await groupsClient.from("price_comparison_group_items").delete().eq("id", id);
  if (error) throw error;
  await logAudit({ group_id: groupId, item_id: id, action: "remove_item" });
}

// ============ Substituir concorrente ============

export async function substituteCompetitor(params: {
  groupId: string;
  fromBrand: string;
  toBrand: string;
  scope: "item" | "group";
  itemId?: string;
}): Promise<void> {
  const items = await fetchGroupItems(params.groupId);
  const targets = items.filter((it) => {
    if (params.scope === "item" && it.id !== params.itemId) return false;
    return it.competitor_a_brand === params.fromBrand || it.competitor_b_brand === params.fromBrand;
  });
  for (const item of targets) {
    const patch: Partial<ComparisonGroupItem> = {};
    if (item.competitor_a_brand === params.fromBrand) {
      patch.competitor_a_brand = params.toBrand;
      patch.competitor_a_code = "";
      patch.competitor_a_product_id = null;
      patch.competitor_a_price = null;
      patch.competitor_a_price_table = null;
    }
    if (item.competitor_b_brand === params.fromBrand) {
      patch.competitor_b_brand = params.toBrand;
      patch.competitor_b_code = "";
      patch.competitor_b_product_id = null;
      patch.competitor_b_price = null;
      patch.competitor_b_price_table = null;
    }
    await updateItem(item.id, patch, params.groupId);
  }
  await logAudit({
    group_id: params.groupId,
    action: "substitute_competitor",
    before_json: { fromBrand: params.fromBrand },
    after_json: { toBrand: params.toBrand, scope: params.scope, itemId: params.itemId },
  });
}

// ============ Auditoria ============

async function logAudit(entry: {
  group_id?: string | null;
  item_id?: string | null;
  action: AuditAction;
  before_json?: unknown;
  after_json?: unknown;
}): Promise<void> {
  try {
    await groupsClient.from("price_comparison_audit_log").insert({
      group_id: entry.group_id ?? null,
      item_id: entry.item_id ?? null,
      action: entry.action,
      before_json: entry.before_json ?? null,
      after_json: entry.after_json ?? null,
    });
  } catch {
    // Auditoria não deve bloquear a operação principal (ex.: tabela ainda não migrada).
  }
}

export async function fetchAuditLog(groupId: string) {
  const { data, error } = await groupsClient
    .from("price_comparison_audit_log")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  return data ?? [];
}

// ============ Busca de produto (autocomplete base/concorrente) ============

export async function searchProducts(params: {
  familia?: string;
  categoria?: string;
  marca?: string;
  busca?: string;
}): Promise<LoadedProduct[]> {
  const rows: ProductRow[] = await fetchProducts({ ...params, limit: 30 });
  return loadProducts(rows);
}

// ============ Conflito com comparação oficial existente ============

export type OfficialConflict = {
  itemId: string;
  side: "a" | "b";
  existingEquivalenceId: string;
  baseLabel: string;
  competitorLabel: string;
};

export async function checkOfficialConflicts(
  group: ComparisonGroup,
  items: ComparisonGroupItem[],
): Promise<OfficialConflict[]> {
  const conflicts: OfficialConflict[] = [];
  for (const item of items) {
    for (const side of ["a", "b"] as const) {
      const brand = side === "a" ? item.competitor_a_brand : item.competitor_b_brand;
      const code = side === "a" ? item.competitor_a_code : item.competitor_b_code;
      if (!brand || !code) continue;
      const baseProduct = await findProductByCode(
        group.familia,
        group.categoria,
        item.base_brand,
        item.base_code,
        true,
      );
      const compProduct = await findProductByCode(
        group.familia,
        group.categoria,
        brand,
        code,
        false,
      );
      if (!baseProduct || !compProduct) continue;
      const { data } = await equivClient
        .from("price_equivalences")
        .select("id, group_id")
        .eq("base_product_id", baseProduct.id)
        .eq("compared_product_id", compProduct.id)
        .eq("is_deleted", false)
        .maybeSingle();
      const existing = data;
      if (existing && existing.group_id !== group.id) {
        conflicts.push({
          itemId: item.id,
          side,
          existingEquivalenceId: existing.id,
          baseLabel: `${item.base_brand} ${item.base_code}`,
          competitorLabel: `${brand} ${code}`,
        });
      }
    }
  }
  return conflicts;
}

async function findProductByCode(
  familia: string,
  categoria: string | null,
  marca: string,
  code: string,
  isBase: boolean,
): Promise<{ id: string } | null> {
  let q = supabase
    .from("price_products")
    .select("id")
    .eq("familia", familia)
    .eq("marca", marca)
    .eq("is_deleted", false)
    .eq("is_base", isBase)
    .or(`sku.eq.${code},referencia.eq.${code}`)
    .limit(1);
  if (categoria) q = q.eq("categoria", categoria);
  const { data } = await q.maybeSingle();
  return (data as { id: string } | null) ?? null;
}

async function findOrCreateProduct(
  familia: string,
  categoria: string | null,
  marca: string,
  code: string,
  isBase: boolean,
): Promise<string> {
  const existing = await findProductByCode(familia, categoria, marca, code, isBase);
  if (existing) return existing.id;
  const { data, error } = await supabase
    .from("price_products")
    .insert({
      familia,
      categoria: categoria ?? "Fitas LED",
      marca,
      sku: code,
      is_base: isBase,
      nome: `${marca} ${code}`,
      status: "ativo",
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

// ============ Salvar como oficial / específico ============

export async function saveAsSpecific(groupId: string): Promise<ComparisonGroup> {
  const group = await updateGroup(groupId, { status: "finalizado" });
  const { data, error } = await groupsClient
    .from("price_comparison_groups")
    .update({
      destino: group.destino === "oficial" ? "oficial_e_especifico" : "especifico",
      saved_specific_at: new Date().toISOString(),
    })
    .eq("id", groupId)
    .select("*")
    .single();
  if (error) throw error;
  await logAudit({ group_id: groupId, action: "save_specific" });
  return data as ComparisonGroup;
}

export async function saveAsOfficial(params: {
  groupId: string;
  alsoSpecific: boolean;
  replaceConflicts: boolean;
}): Promise<ComparisonGroup> {
  const { group } = await fetchGroup(params.groupId);
  if (!group) throw new Error("Comparativo não encontrado.");
  const items = await fetchGroupItems(params.groupId);

  const relationContext = `grupo:${group.id}`;

  for (const item of items) {
    const baseId = await findOrCreateProduct(
      group.familia,
      group.categoria,
      item.base_brand,
      item.base_code,
      true,
    );
    await upsertOfficialPair(baseId, item, "a", group, relationContext);
    if (item.two_competitors && item.competitor_b_brand && item.competitor_b_code) {
      await upsertOfficialPair(baseId, item, "b", group, relationContext);
    }
  }

  const destino: GroupDestino = params.alsoSpecific ? "oficial_e_especifico" : "oficial";
  const { data, error } = await groupsClient
    .from("price_comparison_groups")
    .update({
      is_official: true,
      status: "finalizado",
      destino,
      saved_official_at: new Date().toISOString(),
      ...(params.alsoSpecific ? { saved_specific_at: new Date().toISOString() } : {}),
    })
    .eq("id", params.groupId)
    .select("*")
    .single();
  if (error) throw error;
  await logAudit({
    group_id: params.groupId,
    action: "save_official",
    after_json: { alsoSpecific: params.alsoSpecific },
  });
  return data as ComparisonGroup;
}

async function upsertOfficialPair(
  baseId: string,
  item: ComparisonGroupItem,
  side: "a" | "b",
  group: ComparisonGroup,
  relationContext: string,
): Promise<void> {
  const brand = side === "a" ? item.competitor_a_brand : item.competitor_b_brand;
  const code = side === "a" ? item.competitor_a_code : item.competitor_b_code;
  if (!brand || !code) return;
  const compId = await findOrCreateProduct(group.familia, group.categoria, brand, code, false);

  const level: "direto" | "aproximado" | "alternativo" | "incompativel" | "insuficiente" =
    item.classification === "equivalente_direto"
      ? "direto"
      : item.classification === "equivalente_aproximado"
        ? "aproximado"
        : item.classification === "alternativo"
          ? "alternativo"
          : item.classification === "incompativel"
            ? "incompativel"
            : "insuficiente";

  const payload = {
    base_product_id: baseId,
    compared_product_id: compId,
    equivalence_level: level,
    status: item.status,
    manually_edited: true,
    validation_notes: item.notes,
    group_id: group.id,
    relation_context: relationContext,
  };

  const { data: existing } = await equivClient
    .from("price_equivalences")
    .select("id")
    .eq("base_product_id", baseId)
    .eq("compared_product_id", compId)
    .maybeSingle();

  if (existing) {
    const { error } = await equivClient
      .from("price_equivalences")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await equivClient.from("price_equivalences").insert(payload);
    if (error) throw error;
  }
}
