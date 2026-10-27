import { supabase } from "@/integrations/supabase/client";
import { saveBrandToLibrary, findBrandLogo } from "./brand-library";
import type {
  RepStructure,
  RepresentadaItem,
  MembroEquipe,
  RecursosOperacionais,
  TreinamentoItem,
  ClienteFrequenciaItem,
} from "./types";

const LOCAL_STORAGE_PREFIX = "estrutura_rep_";

export function getLocalKey(repId: string): string {
  return `${LOCAL_STORAGE_PREFIX}${repId}`;
}

/** Extrai marcas de texto livre como "Stella, Brilha, Pampa" para itens estruturados */
function parseMarcasTexto(outrasMarcas?: string | null): RepresentadaItem[] {
  const newlineLogo = findBrandLogo("Newline Iluminação");
  const marcas: RepresentadaItem[] = [
    {
      id: "brand-newline",
      nome: "Newline Iluminação",
      logo_url: newlineLogo,
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
    const logoUrl = findBrandLogo(nome);
    marcas.push({
      id: `brand-extra-${idx}`,
      nome,
      logo_url: logoUrl,
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


const LEGACY_DEMO_CLIENTES = new Set([
  "ilustre iluminação",
  "luz & arte conceito",
  "center luz distribuidora",
  "eletro nobre iluminação",
  "brilho real conceito",
  "studio luz arquitetura",
  "design & luz projetos",
  "solar iluminação técnica",
  "luminar prime",
  "ponto da luz decorações",
]);

/** Remove o Top 10 fictício que versões antigas gravaram como padrão no cadastro. */
export function stripLegacyDemoFrequencia(
  items: ClienteFrequenciaItem[] | undefined,
): ClienteFrequenciaItem[] {
  const list = Array.isArray(items) ? items : [];
  const demo = list.filter((i) =>
    LEGACY_DEMO_CLIENTES.has((i.cliente_nome || "").trim().toLowerCase()),
  );
  return demo.length >= 5 && demo.length === list.length ? [] : list;
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

  const defaultTreinamentos: TreinamentoItem[] = [
    {
      id: "train-1",
      tipo: "mini_palestra",
      cliente_nome: "Ilustre Iluminação & Design",
      data: "2026-10-24",
      horario: "09:00",
      local: "Showroom da Loja",
      observacoes: "Apresentação dos lançamentos Newline e diferenciais ópticos",
    },
    {
      id: "train-2",
      tipo: "papo_mesa_a_mesa",
      cliente_nome: "Luz & Arte Conceito",
      data: "2026-11-05",
      horario: "14:30",
      local: "Mesa técnica da equipe de vendas",
      observacoes: "Tira-dúvidas sobre perfilados, trilhos e fitas LED",
    },
    {
      id: "train-3",
      tipo: "trade_nl",
      cliente_nome: "Center Luz Distribuidora",
      data: "2026-11-18",
      horario: "10:00",
      local: "Auditório Principal",
      observacoes: "Alinhamento com vendedores internos e balcão de atendimento",
    },
    {
      id: "train-4",
      tipo: "rep_vendedores_arquitetos",
      cliente_nome: "Ateliê da Luz e Arquitetura",
      data: "2026-12-02",
      horario: "19:00",
      local: "Espaço Gourmet & Projetos",
      observacoes: "Encontro com especificadores e arquitetos parceiros",
    },
  ];

  // Top 10 nunca é inventado: vem da performance real ou do cadastro do representante.
  const defaultFrequenciaVisitas: ClienteFrequenciaItem[] = [];

  return {
    representative_id: rep.id,
    nome_representante: rep.nome,
    empresa_representacao: rep.representacao || `${rep.nome} Representações Comerciais`,
    cidade_base: "",
    estado_base: "",
    regiao_principal: rep.regiao || "Centro-Oeste",
    modelo_atuacao: "equipe",
    estados_atendidos: estados,
    detalhes_municipais: {
      [estados[0] || "MT"]: { tipo: "todos", descricao: "Cobertura integral de todas as mesorregiões", dias_campo_mes: 12 },
      ...(estados[1] ? { [estados[1]]: { tipo: "todos", descricao: "Atendimento regional", dias_campo_mes: 8 } } : {}),
      ...(estados[2] ? { [estados[2]]: { tipo: "todos", descricao: "Atendimento regional", dias_campo_mes: 4 } } : {}),
    },
    dias_campo_por_estado: estados.reduce((acc, uf, idx) => {
      acc[uf] = idx === 0 ? 12 : idx === 1 ? 8 : idx === 2 ? 4 : 5;
      return acc;
    }, {} as Record<string, number>),
    marcas_representadas: marcas,
    modelo_escritorio: "escritorio_fisico",
    recursos_operacionais: defaultRecursos,
    equipe: defaultEquipe,
    observacoes_gerais: "Operação estruturada com atendimento em campo e retaguarda de backoffice fixa.",
    treinamentos: defaultTreinamentos,
    frequencia_visitas: defaultFrequenciaVisitas,
    frequencia_demais_clientes: 60,
    performance_comparativo: {
      ano_anterior_label: "2025",
      ano_anterior_valor: 1850000,
      ano_atual_label: "2026",
      ano_atual_valor: 2140000,
      meta_ano_atual: 2500000,
      ano_base: 2025,
      ano_comparado: 2026,
      mes_inicio: 1,
      mes_fim: 10,
      meses_selecionados: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      periodo_label: "Jan a Out",
      observacoes: "Crescimento sustentado com expansão em contas-chave",
    },
    ranking_clientes_comparativo: {
      periodo_1: {
        label: "2025 (Ano Completo)",
        ano: 2025,
        periodo_meses: "Ano Completo",
        qtd_silver: 18,
        qtd_gold: 8,
        qtd_black: 3,
      },
      periodo_2: {
        label: "2026 (Jan - Out)",
        ano: 2026,
        periodo_meses: "Jan a Out",
        qtd_silver: 22,
        qtd_gold: 11,
        qtd_black: 5,
      },
      observacoes: "Migração consistente de contas Silver para Gold e ampliação de contas estratégicas Black.",
    },
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
  const defaultStruct = buildDefaultStructure(rep);

  // 1. Busca LocalStorage previamente para reconciliação
  let localData: RepStructure | null = null;
  if (typeof window !== "undefined") {
    try {
      const raw = localStorage.getItem(getLocalKey(rep.id));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.representative_id === rep.id) {
          localData = {
            ...parsed,
            nome_representante: rep.nome,
            treinamentos:
              Array.isArray(parsed.treinamentos) && parsed.treinamentos.length > 0
                ? parsed.treinamentos
                : defaultStruct.treinamentos,
            frequencia_visitas:
              Array.isArray(parsed.frequencia_visitas) && parsed.frequencia_visitas.length > 0
                ? parsed.frequencia_visitas
                : defaultStruct.frequencia_visitas,
            frequencia_demais_clientes:
              typeof parsed.frequencia_demais_clientes === "number"
                ? parsed.frequencia_demais_clientes
                : (parsed.recursos_operacionais?.frequencia_demais_clientes ?? 60),
          };
        }
      }
    } catch {}
  }

  // 2. Tenta carregar do Supabase
  try {
    const { data, error } = await (supabase as any)
      .from("rep_structures")
      .select("*")
      .eq("representative_id", rep.id)
      .maybeSingle();

    if (!error && data) {
      const dbMarcas = Array.isArray(data.marcas_representadas) ? data.marcas_representadas : [];
      const marcasFinais =
        localData?.marcas_representadas && localData.marcas_representadas.length > 0 && dbMarcas.length === 0
          ? localData.marcas_representadas
          : dbMarcas;

      const dbTreinamentos = Array.isArray(data.treinamentos) ? data.treinamentos : [];
      const treinamentosFinais =
        dbTreinamentos.length > 0
          ? dbTreinamentos
          : localData?.treinamentos ?? defaultStruct.treinamentos;

      const dbFreq = Array.isArray(data.frequencia_visitas)
        ? data.frequencia_visitas
        : Array.isArray(data.recursos_operacionais?.frequencia_visitas)
          ? data.recursos_operacionais.frequencia_visitas
          : [];
      const freqFinais =
        dbFreq.length > 0
          ? dbFreq
          : localData?.frequencia_visitas ?? defaultStruct.frequencia_visitas;

      const freqDemais =
        typeof data.frequencia_demais_clientes === "number"
          ? data.frequencia_demais_clientes
          : typeof data.recursos_operacionais?.frequencia_demais_clientes === "number"
            ? data.recursos_operacionais.frequencia_demais_clientes
            : localData?.frequencia_demais_clientes ?? 60;

      const diasCampo: Record<string, number> = {
        ...(data.dias_campo_por_estado ?? data.recursos_operacionais?.dias_campo_por_estado ?? localData?.dias_campo_por_estado ?? {}),
      };
      if (data.detalhes_municipais && typeof data.detalhes_municipais === "object") {
        Object.entries(data.detalhes_municipais).forEach(([uf, d]: [string, any]) => {
          if (typeof d?.dias_campo_mes === "number" && diasCampo[uf] === undefined) {
            diasCampo[uf] = d.dias_campo_mes;
          }
        });
      }

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
        dias_campo_por_estado: Object.keys(diasCampo).length > 0 ? diasCampo : defaultStruct.dias_campo_por_estado,
        marcas_representadas: marcasFinais,
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
        treinamentos: treinamentosFinais,
        frequencia_visitas: stripLegacyDemoFrequencia(freqFinais),
        frequencia_demais_clientes: freqDemais,
        performance_comparativo:
          data.performance_comparativo ??
          data.recursos_operacionais?.performance_comparativo ??
          localData?.performance_comparativo,
        ranking_clientes_comparativo:
          data.ranking_clientes_comparativo ??
          data.recursos_operacionais?.ranking_clientes_comparativo ??
          localData?.ranking_clientes_comparativo,
        infographic_url:
          data.infographic_url ??
          data.recursos_operacionais?.infographic_url ??
          localData?.infographic_url,
        infographic_updated_at:
          data.infographic_updated_at ??
          data.recursos_operacionais?.infographic_updated_at ??
          localData?.infographic_updated_at,
        updated_at: data.updated_at,
      };
    }
  } catch (err) {
    console.warn("[loadRepStructure] Supabase table query failed, trying local fallback:", err);
  }

  // 3. Fallback no LocalStorage
  if (localData) {
    return localData;
  }

  // 4. Fallback inteligente pré-populado
  return defaultStruct;
}

/** Salva a estrutura do representante (Supabase + LocalStorage) */
export async function saveRepStructure(structure: RepStructure): Promise<void> {
  const nowIso = new Date().toISOString();
  // Sincroniza dias_campo_mes em detalhes_municipais
  const detalhesMunicipaisSync = { ...(structure.detalhes_municipais || {}) };
  if (structure.dias_campo_por_estado) {
    Object.entries(structure.dias_campo_por_estado).forEach(([uf, dias]) => {
      detalhesMunicipaisSync[uf] = {
        ...(detalhesMunicipaisSync[uf] || { tipo: "todos", descricao: "Cobertura integral" }),
        dias_campo_mes: dias,
      };
    });
  }

  const structureToSave: RepStructure = {
    ...structure,
    detalhes_municipais: detalhesMunicipaisSync,
    updated_at: nowIso,
  };

  // 1. Salva no LocalStorage imediatamente para garantir persistência local rápida e sem falhas
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(
        getLocalKey(structure.representative_id),
        JSON.stringify(structureToSave)
      );
    } catch (e) {
      console.warn("[saveRepStructure] LocalStorage save failed:", e);
    }
  }

  // 2. Registra as marcas no catálogo compartilhado para ficarem disponíveis para outros representantes
  if (structure.marcas_representadas && structure.marcas_representadas.length > 0) {
    structure.marcas_representadas.forEach((m) => {
      saveBrandToLibrary(m, structure.nome_representante || structure.empresa_representacao);
    });
  }

  // 3. Atualiza representatives.outras_marcas no Supabase para manter o catálogo do representante sincronizado
  try {
    const nomesMarcas = (structure.marcas_representadas || [])
      .map((m) => m.nome?.trim())
      .filter(Boolean)
      .join(", ");

    if (nomesMarcas) {
      await (supabase as any)
        .from("representatives")
        .update({ outras_marcas: nomesMarcas })
        .eq("id", structure.representative_id);
    }
  } catch (err) {
    console.warn("[saveRepStructure] representatives.outras_marcas update error:", err);
  }

  // 4. Tenta persistir na tabela rep_structures (caso já provisionada no Supabase)
  try {
    const payload = {
      representative_id: structure.representative_id,
      empresa_representacao: structure.empresa_representacao || null,
      cidade_base: structure.cidade_base || null,
      estado_base: structure.estado_base || null,
      regiao_principal: structure.regiao_principal || null,
      modelo_atuacao: structure.modelo_atuacao,
      estados_atendidos: structure.estados_atendidos,
      detalhes_municipais: detalhesMunicipaisSync,
      marcas_representadas: structure.marcas_representadas,
      modelo_escritorio: structure.modelo_escritorio,
      recursos_operacionais: {
        ...structure.recursos_operacionais,
        frequencia_visitas: structure.frequencia_visitas,
        frequencia_demais_clientes: structure.frequencia_demais_clientes,
        treinamentos: structure.treinamentos,
        dias_campo_por_estado: structure.dias_campo_por_estado,
        performance_comparativo: structure.performance_comparativo,
        ranking_clientes_comparativo: structure.ranking_clientes_comparativo,
        infographic_url: structure.infographic_url,
        infographic_updated_at: structure.infographic_updated_at,
      },
      equipe: structure.equipe,
      observacoes_gerais: structure.observacoes_gerais || null,
      updated_at: nowIso,
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

/** Carrega as estruturas de todos os representantes informados */
export async function loadAllRepStructures(reps: {
  id: string;
  nome: string;
  representacao?: string | null;
  regiao?: string | null;
  outras_marcas?: string | null;
  email?: string | null;
  telefone?: string | null;
}[]): Promise<Record<string, RepStructure>> {
  const result: Record<string, RepStructure> = {};
  if (!reps || reps.length === 0) return result;

  let supabaseData: any[] = [];
  try {
    const { data, error } = await (supabase as any)
      .from("rep_structures")
      .select("*");
    if (!error && Array.isArray(data)) {
      supabaseData = data;
    }
  } catch (e) {
    console.warn("[loadAllRepStructures] Batch query failed, using fallbacks:", e);
  }

  const supabaseMap = new Map<string, any>();
  for (const item of supabaseData) {
    if (item.representative_id) {
      supabaseMap.set(item.representative_id, item);
    }
  }

  for (const rep of reps) {
    // 1. Busca dados no localStorage
    let localData: RepStructure | null = null;
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem(getLocalKey(rep.id));
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && parsed.representative_id === rep.id) {
            localData = { ...parsed, nome_representante: rep.nome };
          }
        }
      } catch {}
    }

    const dbItem = supabaseMap.get(rep.id);

    // 2. Se houver item no banco
    if (dbItem) {
      const dbMarcas = Array.isArray(dbItem.marcas_representadas) ? dbItem.marcas_representadas : [];
      // Se o localStorage tiver marcas mais recentes ou o banco estiver com marcas vazias, preserva as marcas locais
      const marcasFinais =
        localData?.marcas_representadas && localData.marcas_representadas.length > 0 && dbMarcas.length === 0
          ? localData.marcas_representadas
          : dbMarcas;

      const dbTreinamentos = Array.isArray(dbItem.treinamentos) ? dbItem.treinamentos : [];
      const treinamentosFinais =
        dbTreinamentos.length > 0
          ? dbTreinamentos
          : localData?.treinamentos ?? buildDefaultStructure(rep).treinamentos;

      const dbFreq = Array.isArray(dbItem.frequencia_visitas)
        ? dbItem.frequencia_visitas
        : Array.isArray(dbItem.recursos_operacionais?.frequencia_visitas)
          ? dbItem.recursos_operacionais.frequencia_visitas
          : [];
      const freqFinais =
        dbFreq.length > 0
          ? dbFreq
          : localData?.frequencia_visitas ?? buildDefaultStructure(rep).frequencia_visitas;

      const freqDemais =
        typeof dbItem.frequencia_demais_clientes === "number"
          ? dbItem.frequencia_demais_clientes
          : typeof dbItem.recursos_operacionais?.frequencia_demais_clientes === "number"
            ? dbItem.recursos_operacionais.frequencia_demais_clientes
            : localData?.frequencia_demais_clientes ?? 60;

      const diasCampo: Record<string, number> = {
        ...(dbItem.dias_campo_por_estado ?? dbItem.recursos_operacionais?.dias_campo_por_estado ?? localData?.dias_campo_por_estado ?? {}),
      };
      if (dbItem.detalhes_municipais && typeof dbItem.detalhes_municipais === "object") {
        Object.entries(dbItem.detalhes_municipais).forEach(([uf, d]: [string, any]) => {
          if (typeof d?.dias_campo_mes === "number" && diasCampo[uf] === undefined) {
            diasCampo[uf] = d.dias_campo_mes;
          }
        });
      }

      result[rep.id] = {
        representative_id: rep.id,
        nome_representante: rep.nome,
        empresa_representacao: dbItem.empresa_representacao ?? rep.representacao ?? "",
        cidade_base: dbItem.cidade_base ?? "",
        estado_base: dbItem.estado_base ?? "",
        regiao_principal: dbItem.regiao_principal ?? rep.regiao ?? "",
        modelo_atuacao: dbItem.modelo_atuacao ?? "equipe",
        estados_atendidos: Array.isArray(dbItem.estados_atendidos) ? dbItem.estados_atendidos : [],
        detalhes_municipais: dbItem.detalhes_municipais ?? {},
        dias_campo_por_estado: Object.keys(diasCampo).length > 0 ? diasCampo : buildDefaultStructure(rep).dias_campo_por_estado,
        marcas_representadas: marcasFinais,
        modelo_escritorio: dbItem.modelo_escritorio ?? "escritorio_fisico",
        recursos_operacionais: dbItem.recursos_operacionais ?? {
          estrutura_administrativa: false,
          atendimento_comercial: false,
          suporte_clientes: false,
          apoio_tecnico: false,
          gestao_pedidos: false,
          pos_venda: false,
        },
        equipe: Array.isArray(dbItem.equipe) ? dbItem.equipe : [],
        observacoes_gerais: dbItem.observacoes_gerais ?? "",
        treinamentos: treinamentosFinais,
        frequencia_visitas: stripLegacyDemoFrequencia(freqFinais),
        frequencia_demais_clientes: freqDemais,
        performance_comparativo:
          dbItem.performance_comparativo ??
          dbItem.recursos_operacionais?.performance_comparativo ??
          localData?.performance_comparativo,
        ranking_clientes_comparativo:
          dbItem.ranking_clientes_comparativo ??
          dbItem.recursos_operacionais?.ranking_clientes_comparativo ??
          localData?.ranking_clientes_comparativo,
        infographic_url:
          dbItem.infographic_url ??
          dbItem.recursos_operacionais?.infographic_url ??
          localData?.infographic_url,
        infographic_updated_at:
          dbItem.infographic_updated_at ??
          dbItem.recursos_operacionais?.infographic_updated_at ??
          localData?.infographic_updated_at,
        updated_at: dbItem.updated_at,
      };
      continue;
    }

    // 3. Se não houver no banco mas houver no localStorage
    if (localData) {
      result[rep.id] = localData;
      continue;
    }

    // 4. Fallback padrão
    result[rep.id] = buildDefaultStructure(rep);
  }

  return result;
}

