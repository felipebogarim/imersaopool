import { isOverdue } from "./sla";
import { isTerminalStatus, type TicketStatus } from "./status";
import type { TicketPriority } from "./priority";
import type { TicketListRow } from "./queries";

/**
 * Métricas puras do dashboard (Fase 6) — recebem o array de tickets já
 * carregado (queries.ts) e calculam tudo em memória. Sem chamada a banco
 * aqui: mantém a lógica testável sem mockar Supabase, mesmo padrão do
 * resto do módulo (status.ts, sla.ts).
 */

export type DashboardTicket = {
  id: string;
  status: TicketStatus;
  priority: TicketPriority;
  sectorId: string;
  categoryId: string;
  requesterUserId: string;
  commercialOwnerUserId: string;
  createdAt: Date;
  slaFirstResponseDueAt: Date | null;
  slaResolutionDueAt: Date | null;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
};

export function toDashboardTicket(row: TicketListRow): DashboardTicket {
  return {
    id: row.id,
    status: row.status,
    priority: row.priority,
    sectorId: row.sector_id,
    categoryId: row.category_id,
    requesterUserId: row.requester_user_id,
    commercialOwnerUserId: row.commercial_owner_user_id,
    createdAt: new Date(row.created_at),
    slaFirstResponseDueAt: row.sla_first_response_due_at
      ? new Date(row.sla_first_response_due_at)
      : null,
    slaResolutionDueAt: row.sla_resolution_due_at ? new Date(row.sla_resolution_due_at) : null,
    firstResponseAt: row.first_response_at ? new Date(row.first_response_at) : null,
    resolvedAt: row.resolved_at ? new Date(row.resolved_at) : null,
  };
}

export function isTicketOverdue(ticket: DashboardTicket, now: Date = new Date()): boolean {
  if (ticket.status === "cancelado") return false;
  if (!ticket.firstResponseAt && isOverdue(ticket.slaFirstResponseDueAt, null, now)) return true;
  if (!ticket.resolvedAt && isOverdue(ticket.slaResolutionDueAt, null, now)) return true;
  return false;
}

export function isTicketDueSoon(
  ticket: DashboardTicket,
  now: Date = new Date(),
  windowMs: number = 24 * 60 * 60 * 1000,
): boolean {
  if (isTerminalStatus(ticket.status)) return false;
  if (isTicketOverdue(ticket, now)) return false;
  const pendingDueDates = [
    ticket.firstResponseAt ? null : ticket.slaFirstResponseDueAt,
    ticket.resolvedAt ? null : ticket.slaResolutionDueAt,
  ].filter((d): d is Date => d !== null);
  return pendingDueDates.some((d) => {
    const delta = d.getTime() - now.getTime();
    return delta > 0 && delta <= windowMs;
  });
}

export function hasNoFirstResponse(ticket: DashboardTicket): boolean {
  if (ticket.firstResponseAt) return false;
  return !["rascunho", "aberto", "cancelado"].includes(ticket.status);
}

export type DashboardKpis = {
  open: number;
  completed: number;
  overdue: number;
  noFirstResponse: number;
  dueSoon: number;
};

export function computeKpis(tickets: DashboardTicket[], now: Date = new Date()): DashboardKpis {
  let open = 0;
  let completed = 0;
  let overdue = 0;
  let noFirstResponse = 0;
  let dueSoon = 0;
  for (const t of tickets) {
    if (t.status === "concluido") completed++;
    else if (t.status !== "cancelado") open++;
    if (isTicketOverdue(t, now)) overdue++;
    if (hasNoFirstResponse(t)) noFirstResponse++;
    if (isTicketDueSoon(t, now)) dueSoon++;
  }
  return { open, completed, overdue, noFirstResponse, dueSoon };
}

function averageMinutes(values: number[]): number | null {
  if (!values.length) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function computeAvgFirstResponseMinutes(tickets: DashboardTicket[]): number | null {
  const diffs = tickets
    .filter((t) => t.firstResponseAt)
    .map((t) => (t.firstResponseAt!.getTime() - t.createdAt.getTime()) / 60_000);
  return averageMinutes(diffs);
}

export function computeAvgResolutionMinutes(tickets: DashboardTicket[]): number | null {
  const diffs = tickets
    .filter((t) => t.resolvedAt)
    .map((t) => (t.resolvedAt!.getTime() - t.createdAt.getTime()) / 60_000);
  return averageMinutes(diffs);
}

export type VolumeBucket = { key: string; count: number };

export function computeVolume<T extends DashboardTicket>(
  tickets: T[],
  keyFn: (t: T) => string,
): VolumeBucket[] {
  const counts = new Map<string, number>();
  for (const t of tickets) {
    const key = keyFn(t);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
}

export type SectorDelay = {
  sectorId: string;
  avgResolutionMinutes: number | null;
  ticketCount: number;
};

export function computeSlowestSectors(tickets: DashboardTicket[], topN = 5): SectorDelay[] {
  const bySector = new Map<string, DashboardTicket[]>();
  for (const t of tickets) {
    if (!bySector.has(t.sectorId)) bySector.set(t.sectorId, []);
    bySector.get(t.sectorId)!.push(t);
  }
  const rows: SectorDelay[] = Array.from(bySector.entries()).map(([sectorId, sectorTickets]) => ({
    sectorId,
    avgResolutionMinutes: computeAvgResolutionMinutes(sectorTickets),
    ticketCount: sectorTickets.length,
  }));
  return rows
    .sort((a, b) => (b.avgResolutionMinutes ?? -1) - (a.avgResolutionMinutes ?? -1))
    .slice(0, topN);
}

export type PeriodBucket = { periodStart: Date; count: number };

function startOfWeek(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay();
  const diff = (day + 6) % 7; // semana começa na segunda
  d.setUTCDate(d.getUTCDate() - diff);
  return d;
}

/** Últimas `weeks` semanas (incluindo a atual), sempre com bucket mesmo sem tickets — evolução sem buracos. */
export function computeCreatedPerWeek(
  tickets: DashboardTicket[],
  weeks = 8,
  now: Date = new Date(),
): PeriodBucket[] {
  const currentWeekStart = startOfWeek(now);
  const buckets: PeriodBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const periodStart = new Date(currentWeekStart);
    periodStart.setUTCDate(periodStart.getUTCDate() - i * 7);
    buckets.push({ periodStart, count: 0 });
  }
  for (const t of tickets) {
    const weekStart = startOfWeek(t.createdAt).getTime();
    const bucket = buckets.find((b) => b.periodStart.getTime() === weekStart);
    if (bucket) bucket.count++;
  }
  return buckets;
}

export function computeCriticalTickets(
  tickets: DashboardTicket[],
  now: Date = new Date(),
): DashboardTicket[] {
  const critical = tickets.filter((t) => t.priority === "urgente" || isTicketOverdue(t, now));
  const dueOf = (t: DashboardTicket) =>
    (t.firstResponseAt ? null : t.slaFirstResponseDueAt) ??
    (t.resolvedAt ? null : t.slaResolutionDueAt);
  return critical.sort((a, b) => {
    const da = dueOf(a);
    const db = dueOf(b);
    if (da && db) return da.getTime() - db.getTime();
    if (da) return -1;
    if (db) return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
}
