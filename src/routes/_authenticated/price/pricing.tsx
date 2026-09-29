import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { PricingCodeSelector } from "@/components/pricing/PricingCodeSelector";
import { PricingProductCard } from "@/components/pricing/PricingProductCard";
import { PricingStudySummary } from "@/components/pricing/PricingStudySummary";
import { PricingTechnicalComparison } from "@/components/pricing/PricingTechnicalComparison";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useIsMasterAdmin } from "@/hooks/use-is-admin";
import { usePricingStudy } from "@/hooks/use-pricing-study";
import { ITEM_CLASSIFICATION_LABEL, type ItemClassification } from "@/lib/price-comparison-groups";
import { emptyPricingSide } from "@/lib/pricing-workspace";

export const Route = createFileRoute("/_authenticated/price/pricing")({
  head: () => ({ meta: [{ title: "Pricing — PoolFlux" }] }),
  component: PricingPage,
});

const showCard = (r: { state: string } | null) => r != null && r.state !== "QUERY_ERROR";

function PricingPage() {
  const isAdmin = useIsMasterAdmin();
  const pricing = usePricingStudy();
  const {
    studyName,
    setStudyName,
    notes,
    setNotes,
    base,
    setBase,
    competitorA,
    setCompetitorA,
    competitorB,
    setCompetitorB,
    twoCompetitors,
    setTwoCompetitors,
    classification,
    setClassification,
    intentionalVoltage,
    setIntentionalVoltage,
    group,
    items,
    saving,
    conflicts,
    pendingSaveMode,
    setPendingSaveMode,
    effectiveBase,
    effectiveA,
    effectiveB,
    baseReady,
    aReady,
    bReady,
    querySide,
    resolveSide,
    saveMaster,
    addCurrentRelation,
    removeRelation,
    finishGroup,
    performSave,
    requestSave,
    resetStudy,
  } = pricing;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge variant="outline">Experimental · Code first</Badge>
          <h1 className="mt-2 text-2xl font-bold">Pricing</h1>
          <p className="text-sm text-muted-foreground">
            Comece pelos códigos. Catálogo, especificações e preços são resolvidos separadamente.
          </p>
        </div>
        {(group || base.query || competitorA.query) && (
          <Button variant="outline" onClick={resetStudy}>
            Novo estudo
          </Button>
        )}
      </div>

      <div className="grid gap-4 rounded-xl border bg-card p-4 md:grid-cols-2">
        <div>
          <Label>Nome do estudo</Label>
          <Input
            value={studyName}
            onChange={(e) => setStudyName(e.target.value)}
            disabled={!!group}
            placeholder="Ex.: Fitas 24V — Stella"
          />
        </div>
        <div>
          <Label>Observações</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={1}
            placeholder="Contexto opcional"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PricingCodeSelector
          label="Produto base"
          query={base.query}
          resolution={base.resolution}
          onQueryChange={(query) => querySide(setBase, base, query)}
          onResolve={(query, result) => resolveSide(setBase, query, result)}
          onClear={() => setBase(emptyPricingSide())}
        />
        <PricingCodeSelector
          label="Produto concorrente"
          query={competitorA.query}
          resolution={competitorA.resolution}
          onQueryChange={(query) => querySide(setCompetitorA, competitorA, query)}
          onResolve={(query, result) => resolveSide(setCompetitorA, query, result)}
          onClear={() => setCompetitorA(emptyPricingSide())}
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={twoCompetitors} onCheckedChange={setTwoCompetitors} />
        <Label>Adicionar segundo concorrente</Label>
      </div>
      {twoCompetitors && (
        <PricingCodeSelector
          label="Segundo concorrente"
          query={competitorB.query}
          resolution={competitorB.resolution}
          onQueryChange={(query) => querySide(setCompetitorB, competitorB, query)}
          onResolve={(query, result) => resolveSide(setCompetitorB, query, result)}
          onClear={() => setCompetitorB(emptyPricingSide())}
        />
      )}

      {(showCard(base.resolution) || showCard(competitorA.resolution)) && (
        <div className={twoCompetitors ? "grid gap-4 xl:grid-cols-3" : "grid gap-4 lg:grid-cols-2"}>
          {showCard(base.resolution) && (
            <PricingProductCard
              title="Produto base"
              side={base}
              onChange={setBase}
              isAdmin={isAdmin}
              onSaveMaster={(update) => saveMaster(base, setBase, update)}
            />
          )}
          {showCard(competitorA.resolution) && (
            <PricingProductCard
              title="Concorrente"
              side={competitorA}
              onChange={setCompetitorA}
              isAdmin={isAdmin}
              onSaveMaster={(update) => saveMaster(competitorA, setCompetitorA, update)}
            />
          )}
          {twoCompetitors && showCard(competitorB.resolution) && (
            <PricingProductCard
              title="Segundo concorrente"
              side={competitorB}
              onChange={setCompetitorB}
              isAdmin={isAdmin}
              onSaveMaster={(update) => saveMaster(competitorB, setCompetitorB, update)}
            />
          )}
        </div>
      )}

      {baseReady && aReady && (
        <div className="space-y-4">
          <PricingTechnicalComparison
            base={effectiveBase}
            competitor={effectiveA}
            intentionalVoltage={intentionalVoltage}
            onIntentionalVoltageChange={setIntentionalVoltage}
          />
          {twoCompetitors && bReady && (
            <PricingTechnicalComparison
              base={effectiveBase}
              competitor={effectiveB}
              intentionalVoltage={intentionalVoltage}
              onIntentionalVoltageChange={setIntentionalVoltage}
            />
          )}
          <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card p-4">
            <div className="min-w-64 flex-1">
              <Label>Classificação da relação</Label>
              <Select
                value={classification}
                onValueChange={(value) => setClassification(value as ItemClassification)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ITEM_CLASSIFICATION_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pb-2">
              <Switch checked={intentionalVoltage} onCheckedChange={setIntentionalVoltage} />
              <Label>Comparação intencional</Label>
            </div>
            <Button
              onClick={() => void addCurrentRelation()}
              disabled={saving || group?.status === "finalizado"}
            >
              <Plus className="mr-2 h-4 w-4" />
              Adicionar ao estudo
            </Button>
          </div>
        </div>
      )}

      <PricingStudySummary
        group={group}
        items={items}
        isAdmin={isAdmin}
        saving={saving}
        conflicts={conflicts}
        pendingSaveMode={pendingSaveMode}
        onRemove={(item) => void removeRelation(item)}
        onFinish={() => void finishGroup()}
        onRequestSave={(mode) => void requestSave(mode)}
        onConfirmReplace={(mode) => void performSave(mode)}
        onCloseConflict={() => setPendingSaveMode(null)}
      />
    </div>
  );
}
