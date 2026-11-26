// Cliente de chat com streaming e "function calling" no formato OpenAI (Lovable AI Gateway).
// Independente de provedor: troca-se a URL/modelo pela configuração (brain_settings).

export type LlmMessage =
  | {
      role: "system" | "user" | "assistant";
      content: string | LlmContentPart[] | null;
      tool_calls?: LlmToolCall[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

export type LlmContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type LlmToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type LlmRoundResult = {
  content: string;
  toolCalls: LlmToolCall[];
  usage: { prompt_tokens?: number; completion_tokens?: number } | null;
};

export type LlmRequest = {
  url: string;
  apiKey: string;
  model: string;
  messages: LlmMessage[];
  tools?: unknown[];
  signal?: AbortSignal;
  onText?: (delta: string) => void;
};

type StreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string | null;
      tool_calls?: Array<{
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }>;
    };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
};

/** Acumula os deltas de um stream (texto e tool_calls fatiados por índice). */
export function createStreamAccumulator(onText?: (d: string) => void) {
  let content = "";
  const calls: Array<{ id: string; name: string; args: string }> = [];
  let usage: LlmRoundResult["usage"] = null;
  return {
    push(chunk: StreamChunk) {
      if (chunk.usage) usage = chunk.usage;
      const delta = chunk.choices?.[0]?.delta;
      if (!delta) return;
      if (delta.content) {
        content += delta.content;
        onText?.(delta.content);
      }
      for (const tc of delta.tool_calls ?? []) {
        const i = tc.index ?? calls.length;
        calls[i] ??= { id: "", name: "", args: "" };
        if (tc.id) calls[i].id = tc.id;
        if (tc.function?.name) calls[i].name += tc.function.name;
        if (tc.function?.arguments) calls[i].args += tc.function.arguments;
      }
    },
    result(): LlmRoundResult {
      return {
        content,
        toolCalls: calls
          .filter((c) => c && c.name)
          .map((c, i) => ({
            id: c.id || `call_${i}`,
            type: "function" as const,
            function: { name: c.name, arguments: c.args || "{}" },
          })),
        usage,
      };
    },
  };
}

/** Lê um corpo SSE ("data: {...}\n\n") entregando cada JSON. */
export async function readSse(body: ReadableStream<Uint8Array>, onJson: (j: unknown) => void) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, idx).trim();
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        onJson(JSON.parse(data));
      } catch {
        // linha parcial/ruído: ignora
      }
    }
  }
}

export class LlmHttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Uma rodada de chat com streaming. */
export async function chatRound(req: LlmRequest): Promise<LlmRoundResult> {
  const res = await fetch(req.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${req.apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: req.model,
      messages: req.messages,
      ...(req.tools?.length ? { tools: req.tools, tool_choice: "auto" } : {}),
      stream: true,
      stream_options: { include_usage: true },
    }),
    signal: req.signal,
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    console.error("[brain] falha no provedor de IA", res.status, detail.slice(0, 500));
    throw new LlmHttpError(
      res.status,
      res.status === 429 ? "Limite de uso da IA atingido." : "Falha no provedor de IA.",
    );
  }
  const acc = createStreamAccumulator(req.onText);
  await readSse(res.body, (j) => acc.push(j as StreamChunk));
  return acc.result();
}
