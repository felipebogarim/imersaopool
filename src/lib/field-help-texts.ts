// Orientações curtas explicando a intenção de cada campo.
// O sufixo genérico (digitar / áudio / arquivos) é acrescentado pelo componente FieldHelp.

export const CLIENT_HELP = {
  nome_fantasia:
    "Nome pelo qual o cliente é conhecido no mercado. Usamos para identificar a conta em relatórios, imersões e comparativos.",
  razao_social:
    "Nome jurídico completo. Importante para emissão de propostas, contratos e validações fiscais.",
  documento:
    "CNPJ ou CPF do cliente. Garante a unicidade do cadastro e evita duplicidades na base.",
  grupo:
    "Grupo empresarial ou rede a que o cliente pertence. Ajuda a enxergar performance consolidada por bandeira.",
  categoria:
    "Tipo de canal do cliente (loja, atacado, distribuidor). Define a régua comercial e o comparativo de preços.",
  status:
    "Situação atual do relacionamento. Use para priorizar visitas e diferenciar contas ativas de prospects.",
  cidade:
    "Cidade onde está a operação principal. Usada para roteirização e análise regional.",
  estado:
    "UF de operação. Importante para segmentação regional e regras fiscais.",
  regiao:
    "Região comercial interna (Norte, Sul, Nordeste etc.). Apoia o BI por território.",
  endereco:
    "Endereço completo da loja ou matriz. Útil para visitas de campo e logística.",
  nome_comprador:
    "Pessoa responsável pelas compras. É quem conduz a negociação no dia a dia.",
  telefone:
    "Telefone fixo ou celular institucional para contato comercial.",
  whatsapp:
    "Número de WhatsApp do contato principal. Acelera follow-ups e envio de propostas.",
  email:
    "E-mail principal de negociação. Usado em comunicações formais e envio de materiais.",
  representante:
    "Representante PoolFlux responsável por este cliente. Vincula a conta ao agente comercial.",
  observacoes:
    "Contexto comercial relevante: histórico, particularidades, alertas ou oportunidades percebidas.",
};

export const REP_HELP = {
  nome: "Nome completo do representante. Aparece em relatórios e nas imersões em que ele atua.",
  email: "E-mail principal do representante para comunicações e envio do link público.",
  telefone: "Telefone direto do representante para alinhamentos rápidos.",
  regiao: "Região de atuação. Define os clientes e rotas associados a ele.",
  outras_marcas:
    "Marcas concorrentes ou complementares que o representante também trabalha. Ajuda a entender o portfólio e possíveis conflitos.",
  observacoes:
    "Notas sobre histórico, perfil de atuação, pontos fortes e cuidados na relação.",
};

export const IMMERSION_HELP = {
  titulo:
    "Nome curto para identificar a imersão. Ex.: cliente + período. Aparece em listagens e no BI.",
  cliente:
    "Cliente que será visitado e estudado. Toda a análise da imersão fica vinculada a ele.",
  representante:
    "Representante que acompanha esta imersão. Recebe o link público para registrar a visão de campo.",
  data_visita:
    "Data prevista da visita ao cliente. Usada para planejamento de agenda e disparos de lembrete.",
};

export const REP_PUBLIC_HELP = {
  texto_livre:
    "Espaço aberto para qualquer comentário, contexto ou observação que você queira adicionar antes das perguntas.",
  marca:
    "Queremos entender o nível de reconhecimento, simpatia e relevância da PoolFlux para este cliente hoje.",
  concorrentes:
    "Liste marcas concorrentes presentes na loja e quais têm mais espaço, exposição ou volume de venda.",
  oportunidades:
    "Aponte caminhos para crescer neste cliente: linhas, mix, ações comerciais, treinamentos ou ocasiões de uso.",
  ameacas:
    "Sinais de risco: queda de pedidos, preferência por concorrentes, mudanças de comprador, restrições financeiras.",
  faturamento:
    "Ideias práticas para ampliar o faturamento: novos SKUs, condições, ações de sell-out ou campanhas conjuntas.",
  cuidados:
    "O que precisamos monitorar de perto nesta conta: prazos, política comercial, posicionamento, exposição da marca.",
};
