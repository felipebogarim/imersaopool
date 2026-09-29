import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { analyzeAttribute, top6For } from "@/lib/price-comparison-groups-attributes";
import type { SpecValue } from "@/lib/price-comparativos-core";
import type { EffectivePricingSide } from "@/lib/pricing-workspace";
import { cn } from "@/lib/utils";

const TONE_CLASS = {
  igual: "bg-emerald-500/10 text-emerald-700",
  base: "bg-blue-500/10 text-blue-700",
  concorrente: "bg-orange-500/10 text-orange-700",
  config: "bg-violet-500/10 text-violet-700",
  sem_dado: "bg-muted text-muted-foreground",
};

function valueText(value: SpecValue | undefined, unit?: string) {
  const raw =
    value?.original_value ?? value?.value_text ?? value?.normalized_value ?? value?.value_numeric;
  if (raw == null || raw === "") return "Não informado";
  if (value?.original_value || value?.value_text) return String(raw);
  return unit ? `${raw} ${unit}` : String(raw);
}

export function PricingTechnicalComparison({
  base,
  competitor,
  intentionalVoltage,
  onIntentionalVoltageChange,
}: {
  base: EffectivePricingSide;
  competitor: EffectivePricingSide;
  intentionalVoltage: boolean;
  onIntentionalVoltageChange: (value: boolean) => void;
}) {
  const attrs = top6For(base.identity.family);
  const voltageAttr = attrs.find((attr) => attr.key === "tensao");
  const voltageDiffers = voltageAttr
    ? analyzeAttribute(voltageAttr, base.specs.tensao, competitor.specs.tensao).tone === "config"
    : false;
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
        <div>
          <h3 className="font-semibold">Comparação técnica</h3>
          <p className="text-xs text-muted-foreground">
            {base.identity.code} versus {competitor.identity.code}
          </p>
        </div>
        {voltageDiffers && (
          <div className="flex items-center gap-2">
            <Switch checked={intentionalVoltage} onCheckedChange={onIntentionalVoltageChange} />
            <Label className="text-xs">Comparação intencional entre tensões</Label>
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Característica</TableHead>
              <TableHead>{base.identity.brand}</TableHead>
              <TableHead>{competitor.identity.brand}</TableHead>
              <TableHead>Análise</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {attrs.map((attr) => {
              const analysis = analyzeAttribute(
                attr,
                base.specs[attr.key],
                competitor.specs[attr.key],
              );
              return (
                <TableRow key={attr.key}>
                  <TableCell className="font-medium">{attr.label}</TableCell>
                  <TableCell>{valueText(base.specs[attr.key], attr.unidade)}</TableCell>
                  <TableCell>{valueText(competitor.specs[attr.key], attr.unidade)}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("font-normal", TONE_CLASS[analysis.tone])}
                    >
                      {analysis.text}
                    </Badge>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
