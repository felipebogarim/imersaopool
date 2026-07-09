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
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
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

  async function handleUpload(file: File) {
    if (file.size > MAX_BYTES) return toast.error("Arquivo maior que 20MB");
    setUploading(true);
    try {
      const base64 = await blobToBase64(file);
      const r = await distribute({ data: { sessaoId, base64, mime: file.type || "application/octet-stream", filename: file.name } });
      toast.success(`IA distribuiu conteúdo em ${r.filled} capítulo(s)`);
      qc.invalidateQueries({ queryKey: ["sessao-capitulos", sessaoId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao processar arquivo");
    } finally {
      setUploading(false);
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
      <div className="surface rounded-xl p-5 border border-dashed">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h3 className="font-medium flex items-center gap-2"><Upload className="h-4 w-4" /> Relatório completo</h3>
            <p className="text-sm text-muted-foreground">Envie PDF, texto ou áudio da entrevista/imersão. A IA lê tudo e distribui pelos capítulos abaixo (como sugestão para você revisar).</p>
          </div>
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.txt,.md,.csv,audio/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Processando...</> : <><Upload className="h-4 w-4 mr-1" /> Enviar arquivo</>}
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

function CapituloBlock({
  capitulo, sessaoId, existing, onSaved,
}: {
  capitulo: any; sessaoId: string; existing: any; onSaved: () => void;
}) {
  const [texto, setTexto] = useState(existing?.resposta_texto ?? "");
  const [sintese, setSintese] = useState<Record<string, string>>(existing?.sintese ?? {});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTexto(existing?.resposta_texto ?? "");
    setSintese(existing?.sintese ?? {});
  }, [existing?.id, existing?.resposta_texto, existing?.sintese]);

  const isIaDraft = existing?.origem === "ia" && existing?.status_revisao === "pendente";
  const campos: string[] = Array.isArray(capitulo.campos_matriz) ? capitulo.campos_matriz : [];

  async function save() {
    setSaving(true);
    const payload: any = {
      sessao_id: sessaoId,
      capitulo_id: capitulo.id,
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

      <VoiceTextarea
        rows={5}
        value={texto}
        onChange={setTexto}
        placeholder="Registre a resposta livre. Você pode digitar, gravar áudio (a IA transcreve) ou anexar arquivo."
        assist
      />

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
        <Button size="sm" onClick={save} disabled={saving || (!texto.trim() && Object.values(sintese).every(v => !v?.trim()))}>
          {saving ? "Salvando..." : isIaDraft ? "Confirmar sugestão" : existing ? "Atualizar" : "Salvar capítulo"}
        </Button>
      </div>
    </section>
  );
}
