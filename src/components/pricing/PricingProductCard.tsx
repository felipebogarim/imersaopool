import { useMemo, useState } from "react";
import { ChevronDown, Database, Edit3, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { top6For } from "@/lib/price-comparison-groups-attributes";
import type { PricingMasterUpdate } from "@/lib/pricing-lookup";
import {
  effectivePricingSide,
  type PricingIdentity,
  type PricingSideDraft,
} from "@/lib/pricing-workspace";
import { PricingPriceSection } from "./PricingPriceSection";

type EditMode = "local" | "master";
type EditableField = keyof PricingIdentity | `spec:${string}`;

const STATE_LABEL = {
  FOUND_COMPLETE: "Cadastro completo",
  FOUND_INCOMPLETE: "Cadastro incompleto",
  FOUND_NO_PRICE: "Sem preço comparável",
  NOT_FOUND: "Produto manual",
  AMBIGUOUS: "Escolha a marca",
  QUERY_ERROR: "Erro de consulta",
} as const;

const IDENTITY_MISSING_KEY: Record<keyof PricingIdentity, string> = {
  code: "codigo",
  brand: "marca",
  description: "descricao",
  family: "familia",
  category: "categoria",
  type: "tipo",
};

function specText(value: ReturnType<typeof effectivePricingSide>["specs"][string] | undefined) {
  const text =
    value?.original_value ?? value?.value_text ?? value?.normalized_value ?? value?.value_numeric;
  return text == null || text === "" ? null : String(text);
}

export function PricingProductCard({
  title,
  side,
  onChange,
  isAdmin,
  onSaveMaster,
}: {
  title: string;
  side: PricingSideDraft;
  onChange: (side: PricingSideDraft) => void;
  isAdmin: boolean;
  onSaveMaster: (update: PricingMasterUpdate) => Promise<void>;
}) {
  const effective = useMemo(() => effectivePricingSide(side), [side]);
  const [editing, setEditing] = useState<Partial<Record<EditableField, EditMode>>>({});
  const [destinationField, setDestinationField] = useState<EditableField | null>(null);
  const [savingMaster, setSavingMaster] = useState(false);
  const found = side.resolution?.state.startsWith("FOUND_") ?? false;
  const attrs = top6For(effective.identity.family || "Fitas e Fontes");
  const missingFields = new Set(effective.missingFields);

  function updateIdentity(field: keyof PricingIdentity, value: string) {
    onChange({
      ...side,
      identityOverrides: { ...side.identityOverrides, [field]: value },
    });
  }

  function updateSpec(key: string, value: string) {
    onChange({ ...side, specOverrides: { ...side.specOverrides, [key]: value } });
  }

  function chooseDestination(mode: EditMode) {
    if (!destinationField) return;
    setEditing((current) => ({ ...current, [destinationField]: mode }));
    setDestinationField(null);
  }

  async function saveMasterChanges() {
    const identityMap: Record<
      keyof PricingIdentity,
      keyof NonNullable<PricingMasterUpdate["identification"]>
    > = {
      code: "sku",
      brand: "marca",
      description: "descricao",
      family: "familia",
      category: "categoria",
      type: "tipo",
    };
    const identification: NonNullable<PricingMasterUpdate["identification"]> = {};
    const specs: Record<string, string> = {};
    for (const [field, mode] of Object.entries(editing)) {
      if (mode !== "master") continue;
      if (field.startsWith("spec:")) {
        const key = field.slice(5);
        if (side.specOverrides[key]?.trim()) specs[key] = side.specOverrides[key];
      } else {
        const key = field as keyof PricingIdentity;
        const value = side.identityOverrides[key];
        if (value?.trim()) identification[identityMap[key]] = value;
      }
    }
    setSavingMaster(true);
    try {
      await onSaveMaster({ family: effective.identity.family, identification, specs });
      setEditing((current) =>
        Object.fromEntries(Object.entries(current).filter(([, mode]) => mode !== "master")),
      );
    } finally {
      setSavingMaster(false);
    }
  }

  const masterPending = Object.values(editing).some((mode) => mode === "master");
  const identityFields: Array<{ key: keyof PricingIdentity; label: string }> = [
    { key: "code", label: "Código" },
    { key: "brand", label: "Marca" },
    { key: "description", label: "Descrição" },
    { key: "family", label: "Família" },
    { key: "category", label: "Categoria" },
    { key: "type", label: "Tipo" },
  ];

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </p>
          <h3 className="mt-1 font-mono text-lg font-semibold">
            {effective.identity.code || "Novo produto"}
          </h3>
          <p className="text-sm text-muted-foreground">
            {effective.identity.brand || "Marca não informada"}
          </p>
        </div>
        {side.resolution && <Badge variant="outline">{STATE_LABEL[side.resolution.state]}</Badge>}
      </div>

      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Identificação
        </h4>
        <div className="grid gap-2 sm:grid-cols-2">
          {identityFields.map(({ key, label }) => {
            const value = effective.identity[key];
            const mustEdit =
              !value.trim() ||
              !found ||
              missingFields.has(IDENTITY_MISSING_KEY[key]) ||
              Boolean(editing[key]);
            return (
              <div key={key} className={key === "description" ? "sm:col-span-2" : ""}>
                <Label className="text-[11px] text-muted-foreground">{label}</Label>
                {mustEdit ? (
                  <Input
                    value={value}
                    onChange={(event) => updateIdentity(key, event.target.value)}
                    className="h-8"
                  />
                ) : (
                  <div className="flex h-8 items-center justify-between rounded-md border bg-muted/30 px-2 text-sm">
                    <span className="truncate">{value}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setDestinationField(key)}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Características principais
        </h4>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {attrs.map((attr) => {
            const value = specText(effective.specs[attr.key]);
            const field = `spec:${attr.key}` as const;
            const mustEdit = !value || missingFields.has(field) || Boolean(editing[field]);
            return (
              <div key={attr.key}>
                <Label className="text-[11px] text-muted-foreground">{attr.label}</Label>
                {mustEdit ? (
                  <Input
                    value={side.specOverrides[attr.key] ?? value ?? ""}
                    onChange={(event) => updateSpec(attr.key, event.target.value)}
                    placeholder="Não informado"
                    className="h-8"
                  />
                ) : (
                  <div className="flex h-8 items-center justify-between rounded-md border bg-muted/30 px-2 text-sm">
                    <span>{value}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setDestinationField(field)}
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {Object.keys(effective.specs).some((key) => !attrs.some((attr) => attr.key === key)) && (
          <details className="rounded-md border px-3 py-2 text-sm">
            <summary className="flex cursor-pointer items-center gap-2 font-medium">
              <ChevronDown className="h-4 w-4" /> Ver detalhes
            </summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {Object.entries(effective.specs)
                .filter(([key]) => !attrs.some((attr) => attr.key === key))
                .map(([key, value]) => (
                  <div key={key} className="flex justify-between gap-3 border-b py-1">
                    <span className="text-muted-foreground">{key}</span>
                    <span>{specText(value) ?? "Não informado"}</span>
                  </div>
                ))}
            </div>
          </details>
        )}
      </section>

      <PricingPriceSection side={side} effective={effective} onChange={onChange} />

      {masterPending && isAdmin && (
        <Button
          type="button"
          variant="outline"
          onClick={() => void saveMasterChanges()}
          disabled={savingMaster}
        >
          <Database className="mr-2 h-4 w-4" />
          {savingMaster ? "Atualizando…" : "Atualizar cadastro mestre"}
        </Button>
      )}

      <Dialog
        open={destinationField != null}
        onOpenChange={(open) => !open && setDestinationField(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Destino da correção</DialogTitle>
            <DialogDescription>Escolha onde esta alteração deverá ser aplicada.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Button type="button" variant="outline" onClick={() => chooseDestination("local")}>
              Usar somente neste comparativo
            </Button>
            <Button type="button" onClick={() => chooseDestination("master")} disabled={!isAdmin}>
              <Save className="mr-2 h-4 w-4" /> Atualizar cadastro mestre
            </Button>
            {!isAdmin && (
              <p className="text-xs text-muted-foreground">
                Atualização mestre exige permissão administrativa.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
