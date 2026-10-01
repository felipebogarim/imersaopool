// Price › Equivalências — base oficial produto-base (Newline/Standard/Studio) × produto concorrente.
// Reaproveita public.price_equivalences; `origin`, `relation_status` e `created_by` vêm da migration
// 20260930120000 e ainda não estão no types.ts gerado, então o acesso usa um cliente "shadow"
// (mesmo padrão de price-comparison-groups.ts). Cliente do navegador + RLS (escrita só admin).

import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  formatSpec,
  scoreEquivalence,
  type ComparisonRule,
  type EquivalenceLevel,
} from "@/lib/price-comparativos-core";
import {
  loadCatalogProducts,
  type LoadedProduct,
  type ProductRow,
} from "@/lib/price-comparativos-data";
import { top6For } from "@/lib/price-comparison-groups-attributes";

// ============ Tipos e rótulos ============

export const BASE_COMPANIES = ["Newline", "Standard", "Studio"] as const;

export type EquivalenceOrigin = "system_suggestion" | "admin_manual" | "comparables_validation";
export type RelationStatus = "sugestao_sistema" | "validada" | "rejeitada" | "em_revisao";
/** Estado exibido: "sem_equivalencia" é derivado (produto base sem relação ativa). */
export type DisplayStatus = RelationStatus | "sem_equivalencia";

export const ORIGIN_LABEL: Record<EquivalenceOrigin, string> = {
  system_suggestion: "Sugestão do sistema",
  admin_manual: "Validação manual do administrador",
  comparables_validation: "Validação de Comparáveis",
};

export const RELATION_STATUS_LABEL: Record<DisplayStatus, string> = {
  sugestao_sistema: "Sugestão do sistema",
  validada: "Validada",
  rejeitada: "Rejeitada",
  sem_equivalencia: "Sem equivalência",
  em_revisao: "Em revisão",
};

export const RELATION_STATUS_CLASS: Record<DisplayStatus, string> = {
  sugestao_sistema: "bg-sky-100 text-sky-800 border-sky-200",
  validada: "bg-emerald-100 text-emerald-800 border-emerald-200",
  rejeitada: "bg-rose-100 text-rose-800 border-rose-200",
  sem_equivalencia: "bg-muted text-muted-foreground border-border",
  em_revisao: "bg-amber-100 text-amber-800 border-amber-200",
};

/** Mantém o enum legado `status` coerente (Comparativos/Mapa continuam lendo-o). */
export function legacyStatusFor(s: RelationStatus): "em_analise" | "validado" | "incompativel" {
  if (s === "validada") return "validado";
  if (s === "rejeitada") return "incompativel";
  return "em_analise";
}

export type OfficialEquivalence = {
  id: string;
  base_product_id: string;
  compared_product_id: string;
  origin: EquivalenceOrigin;
  relation_status: RelationStatus;
  equivalence_level: EquivalenceLevel;
  technical_score: number | null;
  validation_notes: string | null;
  validated_at: string | null;
  validated_by: string | null;
  created_by: string | null;
  created_at: string;
  group_id: string | null;
  is_deleted: boolean;
};

