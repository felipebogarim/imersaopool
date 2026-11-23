# Performance → METAS — plano de persistência (AGUARDANDO AUTORIZAÇÃO)

Nada deste documento foi executado. Nenhuma migration foi criada em `supabase/migrations`.
Após a autorização, a migration será gerada a partir deste plano e aplicada manualmente
no Lovable Cloud (padrão do projeto).

## Princípios

- **Isolamento:** não altera `rep_performance_uploads`, `rep_performance_rows`,
  `performance_private.*`, funções de farol, recomputações nem o motor do BI.
- **Separação de permissões no banco:** gestor/admin acessam por RLS; o representante
  (papel `representante`, usuário externo) já é bloqueado em todas as tabelas pela policy
  `block_external_rep`, então ele lê e grava **somente por server functions** escopadas
  por `repForUser` (mesmo padrão do portal do representante).
- **Histórico:** toda alteração de meta oficial e de sugestão do representante gera uma
  linha imutável de auditoria (trigger). Sugestões da IA são registradas como append-only.
- **Valores em R$** ficam fora do alcance do representante, exceto a própria meta oficial.

## Tabelas novas (schema `public`)

Todas com `company_id` (preenchido por trigger a partir do cabeçalho),
`ENABLE ROW LEVEL SECURITY`, policy RESTRICTIVE `block_external_rep` e
policies de gestão = `company_id = current_company_id()` **e**
`has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gestor')`.

### 1. `performance_goal_sets` — cabeçalho por cliente × competência

| coluna | tipo | regra |
|---|---|---|
| id | uuid PK | |
| company_id | uuid | |
| representative_id | uuid FK `representatives` | |
| client_id | uuid FK `clients`, nulo | vínculo fixo quando houver |
| cliente_key | text | razão social normalizada (vínculo atual por nome) |
| razao_social | text | snapshot |
| categoria | text | snapshot (Black/Gold/Silver) |
| competencia | date | 1º dia do mês (`CHECK extract(day)=1`) |
| status | text | `rascunho` · `em_revisao` · `aprovada` |
| created_by / updated_by | uuid | |
| created_at / updated_at | timestamptz | `touch_updated_at` |

`UNIQUE (company_id, representative_id, cliente_key, competencia)`.

### 2. `performance_goal_items` — meta oficial por portfólio (gestor)

| coluna | tipo | regra |
|---|---|---|
| goal_set_id | uuid FK cascade | |
| familia | text | `CHECK` nas 7 famílias canônicas |
| meta_oficial | numeric(14,2), nulo | `CHECK >= 0` |
| origem | text | `padrao` · `ia` · `representante` · `gestor` |
| comentario_gestor | text | interno (nunca exposto ao representante) |
| referencia_snapshot | numeric(14,2) | meta padrão vigente no momento do salvamento |
| updated_by / updated_at | | |

`UNIQUE (goal_set_id, familia)`. O representante só recebe `familia` + `meta_oficial`
pela server function.

### 3. `performance_goal_rep_suggestions` — sugestão do representante

| coluna | tipo | regra |
|---|---|---|
| goal_set_id | uuid FK cascade | |
| familia | text | 7 famílias |
| valor | numeric(14,2), nulo | `CHECK >= 0` |
| justificativa | text | |
| submitted_by | uuid | usuário do representante |
| updated_at | timestamptz | |

`UNIQUE (goal_set_id, familia)` (versão vigente; versões anteriores ficam no histórico).
Gestão: só leitura por RLS. Escrita: server function do representante (service role,
validando que o cliente é da carteira dele).

### 4. `performance_goal_ai_suggestions` — registro das sugestões da IA (append-only)

`goal_set_id`, `familia`, `valor`, `justificativa`, `tag` (`imersao` · `tendencia`),
`origem` (`simulacao` · `modelo`), `modelo` (texto, nulo), `created_by`, `created_at`.
RLS: gestão pode `SELECT`/`INSERT`; sem `UPDATE`/`DELETE`.

### 5. `performance_goal_history` — auditoria imutável

`goal_set_id`, `familia`, `tabela`, `acao` (`insert`/`update`/`delete`),
`dados_anteriores` jsonb, `dados_novos` jsonb, `changed_by`, `changed_at`.
Preenchida por trigger `SECURITY DEFINER` em `performance_goal_items` e
`performance_goal_rep_suggestions` (`changed_by` = `auth.uid()`, ou `submitted_by`
quando a gravação vem do service role). RLS: gestão só `SELECT`.

## Funções

- `public.save_performance_goals(_payload jsonb)` — RPC `SECURITY INVOKER` (respeita RLS),
  grava em uma transação o cabeçalho + metas/comentários alterados + sugestões da IA.
  Recusa quem não for admin/gestor.
- Server functions (após a migration):
  - `src/lib/performance-metas.functions.ts`: `getClientGoals`, `saveClientGoals`
    (gestão, `requireSupabaseAuth`, cliente RLS).
  - Representante: `repGetClientGoals`, `repSaveGoalSuggestions` no padrão de
    `rep-portal.functions.ts` (service role + `repForUser`), retornando só meta oficial,
    as próprias sugestões e as próprias justificativas.
- `src/lib/performance-metas-persistence.ts` (já existe como adaptador local) passa a
  chamar essas funções; a tela não muda.

## Permissão de menu

Seed em `role_permissions` para `performance.metas` (hoje só admin vê).
Proposta: `gestor` = sim · `agente` = não · `comercial` = não.

## Decisões necessárias antes de gerar a migration

1. **Competência:** uma meta por mês (`competencia`) ou meta vigente a partir de um mês
   até ser alterada? A tela hoje não tem seletor de mês.
2. **Identificação do cliente:** usar `cliente_key` (nome normalizado) + `client_id`
   opcional agora, ou exigir o vínculo fixo (`client_id`) antes de salvar?
3. **Perfis:** além de admin/gestor, algum papel interno (ex.: `agente`) deve ver metas?
4. **Uso oficial:** nesta fase as metas salvas NÃO alimentam o BI/faróis oficiais.
   Confirmar que a integração com o cálculo oficial fica para etapa posterior.
