import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2, Image as ImageIcon, Video, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { transcribeAudio } from "@/lib/transcribe.functions";
import { extractFromMedia } from "@/lib/extract-media.functions";

type Common = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
};

function useRecorder(onText: (t: string) => void) {
  const transcribe = useServerFn(transcribeAudio);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [state, setState] = useState<"idle" | "rec" | "loading">("idle");

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm", "audio/mp4"].find(t => MediaRecorder.isTypeSupported(t)) ?? "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = e => { if (e.data.size) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const type = rec.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        if (blob.size < 1024) { setState("idle"); return toast.error("Áudio muito curto"); }
        setState("loading");
        try {
          const base64 = await blobToBase64(blob);
          const ext = type.includes("mp4") ? "mp4" : type.includes("mpeg") ? "mp3" : "webm";
          const { text } = await transcribe({ data: { base64, mime: type.split(";")[0], filename: `audio.${ext}` } });
          if (text.trim()) onText(text.trim());
          else toast.error("Nada foi transcrito");
        } catch (e: any) {
          toast.error(e?.message ?? "Erro ao transcrever");
        } finally {
          setState("idle");
        }
      };
      rec.start();
      recRef.current = rec;
      setState("rec");
    } catch {
      toast.error("Permissão de microfone negada");
    }
  }
  function stop() { recRef.current?.stop(); }
  return { state, start, stop };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onloadend = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

function MicBtn({ state, start, stop }: { state: string; start: () => void; stop: () => void }) {
  return (
    <Button
      type="button"
      size="icon"
      variant={state === "rec" ? "destructive" : "outline"}
      onClick={() => (state === "rec" ? stop() : state === "idle" ? start() : null)}
      disabled={state === "loading"}
      title={state === "rec" ? "Parar gravação" : "Gravar voz"}
      className="shrink-0"
    >
      {state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : state === "rec" ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
    </Button>
  );
}

const MAX_BYTES = 20 * 1024 * 1024;

function useMediaExtractor(onText: (t: string) => void) {
  const extract = useServerFn(extractFromMedia);
  const [loading, setLoading] = useState<null | "image" | "video" | "file">(null);

  async function handle(file: File, kind: "image" | "video" | "file") {
    if (file.size > MAX_BYTES) return toast.error("Arquivo maior que 20MB");
    setLoading(kind);
    try {
      const base64 = await blobToBase64(file);
      const { text } = await extract({ data: { base64, mime: file.type || "application/octet-stream", filename: file.name, kind } });
      if (text.trim()) onText(text.trim());
      else toast.error("Nada foi extraído");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao extrair");
    } finally {
      setLoading(null);
    }
  }
  return { loading, handle };
}

function MediaBtn({
  kind, accept, icon, title, loading, onPick,
}: {
  kind: "image" | "video" | "file";
  accept: string;
  icon: React.ReactNode;
  title: string;
  loading: null | "image" | "video" | "file";
  onPick: (f: File, kind: "image" | "video" | "file") => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const isLoading = loading === kind;
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f, kind); e.target.value = ""; }}
      />
      <Button
        type="button"
        size="icon"
        variant="outline"
        title={title}
        disabled={!!loading}
        onClick={() => ref.current?.click()}
        className="shrink-0"
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      </Button>
    </>
  );
}

function MediaBtns({ onText }: { onText: (t: string) => void }) {
  const { loading, handle } = useMediaExtractor(onText);
  return (
    <>
      <MediaBtn kind="image" accept="image/*" icon={<ImageIcon className="h-4 w-4" />} title="Enviar foto" loading={loading} onPick={handle} />
      <MediaBtn kind="video" accept="video/*" icon={<Video className="h-4 w-4" />} title="Enviar vídeo" loading={loading} onPick={handle} />
      <MediaBtn kind="file" accept=".pdf,.doc,.docx,.txt,.csv,.xls,.xlsx" icon={<Paperclip className="h-4 w-4" />} title="Enviar arquivo" loading={loading} onPick={handle} />
    </>
  );
}

export function VoiceInput({ value, onChange, placeholder, className, type = "text", maxLength }: Common & { type?: string; maxLength?: number }) {
  const append = (t: string) => onChange(value ? `${value} ${t}` : t);
  const { state, start, stop } = useRecorder(append);
  return (
    <div className="flex gap-2">
      <Input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={className} maxLength={maxLength} />
      <MicBtn state={state} start={start} stop={stop} />
      <MediaBtns onText={append} />
    </div>
  );
}

export function VoiceTextarea({ value, onChange, placeholder, className, rows }: Common & { rows?: number }) {
  const append = (t: string) => onChange(value ? `${value} ${t}` : t);
  const { state, start, stop } = useRecorder(append);
  return (
    <div className="flex gap-2 items-start">
      <Textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={className} rows={rows} />
      <div className="flex flex-col gap-2">
        <MicBtn state={state} start={start} stop={stop} />
        <MediaBtns onText={append} />
      </div>
    </div>
  );
}
