import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { VoiceTextarea } from "@/components/VoiceInput";
import { FieldHelp } from "@/components/FieldHelp";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info } from "lucide-react";
import { toast } from "sonner";
import {
  INTERVIEW_SECTIONS,
  CLASSIFICACOES,
  TIPOS_EMPRESA,
} from "@/lib/interview-questions";

export const Route = createFileRoute("/_authenticated/entrevistas/nova")({
  head: () => ({ meta: [{ title: "Nova entrevista — PoolFlux" }] }),
  component: NovaEntrevista,
});

function NovaEntrevista() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  const [entrevistador, setEntrevistador] = useState({ nome: "", cargo: "", email: "" });
  const [entrevistado, setEntrevistado] = useState({
    nome: "",
    classificacao: "",
    classificacao_outro: "",
    empresa_nome: "",
    empresa_tipo: "",
    empresa_tipo_outro: "",
    cidade: "",
    estado: "",
    data_entrevista: new Date().toISOString().slice(0, 10),
  });
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [observacoes, setObservacoes] = useState("");

  function setResp(id: string, v: string) {
    setRespostas(r => ({ ...r, [id]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!entrevistador.nome.trim()) return toast.error("Informe o nome do entrevistador");
    if (!entrevistado.nome.trim()) return toast.error("Informe o nome do entrevistado");
    if (!entrevistado.classificacao) return toast.error("Selecione a classificação do entrevistado");
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("interviews").insert({
      created_by: userData.user?.id,
      entrevistador_nome: entrevistador.nome,
      entrevistador_cargo: entrevistador.cargo || null,
      entrevistador_email: entrevistador.email || null,
      entrevistado_nome: entrevistado.nome,
      entrevistado_classificacao: entrevistado.classificacao,
      entrevistado_classificacao_outro: entrevistado.classificacao === "outro" ? entrevistado.classificacao_outro : null,
      empresa_nome: entrevistado.empresa_nome || null,
      empresa_tipo: entrevistado.empresa_tipo || null,
      empresa_tipo_outro: entrevistado.empresa_tipo === "outro" ? entrevistado.empresa_tipo_outro : null,
      cidade: entrevistado.cidade || null,
      estado: entrevistado.estado || null,
      data_entrevista: entrevistado.data_entrevista || null,
      respostas,
      observacoes: observacoes || null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Entrevista registrada");
    navigate({ to: "/entrevistas" });
  }

  return (
    <div>
      <PageHeader title="Nova entrevista" subtitle="Registre a conversa seguindo o roteiro do framework" />
      <form onSubmit={submit} className="p-8 max-w-4xl space-y-8">
        {/* Entrevistador */}
        <section className="surface rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-lg">Entrevistador</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <Label>Nome *</Label>
              <Input value={entrevistador.nome} onChange={e => setEntrevistador({ ...entrevistador, nome: e.target.value })} />
            </div>
            <div>
              <Label>Cargo / função</Label>
              <Input value={entrevistador.cargo} onChange={e => setEntrevistador({ ...entrevistador, cargo: e.target.value })} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={entrevistador.email} onChange={e => setEntrevistador({ ...entrevistador, email: e.target.value })} />
            </div>
          </div>
        </section>

        {/* Entrevistado */}
        <section className="surface rounded-xl p-6 space-y-4">
          <h2 className="font-semibold text-lg">Entrevistado</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Nome *</Label>
              <Input value={entrevistado.nome} onChange={e => setEntrevistado({ ...entrevistado, nome: e.target.value })} />
            </div>
            <div>
              <Label>Classificação *</Label>
              <Select value={entrevistado.classificacao} onValueChange={v => setEntrevistado({ ...entrevistado, classificacao: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {CLASSIFICACOES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {entrevistado.classificacao === "outro" && (
              <div className="md:col-span-2">
                <Label>Especificar classificação *</Label>
                <Input value={entrevistado.classificacao_outro} onChange={e => setEntrevistado({ ...entrevistado, classificacao_outro: e.target.value })} />
              </div>
            )}
            <div>
              <Label>Nome da empresa</Label>
              <Input value={entrevistado.empresa_nome} onChange={e => setEntrevistado({ ...entrevistado, empresa_nome: e.target.value })} />
            </div>
            <div>
              <Label>Tipo da empresa</Label>
              <Select value={entrevistado.empresa_tipo} onValueChange={v => setEntrevistado({ ...entrevistado, empresa_tipo: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {TIPOS_EMPRESA.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {entrevistado.empresa_tipo === "outro" && (
              <div className="md:col-span-2">
                <Label>Especificar tipo da empresa</Label>
                <Input value={entrevistado.empresa_tipo_outro} onChange={e => setEntrevistado({ ...entrevistado, empresa_tipo_outro: e.target.value })} />
              </div>
            )}
            <div>
              <Label>Cidade</Label>
              <Input value={entrevistado.cidade} onChange={e => setEntrevistado({ ...entrevistado, cidade: e.target.value })} />
            </div>
            <div>
              <Label>Estado (UF)</Label>
              <Input maxLength={2} value={entrevistado.estado} onChange={e => setEntrevistado({ ...entrevistado, estado: e.target.value.toUpperCase() })} />
            </div>
            <div>
              <Label>Data da entrevista</Label>
              <Input type="date" value={entrevistado.data_entrevista} onChange={e => setEntrevistado({ ...entrevistado, data_entrevista: e.target.value })} />
            </div>
          </div>
        </section>

        {/* Roteiro */}
        {INTERVIEW_SECTIONS.map(sec => (
          <section key={sec.id} className="surface rounded-xl p-6 space-y-5">
            <div>
              <h2 className="font-semibold text-lg">{sec.titulo}</h2>
              <p className="text-sm text-muted-foreground mt-1 flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 shrink-0 text-cyan" />
                <span>{sec.descricao}</span>
              </p>
            </div>
            {sec.perguntas.map(q => (
              <div key={q.id} className="space-y-1.5">
                <Label className="text-sm">
                  {q.pergunta}{" "}
                  {q.hipotese !== "—" && <span className="text-[10px] text-muted-foreground ml-1">[{q.hipotese}]</span>}
                </Label>
                <FieldHelp text={q.orientacao} audio withMediaSuffix />
                <VoiceTextarea
                  assist
                  rows={3}
                  value={respostas[q.id] ?? ""}
                  onChange={v => setResp(q.id, v)}
                  placeholder="Registre a resposta com as palavras do entrevistado..."
                />
              </div>
            ))}
          </section>
        ))}

        {/* Observações */}
        <section className="surface rounded-xl p-6 space-y-2">
          <Label>Observações finais do entrevistador</Label>
          <Textarea rows={4} value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Impressões, contexto, próximos passos..." />
        </section>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate({ to: "/entrevistas" })}>Cancelar</Button>
          <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar entrevista"}</Button>
        </div>
      </form>
    </div>
  );
}
