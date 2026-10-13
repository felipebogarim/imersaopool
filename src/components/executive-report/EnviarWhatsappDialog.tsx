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
  Sparkles,
} from "lucide-react";
import type { ExecutiveReportData } from "@/lib/executive-report/types";
import {
  buildWhatsappUniversalUrl,
  buildWhatsappWebUrl,
  formatExecutiveReportForWhatsapp,
} from "@/lib/executive-report/whatsapp";

interface EnviarWhatsappDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: ExecutiveReportData;
  appUrl: string;
  immersionReportId?: string;
}

export function EnviarWhatsappDialog({
  open,
  onOpenChange,
  data,
  appUrl,
  immersionReportId,
}: EnviarWhatsappDialogProps) {
  const [phone, setPhone] = useState("");
  const [introMessage, setIntroMessage] = useState(
    data.email?.intro ?? "Olá! Segue a síntese do Relatório Executivo de Imersão:"
  );
  const [copied, setCopied] = useState(false);

  const formattedText = useMemo(() => {
    return formatExecutiveReportForWhatsapp(data, {
      appUrl,
      immersionReportId,
      introMessage,
    });
  }, [data, appUrl, immersionReportId, introMessage]);

  const webUrl = useMemo(() => {
    return buildWhatsappWebUrl(formattedText, phone);
  }, [formattedText, phone]);

  const mobileUrl = useMemo(() => {
    return buildWhatsappUniversalUrl(formattedText, phone);
  }, [formattedText, phone]);

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

  function handleOpenWeb() {
    window.open(webUrl, "_blank", "noopener,noreferrer");
    toast.success("Abrindo WhatsApp Web...");
    onOpenChange(false);
  }

  function handleOpenMobile() {
    window.open(mobileUrl, "_blank", "noopener,noreferrer");
    toast.success("Abrindo WhatsApp...");
    onOpenChange(false);
  }

  const clientName = data.client?.display_name || "Cliente";

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
                  Enviar Relatório por WhatsApp
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  {clientName} · Formatação limpa e estruturada para WhatsApp Web
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Parâmetros de envio */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1.5">
              <Label htmlFor="wa-phone" className="text-xs font-medium text-foreground/90">
                Número do WhatsApp <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Input
                id="wa-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ex.: (11) 98765-4321"
                className="h-9 text-xs"
              />
              <p className="text-[11px] text-muted-foreground/80">
                Se vazio, você escolhe a conversa diretamente no WhatsApp Web.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="wa-intro" className="text-xs font-medium text-foreground/90">
                Mensagem de abertura <span className="text-muted-foreground font-normal">(opcional)</span>
              </Label>
              <Textarea
                id="wa-intro"
                value={introMessage}
                onChange={(e) => setIntroMessage(e.target.value)}
                placeholder="Recado inicial antes do relatório..."
                rows={2}
                className="text-xs resize-none min-h-[36px] h-9 py-2"
              />
            </div>
          </div>

          {/* Prévia da Mensagem */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Prévia da Mensagem Formatada
                </span>
                <Badge variant="secondary" className="text-[10px] font-normal py-0 px-2 h-5">
                  <Sparkles className="h-3 w-3 mr-1 text-emerald-500" /> WhatsApp Ready
                </Badge>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {formattedText.length} caracteres
              </span>
            </div>

            {/* Container visual simulando mensagem limpa */}
            <div className="rounded-xl border border-border/70 bg-muted/40 p-1">
              <ScrollArea className="h-64 sm:h-72 w-full rounded-lg bg-background/80 p-4 border border-border/40">
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
              title="Abrir no app mobile ou link universal wa.me"
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

            <Button
              type="button"
              size="sm"
              onClick={handleOpenWeb}
              className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-colors"
            >
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Abrir no WhatsApp Web
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
