import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  upsertInternalTicketCategory,
  setInternalTicketCategoryActive,
} from "@/lib/internal-tickets/admin.functions";
import { listSectors, listCategories, type Category } from "@/lib/internal-tickets/queries";

type FormState = {
  id?: string;
  name: string;
  defaultSectorId: string;
  slaFirstResponseMinutes: string;
  slaResolutionMinutes: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  defaultSectorId: "",
  slaFirstResponseMinutes: "",
  slaResolutionMinutes: "",
};

function toMinutesOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}

export function CategoriesTab() {
  const qc = useQueryClient();
  const sectorsQuery = useQuery({ queryKey: ["internal-ticket-sectors"], queryFn: listSectors });
  const categoriesQuery = useQuery({
    queryKey: ["internal-ticket-categories"],
    queryFn: listCategories,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const saveMutation = useMutation({
    mutationFn: (data: FormState) =>
      upsertInternalTicketCategory({
        data: {
          id: data.id,
          name: data.name.trim(),
          defaultSectorId: data.defaultSectorId || null,
          slaFirstResponseMinutes: toMinutesOrNull(data.slaFirstResponseMinutes),
          slaResolutionMinutes: toMinutesOrNull(data.slaResolutionMinutes),
        },
      }),
    onSuccess: () => {
      toast.success("Categoria salva");
      qc.invalidateQueries({ queryKey: ["internal-ticket-categories"] });
      setOpen(false);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao salvar categoria"),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (vars: { id: string; active: boolean }) =>
      setInternalTicketCategoryActive({ data: vars }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["internal-ticket-categories"] }),
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar categoria"),
  });

  function openCreate() {
    setForm(EMPTY_FORM);
    setOpen(true);
  }

  function openEdit(category: Category) {
    setForm({
      id: category.id,
      name: category.name,
      defaultSectorId: category.default_sector_id ?? "",
      slaFirstResponseMinutes: category.sla_first_response_minutes?.toString() ?? "",
      slaResolutionMinutes: category.sla_resolution_minutes?.toString() ?? "",
    });
    setOpen(true);
  }

  const sectorName = (id: string | null) =>
    sectorsQuery.data?.find((s) => s.id === id)?.name ?? "—";

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" /> Nova categoria
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{form.id ? "Editar categoria" : "Nova categoria"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Setor padrão</Label>
                <select
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.defaultSectorId}
                  onChange={(e) => setForm((f) => ({ ...f, defaultSectorId: e.target.value }))}
                >
                  <option value="">Sem setor padrão</option>
                  {(sectorsQuery.data ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>SLA 1ª resposta (min)</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Herda do setor"
                    value={form.slaFirstResponseMinutes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, slaFirstResponseMinutes: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>SLA resolução (min)</Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="Herda do setor"
                    value={form.slaResolutionMinutes}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, slaResolutionMinutes: e.target.value }))
                    }
                  />
                </div>
              </div>
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
              <TableHead>Setor padrão</TableHead>
              <TableHead>SLA 1ª resposta</TableHead>
              <TableHead>SLA resolução</TableHead>
              <TableHead>Ativa</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(categoriesQuery.data ?? []).map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-medium">{category.name}</TableCell>
                <TableCell>{sectorName(category.default_sector_id)}</TableCell>
                <TableCell>
                  {category.sla_first_response_minutes ? (
                    `${category.sla_first_response_minutes} min`
                  ) : (
                    <span className="text-muted-foreground">herda do setor</span>
                  )}
                </TableCell>
                <TableCell>
                  {category.sla_resolution_minutes ? (
                    `${category.sla_resolution_minutes} min`
                  ) : (
                    <span className="text-muted-foreground">herda do setor</span>
                  )}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={category.active}
                    onCheckedChange={(active) =>
                      toggleActiveMutation.mutate({ id: category.id, active })
                    }
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(category)}>
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
