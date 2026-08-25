import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertCircle,
  ArrowLeft,
  FileDown,
  FileUp,
  History,
  Loader2,
  Mail,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import {
  BriefingChapter,
  DiagnosticoChapter,
  LeituraChapter,
  NaoPrioridadeChapter,
} from "@/components/executive-report/ExecutiveChapters";
import { ClientFamiliasChart } from "@/components/ClientFamiliasChart";
import { ActionEditDialog } from "@/components/executive-report/ActionEditDialog";
import { EnviarEmailDialog } from "@/components/executive-report/EnviarEmailDialog";
import { parseExecutiveReportFile } from "@/lib/executive-report/parse";
import {
  resolveActionOrigin,
  useExistingClientActions,
} from "@/lib/executive-report/match-existing";
import { exportExecutiveReportPdf } from "@/lib/executive-report/pdf";

import {
  createExecutiveReport,
  deleteExecutiveReport,
  listEmailLogs,
  loadExecutiveReport,
  logEmail,
  reopenReport,
  updateAction,
} from "@/lib/executive-report/store";
import {
  toFinalData,
  type ExecutiveAction,
  type ExecutiveReportData,
} from "@/lib/executive-report/types";


export const Route = createFileRoute("/_authenticated/visao-imersao-2_/$reportId/executivo")({
  head: () => ({
    meta: [
      { title: "Relatório Executivo de Imersão | PoolFlux" },
      {
        name: "description",
        content:
          "Camada de decisão da imersão em campo: causa, impacto e ação, com validação, PDF e envio por e-mail.",
      },
      { property: "og:title", content: "Relatório Executivo de Imersão | PoolFlux" },
      {
        property: "og:description",
        content: "Ambiente de decisão da imersão em campo: validar ações, fechar versão, exportar e enviar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RelatorioExecutivoPage,
});

function RelatorioExecutivoPage() {
  const { reportId } = Route.useParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const [importing, setImporting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ExecutiveAction | null>(null);
  const [rejecting, setRejecting] = useState<ExecutiveAction | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [emailOpen, setEmailOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);


  const { data: me } = useQuery({
    queryKey: ["exec-me"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id ?? null;
      if (!uid) return { userId: null, companyId: null, name: null };
      const { data: prof } = await supabase
        .from("profiles")
        .select("company_id, full_name")
        .eq("id", uid)
        .maybeSingle();
      return {
        userId: uid,
        companyId: prof?.company_id ?? null,
        name: prof?.full_name ?? auth.user?.email ?? null,
      };
    },
  });

  const { data: parent } = useQuery({
    queryKey: ["exec-parent", reportId],
    queryFn: async () => {
      const { data } = await supabase
        .from("field_immersion_v2_reports")
        .select("id, client_name, visit_date, company_id, structured_data")
        .eq("id", reportId)
        .maybeSingle();
      return data ?? null;
    },
  });

  const {
    data: loaded,
    refetch,
    isLoading,
  } = useQuery({
    queryKey: ["exec-report", reportId],
    queryFn: () => loadExecutiveReport(reportId),
  });

  const data = loaded?.data ?? null;
  const versions = loaded?.versions ?? [];
  const counts = useMemo(() => actionCounts(data?.actions ?? []), [data]);
  const closed = data?.status === "closed";
  const viewData = useMemo<ExecutiveReportData | null>(
    () => (data ? (closed ? toFinalData(data) : data) : null),
    [data, closed],
  );

  const { data: emailLogs = [] } = useQuery({
    queryKey: ["exec-email-logs", data?.id, historyOpen],
    queryFn: () => (data?.id ? listEmailLogs(data.id) : Promise.resolve([])),
    enabled: !!data?.id && historyOpen,
  });

  async function handleFile(file: File) {
    setImporting(true);
    setParseError(null);
    try {
      const text = await file.text();
      const parsed = parseExecutiveReportFile(text);
      const parentInfo = (parent?.structured_data as any)?.data ?? {};
      await createExecutiveReport({
        immersionReportId: reportId,
        companyId: parent?.company_id ?? me?.companyId ?? null,
        userId: me?.userId ?? null,
        parsed: {
          ...parsed,
          client: {
            ...parsed.client,
            visit_date: parsed.client.visit_date || parent?.visit_date || null,
            representative:
              parsed.client.representative || parentInfo?.metadata?.representative_name || null,
            consultant: parsed.client.consultant || parentInfo?.metadata?.consultant_name || null,
          },
        },
        filename: file.name,
        clientDisplayName: parent?.client_name || parsed.client.display_name,
      });
      await refetch();
      toast.success("Relatório executivo importado.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Falha ao ler o arquivo.";
      setParseError(msg);
      toast.error("Arquivo não reconhecido.");
    } finally {
      setImporting(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function mutate(action: ExecutiveAction, patch: Partial<ExecutiveAction>, label: string, note?: string) {
    setBusy(true);
    try {
      await updateAction(action, patch, { userId: me?.userId ?? null, label, note });
      await refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível atualizar a ação.");
    } finally {
      setBusy(false);
    }
  }

  async function handleClose() {
    if (!data) return;
    if (!canClose(data.actions)) {
      toast.error("Revise todas as ações antes de finalizar.");
      return;
    }
    setBusy(true);
    try {
      const v = await closeReport({
        data,
        companyId: parent?.company_id ?? me?.companyId ?? null,
        userId: me?.userId ?? null,
        userName: me?.name ?? null,
      });
      await refetch();
      toast.success(`Relatório finalizado — versão ${v}.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível fechar o relatório.");
    } finally {
      setBusy(false);
    }
  }

  async function handleNewVersion() {
    if (!data?.id) return;
    await reopenReport(data.id);
    await refetch();
    toast.success("Nova versão aberta. O relatório voltou para Em revisão.");
  }

  const filteredActions = (data?.actions ?? []).filter(
    (a) =>
      (filterArea === "all" || a.area === filterArea) &&
      (filterStatus === "all" || a.status === filterStatus),
  );

  const clientName = parent?.client_name ?? data?.client.display_name ?? "Cliente";

  // Distingue ações já previstas no relatório de imersão original (espelho da
  // Gestão de Tarefas) das sugestões novas geradas com o relatório executivo.
  const parentClientId = (parent?.structured_data as any)?.data?.metadata?.client_id ?? null;
  const { data: existingActions = [] } = useExistingClientActions(parentClientId, clientName);
  const originOf = useMemo(() => {
    const cache = new Map<string, { existing: boolean; displayTitle: string }>();
    return (a: ExecutiveAction) => {
      if (!cache.has(a.id)) {
        const r = resolveActionOrigin(a.title, existingActions);
        cache.set(a.id, { existing: !!r.existing, displayTitle: r.displayTitle });
      }
      return cache.get(a.id)!;
    };
  }, [existingActions]);


  return (
    <div className="mx-auto w-full max-w-4xl px-4 pb-16">
      <PageHeader
        title="Relatório Executivo"
        subtitle={clientName}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {data && (
              <Badge variant={closed ? "default" : "secondary"}>
                {closed ? `Finalizado · versão ${data.current_version}` : "Em revisão"}
              </Badge>
            )}
            {data && closed && (
              <>
                <Button size="sm" onClick={() => viewData && exportExecutiveReportPdf(viewData)}>
                  <FileDown className="mr-1 h-4 w-4" /> Exportar PDF
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEmailOpen(true)}>
                  <Mail className="mr-1 h-4 w-4" /> Enviar por e-mail
                </Button>
                <Button size="sm" variant="outline" onClick={() => void handleNewVersion()}>
                  <RefreshCw className="mr-1 h-4 w-4" /> Nova versão
                </Button>
              </>
            )}
            {data && (
              <Button size="sm" variant="ghost" onClick={() => setHistoryOpen(true)}>
                <History className="mr-1 h-4 w-4" /> Histórico de envios
              </Button>
            )}
            <Button asChild size="sm" variant="ghost">
              <Link to="/visao-imersao-2">
                <ArrowLeft className="mr-1 h-4 w-4" /> Visão Imersão 2
              </Link>
            </Button>
          </div>
        }
      />

      {isLoading && (
        <div className="flex items-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      )}

      {!isLoading && !data && (
        <Card className="mt-6">
          <CardContent className="space-y-4 p-10 text-center">
            <h1 className="text-2xl font-bold">RELATÓRIO EXECUTIVO</h1>
            <p className="text-lg font-medium">{clientName}</p>
            <p className="mx-auto max-w-md text-sm text-muted-foreground">
              Carregue o arquivo executivo para estruturar a versão de decisão desta imersão.
            </p>
            {parseError && (
              <Alert variant="destructive" className="mx-auto max-w-xl text-left">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Arquivo não reconhecido</AlertTitle>
                <AlertDescription>{parseError}</AlertDescription>
              </Alert>
            )}
            <Button onClick={() => inputRef.current?.click()} disabled={importing}>
              {importing ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : (
                <FileUp className="mr-1 h-4 w-4" />
              )}
              Carregar arquivo
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".txt,.md,.markdown,text/plain,text/markdown"
              className="hidden"
              aria-label="Selecionar arquivo do relatório executivo"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleFile(f);
              }}
            />
          </CardContent>
        </Card>
      )}

      {viewData && (
        <div className="mt-6 space-y-8">
          <BriefingChapter data={viewData} />
          <LeituraChapter data={viewData} />
          <DiagnosticoChapter
            data={viewData}
            readOnly={closed}
            originOf={originOf}

            onValidate={(a) =>
              void mutate(
                a,
                {
                  status: "validated",
                  validated_at: new Date().toISOString(),
                  validated_by: me?.userId ?? null,
                },
                "validou",
              )
            }
            onEdit={(a) => setEditing(a)}
            onReject={(a) => {
              setRejecting(a);
              setRejectReason("");
            }}
          />
          <NaoPrioridadeChapter data={viewData} />

          <section>
            <ChapterHeader num="05" title="Plano de ação" />
            {!closed && (
              <div className="mb-3 flex flex-wrap gap-2">
                <FilterChip active={filterArea === "all"} onClick={() => setFilterArea("all")}>
                  Todas as áreas
                </FilterChip>
                {AREAS.map((a) => (
                  <FilterChip key={a} active={filterArea === a} onClick={() => setFilterArea(a)}>
                    {AREA_LABEL[a]}
                  </FilterChip>
                ))}
                <span className="w-full" />
                <FilterChip active={filterStatus === "all"} onClick={() => setFilterStatus("all")}>
                  Todos os status
                </FilterChip>
                {STATUSES.map((s) => (
                  <FilterChip key={s} active={filterStatus === s} onClick={() => setFilterStatus(s)}>
                    {STATUS_LABEL[s]}s
                  </FilterChip>
                ))}
              </div>
            )}
            <div className="space-y-3">
              {(closed ? finalActions(viewData.actions) : filteredActions).map((a) => (
                <ActionCard
                  key={a.id}
                  action={a}
                  origin={originOf(a)}
                  readOnly={closed}

                  onValidate={() =>
                    void mutate(
                      a,
                      {
                        status: "validated",
                        validated_at: new Date().toISOString(),
                        validated_by: me?.userId ?? null,
                      },
                      "validou",
                    )
                  }
                  onEdit={() => setEditing(a)}
                  onReject={() => {
                    setRejecting(a);
                    setRejectReason("");
                  }}
                />
              ))}
              {!closed && filteredActions.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma ação neste filtro.</p>
              )}
            </div>
          </section>

          <section>
            <ChapterHeader num="06" title="Validação e fechamento" />
            <Card>
              <CardContent className="space-y-4 p-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                  <Stat label="Ações" value={counts.total} />
                  <Stat label="Validadas" value={counts.validated} />
                  <Stat label="Editadas" value={counts.edited} />
                  <Stat label="Rejeitadas" value={counts.rejected} />
                  <Stat label="Não revisadas" value={counts.suggested} />
                </div>
                {closed ? (
                  <Alert>
                    <Lock className="h-4 w-4" />
                    <AlertTitle>Versão {data?.current_version} finalizada</AlertTitle>
                    <AlertDescription>
                      {versions[0]
                        ? `Finalizada em ${new Date(versions[0].closed_at).toLocaleString("pt-BR")}${
                            versions[0].closed_by_name ? ` por ${versions[0].closed_by_name}` : ""
                          }.`
                        : "Versão final registrada."}{" "}
                      Para alterar, abra uma nova versão.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <>
                    {counts.suggested > 0 && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>Revise todas as ações antes de finalizar.</AlertDescription>
                      </Alert>
                    )}
                    <Button
                      onClick={() => void handleClose()}
                      disabled={busy || counts.suggested > 0 || counts.total === 0}
                    >
                      Fechar relatório
                    </Button>
                  </>
                )}
                {versions.length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {versions.map((v) => (
                      <p key={v.id}>
                        Versão {v.version} · {new Date(v.closed_at).toLocaleString("pt-BR")}
                        {v.closed_by_name ? ` · ${v.closed_by_name}` : ""}
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </section>
        </div>
      )}

      <ActionEditDialog
        action={editing}
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        onSave={(patch) => {
          if (editing) void mutate(editing, { ...patch, status: "edited" }, "editou");
          setEditing(null);
        }}
      />

      <Dialog open={!!rejecting} onOpenChange={(v) => !v && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar ação</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            A ação permanece registrada para auditoria, mas não entra no relatório final.
          </p>
          <Textarea
            rows={3}
            placeholder="Motivo (opcional)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (rejecting)
                  void mutate(
                    rejecting,
                    { status: "rejected", reject_reason: rejectReason || null },
                    "rejeitou",
                    rejectReason,
                  );
                setRejecting(null);
              }}
            >
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Histórico de envios</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {emailLogs.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhum envio registrado.</p>
            )}
            {emailLogs.map((l) => (
              <div key={l.id} className="rounded-md border p-3 text-sm">
                <p className="font-medium">{l.subject}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(l.sent_at).toLocaleString("pt-BR")}
                  {l.sent_by_name ? ` · ${l.sent_by_name}` : ""} · {l.status}
                </p>
                <p className="mt-1 text-xs">{(l.recipients ?? []).join(", ")}</p>
                {l.error && <p className="mt-1 text-xs text-destructive">{l.error}</p>}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {viewData && data?.id && (
        <EnviarEmailDialog
          open={emailOpen}
          onOpenChange={setEmailOpen}
          data={viewData}
          appUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/visao-imersao-2/${reportId}/executivo`}
          onSent={async ({ recipients, subject, attachPdf, error }) => {
            await logEmail({
              reportId: data.id!,
              versionId: versions[0]?.id ?? null,
              companyId: parent?.company_id ?? me?.companyId ?? null,
              userId: me?.userId ?? null,
              userName: me?.name ?? null,
              recipients,
              subject,
              attachPdf,
              status: error ? "failed" : "sent",
              error: error ?? null,
            });
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/40 p-3 text-center">
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button size="sm" variant={active ? "default" : "outline"} onClick={onClick}>
      {children}
    </Button>
  );
}
