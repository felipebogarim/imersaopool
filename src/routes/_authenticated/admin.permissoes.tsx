import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { ShieldCheck, ChevronDown, ChevronRight, Save, Loader2 } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { NAV_TREE, ALL_NAV_KEYS } from "@/lib/nav-tree";

export const Route = createFileRoute("/_authenticated/admin/permissoes")({
  component: PermissoesPage,
  head: () => ({
    meta: [
      { title: "Acessos por perfil · PoolFlux" },
      { name: "description", content: "Defina quais áreas e seções do menu cada perfil pode acessar." },
      { property: "og:title", content: "Acessos por perfil · PoolFlux" },
      { property: "og:description", content: "Controle granular de acesso por perfil e seção." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const ROLES: { key: string; label: string }[] = [
  { key: "gestor", label: "Gestor" },
  { key: "agente", label: "Agente" },
  { key: "comercial", label: "Comercial" },
];

type Matrix = Record<string, Record<string, boolean>>; // role -> nav_key -> allowed

function PermissoesPage() {
  const qc = useQueryClient();
  const [matrix, setMatrix] = useState<Matrix>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["role-permissions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("role_permissions").select("role, nav_key, allowed");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!data) return;
    const m: Matrix = {};
    for (const r of ROLES) m[r.key] = Object.fromEntries(ALL_NAV_KEYS.map(k => [k, false]));
    for (const row of data as any[]) {
      if (!m[row.role]) m[row.role] = {};
      m[row.role][row.nav_key] = !!row.allowed;
    }
    setMatrix(m);
  }, [data]);

  function toggle(role: string, key: string, value: boolean) {
    setMatrix(prev => {
      const next = { ...prev, [role]: { ...prev[role], [key]: value } };
      const group = NAV_TREE.find(g => g.key === key);
      if (group) {
        // ligar/desligar a área inteira propaga para os subitens
        for (const c of group.children) next[role][c.key] = value;
      } else if (value) {
        // liberar um subitem libera a área
        const parent = NAV_TREE.find(g => g.children.some(c => c.key === key));
        if (parent) next[role][parent.key] = true;
      }
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const rows = ROLES.flatMap(r =>
        ALL_NAV_KEYS.map(k => ({ role: r.key as any, nav_key: k, allowed: !!matrix[r.key]?.[k] }))
      );
      const { error } = await supabase.from("role_permissions").upsert(rows, { onConflict: "role,nav_key" });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["role-permissions"] });
      await qc.invalidateQueries({ queryKey: ["nav-access"] });
      toast.success("Acessos atualizados", { description: "O menu e as páginas já refletem as novas permissões." });
    } catch (e: any) {
      toast.error("Não foi possível salvar", { description: e.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="border-b border-border px-4 sm:px-8 py-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Acessos</h1>
            <p className="text-sm text-muted-foreground">Matriz de acesso por perfil, área e seção</p>
          </div>
        </div>
      </div>

      <PageHeader
        title="Perfis × Áreas e seções"
        subtitle="Expanda cada área para liberar seções específicas"
        actions={
          <Button onClick={save} disabled={saving || isLoading}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar acessos
          </Button>
        }
      />

      <div className="p-4 sm:p-8">
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="px-6 py-3 font-normal">Área / seção</th>
                {ROLES.map(r => (
                  <th key={r.key} className="px-6 py-3 font-normal text-center">{r.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {NAV_TREE.map(g => {
                const expanded = !!open[g.key];
                return (
                  <Fragment key={g.key}>
                    <tr className="border-b border-border hover:bg-muted/30">
                      <td className="px-6 py-3 font-medium">
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 text-left"
                          onClick={() => setOpen(o => ({ ...o, [g.key]: !o[g.key] }))}
                          disabled={g.children.length === 0}
                        >
                          {g.children.length > 0 ? (
                            expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <span className="inline-block w-4" />
                          )}
                          {g.label}
                          {g.children.length > 0 && (
                            <span className="text-xs text-muted-foreground">({g.children.length})</span>
                          )}
                        </button>
                      </td>
                      {ROLES.map(r => (
                        <td key={r.key} className="px-6 py-3 text-center">
                          <Checkbox
                            checked={!!matrix[r.key]?.[g.key]}
                            onCheckedChange={v => toggle(r.key, g.key, !!v)}
                          />
                        </td>
                      ))}
                    </tr>
                    {expanded &&
                      g.children.map(c => (
                        <tr key={c.key} className={cn("border-b border-border bg-muted/20")}>
                          <td className="px-6 py-2.5 pl-14 text-muted-foreground">{c.label}</td>
                          {ROLES.map(r => (
                            <td key={r.key} className="px-6 py-2.5 text-center">
                              <Checkbox
                                checked={!!matrix[r.key]?.[c.key]}
                                onCheckedChange={v => toggle(r.key, c.key, !!v)}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Administradores sempre têm acesso total. As permissões definidas aqui escondem os itens do menu e bloqueiam
          o conteúdo das páginas correspondentes para os demais perfis.
        </p>
      </div>
    </div>
  );
}
