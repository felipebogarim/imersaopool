// Price › Validação de Comparáveis (itens 2–21 do pedido).
// Monta grupos de comparação manuais (1 ou 2 concorrentes por linha),
// finaliza e salva como comparativo oficial e/ou específico, com conflito
// de oficial, duplicação, edição e substituição de competidor.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useIsMasterAdmin } from "@/hooks/use-is-admin";
import { FAMILIAS, CATEGORIAS } from "@/lib/price-comparativos-core";
import { getFamilyConfig } from "@/lib/price-mapa/family-config";
import {
  addItem,
  checkOfficialConflicts,
  createGroup,
  duplicateGroup,
  fetchGroup,
  fetchGroupItems,
  fetchGroups,
  finalizeGroup,
  removeItem,
  saveAsOfficial,
  saveAsSpecific,
  softDeleteGroup,
  substituteCompetitor,
  updateGroup,
  updateItem,
  type ComparisonGroup,
  type ComparisonGroupItem,
} from "@/lib/price-comparison-groups";
import { exportComparisonGroupPdf } from "@/lib/price-comparison-groups-pdf";
import { ComparisonRowCard } from "@/components/price-comparison-groups/ComparisonRowCard";
import {
  ComparisonSidePicker,
  EMPTY_SIDE,
  useResolvedSide,
  type ResolvedSide,
  type SideSelection,
} from "@/components/price-comparison-groups/ComparisonSidePicker";
import { productCode } from "@/components/price-comparison-groups/ProductCombobox";
import {
  BASE_BRANDS,
  fetchBrandOptions,
  fetchBrandPriceTables,
  resolveTableKey,
} from "@/lib/price-comparison-lookup";
import { OfficialEquivalenceCheck } from "@/components/price-equivalences/OfficialEquivalenceCheck";
import { SpecificComparativesPanel } from "@/components/price-comparison-groups/SpecificComparativesPanel";

export const Route = createFileRoute("/_authenticated/price/validacao")({
  head: () => ({ meta: [{ title: "Validação de Comparáveis — PoolFlux" }] }),
  component: ValidacaoComparaveisPage,
});

type GroupDraft = {
  name: string;
  familia: string;
  categoria: string | null;
  base_brand: string;
  base_price_table: string | null;
};

function emptyGroupDraft(familia: string): GroupDraft {
  const cfg = getFamilyConfig(familia);
  return {
    name: "",
    familia,
    categoria: CATEGORIAS[familia]?.[0] ?? null,
    base_brand:
      BASE_BRANDS.find((b) => b.toLowerCase() === cfg.baseBrand.toLowerCase()) ?? BASE_BRANDS[0],
    base_price_table: null,
  };
}

function metaOf(r: ResolvedSide) {
  return {
    original_price: r.originalPrice,
    original_unit: r.originalUnit,
    comparable_unit: r.comparableUnit,
  };
}

