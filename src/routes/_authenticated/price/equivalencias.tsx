// Price › Pricing › Equivalências — base oficial de equivalências (Newline/Standard/Studio × concorrentes).
// Lê public.price_equivalences; sugestões do sistema ficam pendentes até serem validadas.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ReplaceEquivalenceDialog } from "@/components/price-equivalences/ReplaceEquivalenceDialog";
import { useIsMasterAdmin } from "@/hooks/use-is-admin";
import { supabase } from "@/integrations/supabase/client";
import { attributesFor } from "@/lib/price-comparativos-core";
import {
  fetchRules,
  type LoadedProduct,
  fetchProducts,
  loadCatalogProducts,
} from "@/lib/price-comparativos-data";
import {
  BASE_COMPANIES,
  ORIGIN_LABEL,
  RELATION_STATUS_CLASS,
  RELATION_STATUS_LABEL,
  buildSuggestions,
  fetchEquivalenceOverview,
  mainSpecs,
  productCodeOf,
  saveSuggestions,
  setRelationStatus,
  type DisplayStatus,
  type EquivalenceOverviewRow,
  type EquivalenceRelation,
} from "@/lib/price-equivalences-official";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/price/equivalencias")({
  head: () => ({ meta: [{ title: "Equivalências — PoolFlux" }] }),
  component: EquivalenciasPage,
});

const ALL = "todas";

function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function SpecList({ product }: { product: LoadedProduct }) {
  const specs = mainSpecs(product);
  if (!specs.length)
    return <p className="text-xs text-muted-foreground">Sem características cadastradas</p>;
  return (
    <ul className="text-xs text-muted-foreground space-y-0.5">
      {specs.map((s) => (
        <li key={s.label}>
          <span className="font-medium text-foreground">{s.label}:</span> {s.value}
        </li>
      ))}
    </ul>
  );
}

