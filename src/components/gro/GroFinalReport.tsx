/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { CheckCircle2, FileText, Printer, ShieldCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, REPORT_STATUS } from "@/lib/gro-nr1";

const db = supabase as any;
const SECTIONS = [
  ["documentation", "Documentação analisada"],
  ["certificates_cat", "Atestados e CAT"],
  ["pgr_aet", "PGR e AET"],
  ["existing_practices", "Boas práticas existentes"],
  ["questionnaires", "Resultados agregados dos questionários"],
  ["field_observations", "Observações de campo validadas"],
  ["technical_analysis", "Análise técnica"],
  ["recommendations", "Recomendações"],
] as const;

export function GroFinalReport({ context, periodId, data, isConsultant, period }: any) {
  const qc = useQueryClient();
  const report = [...data.reports].sort((a: any, b: any) => b.version - a.version)[0];
  const [content, setContent] = useState<Record<string, string>>({});
  const [risk, setRisk] = useState({ title: "", description: "", classification: "" });
  useEffect(() => setContent(report?.content ?? {}), [report?.content, report?.id]);

  async function createReport() {
    const version = Math.max(0, ...data.reports.map((item: any) => item.version)) + 1;
    const { error } = await db.from("gro_final_reports").insert({
      company_id: context.companyId,
      period_id: periodId,
      version,
      status: "draft",
      technical_owner_id: context.userId,
      content: Object.fromEntries(SECTIONS.map(([key]) => [key, ""])),
    });
    if (error) return toast.error(error.message);
    await refresh();
    toast.success("Rascunho criado para revisão humana");
  }

  async function saveContent() {
    const { error } = await db.from("gro_final_reports").update({ content }).eq("id", report.id);
    if (error) return toast.error(error.message);
    await refresh();
    toast.success("Conteúdo técnico salvo");
  }

  async function transition(status: string) {
    const payload: any = { status };
    if (status === "validated") {
      payload.validated_at = new Date().toISOString();
      payload.validated_by = context.userId;
    }
    const { error } = await db.from("gro_final_reports").update(payload).eq("id", report.id);
    if (error) return toast.error(error.message);
    if (status === "published")
      await db.from("gro_risks").update({ is_published: true }).eq("report_id", report.id);
    await refresh();
    toast.success(`Relatório: ${REPORT_STATUS[status]}`);
  }

  async function addRisk() {
    if (!risk.title) return;
    const { error } = await db.from("gro_risks").insert({
      company_id: context.companyId,
      period_id: periodId,
      report_id: report.id,
      ...risk,
    });
    if (error) return toast.error(error.message);
    setRisk({ title: "", description: "", classification: "" });
    await refresh();
  }

  async function refresh() {
    await qc.invalidateQueries({ queryKey: ["gro-workspace"] });
  }

  function printReport() {
    const body = SECTIONS.map(
      ([key, label]) =>
        `<section><h2>${label}</h2><p>${escapeHtml(content[key] ?? "—")}</p></section>`,
    ).join("");
    const win = window.open("", "_blank");
    if (!win) return toast.error("Permita pop-ups para imprimir");
    win.document.write(
      `<!doctype html><html><head><title>Relatório GRO NR1</title><style>body{font:14px Arial;max-width:850px;margin:40px auto;color:#16333b}h1{border-bottom:3px solid #0f766e;padding-bottom:16px}h2{margin-top:28px;font-size:17px}p{white-space:pre-wrap;line-height:1.55}.meta{color:#64748b}</style></head><body><h1>Relatório Final GRO NR1</h1><p class="meta">${context.companyName} · ${period?.name ?? "Período"} · Versão ${report.version}</p>${body}<script>window.onload=()=>window.print()</script></body></html>`,
    );
    win.document.close();
  }

  if (!report)
    return (
      <Card>
        <CardContent className="flex flex-col items-center p-10 text-center">
          <FileText className="mb-3 h-10 w-10 text-muted-foreground" />
          <h3 className="font-semibold">Relatório Final ainda não iniciado</h3>
          <p className="mt-1 max-w-lg text-sm text-muted-foreground">
            O relatório consolida documentos, dados agregados, observações validadas, riscos e
            recomendações. Nada é publicado automaticamente.
          </p>
          {isConsultant && (
            <Button className="mt-4" onClick={createReport}>
              Criar rascunho
            </Button>
          )}
        </CardContent>
      </Card>
    );

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-teal-600" />
                Relatório Final · versão {report.version}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {period?.name} · responsável técnico registrado
              </p>
            </div>
            <Badge>{REPORT_STATUS[report.status]}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isConsultant
            ? SECTIONS.map(([key, label]) => (
                <div key={key}>
                  <Label>{label}</Label>
                  <Textarea
                    className="mt-1 min-h-24"
                    value={content[key] ?? ""}
                    onChange={(event) => setContent({ ...content, [key]: event.target.value })}
                  />
                </div>
              ))
            : SECTIONS.map(([key, label]) => (
                <section key={key}>
                  <h3 className="font-semibold">{label}</h3>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">
                    {content[key] || "Sem informação publicada."}
                  </p>
                </section>
              ))}
          <div className="flex flex-wrap gap-2">
            {isConsultant && (
              <Button variant="outline" onClick={saveContent}>
                Salvar edição
              </Button>
            )}
            {isConsultant && report.status === "draft" && (
              <Button onClick={() => transition("technical_review")}>
                Enviar à revisão técnica
              </Button>
            )}
            {isConsultant && report.status === "technical_review" && (
              <Button onClick={() => transition("validated")}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Validar humanamente
              </Button>
            )}
            {isConsultant && report.status === "validated" && (
              <Button onClick={() => transition("published")}>Publicar para empresa</Button>
            )}
            {isConsultant && report.status === "published" && (
              <Button onClick={() => transition("delivered")}>Registrar entrega</Button>
            )}
            <Button variant="outline" onClick={printReport}>
              <Printer className="mr-2 h-4 w-4" />
              Versão imprimível
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Validado em: {formatDate(report.validated_at)} · Publicado em:{" "}
            {formatDate(report.published_at)} · Entregue em: {formatDate(report.delivered_at)}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Riscos do resultado técnico</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.risks.map((item: any) => (
            <div key={item.id} className="rounded-lg border p-3">
              <div className="flex flex-wrap gap-2">
                <strong>{item.title}</strong>
                {item.classification && <Badge variant="outline">{item.classification}</Badge>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
            </div>
          ))}
          {isConsultant && (
            <div className="grid gap-2 border-t pt-4 md:grid-cols-3">
              <Input
                placeholder="Risco identificado"
                value={risk.title}
                onChange={(e) => setRisk({ ...risk, title: e.target.value })}
              />
              <Input
                placeholder="Classificação técnica"
                value={risk.classification}
                onChange={(e) => setRisk({ ...risk, classification: e.target.value })}
              />
              <Input
                placeholder="Descrição"
                value={risk.description}
                onChange={(e) => setRisk({ ...risk, description: e.target.value })}
              />
              <Button variant="outline" onClick={addRisk}>
                Adicionar para validação
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function escapeHtml(value: string) {
  return value.replace(
    /[&<>'"]/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char] ?? char,
  );
}
