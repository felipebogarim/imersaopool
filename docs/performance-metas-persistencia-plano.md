# Performance → METAS — persistência (migration AGUARDANDO APROVAÇÃO)

Migration: `supabase/migrations/20261124120000_performance_goals.sql` — **não aplicada**.
Validada num Postgres 16 descartável com stubs das dependências (aplicação + teste de
gravação, histórico, renovação, extensão, vínculo e bloqueios de permissão).

## Decisões

- **Meta mensal dentro de ciclo de vigência**: ciclo padrão de 6 meses, criado ao primeiro
  salvamento; pode ser estendido até 12 meses ou renovado (novo ciclo de 6 ou 12 meses que
  copia as metas vigentes). Alterar a meta durante o ciclo cria uma nova versão a partir do
  mês corrente (`vigente_desde`); a meta de um mês M é a versão com maior `vigente_desde <= M`.
- **Cliente**: identificado como na importação (`upper(btrim(razao_social))` + representante).
  Vínculo manual com `clients` é opcional (Revisar vínculo → Confirmar), sem alterar cadastros.
- **Permissões**: admin/gestor (empresa ativa) via RPC; representante só por server functions
  (service role) restritas à própria carteira, sem meta padrão, comentário do gestor nem IA.
- **Isolamento**: metas salvas NÃO substituem as metas oficiais do BI (integração: próxima etapa).
- **Recálculo**: valor vendido real do backend (`performance_private.rep_row_values`:
  realizado → média). Sem eles: atingimento × meta do upload, marcado como **estimado**;
  sem banco: atingimento × meta padrão (estimado).

## Objetos criados

| Objeto | Função |
|---|---|
| `performance_goal_cycles` | ciclo por cliente (início/fim, status, vínculo confirmado, renovado_de) |
| `performance_goal_items` | meta mensal por portfólio e versão (`vigente_desde`), origem, comentário, snapshot do padrão |
| `performance_goal_rep_suggestions` | sugestão vigente do representante |
| `performance_goal_ai_suggestions` | sugestões da IA, só inserção (sem duplicar a última igual) |
| `performance_goal_history` | auditoria imutável (trigger em ciclos, metas e sugestões) |
| RPCs gestão | `get_performance_goals`, `save_performance_goals`, `renew_performance_goal_cycle`, `extend_performance_goal_cycle`, `confirm_performance_goal_link` |
| RPCs representante (só service_role) | `rep_get_performance_goals`, `rep_save_goal_suggestions` |
| `role_permissions` | `performance.metas`: gestor = sim, agente/comercial = não |

RLS: leitura direta só admin/gestor da empresa ativa; nenhuma escrita direta (só RPC);
`block_external_rep` em todas as tabelas novas.

## Código

- `src/lib/performance-metas.functions.ts` — server functions (gestão e representante).
- `src/lib/performance-metas-persistence.ts` — conversões puras banco ↔ tela, visão do representante.
- Sem a migration aplicada, a tela funciona em simulação local (detecta função inexistente).

## Pendências

- Aplicar a migration (após aprovação) e regenerar `src/integrations/supabase/types.ts`.
- Tela do representante no portal (`/portal-rep`): as funções `repGetMetasGoals` /
  `repSaveMetasSuggestions` já existem; falta o ponto de entrada no portal.
- Integração das metas salvas com o BI oficial (próxima etapa).
