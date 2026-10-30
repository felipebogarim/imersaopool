# Aplicar migration de Evolução das Ações

Confirmado: a tabela `kanban_action_tracking` não existe no banco.

## O que a migration cria
- Função `kanban_can_access_card`
- 5 tabelas: `kanban_action_tracking`, `kanban_action_updates`, `kanban_action_update_files`, `kanban_action_pendencias`, `kanban_action_update_requests`
- 4 índices, GRANTs, RLS ligado nas 5 tabelas, 4 políticas (`kat_all`, `kau_all`, `kauf_all`, `kap_all`)
- Política de leitura `action_updates_select` em storage.objects
- Bucket privado `action-updates` (25 MB)
- Permissões de menu `ferramentas.evolucao-acoes` (gestor/agente sim, comercial não)

Observação: a migration não contém triggers.

## Passos
1. Aplicar a parte estrutural (função, tabelas, índices, grants, RLS, políticas, política do storage) exatamente como no arquivo, pela ferramenta de migration.
2. A ferramenta de migration não aceita criar buckets nem inserir dados. Por isso:
   - criar o bucket `action-updates` (privado, 25 MB) pela ferramenta de storage;
   - inserir as 3 linhas de `role_permissions` pela ferramenta de dados (com `ON CONFLICT DO NOTHING`).
3. Validar via consulta: tabelas, colunas, índices, função, RLS habilitado, políticas, bucket e linhas de permissão.
4. Abrir `/ferramentas/evolucao-acoes` logado e checar console/rede para garantir que a consulta à tabela não dá erro.
5. Relatar qualquer erro encontrado.

Nenhum outro arquivo ou estrutura será alterado.
