import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import coverAsset from "@/assets/cover-visao-mercado.png.asset.json";
import {
  DEFAULT_TITULO,
  renderCoverPreviewDataUrl,
  type CoverFields,
} from "@/lib/interview-cover";
import { exportInterviewPdf } from "@/lib/interview-report";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  interviewId: string;
  defaults?: Partial<CoverFields>;
};

type Step = "cover" | "form" | "preview";

export function ExportInterviewPdfDialog({ open, onOpenChange, interviewId, defaults }: Props) {
  const [step, setStep] = useState<Step>("cover");
  const [fields, setFields] = useState<CoverFields>({
    data: defaults?.data ?? new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    titulo: defaults?.titulo ?? DEFAULT_TITULO,
    entrevistado: defaults?.entrevistado ?? "",
    modelo: defaults?.modelo ?? "",
  });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (open) {
      setStep("cover");
      setFields({
        data: defaults?.data ?? new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
        titulo: defaults?.titulo ?? DEFAULT_TITULO,
        entrevistado: defaults?.entrevistado ?? "",
        modelo: defaults?.modelo ?? "",
      });
      setPreviewUrl(null);
    }
  }, [open, defaults?.data, defaults?.titulo, defaults?.entrevistado, defaults?.modelo]);

  async function goToPreview() {
    setLoading(true);
    try {
      const url = await renderCoverPreviewDataUrl(fields);
      setPreviewUrl(url);
      setStep("preview");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar preview");
    } finally {
      setLoading(false);
    }
  }

  async function confirmExport() {
    setExporting(true);
    try {
      await exportInterviewPdf(interviewId, fields);
      toast.success("PDF gerado");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao exportar");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Exportar PDF da entrevista</DialogTitle>
          <DialogDescription>
            {step === "cover" && "Escolha o modelo de capa."}
            {step === "form" && "Preencha os textos que aparecerão na capa."}
            {step === "preview" && "Confira a capa antes de gerar o PDF."}
          </DialogDescription>
        </DialogHeader>

        {step === "cover" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setStep("form")}
              className="group relative rounded-xl border-2 border-primary overflow-hidden text-left focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <img src={coverAsset.url} alt="Capa Visão de Mercado" className="w-full h-auto block" />
              <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                <Check className="h-4 w-4" />
              </div>
              <div className="p-3 text-sm font-medium">Visão de Mercado</div>
            </button>
            <div className="rounded-xl border border-dashed border-muted-foreground/30 flex items-center justify-center p-8 text-sm text-muted-foreground text-center">
              Mais modelos em breve
            </div>
          </div>
        )}

        {step === "form" && (
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="cov-data">Data</Label>
              <Input
                id="cov-data"
                value={fields.data}
                onChange={(e) => setFields((f) => ({ ...f, data: e.target.value }))}
                placeholder="Ex.: Julho 2026"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cov-titulo">Título principal</Label>
              <Input
                id="cov-titulo"
                value={fields.titulo}
                onChange={(e) => setFields((f) => ({ ...f, titulo: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cov-entr">Entrevistado</Label>
              <Input
                id="cov-entr"
                value={fields.entrevistado}
                onChange={(e) => setFields((f) => ({ ...f, entrevistado: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="cov-modelo">Modelo do documento</Label>
              <Input
                id="cov-modelo"
                value={fields.modelo}
                onChange={(e) => setFields((f) => ({ ...f, modelo: e.target.value }))}
              />
            </div>
          </div>
        )}

        {step === "preview" && previewUrl && (
          <div className="border rounded-lg overflow-hidden bg-muted">
            <iframe src={previewUrl} className="w-full h-[560px]" title="Preview da capa" />
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === "cover" && (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          )}
          {step === "form" && (
            <>
              <Button variant="ghost" onClick={() => setStep("cover")}>Voltar</Button>
              <Button onClick={goToPreview} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Ver preview
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button variant="ghost" onClick={() => setStep("form")}>Editar textos</Button>
              <Button onClick={confirmExport} disabled={exporting}>
                {exporting ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <FileDown className="h-4 w-4 mr-1" />}
                Gerar PDF
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
