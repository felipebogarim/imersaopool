import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  RefreshCw,
  ShieldCheck,
  Database,
  FileArchive,
  FolderArchive,
  Github,
  ClipboardList,
  History as HistoryIcon,
  Settings2,
  Download,
  Trash2,
  Play,
  HardDriveDownload,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CalendarClock,
  HardDrive,
  Archive,
  ShieldAlert,
  Cloud,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/backup")({
  component: PoolBackupPage,
});

type StatusKind = "ok" | "atencao" | "critico";
type Job = {
  id: string;
  tipo: "json" | "completo" | "arquivos" | "codigo";
  status: "executando" | "ok" | "erro";
  tamanho_bytes: number | null;
  storage_path: string | null;
  origem: "manual" | "auto";
  erro: string | null;
  created_at: string;
  concluido_em: string | null;
};
type Config = {
  id: string;
  auto_backup: boolean;
  frequencia: "diaria" | "semanal" | "mensal";
  retencao_dias: number;
  limite_gb: number;
  github_repo: string | null;
  github_branch: string;
  horario_execucao: string;
};
type Historico = {
  id: string;
  usuario_label: string | null;
  operacao: string;
  resultado: StatusKind;
  detalhe: string | null;
  created_at: string;
};
type Auditoria = {
  id: string;
  status: StatusKind;
  graves: number;
  medios: number;
  baixos: number;
  relatorio: Array<{ label: string; status: StatusKind; detail: string }>;
  created_at: string;
};

