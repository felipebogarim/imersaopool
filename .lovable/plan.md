## O que aconteceu

A migração de privacidade moveu `metas`, `total_meta` e `categoria_metas` (incluindo `__family_metas_by_category__`) para o schema privado `performance_private`, acessível só ao `service_role`. Mas `src/components/BISection.tsx` continua fazendo o cálculo no cliente lendo essas colunas de `rep_performance_rows` / `rep_performance_uploads` via `supabase` (chave publishable). O `select` agora traz `undefined` nesses campos, então:

- `cellMeta` é sempre 0,
- `metaAcc` / `estAcc` ficam vazios,
- `sharesByCategory` vira `{}` → cards "menores" e "maiores" por categoria zeram.

Os cards de destaque no topo (Atingimento geral, participação por categoria/farol) continuam funcionando porque vêm de `rep_bi_uploads.data`, que não foi afetado — por isso só o bloco novo de rankings sumiu.

## Correção

1. Criar server function `computeBIShares(repId)` em `src/lib/bi-shares.functions.ts`:
   - `createServerFn({ method: "GET" })` + `.middleware([requireSupabaseAuth])`.
   - Dentro do handler, importar dinamicamente `supabaseAdmin` de `@/integrations/supabase/client.server`.
   - Validar acesso do usuário à empresa do representante via `context.supabase` (RLS aplica).
   - Ler o upload ativo, `rep_performance_rows` (público) + `performance_private.rep_row_values` (metas por célula) + `performance_private.rep_upload_values` (`categoria_metas.__family_metas_by_category__`).
   - Rodar exatamente a mesma fórmula ponderada de hoje (`RANGE_FACTOR`, hierarquia `cellMeta` → `categoryFamilyMeta`, memória `bi-participacao-familia`).
   - Retornar `{ [categoria]: FamilyShare[] }` — apenas derivados (`shareRatio`, nomes). Nunca R$.

2. Refatorar `src/components/BISection.tsx`:
   - Substituir a query `rep-perf-current` + `useMemo sharesByCategory` por `useQuery` chamando `useServerFn(computeBIShares)`.
   - Remover leitura de `metas`, `total_meta`, `categoria_metas` no cliente.
   - Remover `console.debug("[BI shares] …")` e `console.debug("[BI ranking] …")` (memória de privacidade proíbe logar meta/estimado no cliente; o server function também não deve logar valores).
   - Manter o restante do componente (upload BI, cards de destaque, ordem Black→Gold→Silver, top 3 menores/maiores) inalterado.

3. Sem migração nova, sem mudança de UI além da remoção dos logs.

## Fora de escopo

- Refatorar `representantes.performance.tsx` (usa `as any` mas ainda renderiza — não é o bug relatado).
- Refatorar `clientes-bi.$repId.$razao.tsx`.

Confirmo prosseguir com essa correção pontual?