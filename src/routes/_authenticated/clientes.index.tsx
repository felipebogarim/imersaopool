import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/clientes/")({
  head: () => ({ meta: [{ title: "Clientes — PoolFlux" }] }),
  component: ClientsPage,
});

const STATUS_COLORS: Record<string, string> = {
  ativo: "bg-success/20 text-success border-success/30",
  prospect: "bg-primary/15 text-cyan border-primary/30",
  inativo: "bg-muted text-muted-foreground border-border",
};

function ClientsPage() {
  const [q, setQ] = useState("");
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, nome_fantasia, grupo, categoria, cidade, estado, status, nome_comprador")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const filtered = clients.filter((c: any) =>
    !q || c.nome_fantasia?.toLowerCase().includes(q.toLowerCase()) || c.cidade?.toLowerCase().includes(q.toLowerCase())
  );
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
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou cidade..." value={q} onChange={e => setQ(e.target.value)} className="pl-9" />
        </div>
        <div className="surface rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Grupo</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Localização</th>
                <th className="px-4 py-3 font-medium">Comprador</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Carregando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Nenhum cliente cadastrado ainda.</td></tr>
              ) : filtered.map((c: any) => (
                <tr key={c.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-3">
                    <Link to="/clientes/$id" params={{ id: c.id }} className="font-medium hover:text-cyan">{c.nome_fantasia}</Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c.grupo || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.categoria || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{[c.cidade, c.estado].filter(Boolean).join(", ") || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.nome_comprador || "—"}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={STATUS_COLORS[c.status] || ""}>{c.status}</Badge>
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
