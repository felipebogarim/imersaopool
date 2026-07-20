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
  Shield, ShieldAlert, ShieldCheck, ShieldQuestion, PlayCircle, RefreshCw, Loader2,
  Activity, AlertTriangle, CheckCircle2, HelpCircle, XCircle, ClipboardList,
} from "lucide-react";

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
          <AlertTitle>Fase 1 — Fundação</AlertTitle>
          <AlertDescription>
            Esta versão traz Visão Geral, Logs, Riscos, Incidentes e Configurações com verificações automáticas reais.
            Itens que dependem de análise manual são exibidos como <b>Não verificado</b>. Nenhum indicador é preenchido manualmente.
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

          {/* ====== INCIDENTES ====== */}
          <TabsContent value="incidentes" className="mt-4">
            <IncidentsTab />
          </TabsContent>

          {/* ====== CONFIGURAÇÕES ====== */}
          <TabsContent value="config" className="mt-4">
            <SettingsTab settings={settingsQ.data} />
          </TabsContent>

          {/* ===== ABAS PLACEHOLDER (Fases seguintes) ===== */}
          {["acessos", "dados", "arquivos", "lgpd", "relatorios"].map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-4">
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  Módulo previsto para as próximas fases da Auditoria de Segurança e Privacidade.
                </CardContent>
              </Card>
            </TabsContent>
          ))}
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
  const [form, setForm] = useState<any>({
    titulo: "", descricao: "", categoria: "Autenticação", gravidade: "medio", status: "identificado",
  });

  const { data } = useQuery({
    queryKey: ["sec-risks"],
    queryFn: async () => (await supabase.from("security_risks").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  async function submit() {
    if (!form.titulo) return;
    await supabase.from("security_risks").insert(form);
    setOpen(false);
    setForm({ titulo: "", descricao: "", categoria: "Autenticação", gravidade: "medio", status: "identificado" });
    qc.invalidateQueries({ queryKey: ["sec-risks"] });
  }

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
            <Select value={form.gravidade} onValueChange={(v) => setForm({ ...form, gravidade: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["critico","alto","medio","baixo","info"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["identificado","em_analise","correcao_planejada","em_correcao","aguardando_validacao","corrigido","risco_aceito","nao_aplicavel"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Descrição" value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} className="md:col-span-2" />
            <div className="md:col-span-2"><Button onClick={submit}>Salvar risco</Button></div>
          </div>
        )}

        <Table>
          <TableHeader><TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Gravidade</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Identificado</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {(data ?? []).length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-6">
                Nenhum risco cadastrado.
              </TableCell></TableRow>
            )}
            {(data ?? []).map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>
                  <div className="font-medium">{r.titulo}</div>
                  {r.descricao && <div className="text-xs text-muted-foreground">{r.descricao}</div>}
                </TableCell>
                <TableCell className="text-xs">{r.categoria}</TableCell>
                <TableCell>{statusBadgeRisk(r.gravidade)}</TableCell>
                <TableCell><Badge variant="outline">{r.status}</Badge></TableCell>
                <TableCell className="text-xs">{fmtDate(r.data_identificacao)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function IncidentsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
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
              <TableRow key={i.id}>
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
      </CardContent>
    </Card>
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
