import React, { useState, useEffect } from "react";
import type {
  RepStructure,
  RepresentadaItem,
  MembroEquipe,
  ModeloEscritorio,
  ModeloAtuacao,
  ModeloNegocioRepresentada,
  VinculoEquipe,
  ModalidadeTrabalho,
  NivelHierarquico,
} from "@/lib/estrutura-rep/types";
import {
  MODELO_ESCRITORIO_LABEL,
  MODELO_ATUACAO_LABEL,
  MODELO_NEGOCIO_LABEL,
  CANAIS_COMERCIAIS,
  VINCULO_LABEL,
  MODALIDADE_LABEL,
  NIVEL_LABEL,
  RECURSOS_CONFIG,
} from "@/lib/estrutura-rep/types";
import { BRAZIL_STATE_PATHS } from "@/components/director-bi/immersions/brazil-svg-paths";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  MapPin,
  Briefcase,
  Network,
  Users,
  Plus,
  Trash2,
  Check,
  Save,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";

interface RepStructureEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  structure: RepStructure;
  onSave: (updated: RepStructure) => Promise<void>;
}

const REGIOES_BRASIL: Record<string, string[]> = {
  "Centro-Oeste": ["MT", "MS", "GO", "DF"],
  Sudeste: ["SP", "RJ", "MG", "ES"],
  Sul: ["PR", "SC", "RS"],
  Nordeste: ["BA", "SE", "AL", "PE", "PB", "RN", "CE", "PI", "MA"],
  Norte: ["AM", "PA", "RO", "AC", "RR", "AP", "TO"],
};