const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}
function fmtBytes(b: number | null) {
  if (!b) return "—";
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(2)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function statusBadge(s: StatusKind | "executando" | "erro" | "ok") {
  const map: Record<string, { label: string; cls: string }> = {
    ok: { label: "Sob Controle", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30" },
    atencao: { label: "Atenção", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30" },
    critico: { label: "Crítico", cls: "bg-red-500/15 text-red-600 border-red-500/30" },
    executando: { label: "Executando", cls: "bg-sky-500/15 text-sky-600 border-sky-500/30" },
    erro: { label: "Erro", cls: "bg-red-500/15 text-red-600 border-red-500/30" },
  };
  const m = map[s] ?? { label: s, cls: "" };
  return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
}

function StatusCard({
  icon: Icon,
  title,
  value,
  subtitle,
  tone,
}: {
  icon: typeof Database;
  title: string;
  value: string;
  subtitle?: string;
  tone?: StatusKind;
}) {
  const toneCls =
    tone === "critico"
      ? "border-red-500/30"
      : tone === "atencao"
        ? "border-amber-500/30"
        : tone === "ok"
          ? "border-emerald-500/30"
          : "";
  return (
    <Card className={toneCls}>
      <CardHeader className="pb-2 flex flex-row items-center gap-2 space-y-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xl font-bold truncate">{value}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function AuditItem({ label, status, detail }: { label: string; status: StatusKind; detail: string }) {
  const Icon = status === "ok" ? CheckCircle2 : status === "atencao" ? AlertTriangle : XCircle;
  const color = status === "ok" ? "text-emerald-600" : status === "atencao" ? "text-amber-600" : "text-red-600";
  return (
    <div className="flex items-start gap-3 py-2 border-b last:border-0">
      <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${color}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </div>
      {statusBadge(status)}
    </div>
  );
}

function PoolBackupPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [cfg, setCfg] = useState<Config | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [historico, setHistorico] = useState<Historico[]>([]);
  const [audit, setAudit] = useState<Auditoria | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [auditing, setAuditing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [progressTipo, setProgressTipo] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setIsAdmin(false);
        return;
      }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      setIsAdmin((roles ?? []).some((r) => r.role === "admin"));
    })();
  }, []);

  async function load() {
    setLoading(true);
    const [c, j, h, a] = await Promise.all([
      supabase.from("backup_config").select("*").limit(1).maybeSingle(),
      supabase.from("backup_jobs").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("backup_historico").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("backup_auditoria").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setCfg((c.data as Config) ?? null);
    setJobs((j.data as Job[]) ?? []);
    setHistorico((h.data as Historico[]) ?? []);
    setAudit((a.data as Auditoria) ?? null);
    setLoading(false);
  }

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin]);

  async function runProgress(tipo: string, stages: Array<{ pct: number; label: string }>) {
    setProgressTipo(tipo);
    setProgress(0);
    setProgressLabel("");
    let done = false;
    (async () => {
      for (const s of stages) {
        if (done) return;
        setProgress(s.pct);
        setProgressLabel(s.label);
        await new Promise((r) => setTimeout(r, 700));
      }
    })();
    return () => {
      done = true;
      setProgress(100);
      setProgressLabel("Concluído");
      setTimeout(() => setProgressTipo(null), 800);
    };
  }

  async function callEndpoint(path: string, body: unknown) {
    const { data: u } = await supabase.auth.getUser();
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: PUBLISHABLE_KEY },
      body: JSON.stringify({ ...(body as object), iniciado_por: u.user?.id }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  }

  async function gerarJson() {
    setRunning("json");
    try {
      await callEndpoint("/api/public/backup-run", { tipo: "json", origem: "manual" });
      toast.success("Backup JSON gerado");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setRunning(null);
    }
  }

  async function gerarCompleto() {
    setRunning("completo");
    const stop = await runProgress("completo", [
      { pct: 8, label: "Preparando ambiente" },
      { pct: 22, label: "Exportando tabelas do banco" },
      { pct: 45, label: "Compactando dump JSON" },
      { pct: 65, label: "Copiando arquivos (imersoes-anexos)" },
      { pct: 85, label: "Copiando arquivos (product-images)" },
      { pct: 95, label: "Finalizando" },
    ]);
    try {
      await callEndpoint("/api/public/backup-run", { tipo: "completo", origem: "manual" });
      toast.success("Backup completo gerado");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      stop();
      setRunning(null);
    }
  }

  async function gerarArquivos() {
    setRunning("arquivos");
    const stop = await runProgress("arquivos", [
      { pct: 15, label: "Listando buckets" },
      { pct: 50, label: "Sincronizando arquivos" },
      { pct: 85, label: "Validando" },
    ]);
    try {
      await callEndpoint("/api/public/backup-run", { tipo: "arquivos", origem: "manual" });
      toast.success("Backup de arquivos gerado");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      stop();
      setRunning(null);
    }
  }

  async function gerarCodigo() {
    setRunning("codigo");
    const stop = await runProgress("codigo", [
      { pct: 20, label: "Conectando ao GitHub" },
      { pct: 55, label: "Baixando zipball" },
      { pct: 85, label: "Enviando ao storage" },
    ]);
    try {
      await callEndpoint("/api/public/backup-codigo", { origem: "manual" });
      toast.success("Backup do código gerado");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      stop();
      setRunning(null);
    }
  }

  async function auditarAgora() {
    setAuditing(true);
    try {
      await callEndpoint("/api/public/backup-audit", {});
      toast.success("Auditoria concluída");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha");
    } finally {
      setAuditing(false);
    }
  }

  async function baixar(job: Job) {
    if (!job.storage_path) return;
    const toastId = toast.loading("Preparando download…");
    try {
      const res = await fetch("/api/public/backup-download", {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: PUBLISHABLE_KEY },
        body: JSON.stringify({ job_id: job.id }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `HTTP ${res.status}`);
      }
      const blob = await res.blob();
      const ext = job.tipo === "codigo" ? "zip" : "json";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `backup-${job.tipo}-${job.id}.${ext}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Download iniciado", { id: toastId });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao baixar o backup", { id: toastId });
    }
  }



  async function enviarAoDrive(job: Job) {
    if (!job.storage_path) return;
    const toastId = toast.loading("Enviando ao Google Drive…");
    try {
      const res = await fetch("/api/public/backup-to-drive", {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: PUBLISHABLE_KEY },
        body: JSON.stringify({ job_id: job.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
      toast.success("Backup enviado ao Drive", {
        id: toastId,
        description: data?.web_view_link
          ? "Clique para abrir no Drive"
          : data?.name ?? undefined,
        action: data?.web_view_link
          ? { label: "Abrir", onClick: () => window.open(data.web_view_link, "_blank") }
          : undefined,
      });
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar ao Drive", { id: toastId });
    }
  }



  async function excluir(job: Job) {
    if (!confirm("Excluir este backup?")) return;
    if (job.storage_path) {
      await supabase.storage.from("backups").remove([job.storage_path]);
    }
    await supabase.from("backup_jobs").delete().eq("id", job.id);
    await supabase.from("backup_historico").insert({
      operacao: `Backup ${job.tipo} excluído`,
      resultado: "ok",
      detalhe: fmtDate(job.created_at),
    });

    toast.success("Backup excluído");
    await load();
  }

  const jobsByType = useMemo(() => {
    const m: Record<string, Job[]> = { json: [], completo: [], arquivos: [], codigo: [] };
    for (const j of jobs) m[j.tipo]?.push(j);
    return m;
  }, [jobs]);

  const dash = useMemo(() => {
    const lastOk = (t: string) => jobs.find((j) => j.tipo === t && j.status === "ok");
    const totalBytes = jobs.filter((j) => j.status === "ok").reduce((s, j) => s + (j.tamanho_bytes ?? 0), 0);
    const totalGb = totalBytes / (1024 ** 3);
    return {
      geral: audit?.status ?? "ok",
      lastJson: lastOk("json"),
      lastComp: lastOk("completo"),
      lastArq: lastOk("arquivos"),
      totalGb,
      totalOk: jobs.filter((j) => j.status === "ok").length,
      riscos: (audit?.graves ?? 0) + (audit?.medios ?? 0),
    };
  }, [jobs, audit]);

  if (isAdmin === null) {
    return (
      <div>
        <PageHeader title="Backup" />
        <div className="p-8 text-sm text-muted-foreground">Carregando…</div>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="Backup" />
        <div className="p-8">
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
              <div>
                <p className="font-medium">Acesso restrito</p>
                <p className="text-sm text-muted-foreground">
                  Apenas administradores podem acessar o módulo de backup.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Backup"
        subtitle="Proteção de dados, arquivos e código-fonte"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Atualizar
            </Button>
            <Button size="sm" onClick={auditarAgora} disabled={auditing}>
              <ShieldCheck className="h-4 w-4 mr-2" />
              {auditing ? "Auditando…" : "Auditar Agora"}
            </Button>
          </>
        }
      />
      <div className="p-4 sm:p-8">
        <Tabs defaultValue="dashboard">
          <TabsList className="flex flex-wrap h-auto">
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="json">Backup JSON</TabsTrigger>
            <TabsTrigger value="completo">Backup Completo</TabsTrigger>
            <TabsTrigger value="arquivos">Arquivos</TabsTrigger>
            <TabsTrigger value="codigo">Código Fonte</TabsTrigger>
            <TabsTrigger value="auditoria">Auditoria</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="config">Configurações</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <StatusCard
                icon={ShieldCheck}
                title="Status Geral"
                value={dash.geral === "ok" ? "Sob Controle" : dash.geral === "atencao" ? "Atenção" : "Crítico"}
                subtitle={audit ? `Auditado em ${fmtDate(audit.created_at)}` : "Sem auditoria"}
                tone={dash.geral}
              />
              <StatusCard
                icon={Database}
                title="Último Backup JSON"
                value={dash.lastJson ? fmtDate(dash.lastJson.created_at) : "—"}
                subtitle={dash.lastJson ? fmtBytes(dash.lastJson.tamanho_bytes) : "Nenhum"}
              />
              <StatusCard
                icon={FileArchive}
                title="Último Backup Completo"
                value={dash.lastComp ? fmtDate(dash.lastComp.created_at) : "—"}
                subtitle={dash.lastComp ? fmtBytes(dash.lastComp.tamanho_bytes) : "Nenhum"}
              />
              <StatusCard
                icon={FolderArchive}
                title="Último Backup Arquivos"
                value={dash.lastArq ? fmtDate(dash.lastArq.created_at) : "—"}
                subtitle={dash.lastArq ? fmtBytes(dash.lastArq.tamanho_bytes) : "Nenhum"}
              />
              <StatusCard
                icon={CalendarClock}
                title="Agendamento"
                value={cfg?.auto_backup ? "Ativo" : "Desativado"}
                subtitle={cfg ? `${cfg.frequencia} · ${cfg.horario_execucao}` : ""}
                tone={cfg?.auto_backup ? "ok" : "atencao"}
              />
              <StatusCard
                icon={HardDrive}
                title="Espaço Utilizado"
                value={`${dash.totalGb.toFixed(2)} GB`}
                subtitle={cfg ? `de ${cfg.limite_gb} GB` : ""}
              />
              <StatusCard icon={Archive} title="Backups Armazenados" value={String(dash.totalOk)} />
              <StatusCard
                icon={ShieldAlert}
                title="Riscos Detectados"
                value={String(dash.riscos)}
                subtitle={audit ? `Graves: ${audit.graves} · Médios: ${audit.medios}` : ""}
                tone={dash.riscos > 0 ? (audit?.graves ? "critico" : "atencao") : "ok"}
              />
            </div>
          </TabsContent>

          <TabsContent value="json" className="mt-4 space-y-4">
            <Button onClick={gerarJson} disabled={running === "json"}>
              <Play className="h-4 w-4 mr-2" /> {running === "json" ? "Gerando…" : "Gerar Backup JSON"}
            </Button>
            <JobsTable jobs={jobsByType.json} onDownload={baixar} onDelete={excluir} />
          </TabsContent>

          <TabsContent value="completo" className="mt-4 space-y-4">
            <div className="flex items-center gap-4">
              <Button onClick={gerarCompleto} disabled={running === "completo"}>
                <Play className="h-4 w-4 mr-2" />
                {running === "completo" ? "Gerando…" : "Gerar Backup Completo"}
              </Button>
            </div>
            {progressTipo === "completo" && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground">{progressLabel}</p>
              </div>
            )}
            <JobsTable jobs={jobsByType.completo} onDownload={baixar} onDelete={excluir} onSendToDrive={enviarAoDrive} />
          </TabsContent>

          <TabsContent value="arquivos" className="mt-4 space-y-4">
            <Button onClick={gerarArquivos} disabled={running === "arquivos"}>
              <HardDriveDownload className="h-4 w-4 mr-2" />
              {running === "arquivos" ? "Sincronizando…" : "Sincronizar arquivos agora"}
            </Button>
            {progressTipo === "arquivos" && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground">{progressLabel}</p>
              </div>
            )}
            <JobsTable jobs={jobsByType.arquivos} onDownload={baixar} onDelete={excluir} />
          </TabsContent>

          <TabsContent value="codigo" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Github className="h-4 w-4" /> Repositório
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Repositório</p>
                  <p className="font-mono">{cfg?.github_repo ?? "Não configurado"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-muted-foreground">Branch</p>
                  <p className="font-mono">{cfg?.github_branch ?? "main"}</p>
                </div>
              </CardContent>
            </Card>
            <Button onClick={gerarCodigo} disabled={running === "codigo" || !cfg?.github_repo}>
              <Play className="h-4 w-4 mr-2" />
              {running === "codigo" ? "Gerando…" : "Gerar backup do código"}
            </Button>
            {progressTipo === "codigo" && (
              <div className="space-y-2">
                <Progress value={progress} />
                <p className="text-xs text-muted-foreground">{progressLabel}</p>
              </div>
            )}
            <JobsTable jobs={jobsByType.codigo} onDownload={baixar} onDelete={excluir} />
          </TabsContent>

          <TabsContent value="auditoria" className="mt-4 space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatusCard
                icon={ShieldCheck}
                title="Status Geral"
                value={audit?.status === "ok" ? "Sob Controle" : audit?.status === "atencao" ? "Atenção" : audit?.status === "critico" ? "Crítico" : "—"}
                tone={audit?.status}
              />
              <StatusCard icon={XCircle} title="Graves" value={String(audit?.graves ?? 0)} tone={(audit?.graves ?? 0) > 0 ? "critico" : "ok"} />
              <StatusCard icon={AlertTriangle} title="Médios" value={String(audit?.medios ?? 0)} tone={(audit?.medios ?? 0) > 0 ? "atencao" : "ok"} />
              <StatusCard icon={CheckCircle2} title="Baixos" value={String(audit?.baixos ?? 0)} tone="ok" />
            </div>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <ClipboardList className="h-4 w-4" /> Último Relatório
                </CardTitle>
              </CardHeader>
              <CardContent>
                {audit ? (
                  <div>
                    {audit.relatorio.map((it, i) => (
                      <AuditItem key={i} label={it.label} status={it.status} detail={it.detail} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma auditoria executada ainda.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historico" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <HistoryIcon className="h-4 w-4" /> Histórico
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Operação</TableHead>
                      <TableHead>Detalhe</TableHead>
                      <TableHead>Resultado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historico.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-sm text-muted-foreground text-center py-8">
                          Sem registros.
                        </TableCell>
                      </TableRow>
                    )}
                    {historico.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell className="whitespace-nowrap">{fmtDate(h.created_at)}</TableCell>
                        <TableCell>{h.usuario_label ?? "—"}</TableCell>
                        <TableCell>{h.operacao}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{h.detalhe ?? "—"}</TableCell>
                        <TableCell>{statusBadge(h.resultado)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="config" className="mt-4">
            <ConfigForm cfg={cfg} onSaved={load} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function JobsTable({
  jobs,
  onDownload,
  onDelete,
  onSendToDrive,
}: {
  jobs: Job[];
  onDownload: (j: Job) => void;
  onDelete: (j: Job) => void;
  onSendToDrive?: (j: Job) => void;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Tamanho</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                  Nenhum backup ainda.
                </TableCell>
              </TableRow>
            )}
            {jobs.map((j) => (
              <TableRow key={j.id}>
                <TableCell className="whitespace-nowrap">{fmtDate(j.created_at)}</TableCell>
                <TableCell>{fmtBytes(j.tamanho_bytes)}</TableCell>
                <TableCell className="capitalize">{j.origem}</TableCell>
                <TableCell>{statusBadge(j.status)}</TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onDownload(j)}
                      disabled={j.status !== "ok" || !j.storage_path}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    {onSendToDrive && (
                      <Button
                        variant="ghost"
                        size="sm"
                        title="Enviar ao Google Drive"
                        onClick={() => onSendToDrive(j)}
                        disabled={j.status !== "ok" || !j.storage_path}
                      >
                        <Cloud className="h-4 w-4 text-blue-600" />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => onDelete(j)}>
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ConfigForm({ cfg, onSaved }: { cfg: Config | null; onSaved: () => void }) {
  const [form, setForm] = useState<Config | null>(cfg);
  const [saving, setSaving] = useState(false);
  useEffect(() => setForm(cfg), [cfg]);
  if (!form) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  async function save() {
    if (!form) return;
    setSaving(true);
    const { error } = await supabase
      .from("backup_config")
      .update({
        auto_backup: form.auto_backup,
        frequencia: form.frequencia,
        retencao_dias: form.retencao_dias,
        limite_gb: form.limite_gb,
      })
      .eq("id", form.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Configurações salvas");
    onSaved();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Settings2 className="h-4 w-4" /> Configurações
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 max-w-xl">
        <div className="flex items-center justify-between">
          <div>
            <Label>Backup automático</Label>
            <p className="text-xs text-muted-foreground">Executa conforme a frequência escolhida</p>
          </div>
          <Switch
            checked={form.auto_backup}
            onCheckedChange={(v) => setForm({ ...form, auto_backup: v })}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Frequência</Label>
            <Select
              value={form.frequencia}
              onValueChange={(v) => setForm({ ...form, frequencia: v as Config["frequencia"] })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="diaria">Diária</SelectItem>
                <SelectItem value="semanal">Semanal</SelectItem>
                <SelectItem value="mensal">Mensal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Retenção (dias)</Label>
            <Input
              type="number"
              value={form.retencao_dias}
              onChange={(e) => setForm({ ...form, retencao_dias: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Limite de armazenamento (GB)</Label>
            <Input
              type="number"
              value={form.limite_gb}
              onChange={(e) => setForm({ ...form, limite_gb: Number(e.target.value) })}
            />
          </div>
          <div>
            <Label>Horário execução</Label>
            <Input value={form.horario_execucao} disabled />
          </div>
        </div>
        <Button onClick={save} disabled={saving}>{saving ? "Salvando…" : "Salvar"}</Button>
      </CardContent>
    </Card>
  );
}
