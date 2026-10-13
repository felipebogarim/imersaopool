import React, { useState } from "react";
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
import { Building2, Plus, Sparkles, Loader2, Check } from "lucide-react";
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
  const [outrasMarcas, setOutrasMarcas] = useState("Newline Iluminação");

  const handleToggleState = (uf: string) => {
    setEstados((prev) => {
      if (prev.includes(uf)) {
        return prev.filter((s) => s !== uf);
      }
      return [...prev, uf];
    });
  };

  const handleApplyRegion = (ufs: string[]) => {
    setEstados((prev) => {
      const set = new Set([...prev, ...ufs]);
      return Array.from(set);
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
                    <SelectItem key={s.uf} value={s.uf} className="text-xs">
                      {s.uf} - {s.name}
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
                const isSelected = estados.includes(s.uf);
                return (
                  <button
                    key={s.uf}
                    type="button"
                    onClick={() => handleToggleState(s.uf)}
                    className={`h-7 rounded text-xs font-bold transition flex items-center justify-center border ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                        : "bg-background hover:bg-muted text-foreground border-border/80"
                    }`}
                  >
                    {s.uf}
                  </button>
                );
              })}
            </div>
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
