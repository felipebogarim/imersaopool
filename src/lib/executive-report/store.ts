// Persistência do Relatório Executivo (cliente, sob RLS por empresa).
import { supabase } from "@/integrations/supabase/client";
import {
  AREAS,
  PRIORITIES,
  STATUSES,
  type ExecArea,
  type ExecPriority,
  type ExecStatus,
  type ExecutiveAction,
  type ExecutiveReportData,
  toFinalData,
} from "./types";

export type ExecutiveVersion = {
  id: string;
  version: number;
  closed_at: string;
  closed_by_name: string | null;
  snapshot: ExecutiveReportData;
};

export type ExecutiveEmailLog = {
  id: string;
  sent_at: string;
  sent_by_name: string | null;
  recipients: string[];
  subject: string | null;
  attach_pdf: boolean;
  status: string;
  error: string | null;
};

function pick<T extends string>(v: unknown, allowed: readonly T[], fb: T): T {
  return (allowed as readonly string[]).includes(String(v)) ? (v as T) : fb;
}

function rowToAction(r: any): ExecutiveAction {
  return {
    id: r.external_id,
    row_id: r.id,
    source_decision_id: r.source_decision_id,
    area: pick<ExecArea>(r.area, AREAS, "commercial"),
    priority: pick<ExecPriority>(r.priority, PRIORITIES, "medium"),
    title: r.title,
    description: r.description,
    status: pick<ExecStatus>(r.status, STATUSES, "suggested"),
    owner: r.owner,
    due_date: r.due_date,
    note: r.note,
    reject_reason: r.reject_reason,
    history: Array.isArray(r.history) ? r.history : [],
    ordem: r.ordem ?? 0,
    validated_at: r.validated_at,
    validated_by: r.validated_by,
  };
}

export async function loadExecutiveReport(immersionReportId: string): Promise<{
  data: ExecutiveReportData;
  versions: ExecutiveVersion[];
} | null> {
  const { data: rep, error } = await supabase
    .from("executive_reports")
    .select("*")
    .eq("immersion_report_id", immersionReportId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!rep) return null;

  const [{ data: acts }, { data: vers }] = await Promise.all([
    supabase
      .from("executive_report_actions")
      .select("*")
      .eq("executive_report_id", rep.id)
      .order("ordem"),
    supabase
      .from("executive_report_versions")
      .select("id, version, closed_at, closed_by_name, snapshot")
      .eq("executive_report_id", rep.id)
      .order("version", { ascending: false }),
  ]);

  const data: ExecutiveReportData = {
    id: rep.id,
    immersion_report_id: rep.immersion_report_id,
    status: rep.status === "closed" ? "closed" : "review",
    report_title: rep.report_title ?? "Relatório Executivo",
    source_filename: rep.source_filename,
    source_schema: rep.source_schema,
    client: (rep.client as any) ?? { display_name: "" },
    executive_reading: rep.executive_reading ?? "",
    brands_observed: Array.isArray(rep.brands_observed) ? (rep.brands_observed as string[]) : [],
    decision_blocks: (rep.decision_blocks as any) ?? [],
    do_not_prioritize: (rep.do_not_prioritize as any) ?? [],
    actions: (acts ?? []).map(rowToAction),
    email: (rep.email as any) ?? {},
    current_version: rep.current_version ?? 0,
  };

  return { data, versions: (vers ?? []) as unknown as ExecutiveVersion[] };
}

