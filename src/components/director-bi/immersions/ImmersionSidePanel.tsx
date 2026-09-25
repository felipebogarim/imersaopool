import {
  Building2,
  UserCheck,
  Calendar,
  MapPin,
  Sparkles,
  AlertTriangle,
  Lightbulb,
  Compass,
  ArrowRight,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ImmersionItem, VisitedClient, RepParticipant } from "@/lib/director-immersion-types";

interface ImmersionSidePanelProps {
  immersion: ImmersionItem;
  activeNucleus: "clients" | "representatives";
  onNucleusChange: (nucleus: "clients" | "representatives") => void;
  selectedClientId: string | null;
  onSelectClient: (client: VisitedClient) => void;
  selectedRepId: string | null;
  onSelectRep: (rep: RepParticipant) => void;
}

export function ImmersionSidePanel({
  immersion,
  activeNucleus,
  onNucleusChange,
  selectedClientId,
  onSelectClient,
  selectedRepId,
  onSelectRep,
}: ImmersionSidePanelProps) {
  const selectedClient =
    immersion.clients.find((c) => c.id === selectedClientId) ?? immersion.clients[0] ?? null;

  const selectedRep =
    immersion.representatives.find((r) => r.id === selectedRepId) ??
    immersion.representatives[0] ??
    null;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border bg-card p-3 shadow-xs sm:p-4">
      {/* Nucleus Selector Header */}
      <div className="mb-3 border-b pb-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Ângulo de Análise
          </span>
          <Badge variant="secondary" className="text-[10px]">
            {immersion.title}
          </Badge>
        </div>

        {/* Dynamic Nucleus Toggle [ Clientes ] [ Representantes ] */}
        <Tabs
          value={activeNucleus}
          onValueChange={(val) => onNucleusChange(val as "clients" | "representatives")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 bg-muted p-1">
            <TabsTrigger
              value="clients"
              className="flex items-center justify-center gap-1.5 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-xs"
            >
              <Building2 className="h-3.5 w-3.5" /> Clientes ({immersion.clients.length})
            </TabsTrigger>
            <TabsTrigger
              value="representatives"
              className="flex items-center justify-center gap-1.5 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-xs"
            >
              <UserCheck className="h-3.5 w-3.5" /> Representantes (
              {immersion.representatives.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content Area for Nucleus */}
      <div className="flex-1 overflow-y-auto pr-1">
        {activeNucleus === "clients" ? (
          /* NÚCLEO CLIENTES */
          <div className="space-y-3">
            {/* Quick Picker Pills for Visited Clients */}
            {immersion.clients.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-b pb-2.5">
                {immersion.clients.map((c) => {
                  const isSelected = selectedClient?.id === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => onSelectClient(c)}
                      className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 text-primary font-semibold shadow-2xs"
                          : "bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <MapPin className="h-3 w-3" />
                      {c.name}
                    </button>
                  );
                })}
              </div>
            )}

            {!selectedClient ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                <Building2 className="mb-2 h-7 w-7 stroke-1" />
                <p className="text-sm font-medium">Nenhum cliente selecionado</p>
                <p className="mt-1 text-xs">
                  Selecione um cliente no mapa ou na lista acima para ver a Ficha Resumida.
                </p>
              </div>
            ) : (
              /* FICHA RESUMIDA DO CLIENTE */
              <div className="space-y-3">
                {/* Identification Header Card */}
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] uppercase font-semibold tracking-wide text-primary">
                        Ficha Resumida da Visita
                      </p>
                      <h3 className="text-base font-bold leading-tight text-foreground">
                        {selectedClient.name}
                      </h3>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {selectedClient.state}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      {selectedClient.cityName}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      {selectedClient.visitDate.split("-").reverse().join("/")}
                    </span>
                    {selectedClient.dayNumber && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        Dia {selectedClient.dayNumber} da Imersão
                      </span>
                    )}
                  </div>
                </div>

                {/* Leitura Executiva Sections */}
                <div className="space-y-2.5 text-xs">
                  {/* Cenário Geral */}
                  <div className="rounded-lg border bg-card p-3 shadow-2xs">
                    <div className="mb-1 flex items-center gap-1.5 font-semibold text-foreground">
                      <Compass className="h-3.5 w-3.5 text-blue-500" />
                      <span>Cenário Geral</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      {selectedClient.scenario || "Nenhum detalhe cadastrado."}
                    </p>
                  </div>

                  {/* Oportunidades Percebidas */}
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 dark:bg-emerald-950/20">
                    <div className="mb-1 flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                      <Lightbulb className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>Oportunidades Percebidas</span>
                    </div>
                    <p className="text-foreground/90 leading-relaxed">
                      {selectedClient.opportunities || "Sem observações registradas."}
                    </p>
                  </div>

                  {/* Ameaças ou Riscos Percebidos */}
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 dark:bg-amber-950/20">
                    <div className="mb-1 flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                      <span>Ameaças ou Riscos Percebidos</span>
                    </div>
                    <p className="text-foreground/90 leading-relaxed">
                      {selectedClient.threats || "Nenhum risco relevante reportado."}
                    </p>
                  </div>

                  {/* Percepções Relevantes */}
                  <div className="rounded-lg border bg-card p-3 shadow-2xs">
                    <div className="mb-1 flex items-center gap-1.5 font-semibold text-foreground">
                      <Sparkles className="h-3.5 w-3.5 text-purple-500" />
                      <span>Percepções Relevantes</span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      {selectedClient.relevantPerceptions || "Sem percepções adicionais."}
                    </p>
                  </div>

                  {/* Próximos Passos */}
                  <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                    <div className="mb-1 flex items-center gap-1.5 font-semibold text-primary">
                      <ArrowRight className="h-3.5 w-3.5" />
                      <span>Próximos Passos</span>
                    </div>
                    <p className="font-medium text-foreground leading-relaxed">
                      {selectedClient.nextSteps || "Definição de próximos passos pendente."}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* NÚCLEO REPRESENTANTES */
          <div className="space-y-3">
            {/* Quick Picker Pills for Representatives */}
            {immersion.representatives.length > 0 && (
              <div className="flex flex-wrap gap-1.5 border-b pb-2.5">
                {immersion.representatives.map((r) => {
                  const isSelected = selectedRep?.id === r.id;
                  return (
                    <button
                      key={r.id}
                      onClick={() => onSelectRep(r)}
                      className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 text-primary font-semibold shadow-2xs"
                          : "bg-background text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <User className="h-3 w-3" />
                      {r.name}
                    </button>
                  );
                })}
              </div>
            )}

            {!selectedRep ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center text-muted-foreground">
                <UserCheck className="mb-2 h-7 w-7 stroke-1" />
                <p className="text-sm font-medium">Nenhum representante selecionado</p>
                <p className="mt-1 text-xs">
                  Selecione um representante para visualizar sua leitura contextual na imersão.
                </p>
              </div>
            ) : (
              /* CONTEXTUAL REPRESENTATIVE READING */
              <div className="space-y-3 text-xs">
                {/* Rep Header */}
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Representante na Imersão
                      </p>
                      <h3 className="text-base font-bold text-foreground">{selectedRep.name}</h3>
                      <p className="text-xs text-muted-foreground">{selectedRep.role}</p>
                    </div>
                    <Badge variant="outline">{selectedRep.region}</Badge>
                  </div>
                </div>

                {/* Papel na Imersão */}
                <div className="rounded-lg border bg-card p-3 shadow-2xs">
                  <p className="mb-1 font-semibold text-foreground">Papel & Atuação na Jornada</p>
                  <p className="text-muted-foreground leading-relaxed">
                    {selectedRep.immersionRole || "Participante atuante da imersão."}
                  </p>
                </div>

                {/* Percepções Gerais */}
                {selectedRep.perceptions && (
                  <div className="rounded-lg border bg-card p-3 shadow-2xs">
                    <p className="mb-1 font-semibold text-foreground">Percepção do Território</p>
                    <p className="text-muted-foreground leading-relaxed">
                      {selectedRep.perceptions}
                    </p>
                  </div>
                )}

                {/* Insights da Região */}
                {selectedRep.keyInsights && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                    <p className="mb-1 font-semibold text-primary">Insights Chave da Região</p>
                    <p className="text-foreground leading-relaxed">{selectedRep.keyInsights}</p>
                  </div>
                )}

                {/* Pontos de Ação */}
                {selectedRep.actionPoints && (
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <p className="mb-1 font-semibold text-emerald-700 dark:text-emerald-400">
                      Plano de Ação para o Representante
                    </p>
                    <p className="text-foreground leading-relaxed">{selectedRep.actionPoints}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
