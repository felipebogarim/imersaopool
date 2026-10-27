export interface DedupableRep {
  id: string;
  nome: string;
  representacao?: string | null;
}

/** Remove acentos, pontuação, sufixos societários e espaços: "D.K. REPRESENTAÇÕES S/C LTDA - ME" → "DKREPRESENTACOES". */
export function normalizeRepKey(value?: string | null): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\b(LTDA|EPP|ME|S\/?C|EIRELI|SA)\b/g, " ")
    .replace(/[^A-Z0-9]/g, "");
}

/**
 * Garante uma única estrutura por representante.
 *
 * Cadastros "soltos" (sem `representacao`, ex.: "NOVARE") são tratados como
 * duplicidade do cadastro completo cujo nome de representação começa com o
 * mesmo texto (ex.: "MATHEUS (NOVARE REPRESENTAÇÕES)"). Cadastros com a mesma
 * representação também são unificados. Prefere-se o cadastro que já tem
 * estrutura salva e, depois, o que tem `representacao` preenchida.
 */
export function dedupeRepresentatives<T extends DedupableRep>(
  reps: T[],
  idsWithStructure: ReadonlySet<string> = new Set(),
): T[] {
  const score = (r: T) => (idsWithStructure.has(r.id) ? 2 : 0) + (r.representacao?.trim() ? 1 : 0);
  const better = (a: T, b: T) => score(a) > score(b);

  const withCompany = reps.filter((r) => normalizeRepKey(r.representacao));
  const kept = new Map<string, T>();
  for (const r of withCompany) {
    const key = normalizeRepKey(r.representacao);
    const cur = kept.get(key);
    if (!cur || better(r, cur)) kept.set(key, r);
  }

  const result: T[] = [...kept.values()];
  const companyKeys = [...kept.keys()];
  const bare = reps.filter((r) => !normalizeRepKey(r.representacao));
  for (const r of bare) {
    const key = normalizeRepKey(r.nome);
    if (key.length >= 2 && companyKeys.some((c) => c.startsWith(key))) {
      // Duplicata solta: só substitui o cadastro completo se este não tiver estrutura e ela sim.
      const idx = result.findIndex((x) => normalizeRepKey(x.representacao).startsWith(key));
      if (idx >= 0 && idsWithStructure.has(r.id) && !idsWithStructure.has(result[idx].id)) {
        result[idx] = r;
      }
      continue;
    }
    const sameName = result.find((x) => normalizeRepKey(x.nome) === key);
    if (!sameName) result.push(r);
  }

  const order = new Map(reps.map((r, i) => [r.id, i]));
  return result.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
