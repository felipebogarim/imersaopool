
# Privacidade dos valores monetários — Performance & Gerador

Objetivo: nenhum usuário (inclusive admin) pode ver metas/vendas em R$. Apenas percentuais, faixas, faróis e participações. Valores brutos ficam restritos a processamento server-side.

## 1. Banco de dados (migração)

- Mover colunas monetárias de `rep_performance_rows` (`total_meta`, `metas`) e de `rep_performance_uploads` (`categoria_metas` — que contém `__family_metas_by_category__` bruto) para um schema privado `performance_private`:
  - `performance_private.rep_row_values (row_id, total_meta, metas jsonb)` — FK para `rep_performance_rows`.
  - `performance_private.rep_upload_values (upload_id, categoria_metas jsonb)` — FK para `rep_performance_uploads`.
- `REVOKE ALL ... FROM anon, authenticated`; grants somente a `service_role`. Sem policies para authenticated/anon → PostgREST não expõe.
- Nas tabelas públicas, **remover** as colunas monetárias (`total_meta`, `metas`, `categoria_metas`) após copiar para o schema privado. Manter `metas_status` (faixa/farol) e `total_status` — não são monetários.
- Adicionar coluna `atingimento_pct numeric` em `rep_performance_rows` (derivado, já é o "TOTAL %").
- Idem para `gerador_performance_salvos`: mover payloads que contenham metas em R$ para `performance_private.gerador_values`. A tabela pública guarda apenas a versão "safe" (percentuais/faixas).
- Idem para `rep_bi_uploads`: separar `data` em `data_safe` (público) e `data_raw` (privado). Recalcular `data_safe` no backend.

## 2. Backend (server functions)

Novas server functions com `requireSupabaseAuth` + verificação de admin quando necessário; usam `supabaseAdmin` internamente para ler valores privados e retornam **apenas derivados**:

- `computePerformanceView(uploadId)` — lê rows + valores privados, calcula `atingimento_pct` por linha/família, faixas, farol, participações. Retorna estrutura sem R$.
- `computeBIShares(repId)` — cálculo dos rankings (menores/maiores por família por categoria) que hoje vive em `BISection.tsx`. Move para server, retorna `FamilyShare[]` já normalizados.
- `ingestPerformanceUpload(...)` — usado pelo Gerador ao enviar para o painel; grava valores brutos em `performance_private` e derivados em `rep_performance_rows`.
- `saveGeneratorResult(...)` — salva no repositório sem retornar R$ ao cliente.
- Exportações (Excel/PDF) que hoje são client-side viram server functions que streamam o arquivo já sem colunas monetárias.

## 3. Frontend — Performance (`representantes.performance.tsx`)

- Substituir queries diretas por `useServerFn(computePerformanceView)`.
- Nova ordem de colunas: **RAZÃO SOCIAL · CATEGORIA · ATINGIMENTO DA META (%) · [7 famílias]**. Remover `TOTAL META`. Renomear `TOTAL %` → `ATINGIMENTO DA META (%)` e mover para logo após CATEGORIA.
- Congelar RAZÃO SOCIAL + CATEGORIA no scroll horizontal.
- Rodapé: remover linhas monetárias, manter apenas `Participação %`, `Atingimento %`, distribuição do farol.
- Remover cards/tooltips que mostrem R$. Adicionar cards de contagem por faixa do farol.
- BI: `BISection.tsx` consome `computeBIShares` (o cálculo migra pro servidor).

## 4. Frontend — Gerador (`admin.gerador-performance.tsx`)

- Prévia mostra apenas: nome do arquivo, status, abas, nº clientes, nº famílias, período, representante, campos encontrados/ausentes, alertas, faixas e percentuais gerados. **Sem R$**.
- Mensagem de confidencialidade (texto do item 15) exibida antes do upload, durante processamento, na confirmação e no histórico.
- Botão "Baixar XLSX/PDF" chama server functions que geram arquivos sem R$.
- "Enviar para painel" chama `ingestPerformanceUpload`.

## 5. Arquivos brutos

- Bucket `performance-raw` privado (sem policies para authenticated). Upload via server function.
- Após processamento bem-sucedido → `supabaseAdmin.storage.remove([path])`. Manter apenas `file_name` + hash em `performance_private.rep_upload_values` como referência de auditoria.

## 6. Logs

- Remover qualquer `console.log`/`console.debug` que imprima `meta`, `metas`, `total_meta`, `estimatedRealized` em código enviado ao cliente. Especificamente o `console.debug("[BI shares]")` em `BISection.tsx`.
- Logs server-side não podem gravar valores de células (revisar `generate-performance.functions.ts`, `security_events`, `email_send_log`).

## 7. Dados legados

- Migração faz `INSERT INTO performance_private... SELECT ...` para todos os uploads existentes antes de `DROP COLUMN`. Nada precisa ser re-importado.
- Views antigas de PDF/Excel geradas dinamicamente passam a usar as server functions novas — automaticamente sem R$.

## 8. Detalhes técnicos

- Regenerar `types.ts` após migração (automático).
- `computeBIShares` mantém a fórmula ponderada atual (memória `bi-participacao-familia`). Apenas muda o local de execução.
- `atingimento_pct` por célula = `realizado_est/meta` quando houver dado real; quando só há faixa (faixa-mode), usa o midpoint do farol como hoje.

## Fora de escopo

- Redesenho visual dos cards (mantém estética atual, só remove os monetários).
- Novas permissões de usuário além das existentes.

## Ordem de execução

1. Migração DB (schema privado + cópia + drop de colunas públicas + bucket privado).
2. Server functions de leitura/ingestão/exportação.
3. Refactor `representantes.performance.tsx` (colunas, freeze, rodapé, cards).
4. Refactor `admin.gerador-performance.tsx` (prévia sem R$, mensagem, exports server-side).
5. Refactor `BISection.tsx` (consome server fn, remove logs).
6. Limpar exports/PDF client-side legados.

Confirma que posso executar nessa ordem? A migração vai mover dados e dropar colunas públicas — é irreversível pelo frontend, então quero seu OK antes.
