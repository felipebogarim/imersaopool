import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { LENTES, LENTE_DEF, TIPO_LABEL, normalizeHighlights, normalizeSinteseCampos, toValues, type FonteTipo, type Lente } from "@/lib/insight-lentes";
import { ArrowLeft, ExternalLink, Save, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/fontes/$id")({
  head: () => ({
    meta: [
      { title: "Fonte de Insight — PoolFlux" },
      { name: "description", content: "Edite as 8 lentes padronizadas de uma fonte de insight." },
      { property: "og:title", content: "Fonte de Insight — PoolFlux" },
      { property: "og:description", content: "Leitura estratégica, síntese objetiva e falas verbatim por lente." },
    ],
  }),
  component: FonteDetalhe,
});

type LenteState = { leitura: string; campos: Record<string, string>; highlights: string };

function FonteDetalhe() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [ativa, setAtiva] = useState<Lente>("marca_preco");
  const [state, setState] = useState<Record<string, LenteState>>({});
  const [saving, setSaving] = useState(false);

  const { data } = useQuery({
    queryKey: ["insight-fonte", id],
    queryFn: async () => {
      const [{ data: fonte }, { data: lentes }] = await Promise.all([
        supabase.from("insight_fontes").select("*").eq("id", id).maybeSingle(),
        supabase.from("insight_fonte_lentes").select("*").eq("fonte_id", id),
      ]);
      return { fonte, lentes: lentes ?? [] };
    },
  });

  useEffect(() => {
    if (!data?.fonte) return;
    const next: Record<string, LenteState> = {};
    for (const l of LENTES) {
      const row: any = data.lentes.find((x: any) => x.lente === l);
      const campos = normalizeSinteseCampos(l as Lente, row?.sintese_campos);
      next[l] = {
        leitura: row?.leitura_estrategica ?? "",
        campos: Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, toValues(v as any).join("\n")])),
        highlights: normalizeHighlights(row?.highlights).join("\n"),
      };
    }
    setState(next);
  }, [data]);

  const fonte: any = data?.fonte;
  const def = LENTE_DEF[ativa];
  const cur = state[ativa];

  async function salvar(marcarProcessada: boolean) {
    setSaving(true);
    try {
      for (const l of LENTES) {
        const s = state[l];
        if (!s) continue;
        const campos = normalizeSinteseCampos(
          l as Lente,
          Object.fromEntries(
            Object.entries(s.campos).map(([k, v]) => {
              const def_campo = LENTE_DEF[l as Lente].campos.find(c => c.key === k);
              const vals = v.split("\n").map(x => x.trim()).filter(Boolean);
              return [k, def_campo?.multi ? vals : vals.join(" ")];
            }),
          ),
        );
        const { error } = await supabase
          .from("insight_fonte_lentes")
          .upsert(
            {
              fonte_id: id,
              lente: l,
              leitura_estrategica: s.leitura.trim() || null,
              sintese_campos: campos as never,
              highlights: s.highlights.split("\n").map(x => x.trim()).filter(Boolean) as never,
            },
            { onConflict: "fonte_id,lente" },
          );
        if (error) throw error;
      }

      if (marcarProcessada) {
        const perfil = state["adicionais"]?.campos?.perfil_carteira?.trim() || fonte?.perfil_carteira || null;
        const { error } = await supabase
          .from("insight_fontes")
          .update({ status_processamento: "processada", perfil_carteira: perfil })
          .eq("id", id);
        if (error) throw error;
      }

      toast.success(marcarProcessada ? "Fonte processada e elegível para a síntese." : "Lentes salvas.");
      qc.invalidateQueries({ queryKey: ["insight-fonte", id] });
      qc.invalidateQueries({ queryKey: ["insight-fontes"] });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <PageHeader
        title={fonte?.titulo ?? "Fonte"}
        subtitle={[fonte?.pessoa, fonte?.regiao, fonte?.perfil_carteira].filter(Boolean).join(" · ")}
        actions={
          <>
            <Button variant="outline" asChild><Link to="/fontes"><ArrowLeft className="h-4 w-4 mr-1" /> Fontes</Link></Button>
            {fonte?.arquivo_relatorio && (
              <Button variant="outline" asChild>
                <a href={fonte.arquivo_relatorio} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-1" /> Relatório</a>
              </Button>
            )}
            <Button variant="outline" onClick={() => salvar(false)} disabled={saving}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
            <Button onClick={() => salvar(true)} disabled={saving}><CheckCircle2 className="h-4 w-4 mr-1" /> Salvar e processar</Button>
          </>
        }
      />
      <div className="p-4 sm:p-8 space-y-4">
        {fonte && (
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">{TIPO_LABEL[fonte.tipo as FonteTipo]}</Badge>
            <Badge variant="secondary">{fonte.status_processamento}</Badge>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {LENTES.map(l => (
            <button
              key={l}
              type="button"
              onClick={() => setAtiva(l)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition",
                ativa === l ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted",
              )}
            >
              {LENTE_DEF[l].label}
            </button>
          ))}
        </div>

        {cur && (
          <div className="surface rounded-xl p-5 space-y-4">
            <p className="text-xs text-muted-foreground">{def.descricao}</p>
            <div>
              <Label>Leitura estratégica</Label>
              <Textarea
                rows={4}
                value={cur.leitura}
                onChange={e => setState(s => ({ ...s, [ativa]: { ...s[ativa], leitura: e.target.value } }))}
              />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {def.campos.map(c => (
                <div key={c.key}>
                  <Label>{c.label}{c.multi ? " (um por linha)" : ""}</Label>
                  {c.multi ? (
                    <Textarea
                      rows={3}
                      value={cur.campos[c.key] ?? ""}
                      onChange={e => setState(s => ({ ...s, [ativa]: { ...s[ativa], campos: { ...s[ativa].campos, [c.key]: e.target.value } } }))}
                    />
                  ) : (
                    <Input
                      value={cur.campos[c.key] ?? ""}
                      onChange={e => setState(s => ({ ...s, [ativa]: { ...s[ativa], campos: { ...s[ativa].campos, [c.key]: e.target.value } } }))}
                    />
                  )}
                </div>
              ))}
            </div>
            <div>
              <Label>Highlights — falas verbatim (uma por linha)</Label>
              <Textarea
                rows={3}
                value={cur.highlights}
                onChange={e => setState(s => ({ ...s, [ativa]: { ...s[ativa], highlights: e.target.value } }))}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
