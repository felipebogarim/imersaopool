import { useMemo, useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  FileText,
  Loader2,
} from "lucide-react";
import type { RepStructure } from "@/lib/estrutura-rep/types";
import {
  formatRepStructureWhatsappText,
  formatWhatsappNumber,
} from "@/lib/estrutura-rep/whatsapp";
import { generateRepStructurePdf } from "@/lib/estrutura-rep/pdf";

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
  const [introMessage, setIntroMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);

  function selectDestination(dest: "desktop" | "web") {
    setDestination(dest);
    try {
      localStorage.setItem("rep_whatsapp_dest", dest);
    } catch {
      // noop
    }
  }

  const cleanPhone = useMemo(() => formatWhatsappNumber(phone), [phone]);

  const formattedText = useMemo(() => {
    const baseText = formatRepStructureWhatsappText(structure, {
      email: repContact?.email,
      telefone: phone || repContact?.telefone,
    });
    if (!introMessage.trim()) return baseText;
    return `${introMessage.trim()}\n\n${baseText}`;
  }, [structure, repContact, phone, introMessage]);

  const desktopUrl = useMemo(() => {
    const encoded = encodeURIComponent(formattedText);
    return cleanPhone
      ? `whatsapp://send?phone=${cleanPhone}&text=${encoded}`
      : `whatsapp://send?text=${encoded}`;
  }, [formattedText, cleanPhone]);

  const webUrl = useMemo(() => {
    const encoded = encodeURIComponent(formattedText);
    return cleanPhone
      ? `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
      : `https://web.whatsapp.com/send?text=${encoded}`;
  }, [formattedText, cleanPhone]);

  const mobileUrl = useMemo(() => {
    const encoded = encodeURIComponent(formattedText);
    return cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
  }, [formattedText, cleanPhone]);

  async function handleDownloadPdf(): Promise<void> {
    setGeneratingPdf(true);
    try {
      const { blob, filename } = await generateRepStructurePdf(structure);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast.success("PDF da Estrutura gerado e baixado com sucesso!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao gerar PDF da Estrutura");
    } finally {
      setGeneratingPdf(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(formattedText);
      setCopied(true);
      toast.success("Mensagem formatada copiada para a área de transferência!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar automaticamente.");
    }
  }

  async function handleOpenDesktop() {
    // Também baixa o PDF para que o usuário possa anexar na conversa
    void handleDownloadPdf();

    const a = document.createElement("a");
    a.href = desktopUrl;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    toast.success(
      isMac
        ? "Abrindo no WhatsApp Desktop do Mac... O PDF foi baixado para anexar na conversa."
        : "Abrindo no WhatsApp Desktop... O PDF foi baixado para anexar na conversa.",
      { duration: 5000 }
    );
    onOpenChange(false);
  }

  async function handleOpenWeb() {
    void handleDownloadPdf();
    window.open(webUrl, "_blank", "noopener,noreferrer");
    toast.success(
      "Abrindo WhatsApp Web no navegador... O PDF foi baixado para anexar na conversa.",
      { duration: 5000 }
    );
    onOpenChange(false);
  }

  function handleOpenMobile() {
    void handleDownloadPdf();
    window.open(mobileUrl, "_blank", "noopener,noreferrer");
    toast.success("Abrindo WhatsApp...");
    onOpenChange(false);
  }

  const repNome = structure.nome_representante || "Representante";
  const repEmpresa = structure.empresa_representacao || "Representação Comercial";
  const repSlug = repNome.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden border-border/80 shadow-2xl">
        {/* Top Header */}
        <div className="p-6 pb-4 border-b border-border/60 bg-gradient-to-r from-emerald-500/10 via-primary/5 to-transparent">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <MessageCircle className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle className="text-lg font-semibold tracking-tight">
                  Compartilhar Estrutura Rep por WhatsApp
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {repNome} ({repEmpresa}) · Compatível com WhatsApp Desktop (Mac) e WhatsApp Web
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

          {/* Parâmetros de envio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
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
                Se vazio, você escolhe a conversa diretamente no aplicativo.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wa-rep-intro" className="text-xs font-medium text-foreground/90">
                Mensagem de abertura <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Textarea
                id="wa-rep-intro"
                value={introMessage}
                onChange={(e) => setIntroMessage(e.target.value)}
                placeholder="Recado inicial antes do relatório..."
                rows={2}
                className="text-xs resize-none min-h-[36px] h-9 py-2"
              />
            </div>
          </div>

          {/* Card do Anexo PDF Executivo (Modelo Visual Padrão) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Documento Executivo em PDF (Modelo Padrão)
              </span>
              <Badge
                variant="outline"
                className="text-[10px] font-normal py-0 px-2 h-5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
              >
                1 Página · Alta Fidelidade
              </Badge>
            </div>
            <div className="rounded-xl border border-border/70 overflow-hidden bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3 p-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-xs font-semibold text-foreground truncate">
                    Estrutura-Rep-{repSlug}.pdf
                  </p>
                  <p className="text-[11px] text-muted-foreground line-clamp-1">
                    Mapa de atuação (dias/mês), Treinamentos, Frequência Top 10 e Organograma hierárquico.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleDownloadPdf}
                disabled={generatingPdf}
                className="h-8 px-3 text-xs shrink-0 gap-1.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
              >
                {generatingPdf ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                <span>Baixar PDF</span>
              </Button>
            </div>
          </div>

          {/* Prévia da Mensagem Formatada */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Prévia da Mensagem Formatada
                </span>
                <Badge variant="secondary" className="text-[10px] font-normal py-0 px-2 h-5">
                  Padrão WhatsApp
                </Badge>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {formattedText.length} caracteres
              </span>
            </div>

            {/* Container visual simulando mensagem limpa */}
            <div className="rounded-xl border border-border/70 bg-muted/40 p-1">
              <ScrollArea className="h-48 sm:h-56 w-full rounded-lg bg-background/80 p-4 border border-border/40">
                <pre className="font-mono text-xs whitespace-pre-wrap leading-relaxed text-foreground/90 select-text font-normal">
                  {formattedText}
                </pre>
              </ScrollArea>
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
              onClick={handleCopy}
              className="text-xs h-9"
            >
              {copied ? (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-500" /> Copiado!
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-3.5 w-3.5" /> Copiar texto
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleOpenMobile}
              className="text-xs h-9 text-muted-foreground hover:text-foreground"
              title="Abrir via link universal wa.me"
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
                disabled={generatingPdf}
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
                disabled={generatingPdf}
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
