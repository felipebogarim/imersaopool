AJUSTE DE QUALIDADE — VISÃO IMERSÃO 2

Objetivo

Refinar a qualidade informacional da Visão Imersão 2 sem alterar a arquitetura técnica já validada do importador.

O importador V2 está funcionando corretamente com:

block: visao_imersao_2

schema: visao_imersao_2_data_v1

Manter compatibilidade com os relatórios V2 já existentes.

O novo arquivo de teste será:

Relatorio_LLUMINAH_VISAO_IMERSAO_2_REFINADO.md

Este arquivo mantém todos os campos obrigatórios atuais e acrescenta dois conjuntos opcionais de dados:

signals[].appearances

chapter_review + chapter_review_policy

Esses campos devem ser adicionados ao schema como OPCIONAIS, preservando compatibilidade retroativa.

1. REGRA PRINCIPAL DA SÍNTESE ESTRATÉGICA

Cada conclusão deve ser autossuficiente.

Não usar expressões como:

“a família”

“essa categoria”

“essa oportunidade”

“essa força”

sem que o referente esteja explícito na própria frase.

Sempre preferir informação específica quando ela estiver disponível.

Exemplo:

Errado:
“A família praticamente não faz parte do repertório atual.”

Correto:
“A família de Fitas e Fontes da Newline praticamente não faz parte do repertório atual da equipe.”

Na LLUMINAH, usar exatamente as conclusões entregues em signals[].conclusion.

Não reescrever.

2. EXEMPLOS E EVIDÊNCIAS — ELIMINAR BLOCO AGREGADO

Hoje a interface mostra:

cards individuais de citações, que estão corretos;

depois um bloco único em itálico concatenando várias citações novamente.

Esse bloco agregado deve ser REMOVIDO.

Regra definitiva:

1 citação = 1 card

Nunca concatenar várias citações em um único bloco visual.

Nunca repetir abaixo as mesmas citações que já foram apresentadas individualmente.

Preferir no máximo 3 citações diretamente visíveis por contexto. Se existirem mais, permitir expansão em “Ver mais evidências”.

Respeitar sempre:

texto literal;

autor original;

papel do autor;

reported_by;

quote_type.

3. “ONDE ISSO APARECEU” — NOVA LÓGICA

O painel “Onde isso apareceu” deve deixar de usar somente:

signal.perspectives

como fonte de conteúdo.

Quando existir:

signal.appearances

usar EXCLUSIVAMENTE appearances para montar os filtros e o conteúdo do painel.

Cada appearance contém:

perspective_id

label

specific_finding

added_detail

quote_ids

Objetivo metodológico

Cada filtro deve acrescentar informação nova.

Não repetir a conclusão do sinal com outras palavras.

Não repetir o conteúdo do filtro anterior.

Não repetir a mesma citação em filtros diferentes, salvo se for indispensável.

O filtro deve responder:

“Que informação adicional esta perspectiva acrescenta para compreender este sinal?”

4. QUANTIDADE DE FILTROS

Não existe quantidade mínima fixa.

Um sinal pode ter:

1 filtro

2 filtros

excepcionalmente 3 filtros

O objetivo não é quantidade. É contribuição informacional.

Não criar filtros artificiais apenas porque o sinal possui várias perspectivas relacionadas.

5. “SÍNTESE E AÇÃO” NÃO DEVE SER FILTRO DE “ONDE ISSO APARECEU”

A perspectiva P7 continua existindo no relatório e nas áreas de aprofundamento.

Porém, ela NÃO deve aparecer como filtro em “Onde isso apareceu”.

Motivo:

P7 é uma camada conclusiva e tende a repetir:

conclusão;

impacto comercial;

síntese já apresentada.

O painel “Onde isso apareceu” deve ser alimentado apenas por perspectivas que expliquem origem, contexto, evidência ou aprofundamento do sinal.

6. CITAÇÕES DENTRO DE “ONDE ISSO APARECEU”

Quando existir appearance.quote_ids, resolver somente essas citações.

Não trazer todas as citações da perspectiva.

Exemplo:

Se o sinal S2 em P2 usa somente Q06, mostrar apenas Q06.

Se o mesmo sinal em P3 usa somente Q07, mostrar apenas Q07.

Não mostrar Q01, Q02, Q03 etc. simplesmente porque pertencem à mesma perspectiva.

A regra é:

citações do appearance selecionado

e não:

todas as citações da perspectiva

7. RENOMEAR “CAPÍTULOS DA IMERSÃO”

Alterar o título:

CAPÍTULOS DA IMERSÃO

para:

REVISÃO DOS CAPÍTULOS DA IMERSÃO

Subtítulo obrigatório:

“Abaixo serão destacados somente pontos adicionais, diferentes dos já listados anteriormente. Caso não haja conteúdo novo e relevante, nenhum conteúdo será apresentado.”

8. NOVA FUNÇÃO DA REVISÃO DOS CAPÍTULOS

