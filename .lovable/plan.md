# Por que as convergências caíram de 33 para 16

## O que os dados mostram

Comparando as duas versões do painel de Entrevistas:

| Versão | Data | Fontes | Corte exigido | Convergências fortes |
|---|---|---|---|---|
| v4 | 31/07 | 6 | 3 | 33 |
| v5 | 25/08 | 13 | 7 | 16 |

Nada foi excluído. O que mudou foi a régua.

## A causa

O motor de síntese classifica um tema como "convergência forte" quando ele é sustentado por pelo menos a **maioria simples das fontes**: `corte = arredonda_para_cima(total / 2)`.

- Com 6 entrevistas, bastavam 3 fontes.
- Com 13 entrevistas, passam a ser necessárias 7 fontes.

Um tema citado por 4 pessoas era convergência com 6 fontes e deixa de ser com 13 — mesmo tendo ganhado apoio. Ele não some do painel: cai para "específico/individual" ou entra em divergência. Ou seja, a queda é matemática, não perda de conteúdo.

## O que proponho corrigir

1. **Tornar o corte explícito na tela**: exibir no cabeçalho do painel "convergência = X de Y fontes (maioria)" e um seletor para ajustar o corte (ex.: 3, maioria, 2/3), regerando a leitura sem reimportar nada.
2. **Mostrar a força junto do número**: cada convergência já guarda o peso (nº de fontes); passar a exibir "7/13" e ordenar por proporção, para que a comparação entre versões faça sentido.
3. **Nova faixa "convergência emergente"**: temas com 2+ fontes mas abaixo do corte ganham um bloco próprio, em vez de se dissolverem em "específicos". É aí que estão a maior parte dos 17 itens que "sumiram".
4. **Comparativo entre versões**: ao abrir a v5, indicar quais temas da versão anterior mudaram de faixa e por quê (ganharam apoio, perderam, ou só mudou o corte).

## Detalhes técnicos

- Regra atual em `src/lib/sintese-engine.ts` (`corteMaioria`, aplicada em `consolidar` e replicada no prompt de `src/lib/sintese-cluster.server.ts`).
- O corte já é persistido por versão em `paineis_sintese.corte_convergencia` e `resultado.meta.corte`; a UI em `src/routes/_authenticated/sintese.tipos.tsx` apenas não o expõe.
- `sintese.functions.ts` já aceita `corte` como parâmetro de entrada — o seletor da UI apenas passaria esse valor.
- A faixa "emergente" sai do mesmo agrupamento: grupos com peso entre 2 e `corte - 1`, hoje descartados no ramo `peso === 1` / ignorados.
- Nenhuma alteração de dados; painéis antigos continuam íntegros.
