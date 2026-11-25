// Título de seção do painel de metas: separa a visão geral do cliente (meta total, categoria)
// do detalhe por portfólio.

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function MetasSecaoTitulo({
  numero,
  icon: Icon,
  titulo,
  descricao,
  tom = "primary",
  className,
}: {
  numero: number;
  icon: LucideIcon;
  titulo: string;
  descricao: string;
  tom?: "primary" | "violet";
  className?: string;
}) {
  const cor =
    tom === "violet"
      ? {
          barra: "bg-violet-500",
          chip: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
          linha: "from-violet-500/40",
        }
      : { barra: "bg-primary", chip: "bg-primary/15 text-primary", linha: "from-primary/40" };
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className={cn("h-9 w-1 shrink-0 rounded-full", cor.barra)} aria-hidden="true" />
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
          cor.chip,
        )}
        aria-hidden="true"
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <h2 className="text-sm font-bold uppercase tracking-wide text-foreground">
          <span className="text-muted-foreground">{numero}.</span> {titulo}
        </h2>
        <p className="text-[11px] leading-snug text-muted-foreground">{descricao}</p>
      </div>
      <span
        className={cn(
          "ml-2 hidden h-px flex-1 bg-gradient-to-r to-transparent sm:block",
          cor.linha,
        )}
        aria-hidden="true"
      />
    </div>
  );
}
