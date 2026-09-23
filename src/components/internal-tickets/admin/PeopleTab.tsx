import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  upsertInternalTicketSectorPerson,
  setInternalTicketSectorPersonActive,
} from "@/lib/internal-tickets/admin.functions";
import { listSectors, listSectorPeople, type SectorPerson } from "@/lib/internal-tickets/queries";

type FormState = {
  id?: string;
  sectorId: string;
  name: string;
  roleTitle: string;
  email: string;
  isPrimaryRecipient: boolean;
  isCc: boolean;
  isEscalationContact: boolean;
  receivesNewTickets: boolean;
  receivesReminders: boolean;
  receivesEscalations: boolean;
};

function emptyForm(sectorId: string): FormState {
  return {
    sectorId,
    name: "",
    roleTitle: "",
    email: "",
    isPrimaryRecipient: true,
    isCc: false,
    isEscalationContact: false,
    receivesNewTickets: true,
    receivesReminders: true,
    receivesEscalations: false,
  };
}

export function PeopleTab() {
  const qc = useQueryClient();
  const sectorsQuery = useQuery({ queryKey: ["internal-ticket-sectors"], queryFn: listSectors });
  const peopleQuery = useQuery({
    queryKey: ["internal-ticket-sector-people"],
    queryFn: listSectorPeople,
  });

  const [sectorFilter, setSectorFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm(""));

  const saveMutation = useMutation({
    mutationFn: (data: FormState) =>
      upsertInternalTicketSectorPerson({
        data: {
          id: data.id,
          sectorId: data.sectorId,
          name: data.name.trim(),
          roleTitle: data.roleTitle.trim() || null,
          email: data.email.trim(),
          isPrimaryRecipient: data.isPrimaryRecipient,
          isCc: data.isCc,
          isEscalationContact: data.isEscalationContact,
          receivesNewTickets: data.receivesNewTickets,
          receivesReminders: data.receivesReminders,
          receivesEscalations: data.receivesEscalations,
        },
      }),
    onSuccess: () => {
      toast.success("Pessoa salva");
      qc.invalidateQueries({ queryKey: ["internal-ticket-sector-people"] });
      setOpen(false);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Falha ao salvar pessoa"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (vars: { id: string; active: boolean }) =>
      setInternalTicketSectorPersonActive({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["internal-ticket-sector-people"] }),
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar pessoa"),
  });

  function openCreate() {
    const sectorId = sectorFilter !== "all" ? sectorFilter : (sectorsQuery.data?.[0]?.id ?? "");
    setForm(emptyForm(sectorId));
    setOpen(true);
  }

  function openEdit(person: SectorPerson) {
    setForm({
      id: person.id,
      sectorId: person.sector_id,
      name: person.name,
      roleTitle: person.role_title ?? "",
      email: person.email,
      isPrimaryRecipient: person.is_primary_recipient,
      isCc: person.is_cc,
      isEscalationContact: person.is_escalation_contact,
      receivesNewTickets: person.receives_new_tickets,
      receivesReminders: person.receives_reminders,
      receivesEscalations: person.receives_escalations,
    });
    setOpen(true);
  }

  const sectorName = (id: string) => sectorsQuery.data?.find((s) => s.id === id)?.name ?? "—";
  const filtered = (peopleQuery.data ?? []).filter(
    (p) => sectorFilter === "all" || p.sector_id === sectorFilter,
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <select
          className="h-9 w-56 rounded-md border bg-background px-3 text-sm"
          value={sectorFilter}
          onChange={(e) => setSectorFilter(e.target.value)}
        >
          <option value="all">Todos os setores</option>
          {(sectorsQuery.data ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Nova pessoa
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? "Editar pessoa" : "Nova pessoa"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Setor</Label>
                <select
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.sectorId}
                  onChange={(e) => setForm((f) => ({ ...f, sectorId: e.target.value }))}
                >
                  {(sectorsQuery.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Cargo</Label>
                  <Input
                    value={form.roleTitle}
                    onChange={(e) => setForm((f) => ({ ...f, roleTitle: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>E-mail</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-lg border p-3 text-sm">
                {(
                  [
                    ["isPrimaryRecipient", "Destinatário principal"],
                    ["isCc", "Em cópia"],
                    ["isEscalationContact", "Contato de escalonamento"],
                    ["receivesNewTickets", "Recebe novos tickets"],
                    ["receivesReminders", "Recebe lembretes"],
                    ["receivesEscalations", "Recebe escalonamentos"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-2">
                    <Checkbox
                      checked={form[key]}
                      onCheckedChange={(checked) =>
                        setForm((f) => ({ ...f, [key]: Boolean(checked) }))
                      }
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button
                disabled={
                  !form.name.trim() ||
                  !form.email.trim() ||
                  !form.sectorId ||
                  saveMutation.isPending
                }
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
              <TableHead>Setor</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Papel</TableHead>
              <TableHead>Ativo</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((person) => (
              <TableRow key={person.id}>
                <TableCell className="font-medium">
                  {person.name}
                  {person.role_title && (
                    <span className="block text-xs text-muted-foreground">{person.role_title}</span>
                  )}
                </TableCell>
                <TableCell>{sectorName(person.sector_id)}</TableCell>
                <TableCell className="text-muted-foreground">{person.email}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {person.is_primary_recipient && <Badge variant="outline">Principal</Badge>}
                    {person.is_cc && <Badge variant="outline">Cópia</Badge>}
                    {person.is_escalation_contact && <Badge variant="outline">Escalonamento</Badge>}
                  </div>
                </TableCell>
                <TableCell>
                  <Switch
                    checked={person.active}
                    onCheckedChange={(active) =>
                      toggleActiveMutation.mutate({ id: person.id, active })
                    }
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(person)}>
                    <Pencil className="h-4 w-4" />
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
