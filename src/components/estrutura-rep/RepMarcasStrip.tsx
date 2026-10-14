import React from "react";
import type { RepresentadaItem } from "@/lib/estrutura-rep/types";
import { MODELO_NEGOCIO_LABEL, CANAIS_COMERCIAIS } from "@/lib/estrutura-rep/types";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, Building, Layers, MapPin, Pencil, Plus, Upload } from "lucide-react";

interface RepMarcasStripProps {
  marcas: RepresentadaItem[];
  onAddBrand?: () => void;
  onEditBrand?: (brandId: string) => void;
  className?: string;
}

export function RepMarcasStrip({
  marcas = [],
  onAddBrand,
  onEditBrand,
  className = "",
}: RepMarcasStripProps) {
  const getCanalLabel = (canalId: string) => {
    return CANAIS_COMERCIAIS.find((c) => c.id === canalId)?.label || canalId;
  };

  const modeloVariant: Record<string, string> = {
    fabricante: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
    industria: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    importador: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
    distribuidor: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    outro: "bg-muted text-muted-foreground border-border",
  };

  return (
    <div className={`w-full pt-4 ${className}`}>
      {/* Header com título e botão de adicionar */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Marcas e Empresas Representadas
          </span>
          <Badge
            variant="secondary"
            className="text-[10px] h-5 px-1.5 font-bold bg-primary/10 text-primary border-primary/20"
          >
            {marcas.length} {marcas.length === 1 ? "marca" : "marcas"}
          </Badge>
        </div>

        {onAddBrand && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onAddBrand}
            className="h-7 text-xs font-semibold gap-1 text-primary hover:text-primary hover:bg-primary/10 px-2.5"
            title="Adicionar nova marca ao portfólio"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Adicionar Marca</span>
          </Button>
        )}
      </div>

      {/* Faixa Horizontal de Ponta a Ponta */}
      {marcas.length === 0 ? (
        <div
          onClick={onAddBrand}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onAddBrand?.()}
          className="w-full flex items-center justify-center gap-3 p-4 rounded-xl border border-dashed border-border/80 bg-muted/20 hover:bg-muted/40 cursor-pointer transition text-muted-foreground group"
        >
          <Building className="h-5 w-5 text-muted-foreground/70 group-hover:text-primary transition-colors" />
          <div className="text-xs">
            <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
              Nenhuma marca cadastrada
            </span>{" "}
            — Clique aqui para cadastrar a primeira representada e enviar a logomarca.
          </div>
          <Plus className="h-4 w-4 text-primary shrink-0" />
        </div>
      ) : (
        <div className="flex items-center gap-3 overflow-x-auto pb-1.5 pt-0.5 px-0.5 no-scrollbar scroll-smooth">
          {marcas.map((m) => {
            const hasLogo = Boolean(m.logo_url);
            const isNewline = m.nome.toLowerCase().includes("newline");

            return (
              <HoverCard key={m.id} openDelay={100} closeDelay={150}>
                <HoverCardTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onEditBrand?.(m.id)}
                    className={`group relative flex items-center justify-center h-14 sm:h-16 px-4 py-2 min-w-[110px] max-w-[200px] shrink-0 rounded-xl bg-card border transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                      isNewline
                        ? "border-primary/40 bg-gradient-to-br from-primary/5 via-card to-primary/10 hover:border-primary shadow-2xs hover:shadow-xs"
                        : "border-border/80 hover:border-primary/50 hover:bg-muted/30 shadow-2xs hover:shadow-xs"
                    }`}
                  >
                    {hasLogo ? (
                      <div className="h-full w-full flex items-center justify-center">
                        <img
                          src={m.logo_url}
                          alt={m.nome}
                          className="max-h-9 sm:max-h-10 max-w-full object-contain transition-transform duration-200 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 max-w-full">
                        <div
                          className={`h-7 w-7 rounded-lg flex items-center justify-center font-bold text-[11px] shrink-0 ${
                            isNewline
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground border"
                          }`}
                        >
                          {m.nome.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-xs font-bold text-foreground/90 truncate group-hover:text-primary transition-colors">
                          {m.nome}
                        </span>
                      </div>
                    )}
                  </button>
                </HoverCardTrigger>

                <HoverCardContent
                  side="bottom"
                  align="center"
                  sideOffset={8}
                  className="w-80 p-4 rounded-xl shadow-lg border border-border bg-popover text-popover-foreground z-50 animate-in fade-in-0 zoom-in-95"
                >
                  {/* Topo do HoverCard: Logo ou Avatar + Nome + Modelo */}
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-border/60">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {m.logo_url ? (
                        <div className="h-11 w-14 rounded-lg bg-white border p-1 flex items-center justify-center shrink-0 shadow-2xs">
                          <img
                            src={m.logo_url}
                            alt={m.nome}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-sm shrink-0">
                          {m.nome.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="text-sm font-bold text-foreground truncate leading-tight">
                          {m.nome}
                        </h4>
                        <Badge
                          variant="outline"
                          className={`text-[10px] h-5 px-1.5 py-0 mt-1 font-semibold border ${
                            modeloVariant[m.modelo_negocio] || modeloVariant.outro
                          }`}
                        >
                          {MODELO_NEGOCIO_LABEL[m.modelo_negocio] || m.modelo_negocio}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Informações Estratégicas */}
                  <div className="py-3 space-y-2 text-xs">
                    {/* Segmento */}
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <Layers className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-foreground/80">Segmento: </span>
                        <span>{m.segmento || "Iluminação & Complementos"}</span>
                      </div>
                    </div>

                    {/* Abrangência */}
                    {m.abrangencia && (
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-foreground/80">Cobertura: </span>
                          <span>{m.abrangencia}</span>
                        </div>
                      </div>
                    )}

                    {/* Canais Comerciais */}
                    {m.canais && m.canais.length > 0 && (
                      <div className="pt-1">
                        <span className="text-[11px] font-semibold text-muted-foreground block mb-1">
                          Canais de Atuação:
                        </span>
                        <div className="flex flex-wrap gap-1">
                          {m.canais.map((c) => (
                            <Badge
                              key={c}
                              variant="secondary"
                              className="text-[10px] px-1.5 py-0 font-medium bg-muted text-muted-foreground"
                            >
                              {getCanalLabel(c)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Ação rápida para editar/trocar logo */}
                  {onEditBrand && (
                    <div className="pt-2 border-t border-border/60">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onEditBrand(m.id)}
                        className="w-full h-7 text-xs font-semibold gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
                      >
                        {m.logo_url ? (
                          <>
                            <Pencil className="h-3 w-3" />
                            <span>Editar Marca / Trocar Logo</span>
                          </>
                        ) : (
                          <>
                            <Upload className="h-3 w-3 text-primary" />
                            <span className="text-primary font-bold">Enviar Logomarca</span>
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </HoverCardContent>
              </HoverCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
