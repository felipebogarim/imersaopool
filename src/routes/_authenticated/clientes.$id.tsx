import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Pencil, Sparkles, ListChecks, Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clientes/$id")({
  head: () => ({ meta: [{ title: "Cliente — PoolFlux" }] }),
  component: ClientDetail,
});

function ClientDetail() {
  const { id } = Route.useParams();
  const { data: client } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => (await supabase.from("clients").select("*, representative:representatives(nome)").eq("id", id).single()).data,
  });
  const { data: groupPeers = [] } = useQuery({
    queryKey: ["group-peers-detail", client?.grupo_nome, id],
    enabled: !!client?.pertence_grupo && !!client?.grupo_nome,
    queryFn: async () => (await supabase.from("clients").select("id, nome_fantasia, cidade, estado, status").eq("grupo_nome", client!.grupo_nome as string).neq("id", id)).data ?? [],
  });
  const groupClientIds = [id, ...groupPeers.map((p: any) => p.id)];
  const isGroup = groupClientIds.length > 1;
  const { data: imms = [] } = useQuery({
    queryKey: ["client-immersions", id, groupClientIds.join(",")],
    queryFn: async () => (await supabase.from("immersions").select("id, titulo, status, data_visita, created_at, client_id, client:clients(nome_fantasia)").in("client_id", groupClientIds).order("created_at", { ascending: false })).data ?? [],
  });
  const immIds = imms.map((i: any) => i.id);
  const { data: perspectivas = [] } = useQuery({
    queryKey: ["client-perspectivas", id, immIds.join(",")],
    enabled: immIds.length > 0,
    queryFn: async () => (await supabase
      .from("perspectivas")
      .select("id, lente, conteudo, status, created_at, escopo_ref_id")
      .eq("status", "aprovada")
      .in("escopo_ref_id", immIds)
      .order("created_at", { ascending: false })
      .limit(20)).data ?? [],
  });
  const { data: acoes = [] } = useQuery({
    queryKey: ["client-acoes", id, immIds.join(",")],
    enabled: immIds.length > 0,
    queryFn: async () => (await supabase
      .from("action_plans")
      .select("id, acao, prioridade, status, prazo, immersion_id")
      .in("immersion_id", immIds)
      .in("status", ["pendente", "em_andamento"])
      .order("prazo", { ascending: true, nullsFirst: false })
      .limit(20)).data ?? [],
  });

  if (!client) return <div className="p-8">Carregando...</div>;
  return (
    <div>
      <PageHeader
        title={client.nome_fantasia}
        subtitle={[client.grupo, client.categoria, [client.cidade, client.estado].filter(Boolean).join(", ")].filter(Boolean).join(" • ")}
        actions={
          <div className="flex gap-2">
            <Button asChild><Link to="/clientes/$id/editar" params={{ id }}><Pencil className="h-4 w-4 mr-1" /> Editar</Link></Button>
            <Button variant="ghost" asChild><Link to="/clientes"><ArrowLeft className="h-4 w-4 mr-1" /> Voltar</Link></Button>
          </div>
        }
      />
      <div className="p-8 grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="surface rounded-xl p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Dados do cliente</h3>
            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <Field label="Razão social" value={client.razao_social} />
              <Field label="Documento" value={client.documento} />
              <Field label="Comprador" value={client.nome_comprador} />
              <Field label="Telefone" value={client.telefone} />
              <Field label="WhatsApp" value={client.whatsapp} />
              <Field label="E-mail" value={client.email} />
              <Field label="Endereço" value={client.endereco} />
              <Field label="Região" value={client.regiao} />
              <Field label="Representante" value={client.representative?.nome} />
              <Field label="Status" value={<Badge variant="outline">{client.status}</Badge>} />
            </dl>
            {client.observacoes && (
              <div className="mt-5 pt-5 border-t border-border">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Observações</div>
                <p className="text-sm whitespace-pre-wrap">{client.observacoes}</p>
              </div>
            )}
          </div>
        </div>
        <div className="space-y-6">
          <div className="surface rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                Imersões {isGroup && <Badge variant="outline" className="text-[10px]">grupo</Badge>}
              </h3>
              <Button size="sm" asChild>
                <Link to="/imersoes/nova" search={{ client: id }}><Plus className="h-3.5 w-3.5 mr-1" /> Nova</Link>
              </Button>
            </div>
            {imms.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma imersão ainda.</p>
            ) : (
              <ul className="space-y-2">
                {imms.map((i: any) => (
                  <li key={i.id}>
                    <Link to="/imersoes/$id" params={{ id: i.id }} className="block rounded-lg border border-border p-3 hover:bg-muted/30">
                      <div className="font-medium text-sm">{i.titulo}</div>
                      <div className="text-xs text-muted-foreground mt-1 flex justify-between">
                        <span className="capitalize">{i.status.replace(/_/g, " ")}</span>
                        {i.data_visita && <span>{new Date(i.data_visita).toLocaleDateString("pt-BR")}</span>}
                      </div>
                      {isGroup && i.client_id !== id && (
                        <div className="text-[10px] text-muted-foreground mt-1">{i.client?.nome_fantasia}</div>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}

          </div>
          <div className="surface rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" /> Perspectivas aprovadas {isGroup && <Badge variant="outline" className="text-[10px]">grupo</Badge>}
              </h3>
              <Badge variant="outline">{perspectivas.length}</Badge>
            </div>
            {perspectivas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sem perspectivas aprovadas para este cliente.</p>
            ) : (
              <ul className="space-y-2 max-h-72 overflow-y-auto">
                {perspectivas.map((p: any) => {
                  const first = Array.isArray(p.conteudo) ? p.conteudo[0] : (p.conteudo && typeof p.conteudo === "object" ? Object.values(p.conteudo)[0] : null);
                  return (
                    <li key={p.id} className="rounded-lg border border-border p-3 text-sm">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="capitalize text-xs">{p.lente}</Badge>
                        <span className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString("pt-BR")}</span>
                      </div>
                      {first && <p className="text-xs text-muted-foreground line-clamp-3">{String(first)}</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          <div className="surface rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <ListChecks className="h-3.5 w-3.5" /> Ações em aberto {isGroup && <Badge variant="outline" className="text-[10px]">grupo</Badge>}
              </h3>
              <Button size="sm" variant="ghost" asChild><Link to="/planos">Ver kanban</Link></Button>
            </div>
            {acoes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma ação em aberto vinculada.</p>
            ) : (
              <ul className="space-y-2 max-h-72 overflow-y-auto">
                {acoes.map((a: any) => (
                  <li key={a.id} className="rounded-lg border border-border p-3 text-sm">
                    <div className="font-medium leading-snug">{a.acao}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant={a.prioridade === "alta" ? "destructive" : a.prioridade === "media" ? "default" : "secondary"} className="text-xs">{a.prioridade}</Badge>
                      <span className="capitalize">{a.status.replace(/_/g, " ")}</span>
                      {a.prazo && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{new Date(a.prazo).toLocaleDateString("pt-BR")}</span>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {client.pertence_grupo && client.grupo_nome && (
            <div className="surface rounded-xl p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-1">Grupo econômico</h3>
              <div className="text-base font-medium mb-3">{client.grupo_nome}</div>
              {groupPeers.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum outro cliente vinculado a este grupo.</p>
              ) : (
                <>
                  <div className="text-xs text-muted-foreground mb-2">Dados exibidos são agregados dos {groupPeers.length + 1} clientes do grupo.</div>
                  <ul className="space-y-1.5 max-h-64 overflow-y-auto">
                    {groupPeers.map((p: any) => (
                      <li key={p.id}>
                        <Link to="/clientes/$id" params={{ id: p.id }} className="block text-sm rounded px-2 py-1 hover:bg-muted/30">
                          <span className="font-medium">{p.nome_fantasia}</span>
                          <span className="text-muted-foreground text-xs ml-2">{[p.cidade, p.estado].filter(Boolean).join(", ")}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-muted-foreground mb-0.5">{label}</dt>
      <dd className="text-sm">{value || <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}
