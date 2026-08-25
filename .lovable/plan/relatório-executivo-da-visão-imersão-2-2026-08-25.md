# Relatório Executivo da Visão Imersão 2

Nova camada de decisão, complementar e isolada. Nada da Visão Imersão 2 atual é alterado, exceto o acréscimo de um botão no topo.

## Fluxo

```text
Visão Imersão 2 (reportId)
   ↓ botão RELATÓRIO EXECUTIVO (nova aba)
/visao-imersao-2/$reportId/executivo
   ↓ importar arquivo executivo (.txt/.md)
EM REVISÃO → validar / editar / rejeitar ações
   ↓ FECHAR RELATÓRIO
VERSÃO FINAL (imutável) → PDF + E-mail HTML
```

O vínculo comercial (cliente, client_id, representante, consultor, BI) é herdado do relatório pai. Nenhum fuzzy matching novo.

## Estados da página

- **Sem relatório**: título, nome do cliente, texto de instrução e botão CARREGAR ARQUIVO.
- **Em revisão**: capítulos completos com controles de validação.
- **Finalizado**: versão limpa, sem controles; botões Exportar PDF, Enviar por e-mail, Nova versão, Voltar.

Badge de estado também aparece no botão dentro da Visão Imersão 2 (Em revisão / Finalizado).

## Capítulos

1. Briefing executivo (cliente, data, local, rep, consultor, categoria, atingimento e marcas — BI reaproveitado, sem recálculo)
2. Leitura executiva (`executive_reading`, curto)
3. Do diagnóstico à ação (um card por `decision_block`: Causa → O que isso gera → Evidência essencial única → ações referenciadas)
4. Decisões de não prioridade (`do_not_prioritize`)
5. Plano de ação (mesma entidade `actions[]`, com filtros por área e status)
6. Validação e fechamento (contadores + botão Fechar relatório)

## Ações

Entidade única (`actions[]`), nunca duplicada: os blocos de decisão apenas referenciam ids.

- Áreas: Comercial, Produto, Marketing, Governança.
- Prioridades: Alta, Média, Baixa.
- Status: Sugerida, Validada, Editada, Rejeitada.
- Validar grava `validated_at`/`validated_by`; Editar abre modal (título, descrição, área, prioridade, prazo, observação) e grava histórico; Rejeitar pede motivo opcional e mantém a ação apenas para auditoria.
- Fechamento bloqueado enquanto existir ação Sugerida. Só Validadas e Editadas entram na versão final, PDF e e-mail.
- Nesta versão nada vira tarefa do Kanban automaticamente.

## Importador exclusivo

Reconhece somente o bloco ` ```relatorio_executivo_imersao ` com `schema: executive_field_visit_report_v1`. Sem qualquer fallback para os importadores existentes; schema não reconhecido gera diagnóstico explícito. Todo texto é tratado como dado (sem HTML executável).

Primeiro teste com `Relatorio_Executivo_LLUMINAH_BASE_LOVABLE_v1.txt`: 5 decisões, 9 ações, 1 não prioridade, tudo em Sugerida.

## PDF e e-mail

- PDF A4 gerado do próprio relatório executivo final, com jsPDF (já usado em `visao-rep2-pdf.ts`), seguindo os tokens visuais do sistema. Nenhuma biblioteca nova.
- E-mail com o relatório no corpo em HTML table-safe, uma coluna, 640px, estilos inline, responsivo. Modal com destinatários (digitados + autocomplete de usuários cadastrados por nome/e-mail), assunto pré-preenchido, mensagem opcional, pré-visualização desktop/mobile e CTA discreto para abrir no sistema.
- Envio pela infraestrutura de e-mail já existente do projeto (rota transacional interna + registro de template), sem novo provedor.
- Cada envio é registrado e visível em Histórico de envios.

### Ponto que precisa da sua decisão

A infraestrutura de e-mail atual do projeto **não suporta anexos**. Em vez do PDF anexado, o e-mail traria um link seguro de download do PDF, mantendo o relatório completo no corpo da mensagem. Se anexo for indispensável, isso exige um provedor de e-mail próprio.

## Detalhes técnicos

- Nova rota `src/routes/_authenticated/visao-imersao-2.$reportId.executivo.tsx`, aberta em nova aba a partir do botão no cabeçalho de `visao-imersao-2.tsx` (única alteração naquele arquivo).
- Novas tabelas: `executive_reports` (1:1 com `field_immersion_v2_reports`), `executive_report_versions` (snapshot imutável ao fechar), `executive_report_actions` (entidade única de ação + histórico), `executive_report_email_logs` — todas com GRANTs e RLS espelhando o acesso já concedido aos relatórios de imersão.
- Modelo único `ExecutiveReportData` em `src/lib/executive-report/`, com três renderers (web, PDF, e-mail) consumindo a mesma estrutura, evitando divergência entre canais.
- Parser dedicado em `src/lib/executive-report/parse.ts`, isolado dos parsers atuais.
