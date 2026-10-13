import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Download, Maximize2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/grafico/$reportId")({
  head: ({ params }) => {
    const rawId = (params as any)?.reportId || "";
    const reportId = String(rawId).replace(/\.png$/i, "").trim();
    const isClara = reportId === "0ab3e2a1-f172-43a5-a633-9c347c09f06f";

    const title = isClara
      ? "Arquiluz · Resultado por família"
      : "Resultado por família · Gráfico de Imersão";

    const description =
      "Visualização em alta resolução do Resultado por Família. Toque para abrir, ampliar e dar zoom nos detalhes.";

    const ogImageUrl = isClara
      ? "https://poolflux.app/og-charts/0ab3e2a1-f172-43a5-a633-9c347c09f06f.png"
      : (reportId
          ? `https://poolflux.app/api/og-executivo/${reportId}.png`
          : "https://poolflux.app/og-charts/default.png");

    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:image", content: ogImageUrl },
        { property: "og:image:secure_url", content: ogImageUrl },
        { property: "og:image:type", content: "image/png" },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:alt", content: title },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: description },
        { name: "twitter:image", content: ogImageUrl },
      ],
    };
  },
  component: PublicGraficoViewerPage,
});

function PublicGraficoViewerPage() {
  const { reportId } = Route.useParams();
  const cleanId = String(reportId).replace(/\.png$/i, "").trim();
  const isClara = cleanId === "0ab3e2a1-f172-43a5-a633-9c347c09f06f";

  const imageUrl = isClara
    ? "/og-charts/0ab3e2a1-f172-43a5-a633-9c347c09f06f.png"
    : `/api/og-executivo/${cleanId}.png`;

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Zoom com botões
  function handleZoomIn() {
    setScale((s) => Math.min(s + 0.35, 3.5));
  }

  function handleZoomOut() {
    setScale((s) => {
      const next = Math.max(s - 0.35, 0.7);
      if (next <= 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  }

  function handleReset() {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }

  // Duplo toque / clique para alternar zoom
  function handleDoubleClick() {
    if (scale > 1.2) {
      handleReset();
    } else {
      setScale(2);
    }
  }

  // Suporte a arrastar no desktop
  function handleMouseDown(e: React.MouseEvent) {
    if (scale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDragging || scale <= 1) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }

  function handleMouseUp() {
    setIsDragging(false);
  }

  // Suporte a gestos touch (pinch-to-zoom nativo em dispositivos móveis)
  const initialTouchDistanceRef = useRef<number | null>(null);
  const initialScaleRef = useRef(1);

  function handleTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialTouchDistanceRef.current = dist;
      initialScaleRef.current = scale;
    } else if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - position.x,
        y: e.touches[0].clientY - position.y,
      });
    }
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && initialTouchDistanceRef.current != null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const newScale = (dist / initialTouchDistanceRef.current) * initialScaleRef.current;
      setScale(Math.max(0.8, Math.min(newScale, 4)));
    } else if (e.touches.length === 1 && isDragging && scale > 1) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y,
      });
    }
  }

  function handleTouchEnd() {
    initialTouchDistanceRef.current = null;
    setIsDragging(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100 select-none overflow-hidden">
      {/* Barra superior de controle */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800/80 bg-slate-900/90 px-3 sm:px-6 backdrop-blur">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <h1 className="text-sm font-semibold tracking-wide text-slate-200">
            {isClara ? "Arquiluz · Resultado por família" : "Resultado por Família"}
          </h1>
        </div>

        {/* Controles de Zoom */}
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            className="h-8 w-8 text-slate-300 hover:bg-slate-800 hover:text-white"
            title="Reduzir zoom (-)"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>

          <span className="min-w-[42px] text-center text-xs font-mono text-slate-400">
            {Math.round(scale * 100)}%
          </span>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            className="h-8 w-8 text-slate-300 hover:bg-slate-800 hover:text-white"
            title="Aumentar zoom (+)"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>

          {scale !== 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleReset}
              className="h-8 w-8 text-slate-300 hover:bg-slate-800 hover:text-white"
              title="Redefinir zoom"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}

          <div className="mx-1 h-4 w-[1px] bg-slate-800" />

          <a
            href={imageUrl}
            download={`resultado-por-familia-${cleanId}.png`}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-800 px-2.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white transition"
            title="Baixar imagem PNG"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Baixar</span>
          </a>

          <a
            href={imageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-white transition"
            title="Abrir arquivo de imagem direto"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </header>

      {/* Área de exibição do gráfico com suporte a zoom e pan */}
      <main
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
        className={`flex-1 flex items-center justify-center p-2 sm:p-6 overflow-hidden ${
          scale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
        }`}
      >
        <div
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? "none" : "transform 0.15s ease-out",
            transformOrigin: "center center",
          }}
          className="max-w-full max-h-full flex items-center justify-center will-change-transform shadow-2xl rounded-xl overflow-hidden bg-white"
        >
          <img
            src={imageUrl}
            alt="Resultado por família"
            className="max-h-[82vh] max-w-[94vw] w-auto h-auto object-contain block pointer-events-none"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/og-charts/default.png";
            }}
          />
        </div>
      </main>

      {/* Dica de navegação no rodapé */}
      <footer className="h-9 shrink-0 flex items-center justify-center border-t border-slate-900 bg-slate-950/80 px-4 text-[11px] text-slate-400">
        <span>Toque duas vezes ou use pinça/botões para dar zoom no gráfico</span>
      </footer>
    </div>
  );
}
