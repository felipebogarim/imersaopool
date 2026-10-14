import React from "react";
import type { MembroEquipe } from "@/lib/estrutura-rep/types";
import { VINCULO_LABEL, MODALIDADE_LABEL } from "@/lib/estrutura-rep/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Users,
  UserCheck,
  Briefcase,
  Laptop,
  Building,
  Crown,
  Headset,
  Plus,
  Network,
  ShieldCheck,
} from "lucide-react";

interface EquipeOrganogramaSectionProps {
  equipe: MembroEquipe[];
  onAddClick?: () => void;
  className?: string;
}

interface OrganogramaGrupos {
  titulares: MembroEquipe[];
  prepostos: MembroEquipe[];
  assistentes: MembroEquipe[];
}

/**
 * Classifica a equipe nos 3 níveis hierárquicos do organograma:
 * Nível 1 (Topo): Representante Principal / Titular
 * Nível 2 (Abaixo): Prepostos Comerciais / Vendas em Campo
 * Nível 3 (Base): Assistentes Comerciais / Backoffice / Atendimento
 */
function categorizarOrganograma(equipe: MembroEquipe[]): OrganogramaGrupos {
  const titulares: MembroEquipe[] = [];
  const prepostos: MembroEquipe[] = [];
  const assistentes: MembroEquipe[] = [];

  equipe.forEach((m, idx) => {
    const cargoLower = (m.cargo || "").toLowerCase();

    // 1. Titular / Representante Principal
    if (
      m.nivel === "titular" ||
      cargoLower.includes("titular") ||
      cargoLower.includes("representante principal") ||
      cargoLower.includes("gestor comercial") ||
      cargoLower.includes("gestor geral") ||
      cargoLower.includes("sócio diretor") ||
      (m.vinculo === "socio" && !cargoLower.includes("assistente") && !cargoLower.includes("preposto")) ||
      (idx === 0 && !equipe.some((item) => item.nivel === "titular"))
    ) {
      titulares.push(m);
      return;
    }

    // 2. Prepostos Comerciais / Vendas Externas / Campo
    if (
      m.nivel === "preposto" ||
      m.nivel === "lideranca" ||
      cargoLower.includes("preposto") ||
      cargoLower.includes("vendedor") ||
      cargoLower.includes("comercial externo") ||
      cargoLower.includes("executivo") ||
      cargoLower.includes("consultor externo") ||
      (cargoLower.includes("campo") && !cargoLower.includes("assistente"))
    ) {
      prepostos.push(m);
      return;
    }

    // 3. Assistentes Comerciais / Backoffice / Operação / Apoio
    assistentes.push(m);
  });

  // Garantia: se não houver titular identificado e houver equipe, o 1º é titular
  if (titulares.length === 0 && equipe.length > 0) {
    const primeiro = equipe[0];
    titulares.push(primeiro);
    const pIdx = prepostos.findIndex((x) => x.id === primeiro.id);
    if (pIdx >= 0) prepostos.splice(pIdx, 1);
    const aIdx = assistentes.findIndex((x) => x.id === primeiro.id);
    if (aIdx >= 0) assistentes.splice(aIdx, 1);
  }

  return { titulares, prepostos, assistentes };
}

