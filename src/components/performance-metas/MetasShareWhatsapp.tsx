// Botão "Compartilhar" do painel de metas do cliente: gera a imagem processada (cabeçalho +
// blocos da tela: gauge, timeline de categoria e gráfico com meta e atingimento nas barras)
// e permite compartilhar diretamente no WhatsApp, copiar ou baixar.

import { useEffect, useState, type RefObject } from "react";
import { Copy, Download, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { buildMetasShareImage, shareImageOnWhatsapp } from "@/lib/metas-share-image";

function WhatsappIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.22 3.08.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.23 1.36.2 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.29.17-1.41-.07-.12-.27-.2-.57-.35zM12.04 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.03c0-5.2 4.23-9.43 9.44-9.43 2.52 0 4.89.98 6.67 2.77a9.37 9.37 0 0 1 2.76 6.67c0 5.2-4.24 9.44-9.44 9.44zm8.03-17.47A11.3 11.3 0 0 0 12.04.7C5.78.7.68 5.8.68 12.06c0 2 .52 3.96 1.52 5.68L.58 23.3l5.7-1.5a11.3 11.3 0 0 0 5.76 1.47h.01c6.26 0 11.36-5.1 11.36-11.36 0-3.04-1.18-5.89-3.34-8.04z" />
    </svg>
  );
}

export function MetasShareWhatsapp({
  clienteNome,
  periodoReferencia,
  categoria,
  repName,
  blocks,
}: {
  clienteNome: string;
  periodoReferencia: string;
  categoria?: string | null;
  repName?: string | null;
  /** Blocos da tela que entram na imagem, na ordem. */
  blocks: Array<RefObject<HTMLElement | null>>;
}) {
  const [gerando, setGerando] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  const fileName = `metas-${
    clienteNome
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 60) || "cliente"
  }.png`;

  async function gerar() {
    const els = blocks.map((r) => r.current).filter((e): e is HTMLElement => !!e);
    if (els.length === 0) {
      toast.error("Elementos visuais ainda não carregados na tela.");
      return;
    }
    setGerando(true);
    try {
      const b = await buildMetasShareImage({
        clienteNome,
        periodoReferencia,
        categoria,
        repName,
        blocks: els,
      });
      setBlob(b);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível gerar a imagem.");
    } finally {
      setGerando(false);
    }
  }

  async function compartilhar() {
    if (!blob) return;
    const r = await shareImageOnWhatsapp(blob, fileName);
    if (r === "shared") {
      setBlob(null);
      toast.success("Metas compartilhadas com sucesso!");
    } else if (r === "copied") {
      toast.success("Imagem copiada para a área de transferência!", {
        description: "Abrimos o WhatsApp Web: basta colar (Ctrl/Cmd + V) na conversa.",
      });
    } else if (r === "downloaded") {
      toast.success("Imagem baixada.", {
        description: "Abrimos o WhatsApp Web: anexe a imagem baixada na conversa.",
      });
    }
  }

  async function copiar() {
    if (!blob) return;
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        toast.success("Imagem copiada para a área de transferência!", {
          description: "Você já pode colar diretamente na conversa do WhatsApp (Ctrl/Cmd + V).",
        });
      } else {
        toast.error("Seu navegador não suporta cópia direta de imagem.");
      }
    } catch (e) {
      toast.error("Não foi possível copiar a imagem.", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  function baixar() {
    if (!preview) return;
    const a = document.createElement("a");
    a.href = preview;
    a.download = fileName;
    a.click();
    toast.success("Download da imagem iniciado.");
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => void gerar()}
        disabled={gerando}
        className="gap-1.5 font-medium"
      >
        {gerando ? (
          <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
        ) : (
          <Share2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        )}
        {gerando ? "Gerando imagem…" : "Compartilhar"}
      </Button>

      <Dialog open={!!blob} onOpenChange={(v) => !v && setBlob(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-emerald-600" /> Compartilhar metas no WhatsApp
            </DialogTitle>
            <DialogDescription>
              Imagem processada com nome do cliente ({clienteNome}), período ({periodoReferencia}) e
              metas/atingimento por portfólio.
            </DialogDescription>
          </DialogHeader>

          {preview && (
            <div className="flex justify-center rounded-lg border border-border bg-slate-100 p-2 dark:bg-slate-900">
              <img
                src={preview}
                alt={`Metas de ${clienteNome}`}
                className="max-h-[60vh] w-auto max-w-full rounded-md object-contain shadow-sm"
              />
            </div>
          )}

          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={copiar}>
              <Copy className="mr-1.5 h-4 w-4" /> Copiar imagem
            </Button>
            <Button variant="outline" onClick={baixar}>
              <Download className="mr-1.5 h-4 w-4" /> Baixar imagem
            </Button>
            <Button
              onClick={() => void compartilhar()}
              className="bg-[#25D366] text-white hover:bg-[#1ebe5a] font-medium"
            >
              <WhatsappIcon className="mr-1.5 h-4 w-4" /> Enviar no WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
