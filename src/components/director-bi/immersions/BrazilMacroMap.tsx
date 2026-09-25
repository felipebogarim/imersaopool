import { useState } from "react";
import {
  Compass,
  MapPin,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Calendar,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BRAZIL_STATE_PATHS } from "./brazil-svg-paths";
import { latLngToXY } from "@/lib/director-immersion-data";
import type { ImmersionItem } from "@/lib/director-immersion-types";

interface BrazilMacroMapProps {
  immersions: ImmersionItem[];
  onSelectRealized: (immersion: ImmersionItem) => void;
  onSelectPlanned: (immersion: ImmersionItem) => void;
}

export function BrazilMacroMap({
  immersions,
  onSelectRealized,
  onSelectPlanned,
}: BrazilMacroMapProps) {
  const [hoveredImmersionId, setHoveredImmersionId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.min(Math.max(prev + delta, 0.9), 2.2));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
  };

  const hoveredImmersion = immersions.find((i) => i.id === hoveredImmersionId);

  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border bg-card p-3 shadow-xs sm:p-5">
      {/* Dynamic Header Overlay */}
      <div className="z-10 mb-3 flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold tracking-tight sm:text-lg">
              Cobertura Territorial & Jornadas
            </h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Clique em qualquer jornada para abrir a inteligência de campo ou prévia planejada.
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 rounded-full border bg-emerald-500/10 px-2.5 py-1 text-emerald-700 dark:text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium">Realizada ("Já estivemos aqui")</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border bg-amber-500/10 px-2.5 py-1 text-amber-700 dark:text-amber-300">
            <span className="h-2 w-2 rounded-full border-2 border-amber-500 border-dashed" />
            <span className="font-medium">Planejada ("Vamos estar aqui")</span>
          </div>
        </div>
      </div>

      {/* Map Canvas Container */}
      <div className="relative aspect-[4/3] min-h-[420px] w-full overflow-hidden rounded-lg border bg-muted/15 sm:min-h-[520px]">
        {/* Controls Overlay */}
        <div className="absolute right-3 top-3 z-20 flex flex-col gap-1.5 rounded-lg border bg-background/90 p-1 shadow-sm backdrop-blur">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            title="Aumentar zoom"
            onClick={() => handleZoom(0.2)}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            title="Diminuir zoom"
            onClick={() => handleZoom(-0.2)}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            title="Restaurar visão"
            onClick={handleResetZoom}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Floating Tooltip Card */}
        {hoveredImmersion && (
          <div className="pointer-events-none absolute left-3 top-3 z-20 max-w-xs rounded-xl border bg-background/95 p-3 shadow-md backdrop-blur sm:max-w-sm">
            <div className="flex items-center gap-2">
              <Badge
                variant={hoveredImmersion.status === "realizada" ? "default" : "outline"}
                className={
                  hoveredImmersion.status === "realizada"
                    ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                    : "border-amber-500 text-amber-600 dark:text-amber-400"
                }
              >
                {hoveredImmersion.status === "realizada" ? "Realizada" : "Planejada"}
              </Badge>
              <span className="text-[11px] font-medium text-muted-foreground">
                {hoveredImmersion.state}
              </span>
            </div>
            <h4 className="mt-1.5 text-sm font-semibold leading-tight text-foreground">
              {hoveredImmersion.title}
            </h4>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">
              {hoveredImmersion.regionCovered}
            </p>
            <div className="mt-2.5 flex items-center justify-between border-t pt-2 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {hoveredImmersion.startDate.split("-").reverse().join("/")}
              </span>
              <span>
                {hoveredImmersion.cities.length} cidade
                {hoveredImmersion.cities.length > 1 ? "s" : ""}
              </span>
            </div>
          </div>
        )}

        {/* Interactive SVG Brasil Map */}
        <svg
          viewBox="0 0 800 800"
          className="h-full w-full select-none transition-transform duration-200 ease-out"
          style={{
            transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`,
          }}
        >
          <defs>
            {/* Soft Glow filter for Realized territorial coverage */}
            <filter id="glow-realized" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            {/* Pattern for planned percurso */}
            <pattern id="dotted-pattern" width="8" height="8" patternUnits="userSpaceOnUse">
              <circle cx="4" cy="4" r="1.5" className="fill-amber-500/80" />
            </pattern>
          </defs>

          {/* 1. Base Layer: 27 Brazilian State Vector Polygons */}
          <g id="brazil-states" className="stroke-border/50 fill-card/60">
            {BRAZIL_STATE_PATHS.map((state) => (
              <g key={state.id} className="group">
                <path
                  d={state.d}
                  className="transition-colors duration-150 hover:fill-muted/70 hover:stroke-border"
                  strokeWidth="1.2"
                />
                <text
                  x={state.centroid.x}
                  y={state.centroid.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="pointer-events-none text-[10px] font-bold fill-muted-foreground/30 uppercase tracking-widest"
                >
                  {state.id}
                </text>
              </g>
            ))}
          </g>

          {/* 2. Layer: Immersion Routes & Territorial Bubbles */}
          <g id="immersion-territories">
            {immersions.map((immersion) => {
              if (!immersion.cityStops || immersion.cityStops.length === 0) return null;

              const points = immersion.cityStops.map((stop) => latLngToXY(stop.lat, stop.lng));
              const isHovered = hoveredImmersionId === immersion.id;
              const isRealized = immersion.status === "realizada";

              // Calculate bounding polygon / smooth hull for territory bubble
              const pathD =
                points.length === 1
                  ? `M ${points[0].x - 18} ${points[0].y} A 18 18 0 1 0 ${points[0].x + 18} ${points[0].y} A 18 18 0 1 0 ${points[0].x - 18} ${points[0].y}`
                  : points.reduce(
                      (acc, p, idx) => `${acc} ${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`,
                      "",
                    ) + " Z";

              return (
                <g
                  key={`territory-${immersion.id}`}
                  className="cursor-pointer transition-all duration-200"
                  onMouseEnter={() => setHoveredImmersionId(immersion.id)}
                  onMouseLeave={() => setHoveredImmersionId(null)}
                  onClick={() =>
                    isRealized ? onSelectRealized(immersion) : onSelectPlanned(immersion)
                  }
                >
                  {/* Subtle coverage zone bubble ("Já estivemos aqui" vs "Vamos estar aqui") */}
                  {isRealized ? (
                    <path
                      d={pathD}
                      className={`transition-all duration-200 ${
                        isHovered
                          ? "fill-emerald-500/35 stroke-emerald-600 stroke-[2.5]"
                          : "fill-emerald-500/18 stroke-emerald-500/50 stroke-[1.5]"
                      }`}
                      strokeDasharray="none"
                      filter={isHovered ? "url(#glow-realized)" : undefined}
                    />
                  ) : (
                    <path
                      d={pathD}
                      className={`transition-all duration-200 ${
                        isHovered
                          ? "fill-amber-500/25 stroke-amber-500 stroke-[2.5]"
                          : "fill-amber-500/10 stroke-amber-500/60 stroke-[1.8]"
                      }`}
                      strokeDasharray="4 4"
                    />
                  )}

                  {/* Route lines connecting city stops in journey sequence */}
                  {points.length > 1 && (
                    <path
                      d={points.reduce(
                        (acc, p, idx) => `${acc} ${idx === 0 ? "M" : "L"} ${p.x} ${p.y}`,
                        "",
                      )}
                      fill="none"
                      className={
                        isRealized
                          ? isHovered
                            ? "stroke-emerald-600 stroke-[3]"
                            : "stroke-emerald-500 stroke-[2]"
                          : isHovered
                            ? "stroke-amber-500 stroke-[3]"
                            : "stroke-amber-500/80 stroke-[2]"
                      }
                      strokeDasharray={isRealized ? "none" : "5 5"}
                      strokeLinecap="round"
                    />
                  )}
                </g>
              );
            })}
          </g>

          {/* 3. Layer: Node Pin Markers for Immersions */}
          <g id="immersion-nodes">
            {immersions.map((immersion) => {
              if (!immersion.cityStops || immersion.cityStops.length === 0) return null;

              const isHovered = hoveredImmersionId === immersion.id;
              const isRealized = immersion.status === "realizada";

              return immersion.cityStops.map((stop, idx) => {
                const { x, y } = latLngToXY(stop.lat, stop.lng);

                return (
                  <g
                    key={`node-${immersion.id}-${idx}`}
                    transform={`translate(${x}, ${y})`}
                    className="cursor-pointer group"
                    onMouseEnter={() => setHoveredImmersionId(immersion.id)}
                    onMouseLeave={() => setHoveredImmersionId(null)}
                    onClick={() =>
                      isRealized ? onSelectRealized(immersion) : onSelectPlanned(immersion)
                    }
                  >
                    {/* Ripple/Pulse effect for primary node or on hover */}
                    {isHovered && (
                      <circle
                        r="14"
                        className={
                          isRealized
                            ? "fill-emerald-500/30 animate-ping"
                            : "fill-amber-500/30 animate-ping"
                        }
                      />
                    )}

                    {/* Outer ring */}
                    <circle
                      r={isHovered ? "9" : "7"}
                      className={`transition-all duration-150 ${
                        isRealized
                          ? "fill-emerald-600 stroke-background stroke-2"
                          : "fill-amber-500 stroke-background stroke-2"
                      }`}
                    />

                    {/* Inner core dot */}
                    <circle r={isHovered ? "3" : "2"} className="fill-white" />

                    {/* City label text tag */}
                    <text
                      x="0"
                      y={idx % 2 === 0 ? "-12" : "18"}
                      textAnchor="middle"
                      className={`pointer-events-none text-[10px] font-semibold transition-all duration-150 ${
                        isHovered
                          ? "fill-foreground text-[11px] font-bold"
                          : "fill-muted-foreground"
                      }`}
                      style={{ textShadow: "0px 1px 2px rgba(0,0,0,0.6)" }}
                    >
                      {stop.cityName}
                    </text>
                  </g>
                );
              });
            })}
          </g>
        </svg>
      </div>

      {/* Summary Footer Bar */}
      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Imersões Realizadas</p>
            <p className="text-sm font-semibold">
              {immersions.filter((i) => i.status === "realizada").length} jornadas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Imersões Planejadas</p>
            <p className="text-sm font-semibold">
              {immersions.filter((i) => i.status === "planejada").length} mapeadas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
            <MapPin className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Clientes & Reps Mapeados</p>
            <p className="text-sm font-semibold">
              {immersions.reduce((acc, i) => acc + i.clients.length, 0)} clientes /{" "}
              {immersions.reduce((acc, i) => acc + i.representatives.length, 0)} reps
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
