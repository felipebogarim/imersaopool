/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { Lock, Mic, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/gro-nr1";

const db = supabase as any;

export function GroFieldReports({ context, periodId, reports }: any) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    notes: "",
    tags: "",
    include: false,
  });
  const [audio, setAudio] = useState<File | null>(null);
  async function create() {
    if (!form.notes.trim() && !audio) return toast.error("Registre texto ou áudio");
    let audioPath = null;
    if (audio) {
      audioPath = `${context.companyId}/field-reports/${periodId}/${crypto.randomUUID()}-${audio.name}`;
      const up = await supabase.storage.from("gro-nr1").upload(audioPath, audio);
      if (up.error) return toast.error(up.error.message);
    }
    const { error } = await db.from("gro_field_reports").insert({
      company_id: context.companyId,
      period_id: periodId,
      visited_on: form.date,
      notes: form.notes || null,
      audio_path: audioPath,
      tags: form.tags
        .split(",")
        .map((tag: string) => tag.trim())
        .filter(Boolean),
      include_in_report: form.include,
    });
    if (error) return toast.error(error.message);
    setForm({ date: new Date().toISOString().slice(0, 10), notes: "", tags: "", include: false });
    setAudio(null);
    await qc.invalidateQueries({ queryKey: ["gro-workspace"] });
    toast.success("Reporte privado registrado");
  }
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-lg border border-teal-700/20 bg-teal-50 p-4 text-sm text-teal-950">
        <Lock className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          <strong>Área privada da consultoria.</strong> Reportes não chegam automaticamente ao
          cliente; somente conteúdo validado e incorporado ao relatório publicado pode ser entregue.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo reporte de visita</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <div>
            <Label>Data</Label>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
            />
          </div>
          <div>
            <Label>Tags (separadas por vírgula)</Label>
            <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label>Percepções e observações</Label>
            <Textarea
              className="min-h-28"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div>
            <Label>Áudio da visita</Label>
            <Input
              type="file"
              accept="audio/*"
              onChange={(e) => setAudio(e.target.files?.[0] ?? null)}
            />
          </div>
          <label className="flex items-center gap-2 self-end text-sm">
            <Checkbox
              checked={form.include}
              onCheckedChange={(value) => setForm({ ...form, include: value === true })}
            />
            Associar à preparação do relatório
          </label>
          <p className="text-xs text-muted-foreground md:col-span-2">
            O áudio é armazenado com acesso restrito. A transcrição automática não é simulada porque
            não há pipeline GRO configurado; o texto permanece editável.
          </p>
          <Button onClick={create}>
            <Plus className="mr-2 h-4 w-4" />
            Registrar reporte
          </Button>
        </CardContent>
      </Card>
      <div className="grid gap-3 lg:grid-cols-2">
        {reports.map((item: any) => (
          <Card key={item.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">
                  Visita em {formatDate(item.visited_on)}
                </span>
                <Badge variant="outline">{item.status}</Badge>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                {item.notes || "Áudio sem transcrição"}
              </p>
              <div className="mt-3 flex flex-wrap gap-1">
                {item.tags?.map((tag: string) => (
                  <Badge key={tag} variant="secondary">
                    {tag}
                  </Badge>
                ))}
              </div>
              {item.audio_path && (
                <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <Mic className="h-3 w-3" />
                  Áudio privado anexado
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
