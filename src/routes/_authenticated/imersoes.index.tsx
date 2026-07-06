import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, Mail, MessageCircle, Trash2, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { shareImmersionByEmail, shareImmersionByWhatsapp } from "@/lib/immersion-report";

export const Route = createFileRoute("/_authenticated/imersoes/")({
  head: () => ({ meta: [{ title: "Imersões — PoolFlux" }] }),
  component: ImmersionsIndex,
});

const STATUS_LABEL: Record<string, string> = {
  planejada: "Planejada",
  antes_visita: "Antes da visita",
  visita_campo: "Visita em campo",
  em_diagnostico: "Em diagnóstico",
  diagnostico_gerado: "Diagnóstico gerado",
  plano_acao: "Plano de ação",
  concluida: "Concluída",
};

function ImmersionsIndex() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: imms = [], isLoading } = useQuery({
    queryKey: ["immersions"],
    queryFn: async () => (await supabase
      .from("immersions")
      .select("id, titulo, status, data_visita, created_at, client:clients(nome_fantasia, grupo, categoria)")
      .order("created_at", { ascending: false })).data ?? [],
  });

  async function runShare(id: string, kind: "email" | "whats") {
    setBusyId(id);
    try {
      if (kind === "email") await shareImmersionByEmail(id);
      else await shareImmersionByWhatsapp(id);
      toast.success("Relatório gerado");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar relatório");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string, titulo: string) {
    if (!confirm(`Excluir a imersão "${titulo}"?`)) return;
    const { error } = await supabase.from("immersions").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Imersão excluída");
    qc.invalidateQueries({ queryKey: ["immersions"] });
  }

  return (
    <div>
      <PageHeader
        title="Imersões"
        subtitle="Dossiês comerciais por cliente"
        actions={<Button asChild><Link to="/imersoes/nova"><Plus className="h-4 w-4 mr-1" /> Nova imersão</Link></Button>}
      />
      <div className="p-8">
        {isLoading ? <p className="text-muted-foreground">Carregando...</p> :
          imms.length === 0 ? (
            <div className="surface rounded-xl p-12 text-center">
              <h3 className="font-semibold mb-1">Nenhuma imersão ainda</h3>
              <p className="text-sm text-muted-foreground mb-4">Crie a primeira imersão para começar.</p>
              <Button asChild><Link to="/imersoes/nova"><Plus className="h-4 w-4 mr-1" /> Nova imersão</Link></Button>
            </div>
          ) : (
            <div className="grid gap-3">
              {imms.map((i: any) => (
                <div
                  key={i.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate({ to: "/imersoes/$id", params: { id: i.id } })}
                  onKeyDown={(e) => { if (e.key === "Enter") navigate({ to: "/imersoes/$id", params: { id: i.id } }); }}
                  className="surface rounded-xl p-5 hover:border-primary/40 transition block cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-semibold mb-1">{i.titulo}</div>
                      <div className="text-sm text-muted-foreground">
                        {i.client?.nome_fantasia}
                        {i.client?.grupo && <span className="mx-2">•</span>}{i.client?.grupo}
                        {i.client?.categoria && <span className="mx-2">•</span>}{i.client?.categoria}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {i.data_visita && <span className="text-xs text-muted-foreground">{new Date(i.data_visita).toLocaleDateString("pt-BR")}</span>}
                      <Badge variant="outline">{STATUS_LABEL[i.status] || i.status}</Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="icon" variant="ghost" onClick={(e) => e.stopPropagation()}>
                            {busyId === i.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreVertical className="h-4 w-4" />}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => runShare(i.id, "email")}>
                            <Mail className="h-4 w-4 mr-2" /> Compartilhar por e-mail
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => runShare(i.id, "whats")}>
                            <MessageCircle className="h-4 w-4 mr-2" /> Compartilhar por WhatsApp
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => remove(i.id, i.titulo)} className="text-destructive focus:text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        }
      </div>
    </div>
  );
}
