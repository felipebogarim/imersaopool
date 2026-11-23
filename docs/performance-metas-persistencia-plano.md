# Performance → METAS — persistência

Migration: `supabase/migrations/20261124120000_performance_goals.sql` (aplicação manual no
Lovable Cloud, somente após aprovação). Não altera nenhuma tabela, função ou policy existente.

## Modelo

- **Cliente**: identificado como na importação — representante + `upper(btrim(razao_social))`
  da linha de Performance. O vínculo com `clients` é opcional e manual ("Revisar vínculo" →
  "Confirmar vínculo"), gravado no ciclo, sem alterar o cadastro de clientes.
- **Ciclo de vigência** (`performance_goal_cycles`): criado no primeiro salvamento com 6 meses a
  partir do mês corrente; um ciclo ativo por cliente. O gestor pode estender o ciclo ativo para
  12 meses ou renovar (encerra o atual e abre um novo de 6 ou 12 meses, a partir do mês seguinte
  ao fim do atual, copiando as metas vigentes).
- **Meta mensal por portfólio** (`performance_goal_items`): cada salvamento grava a meta a partir
  da **competência escolhida pelo gestor** (`vigente_desde`, dentro do ciclo; padrão = mês
  corrente). A meta de um mês M é a versão com maior `vigente_desde <= M`; versões anteriores
  permanecem. Metas de competências futuras aparecem na tela como "agendadas".
- **Sugestão do representante** (`performance_goal_rep_suggestions`): versão vigente por
  portfólio; versões anteriores ficam no histórico.
- **Sugestões da IA** (`performance_goal_ai_suggestions`): só inserção, sem repetir a última igual.
- **Histórico** (`performance_goal_history`): trigger em ciclos, metas e sugestões do
  representante grava ação, valores antes/depois, autor e data. Imutável.

## Permissões

| Perfil | Acesso |
|---|---|
| admin / gestor | Empresa ativa (`current_company_id()`): leitura por RLS e escrita pelas RPCs `get_performance_goals`, `save_performance_goals`, `renew_performance_goal_cycle`, `extend_performance_goal_cycle`, `confirm_performance_goal_link` |
| representante | Só pelo servidor (service role): `rep_get_performance_goals`, `rep_save_goal_suggestions`, restritas à própria carteira. Recebe meta oficial, as próprias sugestões e o atingimento já calculado — nunca meta padrão, comentário do gestor, IA ou valores do upload |
| agente / comercial / demais | Sem acesso (dados e menu) |

Nenhuma escrita direta nas tabelas; `block_external_rep` em todas elas.

## Recálculo do atingimento

Base comparável à meta mensal, com a origem identificada na interface:

1. **Venda realizada** — realizado em R$ do upload (`performance_private.rep_row_values`).
2. **Média histórica** — média em R$ do upload; sinalizada como "média histórica".
3. **Estimado** — atingimento × meta do upload (ou × meta padrão, sem banco); sinalizado.

## Código

- `src/lib/performance-metas.functions.ts` — server functions (gestão e representante).
- `src/lib/performance-metas-persistence.ts` — conversões banco ↔ tela, competências, visão do representante.
- Sem a migration aplicada, a tela funciona em simulação local.

## Pendências

- Regenerar `src/integrations/supabase/types.ts` após aplicar.
- Entrada da tela do representante no portal (`/portal-rep`); as funções já existem.
- Integração das metas salvas com o BI oficial (próxima etapa).
