import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/produtos/")({
  head: () => ({ meta: [{ title: "Produtos — PoolFlux" }] }),
  component: ProductsPage,
});

const STATUS_COLORS: Record<string, string> = {
  "EM LINHA": "bg-success/20 text-success border-success/30",
  "FORA DE LINHA": "bg-muted text-muted-foreground border-border",
  "REPOSICAO": "bg-primary/15 text-cyan border-primary/30",
  "FLI": "bg-warning/20 text-warning border-warning/30",
};

function ProductsPage() {
  const [q, setQ] = useState("");
  const [marca, setMarca] = useState<string>("");
  const [familia, setFamilia] = useState<string>("");

  const { data: profile } = useQuery({
    queryKey: ["active-company"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("active_company_id").eq("id", u.user.id).maybeSingle();
      return data;
    },
  });

  const companyId = profile?.active_company_id;

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", companyId, q, marca, familia],
    enabled: !!companyId,
    queryFn: async () => {
      let query = supabase
        .from("own_products")
        .select("id, codigo_interno, nome, marca, familia, sub_familia, categoria, status, portifolio, codigo_barra")
        .eq("company_id", companyId!)
        .order("nome")
        .limit(500);
      if (q) query = query.or(`nome.ilike.%${q}%,codigo_interno.ilike.%${q}%,codigo_barra.ilike.%${q}%`);
      if (marca) query = query.eq("marca", marca);
      if (familia) query = query.eq("familia", familia);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: facets } = useQuery({
    queryKey: ["product-facets", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data } = await supabase
        .from("own_products")
        .select("marca, familia")
        .eq("company_id", companyId!)
        .limit(30000);
      const marcas = Array.from(new Set((data ?? []).map((r: any) => r.marca).filter(Boolean))).sort();
      const familias = Array.from(new Set((data ?? []).map((r: any) => r.familia).filter(Boolean))).sort();
      return { marcas, familias };
    },
  });

  const total = products.length;

  return (
    <div>
      <PageHeader title="Produtos" subtitle="Base de produtos cadastrados" />
      <div className="p-8 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome, código ou EAN..." value={q} onChange={e => setQ(e.target.value)} className="pl-9" />
          </div>
          <select value={marca} onChange={e => setMarca(e.target.value)} className="h-10 rounded-md border border-border bg-background px-3 text-sm">
            <option value="">Todas as marcas</option>
            {facets?.marcas.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          <select value={familia} onChange={e => setFamilia(e.target.value)} className="h-10 rounded-md border border-border bg-background px-3 text-sm">
            <option value="">Todas as famílias</option>
            {facets?.familias.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <div className="text-xs text-muted-foreground ml-auto">
            Exibindo {total} {total === 500 ? "(máx.)" : ""}
          </div>
        </div>

        <div className="surface rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Produto</th>
                <th className="px-4 py-3 font-medium">Marca</th>
                <th className="px-4 py-3 font-medium">Família</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Carregando...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Nenhum produto encontrado.</td></tr>
              ) : products.map((p: any) => (
                <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                  <td className="px-4 py-2 font-mono text-xs">{p.codigo_interno || "—"}</td>
                  <td className="px-4 py-2">
                    <div className="font-medium">{p.nome}</div>
                    {p.codigo_barra && <div className="text-[10px] text-muted-foreground">EAN {p.codigo_barra}</div>}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{p.marca || "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{p.familia || "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{p.categoria || "—"}</td>
                  <td className="px-4 py-2">
                    {p.status ? <Badge variant="outline" className={STATUS_COLORS[p.status] || ""}>{p.status}</Badge> : "—"}
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
