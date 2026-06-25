import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { VoiceInput, VoiceTextarea } from "@/components/VoiceInput";

const FIELDS: { key: string; label: string }[] = [
  { key: "texto", label: "Resumo / texto livre" },
  { key: "observacoes_comerciais", label: "Observações comerciais" },
  { key: "observacoes_exposicao", label: "Observações de exposição" },
  { key: "observacoes_concorrentes", label: "Observações sobre concorrentes" },
  { key: "observacoes_loja", label: "Observações da loja" },
  { key: "oportunidades", label: "Oportunidades" },
];

export function AgentInputs({ immersionId, scope = "campo" }: { immersionId: string; scope?: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});

  const { data: inputs = [] } = useQuery({
    queryKey: ["field-inputs", immersionId, scope],
    queryFn: async () => {
      const { data } = await supabase
        .from("field_visit_inputs")
        .select("*, profile:profiles!field_visit_inputs_created_by_fkey(full_name, email)")
        .eq("immersion_id", immersionId)
        .eq("scope", scope)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  async function save() {
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("field_visit_inputs").insert({
      immersion_id: immersionId,
      created_by: u.user?.id,
      scope,
      ...form,
    } as any);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Input adicionado");
    setForm({});
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["field-inputs", immersionId, scope] });
  }

  async function remove(id: string) {
    if (!confirm("Excluir este input?")) return;
    const { error } = await supabase.from("field_visit_inputs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["field-inputs", immersionId, scope] });
  }


  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">Inputs adicionais de agentes em campo.</p>
        <Button size="sm" onClick={() => setOpen((v) => !v)}>
          <Plus className="h-4 w-4 mr-1" /> Adicionar input
        </Button>
      </div>

      {open && (
        <div className="surface rounded-xl p-4 space-y-3 border border-border">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <label className="text-xs font-medium">{f.label}</label>
              {f.key === "texto" ? (
                <VoiceTextarea
                  assist
                  value={form[f.key] ?? ""}
                  onChange={(v) => setForm({ ...form, [f.key]: v })}
                  rows={3}
                />
              ) : (
                <VoiceInput
                  assist
                  value={form[f.key] ?? ""}
                  onChange={(v) => setForm({ ...form, [f.key]: v })}
                />
              )}
            </div>
          ))}
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} Salvar
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {inputs.length === 0 && !open && (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum input ainda.</p>
        )}
        {inputs.map((i: any) => (
          <div key={i.id} className="surface rounded-xl p-4 border border-border">
            <div className="flex justify-between items-start mb-2">
              <div className="text-xs text-muted-foreground">
                {i.profile?.full_name || i.profile?.email || "Agente"} ·{" "}
                {new Date(i.created_at).toLocaleString("pt-BR")}
              </div>
              <Button size="icon" variant="ghost" onClick={() => remove(i.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <div className="space-y-1 text-sm">
              {FIELDS.map((f) =>
                i[f.key] ? (
                  <div key={f.key}>
                    <span className="text-xs text-muted-foreground">{f.label}: </span>
                    <span>{i[f.key]}</span>
                  </div>
                ) : null,
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
