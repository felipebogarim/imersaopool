// Price › Comparativos Específicos (item 16 do pedido) — biblioteca de
// estudos salvos (destino "específico" ou "oficial_e_especifico"), em cards,
// não em tabelão. Abrir leva de volta para Validação de Comparáveis.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useIsMasterAdmin } from "@/hooks/use-is-admin";
import { FAMILIAS } from "@/lib/price-comparativos-core";
import {
  duplicateGroup,
  fetchGroupItems,
  fetchGroups,
  softDeleteGroup,
  updateGroup,
  type ComparisonGroup,
} from "@/lib/price-comparison-groups";
import { exportComparisonGroupPdf } from "@/lib/price-comparison-groups-pdf";
import { ComparativeCard } from "@/components/price-comparison-groups/ComparativeCard";

export const Route = createFileRoute("/_authenticated/price/comparativos-especificos")({
  head: () => ({ meta: [{ title: "Painel Price — PoolFlux" }] }),
  component: ComparativosEspecificosPage,
});

function ComparativosEspecificosPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isAdmin = useIsMasterAdmin();
  const [familia, setFamilia] = useState<string>("");
  const [busca, setBusca] = useState("");

  const groupsQuery = useQuery({
    queryKey: ["price-comparison-groups-library", familia],
    queryFn: () =>
      fetchGroups({
        familia: familia || undefined,
        destino: ["especifico", "oficial_e_especifico"],
      }),
  });

  const groups = groupsQuery.data?.groups;
  const filtered = useMemo(() => {
    const list = groups ?? [];
    const q = busca.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (g) => g.name.toLowerCase().includes(q) || g.base_brand.toLowerCase().includes(q),
    );
  }, [groups, busca]);

  function openInValidation(_g: ComparisonGroup) {
    void navigate({ to: "/price/validacao" });
  }

  async function handleDuplicate(g: ComparisonGroup) {
    const name = window.prompt("Nome do novo estudo:", `${g.name} (cópia)`);
    if (!name) return;
    await duplicateGroup(g.id, name);
    toast.success("Estudo duplicado.");
    queryClient.invalidateQueries({ queryKey: ["price-comparison-groups-library"] });
  }

  async function handleRename(g: ComparisonGroup) {
    const name = window.prompt("Novo nome do estudo:", g.name);
    if (!name || name === g.name) return;
    await updateGroup(g.id, { name });
    queryClient.invalidateQueries({ queryKey: ["price-comparison-groups-library"] });
  }

  async function handleDelete(g: ComparisonGroup) {
    if (!window.confirm(`Excluir o estudo "${g.name}"? Esta ação não pode ser desfeita.`)) return;
    await softDeleteGroup(g.id);
    queryClient.invalidateQueries({ queryKey: ["price-comparison-groups-library"] });
  }

  async function handleReport(g: ComparisonGroup) {
    const items = await fetchGroupItems(g.id);
    exportComparisonGroupPdf(g, items);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Painel Price</h1>
        <p className="text-sm text-muted-foreground">
          Estudos comparativos salvos, sem alterar a base oficial. Abra um estudo para editar em
          Validação de Comparáveis.
        </p>
      </div>

      {!groupsQuery.data?.schemaAvailable && !groupsQuery.isLoading && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-800 dark:text-amber-300">
          A estrutura de Grupos de Comparação ainda não foi aplicada no banco de dados desta
          empresa. Peça para um administrador aplicar a migration
          <code className="mx-1">20260928200026_price_comparison_groups.sql</code>.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Select
          value={familia || "__all__"}
          onValueChange={(v) => setFamilia(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="h-9 w-48">
            <SelectValue placeholder="Todas as famílias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas as famílias</SelectItem>
            {FAMILIAS.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome ou marca base…"
          className="h-9 w-64"
        />
      </div>

      {filtered.length === 0 && !groupsQuery.isLoading && (
        <p className="text-sm text-muted-foreground py-10 text-center border rounded-xl border-dashed">
          Nenhum comparativo específico salvo ainda.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((g) => (
          <ComparativeCard
            key={g.id}
            group={g}
            itemCount={0}
            onOpen={() => openInValidation(g)}
            onEdit={() => openInValidation(g)}
            onDuplicate={() => handleDuplicate(g)}
            onSubstitute={() => openInValidation(g)}
            onReport={() => handleReport(g)}
            onSaveOfficial={() => openInValidation(g)}
            onRename={() => handleRename(g)}
            onDelete={() => handleDelete(g)}
            canManage={!!isAdmin}
          />
        ))}
      </div>
    </div>
  );
}
