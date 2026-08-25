import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AREAS,
  AREA_LABEL,
  PRIORITIES,
  PRIORITY_LABEL,
  type ExecArea,
  type ExecPriority,
  type ExecutiveAction,
} from "@/lib/executive-report/types";

export function ActionEditDialog({
  action,
  open,
  onOpenChange,
  onSave,
}: {
  action: ExecutiveAction | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (patch: Partial<ExecutiveAction>) => void;
}) {
  const [form, setForm] = useState<Partial<ExecutiveAction>>({});

  useEffect(() => {
    if (action)
      setForm({
        title: action.title,
        description: action.description ?? "",
        area: action.area,
        priority: action.priority,
        owner: action.owner ?? "",
        due_date: action.due_date ?? "",
        note: action.note ?? "",
      });
  }, [action]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar ação</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título</Label>
            <Input
              value={form.title ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea
              rows={4}
              value={form.description ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Área</Label>
              <Select
                value={form.area}
                onValueChange={(v) => setForm((f) => ({ ...f, area: v as ExecArea }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AREAS.map((a) => (
                    <SelectItem key={a} value={a}>
                      {AREA_LABEL[a]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm((f) => ({ ...f, priority: v as ExecPriority }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Responsável (opcional)</Label>
              <Input
                value={form.owner ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, owner: e.target.value }))}
              />
            </div>
            <div>
              <Label>Prazo (opcional)</Label>
              <Input
                type="date"
                value={form.due_date ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label>Observação (opcional)</Label>
            <Textarea
              rows={2}
              value={form.note ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() =>
              onSave({
                ...form,
                due_date: form.due_date ? form.due_date : null,
                owner: form.owner ? form.owner : null,
                note: form.note ? form.note : null,
                description: form.description ? form.description : null,
              })
            }
          >
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
