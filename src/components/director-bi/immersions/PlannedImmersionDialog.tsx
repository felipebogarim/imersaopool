import { Calendar, MapPin, Users, Target, FileText, Building2, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ImmersionItem } from "@/lib/director-immersion-types";

interface PlannedImmersionDialogProps {
  immersion: ImmersionItem | null;
  onClose: () => void;
}

export function PlannedImmersionDialog({ immersion, onClose }: PlannedImmersionDialogProps) {
  if (!immersion) return null;

  return (
    <Dialog open={Boolean(immersion)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg p-5">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-amber-500 text-amber-600 dark:text-amber-400"
            >
              <Clock className="mr-1 h-3 w-3" /> Imersão Planejada
            </Badge>
            <span className="text-xs text-muted-foreground">{immersion.state}</span>
          </div>
          <DialogTitle className="mt-1 text-lg font-bold">{immersion.title}</DialogTitle>
          <DialogDescription className="text-xs">
            Planejamento territorial e metas prévias para a jornada futura.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-3.5 text-xs">
          {/* Período */}
          <div className="flex items-center gap-2 rounded-lg border bg-muted/20 p-2.5">
            <Calendar className="h-4 w-4 text-amber-500 shrink-0" />
            <div>
              <p className="font-semibold text-foreground">Período Previsto</p>
              <p className="text-muted-foreground">
                {immersion.startDate.split("-").reverse().join("/")} até{" "}
                {immersion.endDate.split("-").reverse().join("/")}
              </p>
            </div>
          </div>

          {/* Cidades e Região Prevista */}
          <div className="rounded-lg border bg-card p-3">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-foreground">
              <MapPin className="h-4 w-4 text-primary" />
              <span>Região & Cidades Previstas</span>
            </div>
            <p className="text-muted-foreground">{immersion.regionCovered}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {immersion.cities.map((city) => (
                <Badge key={city} variant="secondary" className="text-[10px]">
                  {city}
                </Badge>
              ))}
            </div>
          </div>

          {/* Representantes Envolvidos */}
          <div className="rounded-lg border bg-card p-3">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-foreground">
              <Users className="h-4 w-4 text-primary" />
              <span>Representantes Envolvidos</span>
            </div>
            {immersion.representatives.length > 0 ? (
              <ul className="mt-1 space-y-1">
                {immersion.representatives.map((rep) => (
                  <li
                    key={rep.id}
                    className="flex items-center justify-between text-muted-foreground"
                  >
                    <span className="font-medium text-foreground">{rep.name}</span>
                    <span className="text-[11px]">{rep.region}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground">Representantes a definir.</p>
            )}
          </div>

          {/* Clientes Previstos (se existirem) */}
          {immersion.clients.length > 0 && (
            <div className="rounded-lg border bg-card p-3">
              <div className="mb-1 flex items-center gap-1.5 font-semibold text-foreground">
                <Building2 className="h-4 w-4 text-primary" />
                <span>Clientes Mapeados / Previstos</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {immersion.clients.map((cli) => (
                  <Badge key={cli.id} variant="outline" className="text-[10px]">
                    {cli.name} ({cli.cityName})
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Objetivo */}
          <div className="rounded-lg border bg-card p-3">
            <div className="mb-1 flex items-center gap-1.5 font-semibold text-foreground">
              <Target className="h-4 w-4 text-primary" />
              <span>Objetivo da Imersão</span>
            </div>
            <p className="text-muted-foreground leading-relaxed">{immersion.objective}</p>
          </div>

          {/* Observações */}
          {immersion.notes && (
            <div className="rounded-lg border bg-card p-3">
              <div className="mb-1 flex items-center gap-1.5 font-semibold text-foreground">
                <FileText className="h-4 w-4 text-primary" />
                <span>Observações</span>
              </div>
              <p className="text-muted-foreground leading-relaxed">{immersion.notes}</p>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
