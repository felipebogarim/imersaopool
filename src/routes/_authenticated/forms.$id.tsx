import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Save, Sparkles, ExternalLink, Copy } from "lucide-react";
import { toast } from "sonner";
import { FormBuilder } from "@/components/FormBuilder";
import { FormRenderer } from "@/components/FormRenderer";
import { generateFormSchema } from "@/lib/generate-form.functions";
import { FormSchemaSchema, RESERVED_SLUGS, slugify, type FormSchema } from "@/lib/form-schema";

export const Route = createFileRoute("/_authenticated/forms/$id")({
  head: () => ({ meta: [{ title: "Editar formulário — PoolFlux" }] }),
  component: EditFormPage,
});

function EditFormPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const generate = useServerFn(generateFormSchema);

  const { data, isLoading } = useQuery({
    queryKey: ["form", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms")
        .select("id, slug, title, prompt, schema, is_active")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [prompt, setPrompt] = useState("");
  const [schema, setSchema] = useState<FormSchema>({ fields: [] });
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    if (!data) return;
    setTitle(data.title ?? "");
    setSlug(data.slug ?? "");
    setPrompt(data.prompt ?? "");
    const parsed = FormSchemaSchema.safeParse(data.schema);
    setSchema(parsed.success ? parsed.data : { fields: [] });
    setIsActive(Boolean((data as any).is_active));
  }, [data]);

  async function save() {
    const finalSlug = slugify(slug);
    if (!finalSlug) return toast.error("Slug inválido");
    if (RESERVED_SLUGS.has(finalSlug)) return toast.error(`"${finalSlug}" é reservado`);
    const parsed = FormSchemaSchema.safeParse(schema);
    if (!parsed.success) return toast.error("Esquema inválido");
    setSaving(true);
    try {
      if (finalSlug !== data?.slug) {
        const { data: existing } = await supabase.from("forms").select("id").eq("slug", finalSlug).maybeSingle();
        if (existing && (existing as any).id !== id) {
          toast.error(`Slug "${finalSlug}" já está em uso`);
          return;
        }
      }
      const { error } = await supabase
        .from("forms")
        .update({ title, slug: finalSlug, prompt, schema: parsed.data as any, is_active: isActive })
        .eq("id", id);
      if (error) throw error;
      toast.success("Alterações salvas");
      qc.invalidateQueries({ queryKey: ["forms-list"] });
      qc.invalidateQueries({ queryKey: ["form", id] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function regenerate() {
    if (!prompt.trim()) return toast.error("Prompt vazio");
    setRegenerating(true);
    try {
      const s = await generate({ data: { title, prompt } });
      setSchema(s);
      toast.success("Novo esquema gerado. Revise e salve.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar");
    } finally {
      setRegenerating(false);
    }
  }

  const publicUrl = typeof window !== "undefined" && slug ? `${window.location.origin}/f/${slug}` : "";

  return (
    <div>
      <PageHeader
        title="Editar formulário"
        actions={
          <>
            <Button variant="ghost" onClick={() => navigate({ to: "/forms" })}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Button>
            <Button onClick={save} disabled={saving || isLoading}><Save className="h-4 w-4 mr-1" /> {saving ? "Salvando…" : "Salvar"}</Button>
          </>
        }
      />
      <div className="p-4 sm:p-8 space-y-6 max-w-6xl">
        {isLoading || !data ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <>
            <Card>
              <CardHeader><CardTitle>Dados básicos</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Título</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                  </div>
                  <div>
                    <Label>Slug</Label>
                    <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} />
                    {publicUrl && (
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span className="font-mono truncate">{publicUrl}</span>
                        <button type="button" onClick={() => { navigator.clipboard.writeText(publicUrl); toast.success("Link copiado"); }} className="hover:text-foreground"><Copy className="h-3 w-3" /></button>
                        <a href={publicUrl} target="_blank" rel="noreferrer" className="hover:text-foreground"><ExternalLink className="h-3 w-3" /></a>
                      </div>
                    )}
                  </div>
                </div>
                <div>
                  <Label>Prompt (opcional — permite regenerar com IA)</Label>
                  <Textarea rows={3} value={prompt} onChange={(e) => setPrompt(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                  <Label>Formulário ativo (aceita respostas)</Label>
                </div>
                <div>
                  <Button variant="outline" onClick={regenerate} disabled={regenerating}>
                    <Sparkles className="h-4 w-4 mr-1" /> {regenerating ? "Gerando…" : "Regenerar esquema com IA"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Campos</CardTitle></CardHeader>
              <CardContent>
                <FormBuilder value={schema} onChange={setSchema} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Prévia</CardTitle></CardHeader>
              <CardContent>
                <FormRenderer schema={schema} onSubmit={() => Promise.resolve()} submitLabel="Enviar (prévia)" disabled />
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
