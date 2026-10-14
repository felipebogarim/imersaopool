import { supabase } from "@/integrations/supabase/client";

export interface RepClientOption {
  id: string;
  nome_fantasia: string;
  razao_social?: string | null;
  cidade?: string | null;
  estado?: string | null;
  isRepClient?: boolean;
}

/**
 * Normaliza strings para comparação flexível (remove acentos, espaços extras e caixa alta/baixa).
 */
export function normalizeText(text?: string | null): string {
  return (text || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Processa e classifica a lista de clientes para um representante:
 * - Identifica clientes vinculados via representative_id ou nome_representante_erp
 * - Ordena colocando clientes da carteira do rep no topo
 */
export function processRepClients(
  rawClients: any[],
  representativeId?: string,
  repNome?: string
): RepClientOption[] {
  const normRepNome = normalizeText(repNome);

  const mapped: RepClientOption[] = (rawClients || []).map((c) => {
    const isById = Boolean(representativeId && c.representative_id === representativeId);
    const normClientRep = normalizeText(c.nome_representante_erp);
    const isByName = Boolean(
      normRepNome &&
        normClientRep &&
        (normClientRep.includes(normRepNome) || normRepNome.includes(normClientRep))
    );

    const nome = (c.nome_fantasia || c.razao_social || "Cliente sem nome").trim();
    const cidade = (c.cidade || c.municipio || "").trim() || null;
    const estado = (c.estado || "").trim() || null;

    return {
      id: String(c.id),
      nome_fantasia: nome,
      razao_social: c.razao_social ? String(c.razao_social).trim() : null,
      cidade,
      estado,
      isRepClient: isById || isByName,
    };
  });

  // Ordena: Clientes da carteira primeiro, depois ordem alfabética por nome fantasia
  return mapped.sort((a, b) => {
    if (a.isRepClient && !b.isRepClient) return -1;
    if (!a.isRepClient && b.isRepClient) return 1;
    return a.nome_fantasia.localeCompare(b.nome_fantasia, "pt-BR");
  });
}

/**
 * Busca os clientes do Supabase e formata para o seletor do representante.
 */
export async function fetchClientsForRep(
  representativeId?: string,
  repNome?: string
): Promise<RepClientOption[]> {
  try {
    const { data, error } = await supabase
      .from("clients")
      .select("id, nome_fantasia, razao_social, cidade, municipio, estado, representative_id, nome_representante_erp")
      .order("nome_fantasia", { ascending: true })
      .limit(1000);

    if (error) {
      console.warn("[fetchClientsForRep] Erro ao buscar clientes:", error);
      return [];
    }

    return processRepClients(data ?? [], representativeId, repNome);
  } catch (err) {
    console.warn("[fetchClientsForRep] Exceção na busca de clientes:", err);
    return [];
  }
}
