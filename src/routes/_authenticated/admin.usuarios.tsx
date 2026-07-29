import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import {
  Users, UserCog, Send, Key, MessageSquare, Lock, MapPin, FileText, Trash2, Check,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";

export const Route = createFileRoute("/_authenticated/admin/usuarios")({
  component: UsuariosPage,
});

type Row = {
  id: string;
  full_name: string | null;
  email: string | null;
  cargo: string | null;
  status: string;
  created_at: string;
  role: string | null;
};

function fmt(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function roleLabel(r: string | null) {
  if (r === "admin") return "Gestão";
  if (r === "gestor") return "Diretoria";
  if (r === "agente") return "Liderança";
  return "—";
}

function UsuariosPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, cargo, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const ids = (profiles ?? []).map(p => p.id);
      const { data: roles } = ids.length
        ? await supabase.from("user_roles").select("user_id, role").in("user_id", ids)
        : { data: [] as { user_id: string; role: string }[] };
      const byUser = new Map<string, string>((roles ?? []).map(r => [r.user_id, r.role]));
      return (profiles ?? []).map<Row>(p => ({ ...p, role: byUser.get(p.id) ?? null }));
    },
  });

  async function resetPassword(email: string | null) {
    if (!email) return toast.error("Usuário sem e-mail");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + "/auth",
    });
    if (error) return toast.error(error.message);
    toast.success("E-mail de redefinição enviado");
  }

  async function removeUser(id: string) {
    if (!confirm("Remover este usuário do sistema?")) return;
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Usuário removido");
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  }

  return (
    <div>
      <div className="border-b border-border px-8 py-6">
        <div className="flex items-center gap-3">
          <UserCog className="h-7 w-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Usuários e Permissões</h1>
            <p className="text-sm text-muted-foreground">Gerencie usuários, aprovações e permissões de acesso</p>
          </div>
        </div>
      </div>

      <PageHeader
        title="Aprovação de Usuários"
        subtitle="Gerencie solicitações de acesso ao painel"
        actions={
          <Button className="bg-primary hover:bg-primary/90">
            <Send className="h-4 w-4 mr-2" /> Enviar convite
          </Button>
        }
      />

      <div className="p-4 sm:p-8">
        <div className="rounded-xl border border-border bg-card">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-border">
            <Users className="h-5 w-5" />
            <h2 className="font-semibold">Solicitações de Cadastro</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="px-6 py-3 font-normal">Nome</th>
                  <th className="px-6 py-3 font-normal">Setor</th>
                  <th className="px-6 py-3 font-normal">Perfil</th>
                  <th className="px-6 py-3 font-normal">Status</th>
                  <th className="px-6 py-3 font-normal">Cadastro</th>
                  <th className="px-6 py-3 font-normal">Último Acesso</th>
                  <th className="px-6 py-3 font-normal text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td colSpan={7} className="px-6 py-10 text-center text-muted-foreground">Carregando…</td></tr>
                )}
                {!isLoading && (data?.length ?? 0) === 0 && (
                  <tr><td colSpan={7} className="px-6 py-10 text-center text-muted-foreground">Nenhum usuário cadastrado</td></tr>
                )}
                {data?.map(r => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                        <span className="font-medium">{r.full_name ?? r.email ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{r.cargo ?? "—"}</td>
                    <td className="px-6 py-4">{roleLabel(r.role)}</td>
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
                          r.status === "aprovado" || r.status === "ativo"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        )}
                      >
                        <Check className="h-3 w-3" />
                        {r.status === "aprovado" || r.status === "ativo" ? "Aprovado" : "Pendente"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">{fmt(r.created_at)}</td>
                    <td className="px-6 py-4 text-muted-foreground">—</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-1">
                        <ActionIcon icon={Key} label="Resetar Senha" onClick={() => resetPassword(r.email)} />
                        <ActionIcon icon={UserCog} label="Editar Perfil" />
                        <ActionIcon icon={MessageSquare} label="Mensagem" />
                        <ActionIcon icon={Lock} label="Acessos" />
                        <ActionIcon icon={MapPin} label="Localização" />
                        <ActionIcon icon={FileText} label="Auditoria" />
                        <ActionIcon icon={Trash2} label="Remover" danger onClick={() => removeUser(r.id)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionIcon({
  icon: Icon, label, onClick, danger,
}: { icon: any; label: string; onClick?: () => void; danger?: boolean }) {
  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={onClick}
            className={cn(
              "h-8 w-8 rounded-md flex items-center justify-center transition",
              danger
                ? "text-red-500 hover:bg-red-50"
                : "text-foreground/70 hover:bg-primary hover:text-primary-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom">{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
