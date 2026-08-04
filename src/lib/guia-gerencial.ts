/**
 * Conteúdo e progresso do "Guia de Uso Gerencial".
 * O conteúdo fica isolado aqui para permitir edição futura pela área de Manuais.
 */

export type GuiaEtapa = {
  id: string;
  numero: number;
  titulo: string;
  frase: string;
  resumo: string;
  objetivo: string;
  encontrar: string[];
  comoUsar: string[];
  observar: string[];
  decisao: string;
  proximoPasso: string;
  botao: string;
  /** rota real do sistema; null = módulo em desenvolvimento */
  to: string | null;
};

export const GUIA_SLUG = "guia-uso-gerencial";

export const GUIA_ETAPAS: GuiaEtapa[] = [
  {
    id: "entrevistas",
    numero: 1,
    titulo: "Entrevistas",
    frase: "Comece entendendo o contexto antes de analisar os números.",
    resumo: "compreender o contexto.",
    objetivo:
      "Acessar o conteúdo amplo das entrevistas realizadas com os representantes e compreender a realidade comercial sob a perspectiva de quem atua diretamente no mercado.",
    encontrar: [
      "Relatos completos das entrevistas.",
      "Percepções dos representantes.",
      "Informações sobre clientes, mercado, concorrência, produtos, preços, dificuldades e oportunidades.",
      "Registros qualitativos que ajudam a explicar os resultados comerciais.",
    ],
    comoUsar: [
      "Realize inicialmente uma leitura individual das entrevistas.",
      "O objetivo não é apenas identificar problemas, mas compreender como cada representante interpreta seu território, sua carteira, seus clientes e sua própria atuação.",
    ],
    observar: [
      "Temas recorrentes.",
      "Dificuldades relatadas.",
      "Oportunidades mencionadas.",
      "Diferenças de percepção.",
      "Problemas que exigem validação por dados.",
      "Informações que precisam ser transformadas em ações.",
    ],
    decisao: "Definir quais pontos merecem aprofundamento nas próximas etapas da análise.",
    proximoPasso:
      "Depois de compreender o conteúdo completo, avance para a Visão REP, onde as informações da entrevista estarão organizadas de maneira estruturada.",
    botao: "Acessar Entrevistas",
    to: "/entrevistas",
  },
  {
    id: "visao-rep",
    numero: 2,
    titulo: "Visão REP",
    frase: "Transforme o conteúdo da entrevista em uma leitura estruturada de cada representante.",
    resumo: "estruturar a percepção.",
    objetivo:
      "Apresentar uma síntese organizada das entrevistas, facilitando a identificação dos principais pontos relacionados a cada representante.",
    encontrar: [
      "Síntese estruturada da entrevista.",
      "Principais percepções.",
      "Pontos fortes, dificuldades e riscos.",
      "Oportunidades identificadas.",
      "Planos de ação relacionados ao representante.",
    ],
    comoUsar: [
      "Utilize inicialmente para a leitura individual de cada representante.",
      "Posteriormente, utilize em reuniões gerenciais para comparar percepções, prioridades e necessidades de desenvolvimento.",
    ],
    observar: [
      "Coerência entre discurso e resultado.",
      "Necessidades específicas de acompanhamento.",
      "Pontos que exigem apoio da gestão.",
      "Oportunidades comerciais identificadas.",
      "Ações sugeridas ou pendentes.",
    ],
    decisao: "Definir prioridades de acompanhamento para cada representante.",
    proximoPasso:
      "Após compreender a percepção e o contexto do representante, avance para Performance e confronte essas informações com os indicadores comerciais.",
    botao: "Acessar Visão REP",
    to: "/visao-rep-2",
  },
  {
    id: "performance",
    numero: 3,
    titulo: "Performance",
    frase: "Confronte percepções com resultados.",
    resumo: "confrontar com os resultados.",
    objetivo:
      "Analisar os resultados e indicadores comerciais de cada representante, permitindo uma leitura objetiva de desempenho.",
    encontrar: [
      "Indicadores de performance.",
      "Resultados comerciais e sua evolução.",
      "Composição da carteira.",
      "Informações consolidadas por representante.",
      "Recortes e análises disponíveis no BI.",
    ],
    comoUsar: [
      "Compare os resultados com as informações identificadas nas entrevistas e na Visão REP.",
      "Considere contexto, carteira, território, clientes, produtos e oportunidades, evitando interpretação baseada apenas em números isolados.",
    ],
    observar: [
      "Evolução ou retração.",
      "Concentração de resultados.",
      "Diferenças entre potencial e realização.",
      "Produtos ou clientes com baixa exploração.",
      "Dependência de poucos clientes.",
      "Representantes que precisam de suporte ou direcionamento.",
    ],
    decisao: "Identificar causas prováveis dos resultados e definir quais análises devem ser aprofundadas.",
    proximoPasso: "Avance para Visões Consolidadas e identifique quais situações se repetem entre os representantes.",
    botao: "Acessar Performance",
    to: "/representantes/performance",
  },
  {
    id: "visoes-consolidadas",
    numero: 4,
    titulo: "Visões Consolidadas",
    frase: "Identifique o que é padrão, o que é divergência e o que é uma situação individual.",
    resumo: "identificar padrões.",
    objetivo:
      "Consolidar as informações das entrevistas e das análises individuais para oferecer uma visão coletiva da equipe comercial.",
    encontrar: [
      "Temas que coincidem entre os representantes.",
      "Pontos de divergência.",
      "Situações específicas de determinados representantes.",
      "Percepções coletivas sobre mercado, clientes, concorrentes, produtos e operação.",
    ],
    comoUsar: [
      "Utilize em reuniões de gestão e diretoria.",
      "Separe problemas estruturais da companhia de situações relacionadas a uma pessoa, carteira ou região específica.",
    ],
    observar: [
      "Problemas mencionados por vários representantes.",
      "Percepções contraditórias.",
      "Oportunidades coletivas.",
      "Demandas recorrentes.",
      "Assuntos que exigem decisão institucional.",
    ],
    decisao:
      "Definir quais temas devem ser tratados como prioridade corporativa e quais precisam de acompanhamento individual.",
    proximoPasso:
      "Depois de compreender os padrões gerais, avance para o BI Cliente e aprofunde a análise nas contas que compõem os resultados.",
    botao: "Acessar Visões Consolidadas",
    to: "/sintese/tipos",
  },
  {
    id: "bi-cliente",
    numero: 5,
    titulo: "BI Cliente",
    frase: "Aprofunde a análise e entenda o papel de cada cliente no resultado do representante.",
    resumo: "aprofundar a análise.",
    objetivo: "Oferecer um raio X dos clientes dentro da performance de cada representante.",
    encontrar: [
      "Resultados por cliente e participação na carteira.",
      "Evolução de compras e concentração de faturamento.",
      "Clientes relevantes, em retração e com potencial de crescimento.",
      "Quando disponíveis, informações de mix, produtos, frequência e comportamento de compra.",
    ],
    comoUsar: [
      "Acesse a partir da análise de performance do representante, pelo menu de ações de cada cliente.",
      "Compreenda quais clientes explicam os resultados, quais representam risco e quais apresentam oportunidades.",
    ],
    observar: [
      "Dependência de poucos clientes.",
      "Clientes que reduziram compras.",
      "Clientes sem evolução.",
      "Contas com potencial ainda pouco explorado.",
      "Diferenças de mix.",
      "Oportunidades de recuperação, expansão ou desenvolvimento.",
    ],
    decisao: "Definir quais clientes devem receber planos de ação específicos.",
    proximoPasso:
      "Avance para o módulo Price e avalie se o posicionamento de preços pode estar influenciando o desempenho comercial.",
    botao: "Acessar BI Cliente",
    to: "/representantes/performance",
  },
  {
    id: "price",
    numero: 6,
    titulo: "Price",
    frase: "Compare preços e avalie a competitividade do portfólio.",
    resumo: "avaliar competitividade.",
    objetivo:
      "Permitir comparações de preços e análises de posicionamento entre produtos próprios e produtos equivalentes do mercado.",
    encontrar: [
      "Comparativos de preços.",
      "Produtos equivalentes.",
      "Informações técnicas disponíveis.",
      "Diferenças de posicionamento.",
      "Referências de mercado.",
    ],
    comoUsar: [
      "Use como apoio à análise comercial, à formação de argumentos, ao posicionamento de produtos e à definição de estratégias de preço.",
      "Considere preço, especificação, aplicação, posicionamento da marca e características técnicas.",
    ],
    observar: [
      "Produtos fora da faixa de mercado.",
      "Diferenças de preço justificadas por atributos técnicos.",
      "Oportunidades de reposicionamento.",
      "Riscos de perda de competitividade.",
      "Necessidade de melhorar argumentos comerciais.",
    ],
    decisao:
      "Definir quais produtos, famílias ou condições comerciais exigem revisão, aprofundamento ou direcionamento.",
    proximoPasso:
      "Transforme as conclusões das análises em responsabilidades, prazos e ações dentro da Gestão de Tarefas.",
    botao: "Acessar Price",
    to: "/price/comparativos",
  },
  {
    id: "tarefas",
    numero: 7,
    titulo: "Gestão de Tarefas",
    frase: "Transforme descobertas em execução.",
    resumo: "transformar análise em execução.",
    objetivo: "Criar, distribuir e acompanhar tarefas decorrentes das análises comerciais e gerenciais.",
    encontrar: [
      "Quadros de tarefas em formato visual.",
      "Responsáveis, prazos e prioridades.",
      "Status das ações.",
      "Histórico de acompanhamento.",
    ],
    comoUsar: [
      "Toda análise relevante deve resultar em uma decisão, uma tarefa ou uma orientação registrada.",
      "Sempre que possível, vincule a tarefa à sua origem: representante, cliente, entrevista, análise de performance, produto ou comparação de preço.",
    ],
    observar: [
      "Tarefas sem responsável.",
      "Prazos vencidos.",
      "Ações sem atualização.",
      "Excesso de tarefas concentradas em uma pessoa.",
      "Planos que não avançaram.",
    ],
    decisao: "Definir responsáveis, prazos, prioridades e critérios de conclusão.",
    proximoPasso:
      "Depois de estruturar a execução, avance para Ferramentas e conheça os recursos disponíveis para ampliar a produtividade comercial e gerencial.",
    botao: "Acessar Gestão de Tarefas",
    to: "/tarefas",
  },
  {
    id: "ferramentas",
    numero: 8,
    titulo: "Ferramentas",
    frase: "Utilize tecnologia e automação para ampliar a capacidade de execução.",
    resumo: "ampliar capacidade e produtividade.",
    objetivo: "Disponibilizar ferramentas, recursos e automações voltados ao impulsionamento comercial e à gestão.",
    encontrar: [
      "Automações disponíveis.",
      "Recursos de apoio comercial.",
      "Ferramentas de produtividade.",
      "Soluções de suporte à gestão.",
      "Atalhos para processos recorrentes.",
    ],
    comoUsar: [
      "Utilize as ferramentas de acordo com as prioridades identificadas ao longo da jornada.",
      "As ferramentas não são recursos isolados: são meios para executar melhor as decisões tomadas nas etapas anteriores.",
    ],
    observar: [
      "Processos repetitivos que podem ser automatizados.",
      "Atividades que consomem tempo da equipe.",
      "Oportunidades de padronização.",
      "Necessidades de acompanhamento.",
      "Recursos que podem melhorar velocidade, qualidade ou controle.",
    ],
    decisao: "Selecionar as ferramentas adequadas para ampliar a capacidade comercial e gerencial.",
    proximoPasso:
      "Ao concluir esta etapa, o gestor terá percorrido o ciclo completo de utilização gerencial do sistema, partindo da compreensão qualitativa, passando pela análise de dados e chegando à execução.",
    botao: "Acessar Ferramentas",
    to: "/manuais",
  },
];

