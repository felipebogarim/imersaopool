# Notas e ações nas seções internas da perspectiva

## Onde o kebab está hoje

O menu de três pontos (Adicionar nota / Adicionar ação) foi colocado apenas no cabeçalho dos **blocos principais** da Visão Rep ok — os cartões grandes com título em maiúsculas e seta de expandir:

- Resumo executivo
- Conclusões centrais
- Perspectivas da entrevista
- Leitura integrada
- Performance por famílias

As seções internas de cada perspectiva — "Onde isso aparece", "O que isso representa", "Evidência principal", "Comparação com o grupo" — são trechos dentro do painel da perspectiva, não blocos, então não receberam kebab.

## O que fazer

Adicionar o mesmo kebab discreto (e o contador de notas) nos títulos dessas seções internas, dentro do painel da perspectiva selecionada:

- Onde isso aparece
- O que isso representa
- Evidência principal
- Comparação com o grupo
- Conclusões centrais relacionadas (painel de apoio)

Cada seção guarda suas notas separadamente por representante **e** por perspectiva, para que a nota escrita na perspectiva 03 não apareça na 05.

## Detalhes técnicos

- Extrair de `BlocoExpansivel.tsx` a lógica do kebab + contador para um componente leve `AcoesSecao` (mesmo `bloco_key`, mesmo `BlocoNotasDialog` e `GerarTarefaDialog`), sem cabeçalho nem borda de cartão.
- Em `PerspectivasV2.tsx`, renderizar `AcoesSecao` ao lado de cada título de seção em `Narrativa` e `PainelApoio`, alinhado à direita, visível de forma discreta (ícone esmaecido).
- Chave de nota: `${contexto}::p${numero}::${slug(titulo da seção)}`; o `contexto` (id do representante) passa a ser propagado de `visao-rep-2.tsx` para `PerspectivasEntrevistaV2`.
- Nenhuma mudança de dados ou banco: a tabela `bloco_notes` já suporta qualquer chave.
