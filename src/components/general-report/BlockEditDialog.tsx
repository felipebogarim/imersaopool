import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { ReportBlock } from "@/lib/general-report-lib";

const lines = (v: string) =>
  v
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
const cells = (l: string) => l.split("|").map((c) => c.trim());

/** Edição manual de um bloco. Os números dos gráficos vêm da planilha e não são editados aqui. */
export function BlockEditDialog({
  block,
  open,
  onOpenChange,
  onSave,
}: {
  block: ReportBlock | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (b: ReportBlock) => void;
}) {
  const [f, setF] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!block) return;
    switch (block.type) {
      case "text":
        setF({ text: block.text });
        break;
      case "bullets":
        setF({ title: block.title ?? "", items: block.items.join("\n") });
        break;
      case "kpis":
        setF({
          items: block.items.map((k) => [k.label, k.value, k.hint ?? ""].join(" | ")).join("\n"),
        });
        break;
      case "table":
        setF({
          title: block.title ?? "",
          body: [block.columns.join(" | "), ...block.rows.map((r) => r.join(" | "))].join("\n"),
        });
        break;
      case "callout":
        setF({ tone: block.tone, text: block.text });
        break;
      case "image":
        setF({ caption: block.caption, items: block.observations.join("\n") });
        break;
      case "chart":
        setF({ title: block.title, insight: block.insight ?? "", kind: block.kind });
        break;
    }
  }, [block]);
  if (!block) return null;
  const set = (k: string) => (e: { target: { value: string } }) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  function save() {
    if (!block) return;
    switch (block.type) {
      case "text":
        return onSave({ ...block, text: f.text.trim() });
      case "bullets":
        return onSave({ ...block, title: f.title.trim() || undefined, items: lines(f.items) });
      case "kpis":
        return onSave({
          ...block,
          items: lines(f.items)
            .map((l) => {
              const [label, value, hint] = cells(l);
              return { label, value: value ?? "", hint: hint || undefined };
            })
            .filter((k) => k.label && k.value),
        });
      case "table": {
        const [head, ...rest] = lines(f.body);
        const columns = cells(head ?? "");
        return onSave({
          ...block,
          title: f.title.trim() || undefined,
          columns,
          rows: rest.map((r) => cells(r).slice(0, columns.length)),
        });
      }
      case "callout":
        return onSave({ ...block, tone: f.tone as typeof block.tone, text: f.text.trim() });
      case "image":
        return onSave({ ...block, caption: f.caption.trim(), observations: lines(f.items) });
      case "chart":
        return onSave({
          ...block,
          title: f.title.trim() || block.title,
          insight: f.insight.trim() || undefined,
          kind: f.kind as typeof block.kind,
        });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar bloco</DialogTitle>
          <DialogDescription>
            {block.type === "chart"
              ? "Os dados do gráfico vêm da planilha; aqui você ajusta título, destaque e tipo. Para mudar os dados, use “Pedir alteração à IA”."
              : "Altere o conteúdo e salve."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {block.type === "text" && (
            <Textarea rows={8} value={f.text ?? ""} onChange={set("text")} />
          )}
          {(block.type === "bullets" || block.type === "table") && (
            <div className="space-y-1.5">
              <Label>Título</Label>
              <Input value={f.title ?? ""} onChange={set("title")} />
            </div>
          )}
          {block.type === "bullets" && (
            <div className="space-y-1.5">
              <Label>Itens (um por linha)</Label>
              <Textarea rows={8} value={f.items ?? ""} onChange={set("items")} />
            </div>
          )}
          {block.type === "kpis" && (
            <div className="space-y-1.5">
              <Label>Indicadores (um por linha: rótulo | valor | observação)</Label>
              <Textarea rows={6} value={f.items ?? ""} onChange={set("items")} />
            </div>
          )}
          {block.type === "table" && (
            <div className="space-y-1.5">
              <Label>Tabela (1ª linha = colunas; células separadas por |)</Label>
              <Textarea rows={8} value={f.body ?? ""} onChange={set("body")} />
            </div>
          )}
          {block.type === "callout" && (
            <>
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={f.tone} onValueChange={(v) => setF((p) => ({ ...p, tone: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="destaque">Destaque</SelectItem>
                    <SelectItem value="atencao">Atenção</SelectItem>
                    <SelectItem value="oportunidade">Oportunidade</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Textarea rows={4} value={f.text ?? ""} onChange={set("text")} />
            </>
          )}
          {block.type === "image" && (
            <>
              <div className="space-y-1.5">
                <Label>Legenda</Label>
                <Input value={f.caption ?? ""} onChange={set("caption")} />
              </div>
              <div className="space-y-1.5">
                <Label>Observações (uma por linha)</Label>
                <Textarea rows={6} value={f.items ?? ""} onChange={set("items")} />
              </div>
            </>
          )}
          {block.type === "chart" && (
            <>
              <div className="space-y-1.5">
                <Label>Título</Label>
                <Input value={f.title ?? ""} onChange={set("title")} />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de gráfico</Label>
                <Select value={f.kind} onValueChange={(v) => setF((p) => ({ ...p, kind: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bar">Barras</SelectItem>
                    <SelectItem value="line">Linhas</SelectItem>
                    <SelectItem value="area">Área</SelectItem>
                    <SelectItem value="pie">Pizza</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Texto de destaque</Label>
                <Textarea rows={3} value={f.insight ?? ""} onChange={set("insight")} />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={save}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
