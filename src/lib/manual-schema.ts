import { z } from "zod";

export const ManualBlockSchema = z.object({
  titulo: z.string().default(""),
  texto: z.string().default(""),
  passos: z.array(z.string()).default([]),
  dicas: z.array(z.string()).default([]),
});
export type ManualBlock = { titulo: string; texto: string; passos: string[]; dicas: string[] };

export const ManualContentSchema = z.object({
  subtitulo: z.string().default(""),
  resumo: z.string().default(""),
  publico_alvo: z.string().default(""),
  pre_requisitos: z.array(z.string()).default([]),
  secoes: z.array(ManualBlockSchema).default([]),
  faq: z.array(z.object({ pergunta: z.string().default(""), resposta: z.string().default("") })).default([]),
});
export type ManualContent = {
  subtitulo: string;
  resumo: string;
  publico_alvo: string;
  pre_requisitos: string[];
  secoes: ManualBlock[];
  faq: { pergunta: string; resposta: string }[];
};

export function slugifyManual(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
