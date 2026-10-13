// Governança e ordenação de períodos de apuração de Performance.
// REGRA SISTÊMICA: Para todos os cálculos e seleções padrão, o sistema deve
// SEMPRE considerar o relatório com o período de apuração mais recente
// (ex: Janeiro a Agosto 2026 é mais recente que Janeiro a Julho 2026 e 1º Semestre 2026).
// Em caso de empate no período de apuração, o upload mais recente (created_at) desempata.

const MESES_MAP: Record<string, number> = {
  janeiro: 1,
  jan: 1,
  fevereiro: 2,
  fev: 2,
  marco: 3,
  março: 3,
  mar: 3,
  abril: 4,
  abr: 4,
  maio: 5,
  mai: 5,
  junho: 6,
  jun: 6,
  julho: 7,
  jul: 7,
  agosto: 8,
  ago: 8,
  setembro: 9,
  set: 9,
  outubro: 10,
  out: 10,
  novembro: 11,
  nov: 11,
  dezembro: 12,
  dez: 12,
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function lastDayOfMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate();
}

/**
 * Deriva a data de término de um período (formato ISO YYYY-MM-DD).
 * Se `periodo_fim` estiver presente e for válido, ele é usado diretamente.
 * Caso contrário, extrai a data a partir de `periodo_label` (ex: "Janeiro a Agosto 2026").
 */
export function parsePeriodEndDate(
  periodoFim?: string | null,
  periodoLabel?: string | null,
  createdAt?: string | null,
): string {
  if (periodoFim && /^\d{4}-\d{2}-\d{2}/.test(periodoFim)) {
    return periodoFim.slice(0, 10);
  }

  if (periodoLabel) {
    const raw = periodoLabel.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const yearMatch = raw.match(/(20\d{2})/);
    const year = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();

    // 1º Semestre = final de Junho (30/06)
    if (raw.includes("1") && (raw.includes("semestre") || raw.includes("sem"))) {
      return `${year}-06-30`;
    }
    // 2º Semestre = final de Dezembro (31/12)
    if (raw.includes("2") && (raw.includes("semestre") || raw.includes("sem"))) {
      return `${year}-12-31`;
    }
    // Anual = final de Dezembro (31/12)
    if (raw.includes("anual")) {
      return `${year}-12-31`;
    }

    // Busca meses mencionados no texto para determinar o último mês
    let maxMonth = 0;
    for (const [nome, mNum] of Object.entries(MESES_MAP)) {
      if (raw.includes(nome)) {
        if (mNum > maxMonth) {
          maxMonth = mNum;
        }
      }
    }

    if (maxMonth > 0) {
      const day = lastDayOfMonth(year, maxMonth);
      return `${year}-${pad(maxMonth)}-${pad(day)}`;
    }
  }

  if (createdAt && /^\d{4}-\d{2}-\d{2}/.test(createdAt)) {
    return createdAt.slice(0, 10);
  }

  return "1970-01-01";
}

export interface PerformanceVersionLike {
  id?: string;
  periodo_fim?: string | null;
  periodo_inicio?: string | null;
  periodo_label?: string | null;
  created_at?: string | null;
  representative_id?: string | null;
  substituida_em?: string | null;
}

/**
 * Comparador decrescente de versões de performance:
 * 1. Período de apuração mais recente primeiro (maior data de término).
 * 2. Em caso de empate de término de período, o upload criado mais recentemente (created_at) vence.
 */
export function comparePerformanceVersions<T extends PerformanceVersionLike>(a: T, b: T): number {
  const endA = parsePeriodEndDate(a.periodo_fim, a.periodo_label, a.created_at);
  const endB = parsePeriodEndDate(b.periodo_fim, b.periodo_label, b.created_at);

  if (endA !== endB) {
    return endB.localeCompare(endA); // Maior data primeiro
  }

  const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
  const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
  return createdB - createdA; // Maior timestamp primeiro
}

/**
 * Ordena uma lista de versões de performance colocando as mais recentes no topo.
 */
export function sortPerformanceVersions<T extends PerformanceVersionLike>(versions: T[]): T[] {
  return [...versions].sort(comparePerformanceVersions);
}

/**
 * Retorna a versão de performance mais recente de uma lista.
 */
export function getLatestPerformanceVersion<T extends PerformanceVersionLike>(versions: T[]): T | null {
  if (!versions || versions.length === 0) return null;
  const sorted = sortPerformanceVersions(versions);
  return sorted[0] ?? null;
}

/**
 * Agrupa versões ativas por representante e retorna um Map com a versão mais recente de cada um.
 */
export function getLatestActiveVersionByRep<T extends PerformanceVersionLike>(
  versions: T[],
): Map<string, T> {
  const byRep = new Map<string, T>();
  const sorted = sortPerformanceVersions(versions);
  for (const v of sorted) {
    const repId = v.representative_id;
    if (repId && !byRep.has(repId)) {
      byRep.set(repId, v);
    }
  }
  return byRep;
}
