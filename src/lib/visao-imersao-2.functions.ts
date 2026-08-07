import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const submitImmersion2Upload = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({
    markdown: z.string(),
    fileName: z.string(),
  }).parse(data))
  .handler(async ({ data }) => {
    // Implementação futura de processamento no servidor se necessário
    // Por enquanto, a lógica é cliente-side para validação rápida
    return { success: true };
  });
