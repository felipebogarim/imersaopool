import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ShieldCheck, ShieldAlert, Bug, Activity, Loader2, MoreVertical, ScrollText } from "lucide-react";

type LogEntry = { id: string; quando: string | null; titulo: string; detalhe?: string | null; nivel?: string | null };

type Tone = "ok" | "warn" | "bad";

const TONE: Record<Tone, { stroke: string; text: string; chip: string; label: string }> = {
  ok: { stroke: "#059669", text: "text-emerald-700", chip: "bg-emerald-100 text-emerald-800", label: "Sob controle" },
  warn: { stroke: "#d97706", text: "text-amber-700", chip: "bg-amber-100 text-amber-800", label: "Atenção" },
  bad: { stroke: "#dc2626", text: "text-red-700", chip: "bg-red-100 text-red-800", label: "Crítico" },
};

/** Gauge semicircular (0..1 do arco preenchido). */
function Gauge({
  value,
  ratio,
  tone,
  caption,
  suffix,
}: {
  value: number;
  ratio: number;
  tone: Tone;
  caption: string;
  suffix?: string;
}) {
  const r = 78;
  const cx = 100;
  const cy = 96;
  const circ = Math.PI * r;
  const clamped = Math.max(0, Math.min(1, ratio));
  const t = TONE[tone];

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 118" className="w-full max-w-[240px]">
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="currentColor"
          className="text-muted"
          strokeWidth={16}
          strokeLinecap="round"
        />
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={t.stroke}
          strokeWidth={16}
          strokeLinecap="round"
          strokeDasharray={`${circ * clamped} ${circ}`}
        />
        <text x={cx} y={cy - 16} textAnchor="middle" fontSize="38" fontWeight="800" fill={t.stroke}>
          {value}
        </text>
        {suffix ? (
          <text x={cx} y={cy + 6} textAnchor="middle" fontSize="11" fill="#6b7280">
            {suffix}
          </text>
        ) : null}
      </svg>
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.chip}`}>{t.label}</span>
      <p className="text-xs text-muted-foreground text-center mt-2">{caption}</p>
    </div>
  );
}

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("pt-BR") : "—");

function LogsKebab({ count, onOpen }: { count: number; onOpen: () => void }) {
  if (count <= 0) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="h-7 w-7">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onOpen}>
          <ScrollText className="h-4 w-4 mr-2" /> Ver logs ({count})
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LogsDialog({
  open,
  onOpenChange,
  title,
  entries,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  entries: LogEntry[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto -mx-2 px-2">
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Nenhum evento registrado.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground text-left">
                  <th className="py-2 pr-3 font-medium">Quando</th>
                  <th className="py-2 pr-3 font-medium">Evento</th>
                  <th className="py-2 pr-3 font-medium">Detalhe</th>
                  <th className="py-2 font-medium">Nível</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-t border-border/60 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{fmt(e.quando)}</td>
                    <td className="py-2 pr-3 font-medium">{e.titulo}</td>
                    <td className="py-2 pr-3 text-muted-foreground break-words">{e.detalhe ?? "—"}</td>
                    <td className="py-2 whitespace-nowrap">{e.nivel ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SecurityBITab() {
  const since = useMemo(() => new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(), []);
  const [logs, setLogs] = useState<{ title: string; entries: LogEntry[] } | null>(null);


  const eventsQ = useQuery({
    queryKey: ["sec-bi-events", since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_events")
        .select("id, tipo, categoria, resultado, nivel_risco, ocorrido_em, usuario_email")
        .gte("ocorrido_em", since)
        .order("ocorrido_em", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const incidentsQ = useQuery({
    queryKey: ["sec-bi-incidents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_incidents")
        .select("id, titulo, categoria, gravidade, status, dados_afetados, ocorrido_em");
      if (error) throw error;
      return data ?? [];
    },
  });

  const risksQ = useQuery({
    queryKey: ["sec-bi-risks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_risks")
        .select("id, titulo, gravidade, status");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filesQ = useQuery({
    queryKey: ["sec-bi-files", since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("file_security_events")
        .select("id, evento, nivel_risco, created_at")
        .gte("created_at", since)
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const loading = eventsQ.isLoading || incidentsQ.isLoading || risksQ.isLoading || filesQ.isLoading;

  const events = eventsQ.data ?? [];
  const incidents = incidentsQ.data ?? [];
  const risks = risksQ.data ?? [];
  const files = filesQ.data ?? [];

  // ---- 1) Vazamento de dados sensíveis (ideal = 0) ----
  const leakIncidents = incidents.filter((i: any) => {
    const txt = `${i.categoria ?? ""} ${i.titulo ?? ""}`.toLowerCase();
    return txt.includes("vazam") || txt.includes("leak") || txt.includes("exposi") || !!i.dados_afetados;
  });
  const leakEvents = events.filter(
    (e: any) =>
      (e.categoria === "dados_sensiveis" || String(e.tipo ?? "").startsWith("data.")) &&
      ["falha", "bloqueado", "suspeito"].includes(e.resultado),
  );
  const leakFiles = files.filter((f: any) => f.nivel_risco === "critico");
  const leaks = leakIncidents.length + leakEvents.length + leakFiles.length;
  const leakTone: Tone = leaks === 0 ? "ok" : leaks <= 2 ? "warn" : "bad";

  // ---- 2) Tentativas de invasão — separadas por natureza (30 dias) ----
  const authFailures = events.filter((e: any) => e.resultado === "falha");
  const blocked = events.filter((e: any) => e.resultado === "bloqueado" || e.resultado === "suspeito");
  const highRisk = events.filter((e: any) => ["alto", "critico"].includes(e.nivel_risco));
  const intrusions = events.filter(
    (e: any) => ["falha", "bloqueado", "suspeito"].includes(e.resultado) || ["alto", "critico"].includes(e.nivel_risco),
  );
  const intrusionCritical = highRisk.length;
  const toneFor = (n: number, warnAt: number, badAt: number): Tone => (n === 0 ? "ok" : n < badAt ? "warn" : "bad");
  const authTone = toneFor(authFailures.length, 1, 10);
  const blockedTone = toneFor(blocked.length, 1, 5);
  const riskEventTone: Tone = highRisk.length === 0 ? "ok" : "bad";


  // ---- 3) Riscos de segurança em aberto ----
  const openRisks = risks.filter((r: any) => !["corrigido", "risco_aceito", "nao_aplicavel"].includes(r.status));
  const byGrav = (g: string) => openRisks.filter((r: any) => r.gravidade === g).length;
  const gCrit = byGrav("critico");
  const gAlto = byGrav("alto");
  const gMedio = byGrav("medio");
  const gBaixo = byGrav("baixo");
  const riskScore = gCrit * 4 + gAlto * 3 + gMedio * 2 + gBaixo;
  const riskTone: Tone = gCrit > 0 ? "bad" : gAlto > 0 || openRisks.length > 5 ? "warn" : openRisks.length === 0 ? "ok" : "warn";

  // ---- Logs por card ----
  const evLog = (e: any): LogEntry => ({
    id: `ev-${e.id}`,
    quando: e.ocorrido_em,
    titulo: e.tipo ?? e.categoria ?? "Evento",
    detalhe: [e.usuario_email, e.resultado].filter(Boolean).join(" • "),
    nivel: e.nivel_risco,
  });
  const leakLogs: LogEntry[] = [
    ...leakIncidents.map((i: any) => ({
      id: `inc-${i.id}`,
      quando: i.ocorrido_em,
      titulo: i.titulo ?? "Incidente",
      detalhe: [i.categoria, i.status].filter(Boolean).join(" • "),
      nivel: i.gravidade,
    })),
    ...leakEvents.map(evLog),
    ...leakFiles.map((f: any) => ({
      id: `file-${f.id}`,
      quando: f.created_at,
      titulo: f.evento ?? "Evento de arquivo",
      detalhe: null,
      nivel: f.nivel_risco,
    })),
  ].sort((a, b) => String(b.quando ?? "").localeCompare(String(a.quando ?? "")));
  const authLogs = authFailures.map(evLog);
  const blockedLogs = blocked.map(evLog);
  const highRiskLogs = highRisk.map(evLog);
  const riskLogs: LogEntry[] = openRisks.map((r: any) => ({
    id: `risk-${r.id}`,
    quando: null,
    titulo: r.titulo ?? "Risco",
    detalhe: r.status,
    nivel: r.gravidade,
  }));

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground p-6">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando indicadores de segurança…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {leaks > 0 && (
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertTitle>Alerta de vazamento de dados sensíveis</AlertTitle>
          <AlertDescription>
            Foram identificados <b>{leaks}</b> registro(s) relacionados a exposição de dados sensíveis. O valor
            esperado é <b>zero</b> — investigue nas abas Incidentes, Dados Sensíveis e Segurança de Arquivos.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" /> Vazamento de dados sensíveis
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <Gauge
              value={leaks}
              ratio={leaks === 0 ? 0.02 : Math.min(1, leaks / 10)}
              tone={leakTone}
              suffix="ocorrências"
              caption="Meta: 0. Soma de incidentes de vazamento, acessos negados a dados sensíveis e eventos críticos de arquivos (30 dias)."
            />
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
              <div><div className="font-semibold">{leakIncidents.length}</div><div className="text-muted-foreground">Incidentes</div></div>
              <div><div className="font-semibold">{leakEvents.length}</div><div className="text-muted-foreground">Acessos</div></div>
              <div><div className="font-semibold">{leakFiles.length}</div><div className="text-muted-foreground">Arquivos</div></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bug className="h-4 w-4" /> Falhas de autenticação
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <Gauge
              value={authFailures.length}
              ratio={authFailures.length === 0 ? 0.02 : Math.min(1, authFailures.length / 20)}
              tone={authTone}
              suffix="últimos 30 dias"
              caption="Tentativas de login malsucedidas registradas no período."
            />
            <div className="mt-3 text-center text-xs">
              <div className="font-semibold">
                {new Set(authFailures.map((e: any) => e.usuario_email ?? "—")).size}
              </div>
              <div className="text-muted-foreground">Origens distintas</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bug className="h-4 w-4" /> Acessos bloqueados
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <Gauge
              value={blocked.length}
              ratio={blocked.length === 0 ? 0.02 : Math.min(1, blocked.length / 10)}
              tone={blockedTone}
              suffix="últimos 30 dias"
              caption="Acessos negados ou marcados como suspeitos pelo controle de permissões."
            />
            <div className="mt-3 text-center text-xs">
              <div className="font-semibold">
                {new Set(blocked.map((e: any) => e.usuario_email ?? "—")).size}
              </div>
              <div className="text-muted-foreground">Origens distintas</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-0">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bug className="h-4 w-4" /> Eventos de risco alto/crítico
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <Gauge
              value={highRisk.length}
              ratio={highRisk.length === 0 ? 0.02 : Math.min(1, highRisk.length / 5)}
              tone={riskEventTone}
              suffix="últimos 30 dias"
              caption="Meta: 0. Eventos classificados com nível de risco alto ou crítico."
            />
            <div className="mt-3 text-center text-xs">
              <div className="font-semibold">
                {new Set(highRisk.map((e: any) => e.usuario_email ?? "—")).size}
              </div>
              <div className="text-muted-foreground">Origens distintas</div>
            </div>
          </CardContent>
        </Card>


        <Card>
          <CardHeader className="pb-0 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" /> Riscos de segurança
            </CardTitle>
            <LogsKebab count={riskLogs.length} onOpen={() => setLogs({ title: "Riscos de segurança em aberto", entries: riskLogs })} />
          </CardHeader>

          <CardContent className="pt-2">
            <Gauge
              value={openRisks.length}
              ratio={openRisks.length === 0 ? 0.02 : Math.min(1, riskScore / 30)}
              tone={riskTone}
              suffix="riscos em aberto"
              caption="Riscos ainda não corrigidos, ponderados por gravidade (crítico ×4, alto ×3, médio ×2, baixo ×1)."
            />
            <div className="mt-3 grid grid-cols-4 gap-1 text-center text-xs">
              <div><div className="font-semibold text-red-700">{gCrit}</div><div className="text-muted-foreground">Crít.</div></div>
              <div><div className="font-semibold text-orange-600">{gAlto}</div><div className="text-muted-foreground">Alto</div></div>
              <div><div className="font-semibold text-amber-700">{gMedio}</div><div className="text-muted-foreground">Médio</div></div>
              <div><div className="font-semibold text-lime-700">{gBaixo}</div><div className="text-muted-foreground">Baixo</div></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {leaks === 0 && intrusions.length === 0 && openRisks.length === 0 && (
        <Alert>
          <ShieldCheck className="h-4 w-4" />
          <AlertTitle>Nenhum evento crítico no período</AlertTitle>
          <AlertDescription>
            Sem vazamentos, tentativas de invasão ou riscos em aberto nos últimos 30 dias.
          </AlertDescription>
        </Alert>
      )}

      <LogsDialog
        open={!!logs}
        onOpenChange={(v) => !v && setLogs(null)}
        title={logs?.title ?? ""}
        entries={logs?.entries ?? []}
      />
    </div>
  );
}

