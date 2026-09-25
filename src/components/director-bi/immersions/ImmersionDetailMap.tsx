import { useState, useMemo } from "react";
import { Building2, Navigation, Layers, MapPin, Flag, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ImmersionItem, VisitedClient } from "@/lib/director-immersion-types";
import { latLngToXY } from "@/lib/director-immersion-data";

interface ImmersionDetailMapProps {
  immersion: ImmersionItem;
  activeNucleus: "clients" | "representatives";
  selectedClientId: string | null;
  onSelectClient: (client: VisitedClient) => void;
  selectedRepId: string | null;
}

export function ImmersionDetailMap({
  immersion,
  activeNucleus,
  selectedClientId,
  onSelectClient,
}: ImmersionDetailMapProps) {
  const [hoveredClientId, setHoveredClientId] = useState<string | null>(null);

  // Compute bounding box and local coordinate transformation for sharp focused view
  const bounds = useMemo(() => {
    const stops = immersion.cityStops ?? [];
    const clients = immersion.clients ?? [];
    const allLats = [...stops.map((s) => s.lat), ...clients.map((c) => c.lat)];
    const allLngs = [...stops.map((s) => s.lng), ...clients.map((c) => c.lng)];

    if (allLats.length === 0) {
      return { minLat: -25, maxLat: -20, minLng: -50, maxLng: -45 };
    }

    const padLat = 0.4;
    const padLng = 0.5;
    return {
      minLat: Math.min(...allLats) - padLat,
      maxLat: Math.max(...allLats) + padLat,
      minLng: Math.min(...allLngs) - padLng,
      maxLng: Math.max(...allLngs) + padLng,
    };
  }, [immersion]);

  const cityNodes = useMemo(() => {
    const toLocal = (lat: number, lng: number) => {
      const width = 600;
      const height = 500;
      const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * width;
      const y = height - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * height;
      return { x: Math.max(30, Math.min(width - 30, x)), y: Math.max(30, Math.min(height - 30, y)) };
    };

    return immersion.cityStops.map((stop) => ({
      ...stop,
      pos: toLocal(stop.lat, stop.lng),
    }));
  }, [immersion.cityStops, bounds]);

  const clientNodes = useMemo(() => {
    const toLocal = (lat: number, lng: number) => {
      const width = 600;
      const height = 500;
      const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * width;
      const y = height - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * height;
      return { x: Math.max(30, Math.min(width - 30, x)), y: Math.max(30, Math.min(height - 30, y)) };
    };

    return immersion.clients.map((client) => ({
      ...client,
      pos: toLocal(client.lat, client.lng),
    }));
  }, [immersion.clients, bounds]);

  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border bg-card p-3 shadow-xs sm:p-4">
      {/* Detail Map Subheader */}
      <div className="mb-2 flex items-center justify-between border-b pb-2 text-xs">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-primary" />
          <span className="font-semibold text-foreground">Percurso & Pins — {immersion.title}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            {activeNucleus === "clients"
              ? `${immersion.clients.length} Clientes Visita`
              : `${immersion.representatives.length} Reps Envolvidos`}
          </Badge>
        </div>
      </div>

      {/* SVG Canvas Container */}
      <div className="relative aspect-[4/3] min-h-[380px] w-full overflow-hidden rounded-lg border bg-muted/20 sm:min-h-[460px]">
        {/* Interactive SVG Canvas */}
        <svg viewBox="0 0 600 500" className="h-full w-full select-none">
          <defs>
            <filter id="shadow-pin" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.25" />
            </filter>
            <linearGradient id="gradient-route" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="var(--color-primary, #3b82f6)" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
          </defs>

          {/* Background Grid Lines & Contour decor */}
          <g opacity="0.15" stroke="currentColor" strokeWidth="0.5" strokeDasharray="4 4">
            <line x1="100" y1="0" x2="100" y2="500" />
            <line x1="300" y1="0" x2="300" y2="500" />
            <line x1="500" y1="0" x2="500" y2="500" />
            <line x1="0" y1="125" x2="600" y2="125" />
            <line x1="0" y1="250" x2="600" y2="250" />
            <line x1="0" y1="375" x2="600" y2="375" />
          </g>

          {/* 1. Journey Route Lines between Cities */}
          {cityNodes.length > 1 && (
            <path
              d={cityNodes.reduce(
                (acc, node, i) => `${acc} ${i === 0 ? "M" : "L"} ${node.pos.x} ${node.pos.y}`,
                "",
              )}
              fill="none"
              stroke="url(#gradient-route)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="drop-shadow-xs"
            />
          )}

          {/* Connector lines from cities to visited clients */}
          {activeNucleus === "clients" &&
            clientNodes.map((client) => {
              // Find matching city node
              const matchCity = cityNodes.find(
                (c) => c.cityName.toLowerCase() === client.cityName.toLowerCase(),
              );
              if (!matchCity) return null;
              return (
                <line
                  key={`line-cli-${client.id}`}
                  x1={matchCity.pos.x}
                  y1={matchCity.pos.y}
                  x2={client.pos.x}
                  y2={client.pos.y}
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  className="text-primary/40"
                />
              );
            })}

          {/* 2. City Sequence Nodes */}
          {cityNodes.map((city) => (
            <g
              key={`city-${city.cityName}`}
              transform={`translate(${city.pos.x}, ${city.pos.y})`}
              className="group"
            >
              {/* Pulse effect */}
              <circle r="12" className="fill-primary/20 animate-pulse" />
              {/* Core city marker */}
              <circle r="8" className="fill-primary stroke-background stroke-2" />
              <text
                x="0"
                y="3"
                textAnchor="middle"
                className="pointer-events-none text-[9px] font-bold fill-primary-foreground"
              >
                {city.order}
              </text>
              {/* Label */}
              <rect
                x="-40"
                y="-24"
                width="80"
                height="16"
                rx="4"
                className="fill-background/90 stroke-border stroke-1"
              />
              <text
                x="0"
                y="-13"
                textAnchor="middle"
                className="pointer-events-none text-[9px] font-semibold fill-foreground"
              >
                Dia {city.dayNumber ?? city.order}: {city.cityName}
              </text>
            </g>
          ))}

          {/* 3. Visited Client Pins (active when Clientes tab is selected) */}
          {activeNucleus === "clients" &&
            clientNodes.map((client, idx) => {
              const isSelected = selectedClientId === client.id;
              const isHovered = hoveredClientId === client.id;

              return (
                <g
                  key={`client-${client.id}`}
                  transform={`translate(${client.pos.x}, ${client.pos.y})`}
                  className="cursor-pointer transition-all duration-150"
                  onMouseEnter={() => setHoveredClientId(client.id)}
                  onMouseLeave={() => setHoveredClientId(null)}
                  onClick={() => onSelectClient(client)}
                  filter="url(#shadow-pin)"
                >
                  {/* Highlight aura */}
                  {(isSelected || isHovered) && (
                    <circle
                      r="18"
                      className={
                        isSelected ? "fill-emerald-500/40 animate-ping" : "fill-primary/30"
                      }
                    />
                  )}

                  {/* Pin shape */}
                  <path
                    d="M 0 -18 C -9 -18 -12 -9 0 0 C 12 -9 9 -18 0 -18 Z"
                    className={`transition-colors duration-150 ${
                      isSelected
                        ? "fill-emerald-600 stroke-white stroke-2 scale-110"
                        : isHovered
                          ? "fill-primary stroke-white stroke-2 scale-105"
                          : "fill-foreground stroke-background stroke-1.5"
                    }`}
                  />
                  <circle
                    cx="0"
                    cy="-11"
                    r="4"
                    className={isSelected ? "fill-white" : "fill-background"}
                  />

                  {/* Text Badge for Client */}
                  <g transform="translate(0, 14)">
                    <rect
                      x="-45"
                      y="-2"
                      width="90"
                      height="16"
                      rx="4"
                      className={`transition-colors ${
                        isSelected
                          ? "fill-emerald-600 text-white"
                          : "fill-card/95 stroke-border stroke-1"
                      }`}
                    />
                    <text
                      x="0"
                      y="9"
                      textAnchor="middle"
                      className={`pointer-events-none text-[8.5px] font-medium ${
                        isSelected ? "fill-white font-semibold" : "fill-foreground"
                      }`}
                    >
                      {client.name.length > 15 ? client.name.slice(0, 13) + "…" : client.name}
                    </text>
                  </g>
                </g>
              );
            })}

          {/* 4. Representative Influences (active when Representantes tab is selected) */}
          {activeNucleus === "representatives" && (
            <g id="rep-influence-overlay">
              {immersion.representatives.map((rep, rIdx) => {
                // Draw representative coverage zones
                const centerX = 200 + rIdx * 180;
                const centerY = 220 + (rIdx % 2) * 60;
                return (
                  <g key={`rep-zone-${rep.id}`} transform={`translate(${centerX}, ${centerY})`}>
                    <circle
                      r="65"
                      className="fill-primary/10 stroke-primary/40 stroke-dashed stroke-1.5"
                    />
                    <rect
                      x="-60"
                      y="-12"
                      width="120"
                      height="24"
                      rx="12"
                      className="fill-background/95 stroke-primary stroke-1 shadow-sm"
                    />
                    <text
                      x="0"
                      y="3"
                      textAnchor="middle"
                      className="pointer-events-none text-[10px] font-semibold fill-primary"
                    >
                      👤 {rep.name.split(" ")[0]} ({rep.region})
                    </text>
                  </g>
                );
              })}
            </g>
          )}
        </svg>
      </div>

      {/* Helper Legend / Instruction */}
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5" />
          {activeNucleus === "clients"
            ? "Clique no marcador do cliente no mapa para abrir a Ficha Resumida."
            : "Áreas de atuação e contextualização dos representantes nesta imersão."}
        </span>
        <span className="hidden sm:inline">Escala regional interativa</span>
      </div>
    </div>
  );
}
