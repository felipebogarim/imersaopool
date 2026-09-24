import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MoreVertical, Pencil, Trash2, UserRoundSearch } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { RepresentativeEditorDialog } from "@/components/director-bi/RepresentativeEditorDialog";
import { SingleSelectCombobox } from "@/components/internal-tickets/SingleSelectCombobox";
import { useIsMasterUser } from "@/hooks/use-is-master-user";
import type { KanbanRepRow } from "@/lib/kanban-reps";
import {
  clearDirectorRepNote,
  fetchDirectorRepNotes,
  saveDirectorRepNote,
  type DirectorRepNote,
} from "@/lib/director-rep-notes";

type RepresentativeRow = KanbanRepRow & Omit<DirectorRepNote, "representative_id" | "company_id">;

function displayDate(value: string | null) {
  return value ? value.split("-").reverse().join("/") : "—";
}

function cellText(value: string | null) {
  return value?.trim() || "—";
}

function hasContent(row: RepresentativeRow) {
  return Boolean(
    row.last_immersion ||
    row.general_perception?.trim() ||
    row.perceived_opportunities?.trim() ||
    row.notes?.trim(),
  );
}

function ActionsMenu({
  representative,
  canClear,
  onEdit,
  onClear,
}: {
  representative: RepresentativeRow;
  canClear: boolean;
  onEdit: () => void;
  onClear: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Opções de ${representative.nome ?? "representante"}`}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}>
          <Pencil className="mr-2 h-4 w-4" /> Editar
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={!canClear}
          className="text-destructive focus:text-destructive"
          onClick={onClear}
        >
          <Trash2 className="mr-2 h-4 w-4" /> Limpar dados
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function RepresentativeTable({ representatives }: { representatives: KanbanRepRow[] }) {
  const queryClient = useQueryClient();
  const isMaster = useIsMasterUser();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<RepresentativeRow | null>(null);
  const [clearing, setClearing] = useState<RepresentativeRow | null>(null);

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
  const clearMutation = useMutation({
    mutationFn: clearDirectorRepNote,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["director-rep-notes"] });
      setClearing(null);
      toast.success("Dados do representante removidos.");
    },
    onError: (error) => toast.error(error.message),
  });

  const rows = useMemo(() => {
    const notes = new Map(
      (notesQuery.data?.notes ?? []).map((note) => [note.representative_id, note]),
    );
    return representatives.map((representative): RepresentativeRow => {
      const note = notes.get(representative.id);
      return {
        ...representative,
        last_immersion: note?.last_immersion ?? null,
        general_perception: note?.general_perception ?? null,
        perceived_opportunities: note?.perceived_opportunities ?? null,
        notes: note?.notes ?? null,
        updated_at: note?.updated_at ?? "",
      };
    });
  }, [notesQuery.data, representatives]);

  const selected = rows.find((row) => row.id === selectedId) ?? null;
  const options = useMemo(
    () =>
      representatives.map((representative) => ({
        value: representative.id,
        label: representative.nome || "Sem nome",
      })),
    [representatives],
  );

  if (notesQuery.isPending) {
    return (
      <div className="rounded-xl border bg-card py-16 text-center text-sm text-muted-foreground">
        Carregando representantes…
      </div>
    );
  }
  if (notesQuery.isError) {
    return (
      <div role="alert" className="rounded-xl border bg-card p-4 text-sm sm:p-6">
        Não foi possível carregar os dados dos representantes. {notesQuery.error.message}
        <Button
          variant="outline"
          size="sm"
          className="mt-3 w-full sm:ml-3 sm:mt-0 sm:w-auto"
          onClick={() => void notesQuery.refetch()}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  const actions = selected && isMaster && notesQuery.data.schemaAvailable && (
    <ActionsMenu
      representative={selected}
      canClear={hasContent(selected)}
      onEdit={() => setEditing(selected)}
      onClear={() => setClearing(selected)}
    />
  );

  return (
    <>
      <div className="sticky top-2 z-20 mb-3 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85 sm:p-4">
        <div className="max-w-xl space-y-2">
          <Label>Representante</Label>
          <SingleSelectCombobox
            options={options}
            value={selectedId}
            onChange={setSelectedId}
            placeholder="Selecione um representante"
            searchPlaceholder="Pesquisar representante…"
            emptyText="Nenhum representante encontrado."
          />
        </div>
      </div>

      {!notesQuery.data.schemaAvailable && (
        <div
          role="status"
          className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300"
        >
          Os representantes estão disponíveis, mas os campos de acompanhamento estão temporariamente
          indisponíveis.
        </div>
      )}

      {!selected ? (
        <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed bg-card px-5 py-12 text-center">
          <UserRoundSearch className="mb-3 h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <p className="font-medium">Selecione um representante</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Use a caixa acima para pesquisar e abrir o acompanhamento individual.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="hidden lg:block">
            <table className="w-full table-fixed text-left text-sm">
              <caption className="sr-only">Acompanhamento executivo de {selected.nome}</caption>
              <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="w-[18%] px-4 py-3 font-medium">
                    Representante
                  </th>
                  <th scope="col" className="w-[14%] px-4 py-3 font-medium">
                    Última imersão
                  </th>
                  <th scope="col" className="w-[22%] px-4 py-3 font-medium">
                    Percepção Geral
                  </th>
                  <th scope="col" className="w-[22%] px-4 py-3 font-medium">
                    Oportunidades percebidas
                  </th>
                  <th scope="col" className="w-[20%] px-4 py-3 font-medium">
                    Notas
                  </th>
                  <th scope="col" className="w-[4%] px-2 py-3">
                    <span className="sr-only">Ações</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="align-top">
                  <td className="break-words px-4 py-4 font-medium">
                    {selected.nome || "Sem nome"}
                  </td>
                  <td className="px-4 py-4 tabular-nums text-muted-foreground">
                    {displayDate(selected.last_immersion)}
                  </td>
                  <td className="break-words whitespace-pre-wrap px-4 py-4 text-muted-foreground">
                    {cellText(selected.general_perception)}
                  </td>
                  <td className="break-words whitespace-pre-wrap px-4 py-4 text-muted-foreground">
                    {cellText(selected.perceived_opportunities)}
                  </td>
                  <td className="break-words whitespace-pre-wrap px-4 py-4 text-muted-foreground">
                    {cellText(selected.notes)}
                  </td>
                  <td className="px-2 py-2 text-right">{actions}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="lg:hidden">
            <div className="flex items-start justify-between gap-3 border-b bg-muted/30 px-4 py-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Representante</p>
                <p className="truncate font-semibold">{selected.nome || "Sem nome"}</p>
              </div>
              <div className="shrink-0">{actions}</div>
            </div>
            <dl className="divide-y">
              <div className="px-4 py-3">
                <dt className="text-xs font-medium text-muted-foreground">Última imersão</dt>
                <dd className="mt-1 text-sm tabular-nums">
                  {displayDate(selected.last_immersion)}
                </dd>
              </div>
              <div className="px-4 py-3">
                <dt className="text-xs font-medium text-muted-foreground">Percepção Geral</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-sm">
                  {cellText(selected.general_perception)}
                </dd>
              </div>
              <div className="px-4 py-3">
                <dt className="text-xs font-medium text-muted-foreground">
                  Oportunidades percebidas
                </dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-sm">
                  {cellText(selected.perceived_opportunities)}
                </dd>
              </div>
              <div className="px-4 py-3">
                <dt className="text-xs font-medium text-muted-foreground">Notas</dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-sm">
                  {cellText(selected.notes)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {editing && (
        <RepresentativeEditorDialog
          key={editing.id}
          representative={editing}
          saving={saveMutation.isPending}
          onClose={() => setEditing(null)}
          onSave={(input) => isMaster && saveMutation.mutate(input)}
        />
      )}

      <AlertDialog open={Boolean(clearing)} onOpenChange={(open) => !open && setClearing(null)}>
        <AlertDialogContent className="w-[calc(100%-2rem)]">
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar dados de {clearing?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              A data da última imersão, a percepção geral, as oportunidades percebidas e as notas
              serão removidas. Esta ação não exclui o representante.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={clearMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                if (clearing && isMaster) clearMutation.mutate(clearing.id);
              }}
            >
              {clearMutation.isPending ? "Limpando…" : "Limpar dados"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
