import { supabase } from "@/integrations/supabase/client";
import {
  saveBrandsToLibrary,
  syncSharedBrandLibrary,
  findBrandLogo,
  fillMissingLogos,
} from "./brand-library";
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
    "AC",
    "AL",
    "AP",
    "AM",
    "BA",
    "CE",
    "DF",
    "ES",
    "GO",
    "MA",
    "MT",
    "MS",
    "MG",
    "PA",
    "PB",
    "PR",
    "PE",
    "PI",
    "RJ",
    "RN",
    "RS",
    "RO",
    "RR",
    "SC",
    "SP",
    "SE",
    "TO",
  ];

  const upper = regiao.toUpperCase();
  const encontrados = ufs.filter((uf) => {
    const regex = new RegExp(`\\b${uf}\\b`);
    return regex.test(upper);
  });

  if (encontrados.length > 0) return encontrados;

  if (upper.includes("BAHIA")) return ["BA", "SE"];
  if (upper.includes("CENTRO-OESTE") || upper.includes("CENTRO OESTE"))
    return ["MT", "GO", "DF", "MS"];
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
  const isDemo = (i: ClienteFrequenciaItem) =>
    LEGACY_DEMO_CLIENTES.has((i.cliente_nome || "").trim().toLowerCase());
  return list.filter(isDemo).length >= 5 ? list.filter((i) => !isDemo(i)) : list;
}

const LEGACY_DEMO_BASES: Record<string, string> = { goiânia: "GO", salvador: "BA", cuiabá: "MT" };

/** Descarta a base inventada por versões antigas (cidade padrão com UF que não confere). */
export function sanitizeBase(cidade?: string | null, uf?: string | null) {
  const c = (cidade ?? "").trim();
  const u = (uf ?? "").trim().toUpperCase();
  const legacyUf = LEGACY_DEMO_BASES[c.toLowerCase()];
  if (legacyUf && u !== legacyUf) return { cidade_base: "", estado_base: "" };
  return { cidade_base: c, estado_base: u };
}

function cleanLegacyLocal(d: RepStructure): RepStructure {
  return {
    ...d,
    ...sanitizeBase(d.cidade_base, d.estado_base),
    frequencia_visitas: stripLegacyDemoFrequencia(d.frequencia_visitas),
  };
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
    observacoes:
      "Equipe com rotina de alinhamento semanal e suporte contínuo via WhatsApp e telefone.",
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
      [estados[0] || "MT"]: {
        tipo: "todos",
        descricao: "Cobertura integral de todas as mesorregiões",
        dias_campo_mes: 12,
      },
      ...(estados[1]
        ? { [estados[1]]: { tipo: "todos", descricao: "Atendimento regional", dias_campo_mes: 8 } }
        : {}),
      ...(estados[2]
        ? { [estados[2]]: { tipo: "todos", descricao: "Atendimento regional", dias_campo_mes: 4 } }
        : {}),
    },
    dias_campo_por_estado: estados.reduce(
      (acc, uf, idx) => {
        acc[uf] = idx === 0 ? 12 : idx === 1 ? 8 : idx === 2 ? 4 : 5;
        return acc;
      },
      {} as Record<string, number>,
    ),
    marcas_representadas: marcas,
    modelo_escritorio: "escritorio_fisico",
    recursos_operacionais: defaultRecursos,
    equipe: defaultEquipe,
    observacoes_gerais:
      "Operação estruturada com atendimento em campo e retaguarda de backoffice fixa.",
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
      observacoes:
        "Migração consistente de contas Silver para Gold e ampliação de contas estratégicas Black.",
    },
  };
}

type RepLite = {
  id: string;
  nome: string;
  representacao?: string | null;
  regiao?: string | null;
  outras_marcas?: string | null;
};

/**
 * O banco (rep_structures) é a fonte da verdade. O localStorage guarda apenas uma cópia
 * PENDENTE quando a gravação no banco falhou; ela é reenviada na próxima carga e removida
 * assim que o banco confirma.
 */
function readPendingLocal(repId: string): RepStructure | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getLocalKey(repId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.representative_id === repId ? (parsed as RepStructure) : null;
  } catch {
    return null; // JSON corrompido: ignora a cópia local
  }
}

function clearPendingLocal(repId: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(getLocalKey(repId));
  } catch {
    // storage indisponível: nada a limpar
  }
}

function isNewer(a?: string | null, b?: string | null): boolean {
  const ta = a ? Date.parse(a) : NaN;
  const tb = b ? Date.parse(b) : NaN;
  if (Number.isNaN(ta)) return false;
  return Number.isNaN(tb) || ta > tb;
}