type EquivDatabase = {
  public: {
    Tables: {
      price_equivalences: {
        Row: OfficialEquivalence & Record<string, unknown>;
        Insert: Partial<OfficialEquivalence> & {
          base_product_id: string;
          compared_product_id: string;
          status?: "em_analise" | "validado" | "incompativel";
          manually_edited?: boolean;
          technical_similarities_json?: unknown;
          technical_differences_json?: unknown;
          deletion_reason?: string | null;
          deleted_at?: string | null;
        };
        Update: Partial<OfficialEquivalence> & {
          status?: "em_analise" | "validado" | "incompativel";
          manually_edited?: boolean;
          deletion_reason?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const eqClient = supabase as unknown as SupabaseClient<EquivDatabase>;

const PRODUCT_FIELDS =
  "id, marca, is_base, familia, categoria, tipo, sku, referencia, nome, descricao, imagem_url, status, source_file, source_page, source_date, updated_at";
const EQUIV_FIELDS =
  "id, base_product_id, compared_product_id, origin, relation_status, equivalence_level, technical_score, validation_notes, validated_at, validated_by, created_by, created_at, group_id, is_deleted";

// ============ Puro: apresentação e sugestões ============

export function productCodeOf(p: { sku: string | null; referencia: string | null; nome: string }) {
  return p.sku ?? p.referencia ?? p.nome;
}

/** Até 6 características principais já formatadas ("Tensão: 24 V"), só as que têm valor. */
export function mainSpecs(p: LoadedProduct, max = 4): { label: string; value: string }[] {
  const out: { label: string; value: string }[] = [];
  for (const attr of top6For(p.familia)) {
    const spec = p.product.specs[attr.key];
    const value = formatSpec(spec, attr.unidade);
    if (!spec || !value || value === "—") continue;
    out.push({ label: attr.label, value });
    if (out.length >= max) break;
  }
  return out;
}

export type Suggestion = {
  product: LoadedProduct;
  score: number;
  level: EquivalenceLevel;
  similarities: string[];
  differences: string[];
};

/** Ranqueia concorrentes por proximidade técnica; descarta incompatíveis/insuficientes. */
export function buildSuggestions(
  base: LoadedProduct,
  candidates: LoadedProduct[],
  rules: ComparisonRule[],
  attrNames: Record<string, string>,
  max = 3,
): Suggestion[] {
  if (!rules.length) return [];
  const out: Suggestion[] = [];
  for (const c of candidates) {
    if (c.id === base.id || c.is_base || c.marca.toLowerCase() === base.marca.toLowerCase()) {
      continue;
    }
    const r = scoreEquivalence(base.product, c.product, rules, attrNames);
    if (r.score == null || r.eliminado) continue;
    if (r.level !== "direto" && r.level !== "aproximado" && r.level !== "alternativo") continue;
    out.push({
      product: c,
      score: r.score,
      level: r.level,
      similarities: r.semelhancas,
      differences: r.diferencas,
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, max);
}

// ============ Leitura ============

function sanitizeTerm(term: string): string {
  return term.replace(/[,()%*\\]/g, " ").trim();
}

export async function fetchBaseProducts(params: {
  company: string | null;
  busca: string;
  limit?: number;
}): Promise<ProductRow[]> {
  let q = supabase
    .from("price_products")
    .select(PRODUCT_FIELDS)
    .eq("is_deleted", false)
    .order("marca")
    .order("sku")
    .limit(params.limit ?? 200);
  if (params.company) q = q.ilike("marca", params.company);
  else q = q.or(BASE_COMPANIES.map((b) => `marca.ilike.${b}`).join(","));
  const term = sanitizeTerm(params.busca);
  if (term) {
    const t = `%${term}%`;
    q = q.or(`sku.ilike.${t},referencia.ilike.${t},nome.ilike.${t},descricao.ilike.${t}`);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ProductRow[];
}

export type EquivalenceRelation = { equivalence: OfficialEquivalence; competitor: LoadedProduct };
export type EquivalenceOverviewRow = { base: LoadedProduct; relations: EquivalenceRelation[] };

export async function fetchEquivalenceOverview(params: {
  company: string | null;
  busca: string;
  limit?: number;
}): Promise<EquivalenceOverviewRow[]> {
  const baseRows = await fetchBaseProducts(params);
  if (!baseRows.length) return [];
  const bases = await loadCatalogProducts(baseRows);
  const baseIds = bases.map((b) => b.id);

  const equivs: OfficialEquivalence[] = [];
  for (let i = 0; i < baseIds.length; i += 150) {
    const { data, error } = await eqClient
      .from("price_equivalences")
      .select(EQUIV_FIELDS)
      .in("base_product_id", baseIds.slice(i, i + 150))
      .eq("is_deleted", false);
    if (error) throw error;
    equivs.push(...((data ?? []) as OfficialEquivalence[]));
  }

  const compIds = Array.from(new Set(equivs.map((e) => e.compared_product_id)));
  const compRows: ProductRow[] = [];
  for (let i = 0; i < compIds.length; i += 150) {
    const { data, error } = await supabase
      .from("price_products")
      .select(PRODUCT_FIELDS)
      .in("id", compIds.slice(i, i + 150));
    if (error) throw error;
    compRows.push(...((data ?? []) as ProductRow[]));
  }
  const comps = new Map((await loadCatalogProducts(compRows)).map((p) => [p.id, p]));

  return bases.map((base) => ({
    base,
    relations: equivs
      .filter((e) => e.base_product_id === base.id && comps.has(e.compared_product_id))
      .map((e) => ({ equivalence: e, competitor: comps.get(e.compared_product_id)! })),
  }));
}

/** Relações ativas do produto base (qualquer marca), com o concorrente já carregado. */
export async function fetchRelationsForBase(baseProductId: string): Promise<EquivalenceRelation[]> {
  const { data, error } = await eqClient
    .from("price_equivalences")
    .select(EQUIV_FIELDS)
    .eq("base_product_id", baseProductId)
    .eq("is_deleted", false);
  if (error) throw error;
  const equivs = (data ?? []) as OfficialEquivalence[];
  if (!equivs.length) return [];
  const { data: prods, error: pErr } = await supabase
    .from("price_products")
    .select(PRODUCT_FIELDS)
    .in(
      "id",
      equivs.map((e) => e.compared_product_id),
    );
  if (pErr) throw pErr;
  const comps = new Map(
    (await loadCatalogProducts((prods ?? []) as ProductRow[])).map((p) => [p.id, p]),
  );
  return equivs
    .filter((e) => comps.has(e.compared_product_id))
    .map((e) => ({ equivalence: e, competitor: comps.get(e.compared_product_id)! }));
}

// ============ Escrita (RLS: somente admin) ============

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Valida / rejeita / reabre uma relação existente. A origem é preservada. */
export async function setRelationStatus(
  id: string,
  relationStatus: RelationStatus,
  notes?: string | null,
): Promise<void> {
  const uid = await currentUserId();
  const validating = relationStatus === "validada";
  const { error } = await eqClient
    .from("price_equivalences")
    .update({
      relation_status: relationStatus,
      status: legacyStatusFor(relationStatus),
      validated_at: validating ? new Date().toISOString() : null,
      validated_by: validating ? uid : null,
      ...(notes !== undefined ? { validation_notes: notes } : {}),
    })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Cria ou atualiza a equivalência oficial base × concorrente (status "validada").
 * `replaceId` (relação anterior do mesmo concorrente) é arquivada com motivo, nunca apagada.
 */
export async function saveOfficialEquivalence(params: {
  baseProductId: string;
  comparedProductId: string;
  origin: Exclude<EquivalenceOrigin, "system_suggestion">;
  notes?: string | null;
  replaceId?: string | null;
}): Promise<OfficialEquivalence> {
  const uid = await currentUserId();
  const now = new Date().toISOString();

  if (params.replaceId) {
    const { data: old } = await eqClient
      .from("price_equivalences")
      .select("compared_product_id")
      .eq("id", params.replaceId)
      .maybeSingle();
    if (old && old.compared_product_id !== params.comparedProductId) {
      const { error } = await eqClient
        .from("price_equivalences")
        .update({
          is_deleted: true,
          deleted_at: now,
          deletion_reason: "Substituída por outra equivalência",
        })
        .eq("id", params.replaceId);
      if (error) throw error;
    }
  }

  const payload = {
    origin: params.origin,
    relation_status: "validada" as const,
    status: "validado" as const,
    manually_edited: true,
    validated_at: now,
    validated_by: uid,
    validation_notes: params.notes ?? null,
    is_deleted: false,
    deleted_at: null,
    deletion_reason: null,
  };

  const { data: existing, error: findErr } = await eqClient
    .from("price_equivalences")
    .select("id")
    .eq("base_product_id", params.baseProductId)
    .eq("compared_product_id", params.comparedProductId)
    .maybeSingle();
  if (findErr) throw findErr;

  const query = existing
    ? eqClient.from("price_equivalences").update(payload).eq("id", existing.id)
    : eqClient.from("price_equivalences").insert({
        ...payload,
        base_product_id: params.baseProductId,
        compared_product_id: params.comparedProductId,
        created_by: uid,
      });
  const { data, error } = await query.select(EQUIV_FIELDS).single();
  if (error) throw error;
  return data as OfficialEquivalence;
}

/** Grava sugestões do sistema; pares já existentes (inclusive rejeitados) são preservados. */
export async function saveSuggestions(
  baseProductId: string,
  suggestions: Suggestion[],
): Promise<number> {
  if (!suggestions.length) return 0;
  const { data: existing, error } = await eqClient
    .from("price_equivalences")
    .select("compared_product_id")
    .eq("base_product_id", baseProductId);
  if (error) throw error;
  const known = new Set((existing ?? []).map((e) => e.compared_product_id));
  const fresh = suggestions.filter((s) => !known.has(s.product.id));
  for (const s of fresh) {
    const { error: insErr } = await eqClient.from("price_equivalences").insert({
      base_product_id: baseProductId,
      compared_product_id: s.product.id,
      origin: "system_suggestion",
      relation_status: "sugestao_sistema",
      status: "em_analise",
      equivalence_level: s.level,
      technical_score: s.score,
      technical_similarities_json: s.similarities,
      technical_differences_json: s.differences,
    });
    if (insErr) throw insErr;
  }
  return fresh.length;
}
