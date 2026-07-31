/**
 * Protótipo estático do briefing executivo da Visão Rep 2 (Fabio Bristotti).
 * Conteúdo curado manualmente para validação visual — não vem do parser nem do banco.
 * Nenhum outro módulo do produto depende deste arquivo.
 */

export type BriefEntidades = {
  produtos?: string[];
  concorrentes?: string[];
  clientes?: string[];
  ferramentas?: string[];
  nota?: string;
};

export type BriefTema = {
  id: string;
  seletor: string;
  titulo: string;
  contexto: string;
  ondeAparece: string[];
  representa: string;
  decisao: string;
  validacao?: string;
  evidencia: string;
  entidades: BriefEntidades;
  comparacao: string;
  confianca: "Alta" | "Média" | "Baixa";
  perspectivas: string[];
};

export type BriefAgendaItem = { texto: string; status: "A decidir" | "A validar" };

/** Conclusão central: apenas orientação de leitura, nunca navegação principal. */
export type BriefConclusao = { titulo: string; frase: string };

/** Leitura de uma das oito perspectivas oficiais da entrevista. */
export type BriefPerspectiva = {
  numero: number;
  tituloConclusivo: string;
  contexto?: string;
  ondeAparece?: string[];
  representa?: string;
  /** Índice (1-based) da decisão na Agenda executiva, quando houver relação. */
  decisaoRef?: number;
  /** Índice (1-based) da validação na Agenda executiva, quando houver relação. */
  validacaoRef?: number;
  evidencia?: string;
  entidades?: BriefEntidades;
  comparacao?: string;
  confianca?: "Alta" | "Média" | "Baixa";
  conclusoes?: string[];
};

export type BriefingExecutivo = {
  contexto: {
    marcas: string[];
    regiaoModelo: string;
  };
  clientes: { nome: string; motivo: string }[];
  sintese: string;
  temas: BriefTema[];
  conclusoes: BriefConclusao[];
  perspectivas: BriefPerspectiva[];
  decisoes: BriefAgendaItem[];
  validacoes: BriefAgendaItem[];
};


