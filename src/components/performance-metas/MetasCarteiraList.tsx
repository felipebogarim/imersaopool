// Listagem da carteira para a área Metas: espelho funcional do BI de Clientes
// (mesmas fontes de dados, mesmos filtros), com acesso ao painel individual.
// Somente leitura — usa percentuais e faróis já publicados, nunca valores em R$.

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Loader2, Mail, Search, Target, X } from "lucide-react";
import { MinimosCategoriaButton } from "./MinimosCategoriaDialog";
import { MinimosMassaButton } from "./MinimosMassaDialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { FAROL_CELL_CLASS, catBadge, statusFromRatio } from "@/lib/performance-farol";
import { sanitizeRatio } from "@/lib/performance-metrics";
import { METAS_FAMILIES, METAS_FAMILY_LABEL, fmtPct } from "@/lib/performance-metas";
import { isClientRow } from "@/lib/client-row-filter";
import { FilterChip } from "./FilterChip";
import { MultiFilter } from "./MetasBiTables";
import { useMetasCarteira } from "./use-metas-carteira";
import { ConviteMassaDialog } from "./ConviteMassaDialog";

const FILTERS_STORAGE_KEY = "metas_carteira_filters_v1";

type StoredFilters = {
  search?: string;
  repFilter?: string;
  categoryFilter?: string[];
  familyFilter?: string[];
  zeroFilter?: boolean;
  revisadoOnly?: boolean;
  ocultarInativos?: boolean;
  ocultarZero?: boolean;
};

