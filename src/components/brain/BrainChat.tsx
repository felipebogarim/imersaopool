// Chat da Inteligência Comercial — mesmo componente na página completa e na janela flutuante,
// na plataforma e no Portal do Representante. A conversa vem do store compartilhado; o escopo é
// sempre resolvido pelo servidor a cada mensagem.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Copy,
  FileText,
  History,
  Loader2,
  MapPin,
  Mic,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Square,
  Trash2,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { aiAuthHeaders } from "@/lib/ai-endpoint-client";
import { transcribeAudioInBrowser } from "@/lib/transcribe-client";
import { extractFileText } from "@/lib/sintese-file-text";
import {
  deleteBrainConversation,
  listBrainConversations,
  renameBrainConversation,
} from "@/lib/brain.functions";
import { sugestoesDoContexto, type ContextoTela } from "@/lib/brain/page-context";
import type { BrainInterface } from "@/lib/brain/types";
import { BrainMarkdown } from "./BrainMarkdown";
import { BrainAvatar } from "./BrainAvatar";
import { brainChat, useBrainChat, type AnexoEnvio, type MsgUi } from "./brain-chat-store";

const MAX_ARQUIVO = 15 * 1024 * 1024;
const MAX_IMAGEM = 5 * 1024 * 1024;

function lerDataUrl(file: File) {
  return new Promise<string>((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => erro(new Error("Falha ao ler a imagem."));
    r.readAsDataURL(file);
  });
}

