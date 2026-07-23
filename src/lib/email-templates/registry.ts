import type { ComponentType } from "react";
import { template as mfaDeadlineWarning } from "./mfa-deadline-warning";
import { template as mfaFactorRemoved } from "./mfa-factor-removed";
import { template as lgpdPurgeExecuted } from "./lgpd-purge-executed";

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
};