function ValidacaoComparaveisPage() {
  const isAdmin = useIsMasterAdmin();
  const queryClient = useQueryClient();

  const [familia, setFamilia] = useState<string>(FAMILIAS[0]);
  const [group, setGroup] = useState<ComparisonGroup | null>(null);
  const [draft, setDraft] = useState(emptyGroupDraft(FAMILIAS[0]));
  const [items, setItems] = useState<ComparisonGroupItem[]>([]);
  const [baseSide, setBaseSide] = useState<SideSelection>({
    ...EMPTY_SIDE,
    brand: draft.base_brand,
  });
  const [compA, setCompA] = useState<SideSelection>(EMPTY_SIDE);
  const [compB, setCompB] = useState<SideSelection>(EMPTY_SIDE);
  const [twoCompetitors, setTwoCompetitors] = useState(false);
  const [saving, setSaving] = useState(false);

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveMode, setSaveMode] = useState<"oficial" | "especifico" | "oficial_e_especifico">(
    "especifico",
  );
  const [conflicts, setConflicts] = useState<Awaited<ReturnType<typeof checkOfficialConflicts>>>(
    [],
  );
  const [conflictConfirmOpen, setConflictConfirmOpen] = useState(false);
  const [reportPromptOpen, setReportPromptOpen] = useState(false);

  const [substituteOpen, setSubstituteOpen] = useState(false);
  const [substituteFrom, setSubstituteFrom] = useState("");
  const [substituteTo, setSubstituteTo] = useState("");
  const [substituteScope, setSubstituteScope] = useState<"item" | "group">("group");
  const [substituteItemId, setSubstituteItemId] = useState<string | null>(null);

  const brandsQuery = useQuery({
    queryKey: ["price-comparison-brands", draft.familia],
    queryFn: () => fetchBrandOptions(draft.familia),
  });
  const baseBrandOptions = useMemo(() => {
    const opts = brandsQuery.data?.base ?? [...BASE_BRANDS];
    return !draft.base_brand || opts.some((o) => o.toLowerCase() === draft.base_brand.toLowerCase())
      ? opts
      : [draft.base_brand, ...opts];
  }, [brandsQuery.data, draft.base_brand]);

  // Alinha a grafia da marca base com a cadastrada nos produtos (filtro por marca é exato).
  useEffect(() => {
    if (group) return;
    const match = baseBrandOptions.find(
      (o) => o.toLowerCase() === draft.base_brand.toLowerCase() && o !== draft.base_brand,
    );
    if (match) {
      setDraft((d) => ({ ...d, base_brand: match }));
      setBaseSide((s) => ({ ...s, brand: match }));
    }
  }, [baseBrandOptions, draft.base_brand, group]);

  const baseTablesQuery = useQuery({
    queryKey: ["price-comparison-brand-tables", draft.base_brand, draft.familia],
    queryFn: () => fetchBrandPriceTables(draft.base_brand, draft.familia),
    enabled: !!draft.base_brand,
  });
  const baseTables = baseTablesQuery.data ?? [];
  const effectiveBaseTable = resolveTableKey(baseTables, draft.base_price_table);

  const baseResolved = useResolvedSide(baseSide, draft.familia, effectiveBaseTable);
  const compAResolved = useResolvedSide(compA, draft.familia);
  const compBResolved = useResolvedSide(compB, draft.familia);

  function resetSides(baseBrand: string) {
    setBaseSide({ ...EMPTY_SIDE, brand: baseBrand });
    setCompA(EMPTY_SIDE);
    setCompB(EMPTY_SIDE);
  }

  const groupsQuery = useQuery({
    queryKey: ["price-comparison-groups-panel", draft.familia],
    queryFn: () =>
      fetchGroups({ familia: draft.familia, destino: ["especifico", "oficial_e_especifico"] }),
  });

  useEffect(() => {
    const next = emptyGroupDraft(familia);
    setDraft(next);
    resetSides(next.base_brand);
  }, [familia]);

  const canManage = !!isAdmin;

  async function ensureGroup(): Promise<ComparisonGroup> {
    if (group) return group;
    if (!draft.name.trim()) {
      toast.error("Informe o nome do estudo comparativo antes de adicionar comparações.");
      throw new Error("missing-name");
    }
    const created = await createGroup({
      name: draft.name.trim(),
      familia: draft.familia,
      categoria: draft.categoria,
      base_brand: draft.base_brand,
      base_price_table: effectiveBaseTable,
    });
    setGroup(created);
    return created;
  }

  async function handleAddComparison() {
    if (!baseSide.product || !compA.product) {
      toast.error("Selecione o produto base e o produto do concorrente.");
      return;
    }
    if (twoCompetitors && !compB.product) {
      toast.error("Selecione o produto do 2º concorrente ou desative a comparação com 2.");
      return;
    }
    const baseP = baseSide.product;
    const aP = compA.product;
    const bP = twoCompetitors ? compB.product : null;
    try {
      const g = await ensureGroup();
      const newItem = await addItem(g.id, {
        base_code: productCode(baseP),
        base_brand: baseP.marca,
        base_price: baseResolved.price,
        base_product_id: baseP.id,
        two_competitors: twoCompetitors,
        competitor_a_brand: aP.marca,
        competitor_a_code: productCode(aP),
        competitor_a_price: compAResolved.price,
        competitor_a_price_table: compAResolved.table,
        competitor_a_price_date: compAResolved.priceRow?.effective_date ?? null,
        competitor_a_region: compAResolved.priceRow?.region ?? null,
        competitor_a_source: compAResolved.priceRow?.source_file ?? null,
        competitor_a_product_id: aP.id,
        competitor_b_brand: bP ? bP.marca : null,
        competitor_b_code: bP ? productCode(bP) : null,
        competitor_b_price: bP ? compBResolved.price : null,
        competitor_b_price_table: bP ? compBResolved.table : null,
        competitor_b_price_date: bP ? (compBResolved.priceRow?.effective_date ?? null) : null,
        competitor_b_region: bP ? (compBResolved.priceRow?.region ?? null) : null,
        competitor_b_source: bP ? (compBResolved.priceRow?.source_file ?? null) : null,
        competitor_b_product_id: bP ? bP.id : null,
        specs_snapshot: {
          base: baseP.product.specs,
          competitor_a: aP.product.specs,
          competitor_b: bP ? bP.product.specs : undefined,
          price_meta: {
            base: metaOf(baseResolved),
            competitor_a: metaOf(compAResolved),
            ...(bP ? { competitor_b: metaOf(compBResolved) } : {}),
          },
        },
      } as never);
      setItems((prev) => [...prev, newItem]);
      setBaseSide((s) => ({ ...EMPTY_SIDE, brand: s.brand }));
      setCompA((s) => ({ ...EMPTY_SIDE, brand: s.brand }));
      setCompB((s) => ({ ...EMPTY_SIDE, brand: s.brand }));
      toast.success("Comparação adicionada ao grupo.");
    } catch (e) {
      if ((e as Error).message !== "missing-name") {
        toast.error("Não foi possível adicionar a comparação.");

        console.error(e);
      }
    }
  }

  function patchItemLocal(id: string, patch: Partial<ComparisonGroupItem>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }

  async function handleItemChange(id: string, patch: Partial<ComparisonGroupItem>) {
    patchItemLocal(id, patch);
    try {
      await updateItem(id, patch, group?.id);
    } catch (e) {
      toast.error("Falha ao salvar alteração da linha.");

      console.error(e);
    }
  }

  async function handleRemoveItem(id: string) {
    if (!group) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
    try {
      await removeItem(id, group.id);
    } catch (e) {
      toast.error("Falha ao remover a linha.");

      console.error(e);
    }
  }

  async function handleDuplicateItem(item: ComparisonGroupItem) {
    if (!group) return;
    const {
      id: _id,
      company_id: _c,
      group_id: _g,
      created_at: _ca,
      updated_at: _ua,
      created_by: _cb,
      is_deleted: _d,
      position: _p,
      ...rest
    } = item;
    const copy = await addItem(group.id, rest as never);
    setItems((prev) => [...prev, copy]);
  }

  async function handleFinalize() {
    if (!group) {
      toast.error("Adicione ao menos uma comparação antes de finalizar o grupo.");
      return;
    }
    if (items.length === 0) {
      toast.error("O grupo precisa de pelo menos uma comparação para ser finalizado.");
      return;
    }
    const updated = await finalizeGroup(group.id);
    setGroup(updated);
    toast.success("Grupo finalizado. Agora você pode salvá-lo.");
  }

  async function openSaveDialog(mode: "oficial" | "especifico" | "oficial_e_especifico") {
    if (!group) return;
    setSaveMode(mode);
    if (mode !== "especifico") {
      const found = await checkOfficialConflicts(group, items);
      setConflicts(found);
      if (found.length > 0) {
        setConflictConfirmOpen(true);
        return;
      }
    }
    setSaveDialogOpen(true);
  }

  async function confirmSave() {
    if (!group) return;
    setSaving(true);
    try {
      if (saveMode === "especifico") {
        const updated = await saveAsSpecific(group.id);
        setGroup(updated);
        toast.success("Comparativo salvo como específico.");
      } else {
        const updated = await saveAsOfficial({
          groupId: group.id,
          alsoSpecific: saveMode === "oficial_e_especifico",
          replaceConflicts: true,
        });
        setGroup(updated);
        toast.success("Comparativo salvo como oficial.");
        setReportPromptOpen(true);
      }
      queryClient.invalidateQueries({ queryKey: ["price-comparison-groups-panel"] });
      setSaveDialogOpen(false);
      setConflictConfirmOpen(false);
    } catch (e) {
      toast.error("Falha ao salvar o comparativo.");

      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  function handleNewGroup() {
    setGroup(null);
    setItems([]);
    const next = emptyGroupDraft(familia);
    setDraft(next);
    resetSides(next.base_brand);
  }

  async function handleOpenSaved(g: ComparisonGroup) {
    const { group: full } = await fetchGroup(g.id);
    if (!full) return;
    setFamilia(full.familia);
    setDraft({
      name: full.name,
      familia: full.familia,
      categoria: full.categoria,
      base_brand: full.base_brand,
      base_price_table: full.base_price_table,
    });
    setGroup(full);
    setItems(await fetchGroupItems(full.id));
  }

  async function handleDuplicateGroup(g: ComparisonGroup) {
    const name = window.prompt("Nome do novo estudo:", `${g.name} (cópia)`);
    if (!name) return;
    const copy = await duplicateGroup(g.id, name);
    toast.success("Estudo duplicado. Você já pode editá-lo.");
    await handleOpenSaved(copy);
    queryClient.invalidateQueries({ queryKey: ["price-comparison-groups-panel"] });
  }

  async function handleRenameGroup(g: ComparisonGroup) {
    const name = window.prompt("Novo nome do estudo:", g.name);
    if (!name || name === g.name) return;
    await updateGroup(g.id, { name });
    queryClient.invalidateQueries({ queryKey: ["price-comparison-groups-panel"] });
    if (group?.id === g.id) setGroup((prev) => (prev ? { ...prev, name } : prev));
  }

  async function handleDeleteGroup(g: ComparisonGroup) {
    if (!window.confirm(`Excluir o estudo "${g.name}"? Esta ação não pode ser desfeita.`)) return;
    await softDeleteGroup(g.id);
    queryClient.invalidateQueries({ queryKey: ["price-comparison-groups-panel"] });
    if (group?.id === g.id) handleNewGroup();
  }

  async function handleReportFor(g: ComparisonGroup) {
    const groupItems = g.id === group?.id ? items : await fetchGroupItems(g.id);
    exportComparisonGroupPdf(g, groupItems);
  }

  function openSubstituteFor(scope: "item" | "group", itemId?: string, fromBrand?: string) {
    setSubstituteScope(scope);
    setSubstituteItemId(itemId ?? null);
    setSubstituteFrom(fromBrand ?? "");
    setSubstituteTo("");
    setSubstituteOpen(true);
  }

  async function confirmSubstitute() {
    if (!group || !substituteFrom.trim() || !substituteTo.trim()) return;
    await substituteCompetitor({
      groupId: group.id,
      fromBrand: substituteFrom.trim(),
      toBrand: substituteTo.trim(),
      scope: substituteScope,
      itemId: substituteItemId ?? undefined,
    });
    setItems(await fetchGroupItems(group.id));
    setSubstituteOpen(false);
    toast.success("Competidor substituído. Revise os códigos/preços destacados.");
  }

  const isReadOnly = group?.status === "finalizado" && group.is_official && !canManage;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Validação de Comparáveis</h1>
          <p className="text-sm text-muted-foreground">
            Defina relações entre seus códigos e os códigos dos competidores, com opção de salvar
            como oficial ou como estudo específico.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 space-y-4 min-w-0">
            {/* Filtros e contexto do estudo */}
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="space-y-1">
                  <Label className="text-xs">Família</Label>
                  <Select
                    value={familia}
                    onValueChange={(v) => {
                      if (group) {
                        toast.error("Finalize/limpe o estudo atual antes de trocar de família.");
                        return;
                      }
                      setFamilia(v);
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FAMILIAS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <Select
                    value={draft.categoria ?? undefined}
                    onValueChange={(v) => setDraft((d) => ({ ...d, categoria: v }))}
                    disabled={!!group}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Tipo de produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {(CATEGORIAS[draft.familia] ?? []).map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Marca base</Label>
                  <Select
                    value={draft.base_brand || undefined}
                    onValueChange={(v) => {
                      setDraft((d) => ({ ...d, base_brand: v, base_price_table: null }));
                      setBaseSide({ ...EMPTY_SIDE, brand: v });
                    }}
                    disabled={!!group}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Marca base" />
                    </SelectTrigger>
                    <SelectContent>
                      {baseBrandOptions.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tabela base da marca</Label>
                  <Select
                    value={effectiveBaseTable ?? undefined}
                    onValueChange={(v) => setDraft((d) => ({ ...d, base_price_table: v }))}
                    disabled={!!group || baseTables.length === 0}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue
                        placeholder={
                          baseTables.length === 0
                            ? "Definida pelo preço do produto"
                            : "Selecione a tabela"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {baseTables.map((t) => (
                        <SelectItem key={t.key} value={t.key}>
                          {t.label}
                          {t.date
                            ? ` · ${new Date(t.date).toLocaleDateString("pt-BR", { timeZone: "UTC" })}`
                            : ""}
                          {t.categoria ? ` · ${t.categoria}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nome do estudo comparativo</Label>
                  <Input
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                    disabled={!!group}
                    placeholder="Ex.: Studio x Stella | Linha 24V"
                    className="h-9"
                  />
                </div>
              </div>
              {group && (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Editando <span className="font-medium text-foreground">{group.name}</span>
                    {group.is_official && " · comparativo oficial"}
                  </p>
                  <Button variant="ghost" size="sm" onClick={handleNewGroup}>
                    Novo estudo
                  </Button>
                </div>
              )}
            </div>

            {/* Adição de comparáveis */}
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Adicionar comparação</p>
                <div className="flex items-center gap-2">
                  <Label htmlFor="two-competitors" className="text-xs text-muted-foreground">
                    Comparar com 2 competidores
                  </Label>
                  <Switch
                    id="two-competitors"
                    checked={twoCompetitors}
                    onCheckedChange={setTwoCompetitors}
                  />
                </div>
              </div>
              <div className={`grid gap-3 ${twoCompetitors ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
                <ComparisonSidePicker
                  title="Produto base"
                  familia={draft.familia}
                  categoria={draft.categoria}
                  brandOptions={baseBrandOptions}
                  brandLocked
                  fixedTable={effectiveBaseTable}
                  value={baseSide}
                  resolved={baseResolved}
                  onChange={setBaseSide}
                />
                <ComparisonSidePicker
                  title="Produto concorrente"
                  familia={draft.familia}
                  categoria={draft.categoria}
                  brandOptions={brandsQuery.data?.competitors ?? []}
                  value={compA}
                  resolved={compAResolved}
                  onChange={setCompA}
                />
                {twoCompetitors && (
                  <ComparisonSidePicker
                    title="2º concorrente"
                    familia={draft.familia}
                    categoria={draft.categoria}
                    brandOptions={brandsQuery.data?.competitors ?? []}
                    value={compB}
                    resolved={compBResolved}
                    onChange={setCompB}
                  />
                )}
              </div>
              <OfficialEquivalenceCheck
                base={baseSide.product}
                competitor={compA.product}
                canManage={canManage}
              />
              <Button onClick={handleAddComparison} size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" /> Adicionar comparação
              </Button>
            </div>

            {/* Grupo de comparação */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">
                  Comparações do estudo{" "}
                  <span className="text-muted-foreground">· {items.length} itens</span>
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleFinalize}
                    disabled={!group || items.length === 0}
                  >
                    Finalizar grupo
                  </Button>
                  <Button
                    size="sm"
                    disabled={!group || group.status !== "finalizado"}
                    onClick={() => setSaveDialogOpen(true)}
                  >
                    Salvar grupo
                  </Button>
                </div>
              </div>
              <div className="space-y-3">
                {items.map((item) => (
                  <ComparisonRowCard
                    key={item.id}
                    item={item}
                    familia={draft.familia}
                    readOnly={isReadOnly}
                    onChange={(patch) => handleItemChange(item.id, patch)}
                    onRemove={() => handleRemoveItem(item.id)}
                    onDuplicate={() => handleDuplicateItem(item)}
                    onSubstituteA={() =>
                      openSubstituteFor("item", item.id, item.competitor_a_brand)
                    }
                    onSubstituteB={() =>
                      openSubstituteFor("item", item.id, item.competitor_b_brand ?? "")
                    }
                  />
                ))}
                {items.length === 0 && (
                  <p className="text-sm text-muted-foreground py-6 text-center border rounded-xl border-dashed">
                    Nenhuma comparação adicionada ainda.
                  </p>
                )}
              </div>
            </div>
          </div>

          <SpecificComparativesPanel
            groups={groupsQuery.data?.groups ?? []}
            itemCounts={{}}
            onOpen={handleOpenSaved}
            onEdit={handleOpenSaved}
            onDuplicate={handleDuplicateGroup}
            onSubstitute={(g) => {
              void handleOpenSaved(g).then(() => openSubstituteFor("group"));
            }}
            onReport={handleReportFor}
            onSaveOfficial={(g) => {
              void handleOpenSaved(g).then(() => openSaveDialog("oficial"));
            }}
            onRename={handleRenameGroup}
            onDelete={handleDeleteGroup}
            canManage={canManage}
          />
        </div>

        {/* Salvar grupo */}
        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Salvar comparativo</DialogTitle>
              <DialogDescription>
                Escolha como este grupo finalizado deve ser salvo.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => openSaveDialog("especifico")}
              >
                Salvar grupo como comparativo específico
              </Button>
              {canManage && (
                <>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => openSaveDialog("oficial")}
                  >
                    Salvar grupo como comparativo oficial
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => openSaveDialog("oficial_e_especifico")}
                  >
                    Salvar como oficial + gerar comparativo específico
                  </Button>
                </>
              )}
            </div>
            {saveMode && (
              <DialogFooter>
                <Button variant="ghost" onClick={() => setSaveDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={confirmSave} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />} Confirmar
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>

        {/* Conflito com comparação oficial existente */}
        <Dialog open={conflictConfirmOpen} onOpenChange={setConflictConfirmOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Comparativo oficial já existe</DialogTitle>
              <DialogDescription>
                Você está substituindo uma comparação oficial existente por uma nova relação entre
                códigos.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {conflicts.map((c, i) => (
                <div key={i} className="rounded-lg border p-2 text-sm">
                  <p className="text-muted-foreground text-xs">Comparação nova</p>
                  <p>
                    {c.baseLabel} × {c.competitorLabel}
                  </p>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setConflictConfirmOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => {
                  setConflictConfirmOpen(false);
                  setSaveDialogOpen(true);
                }}
              >
                Substituir e salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Gerar relatório após salvar como oficial */}
        <Dialog open={reportPromptOpen} onOpenChange={setReportPromptOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Gerar relatório específico destes itens também?</DialogTitle>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setReportPromptOpen(false)}>
                Agora não
              </Button>
              <Button
                onClick={() => {
                  if (group) exportComparisonGroupPdf(group, items);
                  setReportPromptOpen(false);
                }}
              >
                Gerar relatório
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Substituir competidor */}
        <Dialog open={substituteOpen} onOpenChange={setSubstituteOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Substituir competidor</DialogTitle>
              <DialogDescription>
                {substituteScope === "item"
                  ? "Somente esta comparação será atualizada."
                  : "Todas as comparações deste competidor no grupo serão atualizadas."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Marca concorrente atual</Label>
                <Input value={substituteFrom} onChange={(e) => setSubstituteFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Novo concorrente</Label>
                <Input value={substituteTo} onChange={(e) => setSubstituteTo(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setSubstituteOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={confirmSubstitute}>Substituir</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
