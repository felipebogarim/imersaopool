import { type ReactNode } from "react";
import { Inbox, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "surface rounded-xl p-8 flex flex-col items-center justify-center text-center gap-3",
        className,
      )}
    >
      <div className="grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold">{title}</p>
        {description && (
          <p className="text-xs text-muted-foreground max-w-sm">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function LoadingRows({ rows = 3, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)} role="status" aria-label="Carregando">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 rounded-lg bg-muted/60 animate-pulse" />
      ))}
      <span className="sr-only">Carregando...</span>
    </div>
  );
}

export function LoadingCards({ count = 6, className }: { count?: number; className?: string }) {
  return (
    <div
      className={cn("grid gap-4 md:grid-cols-3 lg:grid-cols-6", className)}
      role="status"
      aria-label="Carregando"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="surface rounded-xl p-5 h-[104px] animate-pulse" />
      ))}
      <span className="sr-only">Carregando...</span>
    </div>
  );
}
