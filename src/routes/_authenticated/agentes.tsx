import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { EntityKebab } from "@/components/EntityKebab";

export const Route = createFileRoute("/_authenticated/agentes")({
  head: () => ({ meta: [{ title: "Agentes — PoolFlux" }] }),
  component: AgentsPage,
});

function AgentsPage() {
  const { data: profiles = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: async () => {
      const { data: profs } = await supabase.from("profiles").select("*").order("full_name");
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const roleMap: Record<string, string[]> = {};
      (roles ?? []).forEach((r: any) => { (roleMap[r.user_id] = roleMap[r.user_id] || []).push(r.role); });
      return (profs ?? []).map((p: any) => ({ ...p, roles: roleMap[p.id] || [] }));
    },
  });
  return (
    <div>
      <PageHeader title="Agentes" subtitle="Usuários internos da plataforma" />
      <div className="p-8">
        <div className="surface rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr><th className="text-left px-4 py-3">Nome</th><th className="text-left px-4 py-3">E-mail</th><th className="text-left px-4 py-3">Cargo</th><th className="text-left px-4 py-3">Região</th><th className="text-left px-4 py-3">Perfil</th><th className="px-4 py-3 w-12"></th></tr>
            </thead>
            <tbody>
              {profiles.length === 0 ? <tr><td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">Nenhum agente cadastrado.</td></tr> :
                profiles.map((p: any) => (
                  <tr key={p.id} className="border-t border-border">
                    <td className="px-4 py-3 font-medium">{p.full_name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.cargo || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.regiao || "—"}</td>
                    <td className="px-4 py-3">{p.roles.map((r: string) => <Badge key={r} variant="outline" className="mr-1">{r}</Badge>)}</td>
                    <td className="px-4 py-3 text-right"><EntityKebab type="agente" id={p.id} /></td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
