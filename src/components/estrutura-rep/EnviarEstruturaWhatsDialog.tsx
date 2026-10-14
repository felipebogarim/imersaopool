import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  MessageCircle,
  Copy,
  Check,
  ExternalLink,
  Smartphone,
  Laptop,
  Globe,
  Download,
  Loader2,
  Sparkles,
  Info,
  RotateCw,
} from "lucide-react";
import type { RepStructure } from "@/lib/estrutura-rep/types";
import { formatWhatsappNumber } from "@/lib/estrutura-rep/whatsapp";
import {
  generateRepInfographicImage,
  type InfographicResult,
} from "@/lib/estrutura-rep/infographic";
import { uploadEstruturaImageToStorage } from "@/lib/estrutura-rep/thumbnail";

interface EnviarEstruturaWhatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  structure: RepStructure;
  repContact?: { email?: string | null; telefone?: string | null };
}

export function EnviarEstruturaWhatsDialog({
  open,
  onOpenChange,
  structure,
  repContact,
}: EnviarEstruturaWhatsDialogProps) {
  const isMac = typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent);

  const [destination, setDestination] = useState<"desktop" | "web">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rep_whatsapp_dest");
      if (saved === "web" || saved === "desktop") return saved;
    }
    return "desktop";
  });

  const [phone, setPhone] = useState(() => repContact?.telefone || "");
  const [copiedImage, setCopiedImage] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Infográfico gerado em formato de imagem vertical de alta fidelidade
  const [infographic, setInfographic] = useState<InfographicResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const repNome = structure.nome_representante || "Representante";
  const repEmpresa = structure.empresa_representacao || "Representação Comercial";
  const repSlug = repNome
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  // Gera o Infográfico de alta resolução em PNG
  const generateInfographic = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const result = await generateRepInfographicImage(structure);
      if (!result.dataUrl) {
        throw new Error("Canvas gerado sem dados de imagem.");
      }
      setInfographic(result);

      // Upload no background para persistência pública da imagem
      if (structure.representative_id && result.blob && result.blob.size > 0) {
        void uploadEstruturaImageToStorage(structure.representative_id, result.blob);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[EnviarEstruturaWhatsDialog] Erro ao gerar infográfico:", err);
      setLoadError("Falha na renderização visual do infográfico.");
      toast.error("Não foi possível gerar a imagem do infográfico.");
    } finally {
      setLoading(false);
    }
  }, [structure]);

  useEffect(() => {
    if (!open) return;
    void generateInfographic();
  }, [open, generateInfographic]);

  function selectDestination(dest: "desktop" | "web") {
    setDestination(dest);
    try {
      localStorage.setItem("rep_whatsapp_dest", dest);
    } catch {
      // noop
    }
  }

  const cleanPhone = useMemo(() => formatWhatsappNumber(phone), [phone]);

  const desktopUrl = useMemo(() => {
    return cleanPhone
      ? `whatsapp://send?phone=${cleanPhone}`
      : `whatsapp://send`;
  }, [cleanPhone]);

  const webUrl = useMemo(() => {
    return cleanPhone
      ? `https://web.whatsapp.com/send?phone=${cleanPhone}`
      : `https://web.whatsapp.com`;
  }, [cleanPhone]);

  const mobileUrl = useMemo(() => {
    return cleanPhone
      ? `https://wa.me/${cleanPhone}`
      : `https://wa.me/`;
  }, [cleanPhone]);

  // Copia a imagem do infográfico para o clipboard do sistema (para colar direto com Ctrl+V)
  async function handleCopyImage(): Promise<boolean> {
    if (!infographic?.blob) {
      toast.error("Infográfico ainda está sendo gerado...");
      return false;
    }
    if (typeof navigator === "undefined" || !navigator.clipboard?.write) {
      toast.error("Seu navegador não suporta cópia direta de imagem. Use o botão Baixar Imagem.");
      return false;
    }
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": infographic.blob }),
      ]);
      setCopiedImage(true);
      toast.success("Imagem do infográfico copiada! Basta pressionar Ctrl+V (ou colar) na conversa do WhatsApp.");
      setTimeout(() => setCopiedImage(false), 2500);
      return true;
    } catch (err) {
      console.warn("[EnviarEstruturaWhatsDialog] Falha ao copiar imagem:", err);
      return false;
    }
  }

  // Baixa o arquivo PNG no dispositivo
  function handleDownloadImage() {
    if (!infographic?.blob) {
      toast.error("Aguardando carregamento da imagem...");
      return;
    }
    setDownloading(true);
    try {
      const blobUrl = URL.createObjectURL(infographic.blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = infographic.filename || `infografico-${repSlug || "estrutura"}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);
      toast.success("Imagem do infográfico baixada com sucesso!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao baixar imagem");
    } finally {
      setDownloading(false);
    }
  }

  async function handleOpenDesktop() {
    // 1. Copia a imagem para o clipboard automaticamente
    await handleCopyImage();
    // 2. Baixa o arquivo PNG como garantia
    handleDownloadImage();

    // 3. Abre o app do WhatsApp
    const a = document.createElement("a");
    a.href = desktopUrl;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    toast.success(
      isMac
        ? "Abrindo WhatsApp Desktop no Mac... A imagem do infográfico já foi copiada. Pressione Cmd+V na conversa para colar e enviar!"
        : "Abrindo WhatsApp Desktop... A imagem do infográfico já foi copiada. Pressione Ctrl+V na conversa para colar e enviar!",
      { duration: 7000 }
    );
    onOpenChange(false);
  }

  async function handleOpenWeb() {
    await handleCopyImage();
    handleDownloadImage();

    window.open(webUrl, "_blank", "noopener,noreferrer");
    toast.success(
      "Abrindo WhatsApp Web no navegador... A imagem já foi copiada. Pressione Ctrl+V na conversa para colar e enviar!",
      { duration: 7000 }
    );
    onOpenChange(false);
  }

  async function handleOpenMobile() {
    // Se o dispositivo suportar Web Share API com arquivos de imagem, compartilha direto
    if (infographic?.blob) {
      const file = new File([infographic.blob], infographic.filename, {
        type: "image/png",
      });
      const nav: any = typeof navigator !== "undefined" ? navigator : null;
      if (nav && nav.canShare && nav.canShare({ files: [file] })) {
        try {
          await nav.share({
            files: [file],
            title: `Infográfico Estrutura Comercial — ${repNome}`,
          });
          toast.success("Compartilhado com sucesso!");
          onOpenChange(false);
          return;
        } catch (err: any) {
          if (err?.name === "AbortError") return;
        }
      }
    }

    handleDownloadImage();
    window.open(mobileUrl, "_blank", "noopener,noreferrer");
    toast.success("Abrindo WhatsApp...");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden border-border/80 shadow-2xl">
        {/* Top Header */}
        <div className="p-6 pb-4 border-b border-border/60 bg-gradient-to-r from-emerald-500/10 via-primary/5 to-transparent">
          <DialogHeader>
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <MessageCircle className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle className="text-lg font-semibold tracking-tight flex items-center gap-2">
                  <span>Compartilhar Infográfico no WhatsApp</span>
                  <Badge
                    variant="outline"
                    className="text-[10px] font-medium border-emerald-500/30 text-emerald-600 dark:text-emerald-400 py-0.5"
                  >
                    Imagem PNG · 100% Visual
                  </Badge>
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {repNome} ({repEmpresa}) · Formato infográfico pronto para colar e enviar
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Destino de Abertura (Desktop Mac vs Web) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-border/70 bg-muted/30">
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                {destination === "desktop" ? (
                  <Laptop className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Globe className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                )}
                Destino do envio:
              </p>
              <p className="text-[11px] text-muted-foreground leading-normal">
                {destination === "desktop"
                  ? isMac
                    ? "Abre diretamente no app WhatsApp Desktop instalado no Mac (sem escanear QR Code)."
                    : "Abre diretamente no app WhatsApp Desktop instalado no computador."
                  : "Abre em nova aba do navegador em web.whatsapp.com."}
              </p>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-background/90 rounded-lg border border-border/70 self-start sm:self-auto shrink-0">
              <Button
                type="button"
                size="sm"
                variant={destination === "desktop" ? "default" : "ghost"}
                onClick={() => selectDestination("desktop")}
                className={`h-7 px-2.5 text-xs font-medium rounded-md transition-all ${
                  destination === "desktop"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Laptop className="h-3.5 w-3.5 mr-1.5" />
                {isMac ? "WhatsApp Mac" : "WhatsApp App"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={destination === "web" ? "default" : "ghost"}
                onClick={() => selectDestination("web")}
                className={`h-7 px-2.5 text-xs font-medium rounded-md transition-all ${
                  destination === "web"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Globe className="h-3.5 w-3.5 mr-1.5" />
                WhatsApp Web
              </Button>
            </div>
          </div>

          {/* Telefone do destinatário */}
          <div className="space-y-1.5">
            <Label htmlFor="wa-rep-phone" className="text-xs font-medium text-foreground/90">
              Número do WhatsApp <span className="text-muted-foreground font-normal">(opcional)</span>
            </Label>
            <Input
              id="wa-rep-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ex.: (11) 98765-4321"
              className="h-9 text-xs"
            />
            <p className="text-[11px] text-muted-foreground/80">
              Se vazio, você escolhe o contato ou grupo diretamente no aplicativo do WhatsApp.
            </p>
          </div>

          {/* Dica de Envio Visual */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 text-emerald-950 dark:text-emerald-100">
            <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-[11.5px] leading-relaxed">
              <strong>Como funciona o envio do Infográfico:</strong> Ao clicar no botão de envio abaixo,
              a imagem é <strong>copiada automaticamente para sua área de transferência</strong> e o
              arquivo PNG é baixado. Na conversa que se abrir no WhatsApp, basta pressionar{" "}
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-background rounded border border-border">
                {isMac ? "Cmd+V" : "Ctrl+V"}
              </kbd>{" "}
              para colar e enviar a imagem completa na hora!
            </div>
          </div>

          {/* Preview do Infográfico Completo */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <span>Prévia do Infográfico</span>
                <span className="text-[10px] font-normal text-muted-foreground lowercase">
                  (rolagem vertical)
                </span>
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadImage}
                  disabled={loading || !infographic}
                  className="h-6 px-2.5 text-[11px] gap-1 border-border/80 hover:bg-muted"
                >
                  <Download className="h-3 w-3" />
                  Baixar PNG
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleCopyImage}
                  disabled={loading || !infographic}
                  className="h-6 px-2.5 text-[11px] gap-1 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                >
                  {copiedImage ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      Copiar Imagem
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Container do Infográfico com rolagem suave */}
            <div className="rounded-xl border border-border/80 bg-slate-900/5 dark:bg-slate-950/40 p-2 overflow-hidden shadow-inner flex justify-center">
              <div className="max-h-[360px] sm:max-h-[420px] w-full overflow-y-auto rounded-lg border border-border/60 bg-background flex flex-col items-center p-2 relative">
                {loading ? (
                  <div className="py-24 flex flex-col items-center justify-center text-muted-foreground text-xs gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                    <span>Gerando imagem do infográfico em alta resolução...</span>
                  </div>
                ) : infographic?.dataUrl ? (
                  <img
                    src={infographic.dataUrl}
                    alt={`Infográfico da Estrutura Comercial — ${repNome}`}
                    className="w-full max-w-[620px] rounded-md shadow-xs object-contain"
                  />
                ) : (
                  <div className="py-16 px-4 flex flex-col items-center justify-center text-muted-foreground text-xs gap-2 text-center">
                    <Info className="h-6 w-6 text-amber-500/80" />
                    <span className="font-medium text-foreground">
                      {loadError || "Nenhuma imagem disponível"}
                    </span>
                    <p className="text-[11px] text-muted-foreground max-w-sm">
                      Ocorreu uma instabilidade na geração da imagem pelo navegador. Clique abaixo para tentar renderizar novamente.
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => void generateInfographic()}
                      className="mt-2 text-xs h-8 gap-1.5 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                      Tentar Novamente
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer com Ações */}
        <DialogFooter className="p-4 px-6 border-t border-border/60 bg-muted/20 flex-col sm:flex-row gap-2 sm:gap-0 sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyImage}
              disabled={loading || !infographic}
              className="text-xs h-9 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
            >
              {copiedImage ? (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> Imagem Copiada!
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-3.5 w-3.5 text-emerald-600" /> Copiar Imagem
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleOpenMobile}
              disabled={loading || !infographic}
              className="text-xs h-9 text-muted-foreground hover:text-foreground"
              title="Abrir no celular via link universal ou Web Share"
            >
              <Smartphone className="mr-1.5 h-3.5 w-3.5" /> wa.me
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs h-9"
            >
              Cancelar
            </Button>

            {destination === "desktop" ? (
              <Button
                type="button"
                size="sm"
                onClick={handleOpenDesktop}
                disabled={loading || !infographic}
                className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-colors"
              >
                <Laptop className="mr-1.5 h-3.5 w-3.5" />
                {isMac ? "Abrir no WhatsApp Desktop (Mac)" : "Abrir no WhatsApp Desktop"}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleOpenWeb}
                disabled={loading || !infographic}
                className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-colors"
              >
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Abrir no WhatsApp Web
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
