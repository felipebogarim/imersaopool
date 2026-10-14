import React, { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BRAZIL_STATE_PATHS } from "@/components/director-bi/immersions/brazil-svg-paths";
import type { ModeloEscritorio, ModeloAtuacao, RepStructure } from "@/lib/estrutura-rep/types";
import { MODELO_ESCRITORIO_LABEL, MODELO_ATUACAO_LABEL } from "@/lib/estrutura-rep/types";
import { createRepresentativeWithStructure } from "@/lib/estrutura-rep/storage";
import { Building2, Plus, Sparkles, Loader2, Check, CalendarDays } from "lucide-react";
import { toast } from "sonner";

interface NewRepDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (newStructure: RepStructure) => void;
}

const MACRO_REGIOES: Record<string, string[]> = {
  "Centro-Oeste": ["MT", "MS", "GO", "DF"],
  Sudeste: ["SP", "RJ", "MG", "ES"],
  Sul: ["PR", "SC", "RS"],
  Nordeste: ["BA", "SE", "AL", "PE", "PB", "RN", "CE", "PI", "MA"],
  Norte: ["AM", "PA", "RO", "AC", "RR", "AP", "TO"],
};

export function NewRepDialog({ open, onOpenChange, onSuccess }: NewRepDialogProps) {
  const [loading, setLoading] = useState(false);

  const [nome, setNome] = useState("");
  const [representacao, setRepresentacao] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cidadeBase, setCidadeBase] = useState("");
  const [estadoBase, setEstadoBase] = useState("MT");
  const [regiao, setRegiao] = useState("Centro-Oeste");
  const [modeloAtuacao, setModeloAtuacao] = useState<ModeloAtuacao>("equipe");
  const [modeloEscritorio, setModeloEscritorio] = useState<ModeloEscritorio>("escritorio_fisico");
  const [estados, setEstados] = useState<string[]>(["MT", "GO", "DF"]);
  const [diasCampo, setDiasCampo] = useState<Record<string, number>>({ MT: 10, GO: 8, DF: 4 });
  const [outrasMarcas, setOutrasMarcas] = useState("Newline Iluminação");

  const totalDiasCampo = useMemo(() => {
    return estados.reduce((acc, uf) => acc + (diasCampo[uf] || 0), 0);
  }, [estados, diasCampo]);

  const handleToggleState = (uf: string) => {
    setEstados((prev) => {
      if (prev.includes(uf)) {
        return prev.filter((s) => s !== uf);
      }
      return [...prev, uf];
    });
    setDiasCampo((prev) => {
      if (prev[uf] !== undefined) return prev;
      return { ...prev, [uf]: 5 };
    });
  };

  const handleApplyRegion = (ufs: string[]) => {
    setEstados((prev) => {
      const set = new Set([...prev, ...ufs]);
      return Array.from(set);
    });
    setDiasCampo((prev) => {
      const next = { ...prev };
      ufs.forEach((uf) => {
        if (next[uf] === undefined) next[uf] = 5;
      });
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      toast.error("O nome do representante é obrigatório.");
      return;
    }

    setLoading(true);
    try {
      const created = await createRepresentativeWithStructure({
        nome,
        representacao: representacao.trim() || undefined,
        email: email.trim() || undefined,
        telefone: telefone.trim() || undefined,
        cidade_base: cidadeBase.trim() || undefined,
        estado_base: estadoBase || undefined,
        regiao: regiao.trim() || undefined,
        modelo_atuacao: modeloAtuacao,
        modelo_escritorio: modeloEscritorio,
        estados_atendidos: estados,
        dias_campo_por_estado: diasCampo,
        outras_marcas: outrasMarcas.trim() || undefined,
      });

      toast.success(`Representante "${nome}" cadastrado com sucesso!`);
      onOpenChange(false);
      // Reset form
      setNome("");
      setRepresentacao("");
      setEmail("");
      setTelefone("");
      setCidadeBase("");
      setEstados(["MT", "GO", "DF"]);
      setDiasCampo({ MT: 10, GO: 8, DF: 4 });
      setOutrasMarcas("Newline Iluminação");

      onSuccess(created);
    } catch (err: any) {
      toast.error(err?.message || "Falha ao cadastrar representante");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">Novo Representante & Estrutura</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Cadastre a representação comercial com sua cobertura territorial e modelo operacional.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Identificação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                Nome do Representante <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Ex: Carlos Silva"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Empresa / Razão Social</Label>
              <Input
                placeholder="Ex: Silva & Associados Rep"
                value={representacao}
                onChange={(e) => setRepresentacao(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Contato */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">E-mail Comercial</Label>
              <Input
                type="email"
                placeholder="contato@representacao.com.br"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Telefone / WhatsApp</Label>
              <Input
                placeholder="(65) 99999-0000"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          {/* Base e Modelos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Cidade Base</Label>
              <Input
                placeholder="Ex: Cuiabá"
                value={cidadeBase}
                onChange={(e) => setCidadeBase(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Estado Base (UF)</Label>
              <Select value={estadoBase} onValueChange={setEstadoBase}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BRAZIL_STATE_PATHS.map((s) => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">
                      {s.id} - {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Região Principal</Label>
              <Input
                placeholder="Ex: Centro-Oeste"
                value={regiao}
                onChange={(e) => setRegiao(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Modelo de Escritório</Label>
              <Select value={modeloEscritorio} onValueChange={(v) => setModeloEscritorio(v as ModeloEscritorio)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MODELO_ESCRITORIO_LABEL) as ModeloEscritorio[]).map((k) => (
                    <SelectItem key={k} value={k} className="text-xs">
                      {MODELO_ESCRITORIO_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Modelo de Atuação</Label>
              <Select value={modeloAtuacao} onValueChange={(v) => setModeloAtuacao(v as ModeloAtuacao)}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MODELO_ATUACAO_LABEL) as ModeloAtuacao[]).map((k) => (
                    <SelectItem key={k} value={k} className="text-xs">
                      {MODELO_ATUACAO_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Seleção de Estados Atendidos */}
          <div className="space-y-2 p-3 rounded-lg border bg-muted/20">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">
                Estados Atendidos ({estados.length} selecionados)
              </Label>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] px-2 text-muted-foreground"
                  onClick={() => setEstados([])}
                >
                  Limpar
                </Button>
              </div>
            </div>

            {/* Atalhos rápidos de região */}
            <div className="flex flex-wrap gap-1">
              {Object.entries(MACRO_REGIOES).map(([nomeReg, ufs]) => (
                <button
                  key={nomeReg}
                  type="button"
                  onClick={() => handleApplyRegion(ufs)}
                  className="text-[10px] font-medium px-2 py-0.5 rounded border bg-background hover:bg-muted text-muted-foreground transition"
                >
                  + {nomeReg}
                </button>
              ))}
            </div>

            {/* Grid com todas as 27 UFs */}
            <div className="grid grid-cols-6 sm:grid-cols-9 gap-1.5 pt-1">
              {BRAZIL_STATE_PATHS.map((s) => {
                const isSelected = estados.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => handleToggleState(s.id)}
                    className={`h-7 rounded text-xs font-bold transition flex items-center justify-center border ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                        : "bg-background hover:bg-muted text-foreground border-border/80"
                    }`}
                  >
                    {s.id}
                  </button>
                );
              })}
            </div>

            {/* Atuação em Campo por Estado (Dias por Mês) */}
            {estados.length > 0 && (
              <div className="pt-2.5 mt-2 border-t border-border/70 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                      <CalendarDays className="h-3.5 w-3.5 text-primary" />
                      <span>Atuação em Campo do Representante (dias/mês)</span>
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      Defina quantos dias por mês há atuação presencial/em campo em cada estado atendido:
                    </p>
                  </div>
                  {totalDiasCampo > 0 && (
                    <Badge variant="secondary" className="text-[11px] font-semibold h-5 px-2">
                      Total em campo: {totalDiasCampo} dias/mês
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                  {estados.map((uf) => {
                    const stateObj = BRAZIL_STATE_PATHS.find((s) => s.id === uf);
                    const stateName = stateObj?.name || uf;
                    const dias = diasCampo[uf] ?? 0;

                    return (
                      <div
                        key={uf}
                        className="flex items-center justify-between gap-2 p-2 rounded-md border bg-background shadow-2xs text-xs"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Badge variant="outline" className="font-bold text-[11px] px-1.5 py-0 h-5 shrink-0">
                            {uf}
                          </Badge>
                          <span className="text-[11px] truncate text-muted-foreground font-medium" title={stateName}>
                            {stateName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Input
                            type="number"
                            min={0}
                            max={31}
                            value={dias === 0 && diasCampo[uf] === undefined ? "" : dias}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const val = raw === "" ? 0 : Math.max(0, Math.min(31, parseInt(raw, 10) || 0));
                              setDiasCampo((prev) => ({
                                ...prev,
                                [uf]: val,
                              }));
                            }}
                            placeholder="0"
                            className="w-14 h-7 text-xs text-center font-bold px-1"
                          />
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">dias/mês</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Marcas Representadas */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Marcas Representadas (separadas por vírgula)</Label>
            <Input
              placeholder="Ex: Newline Iluminação, Stella, Brilha"
              value={outrasMarcas}
              onChange={(e) => setOutrasMarcas(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={loading} className="gap-1.5 text-xs font-semibold">
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Cadastrando...
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5" />
                  Cadastrar Representante
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
