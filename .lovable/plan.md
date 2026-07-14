# Plano — Implantar módulo Pool Backup

Substituir o placeholder atual em `/pool-backup` pelo módulo funcional completo definido na skill **Backup Modulo Pool**.

## 1. Banco de dados (migration única)

Criar 4 tabelas no schema `public`, todas com GRANTs, RLS e política restrita a **admin** (o projeto não tem role `master` — usaremos `admin` via `has_role(auth.uid(),'admin')`).

- **backup_config** (singleton): `auto_backup`, `frequencia`, `retencao_dias`, `limite_gb`, `github_repo`, `github_branch`, `horario_execucao`, timestamps. Seed de 1 linha.
- **backup_jobs**: `tipo` (json|completo|arquivos|codigo), `status` (executando|ok|erro), `tamanho_bytes`, `storage_path`, `iniciado_por`, `origem` (manual|auto), `erro`, `concluido_em`.
- **backup_historico**: `usuario_label`, `operacao`, `resultado` (ok|atencao|critico), `detalhe`, `job_id`.
- **backup_auditoria**: `status`, `graves`, `medios`, `baixos`, `relatorio jsonb`.

## 2. Storage

- Novo bucket privado `backups`.
- Estrutura de pastas: `json/`, `completo/<job_id>/`, `arquivos/<job_id>/`, `codigo/<job_id>.zip`.

## 3. Agendamento (pg_cron + pg_net)

- `backup-json-diario` — todos os dias 03:00 → chama `/api/public/backup-run` com `{tipo:'json',origem:'auto'}`.
- `backup-auditoria-semanal` — domingos 04:00 → chama `/api/public/backup-audit`.
- Autenticação via header `apikey` com o anon key (padrão Lovable Cloud).

## 4. Endpoints (TanStack server routes em `src/routes/api/public/`)

O projeto é TanStack Start — usaremos server routes em vez de Supabase Edge Functions (conforme diretriz `server-side-modern`).

- **`api/public/backup-run.ts`** — body `{tipo, origem, iniciado_por}`.
  - `json`: dump de todas as tabelas `public.*` relevantes → `json/<id>.json`.
  - `completo`: dump + cópia de todos os buckets (`imersoes-anexos`, `product-images`) → `completo/<id>/`.
  - `arquivos`: só arquivos dos buckets → `arquivos/<id>/`.
- **`api/public/backup-codigo.ts`** — lê `github_repo`/`github_branch` de `backup_config`, baixa zipball via `GITHUB_TOKEN`, sobe em `codigo/<id>.zip`.
- **`api/public/backup-audit.ts`** — para cada categoria (json/completo/arquivos), avalia último job ok: <7d = ok, 7–14d = atenção, >14d = crítico. Persiste em `backup_auditoria` + `backup_historico`.

Todos os endpoints:
- Usam `SUPABASE_SERVICE_ROLE_KEY` para gravar em `backup_jobs`/`backup_historico`.
- Inserem job com status `executando`, executam, atualizam para `ok`/`erro`.
- Registram entrada em `backup_historico`.

## 5. Interface — `src/routes/_authenticated/pool-backup.tsx`

Substituir placeholder. Guard: apenas admin (usa `has_role`). Página única com `<Tabs>` shadcn e header contendo botões **Atualizar** e **Auditar Agora**.

Abas na ordem:
1. **Dashboard** — 8 StatusCards (Status Geral, Último JSON, Último Completo, Último Arquivos, Agendamento, Espaço Utilizado, Backups Armazenados, Riscos Detectados).
2. **Backup JSON** — botão gerar + tabela de jobs (baixar/excluir).
3. **Backup Completo** — botão + barra de progresso com 7 estágios (8→100%) + tabela.
4. **Arquivos** — botão sincronizar + progresso 3 estágios + tabela.
5. **Código Fonte** — card read-only com repo/branch + botão gerar (desabilita sem repo) + progresso 3 estágios + tabela.
6. **Auditoria** — 4 cards (Geral, Graves, Médios, Baixos) + Último Relatório.
7. **Histórico** — tabela: Data, Usuário, Operação, Detalhe, Resultado.
8. **Configurações** — formulário editável de `backup_config` (toggle auto, frequência, retenção, limite).

Componentes auxiliares no mesmo arquivo: `StatusCard`, `BackupTable`, `AuditItem`, `statusBadge`, `fmtMB/GB/Date`.

**Ações de linha**:
- Baixar → signed URL 60s.
- Excluir → apaga arquivos do bucket + linha em `backup_jobs`.

## 6. Menu

Já existe item **Pool Backup** em `NAV_BOTTOM`. Nenhuma mudança necessária no menu.

## 7. Secrets

- `GITHUB_TOKEN` será solicitado somente quando o usuário quiser ativar o backup de código-fonte (pode ficar pendente sem quebrar o módulo — botão desabilita sem `github_repo`).

## Notas técnicas

- Role usada: `admin` (o projeto não tem `master`).
- Buckets já existentes cobertos pelo backup completo: `imersoes-anexos`, `product-images`.
- Endpoints públicos verificam apikey (anon) — não expõem PII e só operam sobre tabelas de backup.
- Tabelas `_authenticated` são acessadas via cliente browser com RLS admin.

## Ordem de execução

1. Migration (tabelas + bucket + cron).
2. Server routes em `src/routes/api/public/`.
3. Substituir `src/routes/_authenticated/pool-backup.tsx` pela UI completa.
