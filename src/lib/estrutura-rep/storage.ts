import { supabase } from "@/integrations/supabase/client";
import type {
  RepStructure,
  RepresentadaItem,
  MembroEquipe,
  RecursosOperacionais,
} from "./types";

const LOCAL_STORAGE_PREFIX = "estrutura_rep_";

export function getLocalKey(repId: string): string {
  return `${LOCAL_STORAGE_PREFIX}${repId}`;
}

/** Extrai marcas de texto livre como "Stella, Brilha, Pampa" para itens estruturados */
function parseMarcasTexto(outrasMarcas?: string | null): RepresentadaItem[] {
  const marcas: RepresentadaItem[] = [
    {
      id: "brand-newline",
      nome: "Newline Iluminação",
      segmento: "Iluminação Técnica e Decorativa",
      modelo_negocio: "fabricante",
      canais: ["varejo", "distribuidores", "projetos"],
      abrangencia: "Integral (todos os estados atendidos)",
    },
  ];

  if (!outrasMarcas || !outrasMarcas.trim()) {
    return marcas;
  }

  const items = outrasMarcas
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);

  items.forEach((nome, idx) => {
    if (nome.toLowerCase().includes("newline")) return;
    marcas.push({
      id: `brand-extra-${idx}`,
      nome,
      segmento: "Iluminação & Complementos",
      modelo_negocio: idx % 2 === 0 ? "importador" : "distribuidor",
      canais: ["varejo", "projetos"],
      abrangencia: "Integral",
    });
  });

  return marcas;
}

/** Infere estados a partir de texto de região como "MT / GO / DF", "Bahia e Sergipe", etc. */
function parseEstadosRegiao(regiao?: string | null): string[] {
  if (!regiao) return ["MT", "GO", "DF"]; // Padrão exemplo prático do prompt

  const ufs = [
    "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
    "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
    "RS", "RO", "RR", "SC", "SP", "SE", "TO",
  ];

  const upper = regiao.toUpperCase();
  const encontrados = ufs.filter((uf) => {
    const regex = new RegExp(`\\b${uf}\\b`);
    return regex.test(upper);
  });

  if (encontrados.length > 0) return encontrados;

  if (upper.includes("BAHIA")) return ["BA", "SE"];
  if (upper.includes("CENTRO-OESTE") || upper.includes("CENTRO OESTE")) return ["MT", "GO", "DF", "MS"];
  if (upper.includes("MINAS")) return ["MG"];
  if (upper.includes("SUL")) return ["PR", "SC", "RS"];
  if (upper.includes("NORDESTE")) return ["BA", "PE", "CE"];
  if (upper.includes("SAO PAULO") || upper.includes("SÃO PAULO")) return ["SP"];

  return ["MT", "GO", "DF"];
}

/** Cria uma estrutura padrão rica quando o representante ainda não possui cadastro */
export function buildDefaultStructure(rep: {
  id: string;
  nome: string;
  representacao?: string | null;
  regiao?: string | null;
  outras_marcas?: string | null;
}): RepStructure {
  const estados = parseEstadosRegiao(rep.regiao);
  const marcas = parseMarcasTexto(rep.outras_marcas);

  const defaultEquipe: MembroEquipe[] = [
    {
      id: "member-1",
      nome: rep.nome,
      cargo: "Representante Titular / Gestor Comercial",
      responsabilidades: [
        "Negociações estratégicas",
        "Abertura de contas-chave",
        "Visitas a especificadores e lojistas",
      ],
      vinculo: "socio",
      modalidade: "hibrido",
      nivel: "titular",
    },
    {
      id: "member-2",
      nome: "Assistente Comercial & Pedidos",
      cargo: "Atendimento e Operação",
      responsabilidades: [
        "Digitação e acompanhamento de pedidos",
        "Cotações e consulta de estoque",
        "Suporte diário ao lojista",
      ],
      vinculo: "clt",
      modalidade: "presencial",
      nivel: "operacao",
    },
    {
      id: "member-3",
      nome: "Suporte Técnico & Pós-Venda",
      cargo: "Especificação & Assistência",
      responsabilidades: [
        "Compatibilização técnica",
        "Acompanhamento de garantias e trocas",
        "Suporte em projetos luminotécnicos",
      ],
      vinculo: "pj",
      modalidade: "remoto",
      nivel: "apoio",
    },
  ];

  const defaultRecursos: RecursosOperacionais = {
    estrutura_administrativa: true,
    atendimento_comercial: true,
    suporte_clientes: true,
    apoio_tecnico: true,
    gestao_pedidos: true,
    pos_venda: true,
    observacoes: "Equipe com rotina de alinhamento semanal e suporte contínuo via WhatsApp e telefone.",
  };

  return {
    representative_id: rep.id,
    nome_representante: rep.nome,
    empresa_representacao: rep.representacao || `${rep.nome} Representações Comerciais`,
    cidade_base: estados[0] === "MT" ? "Cuiabá" : estados[0] === "BA" ? "Salvador" : "Goiânia",
    estado_base: estados[0] || "MT",
    regiao_principal: rep.regiao || "Centro-Oeste",
    modelo_atuacao: "equipe",
    estados_atendidos: estados,
    detalhes_municipais: {
      [estados[0] || "MT"]: { tipo: "todos", descricao: "Cobertura integral de todas as mesorregiões" },
    },
    marcas_representadas: marcas,
    modelo_escritorio: "escritorio_fisico",
    recursos_operacionais: defaultRecursos,
    equipe: defaultEquipe,
    observacoes_gerais: "Operação estruturada com atendimento em campo e retaguarda de backoffice fixa.",
  };
}

