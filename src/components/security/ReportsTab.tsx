import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, FileSpreadsheet, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Kind = "audits" | "risks" | "incidents" | "events" | "privacy" | "classifications";

const KIND_LABEL: Record<Kind, string> = {
  audits: "Auditorias de segurança",
  risks: "Vulnerabilidades e riscos",
  incidents: "Incidentes",
  events: "Log de eventos (últimos 500)",
  privacy: "Solicitações LGPD",
  classifications: "Classificação de dados",
};

function toCSV(rows: any[]): string {
  if (!rows || rows.length === 0) return "";
  const keys = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
  const esc = (v: any) => {
    if (v == null) return "";
    if (typeof v === "object") v = JSON.stringify(v);
    const s = String(v).replace(/"/g, '""');
    return /[",\n;]/.test(s) ? `"${s}"` : s;
  };
  return [keys.join(";"), ...rows.map(r => keys.map(k => esc(r[k])).join(";"))].join("\n");
}

function download(name: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  URL.revokeObjectURL(url);
}

async function fetchData(kind: Kind): Promise<any[]> {
  switch (kind) {
    case "audits": return (await supabase.from("security_audits").select("*").order("iniciado_em", { ascending: false })).data ?? [];
    case "risks": return (await supabase.from("security_risks").select("*").order("created_at", { ascending: false })).data ?? [];
    case "incidents": return (await supabase.from("security_incidents").select("*").order("ocorrido_em", { ascending: false })).data ?? [];
    case "events": return (await supabase.from("security_events").select("*").order("created_at", { ascending: false }).limit(500)).data ?? [];
    case "privacy": return (await supabase.from("privacy_requests").select("*").order("created_at", { ascending: false })).data ?? [];
    case "classifications": return (await supabase.from("data_classifications").select("*").order("dominio")).data ?? [];
  }
}

export function ReportsTab() {
  const [kind, setKind] = useState<Kind>("audits");
  const [generating, setGenerating] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);

  async function runAndEmailAudit() {
    setSendingEmail(true);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
      const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
      const res = await fetch("/api/public/hooks/weekly-security-audit", {
        method: "POST",
        headers: { "content-type": "application/json", apikey: anon },
      });
      void url;
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error || json?.enqueue_error || `HTTP ${res.status}`);
      }
      toast.success(`Auditoria executada (índice ${json.score}/100). E-mail enfileirado para felipe@poolbranding.com.br.`);
      lastAuditQ.refetch();
    } catch (e: any) {
      toast.error(`Falha ao gerar relatório: ${e?.message ?? String(e)}`);
    } finally {
      setSendingEmail(false);
    }
  }

  const lastAuditQ = useQuery({
    queryKey: ["sec-audits-last"],
    queryFn: async () => (await supabase.from("security_audits").select("*").order("iniciado_em", { ascending: false }).limit(1).maybeSingle()).data,
  });
  const risksCountQ = useQuery({
    queryKey: ["sec-risks-count"],
    queryFn: async () => (await supabase.from("security_risks").select("id", { count: "exact", head: true })).count ?? 0,
  });
  const incidentsCountQ = useQuery({
    queryKey: ["sec-incidents-count"],
    queryFn: async () => (await supabase.from("security_incidents").select("id", { count: "exact", head: true })).count ?? 0,
  });
  const privacyCountQ = useQuery({
    queryKey: ["privacy-count"],
    queryFn: async () => (await supabase.from("privacy_requests").select("id", { count: "exact", head: true })).count ?? 0,
  });

  async function exportCSV() {
    setGenerating(true);
    try {
      const rows = await fetchData(kind);
      const stamp = new Date().toISOString().slice(0, 10);
      download(`${kind}-${stamp}.csv`, "text/csv;charset=utf-8", toCSV(rows));
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function exportPDF() {
    setGenerating(true);
    try {
      const rows = await fetchData(kind);
      const stamp = new Date().toLocaleString("pt-BR");
      const html = `<!doctype html><html><head><meta charset="utf-8">
<title>${KIND_LABEL[kind]}</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { color: #666; font-size: 12px; margin-bottom: 16px; }
  table { border-collapse: collapse; width: 100%; font-size: 11px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f4f4f5; }
  tr:nth-child(even) td { background: #fafafa; }
  @media print { body { padding: 12px; } }
</style></head><body>
<h1>${KIND_LABEL[kind]}</h1>
<div class="meta">Gerado em ${stamp} • ${rows.length} registro(s)</div>
${rows.length === 0 ? "<p>Sem registros.</p>" : (() => {
  const keys = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
  return `<table><thead><tr>${keys.map(k => `<th>${k}</th>`).join("")}</tr></thead><tbody>
${rows.map(r => `<tr>${keys.map(k => {
  let v = r[k]; if (v == null) v = "";
  if (typeof v === "object") v = JSON.stringify(v);
  return `<td>${String(v).replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!))}</td>`;
}).join("")}</tr>`).join("")}
</tbody></table>`;
})()}
<script>window.onload=()=>{setTimeout(()=>window.print(),300)}</script>
</body></html>`;
      const w = window.open("", "_blank");
      if (!w) return alert("Bloqueado pelo navegador. Permita pop-ups.");
      w.document.write(html); w.document.close();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setGenerating(false);
    }
  }

  async function exportAllPDF() {
    setGenerating(true);
    try {
      const kinds = Object.keys(KIND_LABEL) as Kind[];
      const datasets = await Promise.all(kinds.map(async k => ({ kind: k, rows: await fetchData(k) })));
      const stamp = new Date().toLocaleString("pt-BR");
      const escHtml = (s: string) => s.replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
      const sections = datasets.map(({ kind: k, rows }) => `
<section class="section">
  <h2>${KIND_LABEL[k]}</h2>
  <div class="meta">${rows.length} registro(s)</div>
  ${rows.length === 0 ? "<p class='empty'>Sem registros.</p>" : (() => {
    const keys = Array.from(new Set(rows.flatMap(r => Object.keys(r))));
    return `<table><thead><tr>${keys.map(kk => `<th>${escHtml(kk)}</th>`).join("")}</tr></thead><tbody>
${rows.map(r => `<tr>${keys.map(kk => {
  let v = r[kk]; if (v == null) v = "";
  if (typeof v === "object") v = JSON.stringify(v);
  return `<td>${escHtml(String(v))}</td>`;
}).join("")}</tr>`).join("")}
</tbody></table>`;
  })()}
</section>`).join("");
      const totals = datasets.map(d => `<li><strong>${KIND_LABEL[d.kind]}:</strong> ${d.rows.length}</li>`).join("");
      const html = `<!doctype html><html><head><meta charset="utf-8">
<title>Relatório Consolidado de Segurança</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; padding: 24px; color: #111; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 0 0 6px; color: #0f172a; }
  .meta { color: #666; font-size: 12px; margin-bottom: 12px; }
  .section { margin-bottom: 28px; page-break-inside: avoid; }
  .section + .section { page-break-before: always; }
  table { border-collapse: collapse; width: 100%; font-size: 10px; table-layout: fixed; word-break: break-word; }
  th, td { border: 1px solid #ddd; padding: 5px 6px; text-align: left; vertical-align: top; }
  th { background: #f4f4f5; }
  tr:nth-child(even) td { background: #fafafa; }
  ul { font-size: 12px; }
  .empty { color: #888; font-style: italic; }
  @media print { body { padding: 12px; } }
</style></head><body>
<h1>Relatório Consolidado de Segurança e Privacidade</h1>
<div class="meta">Gerado em ${stamp}</div>
<section class="section">
  <h2>Sumário</h2>
  <ul>${totals}</ul>
</section>
${sections}
<script>window.onload=()=>{setTimeout(()=>window.print(),400)}</script>
</body></html>`;
      const w = window.open("", "_blank");
      if (!w) return alert("Bloqueado pelo navegador. Permita pop-ups.");
      w.document.write(html); w.document.close();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setGenerating(false);
    }
  }

  const idx = lastAuditQ.data?.indice_seguranca;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Índice atual</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{idx ?? "—"}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Riscos registrados</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{risksCountQ.data ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Incidentes</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{incidentsCountQ.data ?? 0}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Solicitações LGPD</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{privacyCountQ.data ?? 0}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Mail className="h-4 w-4" /> Auditoria semanal por e-mail</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="text-sm text-muted-foreground">
            Executa a auditoria completa agora, salva no histórico e envia o resumo para <span className="font-medium text-foreground">felipe@poolbranding.com.br</span>.
            <div className="text-xs mt-1">Envio automático toda segunda-feira às 08:00 (BRT).</div>
          </div>
          <Button onClick={runAndEmailAudit} disabled={sendingEmail}>
            {sendingEmail ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
            Gerar e enviar relatório
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> Gerar relatório</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="text-sm font-medium mb-1 block">Tipo de relatório</label>
              <Select value={kind} onValueChange={v => setKind(v as Kind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(KIND_LABEL) as Kind[]).map(k => (
                    <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={exportCSV} disabled={generating} variant="outline" className="flex-1">
                <FileSpreadsheet className="h-4 w-4 mr-2" /> CSV
              </Button>
              <Button onClick={exportPDF} disabled={generating} className="flex-1">
                <Download className="h-4 w-4 mr-2" /> PDF
              </Button>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            O PDF abre em nova aba usando a impressão do navegador. Escolha "Salvar como PDF" no destino.
          </div>
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
            <div className="text-xs text-muted-foreground">
              O PDF abre em nova aba usando a impressão do navegador. Escolha "Salvar como PDF" no destino.
            </div>
            <Button onClick={exportAllPDF} disabled={generating} variant="secondary">
              <Download className="h-4 w-4 mr-2" /> Baixar PDF com todos os resultados
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