function EquivalenciasPage() {
  const isAdmin = useIsMasterAdmin();
  const qc = useQueryClient();
  const [company, setCompany] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [busca, setBusca] = useState("");
  const debounced = useDebounced(busca);
  const [replace, setReplace] = useState<{
    base: LoadedProduct;
    relation: EquivalenceRelation | null;
  } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const overview = useQuery({
    queryKey: ["price-equivalences-overview", company, debounced],
    queryFn: () =>
      fetchEquivalenceOverview({ company: company === ALL ? null : company, busca: debounced }),
  });

  const people = useQuery({
    queryKey: ["price-equivalences-people", overview.data?.length ?? 0],
    enabled: !!overview.data?.length,
    queryFn: async () => {
      const ids = new Set<string>();
      for (const r of overview.data ?? [])
        for (const rel of r.relations) {
          if (rel.equivalence.validated_by) ids.add(rel.equivalence.validated_by);
          if (rel.equivalence.created_by) ids.add(rel.equivalence.created_by);
        }
      if (!ids.size) return {} as Record<string, string>;
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", Array.from(ids));
      return Object.fromEntries(
        (data ?? []).map((p) => [p.id, p.full_name || p.email || "—"]),
      ) as Record<string, string>;
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["price-equivalences-overview"] });

  const rows = useMemo(() => {
    const data = overview.data ?? [];
    if (statusFilter === ALL) return data;
    return data.filter((r) => {
      if (statusFilter === "sem_equivalencia")
        return !r.relations.some((x) => x.equivalence.relation_status !== "rejeitada");
      return r.relations.some((x) => x.equivalence.relation_status === statusFilter);
    });
  }, [overview.data, statusFilter]);

  async function act(id: string, fn: () => Promise<void>, ok: string) {
    setBusy(id);
    try {
      await fn();
      toast.success(ok);
      await refresh();
    } catch (e) {
      console.error(e);
      toast.error("Ação não concluída. Verifique se você é administrador.");
    } finally {
      setBusy(null);
    }
  }

  async function suggest(row: EquivalenceOverviewRow) {
    await act(
      row.base.id,
      async () => {
        const rules = await fetchRules(row.base.familia, row.base.categoria);
        const names = Object.fromEntries(
          attributesFor(row.base.categoria).map((a) => [a.key, a.name]),
        );
        const candidates = await loadCatalogProducts(
          await fetchProducts({
            familia: row.base.familia,
            categoria: row.base.categoria,
            limit: 1500,
          }),
        );
        const found = buildSuggestions(row.base, candidates, rules, names);
        const saved = await saveSuggestions(row.base.id, found);
        if (!saved) throw new Error("Nenhuma sugestão nova encontrada");
      },
      "Sugestões do sistema geradas.",
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Equivalências</h1>
        <p className="text-sm text-muted-foreground">
          Base oficial: qual produto de concorrente equivale a cada produto do grupo Newline.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={company} onValueChange={setCompany}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as empresas</SelectItem>
            {BASE_COMPANIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-56">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Pesquisar por código ou descrição"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os status</SelectItem>
            {(Object.keys(RELATION_STATUS_LABEL) as DisplayStatus[]).map((s) => (
              <SelectItem key={s} value={s}>
                {RELATION_STATUS_LABEL[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {overview.isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      )}
      {overview.error && (
        <p className="text-sm text-destructive">
          Não foi possível carregar. Se a migration 20260930120000 ainda não foi aplicada, aplique-a
          no Supabase.
        </p>
      )}
      {!overview.isLoading && !overview.error && rows.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum produto encontrado.</p>
      )}

      <div className="space-y-3">
        {rows.map((row) => {
          const active = row.relations.filter((r) => r.equivalence.relation_status !== "rejeitada");
          return (
            <div
              key={row.base.id}
              className="grid gap-4 rounded-lg border bg-card p-4 md:grid-cols-2"
            >
              <div className="space-y-1">
                <Badge variant="outline">{row.base.marca}</Badge>
                <p className="font-mono text-sm font-semibold">{productCodeOf(row.base)}</p>
                <p className="text-sm">{row.base.nome}</p>
                <SpecList product={row.base} />
              </div>
              <div className="space-y-3">
                {row.relations.length === 0 && (
                  <div className="space-y-2">
                    <Badge variant="outline" className={cn(RELATION_STATUS_CLASS.sem_equivalencia)}>
                      {RELATION_STATUS_LABEL.sem_equivalencia}
                    </Badge>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link to="/price/validacao">Definir em Validação de Comparáveis</Link>
                      </Button>
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy === row.base.id}
                          onClick={() => suggest(row)}
                        >
                          <Sparkles className="mr-1 h-3.5 w-3.5" /> Sugerir
                        </Button>
                      )}
                    </div>
                  </div>
                )}
                {row.relations.map((rel) => {
                  const e = rel.equivalence;
                  const who = e.validated_by ?? e.created_by;
                  return (
                    <div key={e.id} className="space-y-1 rounded-md border p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{rel.competitor.marca}</Badge>
                        <span className="font-mono text-sm font-semibold">
                          {productCodeOf(rel.competitor)}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(RELATION_STATUS_CLASS[e.relation_status])}
                        >
                          {RELATION_STATUS_LABEL[e.relation_status]}
                        </Badge>
                        {e.technical_score != null && (
                          <span className="text-xs text-muted-foreground">
                            proximidade {Math.round(e.technical_score)}%
                          </span>
                        )}
                      </div>
                      <p className="text-sm">{rel.competitor.nome}</p>
                      <SpecList product={rel.competitor} />
                      <p className="text-xs text-muted-foreground">
                        Origem: {ORIGIN_LABEL[e.origin]} · Responsável:{" "}
                        {who ? (people.data?.[who] ?? "—") : "—"} · Validação:{" "}
                        {e.validated_at
                          ? new Date(e.validated_at).toLocaleDateString("pt-BR")
                          : "—"}
                      </p>
                      {e.validation_notes && (
                        <p className="text-xs italic text-muted-foreground">{e.validation_notes}</p>
                      )}
                      {isAdmin && (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {e.relation_status !== "validada" && (
                            <Button
                              size="sm"
                              disabled={busy === e.id}
                              onClick={() =>
                                act(
                                  e.id,
                                  () => setRelationStatus(e.id, "validada"),
                                  "Equivalência validada.",
                                )
                              }
                            >
                              Validar
                            </Button>
                          )}
                          {e.relation_status !== "rejeitada" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy === e.id}
                              onClick={() =>
                                act(
                                  e.id,
                                  () => setRelationStatus(e.id, "rejeitada"),
                                  "Equivalência rejeitada.",
                                )
                              }
                            >
                              Rejeitar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setReplace({ base: row.base, relation: rel })}
                          >
                            Editar / substituir
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {isAdmin && row.relations.length > 0 && active.length === 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setReplace({ base: row.base, relation: null })}
                  >
                    Definir nova equivalência
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {replace && (
        <ReplaceEquivalenceDialog
          open
          onOpenChange={(o) => !o && setReplace(null)}
          base={replace.base}
          replaceId={replace.relation?.equivalence.id ?? null}
          initialBrand={replace.relation?.competitor.marca ?? null}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