export const GUIA_FLUXO = [
  "Contexto",
  "Estruturação",
  "Performance",
  "Consolidação",
  "Cliente",
  "Preço",
  "Tarefa",
  "Ferramentas",
];

/* ---------------- progresso (localStorage; pronto para migrar ao banco) ---------------- */

export type GuiaProgresso = {
  etapaAtual: string | null;
  visitadas: string[];
  concluidas: string[];
  iniciadoEm: string | null;
  concluidoEm: string | null;
  onboardingDispensado: boolean;
};

const EMPTY: GuiaProgresso = {
  etapaAtual: null,
  visitadas: [],
  concluidas: [],
  iniciadoEm: null,
  concluidoEm: null,
  onboardingDispensado: false,
};

const key = (userId: string) => `pf.guia.${GUIA_SLUG}.${userId}`;

export function loadProgresso(userId: string): GuiaProgresso {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(key(userId));
    if (!raw) return EMPTY;
    return { ...EMPTY, ...(JSON.parse(raw) as Partial<GuiaProgresso>) };
  } catch {
    return EMPTY;
  }
}

export function saveProgresso(userId: string, p: GuiaProgresso) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(userId), JSON.stringify(p));
  } catch {
    /* storage indisponível */
  }
}

/** Capítulos padrão do roteiro de entrevista (resultado final entregue ao gestor). */
export const ENTREVISTA_CAPITULOS: { titulo: string; descricao: string }[] = [
  { titulo: "Percepção de marca e preço", descricao: "Como a marca é vista e o quanto o preço pesa na decisão." },
  { titulo: "Mix ofertado e esforço de venda", descricao: "Quais linhas são oferecidas e onde está o esforço comercial." },
  { titulo: "Competição de mercado", descricao: "Concorrentes citados, onde ganham e onde perdem." },
  { titulo: "Argumento técnico no ponto de venda", descricao: "Argumentos usados e objeções mais frequentes." },
  { titulo: "Critério de decisão do cliente", descricao: "O que realmente define a escolha do cliente final." },
  { titulo: "Oportunidades, ameaças e cuidados", descricao: "Sinais de avanço e riscos que exigem atenção." },
  { titulo: "Governança comercial e autonomia", descricao: "Regras, alçadas e autonomia percebida na operação." },
  { titulo: "Informações Adicionais", descricao: "Registros livres e observações relevantes do campo." },
];

