import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader2, Pause, Play, Square } from "lucide-react";
import { buildSpeechScript } from "@/lib/executive-report/speech";
import type { ExecutiveReportData } from "@/lib/executive-report/types";

/** Botão "Ouvir relatório": a IA lê o relatório em voz alta, por capítulos. */
export function ListenReportButton({
  data,
  autoStart,
}: {
  data: ExecutiveReportData;
  autoStart?: boolean;
}) {
  const [state, setState] = useState<"idle" | "loading" | "playing" | "paused">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stopRef = useRef(false);
  const started = useRef(false);

  useEffect(() => {
    return () => {
      stopRef.current = true;
      audioRef.current?.pause();
    };
  }, []);

  async function fetchChunk(text: string): Promise<string> {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(detail || `Falha ao gerar áudio (${res.status})`);
    }
    return URL.createObjectURL(await res.blob());
  }

  async function play() {
    stopRef.current = false;
    setState("loading");
    const chunks = buildSpeechScript(data);
    try {
      for (const chunk of chunks) {
        if (stopRef.current) break;
        const url = await fetchChunk(chunk);
        if (stopRef.current) {
          URL.revokeObjectURL(url);
          break;
        }
        const audio = new Audio(url);
        audioRef.current = audio;
        setState("playing");
        await new Promise<void>((resolve, reject) => {
          audio.onended = () => resolve();
          audio.onerror = () => reject(new Error("Não foi possível reproduzir o áudio."));
          void audio.play().catch(reject);
        });
        URL.revokeObjectURL(url);
        // Pequena pausa entre trechos, respeitando a quebra de capítulos.
        if (!stopRef.current) await new Promise((r) => setTimeout(r, 450));
      }
      if (!stopRef.current) setState("idle");
    } catch (err) {
      setState("idle");
      toast.error(err instanceof Error ? err.message : "Não foi possível ler o relatório.");
    }
  }

  function stop() {
    stopRef.current = true;
    audioRef.current?.pause();
    audioRef.current = null;
    setState("idle");
  }

  function togglePause() {
    const a = audioRef.current;
    if (!a) return;
    if (state === "playing") {
      a.pause();
      setState("paused");
    } else {
      void a.play();
      setState("playing");
    }
  }

  useEffect(() => {
    if (autoStart && !started.current) {
      started.current = true;
      void play();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  if (state === "idle") {
    return (
      <Button variant="outline" size="sm" onClick={() => void play()}>
        <Play className="mr-1 h-4 w-4" />
        Ouvir relatório
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="sm" onClick={togglePause} disabled={state === "loading"}>
        {state === "loading" ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : state === "playing" ? (
          <Pause className="mr-1 h-4 w-4" />
        ) : (
          <Play className="mr-1 h-4 w-4" />
        )}
        {state === "loading" ? "Preparando" : state === "playing" ? "Pausar" : "Continuar"}
      </Button>
      <Button variant="ghost" size="icon" aria-label="Parar leitura" onClick={stop}>
        <Square className="h-4 w-4" />
      </Button>
    </div>
  );
}