export function EquipeOrganogramaSection({
  equipe,
  onAddClick,
  className = "",
}: EquipeOrganogramaSectionProps) {
  const { titulares, prepostos, assistentes } = categorizarOrganograma(equipe);

  // Renderiza ícone de modalidade
  const renderModalidadeIcon = (modalidade: string) => {
    switch (modalidade) {
      case "remoto":
        return <Laptop className="h-2.5 w-2.5 text-blue-500" />;
      case "presencial":
        return <Building className="h-2.5 w-2.5 text-emerald-500" />;
      default:
        return <Briefcase className="h-2.5 w-2.5 text-purple-500" />;
    }
  };

  return (
    <div className={`flex flex-col h-full bg-card rounded-xl border p-4 sm:p-5 shadow-xs ${className}`}>
      {/* Header da Seção */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 mb-4">
        <div>
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold tracking-tight text-foreground uppercase">
              Organograma Operacional da Equipe
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Estrutura hierárquica: Representante Titular → Prepostos → Assistentes Comerciais
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
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Gerenciar Equipe</span>
            </Button>
          )}
          <Badge variant="outline" className="text-xs px-2.5 py-0.5 font-medium">
            {equipe.length} {equipe.length === 1 ? "Integrante" : "Integrantes"}
          </Badge>
        </div>
      </div>

      {/* Conteúdo: Organograma Hierárquico */}
      {equipe.length === 0 ? (
        <div
          onClick={onAddClick}
          role={onAddClick ? "button" : undefined}
          tabIndex={onAddClick ? 0 : undefined}
          onKeyDown={(e) => e.key === "Enter" && onAddClick?.()}
          className={`flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground border border-dashed rounded-xl bg-muted/10 ${
            onAddClick ? "cursor-pointer hover:bg-muted/20 transition-colors" : ""
          }`}
        >
          <Network className="h-10 w-10 mb-2 opacity-40 text-primary" />
          <p className="text-sm font-semibold text-foreground">Nenhum membro cadastrado</p>
          <p className="text-xs mt-1 max-w-sm">
            Cadastre o Representante Titular, Prepostos e Assistentes Comerciais para montar o organograma.
          </p>
          {onAddClick && (
            <Button variant="ghost" size="sm" className="mt-3 h-7 text-xs gap-1 text-primary font-semibold">
              <Plus className="h-3.5 w-3.5" />
              Cadastrar Integrante
            </Button>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto max-h-[620px] pr-1.5 space-y-4 no-scrollbar">
          {/* Legenda Resumida de Níveis */}
          <div className="flex flex-wrap items-center justify-center gap-2 pb-1 text-[11px]">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold border border-primary/20">
              <Crown className="h-3 w-3" /> Titular ({titulares.length})
            </span>
            <span className="text-muted-foreground/40">•</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold border border-blue-500/20">
              <UserCheck className="h-3 w-3" /> Prepostos ({prepostos.length})
            </span>
            <span className="text-muted-foreground/40">•</span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-muted text-foreground/80 font-semibold border">
              <Headset className="h-3 w-3 text-primary" /> Assistentes ({assistentes.length})
            </span>
          </div>

          <div className="bg-muted/15 rounded-xl border border-border/60 p-3 sm:p-5 space-y-3">
            {/* ========================================================= */}
            {/* NÍVEL 1: REPRESENTANTE PRINCIPAL (TOPO)                    */}
            {/* ========================================================= */}
            <div className="flex flex-col items-center w-full">
              {/* Badge Identificadora do Nível 1 */}
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-primary text-primary-foreground shadow-2xs mb-2">
                <Crown className="h-3 w-3 text-amber-300" />
                <span>Nível 1 • Representante Principal (Topo)</span>
              </div>

              {/* Card(s) do Titular */}
              <div className="w-full flex flex-col items-center gap-3">
                {titulares.map((titular) => (
                  <div
                    key={titular.id}
                    className="w-full max-w-xl bg-gradient-to-r from-primary/10 via-card to-primary/5 rounded-xl border-2 border-primary/40 p-4 shadow-xs hover:border-primary/60 transition-all"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar com Destaque de Liderança */}
                        <div className="relative">
                          <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-full bg-primary text-primary-foreground font-black text-xs sm:text-sm flex items-center justify-center ring-4 ring-primary/20 shadow-2xs">
                            {titular.nome.slice(0, 2).toUpperCase()}
                          </div>
                          <span
                            className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-amber-400 text-amber-950 flex items-center justify-center shadow-xs"
                            title="Liderança Titular"
                          >
                            <Crown className="h-2.5 w-2.5" />
                          </span>
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-xs sm:text-sm font-extrabold text-foreground truncate" title={titular.nome}>
                              {titular.nome}
                            </h4>
                            <Badge variant="default" className="text-[9px] h-4 px-1.5 py-0 font-bold bg-primary uppercase">
                              Titular
                            </Badge>
                          </div>
                          <p className="text-[11px] font-semibold text-primary truncate" title={titular.cargo}>
                            {titular.cargo}
                          </p>
                        </div>
                      </div>

                      {/* Badges de Vínculo e Modalidade */}
                      <div className="flex items-center gap-1.5 text-[10px] shrink-0">
                        <Badge
                          variant="outline"
                          className="h-5 px-2 py-0 font-semibold border-primary/30 bg-primary/10 text-primary"
                        >
                          {VINCULO_LABEL[titular.vinculo] || titular.vinculo}
                        </Badge>
                        <Badge
                          variant="secondary"
                          className="h-5 px-2 py-0 font-medium flex items-center gap-1 border"
                        >
                          {renderModalidadeIcon(titular.modalidade)}
                          <span>{MODALIDADE_LABEL[titular.modalidade] || titular.modalidade}</span>
                        </Badge>
                      </div>
                    </div>

                    {/* Responsabilidades Estratégicas */}
                    {titular.responsabilidades && titular.responsabilidades.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-primary/20">
                        <div className="flex flex-wrap gap-1.5">
                          {titular.responsabilidades.map((resp, rIdx) => (
                            <span
                              key={rIdx}
                              className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-md bg-card/90 text-foreground font-medium border border-primary/25 shadow-2xs"
                            >
                              • {resp}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Conector Visual: Nível 1 -> Nível 2 */}
            <div className="flex flex-col items-center justify-center my-1 select-none">
              <div className="w-0.5 h-6 bg-primary/40 relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-card shadow-xs" />
              </div>
            </div>

            {/* ========================================================= */}
            {/* NÍVEL 2: PREPOSTOS COMERCIAIS (ABAIXO DO TITULAR)          */}
            {/* ========================================================= */}
            <div className="flex flex-col items-center w-full">
              {/* Badge Identificadora do Nível 2 */}
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-600 text-white shadow-2xs mb-2">
                <UserCheck className="h-3 w-3" />
                <span>Nível 2 • Prepostos Comerciais & Campo ({prepostos.length})</span>
              </div>

              {/* Grid de Prepostos ou Empty State Informative */}
              {prepostos.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
                  {prepostos.map((preposto) => (
                    <div
                      key={preposto.id}
                      className="bg-card rounded-xl border border-blue-200 dark:border-blue-900/60 p-3 shadow-2xs hover:border-blue-400 hover:shadow-xs transition-all relative overflow-hidden"
                    >
                      <div className="h-1 w-full bg-blue-500 absolute top-0 left-0" />
                      <div className="flex items-start justify-between gap-2 mb-2 pt-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                            {preposto.nome.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-foreground truncate" title={preposto.nome}>
                              {preposto.nome}
                            </h4>
                            <p className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 truncate" title={preposto.cargo}>
                              {preposto.cargo}
                            </p>
                          </div>
                        </div>

                        <Badge
                          variant="outline"
                          className="text-[9px] h-4.5 px-1.5 py-0 font-semibold border-blue-300 dark:border-blue-800 bg-blue-500/10 text-blue-700 dark:text-blue-300 shrink-0"
                        >
                          Preposto
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5 text-[10px] mb-2">
                        <Badge variant="outline" className="h-5 px-1.5 py-0 text-muted-foreground border bg-muted/40 font-medium">
                          {VINCULO_LABEL[preposto.vinculo] || preposto.vinculo}
                        </Badge>
                        <Badge variant="secondary" className="h-5 px-1.5 py-0 font-medium flex items-center gap-1">
                          {renderModalidadeIcon(preposto.modalidade)}
                          <span>{MODALIDADE_LABEL[preposto.modalidade] || preposto.modalidade}</span>
                        </Badge>
                      </div>

                      {preposto.responsabilidades && preposto.responsabilidades.length > 0 && (
                        <div className="pt-2 border-t border-border/60">
                          <div className="flex flex-wrap gap-1">
                            {preposto.responsabilidades.map((resp, rIdx) => (
                              <span
                                key={rIdx}
                                className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-muted/70 text-foreground/85 font-medium border border-border/40"
                              >
                                • {resp}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="w-full max-w-lg mx-auto p-3.5 rounded-xl border border-dashed border-blue-300 dark:border-blue-900/60 bg-blue-500/5 text-center flex flex-col items-center justify-center gap-1 shadow-2xs">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                    <UserCheck className="h-3.5 w-3.5 text-blue-500" />
                    <span>Sem prepostos diretos cadastrados no momento</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground max-w-sm">
                    A cobertura comercial externa nos estados é realizada diretamente pelo Representante Titular com retaguarda dos assistentes.
                  </p>
                  {onAddClick && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={onAddClick}
                      className="h-6 text-[10px] gap-1 font-semibold text-primary hover:bg-primary/10 mt-1 shadow-2xs"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Cadastrar Preposto</span>
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Conector Visual: Nível 2 -> Nível 3 */}
            <div className="flex flex-col items-center justify-center my-1 select-none">
              <div className="w-0.5 h-6 bg-border relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-muted-foreground/40 ring-4 ring-card shadow-xs" />
              </div>
            </div>

            {/* ========================================================= */}
            {/* NÍVEL 3: ASSISTENTES COMERCIAIS & BACKOFFICE (BASE)        */}
            {/* ========================================================= */}
            <div className="flex flex-col items-center w-full">
              {/* Badge Identificadora do Nível 3 */}
              <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-muted text-foreground border shadow-2xs mb-2">
                <Headset className="h-3 w-3 text-primary" />
                <span>Nível 3 • Assistentes Comerciais & Backoffice ({assistentes.length})</span>
              </div>

              {/* Grid de Assistentes Comerciais */}
              {assistentes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 w-full">
                  {assistentes.map((assistente) => (
                    <div
                      key={assistente.id}
                      className="bg-card rounded-xl border border-border/80 p-3 shadow-2xs hover:border-primary/40 hover:shadow-xs transition-all"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-muted text-muted-foreground border flex items-center justify-center font-bold text-xs shrink-0">
                            {assistente.nome.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-foreground truncate" title={assistente.nome}>
                              {assistente.nome}
                            </h4>
                            <p className="text-[11px] font-medium text-muted-foreground truncate" title={assistente.cargo}>
                              {assistente.cargo}
                            </p>
                          </div>
                        </div>

                        <Badge
                          variant="secondary"
                          className="text-[9px] h-4.5 px-1.5 py-0 font-medium shrink-0"
                        >
                          Assistente
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1.5 text-[10px] mb-2">
                        <Badge variant="outline" className="h-5 px-1.5 py-0 text-muted-foreground border bg-muted/40 font-medium">
                          {VINCULO_LABEL[assistente.vinculo] || assistente.vinculo}
                        </Badge>
                        <Badge variant="secondary" className="h-5 px-1.5 py-0 font-medium flex items-center gap-1">
                          {renderModalidadeIcon(assistente.modalidade)}
                          <span>{MODALIDADE_LABEL[assistente.modalidade] || assistente.modalidade}</span>
                        </Badge>
                      </div>

                      {assistente.responsabilidades && assistente.responsabilidades.length > 0 && (
                        <div className="pt-2 border-t border-border/60">
                          <div className="flex flex-wrap gap-1">
                            {assistente.responsabilidades.map((resp, rIdx) => (
                              <span
                                key={rIdx}
                                className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-muted/70 text-foreground/85 font-medium border border-border/40"
                              >
                                • {resp}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="w-full max-w-lg mx-auto p-3 rounded-xl border border-dashed border-border bg-muted/10 text-center text-xs text-muted-foreground">
                  Nenhum assistente comercial cadastrado.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