function loadStoredFilters(): StoredFilters | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(FILTERS_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Slot ao lado das abas do topo onde a lista renderiza suas ações (ex.: mínimos em massa). */
export const METAS_ACOES_TOPO_ID = "metas-acoes-topo";

const ehInativo = (c: string | null | undefined) => /inativ/i.test(c ?? "");

export function MetasCarteiraList({
  restrictToRepIds,
}: {
  /** Quando definido, mostra apenas clientes desses representantes (visão do representante). */
  restrictToRepIds: string[] | null;
}) {
  const initialFilters = useMemo(() => loadStoredFilters(), []);

  const [search, setSearch] = useState(() => initialFilters?.search ?? "");
  const [repFilter, setRepFilter] = useState(() => initialFilters?.repFilter ?? "all");
  const [categoryFilter, setCategoryFilter] = useState<string[]>(
    () => initialFilters?.categoryFilter ?? [],
  );
  const [familyFilter, setFamilyFilter] = useState<string[]>(
    () => initialFilters?.familyFilter ?? [],
  );
  const [zeroFilter, setZeroFilter] = useState(() => initialFilters?.zeroFilter ?? false);
  const [revisadoOnly, setRevisadoOnly] = useState(() => initialFilters?.revisadoOnly ?? false);
  const [ocultarInativos, setOcultarInativos] = useState(
    () => initialFilters?.ocultarInativos ?? false,
  );
  const [ocultarZero, setOcultarZero] = useState(() => initialFilters?.ocultarZero ?? false);
  const [conviteMassa, setConviteMassa] = useState(false);
  // Slot das ações no topo (montado pela página, fora desta lista).
  const [acoesTopo, setAcoesTopo] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setAcoesTopo(document.getElementById(METAS_ACOES_TOPO_ID));
  }, []);

  // Mantém os filtros no sessionStorage para não perder o contexto ao navegar ou atualizar
  useEffect(() => {
    try {
      sessionStorage.setItem(
        FILTERS_STORAGE_KEY,
        JSON.stringify({
          search,
          repFilter,
          categoryFilter,
          familyFilter,
          zeroFilter,
          revisadoOnly,
          ocultarInativos,
          ocultarZero,
        }),
      );
    } catch {
      // sessionStorage indisponível
    }
  }, [
    search,
    repFilter,
    categoryFilter,
    familyFilter,
    zeroFilter,
    revisadoOnly,
    ocultarInativos,
    ocultarZero,
  ]);

  const { rows, visibleReps, isLoading } = useMetasCarteira(restrictToRepIds);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (!isClientRow(r)) return false;
      if (
        q &&
        !r.razao_social.toLowerCase().includes(q) &&
        !r.repName.toLowerCase().includes(q) &&
        !(r.categoria && r.categoria.toLowerCase().includes(q))
      )
        return false;
      if (repFilter !== "all" && r.repId !== repFilter) return false;
      if (categoryFilter.length && !(r.categoria && categoryFilter.includes(r.categoria.trim())))
        return false;
      if (
        familyFilter.length &&
        !familyFilter.some((f) => r.metasStatus[f] && r.metasStatus[f] !== "sem_compra")
      )
        return false;
      if (
        zeroFilter &&
        !((r.totalPct ?? 0) === 0 || Object.values(r.metasStatus).includes("sem_compra"))
      )
        return false;
      if (revisadoOnly && !r.revisadoCompleto) return false;
      if (ocultarInativos && ehInativo(r.categoria)) return false;
      // Ocultar 0%: clientes sem atingimento (0% ou sem dado) saem da lista.
      if (ocultarZero && !((r.totalPct ?? 0) > 0)) return false;
      return true;
    });
  }, [
    rows,
    search,
    repFilter,
    categoryFilter,
    familyFilter,
    zeroFilter,
    revisadoOnly,
    ocultarInativos,
    ocultarZero,
  ]);

  // Categorias presentes na carteira (Black, Gold, Silver primeiro; demais em ordem alfabética).
  const categoriaOptions = useMemo(() => {
    const set = new Set<string>(["Black", "Gold", "Silver"]);
    for (const r of rows) if (isClientRow(r) && r.categoria?.trim()) set.add(r.categoria.trim());
    const ordem = (c: string) => {
      const i = ["Black", "Gold", "Silver"].indexOf(c);
      return i < 0 ? 3 : i;
    };
    return [...set]
      .sort((a, b) => ordem(a) - ordem(b) || a.localeCompare(b, "pt-BR"))
      .map((c) => ({ key: c, label: c }));
  }, [rows]);
  const familiaOptions = useMemo(
    () => METAS_FAMILIES.map((f) => ({ key: f, label: METAS_FAMILY_LABEL[f] ?? f })),
    [],
  );

  // Convite em massa: sempre disponível na visão da gestão. Elegíveis = clientes do filtro atual
  // com representante e razão social (linhas "(vazio)" ficam de fora).
  const gestao = restrictToRepIds == null;
  const elegiveis = useMemo(
    () =>
      filtered
        .filter((r) => r.repId && r.razao_social?.trim())
        .map((r) => ({
          id: r.id,
          razao_social: r.razao_social.trim(),
          repId: r.repId as string,
          repName: r.repName,
        })),
    [filtered],
  );
  // Metas mínimas em massa: clientes com representante (toda a carteira ou o filtro atual).
  const paraMassa = (r: (typeof rows)[number]) => ({
    id: r.id,
    razao_social: r.razao_social,
    categoria: r.categoria,
    revisadoCompleto: r.revisadoCompleto,
  });
  const carteiraMassa = useMemo(
    () => rows.filter((r) => isClientRow(r) && r.repId && r.razao_social?.trim()).map(paraMassa),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows],
  );
  const filtradosMassa = useMemo(
    () => filtered.filter((r) => r.repId && r.razao_social?.trim()).map(paraMassa),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered],
  );
  const repsElegiveis = useMemo(() => new Set(elegiveis.map((c) => c.repId)).size, [elegiveis]);
  const repFiltrado =
    repFilter !== "all" ? (visibleReps.find((r) => r.id === repFilter) ?? null) : null;
  return (
    <div className="space-y-4 sm:space-y-6">
      {gestao && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <p className="text-sm">
            <span className="font-medium">
              {repFiltrado ? repFiltrado.nome : "Todos os representantes"}
            </span>
            <span className="text-muted-foreground">
              {" "}
              · {elegiveis.length} cliente(s)
              {repFiltrado ? "" : ` de ${repsElegiveis} representante(s)`} no filtro atual
            </span>
          </p>
          <Button
            size="sm"
            onClick={() => setConviteMassa(true)}
            disabled={isLoading || elegiveis.length === 0}
          >
            <Mail className="mr-1.5 h-4 w-4" />
            {repFiltrado ? "Enviar convite em massa ao rep" : "Enviar convite em massa"}
          </Button>
          <ConviteMassaDialog
            open={conviteMassa}
            onOpenChange={setConviteMassa}
            clientes={elegiveis}
            initialRepIds={repFiltrado ? [repFiltrado.id] : []}
          />
        </div>
      )}
      <div className="bg-card p-4 rounded-xl border border-border shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4 md:items-end">
          <div className="flex-1 min-w-0 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Pesquisar Cliente
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Razão Social ou palavra-chave..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="w-full md:w-64 md:shrink-0 space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Representante
            </label>
            <Select value={repFilter} onValueChange={setRepFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Representantes</SelectItem>
                {visibleReps.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-border/50">
          <MultiFilter
            label="Categoria"
            options={categoriaOptions}
            value={categoryFilter}
            onChange={setCategoryFilter}
          />
          <MultiFilter
            label="Portfólio"
            options={familiaOptions}
            value={familyFilter}
            onChange={setFamilyFilter}
          />
          <div className="w-px h-6 bg-border mx-1" />
          <FilterChip active={ocultarInativos} onClick={() => setOcultarInativos((p) => !p)}>
            Ocultar inativos
          </FilterChip>
          <FilterChip
            active={ocultarZero}
            onClick={() => {
              setOcultarZero((p) => !p);
              setZeroFilter(false);
            }}
          >
            Ocultar 0%
          </FilterChip>
          <Badge
            variant={zeroFilter ? "destructive" : "outline"}
            className={cn(
              "cursor-pointer px-3 py-1 text-[10px] uppercase font-bold tracking-tight",
              !zeroFilter && "hover:bg-destructive/10 text-destructive border-destructive/30",
            )}
            onClick={() => {
              setZeroFilter((z) => !z);
              setOcultarZero(false);
            }}
            title="Mostrar só clientes com 0%"
          >
            Só 0%
            {zeroFilter && <X className="ml-1.5 h-3 w-3 inline-block" />}
          </Badge>
          <div className="w-px h-6 bg-border mx-1" />
          <Badge
            variant={revisadoOnly ? "default" : "outline"}
            className={cn(
              "cursor-pointer px-2.5 py-1 text-[10px] uppercase font-bold tracking-tight gap-1",
              revisadoOnly
                ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                : "hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700",
            )}
            onClick={() => setRevisadoOnly((p) => !p)}
            title="Filtrar clientes com todas as metas revisadas pelo gestor"
          >
            <CheckCircle2 className="h-3 w-3 inline" />
            Revisados
            {revisadoOnly && <X className="ml-0.5 h-3 w-3 inline-block" />}
          </Badge>
          {gestao && (
            // Função (não filtro): estilo discreto, separada dos chips de filtro.
            <div className="flex items-center gap-0.5 border-l border-border pl-2">
              <MinimosCategoriaButton />
            </div>
          )}
          {gestao &&
            acoesTopo &&
            createPortal(
              <MinimosMassaButton
                todos={carteiraMassa}
                filtrados={filtradosMassa}
                disabled={isLoading}
              />,
              acoesTopo,
            )}
          {(categoryFilter.length > 0 ||
            familyFilter.length > 0 ||
            zeroFilter ||
            revisadoOnly ||
            ocultarInativos ||
            ocultarZero) && (
            <button
              onClick={() => {
                setCategoryFilter([]);
                setFamilyFilter([]);
                setZeroFilter(false);
                setRevisadoOnly(false);
                setOcultarInativos(false);
                setOcultarZero(false);
                try {
                  sessionStorage.removeItem(FILTERS_STORAGE_KEY);
                } catch {}
              }}
              className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-2 ml-auto"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      <div className="surface rounded-xl border border-border overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm text-left border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border text-[10px] uppercase tracking-tighter text-muted-foreground">
                <th className="px-3 sm:px-4 py-3 font-semibold w-40 sm:w-64 sticky left-0 bg-muted/50 z-10 border-r border-border/50">
                  Cliente
                </th>
                <th className="px-3 sm:px-4 py-3 font-semibold border-r border-border/50">Rep</th>
                <th className="px-2 sm:px-4 py-3 font-semibold border-r border-border/50 text-center">
                  Cat
                </th>
                <th
                  className="w-12 px-1 sm:px-2 py-3 font-semibold border-r border-border/50 text-center text-[10px]"
                  title="Status: metas revisadas pelo gestor · ⚠ cliente em investigação"
                >
                  <span className="sr-only">Revisado</span>
                  <CheckCircle2 className="h-3.5 w-3.5 mx-auto text-muted-foreground" />
                </th>
                <th className="px-2 sm:px-4 py-3 font-semibold border-r border-border/50 text-center">
                  Ating %
                </th>
                {METAS_FAMILIES.map((f) => (
                  <th
                    key={f}
                    className="px-3 py-3 font-semibold text-center min-w-[96px] border-r border-border/50"
                  >
                    {METAS_FAMILY_LABEL[f]}
                  </th>
                ))}
                <th className="px-3 py-3 font-semibold text-center">Metas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {isLoading ? (
                <tr>
                  <td colSpan={METAS_FAMILIES.length + 6} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <span>Carregando carteira...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={METAS_FAMILIES.length + 6}
                    className="px-4 py-12 text-center text-muted-foreground"
                  >
                    {restrictToRepIds && restrictToRepIds.length === 0
                      ? "Nenhum representante vinculado ao seu usuário."
                      : "Nenhum cliente encontrado para os filtros selecionados."}
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const totalStatus = statusFromRatio(row.totalPct);
                  return (
                    <tr key={row.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-3 sm:px-4 py-2.5 font-medium sticky left-0 bg-background group-hover:bg-muted/30 z-10 border-r border-border/50">
                        <Link
                          to="/performance/metas/$rowId"
                          params={{ rowId: row.id }}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block truncate max-w-[150px] sm:max-w-[240px] hover:text-primary hover:underline underline-offset-2"
                          title={`${row.razao_social} (abrir em nova janela)`}
                        >
                          {row.razao_social}
                        </Link>
                      </td>
                      <td className="px-3 sm:px-4 py-2.5 text-xs text-muted-foreground border-r border-border/50 whitespace-nowrap">
                        {row.repName}
                      </td>
                      <td className="px-2 sm:px-4 py-2.5 text-center border-r border-border/50">
                        {row.categoria ? (
                          <span
                            className={cn(
                              "inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap",
                              catBadge(row.categoria),
                            )}
                          >
                            {row.categoria}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td
                        className="w-12 px-1 sm:px-2 py-2.5 text-center border-r border-border/50"
                        title={
                          (row.emInvestigacao
                            ? "Em investigação: aberto processo de investigação mais detalhada sobre o cliente antes de definir a meta. "
                            : "") +
                          (row.revisadoCompleto
                            ? "Metas de todas as categorias revisadas e salvas pelo gestor (7/7)"
                            : row.metasEmMassaCount > 0
                              ? `${row.metasEmMassaCount} meta(s) mínima(s) aplicada(s) em massa, aguardando revisão` +
                                (row.metasSalvasCount > 0
                                  ? ` · ${row.metasSalvasCount} revisada(s) pelo gestor`
                                  : "")
                              : row.metasSalvasCount > 0
                                ? `${row.metasSalvasCount} de 7 categorias revisadas pelo gestor`
                                : "Nenhuma meta revisada pelo gestor")
                        }
                      >
                        <span className="inline-flex items-center justify-center gap-1">
                          {row.emInvestigacao && (
                            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              <span className="sr-only">Em investigação</span>
                            </span>
                          )}
                          {row.revisadoCompleto ? (
                            <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mx-auto">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            </span>
                          ) : row.metasEmMassaCount > 0 ? (
                            <span className="inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-sky-500/15 px-1 text-[9px] font-extrabold tracking-tight text-sky-600 dark:text-sky-400 mx-auto">
                              IA
                            </span>
                          ) : row.metasSalvasCount > 0 ? (
                            <span className="text-[10px] font-mono text-muted-foreground/80">
                              {row.metasSalvasCount}/7
                            </span>
                          ) : row.emInvestigacao ? null : (
                            <span className="text-muted-foreground/30 text-xs">—</span>
                          )}
                        </span>
                      </td>
                      <td
                        className={cn(
                          "px-2 sm:px-4 py-2.5 text-center font-bold border-r border-border/50 tabular-nums whitespace-nowrap",
                          totalStatus && FAROL_CELL_CLASS[totalStatus],
                        )}
                      >
                        {fmtPct(row.totalPct)}
                      </td>
                      {METAS_FAMILIES.map((f) => {
                        const ratio = sanitizeRatio(row.familiaPct[f]);
                        const status = statusFromRatio(ratio);
                        return (
                          <td
                            key={f}
                            className={cn(
                              "px-3 py-2.5 text-center text-[10px] border-r border-border/50 tabular-nums font-bold",
                              status && FAROL_CELL_CLASS[status],
                            )}
                          >
                            {fmtPct(ratio)}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-center">
                        {isClientRow(row) && row.id ? (
                          <Link
                            to="/performance/metas/$rowId"
                            params={{ rowId: row.id }}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted"
                            title="Abrir metas do cliente em uma nova janela"
                          >
                            <Target className="h-3.5 w-3.5" /> Abrir
                          </Link>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        {filtered.length} cliente(s) · Performance exibida a partir da versão mais recente de cada
        representante.
      </p>
    </div>
  );
}
