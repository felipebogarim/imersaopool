import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type Client = {
  id: string;
  nome_fantasia: string;
  municipio: string | null;
  cidade: string | null;
  estado: string | null;
  pertence_grupo: boolean;
  grupo_nome: string | null;
};

export function ClientGroupManagerDialog({
  open,
  onOpenChange,
  anchorClient,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  anchorClient: { id: string; nome_fantasia: string; grupo_nome: string | null } | null;
}) {
  const qc = useQueryClient();
  const [grupoNome, setGrupoNome] = useState("");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-all-for-group"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, nome_fantasia, municipio, cidade, estado, pertence_grupo, grupo_nome")
        .order("nome_fantasia");
      if (error) throw error;
      return data as Client[];
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open || !anchorClient) return;
    const initialName = anchorClient.grupo_nome ?? anchorClient.nome_fantasia;
    setGrupoNome(initialName);
    // Pre-select members of the same group + anchor
    const initial = new Set<string>([anchorClient.id]);
    clients.forEach(c => {
      if (c.grupo_nome && c.grupo_nome === initialName) initial.add(c.id);
    });
    setSelected(initial);
    setQ("");
  }, [open, anchorClient, clients]);

  const filtered = useMemo(() => {
    if (!q) return clients;
    const s = q.toLowerCase();
    return clients.filter(c =>
      c.nome_fantasia.toLowerCase().includes(s) ||
      (c.municipio || c.cidade || "").toLowerCase().includes(s),
    );
  }, [clients, q]);

  function toggle(id: string) {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  async function save() {
    if (!grupoNome.trim()) return toast.error("Informe o nome do grupo");
    if (selected.size < 2) return toast.error("Selecione ao menos 2 clientes para formar um grupo");
    setSaving(true);
    const inIds = Array.from(selected);
    const previousMembers = clients.filter(c => c.grupo_nome === grupoNome && !selected.has(c.id)).map(c => c.id);

    const { error: e1 } = await supabase
      .from("clients")
      .update({ pertence_grupo: true, grupo_nome: grupoNome.trim() })
      .in("id", inIds);
    if (e1) { setSaving(false); return toast.error(e1.message); }

    if (previousMembers.length) {
      const { error: e2 } = await supabase
        .from("clients")
        .update({ pertence_grupo: false, grupo_nome: null })
        .in("id", previousMembers);
      if (e2) { setSaving(false); return toast.error(e2.message); }
    }
    setSaving(false);
    toast.success("Grupo atualizado");
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["clients-all-for-group"] });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Habilitar grupo de cliente</DialogTitle>
          <DialogDescription>
            Defina o nome do grupo e selecione todos os clientes que fazem parte dele.
            Informações como compras passarão a ser agrupadas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome do grupo</Label>
            <Input value={grupoNome} onChange={e => setGrupoNome(e.target.value)} placeholder="Ex.: Grupo XYZ" />
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar cliente..." value={q} onChange={e => setQ(e.target.value)} className="pl-9" />
          </div>
          <div className="max-h-80 overflow-y-auto border border-border rounded-md divide-y divide-border">
            {filtered.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">Nenhum cliente encontrado.</div>
            ) : filtered.map(c => (
              <label key={c.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 cursor-pointer">
                <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{c.nome_fantasia}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {[c.municipio || c.cidade, c.estado].filter(Boolean).join(", ") || "—"}
                    {c.grupo_nome && c.grupo_nome !== grupoNome && (
                      <span className="ml-2 text-warning">(já no grupo "{c.grupo_nome}")</span>
                    )}
                  </div>
                </div>
              </label>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">{selected.size} selecionado(s)</div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar grupo"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