export function RepStructureEditorDialog({
  open,
  onOpenChange,
  structure,
  onSave,
}: RepStructureEditorDialogProps) {
  const [draft, setDraft] = useState<RepStructure>({ ...structure });
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("identificacao");

  // Novo item temporário para Marcas
  const [novaMarca, setNovaMarca] = useState<Partial<RepresentadaItem>>({
    nome: "",
    segmento: "",
    modelo_negocio: "fabricante",
    canais: ["varejo", "projetos"],
    abrangencia: "Integral",
  });

  // Novo membro temporário para Equipe
  const [novoMembro, setNovoMembro] = useState<Partial<MembroEquipe>>({
    nome: "",
    cargo: "",
    responsabilidades: [],
    vinculo: "clt",
    modalidade: "presencial",
    nivel: "operacao",
  });
  const [respInput, setRespInput] = useState("");

  useEffect(() => {
    if (open) {
      setDraft(JSON.parse(JSON.stringify(structure)));
    }
  }, [open, structure]);

  const handleToggleUf = (uf: string) => {
    setDraft((prev) => {
      const current = new Set(prev.estados_atendidos);
      if (current.has(uf)) {
        current.delete(uf);
      } else {
        current.add(uf);
      }
      return { ...prev, estados_atendidos: Array.from(current) };
    });
  };

  const handleSelectRegiaoCompleta = (ufs: string[]) => {
    setDraft((prev) => {
      const current = new Set(prev.estados_atendidos);
      const allSelected = ufs.every((u) => current.has(u));

      if (allSelected) {
        ufs.forEach((u) => current.delete(u));
      } else {
        ufs.forEach((u) => current.add(u));
      }

      return { ...prev, estados_atendidos: Array.from(current) };
    });
  };

  const handleAddMarca = () => {
    if (!novaMarca.nome?.trim()) {
      toast.error("Informe o nome da marca representada.");
      return;
    }

    const item: RepresentadaItem = {
      id: `brand-${Date.now()}`,
      nome: novaMarca.nome.trim(),
      segmento: novaMarca.segmento?.trim() || "Iluminação",
      modelo_negocio: novaMarca.modelo_negocio || "fabricante",
      canais: novaMarca.canais?.length ? novaMarca.canais : ["varejo"],
      abrangencia: novaMarca.abrangencia?.trim() || "Integral",
    };

    setDraft((prev) => ({
      ...prev,
      marcas_representadas: [...prev.marcas_representadas, item],
    }));

    setNovaMarca({
      nome: "",
      segmento: "",
      modelo_negocio: "fabricante",
      canais: ["varejo", "projetos"],
      abrangencia: "Integral",
    });
    toast.success("Representada adicionada.");
  };

  const handleRemoveMarca = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      marcas_representadas: prev.marcas_representadas.filter((m) => m.id !== id),
    }));
  };

  const handleAddMembro = () => {
    if (!novoMembro.nome?.trim() || !novoMembro.cargo?.trim()) {
      toast.error("Informe o nome e o cargo do integrante.");
      return;
    }

    const resps = respInput
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const item: MembroEquipe = {
      id: `member-${Date.now()}`,
      nome: novoMembro.nome.trim(),
      cargo: novoMembro.cargo.trim(),
      responsabilidades: resps.length ? resps : ["Atendimento geral"],
      vinculo: novoMembro.vinculo || "clt",
      modalidade: novoMembro.modalidade || "presencial",
      nivel: novoMembro.nivel || "operacao",
    };

    setDraft((prev) => ({
      ...prev,
      equipe: [...prev.equipe, item],
    }));

    setNovoMembro({
      nome: "",
      cargo: "",
      responsabilidades: [],
      vinculo: "clt",
      modalidade: "presencial",
      nivel: "operacao",
    });
    setRespInput("");
    toast.success("Integrante adicionado à equipe.");
  };

  const handleRemoveMembro = (id: string) => {
    setDraft((prev) => ({
      ...prev,
      equipe: prev.equipe.filter((m) => m.id !== id),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      toast.success("Estrutura da representação salva com sucesso!");
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro ao salvar estrutura: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 sm:p-6 pb-2 border-b">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <span>Editar Estrutura da Representação</span>
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            Configure território, marcas, estrutura física e equipe de {draft.nome_representante}.
          </p>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <div className="border-b px-4 bg-muted/30">
            <TabsList className="bg-transparent h-10 gap-1">
              <TabsTrigger value="identificacao" className="text-xs gap-1.5 data-[state=active]:bg-background">
                <Building2 className="h-3.5 w-3.5" /> Identificação
              </TabsTrigger>
              <TabsTrigger value="territorio" className="text-xs gap-1.5 data-[state=active]:bg-background">
                <MapPin className="h-3.5 w-3.5" /> Território ({draft.estados_atendidos.length})
              </TabsTrigger>
              <TabsTrigger value="marcas" className="text-xs gap-1.5 data-[state=active]:bg-background">
                <Briefcase className="h-3.5 w-3.5" /> Marcas ({draft.marcas_representadas.length})
              </TabsTrigger>
              <TabsTrigger value="estrutura" className="text-xs gap-1.5 data-[state=active]:bg-background">
                <Network className="h-3.5 w-3.5" /> Estrutura & Backoffice
              </TabsTrigger>
              <TabsTrigger value="equipe" className="text-xs gap-1.5 data-[state=active]:bg-background">
                <Users className="h-3.5 w-3.5" /> Equipe ({draft.equipe.length})
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            {/* 1. ABA IDENTIFICAÇÃO */}
            <TabsContent value="identificacao" className="space-y-4 m-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Nome da Empresa de Representação</Label>
                  <Input
                    value={draft.empresa_representacao || ""}
                    onChange={(e) => setDraft((d) => ({ ...d, empresa_representacao: e.target.value }))}
                    placeholder="Ex.: Lustres & Cia Representações"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Modelo de Atuação</Label>
                  <Select
                    value={draft.modelo_atuacao}
                    onValueChange={(v) => setDraft((d) => ({ ...d, modelo_atuacao: v as ModeloAtuacao }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="equipe">Estrutura com Equipe</SelectItem>
                      <SelectItem value="individual">Atuação Individual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Cidade da Base Operacional</Label>
                  <Input
                    value={draft.cidade_base || ""}
                    onChange={(e) => setDraft((d) => ({ ...d, cidade_base: e.target.value }))}
                    placeholder="Ex.: Cuiabá"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Estado da Base (UF)</Label>
                  <Input
                    value={draft.estado_base || ""}
                    onChange={(e) => setDraft((d) => ({ ...d, estado_base: e.target.value.toUpperCase() }))}
                    placeholder="Ex.: MT"
                    maxLength={2}
                  />
                </div>

                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold">Região Principal de Atuação</Label>
                  <Input
                    value={draft.regiao_principal || ""}
                    onChange={(e) => setDraft((d) => ({ ...d, regiao_principal: e.target.value }))}
                    placeholder="Ex.: Centro-Oeste (MT, GO e DF)"
                  />
                </div>
              </div>
            </TabsContent>

            {/* 2. ABA TERRITÓRIO */}
            <TabsContent value="territorio" className="space-y-5 m-0">
              {/* Seleção rápida por macro-regiões */}
              <div>
                <Label className="text-xs font-semibold mb-2 block">Seleção Rápida por Região:</Label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(REGIOES_BRASIL).map(([regiao, ufs]) => {
                    const count = ufs.filter((u) => draft.estados_atendidos.includes(u)).length;
                    const all = count === ufs.length;

                    return (
                      <Button
                        key={regiao}
                        type="button"
                        size="sm"
                        variant={all ? "default" : count > 0 ? "secondary" : "outline"}
                        className="text-xs h-7"
                        onClick={() => handleSelectRegiaoCompleta(ufs)}
                      >
                        {regiao} ({count}/{ufs.length})
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Grid com todas as 27 UFs */}
              <div>
                <Label className="text-xs font-semibold mb-2 block">
                  Estados Atendidos ({draft.estados_atendidos.length} selecionados):
                </Label>
                <div className="grid grid-cols-4 sm:grid-cols-9 gap-1.5">
                  {BRAZIL_STATE_PATHS.map((st) => {
                    const isSelected = draft.estados_atendidos.includes(st.id);

                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => handleToggleUf(st.id)}
                        className={`flex flex-col items-center justify-center p-2 rounded-md border text-xs font-bold transition-all ${
                          isSelected
                            ? "bg-primary text-primary-foreground border-primary shadow-xs"
                            : "bg-card hover:bg-muted text-muted-foreground border-border/80"
                        }`}
                      >
                        <span>{st.id}</span>
                        <span className="text-[9px] font-normal truncate max-w-full opacity-80">
                          {st.name.slice(0, 4)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Detalhamento municipal para as UFs selecionadas */}
              {draft.estados_atendidos.length > 0 && (
                <div className="border rounded-lg p-3 space-y-3 bg-muted/20">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-primary" />
                    <Label className="text-xs font-bold">Detalhamento Municipal / Exceções de Cobertura:</Label>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Especifique se algum estado possui atendimento apenas em municípios específicos (ex.: "Capital", "Interior", "Cuiabá e Várzea Grande").
                  </p>

                  <div className="space-y-2">
                    {draft.estados_atendidos.map((uf) => {
                      const det = draft.detalhes_municipais[uf] || { tipo: "todos", descricao: "" };

                      return (
                        <div key={uf} className="flex items-center gap-2 text-xs bg-background p-2 rounded border">
                          <Badge variant="outline" className="w-10 justify-center font-bold">
                            {uf}
                          </Badge>
                          <Select
                            value={det.tipo}
                            onValueChange={(t: any) => {
                              setDraft((d) => ({
                                ...d,
                                detalhes_municipais: {
                                  ...d.detalhes_municipais,
                                  [uf]: { ...det, tipo: t },
                                },
                              }));
                            }}
                          >
                            <SelectTrigger className="w-32 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todos">Integral (Todos)</SelectItem>
                              <SelectItem value="parcial">Parcial (Específico)</SelectItem>
                              <SelectItem value="capital">Apenas Capital</SelectItem>
                              <SelectItem value="interior">Apenas Interior</SelectItem>
                            </SelectContent>
                          </Select>

                          <Input
                            className="h-8 text-xs flex-1"
                            placeholder="Descreva as cidades atendidas (opcional)"
                            value={det.descricao || ""}
                            onChange={(e) => {
                              setDraft((d) => ({
                                ...d,
                                detalhes_municipais: {
                                  ...d.detalhes_municipais,
                                  [uf]: { ...det, descricao: e.target.value },
                                },
                              }));
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* 3. ABA MARCAS */}
            <TabsContent value="marcas" className="space-y-5 m-0">
              {/* Formulário para adicionar nova marca */}
              <div className="p-3.5 border rounded-lg bg-muted/20 space-y-3">
                <span className="text-xs font-bold block text-foreground flex items-center gap-1.5">
                  <Plus className="h-4 w-4 text-primary" /> Adicionar Representada ao Portfólio:
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Nome da Marca</Label>
                    <Input
                      className="h-8 text-xs"
                      placeholder="Ex.: Stella Iluminação"
                      value={novaMarca.nome || ""}
                      onChange={(e) => setNovaMarca((m) => ({ ...m, nome: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Segmento</Label>
                    <Input
                      className="h-8 text-xs"
                      placeholder="Ex.: Iluminação Técnica"
                      value={novaMarca.segmento || ""}
                      onChange={(e) => setNovaMarca((m) => ({ ...m, segmento: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Modelo de Negócio</Label>
                    <Select
                      value={novaMarca.modelo_negocio}
                      onValueChange={(v: any) => setNovaMarca((m) => ({ ...m, modelo_negocio: v }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(MODELO_NEGOCIO_LABEL).map(([val, lbl]) => (
                          <SelectItem key={val} value={val}>
                            {lbl}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Abrangência Territorial</Label>
                    <Input
                      className="h-8 text-xs"
                      placeholder="Ex.: Integral ou Apenas MT e GO"
                      value={novaMarca.abrangencia || ""}
                      onChange={(e) => setNovaMarca((m) => ({ ...m, abrangencia: e.target.value }))}
                    />
                  </div>

                  <div className="flex items-end">
                    <Button type="button" size="sm" onClick={handleAddMarca} className="w-full text-xs h-8">
                      <Plus className="h-3.5 w-3.5 mr-1" /> Incluir Marca
                    </Button>
                  </div>
                </div>
              </div>

              {/* Lista das marcas cadastradas */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Marcas no Portfólio ({draft.marcas_representadas.length}):</Label>
                {draft.marcas_representadas.map((marca) => (
                  <div
                    key={marca.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs gap-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-7 w-7 rounded bg-muted flex items-center justify-center font-bold text-[10px] shrink-0">
                        {marca.nome.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-foreground block truncate">{marca.nome}</span>
                        <span className="text-muted-foreground text-[11px] truncate">
                          {marca.segmento} • {MODELO_NEGOCIO_LABEL[marca.modelo_negocio] || marca.modelo_negocio}
                          {marca.abrangencia ? ` • ${marca.abrangencia}` : ""}
                        </span>
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => handleRemoveMarca(marca.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* 4. ABA ESTRUTURA FÍSICA & RECURSOS */}
            <TabsContent value="estrutura" className="space-y-5 m-0">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Modelo de Escritório / Instalação Física:</Label>
                <Select
                  value={draft.modelo_escritorio}
                  onValueChange={(v) => setDraft((d) => ({ ...d, modelo_escritorio: v as ModeloEscritorio }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(MODELO_ESCRITORIO_LABEL).map(([val, lbl]) => (
                      <SelectItem key={val} value={val}>
                        {lbl}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 pt-2 border-t">
                <Label className="text-xs font-semibold">Recursos e Funções Disponíveis no Backoffice:</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {RECURSOS_CONFIG.map((r) => {
                    const ativo = Boolean(draft.recursos_operacionais[r.key]);

                    return (
                      <div
                        key={r.key}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card gap-2"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-xs block text-foreground">{r.label}</span>
                          <span className="text-[11px] text-muted-foreground block truncate">
                            {r.descricao}
                          </span>
                        </div>
                        <Switch
                          checked={ativo}
                          onCheckedChange={(checked) =>
                            setDraft((d) => ({
                              ...d,
                              recursos_operacionais: {
                                ...d.recursos_operacionais,
                                [r.key]: checked,
                              },
                            }))
                          }
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1.5 pt-2 border-t">
                <Label className="text-xs font-semibold">Observações Operacionais:</Label>
                <Textarea
                  rows={2}
                  value={draft.recursos_operacionais.observacoes || ""}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      recursos_operacionais: {
                        ...d.recursos_operacionais,
                        observacoes: e.target.value,
                      },
                    }))
                  }
                  placeholder="Descreva detalhes da rotina, canais de atendimento e suporte"
                />
              </div>
            </TabsContent>

            {/* 5. ABA EQUIPE */}
            <TabsContent value="equipe" className="space-y-5 m-0">
              {/* Formulário para novo integrante */}
              <div className="p-3.5 border rounded-lg bg-muted/20 space-y-3">
                <span className="text-xs font-bold block text-foreground flex items-center gap-1.5">
                  <Plus className="h-4 w-4 text-primary" /> Cadastrar Integrante da Equipe:
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Nome</Label>
                    <Input
                      className="h-8 text-xs"
                      placeholder="Ex.: Mariana Silva"
                      value={novoMembro.nome || ""}
                      onChange={(e) => setNovoMembro((m) => ({ ...m, nome: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Cargo / Função</Label>
                    <Input
                      className="h-8 text-xs"
                      placeholder="Ex.: Assistente Comercial"
                      value={novoMembro.cargo || ""}
                      onChange={(e) => setNovoMembro((m) => ({ ...m, cargo: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Nível no Organograma</Label>
                    <Select
                      value={novoMembro.nivel}
                      onValueChange={(v: any) => setNovoMembro((m) => ({ ...m, nivel: v }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(NIVEL_LABEL).map(([val, lbl]) => (
                          <SelectItem key={val} value={val}>
                            {lbl}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Tipo de Vínculo</Label>
                    <Select
                      value={novoMembro.vinculo}
                      onValueChange={(v: any) => setNovoMembro((m) => ({ ...m, vinculo: v }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(VINCULO_LABEL).map(([val, lbl]) => (
                          <SelectItem key={val} value={val}>
                            {lbl}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Modalidade</Label>
                    <Select
                      value={novoMembro.modalidade}
                      onValueChange={(v: any) => setNovoMembro((m) => ({ ...m, modalidade: v }))}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(MODALIDADE_LABEL).map(([val, lbl]) => (
                          <SelectItem key={val} value={val}>
                            {lbl}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Responsabilidades (separadas por vírgula)</Label>
                    <Input
                      className="h-8 text-xs"
                      placeholder="Ex.: Pedidos, Cotações, Garantias"
                      value={respInput}
                      onChange={(e) => setRespInput(e.target.value)}
                    />
                  </div>
                </div>

                <Button type="button" size="sm" onClick={handleAddMembro} className="text-xs h-8">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar à Equipe
                </Button>
              </div>

              {/* Lista dos integrantes */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Integrantes Cadastrados ({draft.equipe.length}):</Label>
                {draft.equipe.map((membro) => (
                  <div
                    key={membro.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border bg-card text-xs gap-3"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                        {membro.nome.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <span className="font-bold text-foreground block truncate">{membro.nome}</span>
                        <span className="text-muted-foreground text-[11px] truncate">
                          {membro.cargo} • {VINCULO_LABEL[membro.vinculo] || membro.vinculo} • {MODALIDADE_LABEL[membro.modalidade] || membro.modalidade}
                        </span>
                        {membro.responsabilidades?.length > 0 && (
                          <span className="text-[10px] text-muted-foreground/80 block truncate">
                            {membro.responsabilidades.join(", ")}
                          </span>
                        )}
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10 shrink-0"
                      onClick={() => handleRemoveMembro(membro.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="p-4 border-t bg-muted/20 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            <Save className="h-4 w-4" />
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
