import React from "react";
import type { MembroEquipe } from "@/lib/estrutura-rep/types";
import { VINCULO_LABEL, MODALIDADE_LABEL } from "@/lib/estrutura-rep/types";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  UserCheck,
  Briefcase,
  Laptop,
  Building,
  ArrowRight,
  ArrowDown,
  Shield,
  Layers,
} from "lucide-react";

interface EquipeOrganogramaSectionProps {
  equipe: MembroEquipe[];
  onAddClick?: () => void;
  className?: string;
}

export function EquipeOrganogramaSection({
  equipe,
  onAddClick,
  className = "",
}: EquipeOrganogramaSectionProps) {
  // Ordena a equipe pelo nível hierárquico
  const nivelWeight = { titular: 1, lideranca: 2, operacao: 3, apoio: 4 };
  const sortedEquipe = [...equipe].sort(
    (a, b) => (nivelWeight[a.nivel] || 99) - (nivelWeight[b.nivel] || 99)
  );

  return (
    <div className={`flex flex-col h-full bg-card rounded-xl border p-4 sm:p-5 shadow-xs ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold tracking-tight text-foreground uppercase">
              Equipe & Mini Organograma Operacional
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Divisão funcional de responsabilidades e estrutura de backoffice
          </p>
        </div>

        <Badge variant="outline" className="text-xs px-2.5 py-0.5 font-medium">
          {equipe.length} {equipe.length === 1 ? "Integrante" : "Integrantes"}
        </Badge>
      </div>

      {/* Conteúdo: Mini Organograma Visual */}
      {sortedEquipe.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground border border-dashed rounded-lg">
          <Users className="h-8 w-8 mb-2 opacity-40" />
          <p className="text-sm font-medium">Nenhum membro cadastrado</p>
          <p className="text-xs mt-1">Adicione os integrantes da equipe e suas responsabilidades.</p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col gap-2.5 overflow-y-auto max-h-[500px] pr-1">
          {sortedEquipe.map((membro, index) => {
            const isTitular = membro.nivel === "titular";
            const isLast = index === sortedEquipe.length - 1;

            return (
              <React.Fragment key={membro.id}>
                <div
                  className={`relative p-3.5 rounded-lg border transition-all duration-150 ${
                    isTitular
                      ? "bg-gradient-to-r from-primary/10 via-card to-background border-primary/40 shadow-xs"
                      : "bg-card hover:bg-muted/20"
                  }`}
                >
                  {/* Linha Principal: Identificação + Cargo + Badges */}
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                          isTitular
                            ? "bg-primary text-primary-foreground shadow-xs"
                            : "bg-muted text-muted-foreground border"
                        }`}
                      >
                        {membro.nome.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4 className="text-xs font-bold text-foreground truncate" title={membro.nome}>
                            {membro.nome}
                          </h4>
                          {isTitular && (
                            <Badge variant="default" className="text-[9px] h-4 py-0 px-1 font-semibold bg-primary">
                              Titular
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] font-medium text-primary/85 dark:text-primary/95 truncate">
                          {membro.cargo}
                        </p>
                      </div>
                    </div>

                    {/* Vínculo e Modalidade */}
                    <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                      <Badge variant="outline" className="h-5 px-1.5 py-0 text-muted-foreground border bg-muted/40 font-medium">
                        {VINCULO_LABEL[membro.vinculo] || membro.vinculo}
                      </Badge>
                      <Badge variant="secondary" className="h-5 px-1.5 py-0 font-medium flex items-center gap-1">
                        {membro.modalidade === "remoto" ? (
                          <Laptop className="h-2.5 w-2.5" />
                        ) : membro.modalidade === "presencial" ? (
                          <Building className="h-2.5 w-2.5" />
                        ) : (
                          <Briefcase className="h-2.5 w-2.5" />
                        )}
                        <span>{MODALIDADE_LABEL[membro.modalidade] || membro.modalidade}</span>
                      </Badge>
                    </div>
                  </div>

                  {/* Responsabilidades Operacionais */}
                  {membro.responsabilidades && membro.responsabilidades.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/60">
                      <div className="flex flex-wrap gap-1.5">
                        {membro.responsabilidades.map((resp, rIdx) => (
                          <span
                            key={rIdx}
                            className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-md bg-muted/70 text-foreground/85 font-medium border border-border/40"
                          >
                            • {resp}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Conector visual do fluxo operacional */}
                {!isLast && (
                  <div className="flex items-center justify-center -my-1 text-muted-foreground/40">
                    <ArrowDown className="h-3.5 w-3.5 animate-pulse" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
    </div>
  );
}
