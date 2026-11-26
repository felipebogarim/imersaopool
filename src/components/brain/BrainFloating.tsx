// Assistente flutuante da Inteligência Comercial: botão no canto inferior direito que abre o
// mesmo chat da página completa (mesmo store/conversa), com contexto da página atual.
// Só aparece quando o servidor libera o acesso para a interface (plataforma ou portal com flag).

import { useEffect, useState } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Maximize2, Minimize2, Minus, SquareArrowOutUpRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getBrainAccess } from "@/lib/brain.functions";
import { contextoDaRota } from "@/lib/brain/page-context";
import type { BrainInterface } from "@/lib/brain/types";
import { BrainAvatar } from "./BrainAvatar";
import { BrainChat } from "./BrainChat";
import { useBrainChat } from "./brain-chat-store";

type Janela = "fechada" | "minimizada" | "aberta" | "tela_cheia";
const CHAVE = (iface: BrainInterface) => `brain:janela:${iface}`;

/** Contexto da rota atual (o servidor valida antes de usar). */
export function useBrainPageContext() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search }) as Record<string, unknown>;
  return contextoDaRota(pathname, search);
}

export function useBrainAccess() {
  const accessFn = useServerFn(getBrainAccess);
  return useQuery({
    queryKey: ["brain-access"],
    queryFn: () => accessFn(),
    staleTime: 60_000,
    retry: false,
  });
}

export function BrainFloating({
  iface,
  oculto = false,
}: {
  iface: BrainInterface;
  /** Ex.: na própria página completa do chat. */
  oculto?: boolean;
}) {
  const navigate = useNavigate();
  const contexto = useBrainPageContext();
  const { data: access } = useBrainAccess();
  const st = useBrainChat(iface);
  const [janela, setJanela] = useState<Janela>("fechada");

  // Mantém a janela aberta entre páginas/recargas da mesma aba.
  useEffect(() => {
    try {
      const v = sessionStorage.getItem(CHAVE(iface)) as Janela | null;
      if (v === "aberta" || v === "tela_cheia" || v === "minimizada") setJanela(v);
    } catch {
      // ignore
    }
  }, [iface]);
  useEffect(() => {
    try {
      sessionStorage.setItem(CHAVE(iface), janela);
    } catch {
      // ignore
    }
  }, [janela, iface]);

  useEffect(() => {
    if (janela === "fechada" || janela === "minimizada") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setJanela("minimizada");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [janela]);

  // Sinaliza o botão na página para outros flutuantes (ex.: "Guia rápido") abrirem espaço.
  const temBotao = (iface === "portal" ? access?.portal : access?.plataforma) === true && !oculto;
  useEffect(() => {
    if (!temBotao) return;
    document.documentElement.dataset.brainFab = "1";
    return () => {
      delete document.documentElement.dataset.brainFab;
    };
  }, [temBotao]);

  const liberado = iface === "portal" ? access?.portal === true : access?.plataforma === true;
  if (!liberado || oculto) return null;

  const abrirPaginaCompleta = () => {
    setJanela("minimizada");
    if (iface === "portal") void navigate({ to: "/portal-rep", search: { tab: "inteligencia" } });
    else void navigate({ to: "/inteligencia" });
  };

  const aberta = janela === "aberta" || janela === "tela_cheia";

  const controles = (
    <div className="flex shrink-0 items-center">
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        aria-label="Abrir na página completa"
        title="Abrir na página completa"
        onClick={abrirPaginaCompleta}
      >
        <SquareArrowOutUpRight className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="hidden h-7 w-7 sm:inline-flex"
        aria-label={janela === "tela_cheia" ? "Restaurar" : "Tela cheia"}
        title={janela === "tela_cheia" ? "Restaurar" : "Tela cheia"}
        onClick={() => setJanela(janela === "tela_cheia" ? "aberta" : "tela_cheia")}
      >
        {janela === "tela_cheia" ? (
          <Minimize2 className="h-3.5 w-3.5" />
        ) : (
          <Maximize2 className="h-3.5 w-3.5" />
        )}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        aria-label="Minimizar"
        title="Minimizar (a conversa continua)"
        onClick={() => setJanela("minimizada")}
      >
        <Minus className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        aria-label="Fechar"
        title="Fechar (a conversa continua disponível)"
        onClick={() => setJanela("fechada")}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );

  return (
    <>
      {aberta && (
        <div
          role="dialog"
          aria-label="Inteligência Comercial"
          className={cn(
            "fixed z-[60] flex flex-col overflow-hidden border bg-background shadow-2xl",
            "inset-0 sm:inset-auto",
            janela === "tela_cheia"
              ? "sm:inset-4 sm:rounded-2xl"
              : "sm:bottom-24 sm:right-5 sm:h-[min(680px,calc(100vh-8rem))] sm:w-[420px] sm:rounded-2xl",
            "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4",
          )}
        >
          <BrainChat iface={iface} variant="compact" contexto={contexto} acoes={controles} />
        </div>
      )}

      {janela === "minimizada" && (
        <button
          type="button"
          onClick={() => setJanela("aberta")}
          className="fixed bottom-[5.25rem] right-5 z-[55] flex max-w-[16rem] items-center gap-2 rounded-full border bg-background py-1.5 pl-2 pr-3 text-xs shadow-lg hover:bg-muted"
        >
          <BrainAvatar className="h-5 w-5" />
          <span className="truncate">
            {st.enviando
              ? "Respondendo…"
              : st.msgs.length
                ? "Conversa em andamento"
                : "Inteligência Comercial"}
          </span>
        </button>
      )}

      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Inteligência Comercial"
              onClick={() => setJanela(aberta ? "minimizada" : "aberta")}
              className={cn(
                "group fixed bottom-5 right-5 z-[55] h-14 w-14 rounded-full shadow-lg ring-1 ring-black/5",
                "transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                aberta && "hidden sm:block",
              )}
            >
              <span
                aria-hidden
                className="absolute inset-0 rounded-full bg-primary/35 motion-safe:animate-[ping_3s_cubic-bezier(0,0,0.2,1)_infinite]"
              />
              <BrainAvatar className="relative h-14 w-14" />
              {st.enviando && !aberta && (
                <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-background bg-amber-500" />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">Inteligência Comercial</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </>
  );
}
