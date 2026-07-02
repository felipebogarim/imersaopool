// Perguntas da Entrevista — derivadas do Framework Metodológico Imersão Newline.
// Cada pergunta tem uma orientação (o que o entrevistador deve captar) e a hipótese que testa.

export type InterviewQuestion = {
  id: string;
  pergunta: string;
  orientacao: string;
  hipotese: string; // H1..H7
};

export type InterviewSection = {
  id: string;
  titulo: string;
  descricao: string;
  perguntas: InterviewQuestion[];
};

export const CLASSIFICACOES = [
  { value: "representante", label: "Representante" },
  { value: "lojista", label: "Lojista" },
  { value: "projetista", label: "Projetista" },
  { value: "vendedor", label: "Vendedor" },
  { value: "arquiteto", label: "Arquiteto" },
  { value: "outro", label: "Outro (especificar)" },
] as const;

export const TIPOS_EMPRESA = [
  { value: "loja", label: "Loja" },
  { value: "escritorio_projetos", label: "Escritório de projetos" },
  { value: "escritorio_representacao", label: "Escritório de representação" },
  { value: "outro", label: "Outro (especificar)" },
] as const;

export const INTERVIEW_SECTIONS: InterviewSection[] = [
  {
    id: "percepcao_marca",
    titulo: "1. Percepção de marca e preço",
    descricao:
      "Objetivo: identificar se a marca é percebida como cara sem checagem real de tabela (H1) e como aparece no top of mind do entrevistado.",
    perguntas: [
      {
        id: "top_of_mind",
        pergunta: "Quando pensa nesta categoria de produto, quais marcas vêm primeiro à cabeça? Em que posição a nossa aparece?",
        orientacao:
          "Registre a ordem espontânea. Se a nossa marca não for citada espontaneamente, pergunte de forma estimulada e anote como '2º estimulado', por exemplo. Vira KPI de top of mind.",
        hipotese: "H1",
      },
      {
        id: "percepcao_preco",
        pergunta: "Como você percebe o preço da nossa marca em relação aos concorrentes?",
        orientacao:
          "Você quer capturar a percepção (cara / média / competitiva) ANTES de mostrar tabela. Se o entrevistado disser 'cara', pergunte se ele checou preço recentemente ou se é sensação.",
        hipotese: "H1",
      },
    ],
  },
  {
    id: "mix_e_esforco",
    titulo: "2. Mix ofertado e esforço de venda",
    descricao:
      "Objetivo: detectar viés de esforço do representante (H2) e produtos engavetados / adormecidos (H7).",
    perguntas: [
      {
        id: "mix_ativo",
        pergunta: "Dentro do nosso portfólio, quais linhas você realmente oferece no dia a dia? E quais raramente saem?",
        orientacao:
          "Anote as linhas efetivamente ofertadas vs. as engavetadas. Alimenta o Índice de Mix Ativo. Pergunte por que as engavetadas ficam paradas.",
        hipotese: "H2",
      },
      {
        id: "skus_adormecidos",
        pergunta: "Lembra de algum produto nosso que este cliente já comprou antes e que hoje não é mais oferecido?",
        orientacao:
          "Se o entrevistado não lembrar, é sinal de SKU adormecido — oportunidade de reativação sem prospectar. Anote nomes/famílias mencionadas.",
        hipotese: "H7",
      },
    ],
  },
  {
    id: "conflito_e_concorrencia",
    titulo: "3. Concorrência e conflito de interesse",
    descricao:
      "Objetivo: mapear concorrentes fortes e detectar sinal de conflito estrutural (H3) em quem representa múltiplas marcas.",
    perguntas: [
      {
        id: "concorrentes_fortes",
        pergunta: "Quais concorrentes têm mais espaço nesta loja/cliente? Em que categorias eles são mais fortes que a gente?",
        orientacao:
          "Liste marcas e as categorias onde ganham. Cruze depois com as categorias 'difíceis' da nossa marca — coincidência é sinal de H3.",
        hipotese: "H3",
      },
      {
        id: "discurso_concorrente",
        pergunta: "Quando o cliente traz uma objeção comparando com concorrente, como você responde?",
        orientacao:
          "Escute o argumento. Se o entrevistado reproduz o discurso do concorrente sem contra-argumento, é sinal de conflito ou de gap de argumento. Diferencie os dois.",
        hipotese: "H3",
      },
    ],
  },
  {
    id: "argumento_tecnico",
    titulo: "4. Argumento técnico no ponto de venda",
    descricao:
      "Objetivo: medir domínio técnico e capacidade de defender preço no balcão (H4).",
    perguntas: [
      {
        id: "defesa_preco",
        pergunta: "Quando o cliente diz que nosso produto está caro, o que você responde?",
        orientacao:
          "Avalie a qualidade do argumento (1–5). Vago = gap de conhecimento. Estruturado = domínio. Reproduzindo objeção = já 'virou' para o concorrente.",
        hipotese: "H4",
      },
      {
        id: "produto_dificil",
        pergunta: "Qual produto nosso é o mais difícil de vender hoje? Por quê?",
        orientacao:
          "Classifique o motivo em: preço real, falta de argumento, objeção do cliente, ou desconhecimento. Categoria essencial da Matriz de Análise.",
        hipotese: "H4",
      },
    ],
  },
  {
    id: "decisao_cliente",
    titulo: "5. Critério de decisão do cliente",
    descricao:
      "Objetivo: separar critério declarado (o que o cliente diz) do revelado (o que ele realmente faz). H5 e H6.",
    perguntas: [
      {
        id: "criterio_declarado",
        pergunta: "Se você fosse ranquear, o que pesa mais para este cliente decidir: preço, prazo, relação, disponibilidade, técnica?",
        orientacao:
          "Anote o ranking DECLARADO. Depois compare com a próxima pergunta.",
        hipotese: "H6",
      },
      {
        id: "criterio_revelado",
        pergunta: "Da última vez que este cliente trocou de fornecedor, qual foi o motivo real?",
        orientacao:
          "Se o motivo real for prazo/relação/disponibilidade mas ele declarou 'preço', temos elasticidade aparente — abertura para negociar por valor.",
        hipotese: "H6",
      },
      {
        id: "valor_defensavel",
        pergunta: "Existe algum produto mais caro que ainda vende bem? Por que ele resiste à commoditização?",
        orientacao:
          "Você está identificando famílias com Valor Defensável. Anote o produto e o motivo dado pelo cliente/vendedor — isso vira argumento reutilizável.",
        hipotese: "H5",
      },
    ],
  },
  {
    id: "oportunidades_ameacas",
    titulo: "6. Oportunidades, ameaças e cuidados",
    descricao:
      "Objetivo: fechar com síntese acionável para o Plano de Ação.",
    perguntas: [
      {
        id: "oportunidades",
        pergunta: "Onde você vê a maior oportunidade de crescer com este cliente / neste território nos próximos meses?",
        orientacao: "Foque em ações concretas: mix, treinamento, sell-out, exposição, nova linha.",
        hipotese: "—",
      },
      {
        id: "ameacas",
        pergunta: "Qual é a maior ameaça hoje? O que pode fazer a gente perder espaço?",
        orientacao: "Movimento de concorrente, mudança de comprador, queda de pedidos, restrição financeira.",
        hipotese: "—",
      },
      {
        id: "cuidados",
        pergunta: "Se você fosse dar um recado para a gestão da marca, o que precisamos ter cuidado nesta conta?",
        orientacao: "Sinaliza pontos sensíveis: política comercial, prazo, exposição, posicionamento.",
        hipotese: "—",
      },
    ],
  },
];
