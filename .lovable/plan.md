## Objetivo

Criar uma área **Forms** no menu Inputs, com gerador de formulários por IA, publicação em URL pública própria por formulário, edição e repositório de respostas dentro da mesma página.

## Estrutura da funcionalidade

### 1. Menu
- Adicionar item **Forms** dentro do grupo *Inputs* na sidebar (`src/components/AppShell.tsx`), com rota `/forms`.

### 2. Página principal `/forms` (autenticada, dentro de `_authenticated`)
Três blocos empilhados na mesma página:

1. **Gerador**
   - Campo *Título* (obrigatório) → gera o slug do form.
   - Campo *Prompt* (textarea) descrevendo o formulário desejado.
   - Botão **Gerar com IA** → chama server function que usa Lovable AI (Gemini) e retorna um schema JSON de campos (tipo, label, placeholder, opções, obrigatório).
   - Preview inline do form gerado + botão **Salvar** (persiste em `forms`).

2. **Forms criados** (lista/repositório)
   - Colunas: título, slug, criado em, nº de respostas, status (ativo/pausado).
   - Kebab com: **Abrir link público** (copia URL), **Editar** (abre editor de schema), **Ver respostas**, **Pausar/ativar**, **Excluir**.

3. **Respostas** (drawer/dialog acionado pelo kebab **Ver respostas**)
   - Tabela com colunas dinâmicas a partir do schema + data de envio.
   - Botão **Exportar CSV**.

### 3. URL pública do formulário
- Rota pública `src/routes/f.$slug.tsx` (fora de `_authenticated`), sem shell, sem menu, sem links para outras áreas do sistema.
- Formato final: `https://.../f/[titulo-em-slug]` (usamos o prefixo `/f/` para evitar colisão com rotas do app como `/dashboard`, `/auth`, `/imersoes` etc. — usar `/[titulo]` sem prefixo bloquearia qualquer rota nova com esse nome).
- Renderiza os campos do schema, valida e envia via server route pública em `src/routes/api/public/forms/submit.ts` (grava em `form_responses` com Supabase admin server-side).
- Após envio, mostra tela de "Resposta enviada" — sem link para login nem para app.

### 4. Banco de dados
Migration com:

- `public.forms`: `id`, `company_id`, `slug` (único global), `title`, `prompt`, `schema jsonb`, `is_active bool default true`, `created_by`, `created_at`, `updated_at`.
- `public.form_responses`: `id`, `form_id (fk)`, `answers jsonb`, `submitted_at`, `ip`, `user_agent`.
- Índices em `slug` e `form_id`.
- Trigger `set_company_id_default` (padrão do projeto).
- Trigger `updated_at`.

### RLS
- `forms`: autenticados leem/escrevem os da própria empresa (`company_id = current_company_id()`); `anon` recebe **SELECT restrito** apenas por `slug` de forms ativos, retornando só colunas necessárias (schema, title). Como PostgREST não filtra colunas por policy, o SELECT anônimo será feito via **RPC security definer** `public.get_active_form_by_slug(_slug text)` retornando `id, title, schema` — evita expor `prompt`, `company_id`, `created_by`.
- `form_responses`: `anon` só pode **INSERT** (com `form_id` de form ativo, validado em trigger `BEFORE INSERT`); autenticados leem os do próprio `company_id` (join via `forms`).
- Server route pública usa `supabaseAdmin` para gravar após validar slug/ativo.

### 5. Geração por IA
- Server function `generateFormSchema` (`src/lib/generate-form.functions.ts`) com `requireSupabaseAuth`.
- Modelo: `google/gemini-2.5-flash` via `https://ai.gateway.lovable.dev/v1/chat/completions` com `response_format: json_object` (mesmo padrão de `generate-perspectivas.functions.ts`).
- Prompt de sistema instrui a devolver:
  ```
  { "fields": [ { "id", "label", "type" ("text"|"textarea"|"email"|"number"|"select"|"radio"|"checkbox"|"date"), "required", "placeholder"?, "options"?: [{"value","label"}] } ] }
  ```
- Cliente valida com Zod antes de salvar.

### 6. Editor de forms já criados
- Rota `/_authenticated/forms.$id.tsx`: edita título, prompt (opcional), schema (formulário visual: adicionar/remover/reordenar campos, tipo, opções), toggle ativo/pausado.
- Botão **Regenerar com IA** re-executa a geração usando o prompt atual.

## Detalhes técnicos

- **Slug**: gerado com `slugify` (lower, remove acentos, `-`); checa unicidade e sugere sufixo numérico se colidir.
- **Reservados**: bloquear slugs iguais a rotas do sistema (`dashboard`, `auth`, `imersoes`, `entrevistas`, `admin`, `f`, `api`, `r`, `evento`, `clientes`, `produtos`, `familias`, `roteiros`, `agentes`, `price`, `projecao`, `perspectivas`, `compilacoes`, `planos`, `representantes`, `empresas`, `novo-corp`, `permissoes`, `forms`, `nda`).
- **Público seguro**: rota pública nunca importa `AppShell`; sem `<Link>` para rotas internas; header simples com brand.
- **Submissão**: server route em `src/routes/api/public/forms/submit.ts` valida o schema no servidor (mesmo Zod usado no client) e insere via `supabaseAdmin`.
- **Erros de gateway**: tratamento explícito para `429` (rate limit) e `402` (créditos) com toast.

## Arquivos

Criados:
- `supabase/migrations/<ts>_forms.sql`
- `src/lib/form-schema.ts` (tipos + Zod compartilhados)
- `src/lib/generate-form.functions.ts`
- `src/routes/_authenticated/forms.index.tsx`
- `src/routes/_authenticated/forms.$id.tsx`
- `src/routes/f.$slug.tsx` (público)
- `src/routes/api/public/forms/submit.ts`
- `src/components/FormRenderer.tsx` (renderiza schema como formulário)
- `src/components/FormBuilder.tsx` (editor visual de schema)

Editados:
- `src/components/AppShell.tsx` (novo item no INPUTS)
- `src/integrations/supabase/types.ts` (gerado após migration)

## Fora do escopo (desta rodada)
- Uploads de arquivo dentro do form (posso adicionar depois).
- Lógica condicional (mostrar campo B se A = X).
- Notificações por e-mail ao receber resposta.
- Multi-página / branching.
