import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  ColumnFilter,
  MultiSelectContent,
  SortButtons,
  TextFilterContent,
  toggleInSet,
} from "@/components/director-bi/ColumnFilters";
import {
  directorStatusBucket,
  dueState,
  initials,
  isDirectorComplete,
  normalize,
  shortDescription,
  type DirectorAction,
  type DirectorStatusBucket,
} from "@/lib/director-bi";

const STATUS_BADGE_CLASS: Record<DirectorStatusBucket, string> = {
  in_progress: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400",
  todo: "border-border bg-muted text-muted-foreground",
  completed: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  overdue: "border-destructive/30 bg-destructive/10 text-destructive",
};

const STATUS_ORDER: DirectorStatusBucket[] = ["todo", "in_progress", "overdue", "completed"];
const STATUS_FILTER_LABEL: Record<DirectorStatusBucket, string> = {
  todo: "A Fazer",
  in_progress: "Em andamento",
  overdue: "Atrasada",
  completed: "Concluída",
};

type PrazoCategory = "overdue" | "with_date" | "no_date";
const PRAZO_OPTIONS: { value: PrazoCategory; label: string }[] = [
  { value: "overdue", label: "Atrasadas" },
  { value: "with_date", label: "Com prazo" },
  { value: "no_date", label: "Sem prazo" },
];

function prazoCategory(action: DirectorAction): PrazoCategory {
  if (!action.due_date) return "no_date";
  if (!isDirectorComplete(action) && dueState(action.due_date, false) === "Atrasada")
    return "overdue";
  return "with_date";
}

type SortKey = "acao" | "responsavel" | "prazo" | "status";
type SortState = { key: SortKey; dir: "asc" | "desc" } | null;

type Filters = {
  acao: string;
  resumo: string;
  responsavel: Set<string>;
  prazoSearch: string;
  prazoCategories: Set<PrazoCategory>;
  status: Set<DirectorStatusBucket>;
};

const EMPTY_FILTERS: Filters = {
  acao: "",
  resumo: "",
  responsavel: new Set(),
  prazoSearch: "",
  prazoCategories: new Set(),
  status: new Set(),
};

function hasActiveFilters(filters: Filters) {
  return Boolean(
    filters.acao ||
    filters.resumo ||
    filters.responsavel.size ||
    filters.prazoSearch ||
    filters.prazoCategories.size ||
    filters.status.size,
  );
}

function Deadline({ action }: { action: DirectorAction }) {
  const hint = dueState(action.due_date, isDirectorComplete(action));
  const date = action.due_date?.slice(0, 10).split("-").reverse().join("/");
  return (
    <div className={cn("text-sm tabular-nums", hint === "Atrasada" && "text-destructive")}>
      {date ? (
        <span className="inline-flex items-center gap-1">
          <time dateTime={action.due_date!}>{date}</time>
          {hint === "Atrasada" && <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />}
        </span>
      ) : (
        <span className="text-muted-foreground">Sem prazo</span>
      )}
      {hint && <span className="mt-0.5 block text-xs">{hint}</span>}
    </div>
  );
}

