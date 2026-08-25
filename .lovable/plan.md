# Plano: Refatoração determinística do importador de Performance

## Objetivo
Refatorar o fluxo de importação da Performance para que o Excel seja a fonte de verdade e o sistema consiga detectar, normalizar, validar matematicamente e persistir os dados sem gabaritos, nomes de clientes, posições fixas ou resultados esperados.

## Escopo desta implementação
1. Centralizar o motor de importação em uma camada própria, separando:
   - reconhecimento estrutural do workbook;
   - normalização de números/percentuais;
   - cálculo de realizado ÷ meta;
   - classificação do farol;
   - relatório técnico de diagnóstico;
   - validação de confiança antes de salvar.
2. Atualizar o fluxo de upload individual e envio em massa para consumir o mesmo parser normalizado.
3. Ajustar a persistência para salvar valores normalizados vindos da planilha quando existirem, sem depender de médias de faixas, cores ou matriz financeira como fonte primária.
4. Adicionar testes automáticos baseados em invariantes matemáticas, não em resultados específicos de clientes.
5. Incluir um painel de diagnóstico antes de salvar, mostrando o que o parser entendeu do arquivo.

## Regras que serão aplicadas
- Não hardcodar clientes, percentuais, quantidade de linhas, posições fixas ou resultados do arquivo atual.
- Descobrir cabeçalhos e famílias por significado e por padrões repetitivos, como `R$ MÉDIA | R$ META | % META`.
- Tratar `0` como valor válido e célula vazia como ausência de dado (`null`).
- Priorizar fontes nesta ordem:
  1. valores numéricos;
  2. relação matemática `realizado / meta`;
  3. percentual existente na planilha;
  4. formatação numérica;
  5. cor/estilo apenas como fallback auxiliar.
- Nunca limitar percentuais a 100%.
- Nunca inferir venda zero por ausência de reconhecimento.
- Interromper importação quando a estrutura não for interpretada com confiança.

## Implementação técnica
1. Criar um módulo reutilizável de normalização em `src/lib/performance-import-engine.ts`, com funções para:
   - ler células preservando valor bruto, tipo, formato e endereço;
   - detectar linhas de cabeçalho multi-linha;
   - localizar colunas de razão social/categoria;
   - agrupar famílias e subcolunas;
   - normalizar moeda e percentual sem converter decimal para inteiro indevidamente;
   - calcular status a partir do percentual normalizado;
   - validar `percentual ≈ realizado / meta` com tolerância;
   - calcular totais por cliente por soma de realizado/meta;
   - gerar diagnóstico técnico.
2. Refatorar `src/lib/performance-parser.ts` para usar esse motor como caminho principal e manter formatos legados somente como fallback seguro.
3. Expandir o tipo normalizado para carregar, por cliente/família:
   - realizado;
   - meta;
   - percentual decimal;
   - status;
   - origem do percentual;
   - divergências, quando houver.
4. Atualizar `submit_performance_upload` via nova migração para persistir `metas`, `realizado`, `familia_pct` e `total_pct` a partir dos dados normalizados, quando fornecidos pelo parser.
5. Atualizar upload individual e envio em massa para enviar o payload normalizado e bloquear salvamento quando a validação estrutural/matemática falhar.
6. Adicionar diagnóstico no upload individual antes da confirmação de salvar, com:
   - estrutura detectada;
   - clientes/categorias/famílias;
   - subcolunas por família;
   - contagens de valores numéricos, zeros, vazios e percentuais;
   - validações aprovadas/divergentes;
   - linhas ignoradas e motivos;
   - status final de confiança.
7. Adicionar testes com invariantes:
   - toda célula com realizado/meta/% deve bater com `realizado / meta` dentro da tolerância;
   - total do cliente deve bater com soma das famílias;
   - zeros permanecem `0`;
   - vazios permanecem `null`;
   - famílias e clientes reconhecidos não desaparecem silenciosamente.

## Validação final
- Rodar os testes direcionados do parser.
- Testar a importação com a planilha atual como fixture de desenvolvimento, validando pelo relatório matemático gerado pelo próprio parser, não por valores esperados hardcoded.
- Confirmar que Performance e BI passam a consumir os dados normalizados persistidos.
