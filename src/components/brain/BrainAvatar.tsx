// Avatar (mascote) da Inteligência Comercial: balão de conversa em fita azul/violeta com rosto.
import { cn } from "@/lib/utils";

export function BrainAvatar({ className }: { className?: string }) {
  return (
    <img
      src="/brain-avatar.png"
      alt="Inteligência Comercial"
      draggable={false}
      className={cn("h-8 w-8 select-none object-contain", className)}
    />
  );
}
