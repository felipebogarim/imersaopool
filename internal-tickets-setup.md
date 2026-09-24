# Solicitações Internas — configuração manual pendente

Este documento lista as ações externas que continuam manuais. As migrations
`20260924140000` e `20260924150000` já foram aplicadas no Lovable Cloud. O
Receiving EMAIL-FIRST permanece desativado e suas novas migrations ainda não
foram aplicadas.

## 1. Aplicar as migrations

Para publicar a arquitetura EMAIL-FIRST, aplicar somente estas novas migrations,
na ordem, depois de confirmar que o histórico anterior até `20260924150000`
consta no banco:

1. `20260924160000_internal_ticket_email_first_enums.sql`
2. `20260924170000_internal_ticket_email_first_schema.sql`
3. `20260924180000_internal_ticket_email_first_rpcs.sql`
4. `20260924190000_internal_ticket_email_first_opening_message.sql`

Aplicar via `supabase db push` (CLI conectada ao projeto) ou colando o SQL no
editor do Supabase Dashboard, nesta ordem exata — a migration `160000` precisa
commitar antes das demais usarem os valores de enum novos.

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
   `email.failed` e `email.received`. Copiar o
   **signing secret** (`whsec_...`) gerado pela Resend/Svix.
5. Não habilitar Receiving até o runtime com as quatro migrations estar
   publicado. O webhook traz metadados; o runtime recupera corpo, headers e
   anexos em `GET /emails/receiving/:email_id` e endpoints de attachments.

## 4. Variáveis de ambiente

Nenhuma tem valor real configurado hoje. Definir no ambiente de execução
(Lovable Cloud / Supabase secrets, conforme o projeto já usa para as outras
`process.env.*` deste repositório):

| Variável                        | Valor                                                                                                                                        |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`                | API key gerada no passo 3.3                                                                                                                  |
| `RESEND_WEBHOOK_SECRET`         | signing secret (`whsec_...`) do passo 3.4                                                                                                    |
| `INTERNAL_TICKETS_REPLY_DOMAIN` | o subdomínio verificado no passo 3.2                                                                                                         |
| `INTERNAL_TICKETS_REPLY_SECRET` | um segredo aleatório novo (ex. `openssl rand -hex 32`) — assina o token do endereço de resposta; nunca reaproveitar outro segredo do projeto |
| `INTERNAL_TICKETS_EMAIL_MODE`   | definir explicitamente `resend` em produção; `mock` usa o provider em memória em teste/staging                                               |

`SUPABASE_SERVICE_ROLE_KEY` não deve ser criada, copiada para o cliente ou
inventada na VPS. O endpoint importa o cliente privilegiado somente no servidor;
o deploy deve usar a credencial gerenciada pelo Lovable Cloud. Se o runtime
publicado não a receber, Receiving deve permanecer desativado até a integração
de infraestrutura ser corrigida.

## 5. Checklist de validação ponta-a-ponta (fazer manualmente após os passos acima)

- [ ] Logar como usuário com role `comercial`, criar um ticket em
      `/solicitacoes/novo`, confirmar que o e-mail chega ao destinatário
      cadastrado no setor.
- [ ] Usar **Responder** como principal: solicitante recebe exatamente um relay.
- [ ] Usar **Responder a todos** com solicitante em CC: solicitante não recebe relay duplicado.
- [ ] Adicionar pessoa externa em TO e em CC; confirmar participação futura.
- [ ] Repetir o mesmo webhook e confirmar uma mensagem e um relay por destinatário.
- [ ] Testar HMAC inválido, remetente desconhecido e autoresposta: todos sem relay.
- [ ] Confirmar threading em Gmail, Outlook e Apple Mail.
- [ ] Confirmar que somente a resposta do principal encerra o SLA de primeira resposta.
- [ ] Indicar conclusão, testar ambos os magic links, expiração e reuso.
- [ ] Enviar anexo seguro e um arquivo acima de 20 MB; o texto deve ser processado nos dois casos.
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

## 6. Riscos residuais conhecidos

- RLS garante **quem** pode alterar a linha de um ticket, mas não impede um
  usuário autorizado de fazer um `PATCH` direto via API REST do Supabase
  mudando `status` para um valor fora do grafo de transições válido
  (`canTransition`) — a validação da máquina de estados vive só na camada de
  aplicação (`tickets.functions.ts`, `public-actions.functions.ts`), não em
  um trigger SQL. Mitigação possível futura: trigger `BEFORE UPDATE` em
  `internal_tickets` espelhando `TRANSITIONS` de `status.ts`.
- Anexos inbound ficam privados e têm hash/metadata, mas `scan_status` começa
  como `not_scanned`; antivírus/quarentena de conteúdo é uma integração futura.
- Relays com falha são retomados por retry do webhook e por lease/idempotência.
  Antes de alto volume, adicionar um job operacional para varrer relays `failed`
  após o fim da janela de retries do Resend.
