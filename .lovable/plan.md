## Escopo

A entrega é grande e o próprio pedido diz **"Não avançar para a Etapa 2 antes de validar que a Etapa 1 reproduz fielmente a planilha original."** Vou seguir isso: implementar agora a **Etapa 1 completa**, deixar Etapa 2 e 3 esboçadas mas não construídas, e voltar após sua validação visual.

## Etapa 1 — Réplica fiel e editável (esta entrega)

### Banco (migração)

Ajustes nas tabelas existentes `rep_performance_uploads` e `rep_performance_rows`:

- `rep_performance_rows.metas_status` (jsonb) — status do farol por família importado da cor da célula, quando a planilha não trouxer % (ex.: `{ "Pro LED": "sem_compra", "Perfil": "otimo" }`).
- `rep_performance_rows.metas_cores` (jsonb) — cor original hex por família, para exportação fiel.
- `rep_performance_rows.realizado` (jsonb) — valores realizados por família (nulo por enquanto; usado na Etapa 3).
- `rep_performance_rows.observacao` (text) e `acompanhar` (bool) — placeholders p/ Etapa 2, criados agora para evitar segunda migração.
- `rep_performance_uploads.observacao` (text), `updated_at` (timestamptz), `updated_by` (uuid) — metadados de versão.
- Manter GRANTs e políticas atuais (a tabela já tem RLS por company/representante).

Nenhuma coluna existente é removida — planilhas antigas continuam funcionando.

### Parser (`parseWorkbook`)

Reescrever usando o XLSX com `cellStyles: true` para ler cor de fundo de cada célula da matriz e mapear para o farol:

```text
verde escuro       → excelente   (>100%)
verde              → otimo       (90–100%)
amarelo / lima     → proximo     (70–89,99%)
laranja            → pode_melhorar (50–69,99%)
vermelho           → abaixo_meta (<50%)
cinza / branco+0   → sem_compra  (0%)
```

O mapa cor→status vive em `src/lib/performance-faroI.ts` com fallback tolerante (distância RGB ao centro de cada faixa). Regras de fidelidade do item 15 respeitadas: nada é reordenado, renomeado, arredondado ou combinado; célula vazia fica **vazia** (não vira zero e não vira "abaixo da meta").

### UI — `src/routes/_authenticated/representantes.performance.tsx`

Reestruturar a página em componentes menores dentro de `src/components/performance/`:

- `PerformanceToolbar` — seletor rep / período / versão + ações (Editar, Salvar, Cancelar, Substituir, Nova, Exportar).
- `PerformanceResumo` — cards de Meta total, clientes na meta, abaixo, sem compra + cards por categoria (Black/Gold/Silver).
- `PerformanceLegenda` — chips coloridos do farol, sempre visíveis.
- `PerformanceMatriz` — tabela com:
  - colunas `Razão social` e `Categoria` congeladas (`sticky left-0` com z-index correto);
  - `thead` sticky;
  - rodapé com totais por família + total geral;
  - célula colorida pelo farol; tooltip com nome completo do cliente;
  - seletor de visualização (Meta / Realizado / Percentual / Completo) persistido em `localStorage`;
  - modo edição: célula vira `<input>` numérico, recálculo de totais em tempo real, aviso de "alterações não salvas", desfazer local antes de salvar.
- `PerformanceVersionamento` — lista de versões da planilha do rep atual, com badge da ativa e ações Restaurar / Comparar (comparar fica desabilitado nesta etapa e vai para Etapa 3).

### Versionamento

- `Substituir versão` passa a **arquivar** (nova linha em `rep_performance_uploads` com o mesmo período, marcando a anterior como `substituida_em`), em vez de deletar. Restauração = duplicar a versão antiga como nova ativa.
- Salvar edições em modo "editar metas" cria uma nova versão automaticamente (não sobrescreve silenciosamente), preservando arquivo original.

### Exportação

Botão `Exportar Excel` gera .xlsx com `xlsx-js-style` reaproveitando cores originais + valores atuais, com totais e cabeçalho de rep/período/versão.

## Etapa 2 — Gestão operacional (próxima entrega, após sua validação)

Filtros avançados, painel lateral por célula, observações, marcar para acompanhamento, edição em massa. Colunas `observacao` / `acompanhar` já criadas nesta migração.

## Etapa 3 — Integração analítica

Realizado vindo de vendas, % automático, histórico mensal, comparação entre versões, KPIs executivos com dados reais.

## Arquivos afetados nesta entrega

```text
supabase/migrations/<novo>.sql                             (nova migração)
src/lib/performance-farol.ts                               (novo)
src/lib/performance-parser.ts                              (novo — extraído da route)
src/lib/performance-export.ts                              (novo)
src/components/performance/PerformanceToolbar.tsx          (novo)
src/components/performance/PerformanceResumo.tsx           (novo)
src/components/performance/PerformanceLegenda.tsx          (novo)
src/components/performance/PerformanceMatriz.tsx           (novo)
src/components/performance/PerformanceVersionamento.tsx    (novo)
src/routes/_authenticated/representantes.performance.tsx   (reescrita usando os componentes acima)
package.json                                               (+ xlsx-js-style)
```

## Fora de escopo desta entrega

- Painel lateral por célula, filtros avançados, edição em massa, observações e acompanhamento (Etapa 2).
- Cálculo automático de realizado/percentual a partir de vendas (Etapa 3).
- Comparação entre versões (Etapa 3).

## Perguntas antes de executar

1. **Você tem a planilha real de exemplo** para eu calibrar o mapa cor→status? Sem ela posso implementar o mapa padrão descrito acima, mas cores fora do padrão podem cair na faixa errada até você me mandar 1 arquivo pra ajustar.
2. **"Substituir versão" deve arquivar (preservar a anterior) ou continuar apagando?** No plano acima passei a arquivar — confirma?
3. Confirma que posso seguir só com a **Etapa 1** agora e voltar para Etapa 2/3 depois da sua validação visual?
