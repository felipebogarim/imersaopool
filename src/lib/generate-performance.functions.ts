import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isClientRow } from "./client-row-filter";

type SheetPayload = {
  filename: string;
  sheetName: string;
  // Matriz de linhas x colunas já em formato "planilha" (strings/numbers).
  // O cliente extrai a partir do .xlsx e envia. Nenhum arquivo bruto é armazenado.
  aoa: (string | number | null)[][];
};

type FarolStatus =
  | "sem_compra"
  | "abaixo_meta"
  | "pode_melhorar"
  | "proximo"
  | "otimo"
  | "excelente";

export type GeneratedRow = {
  razao_social: string;
  categoria: string | null;
  total_meta: number | null;
  total_pct: number | null;
  total_pct_status: FarolStatus | null;
  metas: Record<string, number>;
  realizado: Record<string, number>;
  media: Record<string, number>;
  familia_pct: Record<string, number>;
  metas_status: Record<string, FarolStatus>;
};

export type GeneratedPerformance = {
  familias: string[];
  categoria_metas?: Record<string, number | Record<string, Record<string, number>>>;
  rows: GeneratedRow[];
  observacoes?: string;
};

export const generatePerformanceFromRaw = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      sheets: SheetPayload[];
      periodoLabel?: string | null;
      hint?: string | null;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY ausente");
    if (!data.sheets?.length) throw new Error("Nenhuma planilha enviada.");

    // Registra acesso a dados sensíveis (upload de planilha bruta no gerador)
    try {
      await context.supabase.rpc("log_sensitive_access", {
        _recurso: "gerador_performance:upload",
        _acao: "upload_planilha_bruta",
        _metadata: {
          arquivos: data.sheets.map((s) => ({
            filename: s.filename,
            aba: s.sheetName,
            linhas: s.aoa?.length ?? 0,
          })),
          periodo: data.periodoLabel ?? null,
        } as any,
        _nivel_risco: "alto",
      });
    } catch { /* não bloquear o fluxo por falha de log */ }


    // Compacta cada planilha limitando linhas para caber no contexto.
    const MAX_ROWS = 400;
    const MAX_COLS = 40;
    const compact = data.sheets.map((s) => ({
      arquivo: s.filename,
      aba: s.sheetName,
      linhas: (s.aoa || []).slice(0, MAX_ROWS).map((row) =>
        (row || []).slice(0, MAX_COLS).map((v) => (v == null ? "" : String(v).slice(0, 120))),
      ),
    }));

    const schema = `{
  "familias": string[],
  "categoria_metas": {
    "Black"?: number,
    "Gold"?: number,
    "Silver"?: number,
    "__family_metas_by_category__"?: {
      [categoria: string]: { [familia: string]: number }
    }
  },
  "rows": [
    {
      "razao_social": string,
      "categoria": "Black"|"Gold"|"Silver"|"Bronze"|"Diamond"|"Platinum"|null,
      "total_meta": number|null,
      "total_pct": number|null,
      "total_pct_status": "sem_compra"|"abaixo_meta"|"pode_melhorar"|"proximo"|"otimo"|"excelente"|null,
      "metas": { [familia: string]: number },
      "realizado": { [familia: string]: number },
      "media": { [familia: string]: number },
      "familia_pct": { [familia: string]: number },
      "metas_status": { [familia: string]: "sem_compra"|"abaixo_meta"|"pode_melhorar"|"proximo"|"otimo"|"excelente" }
    }
  ],
  "observacoes": string
}`;

    const prompt = `Você recebe UMA OU MAIS planilhas brutas (contendo dados de metas e realizações por cliente e por família de produto de representantes comerciais). Sua tarefa é EXTRAIR e CONSOLIDAR os dados no formato canônico da planilha "Performance", mesmo que os dados estejam espalhados em várias abas/arquivos.

Regras:
- Descubra a lista de FAMÍLIAS DE PRODUTO (colunas).
- Para cada CLIENTE (razão social), extraia:
  - "categoria" (Black/Gold/Silver/Bronze/Diamond/Platinum), se existir; senão null.
  - "total_meta": meta total do cliente no período (número). Se não existir, null.
  - Por família, extraia somente números realmente presentes: meta em "metas", realizado em "realizado", R$ MÉDIA em "media" e percentual explícito em "familia_pct" (ratio: 1 = 100%). Não invente valores e não preencha ausências com zero.
  - Calcule cada percentual nesta ordem: percentual explícito; realizado ÷ meta; R$ MÉDIA ÷ meta. Se existir somente meta, omita o percentual e o status (N/D). Retorne 0 somente quando realizado ou média for numericamente zero e meta for positiva.
  - "metas_status[fam]" é apenas consequência do percentual numérico calculado:
     * exatamente 0% => "sem_compra"
     * <50% => "abaixo_meta"
     * 50-69% => "pode_melhorar"
     * 70-89% => "proximo"
     * 90-100% => "otimo"
     * >100% => "excelente"
    Ignore completamente cores, preenchimentos, estilos, RGB, HEX e faixas textuais.
  - "total_pct" segue a mesma precedência numérica e "total_pct_status" deriva exclusivamente dele.
- IMPORTANTE: os valores brutos retornados serão mantidos em armazenamento privado e nunca exibidos ao usuário.
- IMPORTANTE: preserve as metas financeiras originais por família. Se a planilha visual consolidada mostrar apenas faixas nas células, mas houver uma matriz/configuração de metas por categoria (ex.: Black/Gold/Silver) em outra aba ou área, preencha "categoria_metas.__family_metas_by_category__[categoria][familia]" com esses valores absolutos em R$.
- "categoria_metas.Black/Gold/Silver" deve conter o total de meta da categoria, quando conhecido.
- Não use participação global de famílias como substituto para metas financeiras por categoria.
- Se a mesma "razão social" aparecer em várias abas, consolide em UMA linha.
- Se a planilha for ambígua, use o campo "observacoes" para explicar suposições.
- Retorne APENAS JSON válido no schema abaixo. Sem markdown, sem comentários.

Schema esperado:
${schema}

${data.periodoLabel ? `Período informado pelo usuário: ${data.periodoLabel}\n` : ""}${data.hint ? `Contexto adicional do usuário: ${data.hint}\n` : ""}
Dados brutos (JSON, uma entrada por aba de planilha):
${JSON.stringify(compact).slice(0, 180000)}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: "Você retorna somente JSON válido, sem markdown." },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      if (res.status === 429) throw new Error("Limite de uso IA atingido. Tente novamente em instantes.");
      if (res.status === 402) throw new Error("Créditos de IA esgotados. Adicione créditos na workspace.");
      throw new Error(`Falha IA: ${res.status} ${t.slice(0, 200)}`);
    }
    const json = await res.json();
    const raw = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: GeneratedPerformance;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("IA retornou JSON inválido");
    }
    // Sanitiza mínimo
    parsed.familias = Array.isArray(parsed.familias) ? parsed.familias.map(String) : [];
    parsed.categoria_metas =
      parsed.categoria_metas && typeof parsed.categoria_metas === "object" ? parsed.categoria_metas : {};
    parsed.rows = Array.isArray(parsed.rows) ? parsed.rows : [];
    // Descarta linhas de totalização/legenda e sem categoria — nunca são clientes.
    parsed.rows = parsed.rows.filter((r: any) => isClientRow(r));
    return parsed;
  });
