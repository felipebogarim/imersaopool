import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { ChevronRight, ChevronDown, Plus, Pencil, Trash2, Package } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Nivel = Database["public"]["Enums"]["familia_nivel"];
const NIVEIS: Nivel[] = ["familia", "sub_familia", "linha", "portfolio", "sub_portfolio"];

export const Route = createFileRoute("/_authenticated/familias")({
  head: () => ({ meta: [{ title: "Famílias de Produto — PoolFlux" }] }),
  component: FamiliasPage,
});

type Row = { id: string; nome: string; slug: string; nivel: Nivel; parent_id: string | null; ativo: boolean; company_id: string };

function slugify(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function FamiliasPage() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Row | null>(null);
  const [creatingParent, setCreatingParent] = useState<{ parent_id: string | null; nivel: Nivel } | null>(null);
  const [linkFamilia, setLinkFamilia] = useState<Row | null>(null);

  const { data: rows = [] } = useQuery({
    queryKey: ["familias-all"],
    queryFn: async () =>
      ((await supabase.from("familias_produto").select("id, nome, slug, nivel, parent_id, ativo, company_id").order("nome")).data ?? []) as Row[],
  });

  const tree = useMemo(() => {
    const byParent = new Map<string | null, Row[]>();
    for (const r of rows) {
      const k = r.parent_id;
      if (!byParent.has(k)) byParent.set(k, []);
      byParent.get(k)!.push(r);
    }
    return byParent;
  }, [rows]);

  function toggle(id: string) {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function remove(id: string) {
    if (!confirm("Excluir esta família? Filhas ficarão órfãs.")) return;
    const { error } = await supabase.from("familias_produto").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Excluída");
    qc.invalidateQueries({ queryKey: ["familias-all"] });
  }

  function renderNode(node: Row, depth: number) {
    const kids = tree.get(node.id) ?? [];
    const isOpen = expanded.has(node.id);
    const nextNivel = NIVEIS[Math.min(NIVEIS.indexOf(node.nivel) + 1, NIVEIS.length - 1)];
    return (
      <li key={node.id}>
        <div className="flex items-center gap-2 py-1.5 hover:bg-accent/30 rounded px-2" style={{ paddingLeft: depth * 16 + 8 }}>
          <button onClick={() => toggle(node.id)} className="w-4 h-4 shrink-0">
            {kids.length ? (isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : null}
          </button>
          <Badge variant="outline" className="text-[10px]">{node.nivel}</Badge>
          <span className="text-sm font-medium">{node.nome}</span>
          {!node.ativo && <Badge variant="secondary" className="text-[10px]">inativo</Badge>}
          <span className="text-xs text-muted-foreground font-mono">{node.slug}</span>
          <div className="ml-auto flex gap-1">
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setLinkFamilia(node)} title="Vincular produtos">
              <Package className="h-3.5 w-3.5" />
            </Button>
            {NIVEIS.indexOf(node.nivel) < NIVEIS.length - 1 && (
              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setCreatingParent({ parent_id: node.id, nivel: nextNivel })} title="Adicionar filha">
                <Plus className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditing(node)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => remove(node.id)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        {isOpen && kids.length > 0 && (
          <ul>{kids.map(k => renderNode(k, depth + 1))}</ul>
        )}
      </li>
    );
  }

  const roots = tree.get(null) ?? [];

  return (
    <div>
      <PageHeader
        title="Famílias de Produto"
        subtitle="Hierarquia: família → sub-família → linha → portfolio → sub-portfolio"
        actions={
          <Button onClick={() => setCreatingParent({ parent_id: null, nivel: "familia" })}>
            <Plus className="h-4 w-4 mr-1" /> Nova família
          </Button>
        }
      />
      <div className="p-8">
        <div className="surface rounded-xl p-4">
          {roots.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma família cadastrada.</p>
          ) : (
            <ul>{roots.map(r => renderNode(r, 0))}</ul>
          )}
        </div>
      </div>

      <FamiliaFormDialog
        open={!!editing || !!creatingParent}
        onOpenChange={(v) => { if (!v) { setEditing(null); setCreatingParent(null); } }}
        editing={editing}
        parentSeed={creatingParent}
        onSaved={() => qc.invalidateQueries({ queryKey: ["familias-all"] })}
      />

      <LinkProductsDialog
        familia={linkFamilia}
        onOpenChange={(v) => { if (!v) setLinkFamilia(null); }}
      />
    </div>
  );
}

function FamiliaFormDialog({
  open, onOpenChange, editing, parentSeed, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Row | null;
  parentSeed: { parent_id: string | null; nivel: Nivel } | null;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");
  const [nivel, setNivel] = useState<Nivel>("familia");
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);

  // Reset when opened
  useMemo(() => {
    if (!open) return;
    if (editing) {
      setNome(editing.nome); setSlug(editing.slug); setNivel(editing.nivel); setAtivo(editing.ativo);
    } else if (parentSeed) {
      setNome(""); setSlug(""); setNivel(parentSeed.nivel); setAtivo(true);
    }
  }, [open, editing, parentSeed]);

  async function save() {
    if (!nome.trim()) return toast.error("Nome obrigatório");
    setSaving(true);
    try {
      const finalSlug = slug.trim() || slugify(nome);
      if (editing) {
        const { error } = await supabase.from("familias_produto").update({
          nome, slug: finalSlug, nivel, ativo,
        }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { data: prof } = await supabase.from("profiles").select("active_company_id").maybeSingle();
        if (!prof?.active_company_id) throw new Error("Sem empresa ativa");
        const { error } = await supabase.from("familias_produto").insert({
          nome, slug: finalSlug, nivel, ativo, parent_id: parentSeed?.parent_id ?? null, company_id: prof.active_company_id,
        });
        if (error) throw error;
      }
      toast.success("Salvo");
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Editar família" : "Nova família"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground">Nome</label>
            <Input value={nome} onChange={(e) => { setNome(e.target.value); if (!editing && !slug) setSlug(slugify(e.target.value)); }} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Slug</label>
            <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Nível</label>
            <Select value={nivel} onValueChange={(v) => setNivel(v as Nivel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {NIVEIS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
            Ativo
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinkProductsDialog({ familia, onOpenChange }: { familia: Row | null; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["own-products-link", familia?.id, search],
    enabled: !!familia,
    queryFn: async () => {
      let q = supabase.from("own_products").select("id, nome, familia_id, marca").order("nome").limit(200);
      if (search) q = q.ilike("nome", `%${search}%`);
      return (await q).data ?? [];
    },
  });

  async function toggleLink(pid: string, linked: boolean) {
    if (!familia) return;
    const { error } = await supabase.from("own_products").update({ familia_id: linked ? null : familia.id }).eq("id", pid);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["own-products-link"] });
  }

  return (
    <Dialog open={!!familia} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Vincular produtos a "{familia?.nome}"</DialogTitle>
        </DialogHeader>
        <Input placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="max-h-[50vh] overflow-auto border rounded">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Carregando...</p>
          ) : products.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nenhum produto.</p>
          ) : (
            <ul className="divide-y">
              {products.map((p: any) => {
                const linked = p.familia_id === familia?.id;
                return (
                  <li key={p.id} className="flex items-center gap-2 p-2 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{p.nome}</div>
                      <div className="text-xs text-muted-foreground">{p.marca ?? "—"}</div>
                    </div>
                    <Button size="sm" variant={linked ? "default" : "outline"} onClick={() => toggleLink(p.id, linked)}>
                      {linked ? "Vinculado" : "Vincular"}
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
