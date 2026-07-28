import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, FileText, Download, FileDown } from "lucide-react";
import { toast } from "sonner";
import { exportCompilationPdf, exportCompilationCsv } from "@/lib/export-compilation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateCompilation } from "@/lib/generate-compilation.functions";

export const Route = createFileRoute("/_authenticated/compilacoes")({
  head: () => ({ meta: [{ title: "Compilações IA — PoolFlux" }] }),
  component: CompilacoesPage,
});

type Tipo = "representante" | "visita" | "price" | "diagnostico_final";
type Escopo = "cliente" | "familia" | "competidor" | "empresa";

function CompilacoesPage() {
  const qc = useQueryClient();
  const runGenerate = useServerFn(generateCompilation);

  const [tipo, setTipo] = useState<Tipo>("diagnostico_final");
  const [escopoTipo, setEscopoTipo] = useState<Escopo>("empresa");
  const [escopoRefId, setEscopoRefId] = useState<string>("");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data: compilations = [] } = useQuery({
    queryKey: ["compilations"],
    queryFn: async () =>
      (
        await supabase
          .from("ai_compilations")
          .select("id, tipo, escopo_tipo, escopo_ref_id, versao, modelo, created_at, perspectivas_incluidas")
          .order("created_at", { ascending: false })
          .limit(100)
      ).data ?? [],
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () =>
      (await supabase.from("clients").select("id, nome_fantasia").order("nome_fantasia").limit(500)).data ?? [],
  });

  const { data: familias = [] } = useQuery({
    queryKey: ["familias-min"],
    queryFn: async () =>
      (await supabase.from("familias_produto").select("id, nome, nivel").order("nome").limit(500)).data ?? [],
  });

  const selectedComp = useMemo(
    () => compilations.find((c: any) => c.id === selected),
    [compilations, selected],
  );

  const { data: detail } = useQuery({
    queryKey: ["compilation", selected],
    enabled: !!selected,
    queryFn: async () =>
      (
        await supabase
          .from("ai_compilations")
          .select("id, conteudo, versao, tipo, escopo_tipo, escopo_ref_id, created_at, modelo, perspectivas_incluidas")
          .eq("id", selected!)
          .maybeSingle()
      ).data,
  });

  async function handleGenerate() {
    if (escopoTipo !== "empresa" && !escopoRefId) {
      toast.error("Selecione a referência do escopo");
      return;
    }
    setBusy(true);
    try {
      const r = await runGenerate({
        data: {
          tipo,
          escopoTipo,
          escopoRefId: escopoTipo === "empresa" ? null : escopoRefId,
        },
      });
      toast.success(`Compilação v${r.versao} criada (${r.total} perspectivas)`);
      qc.invalidateQueries({ queryKey: ["compilations"] });
      setSelected(r.id);
    } catch (e: any) {
      toast.error(e.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Compilações IA"
        subtitle="Documento executivo gerado a partir de uma síntese."
        actions={
          <Button variant="outline" onClick={handleGenerateFromSintese} disabled={busySintese} className="gap-2">
            <Layers className="h-4 w-4" />
            {busySintese ? "Gerando..." : "Gerar a partir do painel de síntese atual"}
          </Button>
        }
      />

      <div className="grid gap-4 rounded-lg border bg-card p-4 md:grid-cols-[1fr_1fr_1fr_auto]">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Tipo</label>
          <Select value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="diagnostico_final">Diagnóstico final</SelectItem>
              <SelectItem value="representante">Representante</SelectItem>
              <SelectItem value="visita">Visita</SelectItem>
              <SelectItem value="price">Price</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Escopo</label>
          <Select
            value={escopoTipo}
            onValueChange={(v) => {
              setEscopoTipo(v as Escopo);
              setEscopoRefId("");
            }}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="empresa">Empresa (global)</SelectItem>
              <SelectItem value="cliente">Cliente</SelectItem>
              <SelectItem value="familia">Família de produto</SelectItem>
              <SelectItem value="competidor">Competidor</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Referência</label>
          {escopoTipo === "empresa" ? (
            <div className="text-sm text-muted-foreground pt-2">—</div>
          ) : escopoTipo === "cliente" ? (
            <Select value={escopoRefId} onValueChange={setEscopoRefId}>
              <SelectTrigger><SelectValue placeholder="Selecione cliente" /></SelectTrigger>
              <SelectContent>
                {clients.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome_fantasia}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : escopoTipo === "familia" ? (
            <Select value={escopoRefId} onValueChange={setEscopoRefId}>
              <SelectTrigger><SelectValue placeholder="Selecione família" /></SelectTrigger>
              <SelectContent>
                {familias.map((f: any) => (
                  <SelectItem key={f.id} value={f.id}>{f.nome} <span className="text-muted-foreground">({f.nivel})</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <input
              className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              placeholder="ID do competidor"
              value={escopoRefId}
              onChange={(e) => setEscopoRefId(e.target.value)}
            />
          )}
        </div>
        <div className="flex items-end">
          <Button onClick={handleGenerate} disabled={busy} className="gap-2">
            <Sparkles className="h-4 w-4" />
            {busy ? "Gerando..." : "Gerar compilação"}
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-2 text-sm font-medium">Histórico</div>
          <ul className="max-h-[70vh] divide-y overflow-auto">
            {compilations.length === 0 && (
              <li className="p-4 text-sm text-muted-foreground">Nenhuma compilação ainda.</li>
            )}
            {compilations.map((c: any) => (
              <li key={c.id}>
                <button
                  onClick={() => setSelected(c.id)}
                  className={`flex w-full items-start gap-2 p-3 text-left text-sm hover:bg-accent/40 ${selected === c.id ? "bg-accent/60" : ""}`}
                >
                  <FileText className="mt-0.5 h-4 w-4 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{c.tipo}</span>
                      <Badge variant="secondary">v{c.versao}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.escopo_tipo}
                      {c.escopo_ref_id ? ` · ${c.escopo_ref_id.slice(0, 8)}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleString("pt-BR")} · {c.perspectivas_incluidas?.length ?? 0} persp.
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border bg-card p-4">
          {!selected && (
            <div className="text-sm text-muted-foreground">Selecione uma compilação ou gere uma nova.</div>
          )}
          {selected && !detail && <div className="text-sm text-muted-foreground">Carregando...</div>}
          {detail && <CompilationView detail={detail} />}
        </div>
      </div>
    </div>
  );
}

function CompilationView({ detail }: { detail: any }) {
  const c = (detail?.conteudo ?? {}) as any;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>{detail.tipo}</Badge>
        <Badge variant="secondary">v{detail.versao}</Badge>
        <Badge variant="outline">{detail.escopo_tipo}</Badge>
        <span className="text-xs text-muted-foreground">{detail.modelo}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {new Date(detail.created_at).toLocaleString("pt-BR")} ·{" "}
          {detail.perspectivas_incluidas?.length ?? 0} perspectivas
        </span>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => exportCompilationPdf(detail)}>
          <FileDown className="h-3.5 w-3.5" /> PDF
        </Button>
        <Button size="sm" variant="outline" className="gap-1" onClick={() => exportCompilationCsv(detail)}>
          <Download className="h-3.5 w-3.5" /> CSV
        </Button>
      </div>


      {c.resumo_executivo && (
        <Section title="Resumo executivo">
          <p className="text-sm leading-relaxed">{String(c.resumo_executivo)}</p>
        </Section>
      )}

      <BulletList title="Insights-chave" items={c.insights_chave} />
      <BulletList title="Oportunidades" items={c.oportunidades} />
      <BulletList title="Ameaças" items={c.ameacas} />
      <BulletList title="Lacunas" items={c.lacunas} />

      {Array.isArray(c.recomendacoes) && c.recomendacoes.length > 0 && (
        <Section title="Recomendações">
          <ul className="space-y-2">
            {c.recomendacoes.map((r: any, i: number) => (
              <li key={i} className="rounded border p-3 text-sm">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-medium">{r.acao}</span>
                  {r.prioridade && (
                    <Badge variant={r.prioridade === "alta" ? "destructive" : r.prioridade === "media" ? "default" : "secondary"}>
                      {r.prioridade}
                    </Badge>
                  )}
                </div>
                {r.justificativa && (
                  <p className="text-muted-foreground">{r.justificativa}</p>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <details className="rounded border p-2 text-xs">
        <summary className="cursor-pointer text-muted-foreground">JSON bruto</summary>
        <pre className="mt-2 overflow-auto">{JSON.stringify(c, null, 2)}</pre>
      </details>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  );
}

function BulletList({ title, items }: { title: string; items: unknown }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return (
    <Section title={title}>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {items.map((it, i) => (
          <li key={i}>{typeof it === "string" ? it : JSON.stringify(it)}</li>
        ))}
      </ul>
    </Section>
  );
}
