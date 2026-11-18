import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, Globe, Laptop, MessageCircle, Smartphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  buildWhatsappDesktopUrl,
  buildWhatsappUniversalUrl,
  buildWhatsappWebUrl,
} from "@/lib/executive-report/whatsapp";
import { formatGeneralReportForWhatsapp } from "@/lib/general-report-whatsapp";
import type { GeneralReportContent } from "@/lib/general-report-lib";

/** Mesma lógica do envio por WhatsApp do Relatório Executivo: monta a mensagem e abre o WhatsApp (app, web ou celular). */
export function EnviarWhatsappGeralDialog({
  open,
  onOpenChange,
  reportId,
  report,
  representative,
  dateLabel,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reportId: string;
  report: GeneralReportContent;
  representative: string;
  dateLabel: string;
}) {
  const [destination, setDestination] = useState<"desktop" | "web">(() => {
    try {
      const saved = localStorage.getItem("exec_whatsapp_dest");
      if (saved === "web" || saved === "desktop") return saved;
    } catch {
      // sem localStorage
    }
    return "desktop";
  });
  const [phone, setPhone] = useState("");
  const [intro, setIntro] = useState("");
  const [copied, setCopied] = useState(false);

  const text = useMemo(
    () =>
      formatGeneralReportForWhatsapp(report, {
        representative,
        dateLabel,
        introMessage: intro,
        link:
          typeof window !== "undefined"
            ? `${window.location.origin}/relatorio-geral/${reportId}`
            : undefined,
      }),
    [report, representative, dateLabel, intro, reportId],
  );

  function pick(d: "desktop" | "web") {
    setDestination(d);
    try {
      localStorage.setItem("exec_whatsapp_dest", d);
    } catch {
      // noop
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Mensagem copiada.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar automaticamente.");
    }
  }

  function openWhats() {
    if (destination === "desktop") {
      const a = document.createElement("a");
      a.href = buildWhatsappDesktopUrl(text, phone);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      window.open(buildWhatsappWebUrl(text, phone), "_blank", "noopener,noreferrer");
    }
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Compartilhar por WhatsApp</DialogTitle>
          <DialogDescription>
            A mensagem leva o resumo por capítulo e o link para o relatório completo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Telefone (opcional)</Label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Mensagem de abertura (opcional)</Label>
            <Input
              value={intro}
              onChange={(e) => setIntro(e.target.value)}
              placeholder="Ex.: Segue o relatório da imersão."
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={destination === "desktop" ? "default" : "outline"}
              onClick={() => pick("desktop")}
            >
              <Laptop className="mr-1 h-4 w-4" />
              WhatsApp Desktop
            </Button>
            <Button
              size="sm"
              variant={destination === "web" ? "default" : "outline"}
              onClick={() => pick("web")}
            >
              <Globe className="mr-1 h-4 w-4" />
              WhatsApp Web
            </Button>
            <Button size="sm" variant="outline" asChild>
              <a
                href={buildWhatsappUniversalUrl(text, phone)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Smartphone className="mr-1 h-4 w-4" />
                Celular
              </a>
            </Button>
          </div>
          <Textarea readOnly rows={12} value={text} className="font-mono text-xs" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => void copy()}>
            {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}Copiar
            mensagem
          </Button>
          <Button onClick={openWhats}>
            <MessageCircle className="mr-1 h-4 w-4" />
            Abrir WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
