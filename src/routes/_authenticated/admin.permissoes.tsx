import { createFileRoute, Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { ShieldCheck, ChevronDown, ChevronRight, Save, Loader2, ArrowLeft, RotateCcw, UserCog } from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { NAV_TREE, ALL_NAV_KEYS } from "@/lib/nav-tree";

export const Route = createFileRoute("/_authenticated/admin/permissoes")({
  validateSearch: (search: Record<string, unknown>) => ({
    user: typeof search["user"] === "string" ? (search["user"] as string) : undefined,
  }),
  component: PermissoesPage,
  head: () => ({
    meta: [
      { title: "Acessos por perfil · PoolFlux" },
      { name: "description", content: "Defina quais áreas e seções do menu cada perfil ou usuário pode acessar." },
      { property: "og:title", content: "Acessos por perfil · PoolFlux" },
      { property: "og:description", content: "Controle granular de acesso por perfil, usuário e seção." },
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
  const { user } = Route.useSearch();
  return user ? <AcessoUsuario userId={user} /> : <AcessoPorPerfil />;
}

/** Aplica a propagação área <-> seções em um mapa de nav_key -> boolean */
function propagate(map: Record<string, boolean>, key: string, value: boolean) {
  const next = { ...map, [key]: value };
  const group = NAV_TREE.find(g => g.key === key);
  if (group) {
    for (const c of group.children) next[c.key] = value;
  } else if (value) {
    const parent = NAV_TREE.find(g => g.children.some(c => c.key === key));
    if (parent) next[parent.key] = true;
  }
  return next;
}

/* ------------------------------------------------------------------ */
/* Acesso individual (por usuário)                                     */
/* ------------------------------------------------------------------ */

function AcessoUsuario({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [map, setMap] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const { data: presets = [] } = useQuery({
    queryKey: ["permission-presets"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("permission_presets").select("id, name, nav_keys").order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; nav_keys: string[] }[];
    },
  });

  async function salvarPadrao() {
    const nome = window.prompt("Nome do padrão de acesso (ex.: Gestor comercial):")?.trim();
    if (!nome) return;
    setSaving(true);
    try {
      const keys = ALL_NAV_KEYS.filter(k => !!map[k]);
      const existente = presets.find(p => p.name.toLowerCase() === nome.toLowerCase());
      const { error } = existente
        ? await (supabase as any).from("permission_presets").update({ nav_keys: keys }).eq("id", existente.id)
        : await (supabase as any).from("permission_presets").insert({ name: nome, nav_keys: keys });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["permission-presets"] });
      toast.success("Padrão salvo", { description: `Agora você pode aplicar “${nome}” a outros usuários.` });
    } catch (e: any) {
      toast.error("Não foi possível salvar o padrão", { description: e.message });
    } finally {
      setSaving(false);
    }
  }

  function aplicarPadrao(presetId: string) {
    const preset = presets.find(p => p.id === presetId);
    if (!preset) return;
    const keys = new Set(preset.nav_keys ?? []);
    setMap(Object.fromEntries(ALL_NAV_KEYS.map(k => [k, keys.has(k)])));
    toast.info(`Padrão “${preset.name}” aplicado`, { description: "Clique em Salvar acessos para confirmar." });
  }

  const { data, isLoading } = useQuery({
    queryKey: ["user-permissions", userId],
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles").select("id, full_name, email").eq("id", userId).maybeSingle();
      const { data: roleRows } = await supabase
        .from("user_roles").select("role").eq("user_id", userId);
      const roles = (roleRows ?? []).map((r: any) => r.role as string);

      const base = new Set<string>();
      if (roles.includes("admin")) ALL_NAV_KEYS.forEach(k => base.add(k));
      else if (roles.length) {
        const { data: perms } = await supabase
          .from("role_permissions").select("nav_key, allowed").in("role", roles as any);
        for (const p of (perms ?? []) as any[]) if (p.allowed) base.add(p.nav_key);
      }

      const { data: overrides } = await (supabase as any)
        .from("user_nav_permissions").select("nav_key, allowed").eq("user_id", userId);

      return {
        profile,
        roles,
        base: Array.from(base),
        overrides: (overrides ?? []) as { nav_key: string; allowed: boolean }[],
      };
    },
  });

  useEffect(() => {
    if (!data) return;
    const m: Record<string, boolean> = Object.fromEntries(ALL_NAV_KEYS.map(k => [k, false]));
    for (const k of data.base) m[k] = true;
    for (const o of data.overrides) m[o.nav_key] = !!o.allowed;
    setMap(m);
  }, [data]);

  const nome = data?.profile?.full_name ?? data?.profile?.email ?? "Usuário";

  async function save() {
    setSaving(true);
    try {
      const rows = ALL_NAV_KEYS.map(k => ({ user_id: userId, nav_key: k, allowed: !!map[k] }));
      const { error } = await (supabase as any)
        .from("user_nav_permissions").upsert(rows, { onConflict: "user_id,nav_key" });
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["user-permissions", userId] });
      await qc.invalidateQueries({ queryKey: ["nav-access"] });
      toast.success("Acessos individuais salvos", {
        description: `Apenas ${nome} foi afetado. Os demais usuários permanecem como estavam.`,
      });
    } catch (e: any) {
      toast.error("Não foi possível salvar", { description: e.message });
    } finally {
      setSaving(false);
    }
  }

  async function restaurar() {
    if (!confirm(`Remover as exceções individuais de ${nome} e voltar ao padrão do perfil?`)) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("user_nav_permissions").delete().eq("user_id", userId);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["user-permissions", userId] });
      await qc.invalidateQueries({ queryKey: ["nav-access"] });
      toast.success("Acessos voltaram ao padrão do perfil");
    } catch (e: any) {
      toast.error("Não foi possível restaurar", { description: e.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="border-b border-border px-4 sm:px-8 py-6">
        <div className="flex items-center gap-3">
          <UserCog className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Acessos de {nome}</h1>
            <p className="text-sm text-muted-foreground">
              Alterações aqui valem <strong>somente para este usuário</strong> — os demais continuam com o padrão do perfil.
            </p>
          </div>
        </div>
      </div>

      <PageHeader
        title="Áreas e seções liberadas"
        subtitle="Marque ou desmarque para criar exceções individuais em relação ao perfil."
        actions={
          <>
            <Button asChild variant="ghost">
              <Link to="/admin/permissoes" search={{ user: undefined }}>
                <ArrowLeft className="h-4 w-4" /> Matriz por perfil
              </Link>
            </Button>
            <Button variant="outline" onClick={restaurar} disabled={saving || isLoading}>
              <RotateCcw className="h-4 w-4" /> Restaurar padrão
            </Button>
            <Button onClick={save} disabled={saving || isLoading}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar acessos
            </Button>
          </>
        }
      />

      <div className="p-4 sm:p-8">
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="text-left text-muted-foreground border-b border-border">
                <th className="px-6 py-3 font-normal">Área / seção</th>
                <th className="px-6 py-3 font-normal text-center w-40">Acesso</th>
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
                      <td className="px-6 py-3 text-center">
                        <Checkbox
                          checked={!!map[g.key]}
                          onCheckedChange={v => setMap(m => propagate(m, g.key, !!v))}
                        />
                      </td>
                    </tr>
                    {expanded &&
                      g.children.map(c => (
                        <tr key={c.key} className="border-b border-border bg-muted/20">
                          <td className="px-6 py-2.5 pl-14 text-muted-foreground">{c.label}</td>
                          <td className="px-6 py-2.5 text-center">
                            <Checkbox
                              checked={!!map[c.key]}
                              onCheckedChange={v => setMap(m => propagate(m, c.key, !!v))}
                            />
                          </td>
                        </tr>
                      ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          As permissões individuais têm prioridade sobre o perfil. Use “Restaurar padrão” para remover as exceções e
          voltar a seguir a matriz do perfil.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Matriz por perfil                                                   */
/* ------------------------------------------------------------------ */

function AcessoPorPerfil() {
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
    setMatrix(prev => ({ ...prev, [role]: propagate(prev[role] ?? {}, key, value) }));
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
        subtitle="Expanda cada área para liberar seções específicas. Para exceções individuais, use o ícone de acessos na lista de usuários."
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
