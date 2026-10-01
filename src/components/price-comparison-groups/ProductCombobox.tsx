// Combobox pesquisável de produtos já cadastrados em `price_products` (busca por código/descrição).
// A busca usa o CommandInput do próprio popover — não há <input> dentro do gatilho, então
// digitar/pesquisar não é interceptado pelo toggle do Popover.
import { useEffect, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { searchProducts } from "@/lib/price-comparison-groups";
import { findExactCodeMatch } from "@/lib/product-code-match";
import type { LoadedProduct } from "@/lib/price-comparativos-data";
import { cn } from "@/lib/utils";

export function productCode(p: { sku: string | null; referencia: string | null; nome: string }) {
  return p.sku ?? p.referencia ?? p.nome;
}

export function ProductCombobox({
  value,
  onSelect,
  familia,
  categoria,
  marca,
  placeholder,
  disabled,
}: {
  value: LoadedProduct | null;
  onSelect: (product: LoadedProduct) => void;
  familia: string;
  categoria: string | null;
  marca: string;
  placeholder: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LoadedProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);

  // Ordem da seleção: 1) registra o produto (id) no estado do pai, 2) limpa a busca, 3) fecha.
  // `setOpen(false)` programático não dispara onOpenChange, por isso a busca é limpa aqui.
  function commit(product: LoadedProduct) {
    onSelect(product);
    setQuery("");
    setOpen(false);
  }

  useEffect(() => {
    if (!open || !marca) return;
    let active = true;
    setLoading(true);
    setSearchError(false);
    const t = setTimeout(() => {
      searchProducts({ familia, categoria: categoria ?? undefined, marca, busca: query })
        .then((r) => {
          if (!active) return;
          setResults(r);
          // Código digitado por completo: seleciona o produto (por id) sem precisar clicar.
          const exact = findExactCodeMatch(r, query);
          if (exact) commit(exact);
        })
        .catch((error) => {
          console.error("Falha ao buscar produtos para comparação", error);
          if (!active) return;
          setResults([]);
          setSearchError(true);
        })
        .finally(() => active && setLoading(false));
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, query, familia, categoria, marca]);

  return (
    <Popover
      modal
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || !marca}
          className="h-9 w-full justify-between font-normal"
        >
          <span className={cn("truncate font-mono text-sm", !value && "text-muted-foreground")}>
            {value ? `${productCode(value)} — ${value.nome}` : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0"
        align="start"
        // Radix Select (marca) deixa `pointer-events:none` no body enquanto fecha; o conteúdo em
        // portal herdava isso e o clique no item não chegava ao cmdk.
        style={{ pointerEvents: "auto" }}
      >
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Buscar por código ou descrição…"
          />
          <CommandList>
            {!loading && searchError && (
              <div className="px-3 py-2 text-xs text-destructive">
                Não foi possível consultar o catálogo. Tente novamente.
              </div>
            )}
            {!loading && !searchError && (
              <CommandEmpty className="px-3 py-2 text-xs text-muted-foreground">
                Nenhum produto cadastrado para {marca} neste filtro.
              </CommandEmpty>
            )}
            <CommandGroup>
              {results.map((r) => (
                <CommandItem
                  key={r.id}
                  value={r.id}
                  onSelect={() => commit(r)}
                  // Evita que o input perca o foco (blur) antes do clique concluir a seleção.
                  onMouseDown={(e) => e.preventDefault()}
                  className="flex items-start gap-2"
                >
                  <Check
                    className={cn(
                      "mt-0.5 h-4 w-4",
                      value?.id === r.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="flex min-w-0 flex-col">
                    <span className="text-sm font-medium">
                      <span className="font-mono">{productCode(r)}</span> — {r.nome}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {r.marca}
                      {r.descricao && r.descricao !== r.nome ? ` · ${r.descricao}` : ""}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
            {loading && <div className="px-3 py-2 text-xs text-muted-foreground">Buscando…</div>}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
