import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRICE_NOT_COMPARABLE_LABEL, formatBRL } from "@/lib/price-comparativos-core";
import { simulatePrice } from "@/lib/price-comparison-groups-attributes";
import type { EffectivePricingSide, PricingSideDraft } from "@/lib/pricing-workspace";

export function PricingPriceSection({
  side,
  effective,
  onChange,
}: {
  side: PricingSideDraft;
  effective: EffectivePricingSide;
  onChange: (side: PricingSideDraft) => void;
}) {
  const simulated = simulatePrice(effective.comparablePrice, side.adjustmentPercent);

  function updateManualPrice(field: keyof PricingSideDraft["manualPrice"], value: string) {
    onChange({ ...side, manualPrice: { ...side.manualPrice, [field]: value } });
  }

  return (
    <section className="rounded-lg border bg-muted/20 p-3 space-y-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">Preço comparável</p>
          <p className="text-lg font-semibold">
            {effective.comparablePrice == null
              ? PRICE_NOT_COMPARABLE_LABEL
              : `${formatBRL(effective.comparablePrice)}${effective.comparableUnit === "m" ? "/m" : ""}`}
          </p>
          {effective.originalPrice != null && (
            <p className="text-xs text-muted-foreground">
              Preço original: {formatBRL(effective.originalPrice)} /{" "}
              {effective.originalUnit ?? "unidade"}
            </p>
          )}
        </div>
        <div className="w-36">
          <Label className="text-[11px]">Ajuste %</Label>
          <Input
            type="number"
            step="0.1"
            value={side.adjustmentPercent ?? ""}
            onChange={(event) =>
              onChange({
                ...side,
                adjustmentPercent: event.target.value ? Number(event.target.value) : null,
              })
            }
            className="h-8"
            disabled={effective.comparablePrice == null}
          />
        </div>
      </div>
      {side.adjustmentPercent != null && simulated != null && (
        <p className="text-xs">
          Preço simulado: <strong>{formatBRL(simulated)}</strong>
        </p>
      )}
      {effective.comparablePrice == null && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <PriceInput
            label="Preço original"
            value={side.manualPrice.originalPrice}
            onChange={(value) => updateManualPrice("originalPrice", value)}
          />
          <PriceInput
            label="Unidade original"
            value={side.manualPrice.originalUnit}
            placeholder="bobina"
            onChange={(value) => updateManualPrice("originalUnit", value)}
          />
          <PriceInput
            label="Preço por metro"
            value={side.manualPrice.pricePerMeter}
            onChange={(value) => updateManualPrice("pricePerMeter", value)}
          />
          <PriceInput
            label="Tabela/lista"
            value={side.manualPrice.priceListName}
            onChange={(value) => updateManualPrice("priceListName", value)}
          />
          <PriceInput
            label="Data efetiva"
            value={side.manualPrice.effectiveDate}
            type="date"
            onChange={(value) => updateManualPrice("effectiveDate", value)}
          />
          <PriceInput
            label="Origem"
            value={side.manualPrice.source}
            onChange={(value) => updateManualPrice("source", value)}
          />
        </div>
      )}
      <div className="text-[11px] text-muted-foreground">
        {effective.priceListName && <span>Tabela: {effective.priceListName} · </span>}
        {effective.source && <span>Origem: {effective.source} · </span>}
        {effective.effectiveDate && (
          <span>
            {new Date(effective.effectiveDate).toLocaleDateString("pt-BR", { timeZone: "UTC" })}
          </span>
        )}
      </div>
    </section>
  );
}

function PriceInput({
  label,
  value,
  onChange,
  placeholder,
  type,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <Label className="text-[11px]">{label}</Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        type={type}
        className="h-8"
      />
    </div>
  );
}
