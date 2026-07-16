import { z } from "zod";

export const FIELD_TYPES = [
  "text",
  "textarea",
  "email",
  "number",
  "select",
  "radio",
  "checkbox",
  "date",
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FieldOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
});

export const FormFieldSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(FIELD_TYPES),
  required: z.boolean().default(false),
  placeholder: z.string().optional().default(""),
  help: z.string().optional().default(""),
  options: z.array(FieldOptionSchema).optional().default([]),
});
export type FormField = z.infer<typeof FormFieldSchema>;

export const FormSchemaSchema = z.object({
  fields: z.array(FormFieldSchema).default([]),
});
export type FormSchema = z.infer<typeof FormSchemaSchema>;

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export const RESERVED_SLUGS = new Set([
  "admin", "api", "auth", "app", "f", "r",
  "dashboard", "imersoes", "entrevistas", "perspectivas", "compilacoes",
  "planos", "clientes", "produtos", "familias", "roteiros", "agentes",
  "price", "projecao", "representantes", "empresas", "novo-corp",
  "permissoes", "forms", "nda", "evento", "backup",
]);

export function validateAnswers(schema: FormSchema, answers: Record<string, unknown>) {
  const errors: Record<string, string> = {};
  for (const f of schema.fields) {
    const v = answers[f.id];
    const empty =
      v === undefined ||
      v === null ||
      (typeof v === "string" && v.trim() === "") ||
      (Array.isArray(v) && v.length === 0);
    if (f.required && empty) {
      errors[f.id] = "Obrigatório";
      continue;
    }
    if (empty) continue;
    if (f.type === "email" && typeof v === "string" && !/^\S+@\S+\.\S+$/.test(v)) {
      errors[f.id] = "E-mail inválido";
    }
    if (f.type === "number" && typeof v === "string" && v !== "" && Number.isNaN(Number(v))) {
      errors[f.id] = "Número inválido";
    }
  }
  return errors;
}
