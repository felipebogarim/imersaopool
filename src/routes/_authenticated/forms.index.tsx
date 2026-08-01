import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MoreHorizontal, Sparkles, Copy, ExternalLink, Pencil, Trash2, ListChecks, Play, Pause, Download } from "lucide-react";
import { toast } from "sonner";
import { FormRenderer } from "@/components/FormRenderer";
import { generateFormSchema } from "@/lib/generate-form.functions";
import { slugify, RESERVED_SLUGS, FormSchemaSchema, type FormSchema } from "@/lib/form-schema";
import { PasswordConfirmDialog } from "@/components/PasswordConfirmDialog";

export const Route = createFileRoute("/_authenticated/forms/")({
  head: () => ({ meta: [{ title: "Forms — PoolFlux" }] }),
  component: FormsPage,
});

type FormRow = {
  id: string;
  slug: string;
  title: string;
  prompt: string | null;
  schema: FormSchema;
  is_active: boolean;
  created_at: string;
};

function norm(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function pick(schema: FormSchema | undefined, answers: Record<string, unknown>, keys: string[]) {
  const fields = schema?.fields ?? [];
  for (const f of fields) {
    const hay = norm(`${f.id} ${f.label}`);
    if (keys.some(k => hay.includes(k))) {
      const v = answers[f.id];
      if (Array.isArray(v)) return v.join(", ");
      if (v !== null && v !== undefined && String(v).trim() !== "") return String(v);
    }
  }
  for (const [k, v] of Object.entries(answers)) {
    if (keys.some(kk => norm(k).includes(kk)) && v !== null && v !== undefined && String(v).trim() !== "") {
      return Array.isArray(v) ? v.join(", ") : String(v);
    }
  }
  return "";
}

function extractRespondent(schema: FormSchema | undefined, answers: Record<string, unknown>) {
  return {
    nome: pick(schema, answers, ["nome", "name", "respondente"]),
    cargo: pick(schema, answers, ["cargo", "funcao", "role", "posicao"]),
  };
}

function FormsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const generate = useServerFn(generateFormSchema);

  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [slug, setSlug] = useState("");
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<FormSchema | null>(null);
  const [saving, setSaving] = useState(false);
  const [respondingFor, setRespondingFor] = useState<FormRow | null>(null);

  const { data: forms, isLoading } = useQuery({
    queryKey: ["forms-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("forms")
        .select("id, slug, title, prompt, schema, is_active, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({ ...r, schema: r.schema ?? { fields: [] } })) as FormRow[];
    },
  });

  const { data: summary } = useQuery({
    queryKey: ["forms-response-summary", (forms ?? []).map(f => f.id).join(",")],
    enabled: !!forms && forms.length > 0,
    queryFn: async () => {
      const ids = (forms ?? []).map(f => f.id);
      const { data, error } = await supabase
        .from("form_responses")
        .select("form_id, answers, submitted_at")
        .in("form_id", ids)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      const map: Record<string, { count: number; nome: string; cargo: string }> = {};
      for (const r of (data ?? []) as any[]) {
        const cur = map[r.form_id] ?? { count: 0, nome: "", cargo: "" };
        cur.count += 1;
        if (!cur.nome && !cur.cargo) {
          const who = extractRespondent(
            (forms ?? []).find(f => f.id === r.form_id)?.schema,
            r.answers ?? {},
          );
          cur.nome = who.nome;
          cur.cargo = who.cargo;
        }
        map[r.form_id] = cur;
      }
      return map;
    },
  });

  const suggestedSlug = useMemo(() => slug || slugify(title), [slug, title]);

  async function handleGenerate() {
    if (!title.trim()) return toast.error("Informe o título");
    if (!prompt.trim()) return toast.error("Descreva o formulário no prompt");
    setGenerating(true);
    try {
      const schema = await generate({ data: { title: title.trim(), prompt: prompt.trim() } });
      setDraft(schema);
      toast.success("Formulário gerado. Revise e salve.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar");
    } finally {
      setGenerating(false);
    }
  }

  async function handleSave() {
    if (!draft) return;
    const finalSlug = slugify(suggestedSlug);
    if (!finalSlug) return toast.error("Slug inválido");
    if (RESERVED_SLUGS.has(finalSlug)) return toast.error(`"${finalSlug}" é reservado. Escolha outro slug.`);
    const parsed = FormSchemaSchema.safeParse(draft);
    if (!parsed.success) return toast.error("Esquema inválido");
    setSaving(true);
    try {
      const { data: existing } = await supabase.from("forms").select("id").eq("slug", finalSlug).maybeSingle();
      if (existing) {
        toast.error(`Slug "${finalSlug}" já está em uso`);
        return;
      }
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("forms").insert({
        title: title.trim(),
        slug: finalSlug,
        prompt: prompt.trim(),
        schema: parsed.data as any,
        created_by: u.user?.id ?? null,
      } as any);
      if (error) throw error;
      toast.success("Formulário salvo");
      setTitle(""); setPrompt(""); setSlug(""); setDraft(null);
      qc.invalidateQueries({ queryKey: ["forms-list"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(f: FormRow) {
    const { error } = await supabase.from("forms").update({ is_active: !f.is_active }).eq("id", f.id);
    if (error) return toast.error(error.message);
    toast.success(!f.is_active ? "Formulário ativado" : "Formulário pausado");
    qc.invalidateQueries({ queryKey: ["forms-list"] });
  }

  async function removeForm(f: FormRow) {
    if (!confirm(`Excluir "${f.title}"? Todas as respostas também serão removidas.`)) return;
    const { error } = await supabase.from("forms").delete().eq("id", f.id);
    if (error) return toast.error(error.message);
    toast.success("Formulário excluído");
    qc.invalidateQueries({ queryKey: ["forms-list"] });
  }

  function publicUrl(f: FormRow) {
    return `${window.location.origin}/f/${f.slug}`;
  }

  return (
    <div>
      <PageHeader title="Forms" subtitle="Gere formulários com IA, publique com uma URL própria e receba respostas." />

      <div className="p-4 sm:p-8 space-y-8 max-w-6xl">
        {/* Gerador */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5" /> Gerar novo formulário</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Título</Label>
                <Input value={title} onChange={(e) => { setTitle(e.target.value); if (!slug) setSlug(""); }} placeholder="Ex.: Pesquisa de satisfação" />
              </div>
              <div>
                <Label>Slug (URL pública)</Label>
                <Input value={suggestedSlug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="pesquisa-satisfacao" />
                <p className="text-xs text-muted-foreground mt-1">URL final: <span className="font-mono">/f/{suggestedSlug || "…"}</span></p>
              </div>
            </div>
            <div>
              <Label>Prompt</Label>
              <Textarea rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Descreva quais informações você quer capturar. Ex.: quero um formulário para avaliar o atendimento em loja, com nota de 1 a 5, comentário livre e contato opcional." />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleGenerate} disabled={generating}>
                <Sparkles className="h-4 w-4 mr-1" /> {generating ? "Gerando…" : "Gerar com IA"}
              </Button>
              {draft && (
                <Button variant="secondary" onClick={handleSave} disabled={saving}>
                  {saving ? "Salvando…" : "Salvar formulário"}
                </Button>
              )}
            </div>

            {draft && (
              <div className="border rounded-lg p-4 bg-muted/30 mt-2">
                <div className="text-sm font-medium mb-3">Prévia — {title || "Sem título"}</div>
                <FormRenderer schema={draft} onSubmit={() => Promise.resolve()} submitLabel="Enviar (prévia)" disabled />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Lista */}
        <Card>
          <CardHeader>
            <CardTitle>Forms criados</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Carregando…</p>
            ) : !forms || forms.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum formulário criado ainda.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Título</TableHead>
                    <TableHead>Slug</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Respostas</TableHead>
                    <TableHead>Respondente</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Criado</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {forms.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">{f.title}</TableCell>
                      <TableCell className="font-mono text-xs">/f/{f.slug}</TableCell>
                      <TableCell>
                        {f.is_active
                          ? <Badge variant="default">Ativo</Badge>
                          : <Badge variant="secondary">Pausado</Badge>}
                      </TableCell>
                      <TableCell>{summary?.[f.id]?.count ?? 0}</TableCell>
                      <TableCell className="text-sm">{summary?.[f.id]?.nome || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-sm">{summary?.[f.id]?.cargo || <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(f.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(publicUrl(f)); toast.success("Link copiado"); }}>
                              <Copy className="h-4 w-4 mr-2" /> Copiar link público
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => window.open(publicUrl(f), "_blank")}>
                              <ExternalLink className="h-4 w-4 mr-2" /> Abrir link público
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => navigate({ to: "/forms/$id", params: { id: f.id } })}>
                              <Pencil className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleActive(f)}>
                              {f.is_active ? <><Pause className="h-4 w-4 mr-2" /> Pausar</> : <><Play className="h-4 w-4 mr-2" /> Ativar</>}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => exportExcel(f, "geral")}>
                              <Download className="h-4 w-4 mr-2" /> Exportar Excel (geral)
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => exportExcel(f, "completo")}>
                              <Download className="h-4 w-4 mr-2" /> Exportar Excel (todos os resultados)
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => removeForm(f)}>
                              <Trash2 className="h-4 w-4 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <ResponsesDialog form={respondingFor} onClose={() => setRespondingFor(null)} />
    </div>
  );
}

function ResponsesDialog({ form, onClose }: { form: FormRow | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const { data: responses } = useQuery({
    queryKey: ["form-responses", form?.id],
    enabled: !!form,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("form_responses")
        .select("id, answers, submitted_at")
        .eq("form_id", form!.id)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function doDelete() {
    if (!pendingDelete) return;
    const { error } = await supabase.from("form_responses").delete().eq("id", pendingDelete);
    if (error) { toast.error(error.message); return; }
    toast.success("Resposta excluída");
    qc.invalidateQueries({ queryKey: ["form-responses", form?.id] });
    qc.invalidateQueries({ queryKey: ["forms-response-summary"] });
  }

  function exportCsv() {
    if (!form || !responses) return;
    const fields = form.schema.fields;
    const header = ["Enviado em", ...fields.map(f => f.label)];
    const rows = responses.map((r: any) => {
      const a = (r.answers ?? {}) as Record<string, unknown>;
      return [
        new Date(r.submitted_at).toLocaleString(),
        ...fields.map(f => {
          const v = a[f.id];
          if (Array.isArray(v)) return v.join("; ");
          if (v === null || v === undefined) return "";
          return String(v);
        }),
      ];
    });
    const csv = [header, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${form.slug}-respostas.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Dialog open={!!form} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-4">
            <span>Respostas — {form?.title}</span>
            {responses && responses.length > 0 && (
              <Button size="sm" variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" /> Exportar CSV</Button>
            )}
          </DialogTitle>
        </DialogHeader>
        {!form ? null : !responses ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : responses.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma resposta ainda.</p>
        ) : (
          <div className="overflow-auto max-h-[60vh]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Enviado em</TableHead>
                  {form.schema.fields.map((f) => <TableHead key={f.id}>{f.label}</TableHead>)}
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {responses.map((r: any) => {
                  const a = (r.answers ?? {}) as Record<string, unknown>;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(r.submitted_at).toLocaleString()}</TableCell>
                      {form.schema.fields.map((f) => {
                        const v = a[f.id];
                        const display = Array.isArray(v) ? v.join(", ") : v === null || v === undefined ? "" : String(v);
                        return <TableCell key={f.id} className="max-w-xs truncate" title={display}>{display}</TableCell>;
                      })}
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="text-destructive" onClick={() => setPendingDelete(r.id)}>
                              <Trash2 className="h-4 w-4 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
      <PasswordConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(v) => { if (!v) setPendingDelete(null); }}
        title="Excluir resposta"
        description="Esta ação é irreversível. Digite a senha do gestor master para confirmar a exclusão desta resposta."
        onConfirmed={doDelete}
      />
    </Dialog>
  );
}
