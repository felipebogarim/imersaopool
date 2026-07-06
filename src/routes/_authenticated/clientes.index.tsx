import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EntityKebab } from "@/components/EntityKebab";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/clientes/")({
  head: () => ({ meta: [{ title: "Clientes — PoolFlux" }] }),
  component: ClientsPage,
});

const STATUS_COLORS: Record<string, string> = {
  ativo: "bg-success/20 text-success border-success/30",
  prospect: "bg-primary/15 text-cyan border-primary/30",
  inativo: "bg-muted text-muted-foreground border-border",
};

const ALL = "__all__";

function uniqSorted(vals: (string | null | undefined)[]) {
  return Array.from(new Set(vals.filter((v): v is string => !!v && v.trim() !== ""))).sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}

function ClientsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [fMunicipio, setFMunicipio] = useState(ALL);
  const [fEstado, setFEstado] = useState(ALL);
  const [fRep, setFRep] = useState(ALL);
  const [fCategoria, setFCategoria] = useState(ALL);
  const [fGrupo, setFGrupo] = useState(ALL);
  const [fStatus, setFStatus] = useState(ALL);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, codigo_erp, nome_fantasia, municipio, cidade, estado, nome_representante_erp, categoria_erp, grupo_erp, status")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const opts = useMemo(() => ({
    municipios: uniqSorted(clients.map((c: any) => c.municipio || c.cidade)),
    estados: uniqSorted(clients.map((c: any) => c.estado)),
    reps: uniqSorted(clients.map((c: any) => c.nome_representante_erp)),
    categorias: uniqSorted(clients.map((c: any) => c.categoria_erp)),
    grupos: uniqSorted(clients.map((c: any) => c.grupo_erp)),
    statuses: uniqSorted(clients.map((c: any) => c.status)),
  }), [clients]);

  const filtered = clients.filter((c: any) => {
    const mun = c.municipio || c.cidade || "";
    if (fMunicipio !== ALL && mun !== fMunicipio) return false;
    if (fEstado !== ALL && c.estado !== fEstado) return false;
    if (fRep !== ALL && c.nome_representante_erp !== fRep) return false;
    if (fCategoria !== ALL && c.categoria_erp !== fCategoria) return false;
    if (fGrupo !== ALL && c.grupo_erp !== fGrupo) return false;
    if (fStatus !== ALL && c.status !== fStatus) return false;
    if (q) {
      const s = q.toLowerCase();
      if (
        !c.nome_fantasia?.toLowerCase().includes(s) &&
        !mun.toLowerCase().includes(s) &&
        !c.codigo_erp?.toLowerCase().includes(s)
      ) return false;
    }
    return true;
  });

  async function remove(id: string, nome: string) {
    if (!confirm(`Excluir cliente "${nome}"?`)) return;
    const { error } = await supabase.from("clients").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Cliente excluído");
    qc.invalidateQueries({ queryKey: ["clients"] });
  }

  const hasFilters = [fMunicipio, fEstado, fRep, fCategoria, fGrupo, fStatus].some(v => v !== ALL) || q;
  function clearFilters() {
    setQ(""); setFMunicipio(ALL); setFEstado(ALL); setFRep(ALL); setFCategoria(ALL); setFGrupo(ALL); setFStatus(ALL);
  }

  function FilterSelect({ value, onChange, placeholder, options }: { value: string; onChange: (v: string) => void; placeholder: string; options: string[] }) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9"><SelectValue placeholder={placeholder} /></SelectTrigger>
        <SelectContent className="max-h-72">
          <SelectItem value={ALL}>{placeholder}: todos</SelectItem>
          {options.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div>
      <PageHeader
        title="Clientes"
        subtitle="Base completa de clientes e prospects"
        actions={
          <Button asChild><Link to="/clientes/novo"><Plus className="h-4 w-4 mr-1" /> Novo cliente</Link></Button>
        }
      />
      <div className="p-8 space-y-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, código ou cidade..." value={q} onChange={e => setQ(e.target.value)} className="pl-9" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 flex-1 min-w-[280px]">
            <FilterSelect value={fMunicipio} onChange={setFMunicipio} placeholder="Município" options={opts.municipios} />
            <FilterSelect value={fEstado} onChange={setFEstado} placeholder="Estado" options={opts.estados} />
            <FilterSelect value={fRep} onChange={setFRep} placeholder="Representante" options={opts.reps} />
            <FilterSelect value={fCategoria} onChange={setFCategoria} placeholder="Categoria" options={opts.categorias} />
            <FilterSelect value={fGrupo} onChange={setFGrupo} placeholder="Grupo" options={opts.grupos} />
            <FilterSelect value={fStatus} onChange={setFStatus} placeholder="Status" options={opts.statuses} />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}><X className="h-4 w-4 mr-1" /> Limpar</Button>
          )}
        </div>
        <div className="text-xs text-muted-foreground">{filtered.length} de {clients.length} clientes</div>
        <div className="surface rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Nome fantasia</th>
                <th className="px-4 py-3 font-medium">Município</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium">Representante</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Grupo</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">Nenhum cliente encontrado.</td></tr>
              ) : filtered.map((c: any) => (
                <tr key={c.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{c.codigo_erp || "—"}</td>
                  <td className="px-4 py-3">
                    <Link to="/clientes/$id" params={{ id: c.id }} className="font-medium hover:text-cyan">{c.nome_fantasia}</Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.municipio || c.cidade || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.estado || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.nome_representante_erp || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.categoria_erp || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.grupo_erp || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={STATUS_COLORS[c.status] || ""}>{c.status}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <EntityKebab type="cliente" id={c.id} editTo="/clientes/$id/editar" onDelete={() => remove(c.id, c.nome_fantasia)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
