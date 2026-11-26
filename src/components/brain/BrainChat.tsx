// Chat da Inteligência Comercial — mesmo componente na plataforma e no Portal do Representante.
// O escopo NÃO é decidido aqui: o servidor resolve a partir da sessão a cada mensagem.

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Copy,
  FileText,
  History,
  Loader2,
  Mic,
  Paperclip,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Square,
  Trash2,
  Volume2,
  X,
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
  getBrainConversation,
  listBrainConversations,
  renameBrainConversation,
} from "@/lib/brain.functions";
import type {
  BrainAttachmentInput,
  BrainInterface,
  BrainMessage,
  BrainSource,
  BrainStreamEvent,
} from "@/lib/brain/types";
import { BrainMarkdown } from "./BrainMarkdown";

type Anexo = BrainAttachmentInput & { size: number };
type MsgUi = BrainMessage & { status?: string; erro?: boolean };

const MAX_ARQUIVO = 15 * 1024 * 1024;
const MAX_IMAGEM = 5 * 1024 * 1024;

const SUGESTOES: Record<BrainInterface, string[]> = {
  plataforma: [
    "Resumo da carteira por representante",
    "Quais clientes Gold estão em risco de cair de categoria?",
    "Top 10 clientes por média mensal de compras",
    "Clientes com oportunidade de subir para Black",
  ],
  portal: [
    "Resumo da minha carteira",
    "Quais clientes meus estão em risco de cair de categoria?",
    "Quanto falta para meus clientes Gold manterem a categoria?",
    "Quais clientes têm o menor atingimento?",
  ],
};

function lerDataUrl(file: File) {
  return new Promise<string>((ok, erro) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => erro(new Error("Falha ao ler a imagem."));
    r.readAsDataURL(file);
  });
}

