# Solicitações Internas — configuração manual pendente

Este módulo (schema, e-mail, webhook, admin, dashboard) está implementado e
validado por `npm run build` + `npx tsc --noEmit` + testes unitários, mas
**nada foi aplicado a um banco real nem a uma conta Resend real**. Este
documento lista exatamente o que falta configurar manualmente antes de usar
em produção — ninguém deve fazer isso automaticamente sem revisão humana.

## 1. Aplicar as migrations

Na ordem (todas em `supabase/migrations/`, prefixo `202609231`/`202609232`…):

1. `20260923080000_internal_ticket_email_outbox.sql`
2. `20260923090000_internal_tickets_app_role_values.sql`
3. `20260923090100_internal_tickets_core_schema.sql`
4. `20260923100000_internal_tickets_nav_permissions.sql`
5. `20260923110000_internal_tickets_dashboard_nav_permission.sql`
6. `20260923120000_internal_tickets_attachments_storage.sql`
7. `20260923130000_internal_tickets_security_hardening.sql`
8. `20260923140000_internal_tickets_seed_categories.sql`
9. `20260923150000_internal_tickets_person_phone.sql`
10. `20260923160000_internal_tickets_sector_stops.sql`
11. `20260923170000_internal_tickets_products.sql`

Aplicar via `supabase db push` (CLI conectada ao projeto) ou colando o SQL no
editor do Supabase Dashboard, nesta ordem exata — a migration 2 precisa
commitar antes da 3 usar os valores de enum que ela cria (não dá pra rodar as
duas na mesma transação).

Depois de aplicar, **regenerar `src/integrations/supabase/types.ts`** (`supabase
gen types typescript`). Isso elimina a necessidade dos `as any` espalhados
pelo módulo (documentados inline com o motivo, buscar por
`ainda não está no types.ts gerado`) — trocar por tipos reais depois de
regenerar é recomendado, não obrigatório.

## 2. Cadastrar gente nos setores

As migrations semeiam os 7 setores (Engenharia, Produção, Expedição,
Cadastro, Financeiro, Trade, Diretoria) **sem nenhuma pessoa vinculada**, por
instrução explícita do briefing original. Sem isso, `sendInternalTicket`
falha com "Nenhum destinatário principal configurado" para qualquer setor.
Cadastrar em **Admin → Solicitações Internas → Pessoas**.

As 7 categorias iniciais (migration 8, sourced dos exemplos do briefing
original) já vêm com `default_sector_id` preenchido — revisar/editar/
desativar/adicionar em **Admin → Solicitações Internas → Categorias**
conforme a necessidade real do time.

## 3. Conta Resend

1. Criar/confirmar a conta Resend (mencionado: hoje está no plano gratuito).
2. Verificar um domínio ou subdomínio dedicado a este módulo — **recomendado
   um subdomínio específico** (ex. `chamados.poolflux.app`), não o domínio
   raiz, para isolar reputação de envio e não interferir no domínio de
   e-mail nativo do Lovable (`notify.poolflux.app`, usado pelo resto do
   sistema — ver PROJECT_BRAIN). Configurar os registros DNS que a Resend
   pedir (SPF/DKIM, e MX se for usar o recebimento — "Inbound" da Resend —
   nesse mesmo subdomínio).
3. Gerar uma **API key exclusiva** deste módulo (não reaproveitar chaves de
   outros projetos, mencionado como já existentes na conta).
