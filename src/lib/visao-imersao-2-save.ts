// Normalização e mensagens de erro do salvamento da Visão Imersão 2.
// O banco guarda `visit_date` como DATE (AAAA-MM-DD); arquivos podem trazer
// datas em formato brasileiro ou por extenso.

const MESES: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
};

function iso(y: number, m: number, d: number): string | null {
  if (!y || !m || !d) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** Converte a data da visita para AAAA-MM-DD; retorna null quando não reconhece. */
export function normalizeVisitDate(value: unknown): string | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(s);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) return iso(+m[3], +m[2], +m[1]);
  const norm = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  m = /^(\d{1,2})\s*(?:de\s+)?([a-z]+)\s*(?:de\s+)?(\d{4})$/.exec(norm);
  if (m && MESES[m[2]]) return iso(+m[3], MESES[m[2]], +m[1]);
  return null;
}

/** Extrai uma mensagem legível de Error ou de erros do banco (objetos com message). */
export function describeSaveError(error: unknown): string {
  const fallback = "Falha ao salvar a Visão Imersão 2.";
  if (!error) return fallback;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object") {
    const e = error as { code?: string; message?: string; details?: string };
    if (e.code === "42501") return "Sem permissão para salvar este relatório na empresa ativa.";
    if (e.code === "22007" || e.code === "22008") return "Data da visita inválida no arquivo.";
    if (e.code === "23502") return "Campo obrigatório ausente no arquivo (nome do cliente ou data).";
    if (e.message) return `${fallback} ${e.message}`;
  }
  return fallback;
}