export function BrainChat({ iface }: { iface: BrainInterface }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listBrainConversations);
  const getFn = useServerFn(getBrainConversation);
  const renameFn = useServerFn(renameBrainConversation);
  const deleteFn = useServerFn(deleteBrainConversation);

  const [conversaId, setConversaId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<MsgUi[]>([]);
  const [texto, setTexto] = useState("");
  const [anexos, setAnexos] = useState<Anexo[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [analise, setAnalise] = useState(false);
  const [persistido, setPersistido] = useState(true);
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [transcrevendo, setTranscrevendo] = useState(false);
  const [preparandoAnexo, setPreparandoAnexo] = useState(false);
  const [falando, setFalando] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fimRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const conversas = useQuery({
    queryKey: ["brain-conversas", iface],
    queryFn: () => listFn({ data: { interface: iface } }),
  });

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [msgs]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      audioRef.current?.pause();
    },
    [],
  );

  async function abrirConversa(id: string) {
    if (enviando) return;
    try {
      const m = await getFn({ data: { interface: iface, id } });
      setConversaId(id);
      setMsgs(m);
      setHistoricoAberto(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível abrir a conversa.");
    }
  }

  function novaConversa() {
    if (enviando) abortRef.current?.abort();
    setConversaId(null);
    setMsgs([]);
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
      rec.ondataavailable = (e) => e.data.size && partes.push(e.data);
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
      const limpo = m.content
        .replace(/[|#*_`>-]+/g, " ")
        .replace(/\s+/g, " ")
        .slice(0, 4000);
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await aiAuthHeaders()) },
        body: JSON.stringify({ text: limpo }),
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

  async function enviar(pergunta?: string) {
    const message = (pergunta ?? texto).trim();
    if (!message || enviando) return;
    const idUser = `u${Date.now()}`;
    const idBot = `a${Date.now()}`;
    const enviados = anexos;
    setMsgs((m) => [
      ...m,
      {
        id: idUser,
        role: "user",
        content: message,
        attachments: enviados.map((a) => ({ name: a.name, mime: a.mime })),
        created_at: new Date().toISOString(),
      },
      {
        id: idBot,
        role: "assistant",
        content: "",
        created_at: new Date().toISOString(),
        status: "Pensando…",
      },
    ]);
    setTexto("");
    setAnexos([]);
    setEnviando(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const atualizar = (f: (m: MsgUi) => MsgUi) =>
      setMsgs((ms) => ms.map((m) => (m.id === idBot ? f(m) : m)));

    try {
      const res = await fetch("/api/brain/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await aiAuthHeaders()) },
        body: JSON.stringify({
          interface: iface,
          conversationId: conversaId,
          message,
          analise,
          attachments: enviados.map(({ name, mime, size, text, dataUrl }) => ({
            name,
            mime,
            size,
            text,
            dataUrl,
          })),
        }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Não foi possível obter resposta.");
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const bloco = buf.slice(0, idx).trim();
          buf = buf.slice(idx + 2);
          if (!bloco.startsWith("data:")) continue;
          const ev = JSON.parse(bloco.slice(5)) as BrainStreamEvent;
          if (ev.type === "meta") {
            setPersistido(ev.persisted);
            if (ev.conversationId) setConversaId(ev.conversationId);
          } else if (ev.type === "tool") atualizar((m) => ({ ...m, status: `${ev.label}…` }));
          else if (ev.type === "text")
            atualizar((m) => ({ ...m, content: m.content + ev.delta, status: undefined }));
          else if (ev.type === "sources")
            atualizar((m) => ({ ...m, sources: ev.sources as BrainSource[] }));
          else if (ev.type === "done") {
            atualizar((m) => ({ ...m, id: ev.messageId ?? m.id, status: undefined }));
          } else if (ev.type === "error") {
            atualizar((m) => ({ ...m, content: ev.message, erro: true, status: undefined }));
          }
        }
      }
    } catch (e) {
      if (ctrl.signal.aborted) {
        atualizar((m) => ({ ...m, status: undefined, content: m.content || "_(interrompido)_" }));
      } else {
        atualizar((m) => ({
          ...m,
          status: undefined,
          erro: true,
          content: e instanceof Error ? e.message : "Falha na resposta.",
        }));
      }
    } finally {
      setEnviando(false);
      abortRef.current = null;
      void qc.invalidateQueries({ queryKey: ["brain-conversas", iface] });
    }
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
    if (id === conversaId) novaConversa();
    void qc.invalidateQueries({ queryKey: ["brain-conversas", iface] });
  }

  const listaConversas = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b p-3">
        <span className="text-sm font-semibold">Conversas</span>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 px-2 text-xs"
          onClick={novaConversa}
        >
          <Plus className="h-3.5 w-3.5" /> Nova
        </Button>
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
        {!persistido && (
          <p className="p-2 text-xs text-muted-foreground">
            Histórico ainda não habilitado (aguardando a migration do Brain).
          </p>
        )}
        {(conversas.data ?? []).map((c) => (
          <div
            key={c.id}
            className={cn(
              "group flex items-center gap-1 rounded-md px-2 py-1.5 text-xs hover:bg-muted",
              c.id === conversaId && "bg-muted font-medium",
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
              className="opacity-0 group-hover:opacity-100"
              onClick={() => void renomear(c.id, c.titulo)}
            >
              <Pencil className="h-3 w-3 text-muted-foreground" />
            </button>
            <button
              type="button"
              aria-label="Excluir"
              className="opacity-0 group-hover:opacity-100"
              onClick={() => void excluir(c.id)}
            >
              <Trash2 className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        ))}
        {persistido && conversas.data?.length === 0 && (
          <p className="p-2 text-xs text-muted-foreground">Nenhuma conversa ainda.</p>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-9rem)] min-h-[520px] overflow-hidden rounded-xl border bg-background">
      <aside className="hidden w-60 shrink-0 border-r md:block">{listaConversas}</aside>
      {historicoAberto && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="w-72 bg-background shadow-xl">{listaConversas}</div>
          <button
            type="button"
            aria-label="Fechar"
            className="flex-1 bg-black/40"
            onClick={() => setHistoricoAberto(false)}
          />
        </div>
      )}

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 md:hidden"
            aria-label="Conversas"
            onClick={() => setHistoricoAberto(true)}
          >
            <History className="h-4 w-4" />
          </Button>
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Inteligência Comercial</span>
          <span className="text-xs text-muted-foreground">
            {iface === "portal" ? "· sua carteira" : "· base comercial Newline"}
          </span>
          <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={analise}
              onChange={(e) => setAnalise(e.target.checked)}
            />
            Análise aprofundada
          </label>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {msgs.length === 0 && (
            <div className="mx-auto max-w-xl space-y-4 pt-8 text-center">
              <Sparkles className="mx-auto h-8 w-8 text-primary" />
              <p className="text-sm text-muted-foreground">
                Pergunte sobre clientes, categorias, metas, atingimento e oportunidades. As
                respostas usam apenas dados do sistema, com período e fonte.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {SUGESTOES[iface].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void enviar(s)}
                    className="rounded-lg border px-3 py-2 text-left text-xs hover:bg-muted"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {msgs.map((m) => (
            <div
              key={m.id}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[min(100%,52rem)] rounded-xl px-3.5 py-2.5",
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

        <div className="border-t p-3">
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
          <div className="flex items-end gap-2">
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
              disabled={enviando || preparandoAnexo}
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
              disabled={enviando || transcrevendo}
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
                  void enviar();
                }
              }}
              placeholder={
                transcrevendo ? "Transcrevendo áudio…" : "Pergunte à Inteligência Comercial…"
              }
              rows={1}
              className="max-h-40 min-h-[40px] flex-1 resize-none text-sm"
            />
            {enviando ? (
              <Button
                size="icon"
                variant="outline"
                aria-label="Interromper"
                onClick={() => abortRef.current?.abort()}
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                size="icon"
                aria-label="Enviar"
                disabled={!texto.trim()}
                onClick={() => void enviar()}
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            Respostas geradas por IA a partir dos dados do sistema. Confira valores críticos antes
            de decidir.
          </p>
        </div>
      </section>
    </div>
  );
}
