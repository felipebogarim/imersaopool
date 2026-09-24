import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DirectorRepNoteInput } from "@/lib/director-rep-notes";

type EditableRepresentative = {
  id: string;
  nome: string | null;
  last_immersion: string | null;
  general_perception: string | null;
  perceived_opportunities: string | null;
  notes: string | null;
};

export function RepresentativeEditorDialog({
  representative,
  saving,
  onClose,
  onSave,
}: {
  representative: EditableRepresentative;
  saving: boolean;
  onClose: () => void;
  onSave: (input: DirectorRepNoteInput) => void;
}) {
  const [form, setForm] = useState({
    last_immersion: representative.last_immersion ?? "",
    general_perception: representative.general_perception ?? "",
    perceived_opportunities: representative.perceived_opportunities ?? "",
    notes: representative.notes ?? "",
  });

  function save() {
    onSave({
      representative_id: representative.id,
      last_immersion: form.last_immersion || null,
      general_perception: form.general_perception.trim() || null,
      perceived_opportunities: form.perceived_opportunities.trim() || null,
      notes: form.notes.trim() || null,
    });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar acompanhamento — {representative.nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rep-last-immersion">Última imersão</Label>
            <Input
              id="rep-last-immersion"
              type="date"
              value={form.last_immersion}
              onChange={(event) =>
                setForm((current) => ({ ...current, last_immersion: event.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rep-general-perception">Percepção Geral</Label>
            <Textarea
              id="rep-general-perception"
              rows={4}
              value={form.general_perception}
              onChange={(event) =>
                setForm((current) => ({ ...current, general_perception: event.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rep-opportunities">Oportunidades percebidas</Label>
            <Textarea
              id="rep-opportunities"
              rows={4}
              value={form.perceived_opportunities}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  perceived_opportunities: event.target.value,
                }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rep-notes">Notas</Label>
            <Textarea
              id="rep-notes"
              rows={4}
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
