import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/** Bloco padrão da Visão Rep: cabeçalho clicável com seta de expandir/contrair. */
export function BlocoExpansivel({
  titulo,
  descricao,
  acessorio,
  children,
  defaultOpen = true,
  className,
}: {
  titulo: string;
  descricao?: string;
  acessorio?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={cn("rounded-xl border bg-card", className)}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-5 text-left sm:p-6"
      >
        <span className="min-w-0">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            {titulo}
          </span>
          {descricao ? <span className="mt-1 block text-sm text-muted-foreground">{descricao}</span> : null}
        </span>
        <span className="flex shrink-0 items-center gap-3">
          {acessorio}
          <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")} aria-hidden />
        </span>
      </button>
      {open ? <div className="border-t p-5 sm:p-6">{children}</div> : null}
    </section>
  );
}
