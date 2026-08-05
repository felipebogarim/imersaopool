import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, Upload, Copy, Download, FileAudio, MoreVertical, Save, FileText, Trash2 } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { transcribeAudioInBrowser } from "@/lib/transcribe-client";

type Transcricao = { id: string; titulo: string; texto: string; created_at: string };

import { Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

function baixarTxt(titulo: string, texto: string) {
  const blob = new Blob([texto], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${titulo.replace(/\.[^.]+$/, "") || "transcricao"}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function baixarPdf(titulo: string, texto: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const width = doc.internal.pageSize.getWidth() - margin * 2;
  const height = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(doc.splitTextToSize(titulo || "Transcrição", width), margin, margin);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  let y = margin + 28;
  for (const line of doc.splitTextToSize(texto, width) as string[]) {
    if (y > height - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += 14;
  }
  doc.save(`${(titulo || "transcricao").replace(/\.[^.]+$/, "")}.pdf`);
}

export const Route = createFileRoute("/_authenticated/ferramentas/transcricao")({
  head: () => ({
    meta: [
      { title: "Transcrição de Áudio — PoolFlux" },
      {
        name: "description",
        content:
          "Carregue um arquivo de áudio e obtenha a transcrição literal completa, sem edição ou divisão em capítulos.",
      },
      { property: "og:title", content: "Transcrição de Áudio — PoolFlux" },
      {
        property: "og:description",
        content: "Transcrição literal e completa de arquivos de áudio dentro do PoolFlux.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TranscricaoPage,
});

function TranscricaoPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [texto, setTexto] = useState("");
  const [nome, setNome] = useState("");
  const [progresso, setProgresso] = useState<{ done: number; total: number } | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [lista, setLista] = useState<Transcricao[]>([]);
  const [renomear, setRenomear] = useState<{ id: string; titulo: string } | null>(null);
  const [renomeando, setRenomeando] = useState(false);

  async function carregarLista() {
    const { data, error } = await supabase
      .from("transcricoes")
      .select("id, titulo, texto, created_at")
      .order("created_at", { ascending: false });
    if (error) return;
    setLista((data ?? []) as Transcricao[]);
  }

  useEffect(() => {
    void carregarLista();
  }, []);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setCarregando(true);
    setTexto("");
    setNome(file.name);
    setProgresso(null);
    try {
      const t = await transcribeAudioInBrowser(file, (done, total) => setProgresso({ done, total }));
      if (!t.trim()) {
        toast.error("Nada foi transcrito neste áudio.");
        return;
      }
      setTexto(t);
      toast.success("Transcrição concluída.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao transcrever o áudio.");
    } finally {
      setCarregando(false);
      setProgresso(null);
    }
  }

  async function salvar() {
    if (!texto.trim()) return;
    setSalvando(true);
    const { error } = await supabase
      .from("transcricoes")
      .insert({ titulo: nome.replace(/\.[^.]+$/, "") || "Transcrição", texto });
    setSalvando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Transcrição salva.");
    void carregarLista();
  }

  async function excluir(id: string) {
    const { error } = await supabase.from("transcricoes").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setLista((l) => l.filter((t) => t.id !== id));
    toast.success("Transcrição excluída.");
  }

  async function salvarRenome() {
    if (!renomear) return;
    const titulo = renomear.titulo.trim();
    if (!titulo) return;
    setRenomeando(true);
    const { error } = await supabase.from("transcricoes").update({ titulo }).eq("id", renomear.id);
    setRenomeando(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setLista((l) => l.map((t) => (t.id === renomear.id ? { ...t, titulo } : t)));
    setRenomear(null);
    toast.success("Nome atualizado.");
  }


  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">Transcrição</h1>
        <p className="text-sm text-muted-foreground">
          Carregue um arquivo de áudio para gerar a transcrição literal completa — texto puro, sem
          resumo, interpretação ou divisão em capítulos.
        </p>
      </header>

      <div className="rounded-lg border border-dashed p-8 text-center">
        <FileAudio className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <input
          ref={inputRef}
          type="file"
          accept="audio/*,.mp3,.wav,.m4a,.webm,.flac,.aac,.mp4"
          className="hidden"
          onChange={(e) => {
            void onFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <Button onClick={() => inputRef.current?.click()} disabled={carregando}>
          {carregando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {carregando ? "Transcrevendo…" : "Carregar áudio"}
        </Button>
        <p className="mt-3 text-xs text-muted-foreground">
          {progresso
            ? `Trecho ${progresso.done} de ${progresso.total}…`
            : nome || "MP3, WAV, M4A, WEBM, FLAC ou AAC"}
        </p>
      </div>

      {texto && (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-medium">Transcrição literal</h2>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(texto);
                  toast.success("Texto copiado.");
                }}
              >
                <Copy className="mr-2 h-4 w-4" /> Copiar
              </Button>
              <Button variant="outline" size="sm" onClick={() => baixarTxt(nome, texto)}>
                <Download className="mr-2 h-4 w-4" /> Baixar .txt
              </Button>
              <Button size="sm" onClick={() => void salvar()} disabled={salvando}>
                {salvando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar
              </Button>
            </div>
          </div>
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Título da transcrição"
          />
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={20}
            className="font-mono text-sm"
          />
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Transcrições salvas</h2>
        {lista.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma transcrição salva ainda.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {lista.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 p-3">
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => {
                    setTexto(t.texto);
                    setNome(t.titulo);
                  }}
                >
                  <span className="block truncate text-sm font-medium">{t.titulo}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(t.created_at).toLocaleString("pt-BR")}
                  </span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="icon" variant="ghost">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => baixarTxt(t.titulo, t.texto)}>
                      <Download className="mr-2 h-4 w-4" /> Exportar .txt
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => baixarPdf(t.titulo, t.texto)}>
                      <FileText className="mr-2 h-4 w-4" /> Exportar PDF
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={() => void excluir(t.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
