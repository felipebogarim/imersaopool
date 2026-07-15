import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VoiceTextarea } from "@/components/VoiceInput";
import { Check, Sparkles, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { generatePerspectivasForSession } from "@/lib/generate-perspectivas.functions";
import { distributeReportToChapters } from "@/lib/distribute-report.functions";
import { ingestFinalReport } from "@/lib/ingest-final-report.functions";

const MAX_BYTES = 20 * 1024 * 1024;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onloadend = () => res(String(r.result).split(",")[1] ?? "");
    r.onerror = rej;
    r.readAsDataURL(blob);
  });
}

export function ChapterCapture({ sessaoId, roteiroId }: { sessaoId: string; roteiroId: string }) {
  const qc = useQueryClient();
  const generate = useServerFn(generatePerspectivasForSession);
  const distribute = useServerFn(distributeReportToChapters);
  const ingestFinal = useServerFn(ingestFinalReport);
  const brutoRef = useRef<HTMLInputElement>(null);
  const finalRef = useRef<HTMLInputElement>(null);
  const [uploadingBruto, setUploadingBruto] = useState(false);
  const [uploadingFinal, setUploadingFinal] = useState(false);
  const [generating, setGenerating] = useState(false);

  const { data: capitulos = [] } = useQuery({
    queryKey: ["capitulos-of", roteiroId],
    queryFn: async () =>
      (await supabase
        .from("capitulos")
        .select("id, ordem, codigo, titulo, orientacao, hipotese, lente_default, campos_matriz, pergunta_abertura, pontos_escuta")
        .eq("roteiro_id", roteiroId)
        .order("ordem")).data ?? [],
  });

  const { data: respostas = [] } = useQuery({
    queryKey: ["sessao-capitulos", sessaoId],
    queryFn: async () =>
    (await supabase
        .from("sessao_capitulos")
        .select("id, capitulo_id, resposta_texto, leitura_estrategica, origem, status_revisao, sintese")
        .eq("sessao_id", sessaoId)).data ?? [],
  });

  async function handleBruto(file: File) {
    if (file.size > MAX_BYTES) return toast.error("Arquivo maior que 20MB");
    setUploadingBruto(true);
    try {
      const base64 = await blobToBase64(file);
      const r = await distribute({ data: { sessaoId, base64, mime: file.type || "application/octet-stream", filename: file.name } });
      toast.success(`IA distribuiu conteúdo em ${r.filled} capítulo(s)`);
      qc.invalidateQueries({ queryKey: ["sessao-capitulos", sessaoId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao processar arquivo");
    } finally {
      setUploadingBruto(false);
    }
  }

  async function handleFinal(file: File) {
    if (file.size > MAX_BYTES) return toast.error("Arquivo maior que 20MB");
    setUploadingFinal(true);
    try {
      const base64 = await blobToBase64(file);
      const r = await ingestFinal({ data: { sessaoId, base64, mime: file.type || "application/octet-stream", filename: file.name } });
      toast.success(`Relatório final aplicado a ${r.filled} capítulo(s)`);
      if (r.unmatched?.length)
        toast.warning(`${r.unmatched.length} capítulo(s) não reconhecido(s)`, { description: r.unmatched.slice(0, 3).join(" · ") });
      qc.invalidateQueries({ queryKey: ["sessao-capitulos", sessaoId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao processar arquivo");
    } finally {
      setUploadingFinal(false);
    }
  }

  async function runGenerate() {
    setGenerating(true);
    try {
      const r = await generate({ data: { sessaoId } });
      if (r.created > 0) toast.success(`${r.created} perspectiva(s) sugerida(s) pela IA`);
      if (r.errors?.length) toast.warning(`${r.errors.length} capítulo(s) com erro`, { description: r.errors[0] });
      if (!r.created && !r.errors?.length) toast.info("Nada para processar");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao gerar perspectivas");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="surface rounded-xl p-5 border border-dashed space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h3 className="font-medium flex items-center gap-2"><Upload className="h-4 w-4" /> Relatório bruto</h3>
            <p className="text-sm text-muted-foreground">Envie a transcrição/áudio original. A IA lê, interpreta e distribui pelos capítulos como sugestão para revisão.</p>
            <input
              ref={brutoRef}
              type="file"
              accept=".pdf,.docx,.txt,.md,.csv,audio/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleBruto(f); e.target.value = ""; }}
            />
            <Button variant="outline" onClick={() => brutoRef.current?.click()} disabled={uploadingBruto}>
              {uploadingBruto ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Processando...</> : <><Upload className="h-4 w-4 mr-1" /> Enviar bruto</>}
            </Button>
          </div>
          <div className="space-y-2">
            <h3 className="font-medium flex items-center gap-2"><Upload className="h-4 w-4" /> Relatório final</h3>
            <p className="text-sm text-muted-foreground">Envie o documento já pronto (.md/.txt/.docx). O texto é copiado verbatim para os campos — a IA não reescreve nem interpreta.</p>
            <input
              ref={finalRef}
              type="file"
              accept=".md,.markdown,.txt,.docx"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFinal(f); e.target.value = ""; }}
            />
            <Button variant="outline" onClick={() => finalRef.current?.click()} disabled={uploadingFinal}>
              {uploadingFinal ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Aplicando...</> : <><Upload className="h-4 w-4 mr-1" /> Enviar final</>}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4">
        <h2 className="font-semibold text-lg">Captura por capítulos</h2>
        <Button size="sm" variant="outline" onClick={runGenerate} disabled={generating || respostas.length === 0}>
          <Sparkles className="h-4 w-4 mr-1" />
          {generating ? "Gerando..." : "Gerar perspectivas com IA"}
        </Button>
      </div>

      <SumarioExecutivoBlock sessaoId={sessaoId} />

      {capitulos.map((c: any) => {
        const existing = respostas.find((r: any) => r.capitulo_id === c.id);
        return (
          <CapituloBlock
            key={c.id}
            capitulo={c}
            sessaoId={sessaoId}
            existing={existing}
            onSaved={() => qc.invalidateQueries({ queryKey: ["sessao-capitulos", sessaoId] })}
          />
        );
      })}
    </div>
  );
}

type SumarioForm = {
  sintese_geral: string;
  sinais_prioritarios: string;
  risco_estrategico: string;
  agenda_prioritaria: string;
  sintese_final: string;
};

function parseKV(text: string): Array<{ key: string; value: string }> {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^[-*•]?\s*([^:]+?)\s*:\s*(.+)$/);
      if (!m) return null;
      return { key: m[1].trim().toLowerCase().replace(/\s+/g, "_"), value: m[2].trim() };
    })
    .filter((x): x is { key: string; value: string } => !!x);
}

function serializeKV(items?: Array<{ key: string; value: string }>): string {
  if (!items?.length) return "";
  return items.map((i) => `${i.key.replace(/_/g, " ")}: ${i.value}`).join("\n");
}

function SumarioExecutivoBlock({ sessaoId }: { sessaoId: string }) {
  const qc = useQueryClient();
  const { data: interview } = useQuery({
    queryKey: ["interview-sumario", sessaoId],
    queryFn: async () =>
      (await supabase.from("interviews").select("respostas").eq("id", sessaoId).maybeSingle()).data,
  });

  const stored = ((interview?.respostas as any)?.__sumario_executivo__ ?? null) as
    | {
        sintese_geral?: string;
        sinais_prioritarios?: Array<{ key: string; value: string }>;
        risco_estrategico?: string;
        agenda_prioritaria?: Array<{ key: string; value: string }>;
        sintese_final?: string;
      }
    | null;

  const [form, setForm] = useState<SumarioForm>({
    sintese_geral: "",
    sinais_prioritarios: "",
    risco_estrategico: "",
    agenda_prioritaria: "",
    sintese_final: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      sintese_geral: stored?.sintese_geral ?? "",
      sinais_prioritarios: serializeKV(stored?.sinais_prioritarios),
      risco_estrategico: stored?.risco_estrategico ?? "",
      agenda_prioritaria: serializeKV(stored?.agenda_prioritaria),
      sintese_final: stored?.sintese_final ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    stored?.sintese_geral,
    stored?.risco_estrategico,
    stored?.sintese_final,
    JSON.stringify(stored?.sinais_prioritarios ?? []),
    JSON.stringify(stored?.agenda_prioritaria ?? []),
  ]);

  const isFilled = !!(
    stored &&
    (stored.sintese_geral ||
      stored.risco_estrategico ||
      stored.sintese_final ||
      stored.sinais_prioritarios?.length ||
      stored.agenda_prioritaria?.length)
  );

  async function save() {
    setSaving(true);
    const payload: any = {};
    if (form.sintese_geral.trim()) payload.sintese_geral = form.sintese_geral.trim();
    if (form.risco_estrategico.trim()) payload.risco_estrategico = form.risco_estrategico.trim();
    if (form.sintese_final.trim()) payload.sintese_final = form.sintese_final.trim();
    const sinais = parseKV(form.sinais_prioritarios);
    if (sinais.length) payload.sinais_prioritarios = sinais;
    const agenda = parseKV(form.agenda_prioritaria);
    if (agenda.length) payload.agenda_prioritaria = agenda;

    const { data: cur } = await supabase
      .from("interviews")
      .select("respostas")
      .eq("id", sessaoId)
      .maybeSingle();
    const prev = (cur?.respostas ?? {}) as Record<string, any>;
    const next = { ...prev };
    if (Object.keys(payload).length === 0) {
      delete next.__sumario_executivo__;
    } else {
      next.__sumario_executivo__ = payload;
    }
    const { error } = await supabase
      .from("interviews")
      .update({ respostas: next })
      .eq("id", sessaoId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Sumário executivo salvo");
    qc.invalidateQueries({ queryKey: ["interview-sumario", sessaoId] });
    qc.invalidateQueries({ queryKey: ["interview", sessaoId] });
  }

  return (
    <section className="surface rounded-xl p-5 border border-primary/30">
      <header className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">#00</span>
            <h3 className="font-medium">Sumário executivo</h3>
            <Badge variant="outline" className="text-[10px]">sumario_executivo</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Aparece antes do capítulo 01 no relatório, com uma página dedicada e item 00 no índice.
          </p>
        </div>
        {isFilled && (
          <Badge variant="secondary" className="shrink-0">
            <Check className="h-3 w-3 mr-1" /> preenchido
          </Badge>
        )}
      </header>

      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Síntese geral</p>
          <VoiceTextarea
            rows={4}
            value={form.sintese_geral}
            onChange={(v) => setForm((f) => ({ ...f, sintese_geral: v }))}
            placeholder="Parágrafo síntese com o retrato geral da entrevista."
            assist
          />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
            Sinais prioritários <span className="normal-case text-muted-foreground/70">— um por linha, no formato <code>chave: valor</code></span>
          </p>
          <textarea
            rows={4}
            value={form.sinais_prioritarios}
            onChange={(e) => setForm((f) => ({ ...f, sinais_prioritarios: e.target.value }))}
            placeholder={"marca: percepção premium consolidada\npreço: sensibilidade acima da média"}
            className="w-full bg-transparent border rounded-md px-3 py-2 outline-none resize-y text-sm"
          />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Risco estratégico</p>
          <VoiceTextarea
            rows={3}
            value={form.risco_estrategico}
            onChange={(v) => setForm((f) => ({ ...f, risco_estrategico: v }))}
            placeholder="Principal risco identificado."
            assist
          />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
            Agenda prioritária <span className="normal-case text-muted-foreground/70">— um por linha, <code>chave: valor</code></span>
          </p>
          <textarea
            rows={4}
            value={form.agenda_prioritaria}
            onChange={(e) => setForm((f) => ({ ...f, agenda_prioritaria: e.target.value }))}
            placeholder={"portfolio: ampliar linha standard\ncanal: revisar RT para especificadores"}
            className="w-full bg-transparent border rounded-md px-3 py-2 outline-none resize-y text-sm"
          />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Síntese final</p>
          <VoiceTextarea
            rows={3}
            value={form.sintese_final}
            onChange={(v) => setForm((f) => ({ ...f, sintese_final: v }))}
            placeholder="Fechamento conclusivo."
            assist
          />
        </div>
      </div>

      <div className="flex justify-end mt-4">
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "Salvando..." : isFilled ? "Atualizar sumário" : "Salvar sumário"}
        </Button>
      </div>
    </section>
  );
}

function CapituloBlock({
  capitulo, sessaoId, existing, onSaved,
}: {
  capitulo: any; sessaoId: string; existing: any; onSaved: () => void;
}) {
  const [leitura, setLeitura] = useState(existing?.leitura_estrategica ?? "");
  const [texto, setTexto] = useState(existing?.resposta_texto ?? "");
  const [sintese, setSintese] = useState<Record<string, string>>(existing?.sintese ?? {});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLeitura(existing?.leitura_estrategica ?? "");
    setTexto(existing?.resposta_texto ?? "");
    setSintese(existing?.sintese ?? {});
  }, [existing?.id, existing?.leitura_estrategica, existing?.resposta_texto, existing?.sintese]);

  const isIaDraft = existing?.origem === "ia" && existing?.status_revisao === "pendente";
  const campos: string[] = Array.isArray(capitulo.campos_matriz) ? capitulo.campos_matriz : [];

  async function save() {
    setSaving(true);
    const payload: any = {
      sessao_id: sessaoId,
      capitulo_id: capitulo.id,
      leitura_estrategica: leitura,
      resposta_texto: texto,
      sintese,
      origem: isIaDraft ? "ia" : (existing?.origem ?? "humano"),
      status_revisao: "revisado",
    };
    let error;
    if (existing?.id) {
      ({ error } = await supabase.from("sessao_capitulos").update(payload).eq("id", existing.id));
    } else {
      ({ error } = await supabase.from("sessao_capitulos").insert(payload));
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Capítulo salvo");
    onSaved();
  }

  return (
    <section className="surface rounded-xl p-5">
      <header className="flex items-start justify-between gap-4 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">#{capitulo.ordem}</span>
            <h3 className="font-medium">{capitulo.titulo}</h3>
            {capitulo.lente_default && <Badge variant="outline" className="text-[10px]">{capitulo.lente_default}</Badge>}
            {isIaDraft && <Badge variant="secondary" className="text-[10px]"><Sparkles className="h-3 w-3 mr-1" /> sugestão IA</Badge>}
          </div>
        </div>
        {existing && existing.status_revisao === "revisado" && (
          <Badge variant="secondary" className="shrink-0">
            <Check className="h-3 w-3 mr-1" /> confirmado
          </Badge>
        )}
      </header>

      {capitulo.pergunta_abertura && (
        <blockquote className="border-l-4 border-primary/60 pl-4 py-2 mb-3">
          <p className="text-base font-medium leading-relaxed">"{capitulo.pergunta_abertura}"</p>
        </blockquote>
      )}

      {Array.isArray(capitulo.pontos_escuta) && capitulo.pontos_escuta.length > 0 && (
        <div className="mb-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Fique atento a</p>
          <ul className="list-disc pl-5 space-y-0.5 text-sm">
            {capitulo.pontos_escuta.map((p: string, i: number) => (
              <li key={i} className="text-muted-foreground">{p}</li>
            ))}
          </ul>
        </div>
      )}

      {(capitulo.orientacao || capitulo.hipotese) && (
        <details className="mb-3 text-sm">
          <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
            Objetivo de pesquisa e hipótese
          </summary>
          <div className="mt-2 space-y-1 pl-2 border-l border-border">
            {capitulo.orientacao && <p className="text-sm text-muted-foreground">{capitulo.orientacao}</p>}
            {capitulo.hipotese && <p className="text-xs italic text-muted-foreground">Hipótese: {capitulo.hipotese}</p>}
          </div>
        </details>
      )}

      <div className="mb-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Leitura estratégica</p>
        <VoiceTextarea
          rows={6}
          value={leitura}
          onChange={setLeitura}
          placeholder="Prosa interpretada (2 a 4 parágrafos). A IA preenche automaticamente ao enviar o relatório; você pode editar."
          assist
        />
      </div>

      <details className="mb-3">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
          Anotações brutas / evidência
        </summary>
        <div className="mt-2">
          <VoiceTextarea
            rows={4}
            value={texto}
            onChange={setTexto}
            placeholder="Trechos brutos ou citação curta que sustenta a leitura."
            assist
          />
        </div>
      </details>


      {campos.length > 0 && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Síntese objetiva do capítulo</p>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {campos.map((campo) => (
                  <tr key={campo} className="border-b last:border-b-0">
                    <td className="bg-muted/40 px-3 py-2 align-top font-medium w-1/3 capitalize">
                      {campo.replace(/_/g, " ")}
                    </td>
                    <td className="p-0">
                      <textarea
                        rows={1}
                        value={sintese[campo] ?? ""}
                        onChange={(e) => setSintese((s) => ({ ...s, [campo]: e.target.value }))}
                        className="w-full bg-transparent px-3 py-2 outline-none resize-y min-h-[36px]"
                        placeholder="—"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex justify-end mt-3">
        <Button size="sm" onClick={save} disabled={saving || (!leitura.trim() && !texto.trim() && Object.values(sintese).every(v => !v?.trim()))}>
          {saving ? "Salvando..." : isIaDraft ? "Confirmar sugestão" : existing ? "Atualizar" : "Salvar capítulo"}
        </Button>
      </div>
    </section>
  );
}
