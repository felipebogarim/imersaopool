import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, UserCheck, ShieldAlert, Clock } from "lucide-react";

type UserRow = {
  id: string; email: string; full_name: string | null; role: string | null;
  last_sign_in_at: string | null; created_at: string; banned_until: string | null;
};

const ROLES = ["admin", "gestor", "agente", "comercial", "master"];

const ROLE_META: Record<string, string> = {
  admin: "bg-red-100 text-red-800",
  gestor: "bg-purple-100 text-purple-800",
  agente: "bg-sky-100 text-sky-800",
  comercial: "bg-amber-100 text-amber-800",
  master: "bg-slate-900 text-white",
};

function daysSince(d: string | null) {
  if (!d) return null;
  return Math.floor((Date.now() - new Date(d).getTime()) / (1000 * 60 * 60 * 24));
}

export function AccessControlTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");

  const usersQ = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users");
      if (error) throw error;
      return (data ?? []) as UserRow[];
    },
  });

  const failedLoginsQ = useQuery({
    queryKey: ["failed-logins-7d"],
    queryFn: async () => {
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase.from("security_events")
        .select("id", { count: "exact", head: true })
        .eq("tipo", "login").eq("resultado", "falha").gte("created_at", since);
      return count ?? 0;
    },
  });

  const users = usersQ.data ?? [];
  const filtered = useMemo(() => users.filter(u => {
    if (filterRole !== "all" && u.role !== filterRole) return false;
    if (search && !`${u.email} ${u.full_name ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [users, filterRole, search]);

  const total = users.length;
  const admins = users.filter(u => u.role === "admin" || u.role === "master").length;
  const inativos = users.filter(u => {
    const d = daysSince(u.last_sign_in_at);
    return d === null || d > 90;
  }).length;

  async function changeRole(userId: string, newRole: string) {
    if (!confirm(`Alterar papel do usuário para "${newRole}"?`)) return;
    const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
    if (delErr) return alert(delErr.message);
    const { error } = await supabase.from("user_roles").insert({ user_id: userId, role: newRole as any });
    if (error) return alert(error.message);
    await supabase.rpc("log_security_event", {
      _tipo: "controle_acesso",
      _acao: "alterar_papel",
      _recurso: userId,
      _resultado: "sucesso",
      _nivel_risco: "medio",
      _metadata: { novo_papel: newRole } as any,
    });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Users className="h-4 w-4" /> Usuários totais</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> Admins / Master</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-red-700">{admins}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Clock className="h-4 w-4" /> Inativos {'>'} 90 dias</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-amber-700">{inativos}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><UserCheck className="h-4 w-4" /> Falhas de login (7d)</CardTitle></CardHeader>
          <CardContent><div className={`text-3xl font-bold ${(failedLoginsQ.data ?? 0) > 10 ? "text-red-700" : ""}`}>{failedLoginsQ.data ?? 0}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle>Usuários do sistema</CardTitle>
            <div className="flex gap-2">
              <Input placeholder="Buscar por email ou nome" value={search} onChange={e => setSearch(e.target.value)} className="w-64" />
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os papéis</SelectItem>
                  {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Último acesso</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Alterar papel</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(u => {
                const d = daysSince(u.last_sign_in_at);
                const banned = u.banned_until && new Date(u.banned_until) > new Date();
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{u.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground font-mono">{u.email}</div>
                    </TableCell>
                    <TableCell>
                      {u.role
                        ? <Badge className={ROLE_META[u.role] ?? "bg-slate-100"} variant="secondary">{u.role}</Badge>
                        : <span className="text-xs text-muted-foreground">sem papel</span>}
                    </TableCell>
                    <TableCell className="text-xs">
                      {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("pt-BR") : "Nunca"}
                      {d !== null && <div className="text-muted-foreground">há {d} dia{d === 1 ? "" : "s"}</div>}
                    </TableCell>
                    <TableCell className="text-xs">{new Date(u.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell>
                      {banned
                        ? <Badge variant="destructive">Bloqueado</Badge>
                        : (d === null || d > 90)
                          ? <Badge className="bg-amber-100 text-amber-800" variant="secondary">Inativo</Badge>
                          : <Badge className="bg-emerald-100 text-emerald-800" variant="secondary">Ativo</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Select value={u.role ?? ""} onValueChange={v => changeRole(u.id, v)}>
                        <SelectTrigger className="w-32 ml-auto"><SelectValue placeholder="Definir" /></SelectTrigger>
                        <SelectContent>
                          {ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum usuário.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