export async function createExecutiveReport(args: {
  immersionReportId: string;
  companyId: string | null;
  userId: string | null;
  parsed: ExecutiveReportData;
  filename: string;
  clientDisplayName: string;
}): Promise<string> {
  const { parsed } = args;
  const { data: rep, error } = await supabase
    .from("executive_reports")
    .insert({
      immersion_report_id: args.immersionReportId,
      company_id: args.companyId,
      created_by: args.userId,
      status: "review",
      report_title: parsed.report_title,
      source_filename: args.filename,
      source_schema: parsed.source_schema,
      client: { ...parsed.client, display_name: args.clientDisplayName } as any,
      executive_reading: parsed.executive_reading,
      brands_observed: parsed.brands_observed as any,
      decision_blocks: parsed.decision_blocks as any,
      do_not_prioritize: parsed.do_not_prioritize as any,
      email: parsed.email as any,
      current_version: 0,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (parsed.actions.length) {
    const { error: aErr } = await supabase.from("executive_report_actions").insert(
      parsed.actions.map((a) => ({
        executive_report_id: rep.id,
        company_id: args.companyId,
        external_id: a.id,
        source_decision_id: a.source_decision_id,
        area: a.area,
        priority: a.priority,
        title: a.title,
        description: a.description,
        status: "suggested",
        owner: a.owner,
        due_date: a.due_date,
        note: a.note,
        ordem: a.ordem,
      })),
    );
    if (aErr) throw new Error(aErr.message);
  }
  return rep.id;
}

export async function updateAction(
  action: ExecutiveAction,
  patch: Partial<ExecutiveAction>,
  meta: { userId: string | null; label: string; note?: string },
) {
  if (!action.row_id) throw new Error("Ação sem identificador persistido.");
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const k of Object.keys(patch) as (keyof ExecutiveAction)[]) {
    if (k === "history" || k === "row_id") continue;
    if (patch[k] !== action[k]) changes[k] = { from: action[k], to: patch[k] };
  }
  const history = [
    ...action.history,
    { at: new Date().toISOString(), by: meta.userId, action: meta.label, changes, note: meta.note },
  ];
  const { error } = await supabase
    .from("executive_report_actions")
    .update({
      area: patch.area ?? action.area,
      priority: patch.priority ?? action.priority,
      title: patch.title ?? action.title,
      description: patch.description ?? action.description,
      status: patch.status ?? action.status,
      owner: patch.owner ?? action.owner,
      due_date: patch.due_date ?? action.due_date,
      note: patch.note ?? action.note,
      reject_reason: patch.reject_reason ?? action.reject_reason,
      validated_at: patch.validated_at ?? action.validated_at,
      validated_by: patch.validated_by ?? action.validated_by,
      history: history as any,
    })
    .eq("id", action.row_id);
  if (error) throw new Error(error.message);
}

export async function closeReport(args: {
  data: ExecutiveReportData;
  companyId: string | null;
  userId: string | null;
  userName: string | null;
}) {
  const { data } = args;
  if (!data.id) throw new Error("Relatório não persistido.");
  const version = (data.current_version ?? 0) + 1;
  const { error: vErr } = await supabase.from("executive_report_versions").insert({
    executive_report_id: data.id,
    company_id: args.companyId,
    version,
    snapshot: toFinalData({ ...data, status: "closed", current_version: version }) as any,
    closed_by: args.userId,
    closed_by_name: args.userName,
  });
  if (vErr) throw new Error(vErr.message);
  const { error } = await supabase
    .from("executive_reports")
    .update({ status: "closed", current_version: version })
    .eq("id", data.id);
  if (error) throw new Error(error.message);
  return version;
}

export async function reopenReport(reportId: string) {
  const { error } = await supabase
    .from("executive_reports")
    .update({ status: "review" })
    .eq("id", reportId);
  if (error) throw new Error(error.message);
}

export async function logEmail(args: {
  reportId: string;
  versionId?: string | null;
  companyId: string | null;
  userId: string | null;
  userName: string | null;
  recipients: string[];
  subject: string;
  attachPdf: boolean;
  status: string;
  error?: string | null;
}) {
  await supabase.from("executive_report_email_logs").insert({
    executive_report_id: args.reportId,
    executive_report_version_id: args.versionId ?? null,
    company_id: args.companyId,
    sent_by: args.userId,
    sent_by_name: args.userName,
    recipients: args.recipients as any,
    subject: args.subject,
    attach_pdf: args.attachPdf,
    status: args.status,
    error: args.error ?? null,
  });
}

export async function listEmailLogs(reportId: string): Promise<ExecutiveEmailLog[]> {
  const { data } = await supabase
    .from("executive_report_email_logs")
    .select("id, sent_at, sent_by_name, recipients, subject, attach_pdf, status, error")
    .eq("executive_report_id", reportId)
    .order("sent_at", { ascending: false });
  return (data ?? []) as unknown as ExecutiveEmailLog[];
}

export async function deleteExecutiveReport(reportId: string) {
  const { error } = await supabase.from("executive_reports").delete().eq("id", reportId);
  if (error) throw new Error(error.message);
}
