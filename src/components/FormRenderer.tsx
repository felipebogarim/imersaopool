import { useState } from "react";
import type { FormField, FormSchema } from "@/lib/form-schema";
import { validateAnswers } from "@/lib/form-schema";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  schema: FormSchema;
  onSubmit: (answers: Record<string, unknown>) => Promise<void> | void;
  submitLabel?: string;
  disabled?: boolean;
};

export function FormRenderer({ schema, onSubmit, submitLabel = "Enviar", disabled }: Props) {
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function setVal(id: string, v: unknown) {
    setValues((s) => ({ ...s, [id]: v }));
  }

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    const errs = validateAnswers(schema, values);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSubmitting(true);
    try {
      await onSubmit(values);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handle} className="space-y-5">
      {schema.fields.map((f) => (
        <FieldRow key={f.id} field={f} value={values[f.id]} error={errors[f.id]} onChange={(v) => setVal(f.id, v)} />
      ))}
      {schema.fields.length === 0 && (
        <p className="text-sm text-muted-foreground">Este formulário ainda não tem campos.</p>
      )}
      <Button type="submit" disabled={disabled || submitting || schema.fields.length === 0}>
        {submitting ? "Enviando…" : submitLabel}
      </Button>
    </form>
  );
}

function FieldRow({
  field,
  value,
  error,
  onChange,
}: {
  field: FormField;
  value: unknown;
  error?: string;
  onChange: (v: unknown) => void;
}) {
  const id = `f_${field.id}`;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {field.label}
        {field.required && <span className="text-destructive"> *</span>}
      </Label>
      {renderInput(field, id, value, onChange)}
      {field.help && <p className="text-xs text-muted-foreground">{field.help}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function renderInput(field: FormField, id: string, value: unknown, onChange: (v: unknown) => void) {
  switch (field.type) {
    case "textarea":
      return <Textarea id={id} value={(value as string) ?? ""} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
    case "email":
      return <Input id={id} type="email" value={(value as string) ?? ""} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
    case "number":
      return <Input id={id} type="number" value={(value as string) ?? ""} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
    case "date":
      return <Input id={id} type="date" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} />;
    case "select":
      return (
        <Select value={(value as string) ?? ""} onValueChange={onChange}>
          <SelectTrigger id={id}><SelectValue placeholder={field.placeholder || "Selecione…"} /></SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((o) => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "radio":
      return (
        <RadioGroup value={(value as string) ?? ""} onValueChange={onChange}>
          {(field.options ?? []).map((o) => (
            <div key={o.value} className="flex items-center gap-2">
              <RadioGroupItem id={`${id}_${o.value}`} value={o.value} />
              <Label htmlFor={`${id}_${o.value}`} className="font-normal">{o.label}</Label>
            </div>
          ))}
        </RadioGroup>
      );
    case "checkbox": {
      const arr = (value as string[] | undefined) ?? [];
      if ((field.options ?? []).length === 0) {
        return (
          <div className="flex items-center gap-2">
            <Checkbox id={id} checked={Boolean(value)} onCheckedChange={(c) => onChange(Boolean(c))} />
            <Label htmlFor={id} className="font-normal">{field.placeholder || "Sim"}</Label>
          </div>
        );
      }
      return (
        <div className="space-y-1">
          {(field.options ?? []).map((o) => {
            const checked = arr.includes(o.value);
            return (
              <div key={o.value} className="flex items-center gap-2">
                <Checkbox
                  id={`${id}_${o.value}`}
                  checked={checked}
                  onCheckedChange={(c) => {
                    const next = new Set(arr);
                    if (c) next.add(o.value); else next.delete(o.value);
                    onChange(Array.from(next));
                  }}
                />
                <Label htmlFor={`${id}_${o.value}`} className="font-normal">{o.label}</Label>
              </div>
            );
          })}
        </div>
      );
    }
    default:
      return <Input id={id} value={(value as string) ?? ""} placeholder={field.placeholder} onChange={(e) => onChange(e.target.value)} />;
  }
}
