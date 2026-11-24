import type { ComponentType } from "react";
import { template as mfaDeadlineWarning } from "./mfa-deadline-warning";
import { template as mfaFactorRemoved } from "./mfa-factor-removed";
import { template as lgpdPurgeExecuted } from "./lgpd-purge-executed";
import { template as primeiroAcesso } from "./primeiro-acesso";
import { template as relatorioExecutivo } from "./relatorio-executivo";
import { template as relatorioGeral } from "./relatorio-geral";
import { template as kanbanAutomacao } from "./kanban-automacao";
import { template as kanbanAtribuicao } from "./kanban-atribuicao";
import { template as agendaConvite } from "./agenda-convite";
import { template as centralMensagens } from "./central-mensagens";
import { template as acaoSolicitacaoAtualizacao } from "./acao-solicitacao-atualizacao";
import { template as acaoAtualizacaoRecebida } from "./acao-atualizacao-recebida";
import { template as acaoSugestao } from "./acao-sugestao";
import { template as acaoVencimento } from "./acao-vencimento";
import { template as repPortalBoasVindas } from "./rep-portal-boas-vindas";
import { template as acaoProrrogacaoDecisao } from "./acao-prorrogacao-decisao";
import { template as metasConvite } from "./metas-convite";
import { template as metasConviteMassa } from "./metas-convite-massa";

export interface TemplateEntry {
  component: ComponentType<any>;
  subject: string | ((data: Record<string, any>) => string);
  displayName?: string;
  previewData?: Record<string, any>;
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string;
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  "mfa-deadline-warning": mfaDeadlineWarning,
  "mfa-factor-removed": mfaFactorRemoved,
  "lgpd-purge-executed": lgpdPurgeExecuted,
  "primeiro-acesso": primeiroAcesso,
  "relatorio-executivo": relatorioExecutivo,
  "relatorio-geral": relatorioGeral,
  "kanban-automacao": kanbanAutomacao,
  "kanban-atribuicao": kanbanAtribuicao,
  "agenda-convite": agendaConvite,
  "central-mensagens": centralMensagens,
  "acao-solicitacao-atualizacao": acaoSolicitacaoAtualizacao,
  "acao-atualizacao-recebida": acaoAtualizacaoRecebida,
  "acao-sugestao": acaoSugestao,
  "acao-vencimento": acaoVencimento,
  "rep-portal-boas-vindas": repPortalBoasVindas,
  "acao-prorrogacao-decisao": acaoProrrogacaoDecisao,
  "metas-convite": metasConvite,
  "metas-convite-massa": metasConviteMassa,
};
