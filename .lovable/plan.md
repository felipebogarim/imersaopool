# Plan: Desconectar usuário felipe@poolbranding.com.br

O usuário solicitou a desconexão de todos os dispositivos para a conta `felipe@poolbranding.com.br`, obrigando-o a realizar um novo login.

## Alterações Propostas

### Backend (Supabase)

1. **Remover sessões ativas:**
   - Executar uma exclusão direta na tabela `auth.sessions` para o `user_id` correspondente (`92d1e486-7ba4-492f-8988-3c84bebb8e12`).
   - Isso invalidará imediatamente os tokens de acesso e de atualização existentes.

### Verificação

1. **Confirmar exclusão:**
   - Verificar se a contagem de sessões para o `user_id` é zero após a operação.

## Detalhes Técnicos

- **ID do Usuário:** `92d1e486-7ba4-492f-8988-3c84bebb8e12`
- **Tabela:** `auth.sessions`
- **Operação:** `DELETE FROM auth.sessions WHERE user_id = '92d1e486-7ba4-492f-8988-3c84bebb8e12'`
