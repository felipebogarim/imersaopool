import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, FileDown, Link2, Loader2, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { ImportedReportView } from "@/components/general-report/ImportedReportView";
import { ListenReportButton } from "@/components/executive-report/ListenReportButton";
import { EnviarEmailGeralDialog } from "@/components/general-report/EnviarEmailGeralDialog";
import { EnviarWhatsappImportadoDialog } from "@/components/general-report/EnviarWhatsappImportadoDialog";
import {
  buildImportedSpeechScript,
  importedToEmailContent,
} from "@/lib/general-report-import-share";
import { ShareLinkDialog } from "@/components/general-report/ShareLinkDialog";
import { periodText, type ImportedReport } from "@/lib/general-report-import";

export interface ImportedMeta {
  id: string;
  import_data: ImportedReport;
  import_pdf_path: string | null;
  import_pdf_name: string | null;
  import_pdf_sha256: string | null;
}

/** Detalhe de relatório importado: blocos nativos na ordem aprovada + PDF original (sem regerar). */
export function ImportedDetail({ meta }: { meta: ImportedMeta }) {
  const [busy, setBusy] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [whatsOpen, setWhatsOpen] = useState(false);
  const r = meta.import_data;
  const speech = useMemo(() => buildImportedSpeechScript(r), [r]);
  const emailContent = useMemo(() => importedToEmailContent(r), [r]);
  const dateLabel = new Date().toLocaleDateString("pt-BR");

  // Link público existente (se houver) entra no e-mail; sem link, o e-mail vai sem endereço.
  const { data: shareToken } = useQuery({
    queryKey: ["general-report-share", meta.id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("general_reports")
        .select("share_token")
        .eq("id", meta.id)
        .maybeSingle();
      return (data?.share_token as string | null) ?? null;
    },
  });

  async function download() {
    if (!meta.import_pdf_path) return toast.error("Este relatório não tem PDF anexado.");
    setBusy(true);
    try {
      // URL assinada e curta do arquivo ORIGINAL; o PDF continua privado.
      const { data, error } = await supabase.storage
        .from("general-reports")
        .createSignedUrl(meta.import_pdf_path, 300, {
          download: meta.import_pdf_name ?? "relatorio.pdf",
        });
      if (error || !data?.signedUrl) throw error ?? new Error("sem URL");
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      toast.error("Não foi possível baixar o PDF.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={r.title}
        subtitle={`${r.representative_name}${r.company ? ` · ${r.company}` : ""} · ${periodText(r.period)}`}
        actions={
          <>
            <ListenReportButton
              script={speech}
              fileName={`relatorio-geral-${r.representative_name
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, "-")}`}
            />
            <Button variant="outline" onClick={() => setEmailOpen(true)}>
              <Mail className="h-4 w-4 mr-1" />
              E-mail
            </Button>
            <Button variant="outline" onClick={() => setWhatsOpen(true)}>
              <MessageCircle className="h-4 w-4 mr-1" />
              WhatsApp
            </Button>
            <Button variant="outline" onClick={() => void download()} disabled={busy}>
              {busy ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4 mr-1" />
              )}
              Baixar PDF
            </Button>
            <Button variant="outline" onClick={() => setLinkOpen(true)}>
              <Link2 className="h-4 w-4 mr-1" />
              Link público
            </Button>
            <Button variant="outline" asChild>
              <Link to="/relatorio-geral">
                <ArrowLeft className="h-4 w-4 mr-1" />
                Relatórios
              </Link>
            </Button>
          </>
        }
      />
      <div className="px-4 sm:px-8 py-6 space-y-4 max-w-5xl">
        <p className="text-xs text-muted-foreground">
          Relatório importado (somente leitura) · ID {r.report_id}
          {meta.import_pdf_name ? ` · PDF: ${meta.import_pdf_name}` : ""}
          {meta.import_pdf_sha256 ? ` · SHA-256 ${meta.import_pdf_sha256.slice(0, 16)}…` : ""}
        </p>
        <ImportedReportView report={r} />
      </div>
      <ShareLinkDialog reportId={meta.id} open={linkOpen} onOpenChange={setLinkOpen} />
      <EnviarEmailGeralDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        reportId={meta.id}
        report={emailContent}
        representative={r.representative_name}
        dateLabel={dateLabel}
        defaultSubject={`${r.title}`}
        linkUrl={shareToken ? `${window.location.origin}/relatorio/${shareToken}` : ""}
      />
      <EnviarWhatsappImportadoDialog
        open={whatsOpen}
        onOpenChange={setWhatsOpen}
        reportId={meta.id}
        report={r}
      />
    </div>
  );
}
