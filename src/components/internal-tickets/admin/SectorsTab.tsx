import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  upsertInternalTicketSector,
  setInternalTicketSectorActive,
  deleteInternalTicketSector,
} from "@/lib/internal-tickets/admin.functions";
import { listSectors, listSectorPeople, type Sector } from "@/lib/internal-tickets/queries";

type FormState = {
  id?: string;
  name: string;
  defaultSlaFirstResponseMinutes: string;
  defaultSlaResolutionMinutes: string;
  managerPersonId: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  defaultSlaFirstResponseMinutes: "",
  defaultSlaResolutionMinutes: "",
  managerPersonId: "",
};

function toMinutesOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export function SectorsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const sectorsQuery = useQuery({ queryKey: ["internal-ticket-sectors"], queryFn: listSectors });
  const peopleQuery = useQuery({
    queryKey: ["internal-ticket-sector-people"],
    queryFn: listSectorPeople,
  });

  const saveMutation = useMutation({
    mutationFn: (data: FormState) =>
      upsertInternalTicketSector({
        data: {
          id: data.id,
          name: data.name.trim(),
          defaultSlaFirstResponseMinutes: toMinutesOrNull(data.defaultSlaFirstResponseMinutes),
          defaultSlaResolutionMinutes: toMinutesOrNull(data.defaultSlaResolutionMinutes),
          managerPersonId: data.managerPersonId || null,
        },
      }),
    onSuccess: () => {
      toast.success("Setor salvo");
      qc.invalidateQueries({ queryKey: ["internal-ticket-sectors"] });
      setOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao salvar setor"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (vars: { id: string; active: boolean }) =>
      setInternalTicketSectorActive({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["internal-ticket-sectors"] });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar setor"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteInternalTicketSector({ data: { id } }),
    onSuccess: () => {
      toast.success("Setor excluído");
      qc.invalidateQueries({ queryKey: ["internal-ticket-sectors"] });
      qc.invalidateQueries({ queryKey: ["internal-ticket-sector-people"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao excluir setor"),
  });

  function handleDelete(sector: Sector) {
    if (
      !confirm(
        `Excluir o setor "${sector.name}"? Isso também exclui todas as pessoas cadastradas nele. Setores com tickets vinculados (atuais ou no histórico) não podem ser excluídos.`,
      )
    ) {
      return;
    }
    deleteMutation.mutate(sector.id);
  }

  function openEdit(sector: Sector) {
    setForm({
      id: sector.id,
      name: sector.name,
      defaultSlaFirstResponseMinutes: sector.default_sla_first_response_minutes?.toString() ?? "",
      defaultSlaResolutionMinutes: sector.default_sla_resolution_minutes?.toString() ?? "",
      managerPersonId: sector.manager_person_id ?? "",
    });
    setOpen(true);
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  const peopleBySector = (sectorId: string) =>
    (peopleQuery.data ?? []).filter((p) => p.sector_id === sectorId && p.active);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Novo setor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? "Editar setor" : "Novo setor"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>SLA 1ª resposta (min)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.defaultSlaFirstResponseMinutes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, defaultSlaFirstResponseMinutes: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>SLA resolução (min)</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.defaultSlaResolutionMinutes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, defaultSlaResolutionMinutes: e.target.value }))
                    }
                  />
                </div>
              </div>
              {form.id && (
                <div className="space-y-1.5">
                  <Label>Gestor do setor</Label>
                  <select
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    value={form.managerPersonId}
                    onChange={(e) => setForm((f) => ({ ...f, managerPersonId: e.target.value }))}
                  >
                    <option value="">Sem gestor definido</option>
                    {peopleBySector(form.id).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                disabled={!form.name.trim() || saveMutation.isPending}
                onClick={() => saveMutation.mutate(form)}
              >
                {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>SLA 1ª resposta</TableHead>
              <TableHead>SLA resolução</TableHead>
              <TableHead>Pessoas ativas</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(sectorsQuery.data ?? []).map((sector) => (
              <TableRow key={sector.id}>
                <TableCell className="font-medium">{sector.name}</TableCell>
                <TableCell>
                  {sector.default_sla_first_response_minutes ? (
                    `${sector.default_sla_first_response_minutes} min`
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {sector.default_sla_resolution_minutes ? (
                    `${sector.default_sla_resolution_minutes} min`
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{peopleBySector(sector.id).length}</Badge>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={sector.active}
                    onCheckedChange={(active) =>
                      toggleActiveMutation.mutate({ id: sector.id, active })
                    }
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(sector)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={deleteMutation.isPending}
                    onClick={() => handleDelete(sector)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
