import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  addItem,
  checkOfficialConflicts,
  createGroup,
  finalizeGroup,
  removeItem,
  saveAsOfficial,
  saveAsSpecific,
  updateGroup,
  type ComparisonGroup,
  type ComparisonGroupItem,
  type ItemClassification,
} from "@/lib/price-comparison-groups";
import {
  resolvePricingProduct,
  updatePricingMasterProduct,
  type PricingMasterUpdate,
} from "@/lib/pricing-lookup";
import {
  canUsePricingSide,
  effectivePricingSide,
  emptyPricingSide,
  pricingSnapshot,
  sideFromResolution,
  type PricingSideDraft,
} from "@/lib/pricing-workspace";

export type PricingSaveMode = "oficial" | "especifico" | "oficial_e_especifico";

export function usePricingStudy() {
  const [studyName, setStudyName] = useState("");
  const [notes, setNotes] = useState("");
  const [base, setBase] = useState<PricingSideDraft>(emptyPricingSide);
  const [competitorA, setCompetitorA] = useState<PricingSideDraft>(emptyPricingSide);
  const [competitorB, setCompetitorB] = useState<PricingSideDraft>(emptyPricingSide);
  const [twoCompetitors, setTwoCompetitors] = useState(false);
  const [classification, setClassification] =
    useState<ItemClassification>("equivalente_aproximado");
  const [intentionalVoltage, setIntentionalVoltage] = useState(false);
  const [group, setGroup] = useState<ComparisonGroup | null>(null);
  const [items, setItems] = useState<ComparisonGroupItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [conflicts, setConflicts] = useState<Awaited<ReturnType<typeof checkOfficialConflicts>>>(
    [],
  );
  const [pendingSaveMode, setPendingSaveMode] = useState<PricingSaveMode | null>(null);

  const effectiveBase = useMemo(() => effectivePricingSide(base), [base]);
  const effectiveA = useMemo(() => effectivePricingSide(competitorA), [competitorA]);
  const effectiveB = useMemo(() => effectivePricingSide(competitorB), [competitorB]);
  const baseReady = canUsePricingSide(effectiveBase);
  const aReady = canUsePricingSide(effectiveA);
  const bReady = canUsePricingSide(effectiveB);

  function querySide(
    setter: (value: PricingSideDraft) => void,
    side: PricingSideDraft,
    query: string,
  ) {
    setter({ ...emptyPricingSide(), query, identity: { ...side.identity, code: query } });
  }

  function resolveSide(
    setter: (value: PricingSideDraft) => void,
    query: string,
    result: Parameters<typeof sideFromResolution>[1],
  ) {
    setter(sideFromResolution(query, result));
  }

  async function saveMaster(
    side: PricingSideDraft,
    setter: (value: PricingSideDraft) => void,
    update: PricingMasterUpdate,
  ) {
    const effective = effectivePricingSide(side);
    if (!effective.productId) {
      toast.error("Produto manual ainda não possui cadastro mestre.");
      return;
    }
    try {
      await updatePricingMasterProduct(effective.productId, {
        ...update,
        family: effective.identity.family,
      });
      const refreshed = await resolvePricingProduct(effective.identity.code, {
        productId: effective.productId,
      });
      setter(sideFromResolution(effective.identity.code, refreshed));
      toast.success("Cadastro mestre atualizado.");
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível atualizar o cadastro mestre.");
    }
  }

  async function ensureGroup(): Promise<ComparisonGroup> {
    if (group) return group;
    if (!studyName.trim()) throw new Error("missing-study-name");
    let created = await createGroup({
      name: studyName.trim(),
      familia: effectiveBase.identity.family,
      categoria: effectiveBase.identity.category || null,
      base_brand: effectiveBase.identity.brand,
      base_price_table: effectiveBase.priceListName,
    });
    if (notes.trim()) created = await updateGroup(created.id, { notes: notes.trim() });
    setGroup(created);
    return created;
  }

  async function addCurrentRelation() {
    if (!baseReady || !aReady || (twoCompetitors && !bReady)) {
      toast.error("Preencha os campos mínimos da base e dos concorrentes.");
      return;
    }
    if (!studyName.trim()) {
      toast.error("Informe o nome do estudo.");
      return;
    }
    if (
      group &&
      (group.familia !== effectiveBase.identity.family ||
        group.base_brand !== effectiveBase.identity.brand)
    ) {
      toast.error("Este grupo já possui outra família ou marca base. Inicie um novo estudo.");
      return;
    }
    setSaving(true);
    try {
      const currentGroup = await ensureGroup();
      const snapshot = {
        base: effectiveBase.specs,
        competitor_a: effectiveA.specs,
        ...(twoCompetitors ? { competitor_b: effectiveB.specs } : {}),
        price_meta: {
          base: priceMeta(effectiveBase),
          competitor_a: priceMeta(effectiveA),
          ...(twoCompetitors ? { competitor_b: priceMeta(effectiveB) } : {}),
        },
        pricing_snapshot: {
          base: pricingSnapshot(effectiveBase),
          competitor_a: pricingSnapshot(effectiveA),
          ...(twoCompetitors ? { competitor_b: pricingSnapshot(effectiveB) } : {}),
        },
      };
      const item = await addItem(currentGroup.id, {
        base_code: effectiveBase.identity.code,
        base_brand: effectiveBase.identity.brand,
        base_product_id: effectiveBase.productId,
        base_price: effectiveBase.comparablePrice,
        base_adjustment_percent: base.adjustmentPercent,
        competitor_a_code: effectiveA.identity.code,
        competitor_a_brand: effectiveA.identity.brand,
        competitor_a_product_id: effectiveA.productId,
        competitor_a_price: effectiveA.comparablePrice,
        competitor_a_price_table: effectiveA.priceListName,
        competitor_a_price_date: effectiveA.effectiveDate,
        competitor_a_source: effectiveA.source,
        competitor_a_adjustment_percent: competitorA.adjustmentPercent,
        two_competitors: twoCompetitors,
        competitor_b_code: twoCompetitors ? effectiveB.identity.code : null,
        competitor_b_brand: twoCompetitors ? effectiveB.identity.brand : null,
        competitor_b_product_id: twoCompetitors ? effectiveB.productId : null,
        competitor_b_price: twoCompetitors ? effectiveB.comparablePrice : null,
        competitor_b_price_table: twoCompetitors ? effectiveB.priceListName : null,
        competitor_b_price_date: twoCompetitors ? effectiveB.effectiveDate : null,
        competitor_b_source: twoCompetitors ? effectiveB.source : null,
        competitor_b_adjustment_percent: twoCompetitors ? competitorB.adjustmentPercent : null,
        classification,
        voltage_note: intentionalVoltage ? "Comparação intencional entre tensões" : null,
        notes: notes.trim() || null,
        specs_snapshot: snapshot,
      });
      setItems((current) => [...current, item]);
      setCompetitorA(emptyPricingSide());
      setCompetitorB(emptyPricingSide());
      setTwoCompetitors(false);
      setIntentionalVoltage(false);
      toast.success("Relação adicionada ao estudo.");
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível adicionar a relação.");
    } finally {
      setSaving(false);
    }
  }

  async function removeRelation(item: ComparisonGroupItem) {
    if (!group) return;
    await removeItem(item.id, group.id);
    setItems((current) => current.filter((row) => row.id !== item.id));
  }

  async function finishGroup() {
    if (!group || items.length === 0) return;
    setGroup(await finalizeGroup(group.id));
    toast.success("Grupo finalizado.");
  }

  async function performSave(mode: PricingSaveMode) {
    if (!group) return;
    setSaving(true);
    try {
      if (mode === "especifico") {
        setGroup(await saveAsSpecific(group.id));
        toast.success("Comparativo específico salvo.");
      } else {
        setGroup(
          await saveAsOfficial({
            groupId: group.id,
            alsoSpecific: mode === "oficial_e_especifico",
            replaceConflicts: true,
          }),
        );
        toast.success(
          mode === "oficial"
            ? "Comparativo oficial salvo."
            : "Comparativos oficial e específico salvos.",
        );
      }
      setPendingSaveMode(null);
      setConflicts([]);
    } catch (error) {
      console.error(error);
      toast.error("Não foi possível salvar o comparativo.");
    } finally {
      setSaving(false);
    }
  }

  async function requestSave(mode: PricingSaveMode) {
    if (!group) return;
    if (mode !== "especifico") {
      const found = await checkOfficialConflicts(group, items);
      if (found.length > 0) {
        setConflicts(found);
        setPendingSaveMode(mode);
        return;
      }
    }
    await performSave(mode);
  }

  function resetStudy() {
    setStudyName("");
    setNotes("");
    setBase(emptyPricingSide());
    setCompetitorA(emptyPricingSide());
    setCompetitorB(emptyPricingSide());
    setTwoCompetitors(false);
    setGroup(null);
    setItems([]);
  }

  return {
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
  };
}

function priceMeta(side: ReturnType<typeof effectivePricingSide>) {
  return {
    original_price: side.originalPrice,
    original_unit: side.originalUnit,
    comparable_unit: side.comparableUnit,
  };
}
