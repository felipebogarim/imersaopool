import type { FormField, FormSchema, FieldType } from "@/lib/form-schema";
import { FIELD_TYPES, slugify } from "@/lib/form-schema";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Plus, ArrowUp, ArrowDown } from "lucide-react";

const TYPE_LABEL: Record<FieldType, string> = {
  text: "Texto curto",
  textarea: "Texto longo",
  email: "E-mail",
  number: "Número",
  select: "Lista suspensa",
  radio: "Escolha única",
  checkbox: "Múltipla escolha",
  date: "Data",
};

function needsOptions(t: FieldType) {
  return t === "select" || t === "radio" || t === "checkbox";
}

export function FormBuilder({
  value,
  onChange,
}: {
  value: FormSchema;
  onChange: (v: FormSchema) => void;
}) {
  const fields = value.fields;

  function update(idx: number, patch: Partial<FormField>) {
    const next = fields.map((f, i) => (i === idx ? { ...f, ...patch } : f));
    onChange({ fields: next });
  }
  function remove(idx: number) {
    onChange({ fields: fields.filter((_, i) => i !== idx) });
  }
  function move(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= fields.length) return;
    const next = [...fields];
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange({ fields: next });
  }
  function add() {
    const base = `campo_${fields.length + 1}`;
    onChange({
      fields: [
        ...fields,
        { id: base, label: "Novo campo", type: "text", required: false, placeholder: "", help: "", options: [] },
      ],
    });
  }

  return (
    <div className="space-y-4">
      {fields.map((f, idx) => (
        <div key={idx} className="border rounded-lg p-4 space-y-3 bg-card">
          <div className="flex items-start gap-2">
            <div className="flex-1 grid grid-cols-1 md:grid-cols-[1fr_1fr_180px] gap-2">
              <div>
                <Label className="text-xs">Rótulo</Label>
                <Input
                  value={f.label}
                  onChange={(e) => {
                    const label = e.target.value;
                    update(idx, { label, id: f.id || slugify(label) });
                  }}
                />
              </div>
              <div>
                <Label className="text-xs">ID (snake_case)</Label>
                <Input value={f.id} onChange={(e) => update(idx, { id: slugify(e.target.value) })} />
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={f.type} onValueChange={(v) => update(idx, { type: v as FieldType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FIELD_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Button type="button" size="icon" variant="ghost" onClick={() => move(idx, -1)} title="Subir"><ArrowUp className="h-4 w-4" /></Button>
              <Button type="button" size="icon" variant="ghost" onClick={() => move(idx, 1)} title="Descer"><ArrowDown className="h-4 w-4" /></Button>
              <Button type="button" size="icon" variant="ghost" onClick={() => remove(idx)} title="Remover"><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Placeholder</Label>
              <Input value={f.placeholder ?? ""} onChange={(e) => update(idx, { placeholder: e.target.value })} />
            </div>
            <div>
              <Label className="text-xs">Texto de ajuda</Label>
              <Input value={f.help ?? ""} onChange={(e) => update(idx, { help: e.target.value })} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={f.required} onCheckedChange={(c) => update(idx, { required: c })} />
            <Label className="text-sm">Obrigatório</Label>
          </div>

          {needsOptions(f.type) && (
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs">Opções</Label>
              {(f.options ?? []).map((o, oi) => (
                <div key={oi} className="flex gap-2">
                  <Input
                    placeholder="Rótulo"
                    value={o.label}
                    onChange={(e) => {
                      const opts = [...(f.options ?? [])];
                      opts[oi] = { ...opts[oi], label: e.target.value, value: opts[oi].value || slugify(e.target.value) };
                      update(idx, { options: opts });
                    }}
                  />
                  <Input
                    placeholder="value"
                    value={o.value}
                    onChange={(e) => {
                      const opts = [...(f.options ?? [])];
                      opts[oi] = { ...opts[oi], value: slugify(e.target.value) };
                      update(idx, { options: opts });
                    }}
                    className="w-40"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      const opts = (f.options ?? []).filter((_, k) => k !== oi);
                      update(idx, { options: opts });
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const opts = [...(f.options ?? []), { value: `opt_${(f.options?.length ?? 0) + 1}`, label: "Nova opção" }];
                  update(idx, { options: opts });
                }}
              >
                <Plus className="h-4 w-4 mr-1" /> Adicionar opção
              </Button>
            </div>
          )}
        </div>
      ))}

      <Button type="button" variant="outline" onClick={add}>
        <Plus className="h-4 w-4 mr-1" /> Adicionar campo
      </Button>
    </div>
  );
}
