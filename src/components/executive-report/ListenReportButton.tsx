import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2, Pause, Play, Square } from "lucide-react";
import { buildSpeechScript } from "@/lib/executive-report/speech";
import type { ExecutiveReportData } from "@/lib/executive-report/types";

type Track = { url: string; duration: number; start: number };

function fmt(s: number) {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

/** Botão "Ouvir relatório": a IA lê o relatório em voz alta, com barra de progresso. */
export function ListenReportButton({
  data,
  autoStart,
}: {
  data: ExecutiveReportData;
  autoStart?: boolean;
}) {
  const [state, setState] = useState<"idle" | "loading" | "playing" | "paused">("idle");
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [seeking, setSeeking] = useState<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const tracksRef = useRef<Track[]>([]);
  const indexRef = useRef(0);
  const stopRef = useRef(false);
  const started = useRef(false);

  useEffect(() => {
    return () => {
      stopRef.current = true;
      audioRef.current?.pause();
      tracksRef.current.forEach((t) => URL.revokeObjectURL(t.url));
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

  function durationOf(url: string): Promise<number> {
    return new Promise((resolve) => {
      const a = new Audio();
      a.preload = "metadata";
      a.onloadedmetadata = () => resolve(Number.isFinite(a.duration) ? a.duration : 0);
      a.onerror = () => resolve(0);
      a.src = url;
    });
  }

  /** Toca a partir de um instante global (segundos). */
  function playAt(seconds: number) {
    const tracks = tracksRef.current;
    if (!tracks.length) return;
    let i = tracks.findIndex((t) => seconds < t.start + t.duration);
    if (i < 0) i = tracks.length - 1;
    const offset = Math.max(0, seconds - tracks[i].start);
    indexRef.current = i;
    audioRef.current?.pause();
    const audio = new Audio(tracks[i].url);
    audioRef.current = audio;
    audio.ontimeupdate = () => {
      const cur = tracksRef.current[indexRef.current];
      if (cur) setProgress(cur.start + audio.currentTime);
    };
    audio.onended = () => {
      if (stopRef.current) return;
      const next = indexRef.current + 1;
      if (next < tracksRef.current.length) {
        setTimeout(() => {
          if (!stopRef.current) playAt(tracksRef.current[next].start + 0.001);
        }, 350);
      } else {
        setState("idle");
        setProgress(0);
      }
    };
    audio.onerror = () => toast.error("Não foi possível reproduzir o áudio.");
    audio.currentTime = offset;
    setProgress(tracks[i].start + offset);
    setState("playing");
    void audio.play().catch(() => setState("paused"));
  }

  async function play() {
    stopRef.current = false;
    setState("loading");
    try {
      if (!tracksRef.current.length) {
        const chunks = buildSpeechScript(data);
        const urls: string[] = [];
        for (const chunk of chunks) {
          if (stopRef.current) return setState("idle");
          urls.push(await fetchChunk(chunk));
        }
        const durations = await Promise.all(urls.map(durationOf));
        let acc = 0;
        tracksRef.current = urls.map((url, i) => {
          const t = { url, duration: durations[i] || 0, start: acc };
          acc += t.duration;
          return t;
        });
        setTotal(acc);
      }
      if (stopRef.current) return setState("idle");
      playAt(0);
    } catch (err) {
      setState("idle");
      toast.error(err instanceof Error ? err.message : "Não foi possível ler o relatório.");
    }
  }

  function stop() {
    stopRef.current = true;
    audioRef.current?.pause();
    audioRef.current = null;
    setProgress(0);
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

  if (state === "idle") {
    return (
      <Button variant="outline" size="sm" onClick={() => void play()}>
        <Play className="mr-1 h-4 w-4" />
        Ouvir relatório
      </Button>
    );
  }

  const value = seeking ?? progress;

  return (
    <div className="flex w-full min-w-[260px] max-w-sm items-center gap-2">
      <Button variant="outline" size="icon" onClick={togglePause} disabled={state === "loading"}>
        {state === "loading" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : state === "playing" ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>
      <div className="flex flex-1 items-center gap-2">
        <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{fmt(value)}</span>
        <Slider
          className="flex-1"
          min={0}
          max={Math.max(total, 1)}
          step={1}
          value={[Math.min(value, total)]}
          disabled={state === "loading" || total === 0}
          onValueChange={(v) => setSeeking(v[0])}
          onValueCommit={(v) => {
            setSeeking(null);
            stopRef.current = false;
            playAt(v[0]);
          }}
          aria-label="Progresso da leitura"
        />
        <span className="w-9 text-xs tabular-nums text-muted-foreground">{fmt(total)}</span>
      </div>
      <Button variant="ghost" size="icon" aria-label="Parar leitura" onClick={stop}>
        <Square className="h-4 w-4" />
      </Button>
    </div>
  );
}
