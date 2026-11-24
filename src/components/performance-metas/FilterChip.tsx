import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Badge
      variant={active ? "default" : "outline"}
      className={cn(
        "cursor-pointer px-3 py-1 text-[10px] uppercase font-bold tracking-tight transition-all",
        active
          ? "bg-primary text-primary-foreground shadow-sm"
          : "hover:bg-muted text-muted-foreground",
      )}
      onClick={onClick}
    >
      {children}
      {active && <X className="ml-1.5 h-3 w-3 inline-block" />}
    </Badge>
  );
}
