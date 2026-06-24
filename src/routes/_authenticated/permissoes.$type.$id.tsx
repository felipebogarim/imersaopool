import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/permissoes/$type/$id")({
  head: () => ({ meta: [{ title: "Permissões — PoolFlux" }] }),
  component: PermissionsPage,
});

const AREAS = [
  { key: "dashboard", label: "Dashboard", desc: "Visão geral e indicadores" },
  { key: "clientes", label: "Clientes", desc: "Base de clientes e prospects" },
  { key: "representantes", label: "Representantes", desc: "Cadastro de representantes" },
  { key: "agentes", label: "Agentes", desc: "Usuários internos" },
  { key: "imersoes", label: "Imersões", desc: "Imersões e diagnósticos" },
  { key: "price", label: "Price", desc: "Comparativo de preços" },
  { key: "permissoes", label: "Permissões", desc: "Gerenciar permissões de outros" },
];

const ENTITY_TABLE: Record<string, { table: string; name: string }> = {
  cliente: { table: "clients", name: "nome_fantasia" },
  representante: { table: "representatives", name: "nome" },
  agente: { table: "profiles", name: "full_name" },
};

function PermissionsPage() {
  const { type, id } = Route.useParams();
  const qc = useQueryClient();
  const cfg = ENTITY_TABLE[type];

  const { data: entity } = useQuery({
    queryKey: ["perm-entity", type, id],
    queryFn: async () => cfg ? (await supabase.from(cfg.table as any).select(`id, ${cfg.name}`).eq("id", id).single()).data : null,
  });

  const { data: perms = [] } = useQuery({
    queryKey: ["entity-perms", type, id],
    queryFn: async () => (await supabase.from("entity_permissions").select("area, allowed").eq("entity_type", type).eq("entity_id", id)).data ?? [],
  });

  const map = new Map<string, boolean>(perms.map((p: any) => [p.area, p.allowed]));

  async function toggle(area: string, value: boolean) {
    const { error } = await supabase.from("entity_permissions").upsert(
      { entity_type: type, entity_id: id, area, allowed: value },
      { onConflict: "entity_type,entity_id,area" }
    );
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["entity-perms", type, id] });
  }

  const backTo = type === "cliente" ? "/clientes" : type === "representante" ? "/representantes" : "/agentes";
  const entityName = (entity as any)?.[cfg?.name ?? ""] ?? "—";

  return (
    <div>
      <PageHeader
        title="Gerenciar permissões"
        subtitle={`${type.charAt(0).toUpperCase() + type.slice(1)}: ${entityName}`}
        actions={<Button variant="ghost" asChild><Link to={backTo}><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link></Button>}
      />
      <div className="p-8 max-w-3xl">
        <div className="surface rounded-xl divide-y divide-border">
          {AREAS.map(a => {
            const checked = map.get(a.key) ?? false;
            return (
              <div key={a.key} className="flex items-center justify-between p-4">
                <div>
                  <div className="font-medium">{a.label}</div>
                  <div className="text-xs text-muted-foreground">{a.desc}</div>
                </div>
                <Switch checked={checked} onCheckedChange={v => toggle(a.key, v)} />
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-3">As permissões definem quais áreas do sistema esta entidade poderá acessar.</p>
      </div>
    </div>
  );
}
