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
import { CodeAutocompleteInput } from "@/components/price-comparison-groups/CodeAutocompleteInput";
import { SpecificComparativesPanel } from "@/components/price-comparison-groups/SpecificComparativesPanel";
import type { LoadedProduct } from "@/lib/price-comparativos-data";

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
    base_brand: cfg.baseBrand,
    base_price_table: cfg.tabelasBase?.[0] ?? null,
  };
}

type NewComparisonForm = {
  baseCode: string;
  baseBrand: string;
  basePrice: string;
  competitorABrand: string;
  competitorACode: string;
  competitorAPrice: string;
  competitorATable: string;
  twoCompetitors: boolean;
  competitorBBrand: string;
  competitorBCode: string;
  competitorBPrice: string;
  competitorBTable: string;
};

function emptyComparisonForm(baseBrand: string): NewComparisonForm {
  return {
    baseCode: "",
    baseBrand,
    basePrice: "",
    competitorABrand: "",
    competitorACode: "",
    competitorAPrice: "",
    competitorATable: "",
    twoCompetitors: false,
    competitorBBrand: "",
    competitorBCode: "",
    competitorBPrice: "",
    competitorBTable: "",
  };
}

function ValidacaoComparaveisPage() {
  const isAdmin = useIsMasterAdmin();
  const queryClient = useQueryClient();

  const [familia, setFamilia] = useState<string>(FAMILIAS[0]);
  const [group, setGroup] = useState<ComparisonGroup | null>(null);
  const [draft, setDraft] = useState(emptyGroupDraft(FAMILIAS[0]));
  const [items, setItems] = useState<ComparisonGroupItem[]>([]);
  const [form, setForm] = useState<NewComparisonForm>(emptyComparisonForm(draft.base_brand));
  const [selectedBase, setSelectedBase] = useState<LoadedProduct | null>(null);
  const [selectedCompA, setSelectedCompA] = useState<LoadedProduct | null>(null);
  const [selectedCompB, setSelectedCompB] = useState<LoadedProduct | null>(null);
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

  const cfg = useMemo(() => getFamilyConfig(draft.familia), [draft.familia]);

  const groupsQuery = useQuery({
    queryKey: ["price-comparison-groups-panel", draft.familia],
    queryFn: () =>
      fetchGroups({ familia: draft.familia, destino: ["especifico", "oficial_e_especifico"] }),
  });

  useEffect(() => {
    setDraft(emptyGroupDraft(familia));
    setForm(emptyComparisonForm(getFamilyConfig(familia).baseBrand));
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
      base_price_table: draft.base_price_table,
    });
    setGroup(created);
    return created;
  }

  async function handleAddComparison() {
    if (!form.baseCode.trim() || !form.competitorACode.trim()) {
      toast.error("Informe pelo menos o código base e o código do concorrente.");
      return;
    }
    try {
      const g = await ensureGroup();
      const newItem = await addItem(g.id, {
        base_code: form.baseCode.trim(),
        base_brand: form.baseBrand.trim() || draft.base_brand,
        base_price: form.basePrice ? Number(form.basePrice) : null,
        base_product_id: selectedBase?.id ?? null,
        two_competitors: form.twoCompetitors,
        competitor_a_brand: form.competitorABrand.trim(),
        competitor_a_code: form.competitorACode.trim(),
        competitor_a_price: form.competitorAPrice ? Number(form.competitorAPrice) : null,
        competitor_a_price_table: form.competitorATable.trim() || null,
        competitor_a_product_id: selectedCompA?.id ?? null,
        competitor_b_brand: form.twoCompetitors ? form.competitorBBrand.trim() || null : null,
        competitor_b_code: form.twoCompetitors ? form.competitorBCode.trim() || null : null,
        competitor_b_price:
          form.twoCompetitors && form.competitorBPrice ? Number(form.competitorBPrice) : null,
        competitor_b_price_table: form.twoCompetitors ? form.competitorBTable.trim() || null : null,
        competitor_b_product_id: form.twoCompetitors ? (selectedCompB?.id ?? null) : null,
        specs_snapshot: {
          base: selectedBase?.product.specs,
          competitor_a: selectedCompA?.product.specs,
          competitor_b: form.twoCompetitors ? selectedCompB?.product.specs : undefined,
        },
      } as never);
      setItems((prev) => [...prev, newItem]);
      setForm(emptyComparisonForm(draft.base_brand));
      setSelectedBase(null);
      setSelectedCompA(null);
      setSelectedCompB(null);
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
    setDraft(emptyGroupDraft(familia));
    setForm(emptyComparisonForm(getFamilyConfig(familia).baseBrand));
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
                  <Input
                    value={draft.base_brand}
                    onChange={(e) => setDraft((d) => ({ ...d, base_brand: e.target.value }))}
                    disabled={!!group}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tabela base da marca</Label>
                  {cfg.tabelasBase?.length ? (
                    <Select
                      value={draft.base_price_table ?? undefined}
                      onValueChange={(v) => setDraft((d) => ({ ...d, base_price_table: v }))}
                      disabled={!!group}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Tabela" />
                      </SelectTrigger>
                      <SelectContent>
                        {cfg.tabelasBase.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={draft.base_price_table ?? ""}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, base_price_table: e.target.value }))
                      }
                      disabled={!!group}
                      className="h-9"
                      placeholder="Tabela base"
                    />
                  )}
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
                    checked={form.twoCompetitors}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, twoCompetitors: v }))}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-xs">Seu código</Label>
                  <CodeAutocompleteInput
                    value={form.baseCode}
                    onChange={(v) => setForm((f) => ({ ...f, baseCode: v }))}
                    onSelectProduct={(p) => {
                      setSelectedBase(p);
                      setForm((f) => ({
                        ...f,
                        baseBrand: p.marca,
                        basePrice:
                          p.priceRow?.price != null ? String(p.priceRow.price) : f.basePrice,
                      }));
                    }}
                    familia={draft.familia}
                    categoria={draft.categoria}
                    marca={draft.base_brand}
                    placeholder={`Código ${draft.base_brand}`}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Preço base</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.basePrice}
                    onChange={(e) => setForm((f) => ({ ...f, basePrice: e.target.value }))}
                    placeholder="R$/m"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Marca do competidor</Label>
                  <Input
                    value={form.competitorABrand}
                    onChange={(e) => setForm((f) => ({ ...f, competitorABrand: e.target.value }))}
                    placeholder="Ex.: Stella"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Código do competidor</Label>
                  <CodeAutocompleteInput
                    value={form.competitorACode}
                    onChange={(v) => setForm((f) => ({ ...f, competitorACode: v }))}
                    onSelectProduct={(p) => {
                      setSelectedCompA(p);
                      setForm((f) => ({
                        ...f,
                        competitorABrand: p.marca,
                        competitorAPrice:
                          p.priceRow?.price != null ? String(p.priceRow.price) : f.competitorAPrice,
                      }));
                    }}
                    familia={draft.familia}
                    categoria={draft.categoria}
                    marca={form.competitorABrand || undefined}
                    placeholder="Código concorrente"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Preço concorrente</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.competitorAPrice}
                    onChange={(e) => setForm((f) => ({ ...f, competitorAPrice: e.target.value }))}
                    placeholder="R$/m"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tabela do competidor</Label>
                  <Input
                    value={form.competitorATable}
                    onChange={(e) => setForm((f) => ({ ...f, competitorATable: e.target.value }))}
                    placeholder="Ex.: Stella Abril/2026"
                    className="h-9"
                  />
                </div>
                {form.twoCompetitors && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Marca do 2º competidor</Label>
                      <Input
                        value={form.competitorBBrand}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, competitorBBrand: e.target.value }))
                        }
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Código do 2º competidor</Label>
                      <CodeAutocompleteInput
                        value={form.competitorBCode}
                        onChange={(v) => setForm((f) => ({ ...f, competitorBCode: v }))}
                        onSelectProduct={(p) => {
                          setSelectedCompB(p);
                          setForm((f) => ({
                            ...f,
                            competitorBBrand: p.marca,
                            competitorBPrice:
                              p.priceRow?.price != null
                                ? String(p.priceRow.price)
                                : f.competitorBPrice,
                          }));
                        }}
                        familia={draft.familia}
                        categoria={draft.categoria}
                        marca={form.competitorBBrand || undefined}
                        placeholder="Código do 2º concorrente"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Preço do 2º competidor</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={form.competitorBPrice}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, competitorBPrice: e.target.value }))
                        }
                        className="h-9"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Tabela do 2º competidor</Label>
                      <Input
                        value={form.competitorBTable}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, competitorBTable: e.target.value }))
                        }
                        className="h-9"
                      />
                    </div>
                  </>
                )}
              </div>
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