/** Converte uma linha de rep_structures em RepStructure (colunas novas > legado em recursos_operacionais). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function rowToStructure(row: any, rep: RepLite): RepStructure {
  const legacy = row.recursos_operacionais ?? {};
  const dias: Record<string, number> = {
    ...(legacy.dias_campo_por_estado ?? {}),
    ...(row.dias_campo_por_estado ?? {}),
  };
  if (row.detalhes_municipais && typeof row.detalhes_municipais === "object") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Object.entries(row.detalhes_municipais).forEach(([uf, d]: [string, any]) => {
      if (typeof d?.dias_campo_mes === "number" && dias[uf] === undefined)
        dias[uf] = d.dias_campo_mes;
    });
  }
  const arr = <T>(...cands: unknown[]): T[] => {
    for (const c of cands) if (Array.isArray(c)) return c as T[];
    return [];
  };
  const {
    frequencia_visitas: _fv,
    frequencia_demais_clientes: _fd,
    treinamentos: _tr,
    dias_campo_por_estado: _dc,
    performance_comparativo: _pc,
    ranking_clientes_comparativo: _rc,
    infographic_url: _iu,
    infographic_updated_at: _iua,
    ...recursos
  } = legacy;

  return {
    representative_id: rep.id,
    nome_representante: rep.nome,
    empresa_representacao: row.empresa_representacao ?? rep.representacao ?? "",
    ...sanitizeBase(row.cidade_base, row.estado_base),
    regiao_principal: row.regiao_principal ?? rep.regiao ?? "",
    modelo_atuacao: row.modelo_atuacao ?? "equipe",
    estados_atendidos: Array.isArray(row.estados_atendidos) ? row.estados_atendidos : [],
    detalhes_municipais: row.detalhes_municipais ?? {},
    dias_campo_por_estado: dias,
    marcas_representadas: arr(row.marcas_representadas),
    modelo_escritorio: row.modelo_escritorio ?? "escritorio_fisico",
    recursos_operacionais: {
      estrutura_administrativa: false,
      atendimento_comercial: false,
      suporte_clientes: false,
      apoio_tecnico: false,
      gestao_pedidos: false,
      pos_venda: false,
      ...recursos,
    },
    equipe: arr(row.equipe),
    observacoes_gerais: row.observacoes_gerais ?? "",
    treinamentos: arr(row.treinamentos, legacy.treinamentos),
    frequencia_visitas: stripLegacyDemoFrequencia(
      arr(row.frequencia_visitas, legacy.frequencia_visitas),
    ),
    frequencia_demais_clientes:
      typeof row.frequencia_demais_clientes === "number"
        ? row.frequencia_demais_clientes
        : typeof legacy.frequencia_demais_clientes === "number"
          ? legacy.frequencia_demais_clientes
          : 60,
    performance_comparativo:
      row.performance_comparativo ?? legacy.performance_comparativo ?? undefined,
    ranking_clientes_comparativo:
      row.ranking_clientes_comparativo ?? legacy.ranking_clientes_comparativo ?? undefined,
    infographic_url: row.infographic_url ?? legacy.infographic_url ?? undefined,
    infographic_updated_at:
      row.infographic_updated_at ?? legacy.infographic_updated_at ?? undefined,
    updated_at: row.updated_at,
  };
}

/** Decide entre a linha do banco e a cópia pendente local; reenvia a local se for mais nova. */
function resolveStructure(
  row: unknown | undefined,
  rep: RepLite,
  pendingSync: (s: RepStructure) => void,
): RepStructure {
  const local = readPendingLocal(rep.id);
  const fromDb = row ? rowToStructure(row, rep) : null;

  if (local && (!fromDb || isNewer(local.updated_at, fromDb.updated_at))) {
    const merged = cleanLegacyLocal({ ...local, nome_representante: rep.nome });
    pendingSync(merged);
    return merged;
  }
  if (local) clearPendingLocal(rep.id); // banco já está à frente: descarta cópia obsoleta
  return fromDb ?? buildDefaultStructure(rep);
}

/** Carrega a estrutura de um representante a partir do banco. */
export async function loadRepStructure(rep: RepLite): Promise<RepStructure> {
  const [{ data, error }] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("rep_structures").select("*"),
    syncSharedBrandLibrary(),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: any[] = !error && Array.isArray(data) ? data : [];
  const own = rows.find((r) => r.representative_id === rep.id);
  const base = resolveStructure(own, rep, (s) => void saveRepStructure(s).catch(() => {}));

  // Completa logos ausentes com as de outras estruturas já gravadas no banco.
  const pool = rows.flatMap((r) =>
    Array.isArray(r.marcas_representadas) ? r.marcas_representadas : [],
  );
  return { ...base, marcas_representadas: fillMissingLogos(base.marcas_representadas ?? [], pool) };
}

