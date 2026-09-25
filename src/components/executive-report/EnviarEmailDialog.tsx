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
import { Loader2, Monitor, Paperclip, Send, Smartphone, Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toEmailData, type ExecutiveReportData } from "@/lib/executive-report/types";
import { exportExecutiveReportPdf } from "@/lib/executive-report/pdf";
import { useClientBI } from "@/lib/use-performance-bi";
import { FAROL_HEX, FAROL_LABEL } from "@/lib/performance-farol";

type Person = { id: string; name: string; email: string };

export type EmailAttachment = { name: string; url: string; size: number };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const GRUPO_DIRETORIA = [
  "felipebogarim@gmail.com",
  "marcos@newline.ind.br",
  "angelica.galan@newline.ind.br",
  "sergio@newline.ind.br",
  "filipe@newline.ind.br",
];
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const LINK_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 dias

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function EnviarEmailDialog({
  open,
  onOpenChange,
  data,
  appUrl,
  onSent,
  repId,
  razaoSocial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: ExecutiveReportData;
  appUrl: string;
  onSent: (args: { recipients: string[]; subject: string; attachPdf: boolean; error?: string }) => void;
  repId?: string | null;
  razaoSocial?: string | null;
}) {
  const finalData = useMemo(() => toEmailData(data), [data]);
  const { data: bi = null } = useClientBI(repId ?? "", razaoSocial ?? "");
  const families = useMemo(
    () =>
      (bi?.familias ?? []).map((f: any) => ({
        familia: f.familia,
        atingimento: f.atingimento_ratio != null ? f.atingimento_ratio * 100 : 0,
        farol: f.farol ? FAROL_LABEL[f.farol as keyof typeof FAROL_LABEL] : undefined,
        fill: FAROL_HEX[(f.farol ?? "sem_compra") as keyof typeof FAROL_HEX],
      })),
    [bi],
  );
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
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list);
    const tooBig = picked.filter((f) => f.size > MAX_FILE_BYTES);
    if (tooBig.length) toast.error(`Arquivo acima de 25 MB: ${tooBig.map((f) => f.name).join(", ")}`);
    const ok = picked.filter((f) => f.size <= MAX_FILE_BYTES);
    setFiles((cur) => [...cur, ...ok.filter((f) => !cur.some((c) => c.name === f.name && c.size === f.size))]);
  }

  async function uploadFiles(): Promise<EmailAttachment[]> {
    if (!files.length) return [];
    setUploading(true);
    try {
      const out: EmailAttachment[] = [];
      for (const file of files) {
        const safe = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${data.id}/${crypto.randomUUID()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from("email-anexos")
          .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
        if (upErr) throw new Error(`${file.name}: ${upErr.message}`);
        const { data: signed, error: signErr } = await supabase.storage
          .from("email-anexos")
          .createSignedUrl(path, LINK_TTL_SECONDS, { download: file.name });
        if (signErr || !signed?.signedUrl) throw new Error(`${file.name}: não foi possível gerar o link`);
        const url = signed.signedUrl.startsWith("http")
          ? signed.signedUrl
          : `${window.location.origin}${signed.signedUrl}`;
        out.push({ name: file.name, url, size: file.size });
      }
      return out;
    } finally {
      setUploading(false);
    }
  }

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

  function addGrupoDiretoria() {
    setRecipients((cur) => [...cur, ...GRUPO_DIRETORIA.filter((e) => !cur.includes(e))]);
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
        <ExecutiveReportEmail report={finalData} message={message} appUrl={appUrl} families={families} />,
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
      const attachments = await uploadFiles();
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
            templateData: {
              report: finalData,
              message,
              appUrl,
              subject,
              families,
              immersionReportId: data.immersion_report_id ?? null,
              representativeId: repId ?? null,
              attachments,
            },
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
            <div className="flex items-center justify-between">
              <Label>Destinatários</Label>
              <Button type="button" variant="outline" size="sm" onClick={addGrupoDiretoria}>
                <Users className="mr-1 h-4 w-4" /> Enviar para grupo diretoria
              </Button>
            </div>
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

          <div className="rounded-md border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Anexos</p>
                <p className="text-xs text-muted-foreground">
                  Até 25 MB por arquivo. Os arquivos vão no e-mail como links seguros de download,
                  válidos por 90 dias.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <label className="cursor-pointer">
                  <Paperclip className="mr-1 h-4 w-4" /> Anexar arquivos
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      addFiles(e.target.files);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              </Button>
            </div>
            {files.length > 0 && (
              <ul className="mt-3 space-y-1">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center justify-between rounded bg-muted px-2 py-1 text-xs"
                  >
                    <span className="truncate">{f.name}</span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      {formatBytes(f.size)}
                      <button
                        aria-label={`Remover ${f.name}`}
                        onClick={() => setFiles((cur) => cur.filter((_, idx) => idx !== i))}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Gerar PDF do relatório</p>
              <p className="text-xs text-muted-foreground">
                O relatório completo vai no corpo do e-mail e o PDF é gerado para download local.
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
          <Button onClick={() => void send()} disabled={sending || uploading}>
            {sending || uploading ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1 h-4 w-4" />
            )}
            {uploading ? "Enviando arquivos..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