/** Carrega os dados da estrutura de um representante (Supabase -> LocalStorage -> Default) */
export async function loadRepStructure(rep: {
  id: string;
  nome: string;
  representacao?: string | null;
  regiao?: string | null;
  outras_marcas?: string | null;
}): Promise<RepStructure> {
  // 1. Tenta carregar do Supabase
  try {
    const { data, error } = await (supabase as any)
      .from("rep_structures")
      .select("*")
      .eq("representative_id", rep.id)
      .maybeSingle();

    if (!error && data) {
      return {
        representative_id: rep.id,
        nome_representante: rep.nome,
        empresa_representacao: data.empresa_representacao ?? rep.representacao ?? "",
        cidade_base: data.cidade_base ?? "",
        estado_base: data.estado_base ?? "",
        regiao_principal: data.regiao_principal ?? rep.regiao ?? "",
        modelo_atuacao: data.modelo_atuacao ?? "equipe",
        estados_atendidos: Array.isArray(data.estados_atendidos) ? data.estados_atendidos : [],
        detalhes_municipais: data.detalhes_municipais ?? {},
        marcas_representadas: Array.isArray(data.marcas_representadas) ? data.marcas_representadas : [],
        modelo_escritorio: data.modelo_escritorio ?? "escritorio_fisico",
        recursos_operacionais: data.recursos_operacionais ?? {
          estrutura_administrativa: false,
          atendimento_comercial: false,
          suporte_clientes: false,
          apoio_tecnico: false,
          gestao_pedidos: false,
          pos_venda: false,
        },
        equipe: Array.isArray(data.equipe) ? data.equipe : [],
        observacoes_gerais: data.observacoes_gerais ?? "",
        updated_at: data.updated_at,
      };
    }
  } catch (err) {
    console.warn("[loadRepStructure] Supabase table query failed, trying local fallback:", err);
  }

  // 2. Fallback no LocalStorage
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(getLocalKey(rep.id));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.representative_id === rep.id) {
          return {
            ...parsed,
            nome_representante: rep.nome,
          };
        }
      }
    } catch {
      // Ignora erro de JSON parse
    }
  }

  // 3. Fallback inteligente pré-populado
  const defaultStruct = buildDefaultStructure(rep);
  return defaultStruct;
}

/** Salva a estrutura do representante (Supabase + LocalStorage) */
export async function saveRepStructure(structure: RepStructure): Promise<void> {
  // Salva no LocalStorage imediatamente para garantir persistência local rápida
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(getLocalKey(structure.representative_id), JSON.stringify(structure));
    } catch (e) {
      console.warn("[saveRepStructure] LocalStorage save failed:", e);
    }
  }

  // Tenta persistir no Supabase
  try {
    const payload = {
      representative_id: structure.representative_id,
      empresa_representacao: structure.empresa_representacao || null,
      cidade_base: structure.cidade_base || null,
      estado_base: structure.estado_base || null,
      regiao_principal: structure.regiao_principal || null,
      modelo_atuacao: structure.modelo_atuacao,
      estados_atendidos: structure.estados_atendidos,
      detalhes_municipais: structure.detalhes_municipais,
      marcas_representadas: structure.marcas_representadas,
      modelo_escritorio: structure.modelo_escritorio,
      recursos_operacionais: structure.recursos_operacionais,
      equipe: structure.equipe,
      observacoes_gerais: structure.observacoes_gerais || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await (supabase as any)
      .from("rep_structures")
      .upsert(payload, { onConflict: "representative_id" });

    if (error) {
      console.warn("[saveRepStructure] Supabase upsert error (fallback kept in localStorage):", error.message);
    }
  } catch (err) {
    console.warn("[saveRepStructure] Supabase network/schema exception (fallback kept in localStorage):", err);
  }
}
