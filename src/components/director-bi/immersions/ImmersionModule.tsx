import { useState, useMemo } from "react";
import {
  Plus,
  ArrowLeft,
  Calendar,
  MapPin,
  Users,
  Building2,
  Filter,
  Compass,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BrazilMacroMap } from "./BrazilMacroMap";
import { ImmersionDetailMap } from "./ImmersionDetailMap";
import { ImmersionSidePanel } from "./ImmersionSidePanel";
import { PlannedImmersionDialog } from "./PlannedImmersionDialog";
import { ImmersionFormDialog } from "./ImmersionFormDialog";
import {
  loadStoredImmersions,
  saveStoredImmersions,
  filterImmersionsByTime,
} from "@/lib/director-immersion-data";
import type {
  ImmersionItem,
  TimeFilterOption,
  VisitedClient,
  RepParticipant,
} from "@/lib/director-immersion-types";
import { toast } from "sonner";

export function ImmersionModule() {
  const [immersions, setImmersions] = useState<ImmersionItem[]>(loadStoredImmersions);
  const [selectedImmersionId, setSelectedImmersionId] = useState<string | null>(null);
  const [timeFilter, setTimeFilter] = useState<TimeFilterOption>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Immersion detail state
  const [activeNucleus, setActiveNucleus] = useState<"clients" | "representatives">("clients");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedRepId, setSelectedRepId] = useState<string | null>(null);

  // Dialog states
  const [plannedPreview, setPlannedPreview] = useState<ImmersionItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingImmersion, setEditingImmersion] = useState<ImmersionItem | null>(null);

  // Filtered immersions
  const filteredImmersions = useMemo(() => {
    let list = filterImmersionsByTime(immersions, timeFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.cities.some((c) => c.toLowerCase().includes(q)) ||
          i.regionCovered.toLowerCase().includes(q) ||
          i.state.toLowerCase().includes(q),
      );
    }
    return list;
  }, [immersions, timeFilter, searchQuery]);

  const selectedImmersion = useMemo(
    () => immersions.find((i) => i.id === selectedImmersionId) ?? null,
    [immersions, selectedImmersionId],
  );

  const handleSaveImmersion = (item: ImmersionItem) => {
    const exists = immersions.some((i) => i.id === item.id);
    let next: ImmersionItem[];
    if (exists) {
      next = immersions.map((i) => (i.id === item.id ? item : i));
      toast.success("Imersão atualizada com sucesso.");
    } else {
      next = [item, ...immersions];
      toast.success("Nova imersão cadastrada com sucesso!");
    }
    setImmersions(next);
    saveStoredImmersions(next);
  };

  const handleOpenNewForm = () => {
    setEditingImmersion(null);
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-4">
      {/* 1. TOP TOOLBAR: Breadcrumb & Filter controls */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 shadow-2xs sm:flex-row sm:items-center sm:justify-between sm:p-4">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center gap-2">
          {selectedImmersion ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedImmersionId(null)}
              className="h-8 gap-1.5 text-xs font-medium"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Voltar ao Mapa Brasil
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Compass className="h-4 w-4" />
              </span>
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Visão Geral — Mapa Brasil
                </h3>
                <p className="text-xs font-bold text-foreground">
                  {filteredImmersions.length} Jornadas Mapeadas
                </p>
              </div>
            </div>
          )}

          {selectedImmersion && (
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">/</span>
              <Badge variant="secondary" className="font-semibold">
                {selectedImmersion.title}
              </Badge>
            </div>
          )}
        </div>

        {/* Global Action Bar (Filter & + Nova Imersão) */}
        <div className="flex flex-wrap items-center gap-2">
          {!selectedImmersion && (
            <>
              {/* Search input */}
              <div className="relative w-full sm:w-48">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar cidade ou estado…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-8 text-xs"
                />
              </div>

              {/* Time Filter Tabs */}
              <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1 text-xs">
                <Filter className="ml-1 h-3.5 w-3.5 text-muted-foreground" />
                {[
                  { key: "all", label: "Todos" },
                  { key: "6m", label: "Últimos 6 meses" },
                  { key: "12m", label: "Últimos 12 meses" },
                  { key: "2026", label: "Ano 2026" },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    onClick={() => setTimeFilter(opt.key as TimeFilterOption)}
                    className={`rounded-md px-2 py-1 text-[10px] font-medium transition-all ${
                      timeFilter === opt.key
                        ? "bg-background text-primary shadow-2xs font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Action Button: + Nova Imersão */}
          <Button size="sm" onClick={handleOpenNewForm} className="h-8 gap-1.5 text-xs">
            <Plus className="h-4 w-4" />
            Nova Imersão
          </Button>
        </div>
      </div>

      {/* 2. MAIN VIEW AREA */}
      {!selectedImmersion ? (
        /* VISTAS NACIONAL (MAPA BRASIL) */
        <BrazilMacroMap
          immersions={filteredImmersions}
          onSelectRealized={(immersion) => {
            setSelectedImmersionId(immersion.id);
            if (immersion.clients.length > 0) setSelectedClientId(immersion.clients[0].id);
            if (immersion.representatives.length > 0)
              setSelectedRepId(immersion.representatives[0].id);
          }}
          onSelectPlanned={(immersion) => setPlannedPreview(immersion)}
        />
      ) : (
        /* VISÃO ESPECÍFICA DA IMERSÃO SELECIONADA */
        <div className="space-y-3">
          {/* Top Compact Summary Header */}
          <div className="rounded-xl border bg-card p-4 shadow-2xs">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={selectedImmersion.status === "realizada" ? "default" : "outline"}
                    className={
                      selectedImmersion.status === "realizada"
                        ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                        : "border-amber-500 text-amber-600"
                    }
                  >
                    {selectedImmersion.status === "realizada" ? "Imersão Realizada" : "Planejada"}
                  </Badge>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {selectedImmersion.state}
                  </span>
                </div>
                <h2 className="mt-1 text-lg font-bold text-foreground">
                  {selectedImmersion.title}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {selectedImmersion.regionCovered}
                </p>
              </div>

              {/* Compact Meta Specs */}
              <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-primary" />
                  <span>
                    {selectedImmersion.startDate.split("-").reverse().join("/")} à{" "}
                    {selectedImmersion.endDate.split("-").reverse().join("/")}
                  </span>
                </div>
                <div className="h-3 w-px bg-border" />
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  <span>{selectedImmersion.cities.join(" · ")}</span>
                </div>
                <div className="h-3 w-px bg-border" />
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-primary" />
                  <span>{selectedImmersion.clients.length} Clientes Visita</span>
                </div>
                <div className="h-3 w-px bg-border" />
                <div className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <span>{selectedImmersion.representatives.length} Reps</span>
                </div>
              </div>
            </div>
          </div>

          {/* Dual Column Layout: Map (~65%) & Side Panel (~35%) */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Map Column (~65%) */}
            <div className="lg:col-span-7 xl:col-span-8">
              <ImmersionDetailMap
                immersion={selectedImmersion}
                activeNucleus={activeNucleus}
                selectedClientId={selectedClientId}
                onSelectClient={(client) => setSelectedClientId(client.id)}
                selectedRepId={selectedRepId}
              />
            </div>

            {/* Reading Side Panel Column (~35%) */}
            <div className="lg:col-span-5 xl:col-span-4">
              <ImmersionSidePanel
                immersion={selectedImmersion}
                activeNucleus={activeNucleus}
                onNucleusChange={setActiveNucleus}
                selectedClientId={selectedClientId}
                onSelectClient={(client) => setSelectedClientId(client.id)}
                selectedRepId={selectedRepId}
                onSelectRep={(rep) => setSelectedRepId(rep.id)}
              />
            </div>
          </div>
        </div>
      )}

      {/* 3. DIALOGS */}
      {/* Planned Immersion Preview Compact Dialog */}
      <PlannedImmersionDialog immersion={plannedPreview} onClose={() => setPlannedPreview(null)} />

      {/* New / Edit Immersion Form Dialog */}
      <ImmersionFormDialog
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveImmersion}
        initialData={editingImmersion}
      />
    </div>
  );
}
