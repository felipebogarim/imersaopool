import React, { useState, useEffect, useMemo } from "react";
import type { RepresentadaItem, ModeloNegocioRepresentada, RepStructure } from "@/lib/estrutura-rep/types";
import { MODELO_NEGOCIO_LABEL, CANAIS_COMERCIAIS } from "@/lib/estrutura-rep/types";
import {
  getSharedBrandLibrary,
  saveBrandToLibrary,
  normalizeBrandKey,
  type BrandLibraryItem,
} from "@/lib/estrutura-rep/brand-library";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase,
  Upload,
  Loader2,
  X,
  Link as LinkIcon,
  Check,
  Image as ImageIcon,
  Sparkles,
  Library,
  Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { processLogoUpload } from "@/lib/estrutura-rep/logo-upload";

interface BrandEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  brand?: RepresentadaItem | null;
  repNome?: string;
  allStructures?: Record<string, RepStructure> | RepStructure[];
  onSaveBrand: (brand: RepresentadaItem) => Promise<void> | void;
  onDeleteBrand?: (brandId: string) => Promise<void> | void;
}

export function BrandEditorModal({
  open,
  onOpenChange,
  brand,
  repNome,
  allStructures,
  onSaveBrand,
  onDeleteBrand,
}: BrandEditorModalProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [nome, setNome] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [segmento, setSegmento] = useState("Iluminação & Complementos");
  const [modeloNegocio, setModeloNegocio] = useState<ModeloNegocioRepresentada>("fabricante");
  const [abrangencia, setAbrangencia] = useState("Integral (todos os estados)");
  const [canais, setCanais] = useState<string[]>(["varejo", "projetos"]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [showLogoGallery, setShowLogoGallery] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");

  // Biblioteca unificada de marcas e logos já carregadas anteriormente
  const brandLibrary = useMemo(() => {
    return getSharedBrandLibrary(allStructures);
  }, [allStructures, open]);

  // Inicializa o formulário com dados da marca ou valores padrão
  useEffect(() => {
    if (open) {
      if (brand) {
        setNome(brand.nome || "");
        setLogoUrl(brand.logo_url || "");
        setSegmento(brand.segmento || "Iluminação & Complementos");
        setModeloNegocio(brand.modelo_negocio || "fabricante");
        setAbrangencia(brand.abrangencia || "Integral (todos os estados)");
        setCanais(brand.canais && brand.canais.length ? brand.canais : ["varejo", "projetos"]);
      } else {
        setNome("");
        setLogoUrl("");
        setSegmento("Iluminação & Complementos");
        setModeloNegocio("fabricante");
        setAbrangencia("Integral (todos os estados)");
        setCanais(["varejo", "projetos"]);
      }
      setShowUrlInput(false);
      setUrlDraft("");
    }
  }, [open, brand]);

  const handleSelectFromLibrary = (item: BrandLibraryItem) => {
    setNome(item.nome);
    if (item.logo_url) {
      setLogoUrl(item.logo_url);
    }
    if (item.segmento) {
      setSegmento(item.segmento);
    }
    if (item.modelo_negocio) {
      setModeloNegocio(item.modelo_negocio);
    }
    if (item.canais && item.canais.length > 0) {
      setCanais(item.canais);
    }
    if (item.abrangencia) {
      setAbrangencia(item.abrangencia);
    }
    toast.success(`Marca "${item.nome}" e logomarca selecionadas!`);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const dataUrl = await processLogoUpload(file);
      setLogoUrl(dataUrl);
      toast.success("Logomarca carregada com sucesso!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao processar imagem");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleApplyUrl = () => {
    if (!urlDraft.trim()) return;
    setLogoUrl(urlDraft.trim());
    setShowUrlInput(false);
    setUrlDraft("");
    toast.success("URL da logomarca vinculada!");
  };

  const handleToggleCanal = (canalId: string) => {
    setCanais((prev) =>
      prev.includes(canalId) ? prev.filter((c) => c !== canalId) : [...prev, canalId]
    );
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!nome.trim()) {
      toast.error("Informe o nome da marca representada.");
      return;
    }

    setSaving(true);
    try {
      const item: RepresentadaItem = {
        id: brand?.id || `brand-${Date.now()}`,
        nome: nome.trim(),
        logo_url: logoUrl.trim() || undefined,
        segmento: segmento.trim() || "Iluminação & Complementos",
        modelo_negocio: modeloNegocio,
        canais: canais.length ? canais : ["varejo"],
        abrangencia: abrangencia.trim() || "Integral",
      };

      // Salva na biblioteca compartilhada para ficar disponível para todos os representantes
      saveBrandToLibrary(item, repNome);

      await onSaveBrand(item);
      toast.success(brand ? "Marca atualizada com sucesso!" : "Marca cadastrada com sucesso!");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Falha ao salvar marca");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                {brand ? "Editar Marca Representada" : "Cadastrar Nova Marca Representada"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Informe os dados ou escolha uma marca já cadastrada no sistema.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
          {/* Seletor rápido de marcas / logos já carregadas anteriormente */}
          {brandLibrary.length > 0 && !brand && (
            <div className="p-3 rounded-xl border bg-muted/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  <span>Marcas já carregadas no sistema (seleção rápida)</span>
                </span>
                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-semibold bg-primary/10 text-primary border-primary/20">
                  {brandLibrary.length} disponíveis
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Clique para selecionar uma representada com sua logomarca sem precisar reenviar o arquivo:
              </p>

              {/* Chips com Logo + Nome das marcas disponíveis */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 no-scrollbar">
                {brandLibrary.map((libItem) => {
                  const isSelected = normalizeBrandKey(nome) === normalizeBrandKey(libItem.nome);
                  return (
                    <button
                      key={libItem.id}
                      type="button"
                      onClick={() => handleSelectFromLibrary(libItem)}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-left shrink-0 transition-all text-xs cursor-pointer ${
                        isSelected
                          ? "bg-primary/10 border-primary text-primary font-bold shadow-2xs"
                          : "bg-card hover:bg-muted border-border/80 text-foreground/90 shadow-2xs hover:border-primary/50"
                      }`}
                      title={libItem.origem || libItem.nome}
                    >
                      {libItem.logo_url ? (
                        <div className="h-6 w-10 bg-white rounded border flex items-center justify-center p-0.5 shrink-0">
                          <img src={libItem.logo_url} alt={libItem.nome} className="max-h-full max-w-full object-contain" />
                        </div>
                      ) : (
                        <div className="h-6 w-6 rounded bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">
                          {libItem.nome.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="truncate max-w-[130px] font-semibold">{libItem.nome}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Nome da Marca */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              Nome da Empresa / Marca <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="Ex: Stella Iluminação, Newline, Brilia..."
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className="h-9 text-xs"
              autoFocus
              required
            />
          </div>

          {/* Área de Upload da Logomarca */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold">Logomarca da Empresa</Label>
              <div className="flex items-center gap-2">
                {brandLibrary.some((b) => b.logo_url) && (
                  <button
                    type="button"
                    onClick={() => setShowLogoGallery(!showLogoGallery)}
                    className="text-[11px] text-primary hover:underline font-medium flex items-center gap-1"
                  >
                    <ImageIcon className="h-3 w-3" />
                    <span>{showLogoGallery ? "Fechar galeria" : "Galeria de logos"}</span>
                  </button>
                )}
                <span className="text-muted-foreground/60 text-xs">•</span>
                <button
                  type="button"
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className="text-[11px] text-primary hover:underline font-medium flex items-center gap-1"
                >
                  <LinkIcon className="h-3 w-3" />
                  <span>{showUrlInput ? "Ocultar URL" : "Inserir URL"}</span>
                </button>
              </div>
            </div>

            {/* Galeria Expansível de Logomarcas Já Carregadas */}
            {showLogoGallery && (
              <div className="p-3 bg-muted/40 rounded-xl border space-y-2 animate-in fade-in-0 duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-foreground">
                    Selecione uma logomarca já carregada:
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    Clique para aplicar à representada
                  </span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-40 overflow-y-auto pr-1 no-scrollbar">
                  {brandLibrary
                    .filter((b) => b.logo_url)
                    .map((item) => (
                      <button
                        key={`gal-${item.id}`}
                        type="button"
                        onClick={() => {
                          setLogoUrl(item.logo_url!);
                          setShowLogoGallery(false);
                          toast.success(`Logomarca de "${item.nome}" aplicada!`);
                        }}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg border bg-white hover:border-primary transition group text-center cursor-pointer ${
                          logoUrl === item.logo_url ? "border-primary ring-2 ring-primary/20" : "border-border/80"
                        }`}
                        title={`Usar logo de ${item.nome}`}
                      >
                        <div className="h-8 w-full flex items-center justify-center">
                          <img
                            src={item.logo_url}
                            alt={item.nome}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <span className="text-[10px] font-medium text-slate-700 truncate w-full mt-1">
                          {item.nome}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            )}

            {showUrlInput && (
              <div className="flex items-center gap-2 p-2 bg-muted/40 rounded-lg border">
                <Input
                  type="url"
                  placeholder="https://exemplo.com/logo.png"
                  value={urlDraft}
                  onChange={(e) => setUrlDraft(e.target.value)}
                  className="h-8 text-xs flex-1"
                />
                <Button type="button" size="sm" onClick={handleApplyUrl} className="h-8 text-xs px-2.5">
                  Aplicar
                </Button>
              </div>
            )}

            {logoUrl ? (
              <div className="flex items-center gap-3 p-3 rounded-xl border bg-card shadow-2xs">
                <div className="h-14 w-24 bg-white rounded-lg border flex items-center justify-center p-1.5 shrink-0 shadow-2xs">
                  <img src={logoUrl} alt="Preview Logo" className="max-h-full max-w-full object-contain" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-foreground block truncate">
                    Logomarca carregada
                  </span>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">
                    ✓ Pronta para exibição na faixa de representadas
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <label htmlFor="brand-logo-file-picker" className="cursor-pointer">
                    <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border text-xs font-medium bg-background hover:bg-muted text-muted-foreground transition shadow-2xs">
                      <Upload className="h-3 w-3" />
                      <span>Trocar</span>
                    </span>
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setLogoUrl("")}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Remover logo"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <label
                  htmlFor="brand-logo-file-picker"
                  className="border-2 border-dashed border-primary/30 hover:border-primary/60 rounded-xl p-4 bg-primary/5 hover:bg-primary/10 transition cursor-pointer flex flex-col items-center justify-center gap-1.5 text-center group block"
                >
                  {uploading ? (
                    <div className="flex items-center gap-2 text-xs text-primary font-semibold py-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Processando logomarca...</span>
                    </div>
                  ) : (
                    <>
                      <div className="p-2 rounded-full bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                        <Upload className="h-4 w-4" />
                      </div>
                      <span className="text-xs font-bold text-primary">
                        Clique para fazer upload da logomarca
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Aceita arquivos PNG, JPG, SVG ou WebP (máx. 15MB)
                      </span>
                    </>
                  )}
                </label>
              </div>
            )}

            {/* Input nativo oculto associado via htmlFor */}
            <input
              id="brand-logo-file-picker"
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
              onChange={handleFileChange}
              className="sr-only"
            />
          </div>

          {/* Segmento e Modelo de Negócio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Segmento de Atuação</Label>
              <Input
                placeholder="Ex: Iluminação Técnica, Decorativa, Automação"
                value={segmento}
                onChange={(e) => setSegmento(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Modelo de Negócio</Label>
              <Select
                value={modeloNegocio}
                onValueChange={(v) => setModeloNegocio(v as ModeloNegocioRepresentada)}
              >
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(MODELO_NEGOCIO_LABEL).map(([val, lbl]) => (
                    <SelectItem key={val} value={val} className="text-xs">
                      {lbl}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Abrangência Territorial */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Abrangência Territorial</Label>
            <Input
              placeholder="Ex: Integral (todos os estados atendidos) ou Apenas MT/GO"
              value={abrangencia}
              onChange={(e) => setAbrangencia(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          {/* Canais Comerciais */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Canais de Atendimento no Portfólio</Label>
            <div className="flex flex-wrap gap-1.5 pt-0.5">
              {CANAIS_COMERCIAIS.map((c) => {
                const isSelected = canais.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleToggleCanal(c.id)}
                    className={`text-xs px-2.5 py-1 rounded-md border font-medium transition ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary shadow-2xs"
                        : "bg-background hover:bg-muted text-muted-foreground border-border"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter className="pt-3 border-t flex items-center justify-end gap-2">
            {brand && onDeleteBrand && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                disabled={saving || uploading}
                className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 sm:mr-auto"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir da lista
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving || uploading}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving || uploading}
              className="text-xs font-semibold gap-1.5"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  Salvar Marca
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir marca da lista?</AlertDialogTitle>
            <AlertDialogDescription>
              {brand?.nome || "Esta marca"} será removida das marcas representadas deste
              representante.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!brand) return;
                await onDeleteBrand?.(brand.id);
                onOpenChange(false);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
