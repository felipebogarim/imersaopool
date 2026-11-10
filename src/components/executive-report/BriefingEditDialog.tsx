import { useEffect, useState } from "react";
import { X } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import type { ExecutiveClient } from "@/lib/executive-report/types";

const FIELDS: { key: keyof ExecutiveClient; label: string }[] = [
  { key: "display_name", label: "Razão social" },
  { key: "trade_name", label: "Nome fantasia" },
  { key: "location", label: "Local" },
  { key: "representative", label: "Representante" },
  { key: "consultant", label: "Consultor" },
  { key: "category", label: "Categoria comercial" },
  { key: "attainment", label: "Atingimento geral" },
];

/** Aceita ISO (yyyy-mm-dd) ou dd/mm/aaaa; devolve ISO ou "". */
function toIsoDate(v?: string | null): string {
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const m = v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

export function BriefingEditDialog({
  open,
  onOpenChange,
  client,
  brands,
  busy,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client: ExecutiveClient;
  brands: string[];
  busy?: boolean;
  onSave: (client: ExecutiveClient, brands: string[]) => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({});
  const [visit, setVisit] = useState("");
  const [list, setList] = useState<string[]>([]);
  const [newBrand, setNewBrand] = useState("");

  useEffect(() => {
    if (!open) return;
    setForm(Object.fromEntries(FIELDS.map((f) => [f.key, (client[f.key] as string | null) ?? ""])));
    setVisit(toIsoDate(client.visit_date));
    setList(brands);
    setNewBrand("");
  }, [open, client, brands]);

  function addBrand() {
    const b = newBrand.trim();
    if (b && !list.some((x) => x.toLowerCase() === b.toLowerCase())) setList([...list, b]);
    setNewBrand("");
  }

  function save() {
    const manual = new Set(client.manual_fields ?? []);
    const next: ExecutiveClient = { ...client, manual_fields: [] };
    for (const f of FIELDS) {
      const v = (form[f.key] ?? "").trim();
      if (v !== ((client[f.key] as string | null) ?? "").trim()) manual.add(f.key);
      (next as Record<string, unknown>)[f.key] = v || null;
    }
    next.display_name = (form.display_name ?? "").trim();
    next.visit_date = visit || null;
    next.manual_fields = [...manual];
    const pending = newBrand.trim();
    const finalBrands =
      pending && !list.some((x) => x.toLowerCase() === pending.toLowerCase())
        ? [...list, pending]
        : list;
    onSave(next, finalBrands);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar briefing executivo</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label>{f.label}</Label>
              <Input
                value={form[f.key] ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
              />
            </div>
          ))}
          <div className="space-y-1">
            <Label>Data da imersão</Label>
            <Input type="date" value={visit} onChange={(e) => setVisit(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Marcas observadas</Label>
          <div className="flex flex-wrap gap-1.5">
            {list.map((b) => (
              <Badge key={b} variant="outline" className="gap-1 pr-1">
                {b}
                <button
                  type="button"
                  aria-label={`Remover ${b}`}
                  onClick={() => setList(list.filter((x) => x !== b))}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            {!list.length && <span className="text-xs text-muted-foreground">Nenhuma marca.</span>}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Adicionar marca"
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addBrand();
                }
              }}
            />
            <Button type="button" variant="outline" onClick={addBrand}>
              Adicionar
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={busy} onClick={save}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