/** Texto limpo para cópia/áudio (sem blocos de gráfico nem marcação). */
const textoPlano = (md: string) =>
  md
    .replace(/```grafico[\s\S]*?```/gi, "")
    .replace(/[|#*_`>]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export function BrainChat({
  iface,
  variant = "page",
  contexto = null,
  acoes,
}: {
  iface: BrainInterface;
  variant?: "page" | "compact";
  contexto?: ContextoTela | null;
  /** Botões extras no cabeçalho (ex.: controles da janela flutuante). */
  acoes?: ReactNode;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listBrainConversations);
  const renameFn = useServerFn(renameBrainConversation);
  const deleteFn = useServerFn(deleteBrainConversation);
  const st = useBrainChat(iface);
  const compact = variant === "compact";

  const [texto, setTexto] = useState("");
  const [anexos, setAnexos] = useState<AnexoEnvio[]>([]);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const [preparandoAnexo, setPreparandoAnexo] = useState(false);
  const [falando, setFalando] = useState<string | null>(null);

  const recRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fimRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const conversas = useQuery({
    queryKey: ["brain-conversas", iface],
    queryFn: () => listFn({ data: { interface: iface } }),
  });

  useEffect(() => {
    void brainChat.restaurar(iface);
  }, [iface]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [st.msgs]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      if (recRef.current?.state === "recording") recRef.current.stop();
    },
    [],
  );

  // Atualiza a lista de conversas quando uma resposta termina.
  const enviandoAntes = useRef(st.enviando);
  useEffect(() => {
    if (enviandoAntes.current && !st.enviando) {
      void qc.invalidateQueries({ queryKey: ["brain-conversas", iface] });
    }
    enviandoAntes.current = st.enviando;
  }, [st.enviando, iface, qc]);

  async function abrirConversa(id: string) {
    try {
      await brainChat.abrir(iface, id);
      setHistoricoAberto(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível abrir a conversa.");
    }
  }

  function novaConversa() {
    brainChat.nova(iface);
    setAnexos([]);
    setHistoricoAberto(false);
  }

  async function adicionarArquivos(files: FileList | null) {
    if (!files?.length) return;
    setPreparandoAnexo(true);
    try {
      for (const f of Array.from(files)) {
        if (anexos.length >= 5) {
          toast.error("Máximo de 5 anexos por mensagem.");
          break;
        }
        if (f.type.startsWith("image/")) {
          if (f.size > MAX_IMAGEM) {
            toast.error(`${f.name}: imagem acima de 5 MB.`);
            continue;
          }
          const dataUrl = await lerDataUrl(f);
          setAnexos((a) => [...a, { name: f.name, mime: f.type, size: f.size, dataUrl }]);
        } else if (f.type.startsWith("audio/")) {
          setTranscrevendo(true);
          const t = await transcribeAudioInBrowser(f).finally(() => setTranscrevendo(false));
          setTexto((s) => (s ? `${s}\n${t}` : t));
        } else {
          if (f.size > MAX_ARQUIVO) {
            toast.error(`${f.name}: arquivo acima de 15 MB.`);
            continue;
          }
          const text = (await extractFileText(f)).trim();
          if (!text) {
            toast.error(`${f.name}: não foi possível extrair texto.`);
            continue;
          }
          setAnexos((a) => [
            ...a,
            { name: f.name, mime: f.type || "text/plain", size: f.size, text },
          ]);
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao ler o arquivo.");
    } finally {
      setPreparandoAnexo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function alternarGravacao() {
    if (gravando) {
      recRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const partes: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) partes.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setGravando(false);
        setTranscrevendo(true);
        try {
          const t = await transcribeAudioInBrowser(new Blob(partes, { type: rec.mimeType }));
          if (t) setTexto((s) => (s ? `${s} ${t}` : t));
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Falha ao transcrever.");
        } finally {
          setTranscrevendo(false);
        }
      };
      recRef.current = rec;
      rec.start();
      setGravando(true);
    } catch {
      toast.error("Microfone indisponível ou sem permissão.");
    }
  }

  async function ouvir(m: MsgUi) {
    if (falando === m.id) {
      audioRef.current?.pause();
      setFalando(null);
      return;
    }
    audioRef.current?.pause();
    setFalando(m.id);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await aiAuthHeaders()) },
        body: JSON.stringify({ text: textoPlano(m.content).slice(0, 4000) }),
      });
      if (!res.ok) throw new Error("Falha ao gerar áudio.");
      const audio = new Audio(URL.createObjectURL(await res.blob()));
      audioRef.current = audio;
      audio.onended = () => setFalando(null);
      await audio.play();
    } catch (e) {
      setFalando(null);
      toast.error(e instanceof Error ? e.message : "Falha ao gerar áudio.");
    }
  }

  function enviar(pergunta?: string) {
    const message = (pergunta ?? texto).trim();
    if (!message || st.enviando) return;
    const enviados = anexos;
    setTexto("");
    setAnexos([]);
    void brainChat.enviar(iface, message, enviados, contexto);
  }

  async function renomear(id: string, atual: string) {
    const titulo = window.prompt("Novo título da conversa", atual)?.trim();
    if (!titulo) return;
    await renameFn({ data: { interface: iface, id, titulo } }).catch(() =>
      toast.error("Falha ao renomear."),
    );
    void qc.invalidateQueries({ queryKey: ["brain-conversas", iface] });
  }

  async function excluir(id: string) {
    if (!window.confirm("Excluir esta conversa?")) return;
    await deleteFn({ data: { interface: iface, id } }).catch(() =>
      toast.error("Falha ao excluir."),
    );
    if (id === st.conversaId) novaConversa();
    void qc.invalidateQueries({ queryKey: ["brain-conversas", iface] });
  }

  const sugestoes = sugestoesDoContexto(contexto, iface);

  const listaConversas = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b p-3">
        <span className="text-sm font-semibold">Conversas</span>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2 text-xs"
            onClick={novaConversa}
          >
            <Plus className="h-3.5 w-3.5" /> Nova
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className={cn("h-7 w-7", !compact && "md:hidden")}
            aria-label="Fechar histórico"
            onClick={() => setHistoricoAberto(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {!st.persistido && (
          <p className="p-2 text-xs text-muted-foreground">
            Histórico ainda não habilitado (aguardando a migration do Brain).
          </p>
        )}
        {(conversas.data ?? []).map((c) => (
          <div
            key={c.id}
            className={cn(
              "group flex items-center gap-1 rounded-md px-2 py-1.5 text-xs hover:bg-muted",
              c.id === st.conversaId && "bg-muted font-medium",
            )}
          >
            <button
              type="button"
              className="flex-1 truncate text-left"
              onClick={() => void abrirConversa(c.id)}
            >
              {c.titulo}
            </button>
            <button
              type="button"
              aria-label="Renomear"
              className="opacity-60 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              onClick={() => void renomear(c.id, c.titulo)}
            >
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </button>
            <button
              type="button"
              aria-label="Excluir"
              className="opacity-60 hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
              onClick={() => void excluir(c.id)}
            >
              <Trash2 className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        ))}
        {st.persistido && conversas.data?.length === 0 && (
          <p className="p-2 text-xs text-muted-foreground">Nenhuma conversa ainda.</p>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        "relative flex overflow-hidden bg-background",
        compact ? "h-full" : "h-[calc(100vh-9rem)] min-h-[520px] rounded-xl border",
      )}
    >
      {!compact && (
        <aside className="hidden w-60 shrink-0 border-r md:block">{listaConversas}</aside>
      )}
      {historicoAberto && (
        <div className={cn("absolute inset-0 z-20 flex", !compact && "md:hidden")}>
          <div className="w-72 max-w-[85%] border-r bg-background shadow-xl">{listaConversas}</div>
          <button
            type="button"
            aria-label="Fechar"
            className="flex-1 bg-black/30"
            onClick={() => setHistoricoAberto(false)}
          />
        </div>
      )}

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-1.5 border-b px-2 py-1.5 sm:px-3">
          <Button
            size="icon"
            variant="ghost"
            className={cn("h-8 w-8 shrink-0", !compact && "md:hidden")}
            aria-label="Conversas"
            title="Conversas"
            onClick={() => setHistoricoAberto(true)}
          >
            <History className="h-4 w-4" />
          </Button>
          {compact && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 shrink-0"
              aria-label="Nova conversa"
              title="Nova conversa"
              onClick={novaConversa}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
          <BrainAvatar className="h-6 w-6 shrink-0" />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">
              {compact ? "Inteligência" : "Inteligência Comercial"}
            </p>
            <p className="truncate text-[10px] leading-tight text-muted-foreground">
              {iface === "portal" ? "Sua carteira" : "Base comercial Newline"}
            </p>
          </div>
          {compact ? (
            <Button
              size="icon"
              variant={st.analise ? "secondary" : "ghost"}
              className={cn("ml-auto h-7 w-7 shrink-0", st.analise && "text-primary")}
              aria-pressed={st.analise}
              aria-label="Análise aprofundada"
              title={st.analise ? "Análise aprofundada ligada" : "Ligar análise aprofundada"}
              onClick={() => brainChat.setAnalise(iface, !st.analise)}
            >
              <Zap className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <label
              className="ml-auto flex shrink-0 cursor-pointer items-center gap-1 text-[11px] text-muted-foreground"
              title="Usa o modelo de análise aprofundada"
            >
              <input
                type="checkbox"
                checked={st.analise}
                onChange={(e) => brainChat.setAnalise(iface, e.target.checked)}
              />
              Análise aprofundada
            </label>
          )}
          {acoes}
        </div>

        {(contexto?.area || st.contexto) && (
          <div className="flex items-center gap-1 border-b bg-muted/30 px-3 py-1 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">
              Contexto:{" "}
              {st.contexto && st.contexto !== contexto?.area
                ? `${contexto?.area ?? ""} · ${st.contexto}`
                : contexto?.area}
            </span>
          </div>
        )}

        <div className="flex-1 space-y-4 overflow-y-auto p-3 sm:p-4">
          {st.carregando && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Carregando conversa…
            </p>
          )}
          {st.msgs.length === 0 && !st.carregando && (
            <div
              className={cn("mx-auto max-w-xl space-y-4 text-center", compact ? "pt-4" : "pt-8")}
            >
              <BrainAvatar className="mx-auto h-10 w-10" />
              <p className="text-sm text-muted-foreground">
                Pergunte sobre clientes, categorias, metas, atingimento e oportunidades. As
                respostas usam apenas dados do sistema, com período e fonte.
              </p>
              <div className={cn("grid gap-2", !compact && "sm:grid-cols-2")}>
                {sugestoes.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => enviar(s)}
                    className="rounded-lg border px-3 py-2 text-left text-xs hover:bg-muted"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {st.msgs.map((m) => (
            <div
              key={m.id}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "min-w-0 max-w-[min(100%,52rem)] rounded-xl px-3.5 py-2.5",
                  m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/50",
                  m.erro && "border border-destructive/40 bg-destructive/5",
                  m.oculto && "italic text-muted-foreground",
                )}
              >
                {m.role === "user" ? (
                  <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                ) : m.content ? (
                  <BrainMarkdown markdown={m.content} />
                ) : null}
                {!!m.attachments?.length && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {m.attachments.map((a, i) => (
                      <span
                        key={i}
                        className="flex items-center gap-1 rounded bg-black/10 px-1.5 py-0.5 text-[10px]"
                      >
                        <FileText className="h-3 w-3" /> {a.name}
                      </span>
                    ))}
                  </div>
                )}
                {m.status && (
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" /> {m.status}
                  </p>
                )}
                {m.role === "assistant" && !!m.sources?.length && (
                  <div className="mt-2 border-t pt-1.5 text-[10px] text-muted-foreground">
                    <span className="font-semibold">Fontes: </span>
                    {m.sources
                      .map((s) => `${s.tipo} — ${s.descricao}${s.periodo ? ` (${s.periodo})` : ""}`)
                      .join(" · ")}
                  </div>
                )}
                {m.role === "assistant" && m.content && !m.status && !m.erro && !m.oculto && (
                  <div className="mt-1.5 flex gap-1">
                    <button
                      type="button"
                      aria-label="Copiar"
                      title="Copiar"
                      className="rounded p-1 text-muted-foreground hover:bg-muted"
                      onClick={() => {
                        void navigator.clipboard.writeText(m.content);
                        toast.success("Copiado.");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="Ouvir"
                      title="Ouvir"
                      className={cn(
                        "rounded p-1 text-muted-foreground hover:bg-muted",
                        falando === m.id && "text-primary",
                      )}
                      onClick={() => void ouvir(m)}
                    >
                      {falando === m.id ? (
                        <Square className="h-3.5 w-3.5" />
                      ) : (
                        <Volume2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={fimRef} />
        </div>

        <div className="border-t p-2 sm:p-3">
          {!!anexos.length && (
            <div className="mb-2 flex flex-wrap gap-1.5">
              {anexos.map((a, i) => (
                <span
                  key={i}
                  className="flex items-center gap-1 rounded-md border bg-muted/40 px-2 py-0.5 text-xs"
                >
                  <FileText className="h-3 w-3" /> {a.name}
                  <button
                    type="button"
                    aria-label="Remover"
                    onClick={() => setAnexos((x) => x.filter((_, j) => j !== i))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex items-end gap-1 sm:gap-2">
            <input
              ref={fileRef}
              type="file"
              multiple
              hidden
              accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md,image/*,audio/*"
              onChange={(e) => void adicionarArquivos(e.target.files)}
            />
            <Button
              size="icon"
              variant="ghost"
              aria-label="Anexar"
              title="Anexar arquivo"
              disabled={st.enviando || preparandoAnexo}
              onClick={() => fileRef.current?.click()}
            >
              {preparandoAnexo ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Paperclip className="h-4 w-4" />
              )}
            </Button>
            <Button
              size="icon"
              variant={gravando ? "destructive" : "ghost"}
              aria-label={gravando ? "Parar gravação" : "Gravar áudio"}
              title={gravando ? "Parar gravação" : "Gravar áudio"}
              disabled={st.enviando || transcrevendo}
              onClick={() => void alternarGravacao()}
            >
              {transcrevendo ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mic className="h-4 w-4" />
              )}
            </Button>
            <Textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar();
                }
              }}
              placeholder={
                transcrevendo
                  ? "Transcrevendo áudio…"
                  : compact
                    ? "Pergunte…"
                    : "Pergunte à Inteligência Comercial…"
              }
              rows={1}
              className="max-h-40 min-h-[40px] flex-1 resize-none text-sm"
            />
            {st.enviando ? (
              <Button
                size="icon"
                variant="outline"
                aria-label="Interromper"
                title="Interromper"
                onClick={() => brainChat.interromper(iface)}
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                aria-label="Enviar"
                disabled={!texto.trim()}
                onClick={() => enviar()}
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Respostas geradas por IA a partir dos dados do sistema. Confira valores críticos antes
            de decidir.
          </p>
        </div>
      </section>
    </div>
  );
}
