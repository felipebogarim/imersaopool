import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Search, Download } from "lucide-react";
import { toast } from "sonner";
import { exportToCsv } from "@/lib/export-csv";

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

const PRODUCT_IMAGE_BUCKET = "product-images";

function getProductImagePath(url?: string | null) {
  if (!url) return null;
  const marker = `/${PRODUCT_IMAGE_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx >= 0) return decodeURIComponent(url.slice(idx + marker.length));
  if (!url.startsWith("http") && !url.startsWith("data:")) return url.replace(/^\/+/, "");
  return null;
}

function isDirectImageUrl(url?: string | null) {
  return !!url && (url.startsWith("data:") || !url.includes(`/${PRODUCT_IMAGE_BUCKET}/`));
}

function ProductThumbnail({ src, alt }: { src?: string | null; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  const canZoom = !!src && !failed;

  return (
    <>
      <button
        type="button"
        onClick={() => canZoom && setOpen(true)}
        disabled={!canZoom}
        className={`h-12 w-12 rounded bg-muted/30 border border-dashed border-border flex items-center justify-center text-[10px] text-muted-foreground overflow-hidden relative ${canZoom ? "cursor-zoom-in hover:border-primary" : "cursor-default"}`}
      >
        <span>—</span>
        {src && !failed && (
          <img
            src={src}
            alt={alt}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className={`absolute inset-0 h-full w-full object-contain bg-background transition-opacity ${loaded ? "opacity-100" : "opacity-0"}`}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        )}
      </button>
      {canZoom && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-3xl p-2 bg-background">
            <img src={src!} alt={alt} className="w-full h-auto max-h-[80vh] object-contain" referrerPolicy="no-referrer" />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function ProductsPage() {
  const [q, setQ] = useState("");
  const [marca, setMarca] = useState<string>("");
  const [familia, setFamilia] = useState<string>("");
  const [categoria, setCategoria] = useState<string>("");
  const [status, setStatus] = useState<string>("");

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
    queryKey: ["products", companyId, q, marca, familia, categoria, status],
    enabled: !!companyId,
    queryFn: async () => {
      const pageSize = 1000;
      const all: any[] = [];
      for (let from = 0; ; from += pageSize) {
        let query = supabase
          .from("own_products")
          .select("id, codigo_interno, nome, marca, familia, sub_familia, categoria, status, portifolio, codigo_barra, imagem_url")
          .eq("company_id", companyId!)
          .order("nome")
          .range(from, from + pageSize - 1);
        if (q) query = query.or(`nome.ilike.%${q}%,codigo_interno.ilike.%${q}%,codigo_barra.ilike.%${q}%`);
        if (marca) query = query.eq("marca", marca);
        if (familia) query = query.eq("familia", familia);
        if (categoria) query = query.eq("categoria", categoria);
        if (status) query = query.eq("status", status);
        const { data, error } = await query;
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < pageSize) break;
      }
      return all;
    },
  });

  const imagePaths = useMemo(
    () => Array.from(new Set(products.map((p: any) => getProductImagePath(p.imagem_url)).filter(Boolean))) as string[],
    [products],
  );

  const { data: signedImageUrls = {} } = useQuery<Record<string, string>>({
    queryKey: ["product-image-signed-urls", imagePaths.join("|")],
    enabled: imagePaths.length > 0,
    staleTime: 45 * 60 * 1000,
    queryFn: async () => {
      const entries: [string, string][] = [];
      for (let i = 0; i < imagePaths.length; i += 100) {
        const batch = imagePaths.slice(i, i + 100);
        const { data, error } = await supabase.storage.from(PRODUCT_IMAGE_BUCKET).createSignedUrls(batch, 60 * 60);
        if (error) throw error;
        entries.push(...(data ?? []).filter((item) => item.path && item.signedUrl).map((item) => [item.path, item.signedUrl] as [string, string]));
      }
      return Object.fromEntries(entries);
    },
  });

  const { data: facets } = useQuery({
    queryKey: ["product-facets", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const pageSize = 1000;
      const rows: any[] = [];
      for (let from = 0; ; from += pageSize) {
        const { data, error } = await supabase
          .from("own_products")
          .select("marca, familia, categoria, status")
          .eq("company_id", companyId!)
          .range(from, from + pageSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        rows.push(...data);
        if (data.length < pageSize) break;
      }
      const uniq = (k: string) =>
        Array.from(new Set(rows.map((r: any) => r[k]).filter(Boolean))).sort((a: any, b: any) =>
          String(a).localeCompare(String(b), "pt-BR"),
        ) as string[];
      return { marcas: uniq("marca"), familias: uniq("familia"), categorias: uniq("categoria"), statuses: uniq("status") };
    },
  });


  const total = products.length;
  const hasFilters = !!(q || marca || familia || categoria || status);

  return (
    <div>
      <PageHeader
        title="Produtos"
        subtitle="Base de produtos cadastrados"
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={!companyId}
              onClick={async () => {
                if (!companyId) return;
                const pageSize = 1000;
                const all: any[] = [];
                for (let from = 0; ; from += pageSize) {
                  const { data, error } = await supabase
                    .from("own_products")
                    .select("*")
                    .eq("company_id", companyId)
                    .order("nome")
                    .range(from, from + pageSize - 1);
                  if (error) return toast.error(error.message);
                  if (!data || data.length === 0) break;
                  all.push(...data);
                  if (data.length < pageSize) break;
                }
                exportToCsv(`produtos-completo-${new Date().toISOString().slice(0,10)}.csv`, all);
                toast.success(`${all.length} produtos exportados`);
              }}
            >
              <Download className="h-4 w-4 mr-1" /> Exportar completo
            </Button>
            <Button
              variant="outline"
              disabled={!companyId}
              onClick={async () => {
                if (!companyId) return;
                const pageSize = 1000;
                const all: any[] = [];
                for (let from = 0; ; from += pageSize) {
                  let query = supabase
                    .from("own_products")
                    .select("*")
                    .eq("company_id", companyId)
                    .order("nome")
                    .range(from, from + pageSize - 1);
                  if (q) query = query.or(`nome.ilike.%${q}%,codigo_interno.ilike.%${q}%,codigo_barra.ilike.%${q}%`);
                  if (marca) query = query.eq("marca", marca);
                  if (familia) query = query.eq("familia", familia);
                  if (categoria) query = query.eq("categoria", categoria);
                  if (status) query = query.eq("status", status);
                  const { data, error } = await query;
                  if (error) return toast.error(error.message);
                  if (!data || data.length === 0) break;
                  all.push(...data);
                  if (data.length < pageSize) break;
                }
                exportToCsv(`produtos-filtrado-${new Date().toISOString().slice(0,10)}.csv`, all);
                toast.success(`${all.length} produtos exportados`);
              }}
            >
              <Download className="h-4 w-4 mr-1" /> Exportar filtrado
            </Button>
          </div>
        }
      />
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
          <select value={categoria} onChange={e => setCategoria(e.target.value)} className="h-10 rounded-md border border-border bg-background px-3 text-sm">
            <option value="">Todas as categorias</option>
            {facets?.categorias.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={status} onChange={e => setStatus(e.target.value)} className="h-10 rounded-md border border-border bg-background px-3 text-sm">
            <option value="">Todos os status</option>
            {facets?.statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {hasFilters && (
            <button
              onClick={() => { setQ(""); setMarca(""); setFamilia(""); setCategoria(""); setStatus(""); }}
              className="h-10 rounded-md border border-border bg-background px-3 text-sm hover:bg-muted"
            >
              Limpar
            </button>
          )}
          <div className="text-xs text-muted-foreground ml-auto">
            {total.toLocaleString("pt-BR")} produtos
          </div>
        </div>


        <div className="surface rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium w-16">Imagem</th>
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Descrição</th>
                <th className="px-4 py-3 font-medium">Marca</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Portifolio</th>
                <th className="px-4 py-3 font-medium">Família</th>
                <th className="px-4 py-3 font-medium">Categoria</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">Carregando...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">Nenhum produto encontrado.</td></tr>
              ) : products.map((p: any) => {
                const imagePath = getProductImagePath(p.imagem_url);
                const imageSrc = imagePath ? signedImageUrls[imagePath] : isDirectImageUrl(p.imagem_url) ? p.imagem_url : null;

                return (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-2">
                      <ProductThumbnail src={imageSrc} alt={p.nome || p.codigo_interno || "produto"} />
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{p.codigo_interno || "—"}</td>
                    <td className="px-4 py-2">
                      <div className="font-medium">{p.nome}</div>
                      {p.codigo_barra && <div className="text-[10px] text-muted-foreground">EAN {p.codigo_barra}</div>}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{p.marca || "—"}</td>
                    <td className="px-4 py-2">
                      {p.status ? <Badge variant="outline" className={STATUS_COLORS[p.status] || ""}>{p.status}</Badge> : "—"}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{p.portifolio || "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{p.familia || "—"}</td>
                    <td className="px-4 py-2 text-muted-foreground">{p.categoria || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
