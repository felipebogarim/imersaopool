// Seleção de produto por código digitado: identifica o único resultado cujo código
// (sku/referência) é exatamente o texto buscado. A seleção sempre usa `product.id`;
// o código é só critério de casamento, nunca identificador.

type CodeLike = { id: string; sku: string | null; referencia: string | null };

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function findExactCodeMatch<T extends CodeLike>(results: T[], query: string): T | null {
  const code = norm(query);
  if (!code) return null;
  const hits = results.filter((p) => norm(p.sku) === code || norm(p.referencia) === code);
  return hits.length === 1 ? hits[0] : null;
}
