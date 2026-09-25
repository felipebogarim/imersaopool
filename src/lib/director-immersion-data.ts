import type { ImmersionItem, TimeFilterOption } from "./director-immersion-types";

// Projeção Cartográfica Mercator Simplificada do Brasil (viewBox 0 0 800 800)
export const MAP_BOUNDS = {
  minLng: -74.0,
  maxLng: -34.0,
  minLat: -34.0,
  maxLat: 5.5,
  width: 800,
  height: 800,
};

export function latLngToXY(
  lat: number,
  lng: number,
  width = MAP_BOUNDS.width,
  height = MAP_BOUNDS.height,
) {
  const x = ((lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * width;
  const y = height - ((lat - MAP_BOUNDS.minLat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * height;
  return { x, y };
}

export const INITIAL_IMMERSIONS: ImmersionItem[] = [
  {
    id: "immersion-001",
    title: "Imersão Ribeirão Preto & Franca",
    status: "realizada",
    startDate: "2026-09-10",
    endDate: "2026-09-14",
    state: "SP",
    cities: ["Ribeirão Preto", "Sertãozinho", "Franca"],
    regionCovered: "Nordeste Paulista — Polo Calçadista & Agroindustrial",
    cityStops: [
      {
        cityName: "Ribeirão Preto",
        state: "SP",
        lat: -21.1704,
        lng: -47.8103,
        order: 1,
        dayNumber: 1,
      },
      {
        cityName: "Sertãozinho",
        state: "SP",
        lat: -21.1378,
        lng: -47.9897,
        order: 2,
        dayNumber: 2,
      },
      { cityName: "Franca", state: "SP", lat: -20.5386, lng: -47.4008, order: 3, dayNumber: 3 },
    ],
    representatives: [
      {
        id: "rep-001",
        name: "Carlos Eduardo Silva",
        role: "Representante Comercial Sênior",
        region: "Interior SP",
        immersionRole:
          "Acompanhamento e mediação nas visitas aos grandes lojistas de Ribeirão e Franca",
        perceptions:
          "Excelente relacionamento com a diretoria das redes locais; forte abertura para mix premium.",
        keyInsights:
          "Rede local solicita maior agilidade nas entregas de reposição na safra sucroalcooleira.",
        actionPoints: "Ajustar estoque consignado na filial Franca até 15/10.",
      },
      {
        id: "rep-002",
        name: "Roberto Mendes",
        role: "Consultor Técnico de Vendas",
        region: "Alta Mogiana",
        immersionRole: "Apoio técnico e diagnóstico de ponto de venda",
        perceptions: "Lojistas valorizam treinamento técnico para equipes de balcão.",
        keyInsights: "Concorrência oferecendo prazos estendidos de 90 dias sem juros.",
        actionPoints: "Desenvolver cartilha de vendas rápida para atendentes de loja.",
      },
    ],
    clients: [
      {
        id: "cli-101",
        name: "Comercial HidroRibeira Ltda",
        cityName: "Ribeirão Preto",
        state: "SP",
        lat: -21.175,
        lng: -47.815,
        visitDate: "2026-09-10",
        dayNumber: 1,
        scenario:
          "Cliente consolidado na região com 4 lojas físicas. Volume constante de compras de bombas e vinil.",
        opportunities:
          "Ampliação da linha de iluminação LED e produtos químicos de tratamento profissional.",
        threats:
          "Entrada agressiva da marca concorrente 'PiscinaSul' oferecendo bonificação direta.",
        relevantPerceptions:
          "Comprador master busca exclusividade regional para novos lançamentos de automação.",
        nextSteps:
          "Apresentar proposta de exclusividade territorial em linhas smart até final do mês.",
      },
      {
        id: "cli-102",
        name: "Sertão Piscinas & Lazer",
        cityName: "Sertãozinho",
        state: "SP",
        lat: -21.135,
        lng: -47.985,
        visitDate: "2026-09-11",
        dayNumber: 2,
        scenario: "Loja focada em residências de alto padrão e condomínios fechados industriais.",
        opportunities: "Demanda aquecida por aquecedores solares e trocadores de calor inverter.",
        threats: "Falta de apoio de garantia local agilizada em bombas de alta vazão.",
        relevantPerceptions: "Proprietário prioriza pronta entrega sobre desconto de tabela.",
        nextSteps: "Credenciar assistência técnica local parceira em Sertãozinho.",
      },
      {
        id: "cli-103",
        name: "Franca Casa & Jardim",
        cityName: "Franca",
        state: "SP",
        lat: -20.535,
        lng: -47.405,
        visitDate: "2026-09-13",
        dayNumber: 3,
        scenario: "Tradicional home center da Alta Mogiana expandindo setor de piscinas.",
        opportunities: "Introdução da linha de spas compactos e vinil customizado.",
        threats: "Logística de frete para compras fracionadas.",
        relevantPerceptions: "Equipe de vendas necessita de capacitação presencial.",
        nextSteps:
          "Agendar treinamento técnico de produto em Outubro/2026 com o representante local.",
      },
    ],
    objective:
      "Mapear expansão comercial na Alta Mogiana e avaliar concorrência no polo sucroalcooleiro.",
    notes:
      "Imersão concluída com alto engajamento dos lojistas locais e identificação de 3 grandes contas potenciais.",
    createdAt: "2026-09-01T10:00:00Z",
  },
  {
    id: "immersion-002",
    title: "Imersão Campinas & Polo RMC",
    status: "realizada",
    startDate: "2026-06-15",
    endDate: "2026-06-18",
    state: "SP",
    cities: ["Campinas", "Jundiaí", "Piracicaba"],
    regionCovered: "Região Metropolitana de Campinas e Vale do Piracicaba",
    cityStops: [
      { cityName: "Campinas", state: "SP", lat: -22.9099, lng: -47.0626, order: 1, dayNumber: 1 },
      { cityName: "Jundiaí", state: "SP", lat: -23.1857, lng: -46.8892, order: 2, dayNumber: 2 },
      { cityName: "Piracicaba", state: "SP", lat: -22.7253, lng: -47.6492, order: 3, dayNumber: 3 },
    ],
    representatives: [
      {
        id: "rep-003",
        name: "Mariana Alcantara",
        role: "Gerente Regional RMC",
        region: "Campinas e Jundiaí",
        immersionRole: "Articulação com redes de arquitetura e condomínios horizontais",
        perceptions: "Mercado de altíssimo padrão com demanda forte por produtos sustentáveis.",
        keyInsights:
          "Condomínios de Alphaville e Gramado demandam bombas silenciosas e sistemas salinos.",
        actionPoints: "Criar kit catálogo focado no segmento de arquitetos e construtoras.",
      },
    ],
    clients: [
      {
        id: "cli-104",
        name: "Aquaplanet Campinas",
        cityName: "Campinas",
        state: "SP",
        lat: -22.905,
        lng: -47.068,
        visitDate: "2026-06-15",
        dayNumber: 1,
        scenario: "Maior distribuidor da RMC com showroom exclusivo de piscinas.",
        opportunities: "Parceria para ponto focal de lançamentos 2027.",
        threats: "Pressão de margem por compras diretas da fábrica de concorrentes.",
        relevantPerceptions: "Cliente extremamente técnico com equipe própria de engenheiros.",
        nextSteps: "Elaborar plano de bonificação por atingimento de meta trimestral.",
      },
      {
        id: "cli-105",
        name: "Jundiaí Piscinas Premium",
        cityName: "Jundiaí",
        state: "SP",
        lat: -23.18,
        lng: -46.88,
        visitDate: "2026-06-17",
        dayNumber: 2,
        scenario: "Loja boutique focada em projetos residenciais de Alphaville Jundiaí.",
        opportunities: "Venda casada de trocadores de calor com capas térmicas de alta densidade.",
        threats: "Espaço de exposição limitado.",
        relevantPerceptions: "Destaque para a recepção dos revestimentos vinílicos PoolFlux.",
        nextSteps: "Fornecer expositores verticais compactos de amostras.",
      },
    ],
    objective:
      "Consolidar participação em lojas de alto padrão na Região Metropolitana de Campinas.",
    notes: "Foco atingido. Parceria fortalecida em Campinas e Jundiaí.",
    createdAt: "2026-06-01T09:00:00Z",
  },
  {
    id: "immersion-003",
    title: "Imersão Curitiba & Norte do Paraná",
    status: "realizada",
    startDate: "2026-03-05",
    endDate: "2026-03-09",
    state: "PR",
    cities: ["Curitiba", "Londrina", "Maringá"],
    regionCovered: "Capital Paranaense e Eixo Agro Norte (Londrina-Maringá)",
    cityStops: [
      { cityName: "Curitiba", state: "PR", lat: -25.4284, lng: -49.2733, order: 1, dayNumber: 1 },
      { cityName: "Londrina", state: "PR", lat: -23.3045, lng: -51.1696, order: 2, dayNumber: 2 },
      { cityName: "Maringá", state: "PR", lat: -23.4209, lng: -51.9331, order: 3, dayNumber: 3 },
    ],
    representatives: [
      {
        id: "rep-004",
        name: "Fernando Becker",
        role: "Representante Paranaense",
        region: "Paraná Integral",
        immersionRole: "Abertura de novos distribuidores no Norte do Estado",
        perceptions:
          "Região agro com alto poder aquisitivo e foco em aquecimento térmico devido ao clima frio.",
        keyInsights: "Demanda por aquecimento de água durante 8 meses do ano.",
        actionPoints: "Campanha pré-inverno focada em trocadores de calor no PR.",
      },
    ],
    clients: [
      {
        id: "cli-106",
        name: "Sul Piscinas & TermoCuritiba",
        cityName: "Curitiba",
        state: "PR",
        lat: -25.43,
        lng: -49.27,
        visitDate: "2026-03-05",
        dayNumber: 1,
        scenario:
          "Líder regional em sistemas de aquecimento para piscinas coletivas e residenciais.",
        opportunities: "Fornecimento de bombas de calor de alta eficiência.",
        threats: "Produtos importados com câmbio agressivo.",
        relevantPerceptions: "Marca PoolFlux reconhecida pela durabilidade.",
        nextSteps: "Homologar novos modelos de trocadores térmicos.",
      },
      {
        id: "cli-107",
        name: "AgroLazer Londrina",
        cityName: "Londrina",
        state: "PR",
        lat: -23.31,
        lng: -51.17,
        visitDate: "2026-03-08",
        dayNumber: 2,
        scenario: "Atende chácaras de lazer e condomínios rurais na região de Londrina.",
        opportunities: "Kits completos de filtragem para grandes volumes.",
        threats: "Custo de transporte a partir da fábrica central.",
        relevantPerceptions: "Interesse em centro de distribuição parceiro em Curitiba.",
        nextSteps: "Estudar viabilidade de CD avançado no PR.",
      },
    ],
    objective: "Avaliar potencial de aquecimento no Sul e abertura de canais agro no Norte do PR.",
    notes: "Imersão com excelentes diagnósticos sobre aquecimento térmico.",
    createdAt: "2026-02-20T08:00:00Z",
  },
  {
    id: "immersion-004",
    title: "Imersão Belo Horizonte & Sul de Minas",
    status: "planejada",
    startDate: "2026-10-15",
    endDate: "2026-10-19",
    state: "MG",
    cities: ["Belo Horizonte", "Varginha", "Pouso Alegre"],
    regionCovered: "Grande BH e Circuito Sul Mineiro",
    cityStops: [
      {
        cityName: "Belo Horizonte",
        state: "MG",
        lat: -19.9167,
        lng: -43.9345,
        order: 1,
        dayNumber: 1,
      },
      { cityName: "Varginha", state: "MG", lat: -21.5514, lng: -45.4322, order: 2, dayNumber: 2 },
      { cityName: "Pouso Alegre", state: "MG", lat: -22.23, lng: -45.93, order: 3, dayNumber: 3 },
    ],
    representatives: [
      {
        id: "rep-005",
        name: "Juliana Camargo",
        role: "Representante Minas Gerais",
        region: "MG Central e Sul",
        immersionRole: "Organização da agenda executiva com os 10 maiores compradores mineiros",
      },
    ],
    clients: [],
    objective:
      "Mapear o mercado em expansão do Sul de Minas e reestruturar distribuição na Grande BH.",
    notes: "Imersão planejada para Outubro/2026. Equipe comercial mineira já confirmada.",
    createdAt: "2026-09-15T14:00:00Z",
  },
  {
    id: "immersion-005",
    title: "Imersão Vale do Itajaí & Joinville",
    status: "planejada",
    startDate: "2026-11-10",
    endDate: "2026-11-13",
    state: "SC",
    cities: ["Joinville", "Blumenau", "Itajaí"],
    regionCovered: "Norte Catarinense e Vale do Itajaí",
    cityStops: [
      { cityName: "Joinville", state: "SC", lat: -26.3045, lng: -48.8487, order: 1, dayNumber: 1 },
      { cityName: "Blumenau", state: "SC", lat: -26.9194, lng: -49.0661, order: 2, dayNumber: 2 },
      { cityName: "Itajaí", state: "SC", lat: -26.9078, lng: -48.6619, order: 3, dayNumber: 3 },
    ],
    representatives: [
      {
        id: "rep-006",
        name: "Lucas Zimmermann",
        role: "Representante Santa Catarina",
        region: "Litoral Norte e Vale",
        immersionRole: "Prospecção de lojas focadas no litoral catarinense",
      },
    ],
    clients: [],
    objective:
      "Explorar alta temporada de verão nas cidades litorâneas e polo fabril do Vale do Itajaí.",
    notes: "Visitas previstas a 8 grandes revendas e redes de material de construção.",
    createdAt: "2026-09-18T11:00:00Z",
  },
  {
    id: "immersion-006",
    title: "Imersão Recife & Polo Pernambuco",
    status: "realizada",
    startDate: "2025-11-10",
    endDate: "2025-11-14",
    state: "PE",
    cities: ["Recife", "Caruaru"],
    regionCovered: "Região Metropolitana do Recife e Agreste Pernambucano",
    cityStops: [
      { cityName: "Recife", state: "PE", lat: -8.0476, lng: -34.877, order: 1, dayNumber: 1 },
      { cityName: "Caruaru", state: "PE", lat: -8.2842, lng: -35.9699, order: 2, dayNumber: 2 },
    ],
    representatives: [
      {
        id: "rep-007",
        name: "Gustavo Vasconcelos",
        role: "Representante Nordeste",
        region: "PE, PB e AL",
        immersionRole: "Coordenação logística e reuniões com redes de atacado nordestinos",
        perceptions:
          "Mercado nordestino em forte crescimento com preferência por produtos com alta resistência à corrosão marítima.",
        keyInsights:
          "Hotéis de Porto de Galinhas e Muro Alto demandam equipamentos comerciais reforçados.",
        actionPoints: "Lançar linha especial 'Marítima Stainless' no Nordeste.",
      },
    ],
    clients: [
      {
        id: "cli-108",
        name: "Nordeste Piscinas & Hotéis",
        cityName: "Recife",
        state: "PE",
        lat: -8.05,
        lng: -34.88,
        visitDate: "2025-11-10",
        dayNumber: 1,
        scenario: "Atende grandes redes hoteleiras e resorts de todo o litoral nordestino.",
        opportunities: "Contrato de fornecimento anual de filtros de grande vazão.",
        threats: "Concorrência regional forte de marcas locais.",
        relevantPerceptions: "Exige assistência técnica presencial ágil em Recife.",
        nextSteps: "Parceria com centro de serviços autorizado local.",
      },
    ],
    objective: "Validar receptividade da linha inox em regiões litorâneas e polo hoteleiro do NE.",
    notes: "Primeira imersão histórica na Região Nordeste com ótimos resultados contratuais.",
    createdAt: "2025-11-01T10:00:00Z",
  },
];

const LOCAL_STORAGE_KEY = "director_bi_immersions_v1";

export function loadStoredImmersions(): ImmersionItem[] {
  if (typeof window === "undefined") return INITIAL_IMMERSIONS;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return INITIAL_IMMERSIONS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (e) {
    console.error("Erro ao carregar imersões do localStorage", e);
  }
  return INITIAL_IMMERSIONS;
}

export function saveStoredImmersions(immersions: ImmersionItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(immersions));
  } catch (e) {
    console.error("Erro ao salvar imersões no localStorage", e);
  }
}

export function filterImmersionsByTime(
  items: ImmersionItem[],
  filter: TimeFilterOption,
): ImmersionItem[] {
  if (filter === "all") return items;
  const now = new Date("2026-09-25T00:00:00Z");

  return items.filter((item) => {
    const start = new Date(item.startDate);
    if (isNaN(start.getTime())) return true;

    if (filter === "6m") {
      const monthsDiff =
        (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
      return Math.abs(monthsDiff) <= 6;
    }
    if (filter === "12m") {
      const monthsDiff =
        (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
      return Math.abs(monthsDiff) <= 12;
    }
    if (filter === "2026") {
      return start.getFullYear() === 2026;
    }
    return true;
  });
}
