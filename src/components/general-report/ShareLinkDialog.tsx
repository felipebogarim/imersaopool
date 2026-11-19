import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy, ExternalLink, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { setGeneralReportShare } from "@/lib/general-report.functions";

/** Link público (somente leitura) do relatório: qualquer pessoa com o link vê, sem login. */
export function ShareLinkDialog({
  reportId,
  open,
  onOpenChange,
}: {
  reportId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const shareFn = useServerFn(setGeneralReportShare);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  // Consulta separada e tolerante: sem a coluna (migration pendente) o resto da tela segue normal.
  const { data: token, isLoading } = useQuery({
    queryKey: ["general-report-share", reportId],
    enabled: open,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("general_reports")
        .select("share_token")
        .eq("id", reportId)
        .maybeSingle();
      return (data?.share_token as string | null) ?? null;
    },
  });

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  const url = token ? `${window.location.origin}/relatorio/${token}` : "";

  async function toggle(enabled: boolean) {
    setBusy(true);
    try {
      await shareFn({ data: { id: reportId, enabled } });
      await qc.invalidateQueries({ queryKey: ["general-report-share", reportId] });
      toast.success(enabled ? "Link público criado." : "Link desativado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível alterar o link.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado.");
    } catch {
      toast.error("Não foi possível copiar. Selecione o link e copie manualmente.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link público do relatório</DialogTitle>
          <DialogDescription>
            Qualquer pessoa com o link consegue ver o relatório online, sem login. Os arquivos
            originais não são expostos, só o relatório e as imagens citadas nele.
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : token ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
              <Button variant="outline" onClick={() => void copy()}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button variant="outline" asChild>
                <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Abrir">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              O link mostra sempre a versão mais recente do relatório. Desativar invalida o link
              atual.
            </p>
            <Button variant="outline" disabled={busy} onClick={() => void toggle(false)}>
              {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Desativar link
            </Button>
          </div>
        ) : (
          <Button disabled={busy} onClick={() => void toggle(true)}>
            {busy ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Link2 className="mr-1 h-4 w-4" />
            )}
            Criar link público
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
