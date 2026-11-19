import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImageIcon, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EnviarWhatsappGeralDialog } from "@/components/general-report/EnviarWhatsappGeralDialog";
import type { ImportedReport } from "@/lib/general-report-import";
import {
  captureOverallResultPng,
  formatImportedForWhatsapp,
  importedToEmailContent,
} from "@/lib/general-report-import-share";
import { setGeneralReportShare } from "@/lib/general-report.functions";

type Phase = "checking" | "consent" | "preparing" | "ready" | "error";

/**
 * WhatsApp do relatório importado: a mensagem leva o link público e, na prévia do link, o print do
 * gráfico "Resultado geral". Criar o link é explícito (consentimento) na primeira vez.
 */
export function EnviarWhatsappImportadoDialog({
  open,
  onOpenChange,
  reportId,
  report,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  reportId: string;
  report: ImportedReport;
}) {
  const qc = useQueryClient();
  const shareFn = useServerFn(setGeneralReportShare);
  const [phase, setPhase] = useState<Phase>("checking");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState("");

  const prepareImage = useCallback(
    async (t: string) => {
      setPhase("preparing");
      setError("");
      try {
        const el = document.getElementById("imported-overall-result");
        if (!el) throw new Error("O gráfico Resultado geral não está na tela.");
        const blob = await captureOverallResultPng(el);
        const up = await supabase.storage
          .from("general-reports")
          .upload(`${reportId}/og-resultado-geral.png`, blob, {
            upsert: true,
            contentType: "image/png",
          });
        if (up.error) throw up.error;
        setToken(t);
        setPhase("ready");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao preparar a imagem de prévia.");
        setPhase("error");
      }
    },
    [reportId],
  );

  useEffect(() => {
    if (!open) return;
    setPhase("checking");
    void (async () => {
      const { data } = await (supabase as any)
        .from("general_reports")
        .select("share_token")
        .eq("id", reportId)
        .maybeSingle();
      const t = (data?.share_token as string | null) ?? null;
      if (t) void prepareImage(t);
      else setPhase("consent");
    })();
  }, [open, reportId, prepareImage]);

  async function createLink() {
    setPhase("preparing");
    try {
      const r = await shareFn({ data: { id: reportId, enabled: true } });
      if (!r.token) throw new Error("Não foi possível criar o link.");
      void qc.invalidateQueries({ queryKey: ["general-report-share", reportId] });
      await prepareImage(r.token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível criar o link.");
      setPhase("error");
      toast.error("Não foi possível criar o link público.");
    }
  }

  const link = token ? `${window.location.origin}/relatorio/${token}` : "";
  const content = useMemo(() => importedToEmailContent(report), [report]);
  const textBuilder = useCallback(
    (intro: string) => formatImportedForWhatsapp(report, { link, introMessage: intro }),
    [report, link],
  );

  if (phase === "ready")
    return (
      <EnviarWhatsappGeralDialog
        open={open}
        onOpenChange={onOpenChange}
        reportId={reportId}
        report={content}
        representative={report.representative_name}
        dateLabel=""
        textBuilder={textBuilder}
      />
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Compartilhar por WhatsApp</DialogTitle>
          <DialogDescription>
            A mensagem leva o link do relatório online e, na prévia do WhatsApp, o print do gráfico
            Resultado geral.
          </DialogDescription>
        </DialogHeader>
        {phase === "consent" && (
          <div className="space-y-3 text-sm">
            <p>
              Para o WhatsApp mostrar a prévia, será criado um <strong>link público</strong>{" "}
              (somente leitura). O PDF original continua privado e você pode desativar o link a
              qualquer momento em <strong>Link público</strong>.
            </p>
            <Button onClick={() => void createLink()}>
              <Link2 className="mr-1 h-4 w-4" />
              Criar link e imagem de prévia
            </Button>
          </div>
        )}
        {(phase === "checking" || phase === "preparing") && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <ImageIcon className="h-4 w-4" /> Preparando o link e a imagem de prévia…
          </p>
        )}
        {phase === "error" && (
          <div className="space-y-3 text-sm">
            <p className="text-destructive">{error}</p>
            <Button
              variant="outline"
              onClick={() => void (token ? prepareImage(token) : createLink())}
            >
              Tentar novamente
            </Button>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
