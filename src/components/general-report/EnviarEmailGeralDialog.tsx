import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Monitor, Paperclip, Send, Smartphone, Users, X } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { EMAIL_RE, GRUPO_DIRETORIA } from "@/components/executive-report/EnviarEmailDialog";
import type { GeneralReportContent } from "@/lib/general-report-lib";

type Person = { id: string; name: string; email: string };
const MAX_FILE_BYTES = 25 * 1024 * 1024;
const LINK_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 dias
const db = supabase as any;

const absUrl = (u: string) => (u.startsWith("http") ? u : `${window.location.origin}${u}`);

/** Mesma estrutura do envio do Relatório Executivo (destinatários, grupo diretoria, anexos por link, pré-visualização). */
export function EnviarEmailGeralDialog({
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
  const [recipients, setRecipients] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [rendering, setRendering] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSubject(`${representative ? `${representative} - ` : ""}${report.title} - ${dateLabel}`);
    setPreviewHtml(null);
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
  }, [open, representative, report.title, dateLabel]);

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
    if (!EMAIL_RE.test(e)) return void toast.error("E-mail inválido.");
    if (!recipients.includes(e)) setRecipients((r) => [...r, e]);
    setQuery("");
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const picked = Array.from(list);
    const big = picked.filter((f) => f.size > MAX_FILE_BYTES);
    if (big.length) toast.error(`Arquivo acima de 25 MB: ${big.map((f) => f.name).join(", ")}`);
    setFiles((cur) => [
      ...cur,
      ...picked.filter(
        (f) => f.size <= MAX_FILE_BYTES && !cur.some((c) => c.name === f.name && c.size === f.size),
      ),
    ]);
  }

  /** Links assinados (90 dias) das imagens usadas no relatório e dos anexos adicionais. */
  async function buildAssets() {
    const imageIds = new Set<string>();
    for (const ch of report.chapters)
      for (const b of ch.blocks) if (b.type === "image") imageIds.add(b.fileId);
    const imageUrls: Record<string, string> = {};
    if (imageIds.size) {
      const { data: rows } = await db
        .from("general_report_files")
        .select("id, storage_path")
        .in("id", [...imageIds]);
      for (const r of rows ?? []) {
        const { data: s } = await supabase.storage
          .from("general-reports")
          .createSignedUrl(r.storage_path, LINK_TTL_SECONDS);
        if (s?.signedUrl) imageUrls[r.id] = absUrl(s.signedUrl);
      }
    }
    const attachments: Array<{ name: string; url: string; size: number }> = [];
    for (const file of files) {
      const path = `general-${reportId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]+/g, "_")}`;
      const up = await supabase.storage
        .from("email-anexos")
        .upload(path, file, { contentType: file.type || "application/octet-stream" });
      if (up.error) throw new Error(`${file.name}: ${up.error.message}`);
      const { data: s, error } = await supabase.storage
        .from("email-anexos")
        .createSignedUrl(path, LINK_TTL_SECONDS, { download: file.name });
      if (error || !s?.signedUrl) throw new Error(`${file.name}: não foi possível gerar o link`);
      attachments.push({ name: file.name, url: absUrl(s.signedUrl), size: file.size });
    }
    return { imageUrls, attachments };
  }

  async function buildPreview() {
    setRendering(true);
    try {
      const [{ render }, { GeneralReportEmail }] = await Promise.all([
        import("@react-email/render"),
        import("@/lib/email-templates/relatorio-geral"),
      ]);
      const html = await render(
        <GeneralReportEmail
          report={report}
          message={message}
          representative={representative}
          date={dateLabel}
          appUrl={window.location.href}
          reportId={reportId}
        />,
      );
      setPreviewHtml(html);
    } catch (e) {
      console.error(e);
      toast.error("Não foi possível gerar a pré-visualização.");
    } finally {
      setRendering(false);
    }
  }

  async function send() {
    if (!recipients.length) return void toast.error("Informe ao menos um destinatário.");
    setSending(true);
    try {
      const { imageUrls, attachments } = await buildAssets();
      const { data: session } = await supabase.auth.getSession();
      const token = session.session?.access_token;
      let failed = 0;
      let lastError = "";
      for (const to of recipients) {
        const res = await fetch("/lovable/email/transactional/send", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            templateName: "relatorio-geral",
            recipientEmail: to,
            idempotencyKey: `general-report-${reportId}-${to}-${Date.now()}`,
            templateData: {
              report,
              message,
              subject,
              representative,
              date: dateLabel,
              appUrl: window.location.href,
              reportId,
              imageUrls,
              attachments,
            },
          }),
        });
        if (!res.ok) {
          failed += 1;
          lastError = `${res.status} ${await res.text().catch(() => "")}`.slice(0, 200);
        }
      }
      if (failed) toast.error(`${failed} envio(s) falharam: ${lastError}`);
      else {
        toast.success("Relatório enviado.");
        onOpenChange(false);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar o relatório.");
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
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setRecipients((c) => [...c, ...GRUPO_DIRETORIA.filter((e) => !c.includes(e))])
                }
              >
                <Users className="mr-1 h-4 w-4" /> Enviar para grupo diretoria
              </Button>
            </div>
            <div className="mt-1 flex flex-wrap gap-2">
              {recipients.map((r) => (
                <Badge key={r} variant="secondary" className="gap-1">
                  {r}
                  <button
                    aria-label={`Remover ${r}`}
                    onClick={() => setRecipients((l) => l.filter((x) => x !== r))}
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
                  Até 25 MB por arquivo. Vão no e-mail como links seguros de download, válidos por
                  90 dias. O relatório completo vai no corpo do e-mail.
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
              <ul className="mt-2 space-y-1">
                {files.map((f) => (
                  <li
                    key={f.name + f.size}
                    className="flex items-center justify-between rounded bg-muted px-2 py-1 text-xs"
                  >
                    <span className="truncate">{f.name}</span>
                    <button
                      aria-label="Remover"
                      onClick={() => setFiles((l) => l.filter((x) => x !== f))}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void buildPreview()}
                disabled={rendering}
              >
                {rendering ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}Pré-visualizar
                e-mail
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
            <p className="text-xs text-muted-foreground">
              A pré-visualização não carrega as imagens do relatório; elas aparecem no e-mail
              enviado.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void send()} disabled={sending}>
            {sending ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1 h-4 w-4" />
            )}
            {sending ? "Enviando..." : "Enviar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
