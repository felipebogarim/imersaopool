// Campo de código (base ou concorrente) com busca opcional no catálogo já
// cadastrado em Comparativos (`price_products`). Sempre funciona como texto
// livre — a busca só preenche marca/preço/características quando encontra
// um produto já cadastrado; não há bloqueio quando o código é novo.
import { useEffect, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { searchProducts } from "@/lib/price-comparison-groups";
import type { LoadedProduct } from "@/lib/price-comparativos-data";
import { formatBRL } from "@/lib/price-comparativos-core";

export function CodeAutocompleteInput({
  value,
  onChange,
  onSelectProduct,
  familia,
  categoria,
  marca,
  placeholder,
}: {
  value: string;
  onChange: (code: string) => void;
  onSelectProduct: (product: LoadedProduct) => void;
  familia: string;
  categoria: string | null;
  marca?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<LoadedProduct[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || value.trim().length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    setLoading(true);
    const t = setTimeout(() => {
      searchProducts({ familia, categoria: categoria ?? undefined, marca, busca: value })
        .then((r) => active && setResults(r))
        .catch(() => active && setResults([]))
        .finally(() => active && setLoading(false));
    }, 250);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [value, open, familia, categoria, marca]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Input
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="font-mono text-sm"
        />
      </PopoverTrigger>
      {value.trim().length >= 2 && (
        <PopoverContent
          className="w-80 p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <Command shouldFilter={false}>
            <CommandList>
              {loading && <div className="px-3 py-2 text-xs text-muted-foreground">Buscando…</div>}
              {!loading && (
                <CommandEmpty className="px-3 py-2 text-xs text-muted-foreground">
                  Nenhum produto cadastrado com esse código — pode digitar livremente.
                </CommandEmpty>
              )}
              <CommandGroup heading="Catálogo">
                {results.map((r) => (
                  <CommandItem
                    key={r.id}
                    value={r.id}
                    onSelect={() => {
                      onSelectProduct(r);
                      onChange(r.sku ?? r.referencia ?? r.nome);
                      setOpen(false);
                    }}
                    className="flex flex-col items-start gap-0.5"
                  >
                    <span className="text-sm font-medium">
                      {r.marca} — {r.sku ?? r.referencia ?? r.nome}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {r.nome} · {formatBRL(r.priceRow?.price ?? null)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      )}
    </Popover>
  );
}
