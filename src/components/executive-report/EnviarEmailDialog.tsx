import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Monitor, Send, Smartphone, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toEmailData, type ExecutiveReportData } from "@/lib/executive-report/types";
import { exportExecutiveReportPdf } from "@/lib/executive-report/pdf";

type Person = { id: string; name: string; email: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function EnviarEmailDialog({
  open,
  onOpenChange,
  data,
  appUrl,
  onSent,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: ExecutiveReportData;
  appUrl: string;
  onSent: (args: { recipients: string[]; subject: string; attachPdf: boolean; error?: string }) => void;
}) {
  const finalData = useMemo(() => toFinalData(data), [data]);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [subject, setSubject] = useState(
    data.email?.subject || `Relatório Executivo de Imersão · ${data.client.display_name}`,
  );
  const [message, setMessage] = useState(data.email?.intro ?? "");
  const [attachPdf, setAttachPdf] = useState(true);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [sending, setSending] = useState(false);
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      const { data: rows } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .not("email", "is", null)
        .limit(500);
      setPeople(
        (rows ?? [])
          .filter((r: any) => r.email)
          .map((r: any) => ({ id: r.id, name: r.full_name ?? r.email, email: r.email })),
      );
    })();
  }, [open]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return people
      .filter(
        (p) =>
          !recipients.includes(p.email) &&
          (p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)),
      )
      .slice(0, 6);
  }, [query, people, recipients]);

  function addEmail(email: string) {
    const e = email.trim().toLowerCase();
    if (!EMAIL_RE.test(e)) {
      toast.error("E-mail inválido.");
      return;
    }
    if (recipients.includes(e)) return;
    setRecipients((r) => [...r, e]);
    setQuery("");
  }

  async function buildPreview() {
    setRendering(true);
    try {
      const [{ render }, { ExecutiveReportEmail }] = await Promise.all([
        import("@react-email/render"),
        import("@/lib/email-templates/relatorio-executivo"),
      ]);
      const html = await render(
        <ExecutiveReportEmail report={finalData} message={message} appUrl={appUrl} />,
      );
      setPreviewHtml(html);
    } catch (err) {
      toast.error("Não foi possível gerar a pré-visualização.");
      console.error(err);
    } finally {
      setRendering(false);
    }
  }

  async function send() {
    if (!recipients.length) {
      toast.error("Informe ao menos um destinatário.");
      return;
    }
    setSending(true);
    let failed = 0;
    let lastError = "";
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      for (const to of recipients) {
        const res = await fetch("/lovable/email/transactional/send", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            templateName: "relatorio-executivo",
            recipientEmail: to,
            idempotencyKey: `exec-report-${data.id}-v${data.current_version}-${to}-${Date.now()}`,
            templateData: { report: finalData, message, appUrl, subject },
          }),
        });
        if (!res.ok) {
          failed += 1;
          lastError = `${res.status} ${await res.text().catch(() => "")}`.slice(0, 300);
        }
      }
      if (attachPdf) exportExecutiveReportPdf(finalData);
      onSent({
        recipients,
        subject,
        attachPdf,
        error: failed ? `${failed} envio(s) falharam: ${lastError}` : undefined,
      });
      if (failed) toast.error(`${failed} envio(s) falharam.`);
      else toast.success("Relatório enviado.");
      if (!failed) onOpenChange(false);
    } catch (err) {
      toast.error("Falha ao enviar o relatório.");
      onSent({ recipients, subject, attachPdf, error: String(err).slice(0, 300) });
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar relatório por e-mail</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Destinatários</Label>
            <div className="mt-1 flex flex-wrap gap-2">
              {recipients.map((r) => (
                <Badge key={r} variant="secondary" className="gap-1">
                  {r}
                  <button
                    aria-label={`Remover ${r}`}
                    onClick={() => setRecipients((list) => list.filter((x) => x !== r))}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <Input
              className="mt-2"
              placeholder="Digite um e-mail ou busque um usuário pelo nome"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addEmail(query);
                }
              }}
            />
            {suggestions.length > 0 && (
              <div className="mt-1 rounded-md border bg-popover">
                {suggestions.map((p) => (
                  <button
                    key={p.id}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted"
                    onClick={() => addEmail(p.email)}
                  >
                    <span>{p.name}</span>
                    <span className="text-xs text-muted-foreground">{p.email}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label>Assunto</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>

          <div>
            <Label>Mensagem opcional</Label>
            <Textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Gerar PDF do relatório</p>
              <p className="text-xs text-muted-foreground">
                O relatório completo vai no corpo do e-mail. O PDF é gerado para download local — o
                envio de anexos não é suportado pela infraestrutura de e-mail do sistema.
              </p>
            </div>
            <Switch checked={attachPdf} onCheckedChange={setAttachPdf} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void buildPreview()} disabled={rendering}>
                {rendering ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                Pré-visualizar e-mail
              </Button>
              {previewHtml && (
                <>
                  <Button
                    size="sm"
                    variant={device === "desktop" ? "default" : "ghost"}
                    onClick={() => setDevice("desktop")}
                  >
                    <Monitor className="mr-1 h-4 w-4" /> Desktop
                  </Button>
                  <Button
                    size="sm"
                    variant={device === "mobile" ? "default" : "ghost"}
                    onClick={() => setDevice("mobile")}
                  >
                    <Smartphone className="mr-1 h-4 w-4" /> Mobile
                  </Button>
                </>
              )}
            </div>
            {previewHtml && (
              <div className="flex justify-center rounded-md border bg-muted p-3">
                <iframe
                  title="Pré-visualização do e-mail"
                  srcDoc={previewHtml}
                  sandbox=""
                  className="h-[420px] rounded bg-white"
                  style={{ width: device === "desktop" ? "100%" : 390 }}
                />
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void send()} disabled={sending}>
            {sending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
