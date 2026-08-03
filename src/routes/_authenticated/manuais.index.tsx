import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Sparkles, Upload, ExternalLink, Copy, Trash2, FileText, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { generateManual } from "@/lib/generate-manual.functions";
import { ManualContentSchema, slugifyManual, type ManualContent } from "@/lib/manual-schema";

export const Route = createFileRoute("/_authenticated/manuais/")({
  head: () => ({
    meta: [
      { title: "Manuais — PoolFlux" },
      { name: "description", content: "Crie manuais da plataforma com IA ou envie PDFs e compartilhe por link público." },
      { property: "og:title", content: "Manuais — PoolFlux" },
      { property: "og:description", content: "Manuais criados por IA ou em PDF, prontos para compartilhar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ManuaisPage,
});

type ManualRow = {
  id: string;
  slug: string;
  titulo: string;
  descricao: string | null;
  tipo: string;
  conteudo: ManualContent;
  pdf_path: string | null;
  publicado: boolean;
  created_at: string;
};

function ManuaisPage() {
  const qc = useQueryClient();
  const gerar = useServerFn(generateManual);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [prompt, setPrompt] = useState("");
  const [descricao, setDescricao] = useState("");
  const [draft, setDraft] = useState<ManualContent | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: manuais = [], isLoading } = useQuery({
    queryKey: ["manuais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manuais")
        .select("id, slug, titulo, descricao, tipo, conteudo, pdf_path, publicado, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ManualRow[];
    },
  });

  function reset() {
    setTitulo(""); setPrompt(""); setDescricao(""); setDraft(null);
  }

  async function uniqueSlug(base: string) {
    let slug = slugifyManual(base) || `manual-${Date.now()}`;
    const { data } = await supabase.from("manuais").select("slug").eq("slug", slug).maybeSingle();
    if (data) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
    return slug;
  }

  async function onGerar() {
    if (!titulo.trim() || !prompt.trim()) return toast.error("Informe título e o pedido para a IA.");
    setBusy(true);
    try {
      const res = await gerar({ data: { titulo: titulo.trim(), prompt: prompt.trim() } });
      setDraft(ManualContentSchema.parse(res) as ManualContent);
      toast.success("Manual gerado. Revise e salve.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar manual");
    } finally {
      setBusy(false);
    }
  }

  async function onSalvar() {
    if (!draft) return;
    setBusy(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const slug = await uniqueSlug(titulo);
      const { error } = await supabase.from("manuais").insert({
        slug,
        titulo: titulo.trim(),
        descricao: descricao.trim() || draft.resumo.slice(0, 180),
        prompt: prompt.trim(),
        tipo: "ia",
        conteudo: draft as never,
        created_by: auth.user?.id ?? null,
      } as never);
      if (error) throw error;
      toast.success("Manual publicado");
      setOpen(false); reset();
      qc.invalidateQueries({ queryKey: ["manuais"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setBusy(false);
    }
  }

  async function onUploadPdf(file: File) {
    setUploading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const nome = file.name.replace(/\.pdf$/i, "");
      const slug = await uniqueSlug(nome);
      const path = `${slug}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("manuais").upload(path, file, {
        contentType: "application/pdf",
      });
      if (upErr) throw upErr;
      const { error } = await supabase.from("manuais").insert({
        slug,
        titulo: nome,
        descricao: "Manual em PDF",
        tipo: "pdf",
        conteudo: {} as never,
        pdf_path: path,
        created_by: auth.user?.id ?? null,
      } as never);
      if (error) throw error;
      toast.success("Manual em PDF adicionado");
      qc.invalidateQueries({ queryKey: ["manuais"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar PDF");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function excluir(m: ManualRow) {
    if (!confirm(`Excluir o manual "${m.titulo}"?`)) return;
    if (m.pdf_path) await supabase.storage.from("manuais").remove([m.pdf_path]);
    const { error } = await supabase.from("manuais").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Manual excluído");
    qc.invalidateQueries({ queryKey: ["manuais"] });
  }

  async function togglePublicado(m: ManualRow) {
    const { error } = await supabase.from("manuais").update({ publicado: !m.publicado } as never).eq("id", m.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["manuais"] });
  }

  function linkDe(m: ManualRow) {
    return `${window.location.origin}/m/${m.slug}`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Manuais"
        description="Crie manuais com IA a partir de um pedido em linguagem natural ou envie um PDF já pronto. Cada manual vira uma página compartilhável."
        actions={
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) onUploadPdf(f); }}
            />
            <Button variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> {uploading ? "Enviando..." : "Carregar PDF"}
            </Button>
            <Button onClick={() => { reset(); setOpen(true); }}>
              <Sparkles className="mr-2 h-4 w-4" /> Novo manual
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : manuais.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <BookOpen className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum manual criado ainda.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {manuais.map(m => (
            <Card key={m.id}>
              <CardContent className="p-4 flex items-start gap-3">
                <div className="rounded-md bg-muted p-2">
                  {m.tipo === "pdf" ? <FileText className="h-4 w-4" /> : <BookOpen className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{m.titulo}</p>
                    <Badge variant={m.tipo === "pdf" ? "outline" : "secondary"}>
                      {m.tipo === "pdf" ? "PDF" : "IA"}
                    </Badge>
                    {!m.publicado && <Badge variant="destructive">Rascunho</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{m.descricao}</p>
                  <p className="text-xs text-muted-foreground">/m/{m.slug}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="sm" variant="outline" asChild>
                    <a href={`/m/${m.slug}`} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" /> Abrir
                    </a>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="icon" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(linkDe(m)); toast.success("Link copiado"); }}>
                        <Copy className="mr-2 h-4 w-4" /> Copiar link
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => togglePublicado(m)}>
                        {m.publicado ? "Despublicar" : "Publicar"}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => excluir(m)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo manual com IA</DialogTitle>
            <DialogDescription>
              Descreva em linguagem natural o que o manual deve ensinar. A IA monta a página do manual.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Título</Label>
              <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Como carregar arquivos para geração de performance" />
            </div>
            <div className="space-y-2">
              <Label>O que a IA deve explicar</Label>
              <Textarea
                rows={4}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                placeholder="Ex.: Como carregar arquivos para geração de performance do representante?"
              />
            </div>
            <div className="space-y-2">
              <Label>Descrição curta (opcional)</Label>
              <Input value={descricao} onChange={e => setDescricao(e.target.value)} />
            </div>

            <div className="flex gap-2">
              <Button onClick={onGerar} disabled={busy}>
                <Sparkles className="mr-2 h-4 w-4" /> {busy ? "Gerando..." : draft ? "Gerar novamente" : "Gerar manual"}
              </Button>
              {draft && (
                <Button variant="default" onClick={onSalvar} disabled={busy}>Salvar e publicar</Button>
              )}
            </div>

            {draft && (
              <div className="rounded-lg border p-4 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold">{titulo}</h3>
                  {draft.subtitulo && <p className="text-muted-foreground">{draft.subtitulo}</p>}
                </div>
                {draft.resumo && <p className="text-sm">{draft.resumo}</p>}
                {draft.secoes.map((s, i) => (
                  <div key={i} className="space-y-1">
                    <p className="font-medium">{s.titulo}</p>
                    {s.texto && <p className="text-sm text-muted-foreground">{s.texto}</p>}
                    {s.passos.length > 0 && (
                      <ol className="list-decimal pl-5 text-sm space-y-0.5">
                        {s.passos.map((p, j) => <li key={j}>{p}</li>)}
                      </ol>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
