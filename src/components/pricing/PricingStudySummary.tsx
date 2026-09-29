import { FileDown, Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ITEM_CLASSIFICATION_LABEL,
  type ComparisonGroup,
  type ComparisonGroupItem,
} from "@/lib/price-comparison-groups";
import { exportComparisonGroupPdf } from "@/lib/price-comparison-groups-pdf";
import type { PricingSaveMode } from "@/hooks/use-pricing-study";

type OfficialConflict = {
  itemId: string;
  side: string;
  existingEquivalenceId: string;
  baseLabel: string;
  competitorLabel: string;
};

export function PricingStudySummary({
  group,
  items,
  isAdmin,
  saving,
  conflicts,
  pendingSaveMode,
  onRemove,
  onFinish,
  onRequestSave,
  onConfirmReplace,
  onCloseConflict,
}: {
  group: ComparisonGroup | null;
  items: ComparisonGroupItem[];
  isAdmin: boolean;
  saving: boolean;
  conflicts: OfficialConflict[];
  pendingSaveMode: PricingSaveMode | null;
  onRemove: (item: ComparisonGroupItem) => void;
  onFinish: () => void;
  onRequestSave: (mode: PricingSaveMode) => void;
  onConfirmReplace: (mode: PricingSaveMode) => void;
  onCloseConflict: () => void;
}) {
  return (
    <>
      {group && (
        <section className="space-y-3 rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Comparações do estudo ({items.length} itens)</h2>
              <p className="text-xs text-muted-foreground">
                {group.name} · {group.status === "finalizado" ? "Finalizado" : "Rascunho"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => exportComparisonGroupPdf(group, items)}
                disabled={!items.length}
              >
                <FileDown className="mr-2 h-4 w-4" />
                Relatório
              </Button>
              {group.status !== "finalizado" && (
                <Button onClick={onFinish} disabled={!items.length}>
                  Finalizar grupo
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            {items.map((item, index) => (
              <div
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"
              >
                <div>
                  <span className="text-muted-foreground">#{index + 1}</span>{" "}
                  <strong>
                    {item.base_brand} {item.base_code}
                  </strong>{" "}
                  versus{" "}
                  <strong>
                    {item.competitor_a_brand} {item.competitor_a_code}
                  </strong>
                  {item.two_competitors && (
                    <>
                      {" "}
                      e{" "}
                      <strong>
                        {item.competitor_b_brand} {item.competitor_b_code}
                      </strong>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {item.classification
                      ? ITEM_CLASSIFICATION_LABEL[item.classification]
                      : "Sem classificação"}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemove(item)}
                    disabled={group.status === "finalizado"}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {group.status === "finalizado" && (
            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button
                variant="outline"
                onClick={() => onRequestSave("especifico")}
                disabled={saving}
              >
                <Save className="mr-2 h-4 w-4" />
                Salvar como específico
              </Button>
              <Button onClick={() => onRequestSave("oficial")} disabled={!isAdmin || saving}>
                Salvar como oficial
              </Button>
              <Button
                onClick={() => onRequestSave("oficial_e_especifico")}
                disabled={!isAdmin || saving}
              >
                Salvar oficial + específico
              </Button>
            </div>
          )}
        </section>
      )}

      <Dialog
        open={pendingSaveMode != null && conflicts.length > 0}
        onOpenChange={(open) => !open && onCloseConflict()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Comparativo oficial já existe</DialogTitle>
            <DialogDescription>
              Você está substituindo a comparação atual por uma nova relação entre códigos. Deseja
              continuar?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {conflicts.map((conflict) => (
              <div
                key={`${conflict.itemId}-${conflict.side}`}
                className="rounded border p-3 text-sm"
              >
                <p>
                  Relação atual:{" "}
                  <span className="font-mono text-xs">{conflict.existingEquivalenceId}</span>
                </p>
                <p>
                  Nova relação: <strong>{conflict.baseLabel}</strong> versus{" "}
                  <strong>{conflict.competitorLabel}</strong>
                </p>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCloseConflict}>
              Cancelar
            </Button>
            <Button
              onClick={() => pendingSaveMode && onConfirmReplace(pendingSaveMode)}
              disabled={!pendingSaveMode}
            >
              Substituir e salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
