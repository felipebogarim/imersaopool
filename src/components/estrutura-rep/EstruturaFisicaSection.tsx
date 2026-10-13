import React from "react";
import type { ModeloEscritorio, RecursosOperacionais } from "@/lib/estrutura-rep/types";
import {
  MODELO_ESCRITORIO_LABEL,
  MODELO_ESCRITORIO_DESC,
  RECURSOS_CONFIG,
} from "@/lib/estrutura-rep/types";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Home,
  Laptop,
  Briefcase,
  PhoneCall,
  HelpCircle,
  Wrench,
  FileCheck,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Network,
} from "lucide-react";

interface EstruturaFisicaSectionProps {
  modeloEscritorio: ModeloEscritorio;
  recursos: RecursosOperacionais;
  observacoes?: string;
  className?: string;
}

const ICONS_MAP: Record<string, React.ReactNode> = {
  Building2: <Building2 className="h-4 w-4" />,
  PhoneCall: <PhoneCall className="h-4 w-4" />,
  HelpCircle: <HelpCircle className="h-4 w-4" />,
  Wrench: <Wrench className="h-4 w-4" />,
  FileCheck: <FileCheck className="h-4 w-4" />,
  ShieldCheck: <ShieldCheck className="h-4 w-4" />,
};

const ESCRITORIO_ICON: Record<ModeloEscritorio, React.ReactNode> = {
  escritorio_fisico: <Building2 className="h-5 w-5 text-primary" />,
  home_office: <Home className="h-5 w-5 text-indigo-500" />,
  hibrido: <Laptop className="h-5 w-5 text-emerald-500" />,
  sem_escritorio: <Briefcase className="h-5 w-5 text-amber-500" />,
};

export function EstruturaFisicaSection({
  modeloEscritorio,
  recursos,
  observacoes,
  className = "",
}: EstruturaFisicaSectionProps) {
  const totalAtivos = RECURSOS_CONFIG.filter((r) => Boolean(recursos[r.key])).length;

  return (
    <div className={`flex flex-col h-full bg-card rounded-xl border p-4 sm:p-5 shadow-xs ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b pb-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold tracking-tight text-foreground uppercase">
              Estrutura Física & Operacional
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Organização física e recursos ativos de backoffice
          </p>
        </div>

        <Badge variant="outline" className="text-xs px-2.5 py-0.5 font-medium">
          {totalAtivos} de 6 recursos ativos
        </Badge>
      </div>

      {/* Destaque do Modelo de Escritório */}
      <div className="mb-4 p-3.5 rounded-lg border bg-gradient-to-r from-muted/50 via-muted/20 to-transparent flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-background border flex items-center justify-center shrink-0 shadow-2xs">
            {ESCRITORIO_ICON[modeloEscritorio] || <Building2 className="h-5 w-5 text-primary" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Modelo de Escritório
              </span>
              <Badge variant="secondary" className="text-xs px-2 py-0 font-semibold bg-primary/10 text-primary border-primary/20">
                {MODELO_ESCRITORIO_LABEL[modeloEscritorio] || modeloEscritorio}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {MODELO_ESCRITORIO_DESC[modeloEscritorio] || "Configuração da base física"}
            </p>
          </div>
        </div>
      </div>

      {/* Grid de Recursos Disponíveis */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 flex-1">
        {RECURSOS_CONFIG.map((item) => {
          const ativo = Boolean(recursos[item.key]);

          return (
            <div
              key={item.key}
              className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-all duration-150 ${
                ativo
                  ? "bg-card border-border/80 shadow-2xs"
                  : "bg-muted/20 border-dashed border-border/50 opacity-60"
              }`}
            >
              <div
                className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 text-xs ${
                  ativo
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "bg-muted text-muted-foreground border"
                }`}
              >
                {ICONS_MAP[item.iconName] || <CheckCircle2 className="h-3.5 w-3.5" />}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-semibold text-foreground truncate leading-tight">
                    {item.label}
                  </span>
                  {ativo ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight mt-0.5 line-clamp-2">
                  {item.descricao}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Observações / Detalhes Operacionais */}
      {observacoes && (
        <div className="mt-3 pt-2.5 border-t text-[11px] text-muted-foreground flex items-center gap-1.5">
          <span className="font-medium text-foreground">Rotina Operacional:</span>
          <span className="truncate">{observacoes}</span>
        </div>
      )}
    </div>
  );
}
