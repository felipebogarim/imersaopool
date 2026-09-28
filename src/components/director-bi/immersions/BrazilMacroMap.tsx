import { useMemo, useState } from "react";
import { Compass, ZoomIn, ZoomOut, RefreshCw, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BRAZIL_STATE_PATHS } from "./brazil-svg-paths";
import { BrazilMapSummary } from "./BrazilMapSummary";
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

  const coveredStates = useMemo(
    () => new Set(immersions.flatMap((immersion) => immersion.cityStops.map((stop) => stop.state))),
    [immersions],
  );

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.min(Math.max(prev + delta, 0.9), 2.2));
  };

  const handleResetZoom = () => {
    setZoomLevel(1);
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
      <div className="relative h-[clamp(460px,62vh,720px)] w-full overflow-hidden rounded-xl border bg-gradient-to-br from-sky-50/80 via-background to-cyan-50/50 dark:from-slate-950 dark:via-background dark:to-cyan-950/20">
        {/* Controls Overlay */}
        <div className="absolute right-3 top-3 z-20 flex flex-col gap-1.5 rounded-lg border bg-background/90 p-1 shadow-sm backdrop-blur">
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            title="Aumentar zoom"
            aria-label="Aumentar zoom do mapa"
            disabled={zoomLevel >= 2.2}
            onClick={() => handleZoom(0.2)}
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            title="Diminuir zoom"
            aria-label="Diminuir zoom do mapa"
            disabled={zoomLevel <= 0.9}
            onClick={() => handleZoom(-0.2)}
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            title="Restaurar visão"
            aria-label="Restaurar visão do mapa"
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
          role="img"
          aria-label="Mapa do Brasil com jornadas comerciais realizadas e planejadas"
          className="h-full w-full select-none transition-transform duration-300 ease-out"
          preserveAspectRatio="xMidYMid meet"
          style={{
            transform: `scale(${zoomLevel})`,
            transformOrigin: "center",
          }}
        >
          <defs>
            <filter id="glow-realized" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <filter id="map-shadow" x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow dx="0" dy="8" stdDeviation="10" floodOpacity="0.12" />
            </filter>
            <pattern id="map-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path
                d="M 32 0 L 0 0 0 32"
                fill="none"
                className="stroke-sky-900/[0.035] dark:stroke-white/[0.025]"
                strokeWidth="1"
              />
            </pattern>
          </defs>

          <rect width="800" height="800" fill="url(#map-grid)" />

          {/* Base territorial contínua: as divisas compartilham a mesma malha geográfica. */}
          <g id="brazil-states" filter="url(#map-shadow)">
            {BRAZIL_STATE_PATHS.map((state) => (
              <g key={state.id} className="group">
                <path
                  d={state.d}
                  className={`transition-colors duration-200 hover:fill-primary/10 ${
                    coveredStates.has(state.id)
                      ? "fill-primary/[0.065] stroke-primary/25"
                      : "fill-card/95 stroke-border"
                  }`}
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
                <title>{state.name}</title>
                <text
                  x={state.centroid.x}
                  y={state.centroid.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className={`pointer-events-none font-bold uppercase tracking-wider ${
                    coveredStates.has(state.id)
                      ? "fill-primary text-[11px]"
                      : "fill-muted-foreground/55 text-[10px]"
                  }`}
                  style={{ paintOrder: "stroke", stroke: "var(--background)", strokeWidth: 3 }}
                >
                  {state.id}
                </text>
              </g>
            ))}
          </g>

          {/* Percursos: uma faixa leve de cobertura e a linha principal da jornada. */}
          <g id="immersion-territories">
            {immersions.map((immersion) => {
              if (!immersion.cityStops || immersion.cityStops.length === 0) return null;

              const points = immersion.cityStops.map((stop) => latLngToXY(stop.lat, stop.lng));
              const isHovered = hoveredImmersionId === immersion.id;
              const isRealized = immersion.status === "realizada";

              const routePath = points.reduce(
                (acc, point, index) => `${acc} ${index === 0 ? "M" : "L"} ${point.x} ${point.y}`,
                "",
              );

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
                  {points.length === 1 ? (
                    <circle
                      cx={points[0].x}
                      cy={points[0].y}
                      r={isHovered ? 24 : 18}
                      className={isRealized ? "fill-emerald-500/15" : "fill-amber-500/15"}
                    />
                  ) : (
                    <>
                      <path
                        d={routePath}
                        fill="none"
                        className={isRealized ? "stroke-emerald-500/15" : "stroke-amber-500/15"}
                        strokeWidth={isHovered ? 16 : 12}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d={routePath}
                        fill="none"
                        className={isRealized ? "stroke-emerald-600" : "stroke-amber-500"}
                        strokeWidth={isHovered ? 3.5 : 2.5}
                        strokeDasharray={isRealized ? undefined : "7 6"}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        filter={isHovered && isRealized ? "url(#glow-realized)" : undefined}
                      />
                    </>
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
                    {isHovered && (
                      <circle
                        r="13"
                        className={
                          isRealized
                            ? "fill-emerald-500/30 animate-ping"
                            : "fill-amber-500/30 animate-ping"
                        }
                      />
                    )}

                    <circle
                      r={isHovered ? "8" : "6.5"}
                      className={`transition-all duration-150 ${
                        isRealized
                          ? "fill-emerald-600 stroke-background stroke-2"
                          : "fill-amber-500 stroke-background stroke-2"
                      }`}
                    />

                    <circle r={isHovered ? "3" : "2"} className="fill-white" />

                    {isHovered && (
                      <g
                        transform={`translate(0, ${idx % 2 === 0 ? -25 : 25})`}
                        className="pointer-events-none"
                      >
                        <rect
                          x={-(stop.cityName.length * 3.2 + 8)}
                          y="-9"
                          width={stop.cityName.length * 6.4 + 16}
                          height="18"
                          rx="6"
                          className="fill-background stroke-border"
                          strokeWidth="1"
                        />
                        <text
                          textAnchor="middle"
                          dominantBaseline="middle"
                          className="fill-foreground text-[10px] font-semibold"
                        >
                          {stop.cityName}
                        </text>
                      </g>
                    )}
                  </g>
                );
              });
            })}
          </g>
        </svg>
      </div>

      <BrazilMapSummary immersions={immersions} />
    </div>
  );
}
