import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { ZoomIn, ZoomOut, RotateCcw, Download, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { generateRepStructurePdf } from "@/lib/estrutura-rep/pdf";
import { loadRepStructure } from "@/lib/estrutura-rep/storage";
import type { RepStructure } from "@/lib/estrutura-rep/types";

export const Route = createFileRoute("/estrutura/$repId")({
  head: ({ params }) => {
    const rawId = (params as any)?.repId || "";
    const repId = String(rawId).replace(/\.png$/i, "").trim();

    const title = "Estrutura Comercial & Operacional · Documento Executivo";
    const description =
      "Visualização executiva em PDF com Mapa Geográfico de Atuação (dias/mês), Frequência Top 10 e Organograma Operacional.";
    const ogImageUrl = `https://poolflux.app/api/og-estrutura/${repId}.png`;

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
  component: PublicEstruturaViewerPage,
});

function PublicEstruturaViewerPage() {
  const { repId } = Route.useParams();
  const cleanId = String(repId).replace(/\.png$/i, "").trim();

  const [structure, setStructure] = useState<RepStructure | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string>(`/api/og-estrutura/${cleanId}.png`);

  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const { data: rep } = await supabase
          .from("representatives")
          .select("id, nome, representacao, regiao, outras_marcas")
          .eq("id", cleanId)
          .maybeSingle();

        const loaded = await loadRepStructure({
          id: cleanId,
          nome: rep?.nome || "Representante",
          representacao: rep?.representacao || null,
          regiao: rep?.regiao || null,
          outras_marcas: rep?.outras_marcas || null,
        });

        setStructure(loaded);

        // Gera e exibe a visualização direta do PDF em alta resolução
        try {
          const { blob: pdfBlob } = await generateRepStructurePdf(loaded);
          const { generateStructureThumbnail } = await import("@/lib/estrutura-rep/thumbnail");
          const { dataUrl } = await generateStructureThumbnail(loaded, pdfBlob);
          if (dataUrl) {
            setImageUrl(dataUrl);
          }
        } catch (e) {
          console.warn("[PublicEstruturaViewerPage] Falha na prévia dinâmica do PDF:", e);
        }
      } catch (err) {
        console.warn("[PublicEstruturaViewerPage] Falha ao carregar dados:", err);
      }
    }

    if (cleanId) {
      loadData();
    }
  }, [cleanId]);

  async function handleDownloadPdf() {
    if (!structure) {
      toast.error("Aguardando carregamento da estrutura...");
      return;
    }
    setDownloading(true);
    try {
      const { blob, filename } = await generateRepStructurePdf(structure);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast.success("Download do PDF executivo concluído!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao baixar o PDF");
    } finally {
      setDownloading(false);
    }
  }

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

  function handleDoubleClick() {
    if (scale > 1.2) {
      handleReset();
    } else {
      setScale(2);
    }
  }

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

  // Touch handlers
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

  const repNome = structure?.nome_representante || "Representante";
  const repEmpresa = structure?.empresa_representacao || "Representação Comercial";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-slate-100 select-none overflow-hidden">
      {/* Barra superior de controle */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-800/80 bg-slate-900/90 px-3 sm:px-6 backdrop-blur">
        <div className="flex items-center gap-2 min-w-0">
          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
          <div className="min-w-0">
            <h1 className="text-sm font-semibold tracking-wide text-slate-200 truncate">
              Estrutura Rep · {repNome}
            </h1>
            <p className="text-[11px] text-slate-400 truncate hidden sm:block">
              {repEmpresa} · Documento Executivo em PDF
            </p>
          </div>
        </div>

        {/* Controles de Zoom e Ações */}
        <div className="flex items-center gap-1.5 shrink-0">
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

          <Button
            type="button"
            size="sm"
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="ml-2 h-8 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-colors"
          >
            <Download className="mr-1.5 h-3.5 w-3.5" />
            <span className="hidden sm:inline">Baixar</span> PDF
          </Button>
        </div>
      </header>

      {/* Área de Visualização Interativa com Zoom e Pan */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-2 sm:p-6 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
      >
        <div
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transformOrigin: "center center",
            transition: isDragging ? "none" : "transform 0.15s ease-out",
          }}
          className="max-w-full max-h-full flex items-center justify-center will-change-transform"
        >
          <img
            src={imageUrl}
            alt={`Estrutura Rep — ${repNome}`}
            className="max-h-[82vh] max-w-[94vw] object-contain rounded-xl shadow-2xl border border-slate-800 pointer-events-none"
            onError={() => {
              setImageUrl("/og-charts/default.png");
            }}
          />
        </div>

        {/* Dica flutuante no rodapé */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/80 px-3.5 py-1 text-[11px] text-slate-400 border border-slate-800/80 backdrop-blur pointer-events-none text-center">
          Dê duplo clique ou pinça para zoom · Arraste para mover · Botão &quot;Baixar PDF&quot; acima
        </div>
      </div>
    </div>
  );
}
