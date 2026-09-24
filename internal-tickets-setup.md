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

Antes da `170000`, o resultado desta consulta precisa ser vazio:

```sql
SELECT ticket_id, message_id, count(*)
FROM public.internal_ticket_messages
WHERE message_id IS NOT NULL
GROUP BY ticket_id, message_id
HAVING count(*) > 1;
```

Confirmar também as dependências:

```sql
SELECT
  to_regtype('public.internal_ticket_status') AS status_enum,
  to_regtype('public.internal_ticket_action') AS action_enum,
  to_regclass('public.internal_tickets') AS tickets,
  to_regclass('public.internal_ticket_messages') AS messages,
  to_regclass('public.internal_ticket_attachments') AS attachments,
  to_regclass('public.internal_ticket_action_tokens') AS action_tokens,
  to_regprocedure('public.touch_updated_at()') AS touch_updated_at,
  to_regprocedure('public.internal_ticket_can_access(uuid,uuid)') AS can_access;
```

Aplicar via `supabase db push` (CLI conectada ao projeto) ou colando o SQL no
editor do Supabase Dashboard, nesta ordem exata — a migration `160000` precisa
commitar antes das demais usarem os valores de enum novos.

### Rollout em duas fases (compatibilidade com o runtime antigo)

**Fase de compatibilidade:** runtime antigo (main) + banco novo (170000–190000)
convivem temporariamente. A `170000` **não** revoga `UPDATE` de `authenticated`
em `internal_tickets`, pois o runtime antigo ainda atualiza `status` e
`sector_id` diretamente. Os INSERTs técnicos de mensagens e anexos já ficam
protegidos por grants de coluna.

**Hardening final:** `REVOKE UPDATE ON public.internal_tickets FROM authenticated`
somente depois de 170000–190000 aplicadas, runtime novo publicado e
status/reatribuição validados em produção via
`internal_ticket_update_status_authenticated` e
`internal_ticket_reassign_authenticated`. Essa migration ainda **não existe**
(criar só então, para que um `db push` não a aplique cedo demais).

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

| Variável                          | Valor                                                                                                                                        |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `RESEND_API_KEY`                  | API key gerada no passo 3.3                                                                                                                  |
| `RESEND_WEBHOOK_SECRET`           | signing secret (`whsec_...`) do passo 3.4                                                                                                    |
| `INTERNAL_TICKETS_REPLY_DOMAIN`   | o subdomínio verificado no passo 3.2                                                                                                         |
| `INTERNAL_TICKETS_REPLY_SECRET`   | um segredo aleatório novo (ex. `openssl rand -hex 32`) — assina o token do endereço de resposta; nunca reaproveitar outro segredo do projeto |
| `INTERNAL_TICKETS_EMAIL_MODE`     | definir explicitamente `resend` em produção; `mock` usa o provider em memória em teste/staging                                               |
| `INTERNAL_TICKETS_SWEEPER_SECRET` | segredo aleatório exclusivo usado como Bearer pelo agendador do sweeper de relays; nunca reutilizar API key ou reply secret                  |

`SUPABASE_SERVICE_ROLE_KEY` não deve ser criada, copiada para o cliente ou
inventada na VPS. O endpoint importa o cliente privilegiado somente no servidor;
o deploy deve usar a credencial gerenciada pelo Lovable Cloud. Se o runtime
publicado não a receber, Receiving deve permanecer desativado até a integração
de infraestrutura ser corrigida.

O endpoint protegido `POST /api/public/internal-tickets/relay-sweeper` faz
uma leitura administrativa inofensiva e executa a recuperação de relays. Uma
resposta `200` com `ok: true` comprova, sem expor a chave, que o runtime
publicado recebeu uma service role funcional. Agendar chamadas com
`Authorization: Bearer <INTERNAL_TICKETS_SWEEPER_SECRET>`; nunca registrar o
header. Relays com resultado ambíguo há 23 horas ou mais não são reenviados:
ficam com `provider_reconciliation_required` para conferência manual.

## 4.1 Assets inline do e-mail de abertura

Antes do deploy real, colocar os PNGs oficiais em:

- `public/email-assets/logo-newline.png`
- `public/email-assets/icon-newline.png`

O envio falha explicitamente se algum arquivo estiver ausente. As imagens são
enviadas inline com CID; não há fallback para URL pública.

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
- [ ] Confirmar que anexo `not_scanned`, `pending`, `blocked` ou `failed` não gera URL de download; somente `clean` pode ser baixado após integração real de antivírus.
- [ ] Executar o sweeper autenticado no runtime publicado e confirmar `ok: true` sem qualquer conteúdo de secret na resposta ou nos logs.
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
- Anexos inbound ficam privados, têm hash e validação mínima de magic bytes,
  mas `scan_status` começa como `not_scanned`; enquanto não existir antivírus,
  nenhum deles fica disponível para download.
- O sweeper recupera `pending`, `failed` e `sending` com lease expirada dentro
  da janela segura do provider. Resultados ambíguos fora dela exigem
  reconciliação manual para evitar envio duplicado.
