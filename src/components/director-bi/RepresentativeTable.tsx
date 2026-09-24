import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreVertical, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ColumnFilter,
  SortButtons,
  TextFilterContent,
} from "@/components/director-bi/ColumnFilters";
import { RepresentativeEditorDialog } from "@/components/director-bi/RepresentativeEditorDialog";
import { useIsMasterUser } from "@/hooks/use-is-master-user";
import type { KanbanRepRow } from "@/lib/kanban-reps";
import { normalize } from "@/lib/director-bi";
import {
  fetchDirectorRepNotes,
  saveDirectorRepNote,
  type DirectorRepNote,
} from "@/lib/director-rep-notes";

type RepresentativeRow = KanbanRepRow & Omit<DirectorRepNote, "representative_id" | "company_id">;
type FilterKey = "representative" | "lastImmersion" | "perception" | "opportunities" | "notes";
type Filters = Record<FilterKey, string>;
type SortState = { key: FilterKey; dir: "asc" | "desc" } | null;

const EMPTY_FILTERS: Filters = {
  representative: "",
  lastImmersion: "",
  perception: "",
  opportunities: "",
  notes: "",
};

function displayDate(value: string | null) {
  return value ? value.split("-").reverse().join("/") : "—";
}

function cellText(value: string | null) {
  return value?.trim() || "—";
}

function filterValue(row: RepresentativeRow, key: FilterKey) {
  if (key === "representative") return row.nome ?? "";
  if (key === "lastImmersion")
    return `${row.last_immersion ?? ""} ${displayDate(row.last_immersion)}`;
  if (key === "perception") return row.general_perception ?? "";
  if (key === "opportunities") return row.perceived_opportunities ?? "";
  return row.notes ?? "";
}

function FilterableTitle({
  label,
  column,
  filters,
  sort,
  onFilter,
  onSort,
}: {
  label: string;
  column: FilterKey;
  filters: Filters;
  sort: SortState;
  onFilter: (key: FilterKey, value: string) => void;
  onSort: (sort: SortState) => void;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      {label}
      <ColumnFilter active={Boolean(filters[column]) || sort?.key === column}>
        {() => (
          <div className="space-y-2">
            <SortButtons
              dir={sort?.key === column ? sort.dir : undefined}
              labels={["Crescente", "Decrescente"]}
              onChange={(dir) => onSort(dir ? { key: column, dir } : null)}
            />
            <TextFilterContent
              value={filters[column]}
              onChange={(value) => onFilter(column, value)}
              placeholder={`Filtrar ${label.toLocaleLowerCase("pt-BR")}…`}
            />
          </div>
        )}
      </ColumnFilter>
    </span>
  );
}

export function RepresentativeTable({ representatives }: { representatives: KanbanRepRow[] }) {
  const queryClient = useQueryClient();
  const isMaster = useIsMasterUser();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortState>(null);
  const [editing, setEditing] = useState<RepresentativeRow | null>(null);

  const notesQuery = useQuery({
    queryKey: ["director-rep-notes"],
    queryFn: fetchDirectorRepNotes,
    staleTime: 0,
    refetchInterval: 15_000,
    refetchOnWindowFocus: "always",
  });
  const saveMutation = useMutation({
    mutationFn: saveDirectorRepNote,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["director-rep-notes"] });
      setEditing(null);
      toast.success("Informações do representante salvas.");
    },
    onError: (error) => toast.error(error.message),
  });

  const rows = useMemo(() => {
    const notes = new Map((notesQuery.data ?? []).map((note) => [note.representative_id, note]));
    let result: RepresentativeRow[] = representatives.map((rep) => {
      const note = notes.get(rep.id);
      return {
        ...rep,
        last_immersion: note?.last_immersion ?? null,
        general_perception: note?.general_perception ?? null,
        perceived_opportunities: note?.perceived_opportunities ?? null,
        notes: note?.notes ?? null,
        updated_at: note?.updated_at ?? "",
      };
    });
    result = result.filter((row) =>
      (Object.keys(filters) as FilterKey[]).every((key) => {
        const query = normalize(filters[key].trim());
        return !query || normalize(filterValue(row, key)).includes(query);
      }),
    );
    if (sort) {
      result = [...result].sort((a, b) => {
        const comparison = filterValue(a, sort.key).localeCompare(
          filterValue(b, sort.key),
          "pt-BR",
        );
        return sort.dir === "asc" ? comparison : -comparison;
      });
    }
    return result;
  }, [filters, notesQuery.data, representatives, sort]);

  const hasFilters = Object.values(filters).some(Boolean);
  const setFilter = (key: FilterKey, value: string) =>
    setFilters((current) => ({ ...current, [key]: value }));

  if (notesQuery.isPending) {
    return (
      <div className="rounded-xl border bg-card py-16 text-center text-sm text-muted-foreground">
        Carregando representantes…
      </div>
    );
  }
  if (notesQuery.isError) {
    return (
      <div role="alert" className="rounded-xl border bg-card p-6 text-sm">
        Não foi possível carregar os dados dos representantes. {notesQuery.error.message}
        <Button
          variant="outline"
          size="sm"
          className="ml-3"
          onClick={() => void notesQuery.refetch()}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  const columns: { key: FilterKey; label: string; className: string }[] = [
    { key: "representative", label: "Representante", className: "w-[16%]" },
    { key: "lastImmersion", label: "Última imersão", className: "w-[14%]" },
    { key: "perception", label: "Percepção Geral", className: "w-[23%]" },
    { key: "opportunities", label: "Oportunidades percebidas", className: "w-[23%]" },
    { key: "notes", label: "Notas", className: "w-[20%]" },
  ];

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {hasFilters && (
          <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-1.5 text-xs text-muted-foreground">
            <span>
              {rows.length} de {representatives.length} representantes filtrados
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
        <div className="overflow-x-auto">
          <table className="min-w-[1050px] table-fixed text-left text-sm">
            <caption className="sr-only">Acompanhamento executivo dos representantes</caption>
            <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={`${column.className} px-4 py-3 font-medium`}
                  >
                    <FilterableTitle
                      label={column.label}
                      column={column.key}
                      filters={filters}
                      sort={sort}
                      onFilter={setFilter}
                      onSort={setSort}
                    />
                  </th>
                ))}
                <th scope="col" className="w-[4%] px-2 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    Nenhum representante encontrado.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-border/70 align-top last:border-b-0">
                    <td className="px-4 py-3 font-medium">{row.nome || "Sem nome"}</td>
                    <td className="px-4 py-3 tabular-nums text-muted-foreground">
                      {displayDate(row.last_immersion)}
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-3 text-muted-foreground">
                      {cellText(row.general_perception)}
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-3 text-muted-foreground">
                      {cellText(row.perceived_opportunities)}
                    </td>
                    <td className="whitespace-pre-wrap px-4 py-3 text-muted-foreground">
                      {cellText(row.notes)}
                    </td>
                    <td className="px-2 py-2 text-right">
                      {isMaster && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={`Editar ${row.nome ?? "representante"}`}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditing(row)}>
                              <Pencil className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <RepresentativeEditorDialog
          key={editing.id}
          representative={editing}
          saving={saveMutation.isPending}
          onClose={() => setEditing(null)}
          onSave={(input) => isMaster && saveMutation.mutate(input)}
        />
      )}
    </>
  );
}