/** Salva a estrutura no banco. Retorna `false` se o banco não confirmou (cópia fica pendente local). */
export async function saveRepStructure(structure: RepStructure): Promise<boolean> {
  const nowIso = new Date().toISOString();
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

  const repNome = structure.nome_representante || structure.empresa_representacao;
  const marcas = structure.marcas_representadas ?? [];
  // Biblioteca compartilhada de marcas/logomarcas (banco + cache).
  void saveBrandsToLibrary(marcas, repNome);

  // Mantém representatives.outras_marcas sincronizado com as marcas da estrutura.
  try {
    const nomesMarcas = marcas
      .map((m) => m.nome?.trim())
      .filter(Boolean)
      .join(", ");
    if (nomesMarcas) {
      await supabase
        .from("representatives")
        .update({ outras_marcas: nomesMarcas })
        .eq("id", structure.representative_id);
    }
  } catch (err) {
    console.warn("[saveRepStructure] representatives.outras_marcas update error:", err);
  }

  const markPending = () => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(
        getLocalKey(structure.representative_id),
        JSON.stringify(structureToSave),
      );
    } catch (e) {
      console.warn("[saveRepStructure] Falha ao guardar cópia pendente:", e);
    }
  };

  try {
    const { data: sess } = await supabase.auth.getSession();
    const payload = {
      representative_id: structure.representative_id,
      empresa_representacao: structure.empresa_representacao || null,
      cidade_base: structure.cidade_base || null,
      estado_base: structure.estado_base || null,
      regiao_principal: structure.regiao_principal || null,
      modelo_atuacao: structure.modelo_atuacao,
      estados_atendidos: structure.estados_atendidos,
      detalhes_municipais: detalhesMunicipaisSync,
      marcas_representadas: marcas,
      modelo_escritorio: structure.modelo_escritorio,
      recursos_operacionais: structure.recursos_operacionais ?? {},
      equipe: structure.equipe ?? [],
      observacoes_gerais: structure.observacoes_gerais || null,
      treinamentos: structure.treinamentos ?? [],
      frequencia_visitas: structure.frequencia_visitas ?? [],
      frequencia_demais_clientes: structure.frequencia_demais_clientes ?? null,
      dias_campo_por_estado: structure.dias_campo_por_estado ?? {},
      performance_comparativo: structure.performance_comparativo ?? null,
      ranking_clientes_comparativo: structure.ranking_clientes_comparativo ?? null,
      infographic_url: structure.infographic_url ?? null,
      infographic_updated_at: structure.infographic_updated_at ?? null,
      updated_by: sess.session?.user.id ?? null,
      updated_at: nowIso,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("rep_structures")
      .upsert(payload, { onConflict: "representative_id" });
    if (error) {
      console.warn("[saveRepStructure] Falha ao gravar no banco:", error.message);
      markPending();
      return false;
    }
    clearPendingLocal(structure.representative_id);
    return true;
  } catch (err) {
    console.warn("[saveRepStructure] Exceção ao gravar no banco:", err);
    markPending();
    return false;
  }
}

/** Carrega as estruturas de todos os representantes informados (banco = fonte da verdade). */
export async function loadAllRepStructures(
  reps: (RepLite & { email?: string | null; telefone?: string | null })[],
): Promise<Record<string, RepStructure>> {
  const result: Record<string, RepStructure> = {};
  if (!reps || reps.length === 0) return result;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = [];
  try {
    const [{ data, error }] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any).from("rep_structures").select("*"),
      syncSharedBrandLibrary(),
    ]);
    if (!error && Array.isArray(data)) rows = data;
  } catch (e) {
    console.warn("[loadAllRepStructures] Falha ao consultar o banco:", e);
  }
  const byRep = new Map(rows.map((r) => [r.representative_id, r]));

  const toSync: RepStructure[] = [];
  for (const rep of reps) {
    result[rep.id] = resolveStructure(byRep.get(rep.id), rep, (s) => toSync.push(s));
  }
  // Reenvio sequencial das cópias pendentes (não bloqueia a renderização).
  void (async () => {
    for (const s of toSync) await saveRepStructure(s).catch(() => false);
  })();

  const logoPool = Object.values(result).flatMap((st) => st.marcas_representadas ?? []);
  for (const st of Object.values(result)) {
    st.marcas_representadas = fillMissingLogos(st.marcas_representadas ?? [], logoPool);
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
    await (supabase as any).from("rep_structures").delete().eq("representative_id", repId);
  } catch (err) {
    console.warn("[deleteRepStructure] Supabase rep_structures delete failed:", err);
  }

  // 3. Remove de representatives
  const { error } = await supabase.from("representatives").delete().eq("id", repId);

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
    dias_campo_por_estado: params.dias_campo_por_estado || defaultBase.dias_campo_por_estado || {},
    detalhes_municipais:
      params.detalhes_municipais ||
      (params.estados_atendidos && params.estados_atendidos.length > 0
        ? params.estados_atendidos.reduce(
            (acc, uf) => {
              acc[uf] = {
                tipo: "todos",
                descricao: "Cobertura integral",
                dias_campo_mes: params.dias_campo_por_estado?.[uf] ?? 0,
              };
              return acc;
            },
            {} as Record<string, import("./types").DetalheMunicipal>,
          )
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
              responsabilidades: [
                "Negociações estratégicas",
                "Abertura de contas-chave",
                "Atendimento em campo",
              ],
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

/** Verifica se a tabela `rep_structures` responde no banco; devolve a mensagem de erro ou null. */
export async function checkRepStructuresTable(): Promise<string | null> {
  try {
    const { error } = await (supabase as any)
      .from("rep_structures")
      .select("representative_id", { head: true, count: "exact" });
    return error ? error.message : null;
  } catch (err: any) {
    return err?.message ?? "Falha de rede";
  }
}
