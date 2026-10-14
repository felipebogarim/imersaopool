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
 * - Inclui clientes já cadastrados na estrutura ou carteira do representante
 * - Deduplica e ordena colocando clientes da carteira do rep no topo
 */
export function processRepClients(
  rawClients: any[],
  representativeId?: string,
  repNome?: string,
  extraRepClients?: Array<{ nome: string; cidade?: string | null; estado?: string | null }>
): RepClientOption[] {
  const normRepNome = normalizeText(repNome);
  const mapByName = new Map<string, RepClientOption>();

  // 1. Processa clientes extras / já vinculados da estrutura do rep (ex: Top 10 frequencia_visitas)
  if (extraRepClients && extraRepClients.length > 0) {
    for (const ec of extraRepClients) {
      const nome = (ec.nome || "").trim();
      const normKey = normalizeText(nome);
      if (!normKey) continue;
      mapByName.set(normKey, {
        id: `extra-${normKey}`,
        nome_fantasia: nome,
        razao_social: nome,
        cidade: ec.cidade?.trim() || null,
        estado: ec.estado?.trim() || null,
        isRepClient: true,
      });
    }
  }

  // 2. Processa clientes vindos do banco de dados (clients e rep_performance_rows)
  for (const c of rawClients || []) {
    const isById = Boolean(representativeId && c.representative_id === representativeId);
    const normClientRep = normalizeText(c.nome_representante_erp);
    const isByName = Boolean(
      normRepNome &&
        normClientRep &&
        (normClientRep.includes(normRepNome) || normRepNome.includes(normClientRep))
    );
    const isRep = Boolean(c.isRepClient || isById || isByName);

    const nome = (c.nome_fantasia || c.razao_social || "").trim();
    const normKey = normalizeText(nome);
    if (!normKey) continue;

    const existing = mapByName.get(normKey);
    if (existing) {
      if (!existing.cidade && (c.cidade || c.municipio)) {
        existing.cidade = (c.cidade || c.municipio || "").trim() || null;
      }
      if (!existing.estado && c.estado) {
        existing.estado = (c.estado || "").trim() || null;
      }
      if (isRep) {
        existing.isRepClient = true;
      }
    } else {
      mapByName.set(normKey, {
        id: String(c.id || normKey),
        nome_fantasia: nome,
        razao_social: c.razao_social ? String(c.razao_social).trim() : null,
        cidade: (c.cidade || c.municipio || "").trim() || null,
        estado: (c.estado || "").trim() || null,
        isRepClient: isRep,
      });
    }
  }

  const result = Array.from(mapByName.values());

  // Ordena: Clientes da carteira primeiro, depois ordem alfabética por nome fantasia
  return result.sort((a, b) => {
    if (a.isRepClient && !b.isRepClient) return -1;
    if (!a.isRepClient && b.isRepClient) return 1;
    return a.nome_fantasia.localeCompare(b.nome_fantasia, "pt-BR");
  });
}

/**
 * Busca os clientes do Supabase e formata para o seletor do representante.
 * Combina linhas da carteira de performance, tabela clients e clientes da estrutura.
 */
export async function fetchClientsForRep(
  representativeId?: string,
  repNome?: string,
  structureClients?: Array<{ nome: string; cidade?: string | null; estado?: string | null }>
): Promise<RepClientOption[]> {
  try {
    const rawClients: any[] = [];

    // 1. Tenta carregar linhas de clientes via rep_performance_uploads se houver representativeId
    if (representativeId) {
      try {
        const { data: uploads } = await supabase
          .from("rep_performance_uploads")
          .select("id")
          .eq("representative_id", representativeId)
          .is("substituida_em", null);

        if (uploads && uploads.length > 0) {
          const uploadIds = uploads.map((u) => u.id);
          const { data: rows } = await supabase
            .from("rep_performance_rows")
            .select("id, razao_social, categoria")
            .in("upload_id", uploadIds);

          const summaryPrefixes = ["PARTICIPA", "ATINGIMENTO", "TOTAL", "ESTIMATIVA", "FAIXA"];
          for (const row of rows || []) {
            const name = (row.razao_social || "").trim();
            if (
              name &&
              !summaryPrefixes.some((p) => name.toUpperCase().startsWith(p))
            ) {
              rawClients.push({
                id: `perf-${row.id || name}`,
                nome_fantasia: name,
                razao_social: name,
                isRepClient: true,
              });
            }
          }
        }
      } catch (err) {
        console.warn("[fetchClientsForRep] Erro ao buscar rep_performance_rows:", err);
      }
    }

    // 2. Busca clientes da tabela clients
    const { data, error } = await supabase
      .from("clients")
      .select("id, nome_fantasia, razao_social, cidade, municipio, estado, representative_id, nome_representante_erp")
      .order("nome_fantasia", { ascending: true })
      .limit(1000);

    if (error) {
      console.warn("[fetchClientsForRep] Erro ao buscar clients:", error);
    } else if (data) {
      rawClients.push(...data);
    }

    return processRepClients(rawClients, representativeId, repNome, structureClients);
  } catch (err) {
    console.warn("[fetchClientsForRep] Exceção na busca de clientes:", err);
    return processRepClients([], representativeId, repNome, structureClients);
  }
}
