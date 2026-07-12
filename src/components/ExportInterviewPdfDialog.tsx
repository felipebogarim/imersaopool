import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, FileDown, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import coverAsset from "@/assets/cover-visao-mercado.png.asset.json";
import coverDarkAsset from "@/assets/cover-dark-tablet.png.asset.json";
import {
  DEFAULT_TITULO,
  renderCoverPreviewDataUrl,
  renderIntervieweePreviewBlobUrl,
  type CoverFields,
  type CoverTemplate,
} from "@/lib/interview-cover";
import { exportInterviewPdf } from "@/lib/interview-report";


type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  interviewId: string;
  defaults?: Partial<CoverFields>;
};

type Step = "cover" | "form" | "preview";

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function ExportInterviewPdfDialog({ open, onOpenChange, interviewId, defaults }: Props) {
  const [step, setStep] = useState<Step>("cover");
  const [template, setTemplate] = useState<CoverTemplate>("visao");
  const [fields, setFields] = useState<CoverFields>({

    data: defaults?.data ?? new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
    titulo: defaults?.titulo ?? DEFAULT_TITULO,
    entrevistado: defaults?.entrevistado ?? "",
    modelo: defaults?.modelo ?? "",
  });
  const [includeInterviewee, setIncludeInterviewee] = useState(false);
  const [intervName, setIntervName] = useState<string>("");
  const [intervPhoto, setIntervPhoto] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [intervPreview, setIntervPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (open) {
      setStep("cover");
      setTemplate("visao");
      setFields({
        data: defaults?.data ?? new Date().toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
        titulo: defaults?.titulo ?? DEFAULT_TITULO,
        entrevistado: defaults?.entrevistado ?? "",
        modelo: defaults?.modelo ?? "",
      });
      setIncludeInterviewee(false);
      setIntervName(defaults?.entrevistado ?? "");
      setIntervPhoto(null);
      setCoverPreview(null);
      setIntervPreview(null);
    }
  }, [open, defaults?.data, defaults?.titulo, defaults?.entrevistado, defaults?.modelo]);

  async function onPickPhoto(f: File | null) {
    if (!f) return;
    if (f.size > 8 * 1024 * 1024) {
      toast.error("Imagem muito grande (máx 8MB)");
      return;
    }
    try {
      const url = await fileToDataUrl(f);
      setIntervPhoto(url);
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao ler imagem");
    }
  }

  async function goToPreview() {
    setLoading(true);
    try {
      const cover = await renderCoverPreviewDataUrl(fields);
      setCoverPreview(cover);
      if (includeInterviewee) {
        const p = await renderIntervieweePreviewBlobUrl({
          photoDataUrl: intervPhoto,
          name: intervName || fields.entrevistado,
        });
        setIntervPreview(p);
      } else {
        setIntervPreview(null);
      }
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
      await exportInterviewPdf(interviewId, {
        cover: fields,
        intervieweePage: includeInterviewee
          ? { include: true, photoDataUrl: intervPhoto, name: intervName || fields.entrevistado }
          : null,
      });
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Exportar PDF da entrevista</DialogTitle>
          <DialogDescription>
            {step === "cover" && "Escolha o modelo de capa."}
            {step === "form" && "Preencha os textos que aparecerão na capa."}
            {step === "preview" && "Confira antes de gerar o PDF."}
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

            <div className="rounded-lg border p-4 space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={includeInterviewee}
                  onCheckedChange={(v) => {
                    const on = v === true;
                    setIncludeInterviewee(on);
                    if (on && !intervName) setIntervName(fields.entrevistado);
                  }}
                />
                <span className="text-sm font-medium">Incluir página de apresentação do entrevistado</span>
              </label>

              {includeInterviewee && (
                <div className="grid gap-3 pl-6">
                  <div className="grid gap-2">
                    <Label htmlFor="interv-nome">Nome do entrevistado</Label>
                    <Input
                      id="interv-nome"
                      value={intervName}
                      onChange={(e) => setIntervName(e.target.value)}
                      placeholder="Ex.: Salton e Fábio"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Foto</Label>
                    <div className="flex items-center gap-3">
                      {intervPhoto ? (
                        <div className="relative">
                          <img
                            src={intervPhoto}
                            alt="Prévia"
                            className="h-24 w-24 object-cover rounded-md border"
                          />
                          <button
                            type="button"
                            onClick={() => setIntervPhoto(null)}
                            className="absolute -top-2 -right-2 bg-background border rounded-full p-0.5"
                            aria-label="Remover foto"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div className="h-24 w-24 rounded-md border border-dashed flex items-center justify-center text-muted-foreground">
                          <Upload className="h-5 w-5" />
                        </div>
                      )}
                      <div>
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => onPickPhoto(e.target.files?.[0] ?? null)}
                        />
                        <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                          <Upload className="h-4 w-4 mr-1" />
                          {intervPhoto ? "Trocar foto" : "Enviar foto"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-3">
            {coverPreview && (
              <div className="border rounded-lg overflow-hidden bg-muted">
                <iframe src={coverPreview} className="w-full h-[560px]" title="Preview da capa" />
              </div>
            )}
            {intervPreview && (
              <div className="border rounded-lg overflow-hidden bg-muted">
                <iframe src={intervPreview} className="w-full h-[560px]" title="Preview do entrevistado" />
              </div>
            )}
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
              <Button variant="ghost" onClick={() => setStep("form")}>Editar</Button>
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