/** Exclui um representante e toda a sua estrutura associada */
export async function deleteRepStructure(repId: string): Promise<void> {
  // 1. Remove do LocalStorage
  if (typeof window !== "undefined") {
    try {
      localStorage.removeItem(getLocalKey(repId));
    } catch (e) {
      console.warn("[deleteRepStructure] LocalStorage remove failed:", e);
    }
  }

  // 2. Remove de rep_structures
  try {
    await (supabase as any)
      .from("rep_structures")
      .delete()
      .eq("representative_id", repId);
  } catch (err) {
    console.warn("[deleteRepStructure] Supabase rep_structures delete failed:", err);
  }

  // 3. Remove de representatives
  const { error } = await supabase
    .from("representatives")
    .delete()
    .eq("id", repId);

  if (error) {
    throw new Error(error.message);
  }
}

/** Cria um novo representante e sua respectiva estrutura */
export async function createRepresentativeWithStructure(params: {
  nome: string;
  representacao?: string;
  email?: string;
  telefone?: string;
  cidade_base?: string;
  estado_base?: string;
  regiao?: string;
  modelo_atuacao?: import("./types").ModeloAtuacao;
  modelo_escritorio?: import("./types").ModeloEscritorio;
  estados_atendidos?: string[];
  detalhes_municipais?: Record<string, import("./types").DetalheMunicipal>;
  dias_campo_por_estado?: Record<string, number>;
  outras_marcas?: string;
  marcas_representadas?: import("./types").RepresentadaItem[];
  equipe?: import("./types").MembroEquipe[];
  recursos_operacionais?: import("./types").RecursosOperacionais;
}): Promise<RepStructure> {
  const { data: userData } = await supabase.auth.getUser();

  const repPayload: any = {
    nome: params.nome.trim(),
    representacao: params.representacao?.trim() || null,
    email: params.email?.trim() || null,
    telefone: params.telefone?.trim() || null,
    regiao: params.regiao?.trim() || params.estados_atendidos?.join(" / ") || null,
    outras_marcas: params.outras_marcas?.trim() || null,
    created_by: userData.user?.id || null,
  };

  const { data: repData, error: repError } = await supabase
    .from("representatives")
    .insert(repPayload)
    .select("id")
    .single();

  if (repError || !repData?.id) {
    throw new Error(repError?.message || "Erro ao cadastrar representante no banco");
  }

  const newRepId = repData.id;

  const defaultBase = buildDefaultStructure({
    id: newRepId,
    nome: params.nome,
    representacao: params.representacao,
    regiao: params.regiao,
    outras_marcas: params.outras_marcas,
  });

  const structure: RepStructure = {
    ...defaultBase,
    representative_id: newRepId,
    nome_representante: params.nome.trim(),
    empresa_representacao: params.representacao?.trim() || defaultBase.empresa_representacao,
    cidade_base: params.cidade_base?.trim() || defaultBase.cidade_base,
    estado_base: params.estado_base?.trim() || defaultBase.estado_base,
    regiao_principal: params.regiao?.trim() || defaultBase.regiao_principal,
    modelo_atuacao: params.modelo_atuacao || defaultBase.modelo_atuacao,
    modelo_escritorio: params.modelo_escritorio || defaultBase.modelo_escritorio,
    estados_atendidos:
      params.estados_atendidos && params.estados_atendidos.length > 0
        ? params.estados_atendidos
        : defaultBase.estados_atendidos,
    dias_campo_por_estado:
      params.dias_campo_por_estado ||
      defaultBase.dias_campo_por_estado ||
      {},
    detalhes_municipais:
      params.detalhes_municipais ||
      (params.estados_atendidos && params.estados_atendidos.length > 0
        ? params.estados_atendidos.reduce((acc, uf) => {
            acc[uf] = {
              tipo: "todos",
              descricao: "Cobertura integral",
              dias_campo_mes: params.dias_campo_por_estado?.[uf] ?? 0,
            };
            return acc;
          }, {} as Record<string, import("./types").DetalheMunicipal>)
        : defaultBase.detalhes_municipais),
    marcas_representadas:
      params.marcas_representadas && params.marcas_representadas.length > 0
        ? params.marcas_representadas
        : defaultBase.marcas_representadas,
    equipe:
      params.equipe && params.equipe.length > 0
        ? params.equipe
        : [
            {
              id: "member-1",
              nome: params.nome.trim(),
              cargo: "Representante Titular / Gestor Comercial",
              responsabilidades: ["Negociações estratégicas", "Abertura de contas-chave", "Atendimento em campo"],
              vinculo: "socio",
              modalidade: "hibrido",
              nivel: "titular",
            },
          ],
    recursos_operacionais: params.recursos_operacionais || defaultBase.recursos_operacionais,
  };

  await saveRepStructure(structure);
  return structure;
}
