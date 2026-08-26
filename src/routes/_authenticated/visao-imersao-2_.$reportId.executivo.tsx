import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
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
import { buildExecutiveReadingFromImmersion } from "@/lib/executive-report/synthesis";


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
  const closed = data?.status === "closed";

  // Dados comerciais do cliente (mesma fonte da Visão Imersão 2): categoria,
  // atingimento geral e período de referência.
  const parentClientName = parent?.client_name ?? null;
  const parentResolvedClientId =
    (parent?.structured_data as any)?.data?.resolved_client_id ??
    (parent?.structured_data as any)?.resolved_client_id ??
    null;

  const { data: commercial } = useQuery({
    queryKey: ["exec-commercial", parentResolvedClientId, parentClientName],
    enabled: Boolean(parentResolvedClientId || parentClientName),
    queryFn: async () => {
      let clientRow: any = null;
      if (parentResolvedClientId) {
        const { data: c } = await supabase
          .from("clients")
          .select("id, razao_social, categoria, representative_id")
          .eq("id", parentResolvedClientId)
          .maybeSingle();
        clientRow = c ?? null;
      }
      if (!clientRow && parentClientName) {
        const term = parentClientName.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const { data: cands } = await supabase
          .from("clients")
          .select("id, razao_social, categoria, representative_id")
          .or(`razao_social.ilike.%${term}%,nome_fantasia.ilike.%${term}%`)
          .limit(2);
        if (cands?.length === 1) clientRow = cands[0];
      }
      if (!clientRow) return null;

      const { data: bi } = await (supabase as any)
        .from("client_bi_uploads")
        .select("data, representative_id, razao_social")
        .eq("razao_social", clientRow.razao_social)
        .eq("kind", "bi")
        .is("substituida_em", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const payload = bi?.data as any;
      const geralRaw = payload?.geral != null ? Number(payload.geral) : null;
      const geralPct =
        geralRaw == null ? null : Math.abs(geralRaw) <= 1.5 ? geralRaw * 100 : geralRaw;

      return {
        clientId: clientRow.id as string,
        razaoSocial: (clientRow.razao_social ?? bi?.razao_social ?? null) as string | null,
        representativeId: (clientRow.representative_id ?? bi?.representative_id ?? null) as
          | string
          | null,
        categoria: (clientRow.categoria ?? payload?.categoria ?? null) as string | null,
        geralPct,
        periodoLabel: (payload?.periodo || "1º Semestre 2026") as string,
      };
    },
  });

  // Leitura executiva = síntese estratégica na íntegra do relatório de imersão.
  const fullReading = useMemo(
    () => buildExecutiveReadingFromImmersion(parent?.structured_data),
    [parent?.structured_data],
  );

  const viewData = useMemo<ExecutiveReportData | null>(() => {
    if (!data) return null;
    const base = closed ? toFinalData(data) : data;
    const attainment =
      commercial?.geralPct != null
        ? `${commercial.geralPct.toFixed(1).replace(".", ",")}% · ${commercial.periodoLabel}`
        : base.client.attainment || null;
    return {
      ...base,
      executive_reading: fullReading || base.executive_reading,
      client: {
        ...base.client,
        attainment,
        category: commercial?.categoria || base.client.category || null,
      },
    };
  }, [data, closed, commercial, fullReading]);



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
      // "Atualizar": substitui integralmente os dados atuais pelo novo arquivo.
      if (data?.id) await deleteExecutiveReport(data.id);
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

  async function handleRevisar() {
    if (!data?.id) return;
    await reopenReport(data.id);
    await refetch();
    toast.success("Relatório reaberto para revisão.");
  }

  async function handleDelete() {
    if (!data?.id) return;
    setBusy(true);
    try {
      await deleteExecutiveReport(data.id);
      await refetch();
      setConfirmDelete(false);
      toast.success("Relatório executivo excluído.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível excluir o relatório.");
    } finally {
      setBusy(false);
    }
  }


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
              <>
                <Button size="sm" onClick={() => viewData && exportExecutiveReportPdf(viewData)}>
                  <FileDown className="mr-1 h-4 w-4" /> Exportar PDF
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEmailOpen(true)}>
                  <Mail className="mr-1 h-4 w-4" /> Enviar por e-mail
                </Button>
                {closed && (
                  <Button size="sm" variant="outline" onClick={() => void handleRevisar()}>
                    <RefreshCw className="mr-1 h-4 w-4" /> Revisar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => inputRef.current?.click()}
                  disabled={importing}
                >
                  {importing ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-1 h-4 w-4" />
                  )}
                  Atualizar
                </Button>
                <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="mr-1 h-4 w-4" /> Excluir
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setHistoryOpen(true)}>
                  <History className="mr-1 h-4 w-4" /> Histórico de envios
                </Button>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".txt,.md,.markdown,text/plain,text/markdown"
                  className="hidden"
                  aria-label="Selecionar novo arquivo do relatório executivo"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFile(f);
                  }}
                />
              </>
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
          {commercial?.representativeId && commercial?.razaoSocial && (
            <ClientFamiliasChart
              repId={commercial.representativeId}
              razaoSocial={commercial.razaoSocial}
              companyId={null}
              filterFams={[]}
            />
          )}

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
        </div>

      )}

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir relatório executivo</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Esta ação remove o relatório executivo desta imersão, incluindo ações e versões. A
            Visão Imersão 2 original não é afetada.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={busy} onClick={() => void handleDelete()}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
          repId={commercial?.representativeId ?? null}
          razaoSocial={commercial?.razaoSocial ?? null}
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
