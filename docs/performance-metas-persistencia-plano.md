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
- **Sugestões da IA** (`performance_goal_ai_suggestions`): só inserção. Botão "Sugestão IA" →
  **uma análise** do cliente para as 7 famílias (mesmo `analise_id`); a tela mostra sempre a
  última e permite gerar outra (nada é gerado ao abrir a página). Contexto do banco: imersões
  (entrevistas, formulários da visita e do representante, relatórios de campo) → histórico em
  R$ → comparáveis da mesma categoria (região do representante; empresa toda se houver menos de
  3; só médias) → perfil. Pontos de farol não entram. Modelo econômico do gateway existente
  (`google/gemini-2.5-flash`) com saída estruturada (tool calling). Por família: valor mensal,
  participação no total sugerido, justificativa, origem (**Imersão**, **Tendência** ou **Dados
  limitados**) e confiança (alta/média/baixa). O servidor valida: "Imersão" só com registro de
  imersão; sem dado financeiro nem comparável → "Dados limitados" (confiança baixa, teto de
  1,1× a referência); teto geral de 3× a maior referência em R$; família ausente → recomendação
  conservadora. Pode subir ou reduzir famílias e o total, sem compensação. Grava modelo e `base`
  (fontes + resumo da análise). A IA nunca altera a meta oficial: o gestor usa "Aplicar IA"
  (todas) ou "Usar IA" (uma família) e pode editar. Registros `origem = 'simulacao'` antigos
  ficam ocultos.
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
