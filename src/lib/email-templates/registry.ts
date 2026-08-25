import type { ComponentType } from "react";
import { template as mfaDeadlineWarning } from "./mfa-deadline-warning";
import { template as mfaFactorRemoved } from "./mfa-factor-removed";
import { template as lgpdPurgeExecuted } from "./lgpd-purge-executed";
import { template as primeiroAcesso } from "./primeiro-acesso";
import { template as relatorioExecutivo } from "./relatorio-executivo";

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
};
