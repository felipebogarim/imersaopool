import React from "react";
import type { RepresentadaItem } from "@/lib/estrutura-rep/types";
import { MODELO_NEGOCIO_LABEL, CANAIS_COMERCIAIS } from "@/lib/estrutura-rep/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, Building, Layers, MapPin, Pencil, Plus } from "lucide-react";

interface RepresentadasSectionProps {
  marcas: RepresentadaItem[];
  onAddClick?: () => void;
  onEditClick?: (brandId: string) => void;
  className?: string;
}

export function RepresentadasSection({
  marcas,
  onAddClick,
  onEditClick,
  className = "",
}: RepresentadasSectionProps) {
  // Mapa de cores para modelos de negócio
  const modeloVariant: Record<string, string> = {
    fabricante: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
    industria: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    importador: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
    distribuidor: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    outro: "bg-muted text-muted-foreground border-border",
  };

  const getCanalLabel = (canalId: string) => {
    return CANAIS_COMERCIAIS.find((c) => c.id === canalId)?.label || canalId;
  };

  return (
    <div className={`flex flex-col h-full bg-card rounded-xl border p-4 sm:p-5 shadow-xs ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold tracking-tight text-foreground uppercase">
              Marcas e Representadas
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {marcas.length} {marcas.length === 1 ? "marca no portfólio" : "marcas no portfólio comercial"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onAddClick && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onAddClick}
              className="h-7 text-xs font-semibold gap-1 text-primary hover:text-primary hover:bg-primary/10 px-2.5 shadow-2xs"
              title="Cadastrar nova marca"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Adicionar</span>
            </Button>
          )}
          <Badge variant="outline" className="text-xs px-2.5 py-0.5 font-medium">
            {marcas.length} {marcas.length === 1 ? "Empresa" : "Empresas"}
          </Badge>
        </div>
      </div>

      {/* Grid de Cards Compactos */}
      {marcas.length === 0 ? (
        <div
          onClick={onAddClick}
          role={onAddClick ? "button" : undefined}
          tabIndex={onAddClick ? 0 : undefined}
          onKeyDown={(e) => e.key === "Enter" && onAddClick?.()}
          className={`flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground border border-dashed rounded-lg ${
            onAddClick ? "cursor-pointer hover:bg-muted/30 transition-colors" : ""
          }`}
        >
          <Building className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm font-medium">Nenhuma representada cadastrada</p>
          <p className="text-xs mt-1">Adicione as marcas e empresas atendidas pelo representante.</p>
          {onAddClick && (
            <Button variant="ghost" size="sm" className="mt-2 h-7 text-xs gap-1 text-primary font-semibold">
              <Plus className="h-3.5 w-3.5" />
              Cadastrar Marca
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto max-h-[500px] pr-1">
          {marcas.map((m) => {
            const isNewline = m.nome.toLowerCase().includes("newline");

            return (
              <div
                key={m.id}
                onClick={() => onEditClick?.(m.id)}
                role={onEditClick ? "button" : undefined}
                tabIndex={onEditClick ? 0 : undefined}
                className={`relative flex flex-col justify-between p-3.5 rounded-lg border transition-all duration-150 hover:shadow-xs text-left ${
                  onEditClick ? "cursor-pointer" : ""
                } ${
                  isNewline
                    ? "bg-gradient-to-br from-primary/5 via-card to-primary/10 border-primary/30"
                    : "bg-card hover:bg-muted/30"
                }`}
              >
                <div>
                  {/* Topo do Card: Logo/Avatar + Nome + Modelo de Negócio */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {m.logo_url ? (
                        <img
                          src={m.logo_url}
                          alt={m.nome}
                          className="h-8 w-8 rounded-md object-contain border bg-white p-0.5 shrink-0"
                        />
                      ) : (
                        <div
                          className={`h-8 w-8 rounded-md flex items-center justify-center font-bold text-xs shrink-0 ${
                            isNewline
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "bg-muted text-muted-foreground border"
                          }`}
                        >
                          {m.nome.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-foreground truncate leading-tight" title={m.nome}>
                          {m.nome}
                        </h4>
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5 truncate">
                          <Layers className="h-3 w-3 shrink-0" />
                          <span className="truncate">{m.segmento}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge
                        variant="outline"
                        className={`text-[10px] h-5 px-1.5 py-0 font-medium border ${
                          modeloVariant[m.modelo_negocio] || modeloVariant.outro
                        }`}
                      >
                        {MODELO_NEGOCIO_LABEL[m.modelo_negocio] || m.modelo_negocio}
                      </Badge>
                      {onEditClick && (
                        <div
                          className="h-5 w-5 rounded flex items-center justify-center text-muted-foreground/70 hover:text-foreground hover:bg-muted/80 transition-colors"
                          title="Editar marca ou alterar logomarca"
                        >
                          <Pencil className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Canais de Atendimento */}
                  {m.canais && m.canais.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {m.canais.map((c) => (
                        <span
                          key={c}
                          className="text-[10px] px-1.5 py-0.2 rounded bg-muted/60 text-muted-foreground font-medium"
                        >
                          {getCanalLabel(c)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Rodapé: Abrangência Territorial */}
                {m.abrangencia && (
                  <div className="mt-2.5 pt-2 border-t flex items-center gap-1 text-[11px] text-muted-foreground">
                    <MapPin className="h-3 w-3 text-primary/70 shrink-0" />
                    <span className="truncate font-medium text-foreground/80">{m.abrangencia}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
