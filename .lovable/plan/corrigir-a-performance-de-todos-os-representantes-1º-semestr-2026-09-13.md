# Corrigir a Performance de todos os representantes (1º Semestre 2026)

## O que foi constatado
- As 16 planilhas enviadas seguem o mesmo padrão: aba única, metas por família em números e o resultado de cada cliente indicado apenas pela cor da célula.
- Cada planilha traz a própria legenda de cores (Sem compra, Abaixo da meta, Pode melhorar, Próximo, Ótimo, Excelente).
- Hoje só o Anderson Basso tem resultados gravados; os demais representantes ficaram com as células vazias porque a leitura passou a ignorar cor, e não existe cópia anterior no banco.

## Como vai funcionar
1. A leitura passa a usar a legenda da própria planilha: o sistema identifica a cor de cada faixa na legenda e aplica essa mesma cor às células dos clientes.
2. Valor de cada faixa nos cálculos e nos BIs, igual ao Basso: Sem compra 0%, Abaixo da meta 25%, Pode melhorar 60%, Próximo 80%, Ótimo 95%, Excelente 110%.
3. Número continua tendo prioridade: se a planilha trouxer percentual, realizado ou média, o cálculo usa o número e a cor é ignorada.
4. Célula sem cor e sem número reconhecidos continua como "Sem dado", nunca 0%.
5. Metas por cliente e por categoria seguem vindo dos números da planilha.

## Importação destas 16 planilhas
- Período: 1º Semestre 2026 (janeiro a junho).
- As versões atuais de 1º Semestre 2026 são substituídas e as novas ficam ativas.
- Arquivos cujo nome não existe hoje na lista de representantes viram novos representantes: APTA, GCB, MAFALDA, D.K, KAFE LUZ, NOVARE, L M REP, D' QUEIROZ, FORMULA LUZ, NABRIN e CARTEIRA INTERNA SP.
- Arquivos com correspondência direta: ANSELMO, ATILIO, FABIO BRISTOTTI, J NORBERTO e SALTON.
- Os BIs de cliente e de representante são recalculados a partir dessas versões, sem alterar as regras de ponderação já aprovadas.

## Detalhes técnicos
- `src/lib/performance-farol.ts`: mapa de cor por faixa deixa de ser fixo e passa a aceitar uma legenda detectada na planilha; inclui suporte a cores de tema (`theme:N` + tint), hoje perdidas.
- `src/lib/performance-import-engine.ts` e `src/lib/performance-parser.ts`: detectar o bloco de legenda (texto do tipo "Ótimo = ..." com preenchimento), montar o dicionário cor → faixa do arquivo e usar como fonte apenas quando não houver número; preencher `familia_pct` com o valor da faixa, `metas_status` e `metas_cores`.
- Ajustar os testes existentes e acrescentar casos: prioridade do número sobre a cor, cor de tema, célula sem cor e legenda ausente.
- Carga das 16 planilhas: script de importação usando o mesmo motor, gravando via `submit_performance_upload`, marcando as versões antigas de 1º Semestre 2026 como substituídas e registrando metas no schema privado.
- Novos representantes criados com o nome do arquivo, vinculados à mesma empresa dos atuais.

## Validação
- Testes do parser e do motor de faróis.
- Conferência, por representante, do número de clientes e da distribuição de faróis contra a planilha de origem.
- Abrir a Performance de dois representantes e um BI de cliente no navegador para confirmar percentuais, cores e ausência de "Sem dado" indevido.
