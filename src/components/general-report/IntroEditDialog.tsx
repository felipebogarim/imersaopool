import { useEffect, useState } from "react";
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
import type { GeneralReportContent } from "@/lib/general-report-lib";

type Intro = Pick<GeneralReportContent, "title" | "subtitle" | "executive_summary">;

/** Edição manual da introdução do relatório (título, subtítulo e resumo). */
export function IntroEditDialog({
  open,
  onOpenChange,
  intro,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  intro: Intro;
  onSave: (i: Intro) => void;
}) {
  const [f, setF] = useState({ title: "", subtitle: "", summary: "" });
  useEffect(() => {
    if (open)
      setF({
        title: intro.title,
        subtitle: intro.subtitle ?? "",
        summary: intro.executive_summary,
      });
  }, [open, intro]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar introdução</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input
              value={f.title}
              onChange={(e) => setF((p) => ({ ...p, title: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Subtítulo</Label>
            <Input
              value={f.subtitle}
              onChange={(e) => setF((p) => ({ ...p, subtitle: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Resumo</Label>
            <Textarea
              rows={8}
              value={f.summary}
              onChange={(e) => setF((p) => ({ ...p, summary: e.target.value }))}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={!f.title.trim()}
            onClick={() =>
              onSave({
                title: f.title.trim(),
                subtitle: f.subtitle.trim() || undefined,
                executive_summary: f.summary.trim(),
              })
            }
          >
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
