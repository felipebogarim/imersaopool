# Corrigir o Gerador de Performance e recalcular o histórico

## Resultado esperado
- Toda Performance será calculada apenas com valores numéricos.
- Cores, preenchimentos, estilos, RGB, HEX e textos de farol deixarão de participar da leitura e do cálculo.
- Células com somente meta serão tratadas como **N/D**, nunca como 0%.
- O histórico será recalculado com os valores numéricos privados já capturados nas importações anteriores.

## Implementação
1. Criar uma regra numérica única, usada pelo importador, Gerador, painel, BI e exportações:
   - percentual explícito;
   - realizado ÷ meta;
   - R$ Média ÷ meta;
   - N/D quando não houver resultado numérico;
   - 0% somente quando o resultado informado for exatamente zero e a meta for positiva.
2. Atualizar o leitor de planilhas para reconhecer separadamente `%`, `realizado`, `R$ Média` e `meta`, sem carregar ou consultar estilos e cores.
3. Remover os caminhos antigos de fallback por cor, faixa textual ou farol e impedir que campos ausentes sejam convertidos em `Sem compra`.
4. Atualizar o Gerador de Performance para devolver e persistir percentuais numéricos, não estimativas por faixa.
5. Ajustar a gravação para preservar números explícitos, não fabricar realizado a partir do ponto médio do farol e manter N/D como valor ausente.
6. Atualizar telas, filtros, Excel e PDF para exibir N/D quando não houver base numérica e aplicar o farol somente como consequência do percentual calculado.
7. Recalcular todos os registros históricos a partir de metas, realizados e percentuais numéricos já armazenados na área privada, marcando a nova versão de cálculo. Dados antigos que só possuam resultado derivado de cor serão convertidos em N/D, pois o arquivo Excel original não foi armazenado.
8. Adicionar testes de regressão para prioridade do percentual, realizado/meta, média/meta, meta isolada, zero real e todas as fronteiras do farol.

## Validação
- Executar testes do parser e das métricas.
- Conferir amostras do histórico antes e depois do recálculo.
- Validar no navegador o upload, a matriz de Performance, o BI e as exportações.
