import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Mic, Square, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { transcribeAudio } from "@/lib/transcribe.functions";

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

export function VoiceInput({ value, onChange, placeholder, className, type = "text", maxLength }: Common & { type?: string; maxLength?: number }) {
  const { state, start, stop } = useRecorder(t => onChange(value ? `${value} ${t}` : t));
  return (
    <div className="flex gap-2">
      <Input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={className} maxLength={maxLength} />
      <MicBtn state={state} start={start} stop={stop} />
    </div>
  );
}

export function VoiceTextarea({ value, onChange, placeholder, className, rows }: Common & { rows?: number }) {
  const { state, start, stop } = useRecorder(t => onChange(value ? `${value} ${t}` : t));
  return (
    <div className="flex gap-2 items-start">
      <Textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={className} rows={rows} />
      <MicBtn state={state} start={start} stop={stop} />
    </div>
  );
}