Essa área NÃO deve reproduzir o relatório completo.

Ela é uma camada de inteligência complementar.

Usar o novo array:

chapter_review

Cada capítulo possui:

chapter

title

items

Cada item possui:

headline

executive_reading

implication

quote_ids

entities

Renderizar SOMENTE os itens existentes em chapter_review[].items.

Não usar automaticamente os textos completos das perspectivas ou capítulos nessa área.

9. O QUE DEVE TER PRIORIDADE NA REVISÃO DOS CAPÍTULOS

Priorizar informações específicas e úteis para diretoria, especialmente:

marcas citadas nominalmente;

produtos e sistemas específicos;

ameaças competitivas;

movimentos de concorrentes;

percepção de preço e valor;

exclusividades comerciais;

condições comerciais;

disponibilidade e estoque;

exposição no showroom;

produtos presentes na loja;

referências de marca;

comunicação de concorrentes;

construção de memória junto a arquitetos;

especificação;

relacionamento com arquitetos;

treinamento;

eventos;

ações comerciais;

operação do cliente;

comportamento de vendedores e especificadores.

Quanto mais específico for o dado, maior sua prioridade.

10. CAPÍTULOS SEM NOVIDADE

Todos os capítulos podem ser avaliados pelo relatório, mas não precisam gerar conteúdo.

Se:

chapter_review[n].items.length === 0

não apresentar conteúdo daquele capítulo.

Não criar:

placeholder;

resumo genérico;

“nenhum ponto encontrado”;

repetição de conteúdo anterior.

A ausência de conteúdo é válida.

Opcionalmente, no cabeçalho da área, mostrar apenas:

7 capítulos revisados · X com pontos adicionais

sem criar cards vazios.

11. FORMATO VISUAL DOS ITENS DA REVISÃO

Cada item deve ser curto e executivo.

Estrutura recomendada:

[headline]

Leitura executiva
executive_reading

Por que importa
implication

Evidência
Cards individuais das citações em quote_ids, somente quando existirem.

Entidades citadas
Chips discretos com entities, se houver.

Evitar parágrafos longos.

Não transformar essa área em relatório textual.

12. TESTE LLUMINAH — EXPECTATIVAS

Com o novo arquivo, a Revisão dos Capítulos deve destacar, entre outros:

Capítulo 1

diferença de território entre Design Selo e Waldir Júnior;

concentração da exposição do Grupo Newline em FIT10, FIT10 Couro, FIT15, IMO, Sistemas e algumas famílias Studio.

Capítulo 2

equipe aprofunda as categorias que escolhe vender.

Capítulo 3

Stella como ameaça potencial em Sistemas pela reputação técnica;

Interlight protegida em Pro LED por condição + garantia + exclusividade;

Nordecor em Sistemas com risco de ruptura;

Pro Lamp com perda de diferenciação entre ABS e alumínio e Stella forte em lâmpadas;

modelo operacional da LLUMINAH em Perfil;

Nordecor e Gaya presentes na memória de arquitetos em Fitas e Fontes.

Capítulo 4

Mushroom e Pampa como produtos potenciais de reposicionamento decorativo.

Capítulo 5

eventos na LLUMINAH mais aderentes do que visitas à fábrica em Suzano.

Capítulos 6 e 7

não devem apresentar conteúdo se nada novo for acrescentado em relação à Leitura Integrada.

13. NÃO REINTERPRETAR O CONTEÚDO

Para arquivos V2 com appearances e chapter_review:

não resumir novamente;

não gerar novos insights com IA;

não preencher lacunas;

não substituir frases;

não criar filtros adicionais;

não ampliar quantidade de citações.

O relatório estruturado é a fonte de verdade.

O Lovable deve renderizar.

14. COMPATIBILIDADE

Manter suporte aos relatórios V2 anteriores.

Se signal.appearances não existir:
usar temporariamente a lógica anterior de perspectivas.

Se chapter_review não existir:
não renderizar a nova Revisão dos Capítulos ou utilizar o comportamento legado apenas para relatórios antigos.

Para novos relatórios, appearances e chapter_review passam a ser o padrão recomendado.

15. CRITÉRIOS DE ACEITE

O ajuste será aceito quando:

a Síntese usar exatamente as conclusões do arquivo;

nenhuma conclusão depender do título para ser entendida;

o bloco agregado de citações desaparecer;

cada citação aparecer em card individual;

“Onde isso apareceu” usar appearances;

os filtros não repetirem conteúdo entre si;

P7 não aparecer como filtro;

sinais possam ter apenas 1 filtro;

apenas citações do appearance selecionado sejam mostradas;

“Capítulos da Imersão” seja renomeado;

a revisão use somente chapter_review;

capítulos sem novidade não gerem conteúdo;

detalhes específicos de marcas, produtos, concorrentes e ações comerciais apareçam na revisão;

o relatório antigo V2 continue compatível;

Visão Rep e Visão Imersão antiga não sejam alteradas.