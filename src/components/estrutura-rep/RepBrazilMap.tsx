import React, { useState, useMemo, useEffect } from "react";
import { BRAZIL_STATE_PATHS, type StatePath } from "@/components/director-bi/immersions/brazil-svg-paths";
import type { DetalheMunicipal } from "@/lib/estrutura-rep/types";
import { computeFramedViewBox, DEFAULT_BRAZIL_VIEWBOX } from "@/lib/estrutura-rep/map-bounds";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MapPin, CheckCircle2, CircleSlash, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RepBrazilMapProps {
  estadosAtendidos: string[];
  detalhesMunicipais?: Record<string, DetalheMunicipal>;
  onToggleEstado?: (uf: string) => void;
  onSelectEstado?: (uf: string) => void;
  interactive?: boolean;
  className?: string;
}

export function RepBrazilMap({
  estadosAtendidos,
  detalhesMunicipais = {},
  onToggleEstado,
  onSelectEstado,
  interactive = false,
  className = "",
}: RepBrazilMapProps) {
  const [hoveredUf, setHoveredUf] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isFullView, setIsFullView] = useState<boolean>(false);

  // Computa o enquadramento regional otimizado para os estados atendidos
  const framedBounds = useMemo(() => {
    return computeFramedViewBox(estadosAtendidos);
  }, [estadosAtendidos]);

  // Se o usuário alternar para visão completa do país, usa o viewBox completo do Brasil
  const activeViewBox = isFullView ? DEFAULT_BRAZIL_VIEWBOX : framedBounds;

  // Quando mudar a lista de estados atendidos, reseta o zoom manual e volta ao foco regional
  useEffect(() => {
    setZoomLevel(1);
    setIsFullView(false);
  }, [estadosAtendidos.join(",")]);

  const setEstados = useMemo(() => new Set(estadosAtendidos), [estadosAtendidos]);

  const handleStateClick = (uf: string) => {
    if (onSelectEstado) {
      onSelectEstado(uf);
    }
    if (onToggleEstado && interactive) {
      onToggleEstado(uf);
    }
  };

  const hoveredStateInfo = useMemo(() => {
    if (!hoveredUf) return null;
    const stateObj = BRAZIL_STATE_PATHS.find((s) => s.id === hoveredUf);
    const atendido = setEstados.has(hoveredUf);
    const detalhe = detalhesMunicipais[hoveredUf];

    return {
      uf: hoveredUf,
      nome: stateObj?.name || hoveredUf,
      atendido,
      detalhe,
    };
  }, [hoveredUf, setEstados, detalhesMunicipais]);

  return (
    <div className={`flex flex-col h-full bg-card rounded-xl border p-4 sm:p-5 shadow-xs ${className}`}>
      {/* Top Header & Legenda */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold tracking-tight text-foreground uppercase">
              Mapa de Atuação Territorial
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {estadosAtendidos.length > 0
              ? `${estadosAtendidos.length} ${estadosAtendidos.length === 1 ? "estado atendido" : "estados atendidos"} pelo representante`
              : "Nenhum estado selecionado"}
          </p>
        </div>

        {/* Legenda simples e direta */}
        <div className="flex items-center gap-2.5 text-xs">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary font-medium">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span>Atendido ({estadosAtendidos.length})</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/70 border border-border/60 text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/50" />
            <span>Não atendido</span>
          </div>
        </div>
      </div>

      {/* Container do Mapa SVG com Controles de Zoom */}
      <div className="relative flex-1 min-h-[380px] sm:min-h-[440px] w-full overflow-hidden rounded-lg bg-gradient-to-br from-slate-50 via-background to-blue-50/20 dark:from-slate-950/40 dark:via-background dark:to-blue-950/10 border flex items-center justify-center p-2">
        {/* Controles de Zoom e Enquadramento */}
        <div className="absolute right-3 top-3 z-10 flex flex-col gap-1 rounded-md border bg-background/90 p-1 shadow-xs backdrop-blur">
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Aumentar zoom"
            onClick={() => setZoomLevel((z) => Math.min(Number((z + 0.25).toFixed(2)), 2.5))}
            disabled={zoomLevel >= 2.5}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title="Diminuir zoom"
            onClick={() => setZoomLevel((z) => Math.max(Number((z - 0.25).toFixed(2)), 0.6))}
            disabled={zoomLevel <= 0.6}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            title={
              zoomLevel !== 1
                ? "Restaurar enquadramento da região"
                : isFullView
                ? "Focar na região atendida"
                : "Ver mapa do Brasil completo"
            }
            onClick={() => {
              if (zoomLevel !== 1) {
                setZoomLevel(1);
              } else if (estadosAtendidos.length > 0) {
                setIsFullView((prev) => !prev);
              }
            }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* SVG Interativo do Brasil com Enquadramento Regional Automático */}
        <TooltipProvider delayDuration={100}>
          <svg
            viewBox={activeViewBox.viewBox}
            className="h-full w-full max-h-[500px] select-none transition-all duration-300 ease-out"
          >
            <defs>
              <filter id="badge-shadow" x="-30%" y="-30%" width="160%" height="160%">
                <feDropShadow dx="0" dy="1.2" stdDeviation="1.5" floodOpacity="0.22" floodColor="#000" />
              </filter>
            </defs>

            <g
              transform={`translate(${activeViewBox.centerX}, ${activeViewBox.centerY}) scale(${zoomLevel}) translate(${-activeViewBox.centerX}, ${-activeViewBox.centerY})`}
              className="transition-transform duration-200 ease-out"
            >
              {BRAZIL_STATE_PATHS.map((state) => {
                const isCovered = setEstados.has(state.id);
                const isHovered = hoveredUf === state.id;
                const detalhe = detalhesMunicipais[state.id];
                const isParcial = detalhe && detalhe.tipo !== "todos";

                return (
                  <Tooltip key={state.id}>
                    <TooltipTrigger asChild>
                      <path
                        d={state.d}
                        id={`state-${state.id}`}
                        onMouseEnter={() => setHoveredUf(state.id)}
                        onMouseLeave={() => setHoveredUf(null)}
                        onClick={() => handleStateClick(state.id)}
                        className={`transition-all duration-150 cursor-pointer ${
                          isCovered
                            ? isParcial
                              ? "fill-indigo-600 dark:fill-indigo-500 hover:fill-indigo-700 stroke-indigo-200 dark:stroke-indigo-900 stroke-1"
                              : "fill-primary hover:fill-primary/90 stroke-background/50 stroke-1 shadow-sm"
                            : "fill-muted/35 hover:fill-muted/65 stroke-border/70 stroke-[0.8]"
                        } ${isHovered ? "brightness-110 drop-shadow-md stroke-[1.5]" : ""}`}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="p-2.5 max-w-xs shadow-md border bg-popover text-popover-foreground">
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2 border-b pb-1">
                          <span className="font-semibold text-xs">{state.name} ({state.id})</span>
                          {isCovered ? (
                            <Badge variant="default" className="text-[10px] h-4 py-0 px-1 bg-primary">
                              Atendido
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] h-4 py-0 px-1 text-muted-foreground">
                              Não atendido
                            </Badge>
                          )}
                        </div>

                        {isCovered ? (
                          <div className="text-[11px] text-muted-foreground pt-0.5">
                            {isParcial ? (
                              <p>
                                <strong className="text-foreground">Detalhamento: </strong>
                                {detalhe?.descricao ||
                                  (detalhe?.tipo === "capital"
                                    ? "Apenas Capital"
                                    : detalhe?.tipo === "interior"
                                    ? "Apenas Interior"
                                    : "Cobertura regional específica")}
                              </p>
                            ) : (
                              <p className="text-emerald-600 dark:text-emerald-400 font-medium">
                                ✓ Cobertura integral no estado
                              </p>
                            )}
                            {typeof detalhe?.dias_campo_mes === "number" && detalhe.dias_campo_mes > 0 && (
                              <p className="text-primary font-medium mt-1">
                                📅 Atuação em campo: {detalhe.dias_campo_mes} dias/mês
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-[11px] text-muted-foreground pt-0.5">
                            Estado fora da área de atuação deste representante.
                          </p>
                        )}

                        {interactive && (
                          <p className="text-[10px] text-primary/80 italic pt-1">
                            Clique para {isCovered ? "remover" : "adicionar"} da cobertura
                          </p>
                        )}
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              })}

              {/* Marcadores / Siglas nos estados atendidos */}
              {BRAZIL_STATE_PATHS.filter((s) => setEstados.has(s.id)).map((state) => {
                const detalhe = detalhesMunicipais[state.id];
                const isParcial = detalhe && detalhe.tipo !== "todos";
                const radius = state.id === "DF" ? 8 : 11;

                return (
                  <g
                    key={`label-${state.id}`}
                    className="pointer-events-none select-none transition-transform duration-150"
                    transform={`translate(${state.centroid.x}, ${state.centroid.y})`}
                  >
                    <circle
                      r={radius}
                      filter="url(#badge-shadow)"
                      className={
                        isParcial
                          ? "fill-white dark:fill-indigo-950 stroke-indigo-500 stroke-1"
                          : "fill-white dark:fill-card stroke-primary/30 stroke-1"
                      }
                    />
                    <text
                      textAnchor="middle"
                      dy="3.5"
                      className={`font-bold ${
                        state.id === "DF" ? "text-[8px]" : "text-[9px]"
                      } ${
                        isParcial
                          ? "fill-indigo-700 dark:fill-indigo-300"
                          : "fill-primary dark:fill-primary"
                      }`}
                    >
                      {state.id}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </TooltipProvider>

        {/* Floating status card quando o mouse está em cima de um estado */}
        {hoveredStateInfo && (
          <div className="absolute left-3 bottom-3 z-10 rounded-lg border bg-background/95 p-2 px-3 shadow-md backdrop-blur text-xs flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 duration-150">
            {hoveredStateInfo.atendido ? (
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
            ) : (
              <CircleSlash className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <div>
              <span className="font-semibold text-foreground">
                {hoveredStateInfo.nome} ({hoveredStateInfo.uf})
              </span>
              <span className="text-muted-foreground ml-1.5">
                {hoveredStateInfo.atendido
                  ? hoveredStateInfo.detalhe?.descricao || "Atendimento integral"
                  : "Fora da cobertura"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Lista de chips com estados selecionados */}
      <div className="mt-3 pt-2.5 border-t">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-medium text-muted-foreground mr-1">UFs Atendidas:</span>
          {estadosAtendidos.length > 0 ? (
            estadosAtendidos.map((uf) => {
              const detalhe = detalhesMunicipais[uf];
              const isParcial = detalhe && detalhe.tipo !== "todos";

              return (
                <Badge
                  key={uf}
                  variant={isParcial ? "secondary" : "default"}
                  className={`text-xs px-2.5 py-0.5 rounded-lg font-semibold cursor-pointer transition-transform hover:scale-105 shadow-2xs ${
                    isParcial
                      ? "border-indigo-300 dark:border-indigo-700 bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  }`}
                  onClick={() => onSelectEstado?.(uf)}
                  title={detalhe?.descricao || "Integral"}
                >
                  {uf}
                  {typeof detalhe?.dias_campo_mes === "number" && detalhe.dias_campo_mes > 0 && (
                    <span className="ml-1 text-[10px] opacity-90 font-normal">({detalhe.dias_campo_mes}d)</span>
                  )}
                  {isParcial && <span className="ml-1 text-[10px] opacity-75">• Parcial</span>}
                </Badge>
              );
            })
          ) : (
            <span className="text-xs text-muted-foreground italic">Nenhum estado associado</span>
          )}
        </div>
      </div>
    </div>
  );
}
