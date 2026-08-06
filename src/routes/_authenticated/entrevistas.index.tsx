import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, MessageSquare, MoreVertical, Mail, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { CLASSIFICACOES } from "@/lib/interview-questions";
import { EmptyState, LoadingRows } from "@/components/EmptyState";
import { PasswordConfirmDialog } from "@/components/PasswordConfirmDialog";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/entrevistas/")({
  head: () => ({ meta: [{ title: "Entrevistas — PoolFlux" }] }),
  component: EntrevistasIndex,
});

const CLASSIF_LABEL = Object.fromEntries(CLASSIFICACOES.map(c => [c.value, c.label]));

function EntrevistasIndex() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [pendingDelete, setPendingDelete] = useState<{ id: string; nome: string } | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["interviews"],
    queryFn: async () =>
      (await supabase
        .from("interviews")
        .select("id, entrevistado_nome, entrevistado_classificacao, empresa_nome, cidade, estado, data_entrevista, created_at")
        .is("immersion_id", null)
        .order("created_at", { ascending: false })).data ?? [],
  });

  function shareText(e: any) {
    const url = `${window.location.origin}/entrevistas/${e.id}`;
    const linhas = [
      `Entrevista — ${e.entrevistado_nome}`,
      e.empresa_nome ? `Empresa: ${e.empresa_nome}` : null,
      (e.cidade || e.estado) ? `Local: ${[e.cidade, e.estado].filter(Boolean).join("/")}` : null,
      e.data_entrevista ? `Data: ${new Date(e.data_entrevista).toLocaleDateString("pt-BR")}` : null,
      "",
      `Acesse: ${url}`,
    ].filter(Boolean).join("\n");
    return { url, text: linhas, title: `Entrevista — ${e.entrevistado_nome}` };
  }

  function shareByEmail(e: any) {
    const { text, title } = shareText(e);
    window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text)}`, "_blank");
  }

  function shareByWhats(e: any) {
    const { text } = shareText(e);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  }

  async function confirmDelete() {
    if (!pendingDelete) return;
    const { error } = await supabase.from("interviews").delete().eq("id", pendingDelete.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Entrevista excluída");
    qc.invalidateQueries({ queryKey: ["interviews"] });
  }

  return (
    <div>
      <PageHeader
        title="Entrevistas"
        subtitle="Conversas de campo estruturadas pelo framework de imersão"
        actions={
          <Button asChild>
            <Link to="/entrevistas/nova"><Plus className="h-4 w-4 mr-1" /> Nova entrevista</Link>
          </Button>
        }
      />
      <div className="p-4 sm:p-8">
        {isLoading ? (
          <LoadingRows rows={4} />
        ) : data.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="Nenhuma entrevista ainda"
            description="Comece a estruturar as conversas de campo."
            action={<Button asChild><Link to="/entrevistas/nova"><Plus className="h-4 w-4 mr-1" /> Nova entrevista</Link></Button>}
          />
        ) : (
          <div className="grid gap-3">
            {data.map((e: any) => (
              <div
                key={e.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate({ to: "/entrevistas/$id", params: { id: e.id } })}
                onKeyDown={(ev) => { if (ev.key === "Enter") navigate({ to: "/entrevistas/$id", params: { id: e.id } }); }}
                className="surface rounded-xl p-5 hover:border-primary/40 transition block cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-semibold mb-1">{e.entrevistado_nome}</div>
                    <div className="text-sm text-muted-foreground">
                      {e.empresa_nome}
                      {e.cidade && <span className="mx-2">•</span>}{e.cidade}{e.estado ? `/${e.estado}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {e.data_entrevista && <span className="text-xs text-muted-foreground">{new Date(e.data_entrevista).toLocaleDateString("pt-BR")}</span>}
                    <Badge variant="outline">{CLASSIF_LABEL[e.entrevistado_classificacao] ?? e.entrevistado_classificacao}</Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" onClick={(ev) => ev.stopPropagation()}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(ev) => ev.stopPropagation()}>
                        <DropdownMenuItem onClick={() => shareByEmail(e)}>
                          <Mail className="h-4 w-4 mr-2" /> Compartilhar por e-mail
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => shareByWhats(e)}>
                          <MessageCircle className="h-4 w-4 mr-2" /> Compartilhar por WhatsApp
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate({ to: "/entrevistas/$id", params: { id: e.id } })}>
                          <Pencil className="h-4 w-4 mr-2" /> Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setPendingDelete({ id: e.id, nome: e.entrevistado_nome })} className="text-destructive focus:text-destructive">
                          <Trash2 className="h-4 w-4 mr-2" /> Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <PasswordConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(v) => { if (!v) setPendingDelete(null); }}
        title={pendingDelete ? `Excluir entrevista de "${pendingDelete.nome}"` : "Excluir entrevista"}
        onConfirmed={confirmDelete}
      />
    </div>
  );
}