export function ExecutiveTable({ actions }: { actions: DirectorAction[] }) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortState>(null);

  const responsibleOptions = useMemo(
    () =>
      Array.from(new Set(actions.map((a) => a.responsible)))
        .sort((a, b) => a.localeCompare(b, "pt-BR"))
        .map((value) => ({ value, label: value })),
    [actions],
  );
  const statusOptions = useMemo(() => {
    const present = new Set(actions.map((a) => directorStatusBucket(a)));
    return STATUS_ORDER.filter((bucket) => present.has(bucket)).map((value) => ({
      value,
      label: STATUS_FILTER_LABEL[value],
    }));
  }, [actions]);

  const filtered = useMemo(() => {
    const acao = normalize(filters.acao.trim());
    const resumo = normalize(filters.resumo.trim());
    const prazoSearch = normalize(filters.prazoSearch.trim());
    let result = actions.filter((action) => {
      if (acao && !normalize(action.title).includes(acao)) return false;
      if (resumo && !normalize(action.description ?? "").includes(resumo)) return false;
      if (filters.responsavel.size && !filters.responsavel.has(action.responsible)) return false;
      if (filters.status.size && !filters.status.has(directorStatusBucket(action))) return false;
      if (filters.prazoCategories.size && !filters.prazoCategories.has(prazoCategory(action)))
        return false;
      if (prazoSearch) {
        const hint = dueState(action.due_date, isDirectorComplete(action)) ?? "";
        const date = action.due_date?.slice(0, 10).split("-").reverse().join("/") ?? "sem prazo";
        if (!normalize(`${date} ${hint}`).includes(prazoSearch)) return false;
      }
      return true;
    });
    if (sort) {
      result = [...result].sort((a, b) => {
        let cmp = 0;
        if (sort.key === "acao") cmp = a.title.localeCompare(b.title, "pt-BR");
        else if (sort.key === "responsavel")
          cmp = a.responsible.localeCompare(b.responsible, "pt-BR");
        else if (sort.key === "prazo") {
          if (!a.due_date && !b.due_date) cmp = 0;
          else if (!a.due_date) cmp = 1;
          else if (!b.due_date) cmp = -1;
          else cmp = a.due_date.localeCompare(b.due_date);
        } else if (sort.key === "status")
          cmp =
            STATUS_ORDER.indexOf(directorStatusBucket(a)) -
            STATUS_ORDER.indexOf(directorStatusBucket(b));
        return sort.dir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [actions, filters, sort]);

  const activeFilters = hasActiveFilters(filters);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {activeFilters && (
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-1.5 text-xs text-muted-foreground">
          <span>
            {filtered.length} de {actions.length} ações filtradas
          </span>
          <button
            type="button"
            onClick={() => setFilters(EMPTY_FILTERS)}
            className="inline-flex items-center gap-1 hover:text-foreground"
          >
            <X className="h-3 w-3" /> Limpar filtros
          </button>
        </div>
      )}
      <table className="block w-full text-left text-sm md:table md:table-fixed">
        <caption className="sr-only">
          Principais frentes selecionadas para acompanhamento executivo
        </caption>
        <thead className="hidden border-b bg-muted/40 text-xs text-muted-foreground md:table-header-group">
          <tr>
            <th scope="col" className="w-[24%] px-4 py-3 font-medium">
              <span className="inline-flex items-center gap-1">
                Ação
                <ColumnFilter active={Boolean(filters.acao) || sort?.key === "acao"}>
                  {() => (
                    <div className="space-y-2">
                      <SortButtons
                        dir={sort?.key === "acao" ? sort.dir : undefined}
                        labels={["A→Z", "Z→A"]}
                        onChange={(dir) => setSort(dir ? { key: "acao", dir } : null)}
                      />
                      <TextFilterContent
                        value={filters.acao}
                        onChange={(acao) => setFilters((f) => ({ ...f, acao }))}
                        placeholder="Buscar ação…"
                      />
                    </div>
                  )}
                </ColumnFilter>
              </span>
            </th>
            <th scope="col" className="w-[26%] px-4 py-3 font-medium">
              <span className="inline-flex items-center gap-1">
                Resumo
                <ColumnFilter active={Boolean(filters.resumo)}>
                  {() => (
                    <TextFilterContent
                      value={filters.resumo}
                      onChange={(resumo) => setFilters((f) => ({ ...f, resumo }))}
                      placeholder="Buscar no resumo…"
                    />
                  )}
                </ColumnFilter>
              </span>
            </th>
            <th scope="col" className="w-[17%] px-4 py-3 font-medium">
              <span className="inline-flex items-center gap-1">
                Responsável
                <ColumnFilter active={filters.responsavel.size > 0 || sort?.key === "responsavel"}>
                  {() => (
                    <div className="space-y-2">
                      <SortButtons
                        dir={sort?.key === "responsavel" ? sort.dir : undefined}
                        labels={["A→Z", "Z→A"]}
                        onChange={(dir) => setSort(dir ? { key: "responsavel", dir } : null)}
                      />
                      <MultiSelectContent
                        options={responsibleOptions}
                        selected={filters.responsavel}
                        onChange={(responsavel) => setFilters((f) => ({ ...f, responsavel }))}
                        searchPlaceholder="Buscar responsável…"
                      />
                    </div>
                  )}
                </ColumnFilter>
              </span>
            </th>
            <th scope="col" className="w-[15%] px-4 py-3 font-medium">
              <span className="inline-flex items-center gap-1">
                Prazo
                <ColumnFilter
                  active={
                    Boolean(filters.prazoSearch) ||
                    filters.prazoCategories.size > 0 ||
                    sort?.key === "prazo"
                  }
                >
                  {() => (
                    <div className="space-y-2">
                      <SortButtons
                        dir={sort?.key === "prazo" ? sort.dir : undefined}
                        labels={["Mais próximo", "Mais distante"]}
                        onChange={(dir) => setSort(dir ? { key: "prazo", dir } : null)}
                      />
                      <Input
                        value={filters.prazoSearch}
                        onChange={(e) => setFilters((f) => ({ ...f, prazoSearch: e.target.value }))}
                        placeholder="Buscar por data…"
                        className="h-8 text-xs"
                      />
                      <div className="space-y-0.5">
                        {PRAZO_OPTIONS.map((opt) => (
                          <label
                            key={opt.value}
                            className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-xs hover:bg-muted"
                          >
                            <Checkbox
                              checked={filters.prazoCategories.has(opt.value)}
                              onCheckedChange={() =>
                                setFilters((f) => ({
                                  ...f,
                                  prazoCategories: toggleInSet(f.prazoCategories, opt.value),
                                }))
                              }
                            />
                            {opt.label}
                          </label>
                        ))}
                      </div>
                      {(filters.prazoSearch || filters.prazoCategories.size > 0) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-full text-xs text-muted-foreground"
                          onClick={() =>
                            setFilters((f) => ({
                              ...f,
                              prazoSearch: "",
                              prazoCategories: new Set(),
                            }))
                          }
                        >
                          Limpar filtro
                        </Button>
                      )}
                    </div>
                  )}
                </ColumnFilter>
              </span>
            </th>
            <th scope="col" className="w-[18%] px-4 py-3 font-medium">
              <span className="inline-flex items-center gap-1">
                Status / Evolução
                <ColumnFilter active={filters.status.size > 0 || sort?.key === "status"}>
                  {() => (
                    <div className="space-y-2">
                      <SortButtons
                        dir={sort?.key === "status" ? sort.dir : undefined}
                        labels={["A Fazer→Concluída", "Concluída→A Fazer"]}
                        onChange={(dir) => setSort(dir ? { key: "status", dir } : null)}
                      />
                      <MultiSelectContent
                        options={statusOptions}
                        selected={filters.status}
                        onChange={(status) => setFilters((f) => ({ ...f, status }))}
                        searchPlaceholder="Buscar status…"
                      />
                    </div>
                  )}
                </ColumnFilter>
              </span>
            </th>
          </tr>
        </thead>
        <tbody className="block divide-y divide-border md:table-row-group">
          {filtered.length === 0 && (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                Nenhuma ação encontrada com os filtros atuais.
              </td>
            </tr>
          )}
          {filtered.map((action) => (
            <tr
              key={action.id}
              className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 p-4 transition-colors hover:bg-muted/20 md:table-row md:p-0"
            >
              <th
                scope="row"
                className="col-span-2 min-w-0 text-left align-top font-medium md:px-4 md:py-4"
              >
                <Link
                  to="/tarefas/b/$boardId"
                  params={{ boardId: action.board_id }}
                  search={{ card: action.id }}
                  className="break-words text-foreground underline-offset-4 hover:text-primary hover:underline focus-visible:rounded focus-visible:outline focus-visible:outline-2"
                >
                  {action.title}
                </Link>
                {action.representative && (
                  <span className="mt-1 block break-words text-xs font-normal text-muted-foreground">
                    Rep: {action.representative}
                  </span>
                )}
              </th>
              <td className="col-span-2 min-w-0 align-top text-muted-foreground md:px-4 md:py-4">
                <span className="line-clamp-2 break-words" title={action.description ?? undefined}>
                  {shortDescription(action.description) || "Sem descrição"}
                </span>
              </td>
              <td className="min-w-0 break-words align-top md:px-4 md:py-4">
                <span className="mb-1 block text-xs text-muted-foreground md:hidden">
                  Responsável
                </span>
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="text-[10px] font-medium">
                      {initials(action.responsible)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{action.responsible}</span>
                </div>
              </td>
              <td className="min-w-0 align-top md:px-4 md:py-4">
                <span className="mb-1 block text-xs text-muted-foreground md:hidden">Prazo</span>
                <Deadline action={action} />
              </td>
              <td className="col-span-2 min-w-0 align-top md:px-4 md:py-4">
                <Badge
                  variant="outline"
                  className={cn(
                    "max-w-full whitespace-normal font-normal",
                    STATUS_BADGE_CLASS[directorStatusBucket(action)],
                  )}
                >
                  {isDirectorComplete(action) ? "Concluída" : action.stage}
                </Badge>
                {action.checklistTotal > 0 && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-sky-500"
                        style={{
                          width: `${Math.round((action.checklistDone / action.checklistTotal) * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {Math.round((action.checklistDone / action.checklistTotal) * 100)}%
                    </span>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