4. Configurar um **Webhook** na Resend apontando para
   `https://<seu-domínio>/api/public/internal-tickets/resend-webhook`,
   assinando os eventos: `email.sent`, `email.delivered`,
   `email.delivery_delayed`, `email.bounced`, `email.complained`,
   `email.failed`, e o evento de inbound (ver aviso abaixo). Copiar o
   **signing secret** (`whsec_...`) gerado pela Resend/Svix.

   ⚠️ **O nome do evento inbound (`email.received`) e o formato do payload
   inbound usados em `src/lib/internal-tickets/email/inbound.ts` foram
   assumidos com base em conhecimento geral da Resend, sem uma chamada real
   de API para confirmar** — a conta usada neste projeto não tem inbound
   configurado. Antes de habilitar em produção: configurar o inbound de
   teste na Resend, mandar um e-mail de teste, capturar o payload real do
   webhook e comparar com `parseInboundEmailData()`. Ajustar nomes de campo
   se necessário — a lógica de correlação (reply-address → Message-ID/
   References) não muda, só a extração dos campos do payload.

## 4. Variáveis de ambiente

Nenhuma tem valor real configurado hoje. Definir no ambiente de execução
(Lovable Cloud / Supabase secrets, conforme o projeto já usa para as outras
`process.env.*` deste repositório):

| Variável | Valor |
|---|---|
| `RESEND_API_KEY` | API key gerada no passo 3.3 |
| `RESEND_WEBHOOK_SECRET` | signing secret (`whsec_...`) do passo 3.4 |
| `INTERNAL_TICKETS_REPLY_DOMAIN` | o subdomínio verificado no passo 3.2 |
| `INTERNAL_TICKETS_REPLY_SECRET` | um segredo aleatório novo (ex. `openssl rand -hex 32`) — assina o token do endereço de resposta; nunca reaproveitar outro segredo do projeto |
| `INTERNAL_TICKETS_EMAIL_MODE` | deixar **ausente** em produção (usa Resend real). Definir como `mock` em ambiente de teste/staging para usar o provider em memória (`FakeEmailProvider`) sem custo nem credencial — ver Fase 7 |

## 5. Checklist de validação ponta-a-ponta (fazer manualmente após os passos acima)

- [ ] Logar como usuário com role `comercial`, criar um ticket em
      `/solicitacoes/novo`, confirmar que o e-mail chega ao destinatário
      cadastrado no setor.
- [ ] Responder o e-mail recebido e confirmar que a resposta aparece na
      timeline do ticket em `/solicitacoes/$ticketId`.
- [ ] Clicar em cada uma das 5 ações do link público (se os botões de ação
      forem adicionados ao template depois — hoje o e-mail só orienta a
      responder diretamente) e confirmar transição de status + registro de
      evento.
- [ ] Confirmar que um clique duplo/reload no link de ação não duplica o
      efeito (token já usado).
- [ ] Verificar `internal_ticket_email_outbox` no banco: status "sent" após
      envio bem-sucedido, "failed" com `error_message` preenchido em caso de
      falha simulada.
- [ ] Papéis `gestor_comercial` e `diretoria`: criar um usuário de teste com
      cada role, conferir que o menu "Solicitações Internas" aparece
      corretamente (diretoria sem "Novo Ticket").
- [ ] Subir um anexo em `/solicitacoes/$ticketId` e confirmar que outro
      usuário sem acesso àquele ticket não consegue baixar o arquivo pela
      URL assinada (RLS do Storage).

## 6. Riscos residuais conhecidos (revisados, aceitos por ora — ver PROJECT_BRAIN)

- RLS garante **quem** pode alterar a linha de um ticket, mas não impede um
  usuário autorizado de fazer um `PATCH` direto via API REST do Supabase
  mudando `status` para um valor fora do grafo de transições válido
  (`canTransition`) — a validação da máquina de estados vive só na camada de
  aplicação (`tickets.functions.ts`, `public-actions.functions.ts`), não em
  um trigger SQL. Mitigação possível futura: trigger `BEFORE UPDATE` em
  `internal_tickets` espelhando `TRANSITIONS` de `status.ts`.
- O e-mail de abertura de ticket ainda não tem os 5 botões de ação —
  destinatários respondem via reply-to normal. Os links de ação pública já
  funcionam (`/solicitacoes/acao/$token`), só faltam entrar no template.
