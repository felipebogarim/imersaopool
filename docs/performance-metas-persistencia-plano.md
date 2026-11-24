# Performance → METAS — persistência

Migrations (aplicação manual no Lovable Cloud; não alteram tabelas, funções ou policies
existentes da Performance):

- `20261124120000_performance_goals.sql` — ciclos, metas, sugestões, histórico e permissões.
- `20261125120000_performance_goals_ai_real.sql` — sugestão IA real: coluna `base` em
  `performance_goal_ai_suggestions`, `performance_goal_ai_context` e
  `record_performance_goal_ai_suggestions`.

## Modelo

- **Cliente**: identificado como na importação — representante + `upper(btrim(razao_social))`
  da linha de Performance. O vínculo com `clients` é opcional e manual ("Revisar vínculo" →
  "Confirmar vínculo"), gravado no ciclo, sem alterar o cadastro de clientes.
- **Ciclo de vigência** (`performance_goal_cycles`): criado no primeiro salvamento com 6 meses a
  partir do mês corrente. Os ciclos de um cliente são sequenciais e sem sobreposição; o vigente é
  o que contém o mês corrente. O gestor pode estender o ciclo vigente para 12 meses (enquanto não
  houver próximo ciclo) ou **renovar**: a renovação programa o próximo ciclo (6 ou 12 meses) a
  partir do mês seguinte ao fim do último, sem interrupção, copiando as metas vigentes ao final
  dele; o ciclo atual não é alterado e segue até o fim previsto. Um ciclo futuro por vez.
  Revisar metas dentro de um ciclo é outra operação (abaixo).
- **Meta mensal por portfólio** (`performance_goal_items`): cada salvamento grava a meta a partir
  da **competência escolhida pelo gestor** (`vigente_desde`, dentro do ciclo vigente ou do
  próximo já programado; padrão = mês corrente). A meta de um mês M é a versão com maior `vigente_desde <= M`; versões anteriores
  permanecem. Metas de competências futuras aparecem na tela como "agendadas".
- **Sugestão do representante** (`performance_goal_rep_suggestions`): versão vigente por
  portfólio; versões anteriores ficam no histórico.
- **Sugestões da IA** (`performance_goal_ai_suggestions`): só inserção. Geradas no servidor
  ("Gerar sugestão IA"): contexto do banco com prioridade **imersão** (entrevistas, imersões,
  relatórios de campo) → **tendência histórica** do cliente → **perfil** → **comparáveis da
  região** (mesma categoria, região do representante, só médias e só com 3+ clientes). O modelo
  responde por portfólio; o servidor valida (múltiplo de 50, teto de 3× a maior referência
  conhecida) e grava valor, justificativa, tag (imersão/tendência), modelo e `base` (fontes
  usadas). A sugestão não altera a meta oficial: o gestor usa "Usar IA"/"Aplicar IA".
  Registros `origem = 'simulacao'` da fase de protótipo ficam no banco, ocultos na tela.
- **Histórico** (`performance_goal_history`): trigger em ciclos, metas e sugestões do
  representante grava ação, valores antes/depois, autor e data. Imutável.

## Permissões

| Perfil | Acesso |
|---|---|
| admin / gestor | Empresa ativa (`current_company_id()`): leitura por RLS e escrita pelas RPCs `get_performance_goals`, `save_performance_goals`, `renew_performance_goal_cycle`, `extend_performance_goal_cycle`, `confirm_performance_goal_link` |
| admin / gestor | Também `performance_goal_ai_context` e `record_performance_goal_ai_suggestions` (mesma checagem de papel e empresa) |
| representante | Só pelo servidor (service role): `rep_get_performance_goals`, `rep_save_goal_suggestions`, restritas à própria carteira, no portal (`/portal-rep` → "Metas para revisar" → `/portal-rep/metas/$rowId`). Recebe meta oficial, as próprias sugestões e o atingimento já calculado — nunca meta padrão, comentário do gestor, IA ou valores do upload |
| agente / comercial / demais | Sem acesso (dados e menu) |

Nenhuma escrita direta nas tabelas; `block_external_rep` em todas elas.

## Convite ao representante

"Convidar representante" (gestão, com metas já salvas) envia e-mail real (`metas-convite`) com o
link das metas do cliente no portal. Sem acesso: cria o usuário externo, vincula ao
representante e inclui o link de primeiro acesso (`/definir-senha`, 14 dias). Acesso criado mas
senha pendente: reenvia o link de senha.

## Recálculo do atingimento

Base comparável à meta mensal, com a origem identificada na interface:

1. **Venda realizada** — realizado em R$ do upload (`performance_private.rep_row_values`).
2. **Média histórica** — média em R$ do upload; sinalizada como "média histórica".
3. **Estimado** — atingimento × meta do upload, quando não há realizado nem média; sinalizado.

## Código

- `src/lib/performance-metas.functions.ts` — server functions (gestão e representante).
- `src/lib/performance-metas-persistence.ts` — conversões banco ↔ tela, competências, visão do representante.
- `src/lib/performance-metas-ai.ts` — prompt, base da recomendação e validação da resposta da IA.
- `src/components/performance-metas/RepMetasPortal.tsx` + `src/routes/portal-rep_.metas.$rowId.tsx` — portal.
- Sem a persistência disponível, a tela avisa e não grava (não há mais simulação local).
- Convite, IA e portal exigem `SUPABASE_SERVICE_ROLE_KEY` e `LOVABLE_API_KEY` no ambiente.

## Pendências

- Regenerar `src/integrations/supabase/types.ts` (o código usa RPCs não tipadas).
- Integração das metas salvas com o BI oficial (próxima etapa).
