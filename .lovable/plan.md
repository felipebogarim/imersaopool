# Plan: Desconectar usuário felipe@poolbranding.com.br

O usuário solicitou a desconexão de todos os dispositivos para a conta `felipe@poolbranding.com.br`, obrigando-o a realizar um novo login.

## Alterações Propostas

### Backend (Supabase)

1. **Remover sessões ativas:**
   - Executar uma exclusão direta na tabela `auth.sessions` para o `user_id` correspondente (`92d1e486-7ba4-492f-8988-3c84bebb8e12`).
   - Isso invalidará imediatamente os tokens de acesso e de atualização existentes.

### Correções de Runtime

1. **Corrigir Erro de Hidratação:**
   - No arquivo `src/routes/auth.tsx`, a rota está configurada com `ssr: false`, mas o erro de hidratação sugere que o TanStack Start ainda está tentando renderizar algo no servidor que diverge do cliente (possivelmente devido ao `Suspense` ou à estrutura do layout).
   - Vou envolver o conteúdo da página em um componente `<ClientOnly>` ou garantir que a renderização seja estável para evitar o erro `Hydration failed`.

### Verificação

1. **Confirmar exclusão de sessões:**
   - Verificar se a contagem de sessões para o `user_id` é zero após a operação.
2. **Validar carregamento da página de login:**
   - Abrir a página `/auth` via Playwright para garantir que o erro de hidratação foi resolvido.

## Detalhes Técnicos

- **ID do Usuário:** `92d1e486-7ba4-492f-8988-3c84bebb8e12`
- **Operação SQL:** `DELETE FROM auth.sessions WHERE user_id = '92d1e486-7ba4-492f-8988-3c84bebb8e12'`

