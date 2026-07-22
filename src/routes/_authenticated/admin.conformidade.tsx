import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/conformidade")({
  head: () => ({ meta: [{ title: "Conformidade e Aceites" }, { name: "robots", content: "noindex" }] }),
  component: ConformidadePage,
});

function statusBadge(s: string) {
  if (s === "aceito") return <Badge>Aceito</Badge>;
  if (s === "aceite_pendente") return <Badge variant="destructive">Aceite pendente</Badge>;
  if (s === "nova_versao_disponivel") return <Badge variant="secondary">Nova versão disponível</Badge>;
  return <Badge variant="outline">—</Badge>;
}

function ConformidadePage() {
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-conformidade"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_terms_conformidade");
      if (error) throw error;
      return data ?? [];
    },
  });

  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (data ?? []).filter((r: any) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.email, r.full_name, r.role].some((v) => String(v ?? "").toLowerCase().includes(q));
    });
  }, [data, filter, statusFilter]);

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Conformidade e Aceites"
        subtitle="Status de aceite dos Termos de Uso por usuário — somente informações de controle"
      />
      <div className="p-4 sm:p-8 space-y-4">
        <div className="flex flex-col sm:flex-row gap-2">
          <Input placeholder="Buscar por e-mail, nome ou perfil…" value={filter} onChange={(e) => setFilter(e.target.value)} className="sm:max-w-sm" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-border bg-background rounded-md px-3 text-sm h-10"
          >
            <option value="all">Todos os status</option>
            <option value="aceito">Aceito</option>
            <option value="aceite_pendente">Aceite pendente</option>
            <option value="nova_versao_disponivel">Nova versão disponível</option>
          </select>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando…</div>
        ) : error ? (
          <p className="text-destructive text-sm">{(error as Error).message}</p>
        ) : (
          <div className="rounded-lg border border-border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Usuário</th>
                  <th className="px-3 py-2">Perfil</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Versão aceita</th>
                  <th className="px-3 py-2">Aceito em</th>
                  <th className="px-3 py-2">Última ciência (login)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r: any) => (
                  <tr key={r.user_id}>
                    <td className="px-3 py-2">
                      <div className="font-medium">{r.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">{r.email}</div>
                    </td>
                    <td className="px-3 py-2">{r.role ?? "—"}</td>
                    <td className="px-3 py-2">{statusBadge(r.status)}</td>
                    <td className="px-3 py-2">{r.accepted_version ?? "—"}</td>
                    <td className="px-3 py-2">{r.accepted_at ? new Date(r.accepted_at).toLocaleString("pt-BR") : "—"}</td>
                    <td className="px-3 py-2">{r.last_login_ack_at ? new Date(r.last_login_ack_at).toLocaleString("pt-BR") : "—"}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Nenhum registro.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">Registros de aceite são imutáveis: não podem ser editados ou apagados por esta interface.</p>
      </div>
    </div>
  );
}
