import { useEffect, useState } from "react";
import { Check, Loader2, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  resolvePricingProduct,
  searchPricingProductCatalog,
  type PricingCatalogCandidate,
  type PricingLookupResult,
} from "@/lib/pricing-lookup";

function candidateCode(candidate: PricingCatalogCandidate) {
  return candidate.sku ?? candidate.referencia ?? candidate.nome;
}

export function PricingCodeSelector({
  label,
  query,
  resolution,
  onQueryChange,
  onResolve,
  onClear,
}: {
  label: string;
  query: string;
  resolution: PricingLookupResult | null;
  onQueryChange: (query: string) => void;
  onResolve: (query: string, result: PricingLookupResult) => void;
  onClear: () => void;
}) {
  const [results, setResults] = useState<PricingCatalogCandidate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2 || resolution?.state.startsWith("FOUND_")) {
      setResults([]);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      searchPricingProductCatalog(query)
        .then((rows) => active && setResults(rows))
        .catch(() => active && setError("Não foi possível pesquisar o catálogo."))
        .finally(() => active && setLoading(false));
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, resolution?.state]);

  async function resolve(code = query, productId?: string) {
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await resolvePricingProduct(code, productId ? { productId } : {});
      onResolve(code, result);
      setResults([]);
    } catch {
      setError("Não foi possível resolver este código.");
    } finally {
      setLoading(false);
    }
  }

  const found = resolution?.state.startsWith("FOUND_");
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void resolve();
                }
              }}
              placeholder="Digite o código ou parte da descrição"
              className="pr-9 font-mono"
            />
            {loading && <Loader2 className="absolute right-3 top-2.5 h-4 w-4 animate-spin" />}
          </div>
          <Button type="button" onClick={() => void resolve()} disabled={loading || !query.trim()}>
            <Search className="mr-2 h-4 w-4" />
            Resolver
          </Button>
          {(resolution || query) && (
            <Button type="button" variant="outline" size="icon" onClick={onClear} title="Limpar">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {!found && results.length > 0 && (
          <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-md border bg-popover p-1 shadow-lg">
            {results.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => void resolve(candidateCode(candidate), candidate.id)}
                className="flex w-full items-start gap-2 rounded px-3 py-2 text-left hover:bg-accent"
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 opacity-40" />
                <span className="min-w-0">
                  <span className="block font-mono text-sm font-medium">
                    {candidateCode(candidate)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {candidate.marca} · {candidate.descricao ?? candidate.nome}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {resolution?.state === "AMBIGUOUS" && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
          <p className="text-sm font-medium">Código encontrado em mais de uma marca:</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {resolution.candidates.map((candidate) => (
              <Button
                key={candidate.id}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void resolve(candidateCode(candidate), candidate.id)}
              >
                {candidate.marca} · {candidateCode(candidate)}
              </Button>
            ))}
          </div>
        </div>
      )}
      {resolution?.state === "NOT_FOUND" && (
        <p className="text-sm text-amber-600">
          Produto não encontrado na base. Preencha os dados abaixo.
        </p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