export const BRIEFING_FABIO: BriefingExecutivo = {
  contexto: {
    marcas: ["Stella", "Accord"],
    regiaoModelo:
      "Fabio atua principalmente em Campinas, Limeira, Piracicaba, Jundiaí e polos próximos. Seu modelo combina visitas frequentes, treinamento individual de vendedores, acompanhamento de estoque, apoio a projetos, demonstração física de produtos e relacionamento direto com proprietários, compradores e equipes de loja.",
  },
  clientes: [
    {
      nome: "Bonalluce",
      motivo:
        "Conta estratégica na qual Fabio utiliza demonstrações físicas e amostras para desenvolver produtos técnicos, incluindo New Pixel.",
    },
    {
      nome: "Hansa",
      motivo:
        "Conta indicada pelo representante entre as mais relevantes da carteira, a ser cruzada com a Performance para identificar famílias com espaço de crescimento.",
    },
    {
      nome: "LedLuz",
      motivo:
        "Cliente no qual a atuação sobre estoque, amostras e vendedores gerou um caso concreto de conversão, com venda de mais de 35 barras.",
    },
    {
      nome: "Vivani",
      motivo:
        "Conta indicada entre as mais estratégicas da região, com oportunidade de aprofundamento do mix a ser validada na Performance.",
    },
    {
      nome: "Artluz",
      motivo:
        "Cliente classificado como estratégico pelo representante, com necessidade de mapear presença por família e concorrentes ativos.",
    },
  ],
  sintese:
    "Fabio Bristotti percebe a Newline em um momento competitivo de produto e preço, com reconhecimento especialmente forte em Sistemas e Módulos. Entretanto, a marca ainda pode ser descartada antes da cotação porque parte dos lojistas e vendedores pressupõe que ela será mais cara. Ao mesmo tempo, o representante identifica que algumas famílias técnicas possuem bons produtos, mas não oferecem profundidade suficiente de tonalidades, fachos e aplicações. Essa fragmentação, somada à necessidade de consultar estoque, localizar materiais e obter respostas internas, aumenta o esforço necessário para vender. Em sua região, presença, amostra e velocidade têm impacto direto na conversão, como nos casos relatados na LedLuz e na Bonalluce. A entrevista aponta, portanto, menos para uma falta generalizada de competitividade e mais para a necessidade de transformar qualidade, portfólio e preço em uma experiência comercial mais simples, rápida, previsível e completa para o vendedor e para o lojista.",
  temas: [
    {
      id: "preco",
      seletor: "Preço e percepção",
      titulo: "Preço competitivo, percepção ainda premium",
      contexto:
        "Fabio considera que a Newline vive uma combinação favorável entre portfólio, qualidade e preço, mas percebe que essa condição ainda não foi assimilada por todos os vendedores, compradores e proprietários de loja. Em determinadas situações, o cliente procura primeiro uma marca percebida como mais barata e somente depois compara o valor real. O caso citado envolve mini embutidos: o lojista recorreu diretamente à Pix por acreditar que teria uma proposta inferior, embora o produto da Newline estivesse com preço mais baixo. O relato mostra que competir apenas pela tabela não resolve o problema. A marca precisa entrar na primeira comparação e tornar sua competitividade visível antes que o vendedor decida qual produto apresentar.",
      ondeAparece: [
        "Pix é associada espontaneamente a mini embutidos de menor preço.",
        "A Newline estava mais barata no caso relatado.",
        "A percepção do vendedor antecedeu a consulta objetiva.",
        "Fabio utiliza informação de custo para dar segurança ao vendedor.",
        "A marca continua reconhecida como premium.",
      ],
      representa:
        "A Newline pode perder a entrada na cotação antes que preço e desempenho sejam efetivamente comparados.",
      decisao:
        "Criar comparativos rápidos de preço, aplicação e desempenho para categorias nas quais a marca é descartada previamente.",
      validacao:
        "Confirmar o caso Pix com produto equivalente, desconto, prazo, condição e data da cotação.",
      evidencia:
        "Na hora em que falaram que queriam um orçamento mais barato, ele foi na Pix. Só que o nosso estava mais barato.",
      entidades: {
        produtos: ["Mini embutidos"],
        concorrentes: ["Pix"],
        nota: "Não identificar uma loja específica quando ela não estiver claramente registrada.",
      },
      comparacao:
        "A percepção premium é recorrente nas entrevistas. O viés de procurar uma marca considerada mais barata antes de consultar a Newline aparece com maior especificidade no relato de Fabio.",
      confianca: "Média",
      perspectivas: ["Marca e preço", "Decisão"],
    },
    {
      id: "portfolio",
      seletor: "Portfólio e famílias",
      titulo: "Bons produtos, famílias ainda fragmentadas",
      contexto:
        "Fabio avalia positivamente produtos como New Pixel e Grid, mas percebe que eles convivem com Comfort, Cross e Ace em uma organização que nem sempre é assimilada pelo cliente como uma família única. O problema não está apenas na quantidade de nomes. Ao combinar produtos de linhas diferentes em um mesmo projeto, o cliente pode ter insegurança sobre tonalidade, acabamento e padrão visual. Em Pro Lamp, ele também aponta lacunas em microbordas e graus de abertura, enquanto a Interlight é percebida como uma referência mais completa nessa categoria. O contraste aparece em Sistemas e Módulos: FIT10 e FIT15 são citados como famílias consolidadas, compreendidas e mais fáceis de defender comercialmente.",
      ondeAparece: [
        "New Pixel, Grid, Comfort, Cross e Ace são percebidos como soluções próximas, mas fragmentadas.",
        "Pro Lamp possui lacunas em microbordas e graus de abertura.",
        "Interlight é citada como referência em microbordas.",
        "FIT10 e FIT15 aparecem como famílias consolidadas.",
        "Misturar linhas pode gerar diferenças de tonalidade e acabamento.",
      ],
      representa:
        "A amplitude total do portfólio não substitui a necessidade de profundidade e coerência dentro das famílias mais importantes.",
      decisao:
        "Selecionar duas famílias técnicas para um projeto de aprofundamento, definindo lacunas, demanda, investimento e prazo.",
      validacao:
        "Cruzar as lacunas relatadas com vendas perdidas, Performance por família e demanda dos principais clientes.",
      evidencia: "Hoje nós estamos com muitas linhas e a família é curta.",
      entidades: {
        produtos: ["New Pixel", "Grid", "Comfort", "Cross", "Ace", "FIT10", "FIT15", "Pro Lamp"],
        concorrentes: ["Interlight"],
      },
      comparacao:
        "A necessidade de maior profundidade de família converge com outras entrevistas. O detalhamento sobre New Pixel, Grid, Comfort, Cross e Ace é uma contribuição específica de Fabio.",
      confianca: "Alta",
      perspectivas: ["Mix", "Concorrência", "Argumento"],
    },
    {
      id: "velocidade",
      seletor: "Velocidade comercial",
      titulo: "Velocidade e disponibilidade condicionam a conversão",
      contexto:
        "Na leitura de Fabio, vender iluminação exige que estoque, amostra, imagem, preço e proposta estejam disponíveis durante a conversa com o cliente. Quando o vendedor precisa interromper o atendimento para consultar a fábrica, procurar materiais ou confirmar disponibilidade, aumenta a chance de migrar para uma alternativa mais simples. O representante relata um caso na LedLuz em que a localização do produto no estoque e a distribuição de amostras contribuíram para a venda de mais de 35 barras. Na Bonalluce, a demonstração física de New Pixel ajudou a apresentar o produto. Fabio também utiliza amostras no veículo e no escritório regional, reforçando que presença física e rapidez funcionam como parte do argumento comercial.",
      ondeAparece: [
        "Venda de mais de 35 barras na LedLuz.",
        "Demonstração física de New Pixel na Bonalluce.",
        "Amostras mantidas no veículo do representante.",
        "Escritório regional utilizado como apoio.",
        "Consulta de estoque ainda depende de retorno.",
        "Conteúdo comercial precisa ser localizado durante o atendimento.",
        "NLUX pode apoiar desenho e proposta.",
      ],
      representa:
        "A competitividade técnica perde valor quando a experiência de venda é mais lenta e complexa do que a oferecida pelo concorrente.",
      decisao:
        "Criar um fluxo móvel integrado com estoque, biblioteca visual, amostras e geração rápida de proposta.",
      validacao:
        "Medir oportunidades atrasadas ou perdidas por consulta de estoque, ausência de amostra ou dificuldade de localizar materiais.",
      evidencia: "O vendedor vende aquilo que ele tem na hora.",
      entidades: {
        produtos: ["New Pixel", "Perfil"],
        clientes: ["LedLuz", "Bonalluce"],
        ferramentas: ["NLUX"],
      },
      comparacao:
        "Velocidade, disponibilidade e proximidade aparecem de forma recorrente nas entrevistas. Os casos de LedLuz, Bonalluce e do escritório regional dão materialidade específica à leitura de Fabio.",
      confianca: "Alta",
      perspectivas: ["Mix", "Argumento", "Decisão", "Governança", "Adicionais"],
    },
    {
      id: "autonomia",
      seletor: "Autonomia e carteira",
      titulo: "Conhecimento de campo pode ser convertido em autonomia controlada",
      contexto:
        "Fabio identifica clientes que demonstram interesse em trabalhar com a Newline, mas não aceitam iniciar a relação em condições inferiores para somente depois alcançar uma categoria comercial mais competitiva. Sua proposta é que o representante possa avalizar uma quantidade limitada de contas por semestre, assumindo compromisso com indicação, acompanhamento e desenvolvimento. O modelo não pressupõe abertura indiscriminada. Ele pode ser estruturado com análise de crédito, famílias prioritárias, condição inicial, meta, prazo e revisão. A proposta transforma o conhecimento regional do representante em uma hipótese comercial mensurável, reduzindo a dependência de exceções informais e permitindo avaliar se determinadas contas possuem potencial real de crescimento.",
      ondeAparece: [
        "Clientes querem entrar, mas não pelas condições iniciais atualmente esperadas.",
        "O representante propõe quantidade limitada de contas.",
        "A indicação seria acompanhada por metas.",
        "O modelo teria prazo e revisão.",
        "A autonomia seria delimitada, não irrestrita.",
      ],
      representa: "A política atual pode impedir o desenvolvimento de contas potenciais conhecidas pelo campo.",
      decisao:
        "Criar piloto semestral com até duas contas avalizadas por representante, sujeito a análise de crédito e metas por família.",
      validacao: "Definir critérios de entrada, margem, inadimplência, permanência e encerramento.",
      evidencia: "Há clientes que querem vir, mas não do jeito que a empresa espera.",
      entidades: {
        nota: "Validar os candidatos com o representante antes de associar nomes específicos.",
      },
      comparacao:
        "Outras entrevistas também mencionam necessidade de maior flexibilidade comercial. Fabio apresenta uma proposta mais delimitada, com quantidade, prazo e responsabilidade do representante.",
      confianca: "Média",
      perspectivas: ["Oportunidades", "Governança"],
    },
  ],
  conclusoes: [
    {
      titulo: "Preço competitivo, percepção ainda premium",
      frase: "A marca pode ser descartada antes da cotação, mesmo quando está mais barata.",
    },
    {
      titulo: "Bons produtos, famílias ainda fragmentadas",
      frase: "Falta profundidade e coerência dentro das famílias técnicas mais disputadas.",
    },
    {
      titulo: "Velocidade e disponibilidade condicionam a conversão",
      frase: "Estoque, amostra e resposta imediata decidem a venda durante o atendimento.",
    },
    {
      titulo: "Conhecimento de campo pode ser convertido em autonomia controlada",
      frase: "O representante propõe avalizar poucas contas, com metas, prazo e revisão.",
    },
  ],
  perspectivas: [
    {
      numero: 1,
      tituloConclusivo: "Preço competitivo, percepção ainda premium",
      contexto:
        "Fabio considera que a Newline vive uma combinação favorável entre portfólio, qualidade e preço, mas percebe que essa condição ainda não foi assimilada por vendedores, compradores e proprietários de loja. Em determinadas situações, o cliente procura primeiro uma marca percebida como mais barata e somente depois compara o valor real.",
      ondeAparece: [
        "Pix é associada espontaneamente a mini embutidos de menor preço.",
        "No caso dos mini embutidos, a Newline estava mais barata.",
        "A percepção do vendedor antecedeu a consulta objetiva de tabela.",
        "Fabio utiliza informação de custo para dar segurança ao vendedor.",
      ],
      representa:
        "A Newline pode perder a entrada na cotação antes que preço e desempenho sejam efetivamente comparados.",
      decisaoRef: 1,
      validacaoRef: 1,
      evidencia:
        "Na hora em que falaram que queriam um orçamento mais barato, ele foi na Pix. Só que o nosso estava mais barato.",
      entidades: { produtos: ["Mini embutidos"], concorrentes: ["Pix"] },
      comparacao: "Alta convergência: a percepção premium é recorrente nas entrevistas comparáveis.",
      confianca: "Média",
      conclusoes: ["Preço competitivo, percepção ainda premium"],
    },
    {
      numero: 2,
      tituloConclusivo: "Bons produtos, famílias ainda fragmentadas",
      contexto:
        "New Pixel e Grid são bem avaliados, mas convivem com Comfort, Cross e Ace em uma organização que nem sempre é assimilada como família única. Ao combinar linhas diferentes no mesmo projeto, o cliente fica inseguro quanto a tonalidade, acabamento e padrão visual. Em Pro Lamp, faltam microbordas e graus de abertura.",
      ondeAparece: [
        "New Pixel, Grid, Comfort, Cross e Ace são percebidos como soluções próximas, mas fragmentadas.",
        "Pro Lamp possui lacunas em microbordas e graus de abertura.",
        "FIT10 e FIT15 aparecem como famílias consolidadas.",
        "Misturar linhas pode gerar diferenças de tonalidade e acabamento.",
      ],
      representa:
        "A amplitude do portfólio não substitui profundidade e coerência dentro das famílias mais importantes.",
      decisaoRef: 1,
      validacaoRef: 2,
      evidencia: "Hoje nós estamos com muitas linhas e a família é curta.",
      entidades: {
        produtos: ["New Pixel", "Grid", "Comfort", "Cross", "Ace", "FIT10", "FIT15", "Pro Lamp"],
        concorrentes: ["Interlight"],
      },
      comparacao: "Alta convergência: a necessidade de famílias mais profundas aparece em outras entrevistas.",
      confianca: "Alta",
      conclusoes: [
        "Bons produtos, famílias ainda fragmentadas",
        "Velocidade e disponibilidade condicionam a conversão",
      ],
    },
    {
      numero: 3,
      tituloConclusivo: "Interlight, Misterled, Pix e Spotline ganham por lógicas diferentes",
      contexto:
        "A concorrência não avança por um único motivo. A Interlight é referência em microbordas e sustenta entregas frequentes; a Misterled simplifica a compra de perfil por metro; a Pix é procurada quando o vendedor busca preço baixo; e a Spotline disputa presença em loja. Cada concorrente vence em um ponto específico da experiência de venda.",
      ondeAparece: [
        "Interlight em microbordas e entregas às terças e quintas.",
        "Misterled simplifica Perfil por metro.",
        "Pix foi procurada no caso dos mini embutidos.",
        "Spotline disputa presença e giro na loja.",
      ],
      representa:
        "Responder à concorrência exige tratar cada frente separadamente: profundidade de família, simplicidade de compra e percepção de preço.",
      validacaoRef: 1,
      evidencia: "A Interlight tem uma família de microborda muito mais completa que a nossa.",
      entidades: {
        produtos: ["Microbordas", "Perfil"],
        concorrentes: ["Interlight", "Misterled", "Pix", "Spotline"],
      },
      comparacao: "Convergência parcial: os concorrentes citados variam conforme a região de cada representante.",
      confianca: "Alta",
      conclusoes: ["Preço competitivo, percepção ainda premium", "Bons produtos, famílias ainda fragmentadas"],
    },
    {
      numero: 4,
      tituloConclusivo: "Demonstração física e resposta imediata convertem a venda",
      contexto:
        "O argumento técnico só funciona quando pode ser mostrado. Fabio mantém amostras no veículo e no escritório regional e utiliza demonstração física para explicar produtos técnicos. Quando o vendedor precisa interromper o atendimento para consultar a fábrica ou localizar material, o argumento perde força.",
      ondeAparece: [
        "New Pixel foi demonstrado na Bonalluce.",
        "Amostras são mantidas no veículo do representante.",
        "NLUX pode apoiar desenho e proposta em PDF.",
        "Conteúdo comercial precisa ser localizado durante o atendimento.",
      ],
      representa:
        "A competitividade técnica perde valor quando a experiência de venda é mais lenta do que a do concorrente.",
      decisaoRef: 2,
      evidencia: "O vendedor vende aquilo que ele tem na hora.",
      entidades: { produtos: ["New Pixel"], clientes: ["Bonalluce"], ferramentas: ["NLUX"] },
      comparacao: "Alta convergência: amostra e material de apoio aparecem como condição de venda em outras entrevistas.",
      confianca: "Alta",
      conclusoes: ["Velocidade e disponibilidade condicionam a conversão"],
    },
    {
      numero: 5,
      tituloConclusivo: "O vendedor escolhe o que consegue compreender e apresentar rapidamente",
      contexto:
        "O critério declarado é preço, mas o critério revelado é facilidade. O vendedor apresenta primeiro o produto que entende, encontra e consegue cotar sem interromper o atendimento. Por isso a comparação objetiva de tabela muitas vezes acontece depois que a escolha já foi feita.",
      ondeAparece: [
        "A percepção de preço antecede a consulta de tabela.",
        "Produtos com família curta exigem mais explicação no balcão.",
        "Consulta de estoque ainda depende de retorno da fábrica.",
      ],
      representa:
        "Simplificar a apresentação do produto tem efeito comercial equivalente a ajustar preço.",
      decisaoRef: 2,
      validacaoRef: 1,
      evidencia: "Ele vende o que é mais fácil de explicar para o cliente.",
      entidades: { concorrentes: ["Pix"], ferramentas: ["NLUX"] },
      comparacao: "Convergência parcial: a distância entre critério declarado e revelado aparece em parte das entrevistas.",
      confianca: "Média",
      conclusoes: [
        "Preço competitivo, percepção ainda premium",
        "Velocidade e disponibilidade condicionam a conversão",
      ],
    },
    {
      numero: 6,
      tituloConclusivo: "Famílias, canais e clientes potenciais exigem testes controlados",
      contexto:
        "Fabio identifica oportunidades concretas em famílias técnicas, em clientes que desejam entrar na marca e no aproveitamento do escritório regional. Nenhuma delas deve ser aberta de forma ampla: cada oportunidade pede um teste delimitado, com meta, prazo e revisão.",
      ondeAparece: [
        "Clientes querem entrar, mas não pelas condições iniciais esperadas.",
        "Aprofundar microbordas e graus de abertura em Pro Lamp.",
        "Escritório regional pode receber amostras e treinamentos.",
      ],
      representa:
        "A política atual pode impedir o desenvolvimento de contas potenciais já conhecidas pelo campo.",
      decisaoRef: 3,
      validacaoRef: 2,
      evidencia: "Há clientes que querem vir, mas não do jeito que a empresa espera.",
      entidades: { produtos: ["Pro Lamp"], clientes: ["Hansa", "Vivani", "Artluz"] },
      comparacao: "Leitura exclusiva: a proposta de avalizar contas com limite semestral é específica de Fabio.",
      confianca: "Média",
      conclusoes: [
        "Bons produtos, famílias ainda fragmentadas",
        "Conhecimento de campo pode ser convertido em autonomia controlada",
      ],
    },
    {
      numero: 7,
      tituloConclusivo: "Iniciativa de campo precisa ser convertida em processo replicável",
      contexto:
        "A atuação sobre estoque, amostras e treinamento de vendedores acontece hoje por iniciativa pessoal do representante. O caso da LedLuz mostra o efeito dessa atuação, mas ela não está descrita como rotina nem é medida por indicador.",
      ondeAparece: [
        "Na LedLuz, foram vendidas mais de 35 barras após organizar estoque e amostras.",
        "O treinamento de vendedores é individual e não padronizado.",
        "A indicação de contas seria acompanhada por metas e prazo.",
      ],
      representa:
        "Sem processo, o resultado depende da presença de uma pessoa e não se reproduz na equipe.",
      decisaoRef: 3,
      validacaoRef: 3,
      evidencia: "Fui lá, organizei o estoque, treinei o vendedor e saíram mais de 35 barras.",
      entidades: { clientes: ["LedLuz"], ferramentas: ["NLUX"] },
      comparacao: "Convergência parcial: a autonomia do representante é discutida em outras entrevistas com menor detalhamento.",
      confianca: "Média",
      conclusoes: [
        "Velocidade e disponibilidade condicionam a conversão",
        "Conhecimento de campo pode ser convertido em autonomia controlada",
      ],
    },
    {
      numero: 8,
      tituloConclusivo: "Escritório, amostras e presença formam a infraestrutura regional de conversão",
      contexto:
        "A carteira é atendida a partir de Campinas, Limeira, Piracicaba e Jundiaí, com escritório regional, amostras no veículo e visitas frequentes. Essa infraestrutura é o que sustenta demonstração, treinamento e resposta rápida no ponto de venda.",
      ondeAparece: [
        "Escritório regional utilizado como apoio a amostras e reuniões.",
        "Amostras transportadas no veículo do representante.",
        "Visitas frequentes a Campinas, Limeira, Piracicaba e Jundiaí.",
      ],
      representa:
        "A estrutura regional já existente pode ser usada como base para treinamento e demonstração organizados.",
      decisaoRef: 2,
      evidencia: "Eu levo amostra comigo, senão o vendedor não consegue mostrar.",
      entidades: { ferramentas: ["NLUX"] },
      comparacao: "Sem comparação suficiente com o grupo para este tema.",
      confianca: "Média",
      conclusoes: ["Velocidade e disponibilidade condicionam a conversão"],
    },
  ],
  decisoes: [

    { texto: "Escolher duas famílias prioritárias para aprofundamento.", status: "A decidir" },
    { texto: "Priorizar o fluxo de estoque, conteúdo, amostras e proposta.", status: "A decidir" },
    { texto: "Aprovar ou rejeitar o piloto de clientes avalizados.", status: "A decidir" },
  ],
  validacoes: [
    { texto: "Confirmar a comparação de preço com Pix.", status: "A validar" },
    { texto: "Cruzar clientes estratégicos e famílias com a Performance.", status: "A validar" },
    { texto: "Medir perdas relacionadas a estoque, amostras e tempo de resposta.", status: "A validar" },
  ],
};

/** O protótipo executivo só é aplicado ao relatório de Fabio Bristotti. */
export function briefingParaRepresentante(nome: string | null | undefined): BriefingExecutivo | null {
  const n = (nome ?? "").toLowerCase();
  return n.includes("fabio") || n.includes("fábio") ? BRIEFING_FABIO : null;
}
