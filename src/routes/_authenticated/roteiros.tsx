import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Lente = Database["public"]["Enums"]["perspectiva_lente"];
const LENTES: Lente[] = [
  "percepcao_marca","mix","concorrencia","argumento","decisao",
  "familias","promo_comercial","oportunidade","ameaca","cuidado",
];

export const Route = createFileRoute("/_authenticated/roteiros")({
  head: () => ({ meta: [{ title: "Roteiros — PoolFlux" }] }),
  component: RoteirosPage,
});

function RoteirosPage() {
  const qc = useQueryClient();
  const [editingRoteiro, setEditingRoteiro] = useState<any | null>(null);
  const [creatingRoteiro, setCreatingRoteiro] = useState(false);
  const [editingCap, setEditingCap] = useState<any | null>(null);
  const [creatingCapFor, setCreatingCapFor] = useState<string | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["roteiros-with-caps"],
    queryFn: async () => {
      const { data: rot } = await supabase.from("roteiros")
        .select("id, nome, descricao, perfil_alvo, versao, ativo, company_id").order("nome");
      const ids = (rot ?? []).map((r: any) => r.id);
      if (!ids.length) return [];
      const { data: caps } = await supabase.from("capitulos")
        .select("id, roteiro_id, ordem, codigo, titulo, orientacao, hipotese, lente_default, campos_matriz, pergunta_abertura, pontos_escuta")
        .in("roteiro_id", ids).order("ordem");
      return (rot ?? []).map((r: any) => ({ ...r, capitulos: (caps ?? []).filter((c: any) => c.roteiro_id === r.id) }));
    },
  });

  async function removeRoteiro(id: string) {
    if (!confirm("Excluir roteiro e todos os capítulos?")) return;
    const { error } = await supabase.from("roteiros").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["roteiros-with-caps"] });
  }

  async function removeCap(id: string) {
    if (!confirm("Excluir capítulo?")) return;
    const { error } = await supabase.from("capitulos").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    qc.invalidateQueries({ queryKey: ["roteiros-with-caps"] });
  }

  async function moveCap(cap: any, dir: -1 | 1) {
    const { error } = await supabase.from("capitulos").update({ ordem: cap.ordem + dir }).eq("id", cap.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["roteiros-with-caps"] });
  }

  return (
    <div>
      <PageHeader
        title="Roteiros de imersão"
        subtitle="Framework de capítulos usados nas sessões de campo"
        actions={<Button onClick={() => setCreatingRoteiro(true)}><Plus className="h-4 w-4 mr-1" /> Novo roteiro</Button>}
      />
      <div className="p-8 space-y-6">
        {isLoading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : data.length === 0 ? (
          <p className="text-muted-foreground">Nenhum roteiro cadastrado.</p>
        ) : (
          data.map((r: any) => (
            <section key={r.id} className="surface rounded-xl p-6">
              <header className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold">{r.nome}</h2>
                    <Badge variant="outline">v{r.versao}</Badge>
                    {!r.ativo && <Badge variant="secondary">inativo</Badge>}
                  </div>
                  {r.descricao && <p className="text-sm text-muted-foreground mt-1">{r.descricao}</p>}
                  {r.perfil_alvo && <p className="text-xs text-muted-foreground mt-1">Perfil-alvo: {r.perfil_alvo}</p>}
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => setCreatingCapFor(r.id)}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Capítulo
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingRoteiro(r)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeRoteiro(r.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </header>
              <ol className="space-y-3">
                {r.capitulos.map((c: any) => (
                  <li key={c.id} className="border border-border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-muted-foreground">#{c.ordem}</span>
                      <h3 className="font-medium">{c.titulo}</h3>
                      <Badge variant="outline" className="text-[10px]">{c.lente_default}</Badge>
                      <div className="ml-auto flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => moveCap(c, -1)}><ArrowUp className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => moveCap(c, 1)}><ArrowDown className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingCap(c)}><Pencil className="h-3 w-3" /></Button>
                        <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => removeCap(c.id)}><Trash2 className="h-3 w-3" /></Button>
                      </div>
                    </div>
                    {c.pergunta_abertura && (
                      <blockquote className="border-l-4 border-primary/60 pl-3 py-1 my-2">
                        <p className="text-sm font-medium">"{c.pergunta_abertura}"</p>
                      </blockquote>
                    )}
                    {Array.isArray(c.pontos_escuta) && c.pontos_escuta.length > 0 && (
                      <div className="mb-2">
                        <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Fique atento a</p>
                        <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-0.5">
                          {c.pontos_escuta.map((p: string, i: number) => <li key={i}>{p}</li>)}
                        </ul>
                      </div>
                    )}
                    {c.orientacao && <p className="text-xs text-muted-foreground mb-1"><span className="font-medium">Objetivo:</span> {c.orientacao}</p>}
                    {c.hipotese && <p className="text-xs italic text-muted-foreground mb-2">Hipótese: {c.hipotese}</p>}
                    {Array.isArray(c.campos_matriz) && c.campos_matriz.length > 0 && (
                      <details className="mt-2">
                        <summary className="text-[10px] uppercase tracking-wide text-muted-foreground cursor-pointer">Campos de fechamento</summary>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {c.campos_matriz.map((f: string) => (
                            <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">{f}</span>
                          ))}
                        </div>
                      </details>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          ))
        )}
      </div>

      <RoteiroDialog
        open={creatingRoteiro || !!editingRoteiro}
        editing={editingRoteiro}
        onOpenChange={(v: boolean) => { if (!v) { setCreatingRoteiro(false); setEditingRoteiro(null); } }}
        onSaved={() => qc.invalidateQueries({ queryKey: ["roteiros-with-caps"] })}
      />
      <CapituloDialog
        open={!!creatingCapFor || !!editingCap}
        editing={editingCap}
        roteiroId={editingCap?.roteiro_id ?? creatingCapFor}
        nextOrdem={data.find((r: any) => r.id === (creatingCapFor ?? editingCap?.roteiro_id))?.capitulos?.length ?? 0}
        onOpenChange={(v: boolean) => { if (!v) { setCreatingCapFor(null); setEditingCap(null); } }}
        onSaved={() => qc.invalidateQueries({ queryKey: ["roteiros-with-caps"] })}
      />
    </div>
  );
}

function RoteiroDialog({ open, editing, onOpenChange, onSaved }: any) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [perfil, setPerfil] = useState("");
  const [versao, setVersao] = useState(1);
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);

  useMemo(() => {
    if (!open) return;
    if (editing) {
      setNome(editing.nome); setDescricao(editing.descricao ?? ""); setPerfil(editing.perfil_alvo ?? "");
      setVersao(editing.versao); setAtivo(editing.ativo);
    } else {
      setNome(""); setDescricao(""); setPerfil(""); setVersao(1); setAtivo(true);
    }
  }, [open, editing]);

  async function save() {
    if (!nome.trim()) return toast.error("Nome obrigatório");
    setSaving(true);
    try {
      if (editing) {
        const { error } = await supabase.from("roteiros").update({
          nome, descricao: descricao || null, perfil_alvo: perfil || null, versao, ativo,
        }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: prof } = await supabase.from("profiles").select("active_company_id").maybeSingle();
        if (!prof?.active_company_id) throw new Error("Sem empresa ativa");
        const { error } = await supabase.from("roteiros").insert({
          nome, descricao: descricao || null, perfil_alvo: perfil || null, versao, ativo, company_id: prof.active_company_id,
        });
        if (error) throw error;
      }
      toast.success("Salvo");
      onSaved(); onOpenChange(false);
    } catch (e: any) { toast.error(e.message ?? String(e)); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editing ? "Editar roteiro" : "Novo roteiro"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><label className="text-xs text-muted-foreground">Nome</label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground">Descrição</label><Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground">Perfil-alvo</label><Input value={perfil} onChange={(e) => setPerfil(e.target.value)} /></div>
          <div className="flex gap-3">
            <div className="flex-1"><label className="text-xs text-muted-foreground">Versão</label>
              <Input type="number" value={versao} onChange={(e) => setVersao(parseInt(e.target.value) || 1)} />
            </div>
            <label className="flex items-center gap-2 text-sm pt-6">
              <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> Ativo
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CapituloDialog({ open, editing, roteiroId, nextOrdem, onOpenChange, onSaved }: any) {
  const [codigo, setCodigo] = useState("");
  const [titulo, setTitulo] = useState("");
  const [orientacao, setOrientacao] = useState("");
  const [hipotese, setHipotese] = useState("");
  const [ordem, setOrdem] = useState(1);
  const [lente, setLente] = useState<Lente>("percepcao_marca");
  const [camposStr, setCamposStr] = useState("");
  const [perguntaAbertura, setPerguntaAbertura] = useState("");
  const [pontosEscutaStr, setPontosEscutaStr] = useState("");
  const [saving, setSaving] = useState(false);

  useMemo(() => {
    if (!open) return;
    if (editing) {
      setCodigo(editing.codigo); setTitulo(editing.titulo);
      setOrientacao(editing.orientacao ?? ""); setHipotese(editing.hipotese ?? "");
      setOrdem(editing.ordem); setLente(editing.lente_default ?? "percepcao_marca");
      setCamposStr((editing.campos_matriz ?? []).join(", "));
      setPerguntaAbertura(editing.pergunta_abertura ?? "");
      setPontosEscutaStr((editing.pontos_escuta ?? []).join("\n"));
    } else {
      setCodigo(""); setTitulo(""); setOrientacao(""); setHipotese("");
      setOrdem((nextOrdem ?? 0) + 1); setLente("percepcao_marca"); setCamposStr("");
      setPerguntaAbertura(""); setPontosEscutaStr("");
    }
  }, [open, editing, nextOrdem]);

  async function save() {
    if (!codigo.trim() || !titulo.trim()) return toast.error("Código e título obrigatórios");
    if (!roteiroId) return toast.error("Roteiro ausente");
    setSaving(true);
    try {
      const campos = camposStr.split(",").map(s => s.trim()).filter(Boolean);
      const payload = {
        codigo, titulo, orientacao: orientacao || null, hipotese: hipotese || null,
        ordem, lente_default: lente, campos_matriz: campos as any,
      };
      if (editing) {
        const { error } = await supabase.from("capitulos").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("capitulos").insert({ ...payload, roteiro_id: roteiroId });
        if (error) throw error;
      }
      toast.success("Salvo");
      onSaved(); onOpenChange(false);
    } catch (e: any) { toast.error(e.message ?? String(e)); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{editing ? "Editar capítulo" : "Novo capítulo"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="w-24"><label className="text-xs text-muted-foreground">Ordem</label>
              <Input type="number" value={ordem} onChange={(e) => setOrdem(parseInt(e.target.value) || 1)} /></div>
            <div className="flex-1"><label className="text-xs text-muted-foreground">Código</label>
              <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} /></div>
          </div>
          <div><label className="text-xs text-muted-foreground">Título</label><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground">Orientação</label><Textarea value={orientacao} onChange={(e) => setOrientacao(e.target.value)} /></div>
          <div><label className="text-xs text-muted-foreground">Hipótese</label><Textarea value={hipotese} onChange={(e) => setHipotese(e.target.value)} /></div>
          <div>
            <label className="text-xs text-muted-foreground">Lente default</label>
            <Select value={lente} onValueChange={(v) => setLente(v as Lente)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{LENTES.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Campos matriz (separados por vírgula)</label>
            <Input value={camposStr} onChange={(e) => setCamposStr(e.target.value)} placeholder="ex: percepcao, motivo, alerta" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