/** Grupos de informação entregues na Visão REP (resultado final estruturado). */
export const VISAO_REP_GRUPOS: {
  chave: string;
  rotulo: string;
  titulo: string;
  descricao: string;
  itens: { titulo: string; descricao: string }[];
}[] = [
  {
    chave: "brief",
    rotulo: "Grupo 1",
    titulo: "Leitura executiva e sinais prioritários",
    descricao:
      "A síntese estratégica do representante e o menu de sinais — cada sinal atualiza o painel de leitura logo abaixo.",
    itens: [
      { titulo: "Síntese estratégica", descricao: "O resumo executivo da entrevista em poucas linhas de decisão." },
      { titulo: "Teia comparativa de posicionamento", descricao: "Como o representante se posiciona frente à média do grupo." },
      { titulo: "Menu de sinais prioritários", descricao: "Os principais sinais identificados, com grau de confiança." },
      { titulo: "O que isso significa", descricao: "A leitura gerencial por trás de cada sinal selecionado." },
      { titulo: "Onde isso apareceu", descricao: "As perspectivas e trechos da entrevista que sustentam o sinal." },
      { titulo: "Como isso se compara ao grupo", descricao: "O contraste do sinal com os demais representantes." },
    ],
  },
  {
    chave: "perspectivas",
    rotulo: "Grupo 2",
    titulo: "As 8 perspectivas estruturadas",
    descricao:
      "O conteúdo da entrevista reorganizado em oito perspectivas, cada uma com contexto, evidência, decisão e validação.",
    itens: [
      { titulo: "Marca e preço", descricao: "Percepção de marca e peso do preço na decisão." },
      { titulo: "Mix", descricao: "Mix ofertado e onde está o esforço de venda." },
      { titulo: "Concorrência", descricao: "Competição de mercado e onde a marca ganha ou perde." },
      { titulo: "Argumento", descricao: "Argumento técnico usado no ponto de venda." },
      { titulo: "Decisão", descricao: "Critério real de decisão do cliente final." },
      { titulo: "Oportunidades", descricao: "Oportunidades, ameaças e cuidados sinalizados." },
      { titulo: "Governança", descricao: "Governança comercial e autonomia percebida." },
      { titulo: "Adicionais", descricao: "Informações complementares registradas na entrevista." },
    ],
  },
];

