import { CheckCircle2, Clock, MapPin } from "lucide-react";
import type { ImmersionItem } from "@/lib/director-immersion-types";

interface BrazilMapSummaryProps {
  immersions: ImmersionItem[];
}

export function BrazilMapSummary({ immersions }: BrazilMapSummaryProps) {
  const realizedCount = immersions.filter((immersion) => immersion.status === "realizada").length;
  const plannedCount = immersions.filter((immersion) => immersion.status === "planejada").length;
  const clientCount = immersions.reduce((total, immersion) => total + immersion.clients.length, 0);
  const representativeCount = immersions.reduce(
    (total, immersion) => total + immersion.representatives.length,
    0,
  );

  return (
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
      <div className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Imersões Realizadas</p>
          <p className="text-sm font-semibold">{realizedCount} jornadas</p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
          <Clock className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Imersões Planejadas</p>
          <p className="text-sm font-semibold">{plannedCount} mapeadas</p>
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
          <MapPin className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Clientes & Reps Mapeados</p>
          <p className="text-sm font-semibold">
            {clientCount} clientes / {representativeCount} reps
          </p>
        </div>
      </div>
    </div>
  );
}
