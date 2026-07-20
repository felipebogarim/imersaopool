import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell, PageHeader } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { runSecurityAudit } from "@/lib/security-audit.functions";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Shield, ShieldQuestion, PlayCircle, RefreshCw, Loader2,
  AlertTriangle, CheckCircle2, HelpCircle, XCircle,
} from "lucide-react";
import { DataProtectionTab } from "@/components/security/DataProtectionTab";
import { FileSecurityTab } from "@/components/security/FileSecurityTab";
import { AccessControlTab } from "@/components/security/AccessControlTab";
import { LGPDTab } from "@/components/security/LGPDTab";
import { ReportsTab } from "@/components/security/ReportsTab";

export const Route = createFileRoute("/_authenticated/admin/auditoria-seguranca")({
  component: Page,
});

type AuditRow = {
  id: string;
  iniciado_em: string;
  concluido_em: string | null;
  indice_seguranca: number | null;
  status: string;
  total_checks: number | null;
  checks_ok: number | null;
  checks_atencao: number | null;
  checks_critico: number | null;
  checks_nao_verificado: number | null;
  duracao_ms: number | null;
};

function classify(score: number | null | undefined) {
  if (score == null) return { label: "Sem auditoria", color: "text-muted-foreground", bg: "bg-muted" };
  if (score >= 90) return { label: "Proteção elevada", color: "text-emerald-700", bg: "bg-emerald-100" };
  if (score >= 75) return { label: "Proteção adequada", color: "text-lime-700", bg: "bg-lime-100" };
  if (score >= 50) return { label: "Atenção necessária", color: "text-amber-700", bg: "bg-amber-100" };
  if (score >= 25) return { label: "Risco elevado", color: "text-orange-700", bg: "bg-orange-100" };
  return { label: "Risco crítico", color: "text-red-700", bg: "bg-red-100" };
}

