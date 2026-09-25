import { useState } from "react";
import { Plus, MapPin, Calendar, Users, Building2, Target, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ImmersionItem, ImmersionStatus, CityStop } from "@/lib/director-immersion-types";

interface ImmersionFormDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (immersion: ImmersionItem) => void;
  initialData?: ImmersionItem | null;
}

export function ImmersionFormDialog({
  open,
  onClose,
  onSave,
  initialData,
}: ImmersionFormDialogProps) {
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [status, setStatus] = useState<ImmersionStatus>(initialData?.status ?? "planejada");
  const [startDate, setStartDate] = useState(initialData?.startDate ?? "");
  const [endDate, setEndDate] = useState(initialData?.endDate ?? "");
  const [state, setState] = useState(initialData?.state ?? "SP");
  const [citiesText, setCitiesText] = useState(initialData?.cities.join(", ") ?? "");
  const [regionCovered, setRegionCovered] = useState(initialData?.regionCovered ?? "");
  const [repsText, setRepsText] = useState(
    initialData?.representatives.map((r) => r.name).join(", ") ?? "",
  );
  const [clientsText, setClientsText] = useState(
    initialData?.clients.map((c) => c.name).join(", ") ?? "",
  );
  const [objective, setObjective] = useState(initialData?.objective ?? "");
  const [notes, setNotes] = useState(initialData?.notes ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const cities = citiesText
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    const cityStops: CityStop[] = cities.map((c, idx) => ({
      cityName: c,
      state,
      lat: -21.0 - idx * 0.4,
      lng: -47.5 - idx * 0.3,
      order: idx + 1,
      dayNumber: idx + 1,
    }));

    const representatives = repsText
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean)
      .map((name, idx) => ({
        id: `rep-custom-${Date.now()}-${idx}`,
        name,
        role: "Representante Regional",
        region: `${state} Regional`,
        immersionRole: "Participante da Jornada",
      }));

    const clients = clientsText
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean)
      .map((name, idx) => ({
        id: `cli-custom-${Date.now()}-${idx}`,
        name,
        cityName: cities[idx % Math.max(1, cities.length)] || cities[0] || "Centro",
        state,
        lat: -21.1 - idx * 0.1,
        lng: -47.6 - idx * 0.1,
        visitDate: startDate || new Date().toISOString().slice(0, 10),
        dayNumber: (idx % Math.max(1, cities.length)) + 1,
        scenario: "Cliente mapeado para a imersão comercial.",
        opportunities: "Prospecção inicial de portfólio.",
        threats: "Concorrência regional a avaliar.",
        relevantPerceptions: "Interesse em soluções de alta performance.",
        nextSteps: "Agendar visita presencial executiva.",
      }));

    const newItem: ImmersionItem = {
      id: initialData?.id ?? `immersion-${Date.now()}`,
      title: title.trim() || `Imersão ${state}`,
      status,
      startDate: startDate || new Date().toISOString().slice(0, 10),
      endDate: endDate || startDate || new Date().toISOString().slice(0, 10),
      state,
      cities: cities.length > 0 ? cities : ["Cidade Principal"],
      regionCovered: regionCovered.trim() || `Região de ${state}`,
      cityStops,
      representatives,
      clients,
      objective: objective.trim() || "Objetivo de expansão territorial e diagnostico comercial.",
      notes: notes.trim(),
      createdAt: initialData?.createdAt ?? new Date().toISOString(),
    };

    onSave(newItem);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] overflow-y-auto p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Plus className="h-5 w-5 text-primary" />
            {initialData ? "Editar Imersão" : "Cadastrar Nova Imersão"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Preencha os dados da jornada territorial (aceita múltiplas cidades e geolocalização).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-3 space-y-4 text-xs">
          {/* Nome e Status */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2 space-y-1">
              <Label htmlFor="title">Nome da Imersão *</Label>
              <Input
                id="title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Imersão Ribeirão Preto & Região"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="status">Status *</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ImmersionStatus)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planejada">Planejada</SelectItem>
                  <SelectItem value="realizada">Realizada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Datas e Estado */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="startDate">Data Inicial *</Label>
              <Input
                id="startDate"
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="endDate">Data Final *</Label>
              <Input
                id="endDate"
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="state">UF (Estado) *</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger id="state">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "SP",
                    "MG",
                    "RJ",
                    "PR",
                    "SC",
                    "RS",
                    "BA",
                    "PE",
                    "CE",
                    "GO",
                    "DF",
                    "ES",
                    "MT",
                    "MS",
                    "PA",
                    "MA",
                    "PB",
                    "RN",
                    "AL",
                    "SE",
                  ].map((uf) => (
                    <SelectItem key={uf} value={uf}>
                      {uf}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cidades (múltiplas) */}
          <div className="space-y-1">
            <Label htmlFor="citiesText">Cidades da Jornada (separadas por vírgula) *</Label>
            <Input
              id="citiesText"
              required
              value={citiesText}
              onChange={(e) => setCitiesText(e.target.value)}
              placeholder="Ex: Ribeirão Preto, Sertãozinho, Franca"
            />
            <p className="text-[11px] text-muted-foreground">
              Uma única imersão pode abranger várias cidades em sequência.
            </p>
          </div>

          {/* Região percorrida ou prevista */}
          <div className="space-y-1">
            <Label htmlFor="regionCovered">Região Percorrida ou Prevista</Label>
            <Input
              id="regionCovered"
              value={regionCovered}
              onChange={(e) => setRegionCovered(e.target.value)}
              placeholder="Ex: Nordeste Paulista — Polo Calçadista & Agroindustrial"
            />
          </div>

          {/* Representantes Envolvidos */}
          <div className="space-y-1">
            <Label htmlFor="repsText">Representantes Envolvidos (separados por vírgula)</Label>
            <Input
              id="repsText"
              value={repsText}
              onChange={(e) => setRepsText(e.target.value)}
              placeholder="Ex: Carlos Eduardo Silva, Roberto Mendes"
            />
          </div>

          {/* Clientes Visitados ou Previstos */}
          <div className="space-y-1">
            <Label htmlFor="clientsText">
              Clientes Visitados ou Previstos (separados por vírgula)
            </Label>
            <Input
              id="clientsText"
              value={clientsText}
              onChange={(e) => setClientsText(e.target.value)}
              placeholder="Ex: Comercial HidroRibeira, Sertão Piscinas, Franca Casa & Jardim"
            />
          </div>

          {/* Objetivo */}
          <div className="space-y-1">
            <Label htmlFor="objective">Objetivo da Imersão</Label>
            <Textarea
              id="objective"
              rows={2}
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="Ex: Mapear expansão comercial e avaliar concorrência no polo regional."
            />
          </div>

          {/* Observações */}
          <div className="space-y-1">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotações gerais, contexto da equipe ou direcionamentos estratégicos."
            />
          </div>

          <DialogFooter className="mt-5 gap-2 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit">Salvar Imersão</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
