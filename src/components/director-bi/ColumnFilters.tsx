import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { normalize } from "@/lib/director-bi";

export function toggleInSet<T>(set: Set<T>, value: T) {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

export function ColumnFilter({
  active,
  children,
}: {
  active: boolean;
  children: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <span className="relative inline-flex">
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Filtrar coluna"
            className={cn(
              "inline-flex h-4 w-4 items-center justify-center rounded hover:bg-muted",
              active ? "text-primary" : "text-muted-foreground/60",
            )}
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </PopoverTrigger>
        {active && (
          <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary" />
        )}
      </span>
      <PopoverContent align="start" className="w-64 p-3">
        {children(() => setOpen(false))}
      </PopoverContent>
    </Popover>
  );
}

export function SortButtons({
  dir,
  labels,
  onChange,
}: {
  dir?: "asc" | "desc";
  labels: [string, string];
  onChange: (dir: "asc" | "desc" | null) => void;
}) {
  return (
    <div className="flex gap-1">
      <Button
        size="sm"
        variant={dir === "asc" ? "secondary" : "ghost"}
        className="h-7 flex-1 text-xs"
        onClick={() => onChange(dir === "asc" ? null : "asc")}
      >
        {labels[0]}
      </Button>
      <Button
        size="sm"
        variant={dir === "desc" ? "secondary" : "ghost"}
        className="h-7 flex-1 text-xs"
        onClick={() => onChange(dir === "desc" ? null : "desc")}
      >
        {labels[1]}
      </Button>
    </div>
  );
}

export function TextFilterContent({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="space-y-2">
      <Input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-8 text-xs"
      />
      {value && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-full text-xs text-muted-foreground"
          onClick={() => onChange("")}
        >
          Limpar filtro
        </Button>
      )}
    </div>
  );
}

export function MultiSelectContent<T extends string>({
  options,
  selected,
  onChange,
  searchPlaceholder,
}: {
  options: { value: T; label: string }[];
  selected: Set<T>;
  onChange: (next: Set<T>) => void;
  searchPlaceholder: string;
}) {
  const [query, setQuery] = useState("");
  const q = normalize(query.trim());
  const filteredOptions = q ? options.filter((o) => normalize(o.label).includes(q)) : options;
  return (
    <div className="space-y-2">
      <Input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={searchPlaceholder}
        className="h-8 text-xs"
      />
      <div className="max-h-48 space-y-0.5 overflow-y-auto pr-1">
        <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-muted">
          <Checkbox checked={selected.size === 0} onCheckedChange={() => onChange(new Set())} />
          Todos
        </label>
        {filteredOptions.map((opt) => (
          <label
            key={opt.value}
            className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-muted"
          >
            <Checkbox
              checked={selected.has(opt.value)}
              onCheckedChange={() => onChange(toggleInSet(selected, opt.value))}
            />
            <span className="truncate">{opt.label}</span>
          </label>
        ))}
        {filteredOptions.length === 0 && (
          <p className="px-1 py-2 text-xs text-muted-foreground">Nenhum resultado.</p>
        )}
      </div>
      {selected.size > 0 && (
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-full text-xs text-muted-foreground"
          onClick={() => onChange(new Set())}
        >
          Limpar filtro
        </Button>
      )}
    </div>
  );
}
