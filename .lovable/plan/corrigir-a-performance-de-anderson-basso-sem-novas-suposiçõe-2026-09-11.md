# Corrigir a Performance de Anderson Basso sem novas suposições

## Dados confirmados
- Corrigir somente **Janeiro a Julho de 2026**.
- Usar a **planilha BASSO original** que será anexada como fonte dos resultados numéricos por cliente e família.
- Quando a planilha realmente não trouxer nenhum resultado numérico para uma célula, exibir **0% — Sem compra**.
- Cores, estilos e preenchimentos da planilha não serão usados como dados.

## Execução
1. Ler a planilha original e identificar, por cliente e família, meta, resultado/realizado e percentual explícito.
2. Calcular cada célula nesta ordem: percentual explícito; resultado ÷ meta; média ÷ meta; ausência real = 0%.
3. Gerar a faixa percentual e somente depois aplicar a cor correspondente.
4. Atualizar exclusivamente a versão ativa de Anderson Basso de **Janeiro a Julho de 2026**, sem alterar estrutura, outras performances ou regras do BI.
5. Remover das células corrigidas qualquer cor antiga que não corresponda ao percentual recalculado.

## Validação
- Comparar amostras cliente por cliente e família por família com a planilha original.
- Confirmar que nenhuma célula desse período aparece como N/D.
- Confirmar as seis faixas do farol e validar a tela em celular.

## Dependência
- A execução começa assim que a planilha BASSO original for anexada.
