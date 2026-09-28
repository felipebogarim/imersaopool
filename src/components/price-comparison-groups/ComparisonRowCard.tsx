// Card de uma linha de comparação (item 5 e 9 do pedido): bloco base, bloco(s)
// concorrente, preço + simulação por lado, status/classificação e o
// "Comparativo Técnico" expansível com no máximo 6 atributos por família.
import { useMemo, useState } from "react";
import { ChevronDown, Copy, Repeat, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatBRL } from "@/lib/price-comparativos-core";
import {
  ITEM_CLASSIFICATION_LABEL,
  ITEM_STATUS_LABEL,
  type ComparisonGroupItem,
  type ItemClassification,
  type ItemStatus,
} from "@/lib/price-comparison-groups";
import { analyzeAttribute, simulatePrice, top6For } from "@/lib/price-comparison-groups-attributes";
import { cn } from "@/lib/utils";

const STATUS_BADGE: Record<ItemStatus, string> = {
  em_analise: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  validado: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  incompativel: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

const TONE_CLASS: Record<string, string> = {
  igual: "text-muted-foreground",
  base: "text-blue-600 dark:text-blue-400",
  concorrente: "text-orange-600 dark:text-orange-400",
  config: "text-violet-600 dark:text-violet-400",
  sem_dado: "text-muted-foreground italic",
};

function CompetitorPriceBlock({
  brand,
  code,
  price,
  priceTable,
  priceDate,
  region,
  source,
  adjustmentPercent,
  onAdjustmentChange,
  onSubstitute,
  readOnly,
}: {
  brand: string;
  code: string;
  price: number | null;
  priceTable: string | null;
  priceDate: string | null;
  region: string | null;
  source: string | null;
  adjustmentPercent: number | null;
  onAdjustmentChange: (v: number | null) => void;
  onSubstitute?: () => void;
  readOnly: boolean;
}) {
  const simulated = simulatePrice(price, adjustmentPercent);
  return (
    <div className="flex-1 min-w-[220px] rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {brand || "Concorrente"}
          </p>
          <p className="font-mono text-sm font-medium">{code || "—"}</p>
        </div>
        {onSubstitute && !readOnly && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            title="Substituir concorrente"
            onClick={onSubstitute}
          >
            <Repeat className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <p className="text-lg font-semibold cursor-help">{formatBRL(price)}</p>
        </TooltipTrigger>
        <TooltipContent className="text-xs">
          <p className="font-medium">Tabela utilizada: {priceTable || "não informada"}</p>
          {priceDate && <p>Data: {new Date(priceDate).toLocaleDateString("pt-BR")}</p>}
          {region && <p>Região: {region}</p>}
          {source && <p>Fonte: {source}</p>}
        </TooltipContent>
      </Tooltip>
      {!readOnly && (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            step="0.1"
            value={adjustmentPercent ?? ""}
            onChange={(e) =>
              onAdjustmentChange(e.target.value === "" ? null : Number(e.target.value))
            }
            placeholder="Ajuste %"
            className="h-8 w-24 text-xs"
          />
          {adjustmentPercent != null && simulated != null && (
            <span className="text-xs text-muted-foreground">
              → <span className="font-medium text-foreground">{formatBRL(simulated)}</span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function ComparisonRowCard({
  item,
  familia,
  readOnly,
  onChange,
  onRemove,
  onDuplicate,
  onSubstituteA,
  onSubstituteB,
}: {
  item: ComparisonGroupItem;
  familia: string;
  readOnly: boolean;
  onChange: (patch: Partial<ComparisonGroupItem>) => void;
  onRemove?: () => void;
  onDuplicate?: () => void;
  onSubstituteA?: () => void;
  onSubstituteB?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const attrs = useMemo(() => top6For(familia), [familia]);
  const voltageAttr = attrs.find((a) => a.key === "tensao");
  const baseSpecs = item.specs_snapshot?.base ?? {};
  const compASpecs = item.specs_snapshot?.competitor_a ?? {};
  const compBSpecs = item.specs_snapshot?.competitor_b ?? {};

  const voltageAnalysis =
    voltageAttr && (baseSpecs[voltageAttr.key] || compASpecs[voltageAttr.key])
      ? analyzeAttribute(voltageAttr, baseSpecs[voltageAttr.key], compASpecs[voltageAttr.key])
      : null;

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <div className="p-3 sm:p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex flex-wrap gap-1.5">
            {attrs.slice(0, 6).map((a) => {
              const bv = baseSpecs[a.key];
              const cv = compASpecs[a.key];
              if (!bv && !cv) return null;
              const analysis = analyzeAttribute(a, bv, cv);
              return (
                <Badge
                  key={a.key}
                  variant="outline"
                  className={cn("text-[10px] font-normal", TONE_CLASS[analysis.tone])}
                  title={`${a.label}: ${analysis.text}`}
                >
                  {a.label}
                </Badge>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={item.status}
              onValueChange={(v) => onChange({ status: v as ItemStatus })}
              disabled={readOnly}
            >
              <SelectTrigger
                className={cn("h-7 w-[130px] text-xs border-none", STATUS_BADGE[item.status])}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ITEM_STATUS_LABEL) as ItemStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {ITEM_STATUS_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!readOnly && onDuplicate && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Duplicar linha"
                onClick={onDuplicate}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            )}
            {!readOnly && onRemove && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive"
                title="Remover"
                onClick={onRemove}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex-1 min-w-[220px] rounded-lg border bg-muted/40 p-3 space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {item.base_brand}
            </p>
            <p className="font-mono text-sm font-medium">{item.base_code}</p>
            <p className="text-lg font-semibold">{formatBRL(item.base_price)}</p>
            {!readOnly && (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  step="0.1"
                  value={item.base_adjustment_percent ?? ""}
                  onChange={(e) =>
                    onChange({
                      base_adjustment_percent:
                        e.target.value === "" ? null : Number(e.target.value),
                    })
                  }
                  placeholder="Ajuste %"
                  className="h-8 w-24 text-xs"
                />
                {item.base_adjustment_percent != null && (
                  <span className="text-xs text-muted-foreground">
                    →{" "}
                    <span className="font-medium text-foreground">
                      {formatBRL(simulatePrice(item.base_price, item.base_adjustment_percent))}
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>

          <CompetitorPriceBlock
            brand={item.competitor_a_brand}
            code={item.competitor_a_code}
            price={item.competitor_a_price}
            priceTable={item.competitor_a_price_table}
            priceDate={item.competitor_a_price_date}
            region={item.competitor_a_region}
            source={item.competitor_a_source}
            adjustmentPercent={item.competitor_a_adjustment_percent}
            onAdjustmentChange={(v) => onChange({ competitor_a_adjustment_percent: v })}
            onSubstitute={onSubstituteA}
            readOnly={readOnly}
          />

          {item.two_competitors && (
            <CompetitorPriceBlock
              brand={item.competitor_b_brand ?? ""}
              code={item.competitor_b_code ?? ""}
              price={item.competitor_b_price}
              priceTable={item.competitor_b_price_table}
              priceDate={item.competitor_b_price_date}
              region={item.competitor_b_region}
              source={item.competitor_b_source}
              adjustmentPercent={item.competitor_b_adjustment_percent}
              onAdjustmentChange={(v) => onChange({ competitor_b_adjustment_percent: v })}
              onSubstitute={onSubstituteB}
              readOnly={readOnly}
            />
          )}
        </div>

        {voltageAnalysis?.tone === "config" &&
          voltageAnalysis.text === "Comparação intencional entre tensões" && (
            <p className="text-xs text-violet-600 dark:text-violet-400">
              ⚡ Comparação intencional entre tensões — diferença de configuração, não
              incompatibilidade.
            </p>
          )}

        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground">
              <ChevronDown
                className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}
              />
              Comparativo técnico
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Característica</TableHead>
                  <TableHead>{item.base_brand}</TableHead>
                  <TableHead>{item.competitor_a_brand}</TableHead>
                  {item.two_competitors && <TableHead>{item.competitor_b_brand}</TableHead>}
                  <TableHead>Análise</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attrs.map((a) => {
                  const bv = baseSpecs[a.key];
                  const av = compASpecs[a.key];
                  const bvv = compBSpecs[a.key];
                  const analysis = analyzeAttribute(a, bv, av);
                  return (
                    <TableRow key={a.key}>
                      <TableCell className="text-xs text-muted-foreground">{a.label}</TableCell>
                      <TableCell className="text-sm">
                        {bv?.value_numeric ?? bv?.value_text ?? bv?.normalized_value ?? "—"}
                        {a.unidade && bv?.value_numeric != null ? ` ${a.unidade}` : ""}
                      </TableCell>
                      <TableCell className="text-sm">
                        {av?.value_numeric ?? av?.value_text ?? av?.normalized_value ?? "—"}
                        {a.unidade && av?.value_numeric != null ? ` ${a.unidade}` : ""}
                      </TableCell>
                      {item.two_competitors && (
                        <TableCell className="text-sm">
                          {bvv?.value_numeric ?? bvv?.value_text ?? bvv?.normalized_value ?? "—"}
                          {a.unidade && bvv?.value_numeric != null ? ` ${a.unidade}` : ""}
                        </TableCell>
                      )}
                      <TableCell className={cn("text-xs font-medium", TONE_CLASS[analysis.tone])}>
                        {analysis.text}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="grid gap-2 sm:grid-cols-2">
              <Select
                value={item.classification ?? undefined}
                onValueChange={(v) => onChange({ classification: v as ItemClassification })}
                disabled={readOnly}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Classificação técnica" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ITEM_CLASSIFICATION_LABEL) as ItemClassification[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {ITEM_CLASSIFICATION_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={item.voltage_note ?? ""}
                onChange={(e) => onChange({ voltage_note: e.target.value })}
                placeholder="Observação de tensão/configuração (opcional)"
                className="h-8 text-xs"
                disabled={readOnly}
              />
            </div>
            <Textarea
              value={item.notes ?? ""}
              onChange={(e) => onChange({ notes: e.target.value })}
              placeholder="Notas técnicas desta comparação…"
              className="text-xs"
              disabled={readOnly}
              rows={2}
            />
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
