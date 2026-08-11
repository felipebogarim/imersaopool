import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { 
  type ClientBIData, 
  CANONICAL_FAMILIES 
} from "./client-bi-familias";

/**
 * Função centralizada para calcular o Atingimento Ponderado Geral de um cliente.
 * Segue a regra canônica: ponderação financeira por meta de acordo com a categoria.
 */
export function calculateWeightedAtainment(
  categoria: string | null,
  familias: Array<{ familia: string; atingimento: number | null }>
): number | null {
  if (!categoria || !familias?.length) return null;

  // Matrizes Financeiras Canônicas (Metas de referência por categoria)
  // Ref: Memória bi-participacao-familia e instruções do usuário.
  const MATRIZES: Record<string, Record<string, number>> = {
    "Gold": {
      "DECOR NEWLINE": 2500,
      "DECOR STUDIO": 3000,
      "SISTEMAS E MÓDULOS": 2500,
      "PRO LED": 1500,
      "PRO LAMP": 1500,
      "PERFIL": 2000,
      "FITAS E FONTES": 2000,
    },
    "Black": {
      // Valores Black (estimados/referência se não fornecidos, mas mantendo a proporção)
      "DECOR NEWLINE": 5000,
      "DECOR STUDIO": 6000,
      "SISTEMAS E MÓDULOS": 5000,
      "PRO LED": 3000,
      "PRO LAMP": 3000,
      "PERFIL": 4000,
      "FITAS E FONTES": 4000,
    },
    "Silver": {
      "DECOR NEWLINE": 1250,
      "DECOR STUDIO": 1500,
      "SISTEMAS E MÓDULOS": 1250,
      "PRO LED": 750,
      "PRO LAMP": 750,
      "PERFIL": 1000,
      "FITAS E FONTES": 1000,
    }
  };

  const metas = MATRIZES[categoria] || MATRIZES["Gold"]; // fallback para Gold se categoria for desconhecida
  
  let totalMeta = 0;
  let totalRealizadoPonderado = 0;

  for (const f of CANONICAL_FAMILIES) {
    const meta = metas[f] || 0;
    const item = familias.find(x => x.familia === f);
    const atingimento = item?.atingimento ?? 0; // Se não tem dado, assume 0%

    totalMeta += meta;
    totalRealizadoPonderado += meta * (atingimento / 100);
  }

  if (totalMeta === 0) return null;
  
  // Retorna em percentual (ex: 78.8)
  return (totalRealizadoPonderado / totalMeta) * 100;
}

export const getClientAtainment = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ 
    clientId: z.string(),
    periodo: z.string().optional()
  }).parse(data))
  .handler(async ({ data, context }) => {
    if (!context || !context.supabase) {
      throw new Error("Supabase context is not available");
    }

    const { data: client } = await context.supabase
      .from("clients")
      .select("categoria, razao_social")
      .eq("id", data.clientId)
      .single();

    if (!client) return null;

    const { data: bi } = await (context.supabase as any)
      .from("client_bi")
      .select("respostas")
      .eq("client_id", data.clientId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const biRes = bi?.respostas?.__client_bi__;
    if (!biRes) return null;

    return {
      razao_social: client.razao_social,
      categoria: client.categoria,
      atingimento_geral: calculateWeightedAtainment(client.categoria, biRes.familias || []),
      periodo: (biRes as any).periodo || data.periodo || "Atual"
    };
  });
