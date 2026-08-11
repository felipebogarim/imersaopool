// Renderização de citações da Visão Imersão 2.
// Regra: 1 citação = 1 card. Autoria construída apenas com os campos da própria citação.

export type CitacaoV2 = {
  id?: string;
  text?: string;
  original_author?: string | null;
  original_author_role?: string | null;
  reported_by?: string | null;
  reported_by_role?: string | null;
  quote_type?: "direct" | "reported" | string | null;
};

const t = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/** "Daniela · Proprietária da LLUMINAH" — nunca atribui a fala ao representante. */
export function autoriaCitacao(q: CitacaoV2): { autor: string; relato: string | null } {
  const autor = t(q.original_author);
  const cargo = t(q.original_author_role);

  let linha: string;
  if (autor && cargo) linha = `${autor} · ${cargo}`;
  else if (autor) linha = autor;
  else if (cargo) linha = `${cargo} · nome não identificado`;
  else linha = "Autor não identificado";

  const relator = t(q.reported_by);
  const relatorCargo = t(q.reported_by_role);
  const relato = relator
    ? `Fala relatada por ${relator}${relatorCargo ? ` · ${relatorCargo}` : ""}`
    : q.quote_type === "reported"
      ? "Fala relatada"
      : null;

  return { autor: linha, relato };
}

/**
 * Separa um texto que traz duas ou mais citações concatenadas em itens independentes.
 * Preserva o texto literal de cada citação (com o eventual crédito que a segue).
 */
export function separarCitacoes(texto: string): string[] {
  if (!texto) return [];
  const re = /[“"][^“”"]+[”"][^“"]*/g;
  const matches = texto.match(re);
  if (!matches || matches.length < 2) return [texto.trim()].filter(Boolean);
  return matches.map(s => s.trim()).filter(Boolean);
}
