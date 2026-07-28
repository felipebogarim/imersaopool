import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, LoadingRows } from "@/components/EmptyState";
import { FONTE_TIPOS, LENTES, TIPO_LABEL, normalizeSinteseCampos, type FonteTipo, type Lente } from "@/lib/insight-lentes";
import { Plus, Inbox, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/fontes/")({
  head: () => ({
    meta: [
      { title: "Fontes de Insight — PoolFlux" },
      { name: "description", content: "Repositório bruto de entrevistas, visitas de campo, voz da loja e diretoria." },
      { property: "og:title", content: "Fontes de Insight — PoolFlux" },
      { property: "og:description", content: "Todo material qualitativo coletado, filtrável por tipo de fonte." },
    ],
  }),
  component: FontesIndex,
});

function FontesIndex() {
  const qc = useQueryClient();
  const [filtro, setFiltro] = useState<FonteTipo | "todos">("todos");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    tipo: "entrevista" as FonteTipo,
    titulo: "",
    pessoa: "",
    regiao: "",
    perfil_carteira: "",
    data_coleta: "",
    arquivo_relatorio: "",
  });
  const [saving, setSaving] = useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["insight-fontes"],
    queryFn: async () =>
      (await supabase
        .from("insight_fontes")
        .select("id, tipo, titulo, pessoa, regiao, perfil_carteira, data_coleta, status_processamento, arquivo_relatorio, updated_at")
        .order("created_at", { ascending: false })).data ?? [],
  });

  const lista = filtro === "todos" ? data : data.filter((f: any) => f.tipo === filtro);

  async function criar() {
    if (!form.titulo.trim()) return toast.error("Informe o título da fonte.");
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { data: fonte, error } = await supabase
        .from("insight_fontes")
        .insert({
          tipo: form.tipo,
          titulo: form.titulo.trim(),
          pessoa: form.pessoa.trim() || null,
          regiao: form.regiao.trim() || null,
          perfil_carteira: form.perfil_carteira.trim() || null,
          data_coleta: form.data_coleta || null,
          arquivo_relatorio: form.arquivo_relatorio.trim() || null,
          created_by: u.user?.id ?? null,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Normalização de ingestão: as 8 lentes sempre existem, com chaves explícitas.
      const rows = LENTES.map(l => ({
        fonte_id: fonte.id,
        lente: l,
        leitura_estrategica: null,
        sintese_campos: normalizeSinteseCampos(l as Lente, {}) as never,
        highlights: [] as never,
      }));
      const { error: lErr } = await supabase.from("insight_fonte_lentes").insert(rows);
      if (lErr) throw lErr;

      toast.success("Fonte criada. Preencha as 8 lentes para processá-la.");
      setOpen(false);
      setForm({ tipo: "entrevista", titulo: "", pessoa: "", regiao: "", perfil_carteira: "", data_coleta: "", arquivo_relatorio: "" });
      qc.invalidateQueries({ queryKey: ["insight-fontes"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao criar fonte.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Fontes de Insight"
        subtitle="Repositório bruto de todo material qualitativo — a matéria-prima dos painéis de síntese."
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Nova fonte</Button>}
      />
      <div className="p-4 sm:p-8 space-y-4">
        <div className="flex flex-wrap gap-2">
          {(["todos", ...FONTE_TIPOS] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setFiltro(t as any)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition",
                filtro === t ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted",
              )}
            >
              {t === "todos" ? "Todos" : TIPO_LABEL[t as FonteTipo]}
            </button>
          ))}
        </div>

        {isLoading ? (
          <LoadingRows rows={5} />
        ) : lista.length === 0 ? (
          <EmptyState icon={Inbox} title="Nenhuma fonte" description="Crie a primeira fonte de insight para alimentar os painéis de síntese." />
        ) : (
          <div className="surface rounded-xl divide-y divide-border overflow-hidden">
            {lista.map((f: any) => (
              <Link
                key={f.id}
                to="/fontes/$id"
                params={{ id: f.id }}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{f.titulo}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[f.pessoa, f.regiao, f.perfil_carteira].filter(Boolean).join(" · ") || "Sem contexto informado"}
                  </p>
                </div>
                <Badge variant="outline">{TIPO_LABEL[f.tipo as FonteTipo]}</Badge>
                <Badge variant={f.status_processamento === "pendente" ? "secondary" : "default"}>
                  {f.status_processamento === "pendente" ? "Pendente" : f.status_processamento === "processada" ? "Processada" : "Na síntese"}
                </Badge>
                {f.arquivo_relatorio && <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />}
              </Link>
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Nova fonte de insight</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm(f => ({ ...f, tipo: v as FonteTipo }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONTE_TIPOS.map(t => <SelectItem key={t} value={t}>{TIPO_LABEL[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Título</Label><Input value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Visão de Mercado — Anderson Viudes" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Pessoa</Label><Input value={form.pessoa} onChange={e => setForm(f => ({ ...f, pessoa: e.target.value }))} /></div>
              <div><Label>Região</Label><Input value={form.regiao} onChange={e => setForm(f => ({ ...f, regiao: e.target.value }))} placeholder="Interior SP" /></div>
            </div>
            <div><Label>Perfil da carteira</Label><Input value={form.perfil_carteira} onChange={e => setForm(f => ({ ...f, perfil_carteira: e.target.value }))} placeholder="boutiques premium, 24 clientes" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Data da coleta</Label><Input type="date" value={form.data_coleta} onChange={e => setForm(f => ({ ...f, data_coleta: e.target.value }))} /></div>
              <div><Label>Relatório completo (link)</Label><Input value={form.arquivo_relatorio} onChange={e => setForm(f => ({ ...f, arquivo_relatorio: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={criar} disabled={saving}>Criar fonte</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
