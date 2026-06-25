import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Play, Pause, Loader2, Info } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { synthesizeSpeech } from "@/lib/tts.functions";
import { toast } from "sonner";

const GENERIC_SUFFIX =
  " Você pode digitar a resposta, gravar em áudio pelo botão de microfone, ou enviar fotos, vídeos e documentos pelos botões ao lado — o sistema extrai o conteúdo automaticamente.";

const audioCache = new Map<string, string>(); // text -> objectURL

export function FieldHelp({ text, voice, withMediaSuffix = false, audio = false }: { text: string; voice?: string; withMediaSuffix?: boolean; audio?: boolean }) {
  const fullText = text.trim() + (withMediaSuffix ? GENERIC_SUFFIX : "");
  const tts = useServerFn(synthesizeSpeech);
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function ensureUrl(): Promise<string> {
    const cached = audioCache.get(fullText);
    if (cached) return cached;
    const { base64, mime } = await tts({ data: { text: fullText, voice } });
    const bin = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bin], { type: mime }));
    audioCache.set(fullText, url);
    return url;
  }

  async function toggle() {
    try {
      if (state === "playing") {
        audioRef.current?.pause();
        return;
      }
      if (audioRef.current && audioRef.current.src) {
        await audioRef.current.play();
        return;
      }
      setState("loading");
      const url = await ensureUrl();
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => setState("idle");
      audio.onpause = () => setState(prev => (prev === "playing" ? "idle" : prev));
      audio.onplay = () => setState("playing");
      await audio.play();
    } catch (e: any) {
      setState("idle");
      toast.error(e?.message ?? "Erro ao reproduzir áudio");
    }
  }

  return (
    <div className="mt-1 flex items-start gap-2 text-xs text-muted-foreground">
      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-cyan" />
      <p className="flex-1 leading-relaxed">{text}</p>
      {audio && (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6 shrink-0"
          title="Ouvir orientação"
          onClick={toggle}
          disabled={state === "loading"}
        >
          {state === "loading" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : state === "playing" ? (
            <Pause className="h-3.5 w-3.5" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
        </Button>
      )}
    </div>
  );
}

export function LabelHelp({
  label,
  help,
  htmlFor,
  required,
  withMediaSuffix,
  audio,
}: {
  label: string;
  help: string;
  htmlFor?: string;
  required?: boolean;
  withMediaSuffix?: boolean;
  audio?: boolean;
}) {
  return (
    <div className="mb-1.5">
      <Label htmlFor={htmlFor}>
        {label} {required && <span className="text-cyan">*</span>}
      </Label>
      <FieldHelp text={help} withMediaSuffix={withMediaSuffix} audio={audio} />
    </div>
  );
}
