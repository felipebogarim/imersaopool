# Plano de Correção — Importador Mapa de Preços

O importador da página Mapa de Preços apresenta falhas no mapeamento de preços (resultando em R$ 0,00), na classificação técnica (convertendo tudo para "Alternativo") e na lógica de atualização de registros. Este plano corrige o parser, a interface de importação e aplica refinamentos visuais à tabela.

## Alterações Técnicas

### 1. Núcleo de Importação (`src/lib/price-mapa/parser/import-logic.ts`)
- **Mapeamento de Preços**: Substituir o fallback `0` por `null`. Implementar suporte às colunas específicas "Preço Newline Black Brasil" e "Preço Newline Black SP" baseadas na seleção do usuário.
- **Classificação Técnica**: Expandir o mapeamento de strings para suportar "Equivalente direto", "Aproximado forte", etc., sem perda de precisão.
- **Regra Usina Bob**: Reforçar a normalização fixa de R$ 39,60/m para o produto Usina Bob 30865.
- **Detecção de Duplicidade**: Implementar lógica de upsert baseada na chave: `família + código Newline + marca concorrente + modelo concorrente`.

### 2. Interface de Importação (`src/components/price/mapa/ImportadorMapa.tsx`)
- **Mapeamento de Cabeçalhos**: Adicionar aliases para os cabeçalhos obrigatórios da planilha (`Preço Newline Black Brasil`, `Preço Concorrente Normalizado por m`, etc.).
- **Preview de Dados**: Adicionar uma etapa de visualização prévia (tabela) antes de persistir no banco local.
- **Relatório de Importação**: Exibir resumo detalhado (Linhas lidas, atualizadas, erros, etc.) após a conclusão.
- **Bloqueio de Erros**: Impedir a importação se campos críticos resultarem em zero/erro de mapeamento.

### 3. Visualização de Dados (`src/routes/_authenticated/price/mapa.tsx`)
- **Tabela de Preços**:
  - Implementar linhas zebradas (alternância de cinza suave).
  - Aumentar contraste dos preços Newline (negrito).
  - Ajustar o preenchimento das células do Farol para 60% (em vez de 100%).
  - Substituir exibição de `R$ 0,00` por `Preço não identificado` quando o valor for `null`.
- **Lógica de Seleção de Tabela**: Garantir que a troca entre "Black Brasil" e "Black SP" re-processe os dados importados com a coluna correta.

## Experiência do Usuário
- O usuário terá clareza sobre o que foi importado e o que falhou.
- A visualização será mais legível e profissional, destacando o posicionamento competitivo de forma equilibrada.
- Os dados serão persistidos sem duplicidades, permitindo correções rápidas via re-upload.

---
Technical Details:
- Using `xlsx` for parsing.
- Local state management for preview.
- Tailwind for 60% width farol badges.
- String normalization in `import-logic.ts` to handle diverse spreadsheet naming conventions.
