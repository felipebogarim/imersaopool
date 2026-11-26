import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import type { BrainStreamEvent } from "@/lib/brain/types";
import { contextoTelaSchema } from "@/lib/brain/page-context";

// Chat da Inteligência Comercial (SSE). Autenticação e escopo resolvidos no servidor a cada
// requisição; o corpo nunca define permissões (interface só escolhe entre escopos do próprio
// usuário, e o contexto de tela apenas restringe).

const anexo = z.object({
  name: z.string().min(1).max(200),
  mime: z.string().max(120),
  size: z.number().int().nonnegative().optional(),
  text: z.string().max(400_000).optional(),
  dataUrl: z
    .string()
    .max(8_000_000)
    .regex(/^data:image\/(png|jpe?g|webp|gif);base64,/)
    .optional(),
});

const corpo = z.object({
  interface: z.enum(["plataforma", "portal"]),
  conversationId: z.string().uuid().nullable().optional(),
  message: z.string().trim().min(1).max(8000),
  attachments: z.array(anexo).max(5).optional(),
  analise: z.boolean().optional(),
  contexto: contextoTelaSchema.nullable().optional(),
});

const json = (body: unknown, status: number) => Response.json(body, { status });

export const Route = createFileRoute("/api/brain/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const brain = await import("@/lib/brain/brain.server");
        const store = await import("@/lib/brain/store.server");
        const { executarTurno, mensagemUsuario, PROMPT_VERSAO } =
          await import("@/lib/brain/orchestrator");
        const { chatRound } = await import("@/lib/brain/llm");
        const { obterContexto } = await import("@/lib/brain/cache.server");
        const { resolverContextoTela } = await import("@/lib/brain/contexto.server");

        const auth = request.headers.get("authorization") ?? "";
        const jwt = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
        const userId = await brain.usuarioDoJwt(jwt);
        if (!userId) return json({ error: "Não autenticado." }, 401);

        let body: z.infer<typeof corpo>;
        try {
          body = corpo.parse(await request.json());
        } catch {
          return json({ error: "Requisição inválida." }, 400);
        }

        const acesso = await brain.resolverAcesso(userId, brain.userClient(jwt), body.interface);
        if (!acesso.ok) return json({ error: acesso.motivo }, 403);
        const scope = acesso.scope;
        const settings = acesso.settings;

        if (
          settings.persistencia &&
          (await store.mensagensHoje(userId)) >= settings.limite_mensagens_dia
        ) {
          return json({ error: "Limite diário de mensagens atingido." }, 429);
        }

        const key = process.env.LOVABLE_API_KEY;
        if (!key) return json({ error: "Serviço de IA indisponível." }, 503);
        const modelo = body.analise ? settings.modelo_analise : settings.modelo_padrao;

        const controller = new AbortController();
        request.signal?.addEventListener("abort", () => controller.abort());
        const encoder = new TextEncoder();

        const stream = new ReadableStream<Uint8Array>({
          async start(ctrl) {
            const emit = (e: BrainStreamEvent) => {
              try {
                ctrl.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));
              } catch {
                // conexão encerrada
              }
            };
            let conversaId: string | null = null;
            let persistido = settings.persistencia;
            let resposta = "";
            let ferramentas: Array<{ nome: string; ok: boolean }> = [];
            let tin = 0;
            let tout = 0;
            const ctx = await obterContexto(scope, jwt).catch(() => null);
            if (!ctx) {
              emit({ type: "error", message: "Não foi possível carregar a base comercial." });
              ctrl.close();
              return;
            }
            try {
              let historico: Awaited<ReturnType<typeof store.historicoParaModelo>> = [];
              if (persistido) {
                try {
                  if (body.conversationId) {
                    const conv = await store.conversaDoUsuario(
                      userId,
                      body.conversationId,
                      body.interface,
                    );
                    if (!conv) throw new Error("Conversa não encontrada.");
                    conversaId = conv.id;
                    const permitidos =
                      scope.kind === "representante"
                        ? new Set(ctx.carteira.map((c) => c.nomeNorm))
                        : null;
                    historico = store.historicoParaModelo(
                      await store.mensagensDaConversa(conversaId, permitidos),
                    );
                  } else {
                    conversaId = await store.criarConversa(userId, body.interface, body.message);
                  }
                  await store.salvarMensagem({
                    conversaId,
                    userId,
                    role: "user",
                    content: body.message,
                    attachments: body.attachments?.map((a) => ({
                      name: a.name,
                      mime: a.mime,
                      size: a.size,
                      text: a.text,
                    })),
                    retencaoAnexosDias: settings.retencao_anexos_dias,
                  });
                } catch (e) {
                  if (e instanceof store.StoreIndisponivel) persistido = false;
                  else throw e;
                }
              }
              const tela = await resolverContextoTela(ctx, body.contexto, jwt);
              emit({
                type: "meta",
                conversationId: conversaId,
                persisted: persistido,
                contexto: tela.rotulo,
              });

              const turno = await executarTurno({
                ctx,
                historico,
                pergunta: mensagemUsuario(body.message, body.attachments ?? []),
                modelo,
                contextoTela: tela.texto,
                signal: controller.signal,
                emit: (e) => {
                  if (e.type === "text") resposta += e.delta;
                  emit(e);
                },
                rodada: (req) =>
                  chatRound({
                    ...req,
                    url: "https://ai.gateway.lovable.dev/v1/chat/completions",
                    apiKey: key,
                  }),
              });
              ferramentas = turno.ferramentas;
              tin = turno.tokensEntrada;
              tout = turno.tokensSaida;

              let messageId: string | null = null;
              const nomes = ctx.carteira
                .filter((c) => ctx.clientesAcessados.has(c.id))
                .map((c) => c.nomeNorm);
              if (persistido && conversaId) {
                messageId = await store.salvarMensagem({
                  conversaId,
                  userId,
                  role: "assistant",
                  content: resposta || "(sem resposta)",
                  sources: ctx.fontes,
                  clientesRef: nomes,
                  modelo: `${modelo} · ${PROMPT_VERSAO}`,
                  tokensEntrada: tin,
                  tokensSaida: tout,
                  retencaoAnexosDias: settings.retencao_anexos_dias,
                });
              }
              emit({ type: "done", messageId });
              await store.auditar({
                scope,
                iface: body.interface,
                conversaId,
                ferramentas,
                clientes: nomes,
                modelo,
                tokensEntrada: tin,
                tokensSaida: tout,
                status: "ok",
              });
            } catch (e) {
              const cancelado = controller.signal.aborted;
              if (cancelado && persistido && conversaId && resposta) {
                await store
                  .salvarMensagem({
                    conversaId,
                    userId,
                    role: "assistant",
                    content: `${resposta}\n\n_(resposta interrompida)_`,
                    sources: ctx.fontes,
                    retencaoAnexosDias: settings.retencao_anexos_dias,
                  })
                  .catch(() => undefined);
              }
              if (!cancelado) {
                console.error("[brain] falha no turno", e);
                emit({
                  type: "error",
                  message:
                    e instanceof Error && /Limite|provedor|Conversa/.test(e.message)
                      ? e.message
                      : "Não foi possível concluir a resposta.",
                });
              }
              await store.auditar({
                scope,
                iface: body.interface,
                conversaId,
                ferramentas,
                clientes: [],
                modelo,
                tokensEntrada: tin,
                tokensSaida: tout,
                status: cancelado ? "cancelado" : "erro",
                detalhe: e instanceof Error ? e.message : undefined,
              });
            } finally {
              try {
                ctrl.close();
              } catch {
                // já fechado
              }
            }
          },
          cancel() {
            controller.abort();
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-store",
            "X-Accel-Buffering": "no",
          },
        });
      },
    },
  },
});