function statusBadge(s: string) {
  const map: Record<string, { label: string; cls: string; Icon: any }> = {
    ok: { label: "OK", cls: "bg-emerald-100 text-emerald-800", Icon: CheckCircle2 },
    atencao: { label: "Atenção", cls: "bg-amber-100 text-amber-800", Icon: AlertTriangle },
    critico: { label: "Crítico", cls: "bg-red-100 text-red-800", Icon: XCircle },
    nao_verificado: { label: "Não verificado", cls: "bg-slate-100 text-slate-700", Icon: HelpCircle },
    nao_implementado: { label: "Não implementado", cls: "bg-slate-100 text-slate-700", Icon: ShieldQuestion },
  };
  const it = map[s] ?? map.nao_verificado;
  const Icon = it.Icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${it.cls}`}>
      <Icon className="h-3 w-3" />
      {it.label}
    </span>
  );
}

function fmtDate(d?: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleString("pt-BR");
}

function Page() {
  const qc = useQueryClient();
  const runAudit = useServerFn(runSecurityAudit);
  const [running, setRunning] = useState(false);

  const auditsQ = useQuery({
    queryKey: ["sec-audits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_audits")
        .select("id, iniciado_em, concluido_em, indice_seguranca, status, total_checks, checks_ok, checks_atencao, checks_critico, checks_nao_verificado, duracao_ms")
        .order("iniciado_em", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });

  const lastAudit = auditsQ.data?.[0];

  const checksQ = useQuery({
    queryKey: ["sec-audit-checks", lastAudit?.id],
    enabled: !!lastAudit?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_audit_checks")
        .select("*")
        .eq("audit_id", lastAudit!.id)
        .order("categoria", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const risksQ = useQuery({
    queryKey: ["sec-risks"],
    queryFn: async () => (await supabase.from("security_risks").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const incidentsQ = useQuery({
    queryKey: ["sec-incidents"],
    queryFn: async () => (await supabase.from("security_incidents").select("*").order("ocorrido_em", { ascending: false })).data ?? [],
  });

  const settingsQ = useQuery({
    queryKey: ["sec-settings"],
    queryFn: async () => (await supabase.from("security_settings").select("*").limit(1).maybeSingle()).data,
  });

  async function handleRun() {
    setRunning(true);
    try {
      await runAudit();
      await qc.invalidateQueries({ queryKey: ["sec-audits"] });
      await qc.invalidateQueries({ queryKey: ["sec-audit-checks"] });
    } catch (e: any) {
      alert(`Falha ao executar auditoria: ${e?.message ?? e}`);
    } finally {
      setRunning(false);
    }
  }

  const classification = classify(lastAudit?.indice_seguranca);
  const openRisks = (risksQ.data ?? []).filter((r: any) => !["corrigido", "risco_aceito", "nao_aplicavel"].includes(r.status));
  const openIncidents = (incidentsQ.data ?? []).filter((i: any) => i.status !== "encerrado");
  const criticos = openRisks.filter((r: any) => r.gravidade === "critico").length;
  const altos = openRisks.filter((r: any) => r.gravidade === "alto").length;
  const medios = openRisks.filter((r: any) => r.gravidade === "medio").length;
  const baixos = openRisks.filter((r: any) => r.gravidade === "baixo").length;

  return (
    <AppShell>
      <PageHeader
        title="Auditoria de Segurança e Privacidade"
        subtitle="Monitoramento contínuo dos controles de segurança, privacidade e proteção de dados da plataforma."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => qc.invalidateQueries()}>
              <RefreshCw className="h-4 w-4 mr-2" /> Atualizar
            </Button>
            <Button onClick={handleRun} disabled={running}>
              {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />}
              Executar auditoria agora
            </Button>
          </div>
        }
      />

      <div className="p-6 space-y-6">
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertTitle>Fase 4 — Acessos, LGPD e Relatórios</AlertTitle>
          <AlertDescription>
            Painel completo: gestão de usuários e papéis, solicitações LGPD de titulares
            com controle de prazo legal, e exportação de relatórios em CSV/PDF.
          </AlertDescription>
        </Alert>



        <Tabs defaultValue="visao">
          <TabsList className="flex flex-wrap">
            <TabsTrigger value="visao">Visão Geral</TabsTrigger>
            <TabsTrigger value="acessos">Controle de Acessos</TabsTrigger>
            <TabsTrigger value="dados">Proteção de Dados</TabsTrigger>
            <TabsTrigger value="arquivos">Segurança de Arquivos</TabsTrigger>
            <TabsTrigger value="logs">Logs e Atividades</TabsTrigger>
            <TabsTrigger value="riscos">Vulnerabilidades e Riscos</TabsTrigger>
            <TabsTrigger value="matriz">Matriz de Riscos</TabsTrigger>
            <TabsTrigger value="incidentes">Incidentes</TabsTrigger>
            <TabsTrigger value="lgpd">Privacidade e LGPD</TabsTrigger>

            <TabsTrigger value="config">Configurações</TabsTrigger>
            <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
          </TabsList>

          {/* ====== VISÃO GERAL ====== */}
          <TabsContent value="visao" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Índice de Segurança</CardTitle></CardHeader>
                <CardContent>
                  <div className={`text-4xl font-bold ${classification.color}`}>{lastAudit?.indice_seguranca ?? "—"}</div>
                  <div className={`text-xs mt-1 inline-block px-2 py-0.5 rounded ${classification.bg} ${classification.color}`}>{classification.label}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Riscos Críticos</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold text-red-700">{criticos}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Riscos Altos</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold text-orange-600">{altos}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Incidentes abertos</CardTitle></CardHeader>
                <CardContent><div className="text-3xl font-bold">{openIncidents.length}</div></CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Riscos médios</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-semibold text-amber-700">{medios}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Riscos baixos</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-semibold text-lime-700">{baixos}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Última auditoria</CardTitle></CardHeader>
                <CardContent><div className="text-sm">{fmtDate(lastAudit?.concluido_em ?? lastAudit?.iniciado_em)}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Controles verificados</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-sm">
                    {lastAudit ? `${lastAudit.checks_ok}/${lastAudit.total_checks} OK · ${lastAudit.checks_atencao} atenção · ${lastAudit.checks_critico} crítico` : "—"}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle>Verificações da última auditoria</CardTitle></CardHeader>
              <CardContent>
                {!lastAudit ? (
                  <div className="text-sm text-muted-foreground">Nenhuma auditoria executada. Clique em <b>Executar auditoria agora</b>.</div>
                ) : (
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Verificação</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Recomendação</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {(checksQ.data ?? []).map((c: any) => (
                        <TableRow key={c.id}>
                          <TableCell className="text-xs text-muted-foreground">{c.categoria}</TableCell>
                          <TableCell>
                            <div className="font-medium">{c.titulo}</div>
                            {c.descricao && <div className="text-xs text-muted-foreground">{c.descricao}</div>}
                            {c.evidencia && Object.keys(c.evidencia).length > 0 && (
                              <div className="text-xs text-muted-foreground mt-1">
                                <code>{JSON.stringify(c.evidencia)}</code>
                              </div>
                            )}
                          </TableCell>
                          <TableCell>{statusBadge(c.status)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{c.recomendacao ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Histórico de auditorias</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duração</TableHead>
                    <TableHead>OK / Aten. / Crít. / N.Verif.</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {(auditsQ.data ?? []).map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="text-xs">{fmtDate(a.iniciado_em)}</TableCell>
                        <TableCell><b>{a.indice_seguranca ?? "—"}</b></TableCell>
                        <TableCell><Badge variant="outline">{a.status}</Badge></TableCell>
                        <TableCell className="text-xs">{a.duracao_ms ? `${a.duracao_ms} ms` : "—"}</TableCell>
                        <TableCell className="text-xs">{a.checks_ok ?? 0} / {a.checks_atencao ?? 0} / {a.checks_critico ?? 0} / {a.checks_nao_verificado ?? 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ====== LOGS ====== */}
          <TabsContent value="logs" className="mt-4">
            <LogsTab />
          </TabsContent>

          {/* ====== RISCOS ====== */}
          <TabsContent value="riscos" className="mt-4">
            <RisksTab />
          </TabsContent>

          {/* ====== MATRIZ DE RISCOS ====== */}
          <TabsContent value="matriz" className="mt-4">
            <RiskMatrixTab />
          </TabsContent>

          {/* ====== INCIDENTES ====== */}
          <TabsContent value="incidentes" className="mt-4">
            <IncidentsTab />
          </TabsContent>

          {/* ====== PROTEÇÃO DE DADOS (Fase 3) ====== */}
          <TabsContent value="dados" className="mt-4">
            <DataProtectionTab />
          </TabsContent>

          {/* ====== SEGURANÇA DE ARQUIVOS (Fase 3) ====== */}
          <TabsContent value="arquivos" className="mt-4">
            <FileSecurityTab />
          </TabsContent>

          {/* ====== CONFIGURAÇÕES ====== */}
          <TabsContent value="config" className="mt-4">
            <SettingsTab settings={settingsQ.data} />
          </TabsContent>

          {/* ====== CONTROLE DE ACESSOS (Fase 4) ====== */}
          <TabsContent value="acessos" className="mt-4">
            <AccessControlTab />
          </TabsContent>

          {/* ====== LGPD (Fase 4) ====== */}
          <TabsContent value="lgpd" className="mt-4">
            <LGPDTab />
          </TabsContent>

          {/* ====== RELATÓRIOS (Fase 4) ====== */}
          <TabsContent value="relatorios" className="mt-4">
            <ReportsTab />
          </TabsContent>
        </Tabs>

      </div>
    </AppShell>
  );
}

function LogsTab() {
  const [tipo, setTipo] = useState<string>("");
  const [nivel, setNivel] = useState<string>("");
  const [resultado, setResultado] = useState<string>("");
  const [q, setQ] = useState("");

  const { data } = useQuery({
    queryKey: ["sec-events", tipo, nivel, resultado],
    queryFn: async () => {
      let query = supabase.from("security_events").select("*").order("ocorrido_em", { ascending: false }).limit(200);
      if (tipo) query = query.eq("tipo", tipo);
      if (nivel) query = query.eq("nivel_risco", nivel);
      if (resultado) query = query.eq("resultado", resultado);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(
    () => (data ?? []).filter((e: any) =>
      !q || JSON.stringify(e).toLowerCase().includes(q.toLowerCase()),
    ),
    [data, q],
  );

  return (
    <Card>
      <CardHeader><CardTitle>Log de eventos de segurança</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Input placeholder="Buscar…" value={q} onChange={(e) => setQ(e.target.value)} className="w-48" />
          <Input placeholder="Tipo (ex: auth.login)" value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-56" />
          <Select value={nivel} onValueChange={setNivel}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Nível de risco" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="critico">Crítico</SelectItem>
              <SelectItem value="alto">Alto</SelectItem>
              <SelectItem value="medio">Médio</SelectItem>
              <SelectItem value="baixo">Baixo</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
          <Select value={resultado} onValueChange={setResultado}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Resultado" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="sucesso">Sucesso</SelectItem>
              <SelectItem value="falha">Falha</SelectItem>
              <SelectItem value="bloqueado">Bloqueado</SelectItem>
              <SelectItem value="suspeito">Suspeito</SelectItem>
            </SelectContent>
          </Select>
          {(tipo || nivel || resultado) && (
            <Button variant="ghost" size="sm" onClick={() => { setTipo(""); setNivel(""); setResultado(""); }}>Limpar</Button>
          )}
        </div>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Usuário</TableHead>
            <TableHead>Ação</TableHead>
            <TableHead>Recurso</TableHead>
            <TableHead>Resultado</TableHead>
            <TableHead>Risco</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                Nenhum evento registrado ainda. Execute uma auditoria ou aguarde ações administrativas.
              </TableCell></TableRow>
            )}
            {filtered.map((e: any) => (
              <TableRow key={e.id}>
                <TableCell className="text-xs">{fmtDate(e.ocorrido_em)}</TableCell>
                <TableCell className="text-xs"><code>{e.tipo}</code></TableCell>
                <TableCell className="text-xs">{e.usuario_email ?? "—"}</TableCell>
                <TableCell className="text-xs">{e.acao ?? "—"}</TableCell>
                <TableCell className="text-xs">{e.recurso ?? "—"}</TableCell>
                <TableCell><Badge variant="outline">{e.resultado ?? "—"}</Badge></TableCell>
                <TableCell>{statusBadgeRisk(e.nivel_risco)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function statusBadgeRisk(nivel: string) {
  const cls =
    nivel === "critico" ? "bg-red-100 text-red-800"
    : nivel === "alto" ? "bg-orange-100 text-orange-800"
    : nivel === "medio" ? "bg-amber-100 text-amber-800"
    : nivel === "baixo" ? "bg-lime-100 text-lime-800"
    : "bg-slate-100 text-slate-700";
  return <span className={`px-2 py-0.5 rounded-full text-xs ${cls}`}>{nivel ?? "info"}</span>;
}

function RisksTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filterGrav, setFilterGrav] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [form, setForm] = useState<any>({
    titulo: "", descricao: "", categoria: "Autenticação", gravidade: "medio",
    probabilidade: "media", impacto: "medio", status: "identificado",
    responsavel: "", prazo: "", recomendacao: "",
  });

  const { data } = useQuery({
    queryKey: ["sec-risks"],
    queryFn: async () => (await supabase.from("security_risks").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  async function submit() {
    if (!form.titulo) return;
    const payload: any = { ...form };
    if (!payload.prazo) delete payload.prazo;
    await supabase.from("security_risks").insert(payload);
    setOpen(false);
    setForm({
      titulo: "", descricao: "", categoria: "Autenticação", gravidade: "medio",
      probabilidade: "media", impacto: "medio", status: "identificado",
      responsavel: "", prazo: "", recomendacao: "",
    });
    qc.invalidateQueries({ queryKey: ["sec-risks"] });
  }

  async function updateStatus(id: string, status: string) {
    const patch: any = { status };
    if (status === "corrigido") patch.data_correcao = new Date().toISOString();
    await supabase.from("security_risks").update(patch).eq("id", id);
    await supabase.rpc("log_security_event", {
      _tipo: "security.risk.status_changed", _acao: "update",
      _recurso: `security_risks:${id}`, _resultado: "sucesso",
      _nivel_risco: "info", _metadata: { status } as any,
    });
    qc.invalidateQueries({ queryKey: ["sec-risks"] });
  }

  const filtered = (data ?? []).filter((r: any) =>
    (!filterGrav || r.gravidade === filterGrav) &&
    (!filterStatus || r.status === filterStatus),
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Vulnerabilidades e Riscos</CardTitle>
        <Button onClick={() => setOpen(o => !o)}>{open ? "Cancelar" : "Novo risco"}</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {open && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 border rounded">
            <Input placeholder="Título" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} />
            <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Autenticação","Autorização","Banco de dados","Armazenamento","Upload de arquivos","APIs","Integrações","Privacidade","Infraestrutura","Código","Dependências","Configuração","Logs","Sessões","Segredos e credenciais","Engenharia social","Continuidade e recuperação"].map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Gravidade</label>
              <Select value={form.gravidade} onValueChange={(v) => setForm({ ...form, gravidade: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["critico","alto","medio","baixo","info"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Status</label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["identificado","em_analise","correcao_planejada","em_correcao","aguardando_validacao","corrigido","risco_aceito","nao_aplicavel"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Probabilidade</label>
              <Select value={form.probabilidade} onValueChange={(v) => setForm({ ...form, probabilidade: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["baixa","media","alta","muito_alta"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground">Impacto</label>
              <Select value={form.impacto} onValueChange={(v) => setForm({ ...form, impacto: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["baixo","medio","alto","muito_alto"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Input placeholder="Responsável" value={form.responsavel} onChange={e => setForm({ ...form, responsavel: e.target.value })} />
            <Input type="date" placeholder="Prazo" value={form.prazo} onChange={e => setForm({ ...form, prazo: e.target.value })} />
            <Input placeholder="Descrição" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} className="md:col-span-2" />
            <Input placeholder="Recomendação" value={form.recomendacao} onChange={e => setForm({ ...form, recomendacao: e.target.value })} className="md:col-span-2" />
            <div className="md:col-span-2"><Button onClick={submit}>Salvar risco</Button></div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 items-center">
          <Select value={filterGrav} onValueChange={setFilterGrav}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Gravidade" /></SelectTrigger>
            <SelectContent>{["critico","alto","medio","baixo","info"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              {["identificado","em_analise","correcao_planejada","em_correcao","aguardando_validacao","corrigido","risco_aceito","nao_aplicavel"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          {(filterGrav || filterStatus) && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterGrav(""); setFilterStatus(""); }}>Limpar</Button>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{filtered.length} de {(data ?? []).length}</span>
        </div>

        <Table>
          <TableHeader><TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Gravidade</TableHead>
            <TableHead>Prob. × Impacto</TableHead>
            <TableHead>Responsável</TableHead>
            <TableHead>Prazo</TableHead>
            <TableHead>Status</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                Nenhum risco cadastrado.
              </TableCell></TableRow>
            )}
            {filtered.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{r.titulo}</div>
                  {r.descricao && <div className="text-xs text-muted-foreground">{r.descricao}</div>}
                  {r.recomendacao && <div className="text-xs text-cyan-700 mt-1">→ {r.recomendacao}</div>}
                </TableCell>
                <TableCell className="text-xs">{r.categoria}</TableCell>
                <TableCell>{statusBadgeRisk(r.gravidade)}</TableCell>
                <TableCell className="text-xs">{r.probabilidade ?? "—"} × {r.impacto ?? "—"}</TableCell>
                <TableCell className="text-xs">{r.responsavel ?? "—"}</TableCell>
                <TableCell className="text-xs">{r.prazo ? new Date(r.prazo).toLocaleDateString("pt-BR") : "—"}</TableCell>
                <TableCell>
                  <Select value={r.status} onValueChange={(v) => updateStatus(r.id, v)}>
                    <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["identificado","em_analise","correcao_planejada","em_correcao","aguardando_validacao","corrigido","risco_aceito","nao_aplicavel"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RiskMatrixTab() {
  const { data } = useQuery({
    queryKey: ["sec-risks-matrix"],
    queryFn: async () => (await supabase.from("security_risks").select("id, titulo, probabilidade, impacto, status, gravidade").order("created_at", { ascending: false })).data ?? [],
  });

  const probs = ["muito_alta", "alta", "media", "baixa"];
  const imps = ["baixo", "medio", "alto", "muito_alto"];
  const openRisks = (data ?? []).filter((r: any) => !["corrigido","risco_aceito","nao_aplicavel"].includes(r.status));

  function cellColor(p: string, i: string) {
    const pScore = { baixa: 1, media: 2, alta: 3, muito_alta: 4 }[p] ?? 2;
    const iScore = { baixo: 1, medio: 2, alto: 3, muito_alto: 4 }[i] ?? 2;
    const s = pScore * iScore;
    if (s >= 12) return "bg-red-100 border-red-300";
    if (s >= 8) return "bg-orange-100 border-orange-300";
    if (s >= 4) return "bg-amber-100 border-amber-300";
    return "bg-lime-100 border-lime-300";
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Matriz de Riscos (Probabilidade × Impacto)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground mb-3">
            Exibe apenas riscos em aberto ({openRisks.length} de {(data ?? []).length} totais).
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="p-2 text-xs text-muted-foreground text-left">Probabilidade ↓ / Impacto →</th>
                  {imps.map(i => <th key={i} className="p-2 text-xs font-medium">{i.replace("_"," ")}</th>)}
                </tr>
              </thead>
              <tbody>
                {probs.map(p => (
                  <tr key={p}>
                    <td className="p-2 text-xs font-medium">{p.replace("_"," ")}</td>
                    {imps.map(i => {
                      const cells = openRisks.filter((r: any) => r.probabilidade === p && r.impacto === i);
                      return (
                        <td key={i} className={`border p-2 align-top min-w-32 ${cellColor(p, i)}`}>
                          {cells.length === 0 ? (
                            <div className="text-xs text-muted-foreground">—</div>
                          ) : (
                            <div className="space-y-1">
                              {cells.map((r: any) => (
                                <div key={r.id} className="text-xs bg-white/70 rounded px-1.5 py-0.5 border border-white">
                                  {r.titulo}
                                </div>
                              ))}
                              <div className="text-[10px] text-muted-foreground">{cells.length} risco(s)</div>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-lime-100 border border-lime-300">Baixo</span>
            <span className="px-2 py-0.5 rounded bg-amber-100 border border-amber-300">Moderado</span>
            <span className="px-2 py-0.5 rounded bg-orange-100 border border-orange-300">Alto</span>
            <span className="px-2 py-0.5 rounded bg-red-100 border border-red-300">Crítico</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


function IncidentsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [form, setForm] = useState<any>({ titulo: "", descricao: "", gravidade: "medio", status: "detectado", categoria: "" });


  const { data } = useQuery({
    queryKey: ["sec-incidents"],
    queryFn: async () => (await supabase.from("security_incidents").select("*").order("ocorrido_em", { ascending: false })).data ?? [],
  });

  async function submit() {
    if (!form.titulo) return;
    await supabase.from("security_incidents").insert({
      ...form,
      timeline: [{ ts: new Date().toISOString(), texto: "Incidente registrado" }] as any,
    });
    setOpen(false);
    setForm({ titulo: "", descricao: "", gravidade: "medio", status: "detectado", categoria: "" });
    qc.invalidateQueries({ queryKey: ["sec-incidents"] });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Incidentes de Segurança</CardTitle>
        <Button onClick={() => setOpen(o => !o)}>{open ? "Cancelar" : "Novo incidente"}</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {open && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 border rounded">
            <Input placeholder="Título" value={form.titulo} onChange={e => setForm({ ...form, titulo: e.target.value })} />
            <Input placeholder="Categoria" value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })} />
            <Select value={form.gravidade} onValueChange={(v) => setForm({ ...form, gravidade: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["critico","alto","medio","baixo","info"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["detectado","em_investigacao","contido","em_correcao","em_monitoramento","encerrado"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Descrição" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} className="md:col-span-2" />
            <div className="md:col-span-2"><Button onClick={submit}>Registrar incidente</Button></div>
          </div>
        )}

        <Table>
          <TableHeader><TableRow>
            <TableHead>#</TableHead>
            <TableHead>Título</TableHead>
            <TableHead>Gravidade</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Ocorrido em</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                Nenhum incidente registrado.
              </TableCell></TableRow>
            )}
            {(data ?? []).map((i: any) => (
              <TableRow key={i.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(i)}>
                <TableCell className="text-xs">#{i.numero}</TableCell>
                <TableCell>
                  <div className="font-medium">{i.titulo}</div>
                  {i.descricao && <div className="text-xs text-muted-foreground">{i.descricao}</div>}
                </TableCell>
                <TableCell>{statusBadgeRisk(i.gravidade)}</TableCell>
                <TableCell><Badge variant="outline">{i.status}</Badge></TableCell>
                <TableCell className="text-xs">{fmtDate(i.ocorrido_em)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {selected && (
          <IncidentDetailDialog
            incident={selected}
            onClose={() => setSelected(null)}
            onChanged={() => qc.invalidateQueries({ queryKey: ["sec-incidents"] })}
          />
        )}
      </CardContent>
    </Card>
  );
}

function IncidentDetailDialog({ incident, onClose, onChanged }: { incident: any; onClose: () => void; onChanged: () => void }) {
  const [entry, setEntry] = useState("");
  const [status, setStatus] = useState<string>(incident.status);
  const [saving, setSaving] = useState(false);
  const timeline: any[] = Array.isArray(incident.timeline) ? incident.timeline : [];

  async function addEntry() {
    if (!entry.trim()) return;
    setSaving(true);
    const next = [...timeline, { ts: new Date().toISOString(), texto: entry.trim() }];
    await supabase.from("security_incidents").update({ timeline: next as any }).eq("id", incident.id);
    setEntry("");
    setSaving(false);
    onChanged();
    incident.timeline = next;
  }

  async function changeStatus(v: string) {
    setStatus(v);
    const next = [...timeline, { ts: new Date().toISOString(), texto: `Status alterado para: ${v}` }];
    await supabase.from("security_incidents").update({ status: v, timeline: next as any }).eq("id", incident.id);
    await supabase.rpc("log_security_event", {
      _tipo: "security.incident.status_changed", _acao: "update",
      _recurso: `security_incidents:${incident.id}`, _resultado: "sucesso",
      _nivel_risco: "medio", _metadata: { status: v } as any,
    });
    onChanged();
    incident.timeline = next;
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-background rounded-lg shadow-lg max-w-2xl w-full max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">Incidente #{incident.numero}</div>
            <div className="text-lg font-semibold">{incident.titulo}</div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>Fechar</Button>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div><span className="text-muted-foreground">Gravidade:</span> {statusBadgeRisk(incident.gravidade)}</div>
            <div>
              <span className="text-muted-foreground text-xs">Status:</span>
              <Select value={status} onValueChange={changeStatus}>
                <SelectTrigger className="w-full h-8 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{["detectado","em_investigacao","contido","em_correcao","em_monitoramento","encerrado"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><span className="text-muted-foreground">Categoria:</span> {incident.categoria ?? "—"}</div>
            <div><span className="text-muted-foreground">Ocorrido em:</span> {fmtDate(incident.ocorrido_em)}</div>
          </div>
          {incident.descricao && (
            <div className="text-sm">
              <div className="text-xs text-muted-foreground mb-1">Descrição</div>
              <div>{incident.descricao}</div>
            </div>
          )}
          <div>
            <div className="text-sm font-medium mb-2">Timeline</div>
            <div className="space-y-2">
              {timeline.length === 0 && <div className="text-xs text-muted-foreground">Sem entradas.</div>}
              {timeline.map((t: any, idx: number) => (
                <div key={idx} className="border-l-2 border-cyan-500 pl-3 py-1">
                  <div className="text-[11px] text-muted-foreground">{fmtDate(t.ts)}</div>
                  <div className="text-sm">{t.texto}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Input placeholder="Adicionar entrada na timeline…" value={entry} onChange={(e) => setEntry(e.target.value)} />
            <Button onClick={addEntry} disabled={saving || !entry.trim()}>Adicionar</Button>
          </div>
        </div>
      </div>
    </div>
  );
}


function SettingsTab({ settings }: { settings: any }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<any>(null);
  const state = form ?? settings ?? {};

  async function save() {
    if (!settings?.id) return;
    await supabase.from("security_settings").update({
      session_timeout_minutes: Number(state.session_timeout_minutes),
      max_upload_mb: Number(state.max_upload_mb),
      link_expiration_seconds: Number(state.link_expiration_seconds),
      retention_days: Number(state.retention_days),
      max_login_attempts: Number(state.max_login_attempts),
      mfa_required_admin: !!state.mfa_required_admin,
      min_password_length: Number(state.min_password_length),
      log_retention_days: Number(state.log_retention_days),
    }).eq("id", settings.id);
    await supabase.rpc("log_security_event", {
      _tipo: "security.settings.updated",
      _acao: "update",
      _recurso: `security_settings:${settings.id}`,
      _resultado: "sucesso",
      _nivel_risco: "medio",
      _metadata: state as any,
    });
    setForm(null);
    qc.invalidateQueries({ queryKey: ["sec-settings"] });
  }

  if (!settings) {
    return <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Carregando…</CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader><CardTitle>Configurações de Segurança</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {[
          { key: "session_timeout_minutes", label: "Expiração de sessão (min)" },
          { key: "max_upload_mb", label: "Tamanho máximo de upload (MB)" },
          { key: "link_expiration_seconds", label: "Expiração de links (s)" },
          { key: "retention_days", label: "Retenção de dados (dias)" },
          { key: "max_login_attempts", label: "Máx. tentativas de login" },
          { key: "min_password_length", label: "Tamanho mínimo de senha" },
          { key: "log_retention_days", label: "Retenção de logs (dias)" },
        ].map(f => (
          <div key={f.key} className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">{f.label}</label>
            <Input
              type="number"
              value={state[f.key] ?? 0}
              onChange={(e) => setForm({ ...state, [f.key]: e.target.value })}
            />
          </div>
        ))}
        <label className="flex items-center gap-2 md:col-span-2">
          <input
            type="checkbox"
            checked={!!state.mfa_required_admin}
            onChange={(e) => setForm({ ...state, mfa_required_admin: e.target.checked })}
          />
          <span className="text-sm">Exigir autenticação multifator (MFA) para administradores</span>
        </label>
        <div className="md:col-span-2 flex gap-2">
          <Button onClick={save}>Salvar</Button>
          {form && <Button variant="ghost" onClick={() => setForm(null)}>Descartar</Button>}
        </div>
      </CardContent>
    </Card>
  );
}
