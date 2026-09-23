/**
 * Cálculo de prazo de SLA. Simplificação assumida para o MVP: prazos correm
 * em tempo corrido (24/7), não em horário comercial — reavaliar se o negócio
 * pedir prazos em dias úteis.
 */

export type SlaMinutes = {
  firstResponseMinutes: number | null;
  resolutionMinutes: number | null;
};

export type SlaDueDates = {
  firstResponseDueAt: Date | null;
  resolutionDueAt: Date | null;
};

export function computeSlaDueDates(createdAt: Date, sla: SlaMinutes): SlaDueDates {
  const addMinutes = (minutes: number | null) =>
    minutes == null ? null : new Date(createdAt.getTime() + minutes * 60_000);
  return {
    firstResponseDueAt: addMinutes(sla.firstResponseMinutes),
    resolutionDueAt: addMinutes(sla.resolutionMinutes),
  };
}

/** Categoria sobrepõe setor quando define um valor; senão herda o padrão do setor. */
export function resolveEffectiveSlaMinutes(
  sectorDefaultMinutes: number | null,
  categoryOverrideMinutes: number | null,
): number | null {
  return categoryOverrideMinutes ?? sectorDefaultMinutes;
}

/**
 * Um marco está atrasado se: ainda não foi atingido e o prazo já passou, OU
 * foi atingido depois do prazo (atraso "histórico", para relatórios).
 */
export function isOverdue(
  dueAt: Date | null,
  reachedAt: Date | null,
  now: Date = new Date(),
): boolean {
  if (!dueAt) return false;
  const comparisonPoint = reachedAt ?? now;
  return comparisonPoint.getTime() > dueAt.getTime();
}
