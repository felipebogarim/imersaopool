import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Database, ShieldCheck, Lock } from "lucide-react";

const SENSIB_META: Record<string, { label: string; cls: string }> = {
  publico:        { label: "Público",         cls: "bg-slate-100 text-slate-700" },
  interno:        { label: "Interno",         cls: "bg-sky-100 text-sky-800" },
  confidencial:   { label: "Confidencial",    cls: "bg-amber-100 text-amber-800" },
  restrito:       { label: "Restrito",        cls: "bg-orange-100 text-orange-800" },
  sensivel_lgpd:  { label: "Sensível (LGPD)", cls: "bg-red-100 text-red-800" },
};

type Row = {
  id: string; dominio: string; descricao: string | null; tabelas: string[];
  sensibilidade: string; base_legal: string | null; retencao_dias: number | null;
  criptografia: string | null; responsavel: string | null; observacoes: string | null;
};

const EMPTY: Partial<Row> = {
  dominio: "", descricao: "", tabelas: [], sensibilidade: "interno",
  base_legal: "", retencao_dias: 365, criptografia: "em_transito_e_repouso",
  responsavel: "", observacoes: "",
};

export function DataProtectionTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Row> | null>(null);
  const [tabelasStr, setTabelasStr] = useState("");

  const q = useQuery({
    queryKey: ["data-classifications"],
    queryFn: async () => {
      const { data, error } = await supabase.from("data_classifications").select("*").order("dominio");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const rows = q.data ?? [];
  const total = rows.length;
  const sensiveis = rows.filter(r => r.sensibilidade === "sensivel_lgpd" || r.sensibilidade === "restrito").length;
  const tabelasCobertas = new Set(rows.flatMap(r => r.tabelas)).size;

  function startNew() {
    setEditing({ ...EMPTY });
    setTabelasStr("");
    setOpen(true);
  }
  function startEdit(r: Row) {
    setEditing(r);
    setTabelasStr((r.tabelas ?? []).join(", "));
    setOpen(true);
  }
  async function save() {
    if (!editing?.dominio) return alert("Domínio é obrigatório");
    const payload = {
      ...editing,
      tabelas: tabelasStr.split(",").map(s => s.trim()).filter(Boolean),
      retencao_dias: editing.retencao_dias ? Number(editing.retencao_dias) : null,
    };
    if (editing.id) {
      const { error } = await supabase.from("data_classifications").update(payload).eq("id", editing.id);
      if (error) return alert(error.message);
    } else {
      const { error } = await supabase.from("data_classifications").insert(payload);
      if (error) return alert(error.message);
    }
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["data-classifications"] });
  }
  async function remove(id: string) {
    if (!confirm("Remover esta classificação?")) return;
    const { error } = await supabase.from("data_classifications").delete().eq("id", id);
    if (error) return alert(error.message);
    qc.invalidateQueries({ queryKey: ["data-classifications"] });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Database className="h-4 w-4" /> Domínios classificados</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{total}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Tabelas cobertas</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{tabelasCobertas}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Lock className="h-4 w-4" /> Domínios sensíveis/restritos</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-orange-700">{sensiveis}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Inventário de Classificação de Dados</CardTitle>
          <Button onClick={startNew}><Plus className="h-4 w-4 mr-2" /> Novo domínio</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domínio</TableHead>
                <TableHead>Sensibilidade</TableHead>
                <TableHead>Tabelas</TableHead>
                <TableHead>Base Legal</TableHead>
                <TableHead>Retenção</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => {
                const s = SENSIB_META[r.sensibilidade] ?? SENSIB_META.interno;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {r.dominio}
                      {r.descricao && <div className="text-xs text-muted-foreground">{r.descricao}</div>}
                    </TableCell>
                    <TableCell><Badge className={s.cls} variant="secondary">{s.label}</Badge></TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-wrap gap-1 max-w-md">
                        {(r.tabelas ?? []).map(t => (
                          <span key={t} className="px-1.5 py-0.5 rounded bg-muted font-mono">{t}</span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">{r.base_legal ?? "—"}</TableCell>
                    <TableCell className="text-xs">{r.retencao_dias ? `${r.retencao_dias} dias` : "—"}</TableCell>
                    <TableCell className="text-xs">{r.responsavel ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => startEdit(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Nenhuma classificação cadastrada.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar classificação" : "Nova classificação de dados"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Domínio *</Label>
                <Input value={editing.dominio ?? ""} onChange={e => setEditing({ ...editing, dominio: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Descrição</Label>
                <Textarea rows={2} value={editing.descricao ?? ""} onChange={e => setEditing({ ...editing, descricao: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Tabelas (separadas por vírgula)</Label>
                <Input value={tabelasStr} onChange={e => setTabelasStr(e.target.value)} placeholder="profiles, user_roles" />
              </div>
              <div>
                <Label>Sensibilidade</Label>
                <Select value={editing.sensibilidade} onValueChange={v => setEditing({ ...editing, sensibilidade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SENSIB_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Retenção (dias)</Label>
                <Input type="number" value={editing.retencao_dias ?? ""} onChange={e => setEditing({ ...editing, retencao_dias: e.target.value as any })} />
              </div>
              <div className="col-span-2">
                <Label>Base legal (LGPD)</Label>
                <Input value={editing.base_legal ?? ""} onChange={e => setEditing({ ...editing, base_legal: e.target.value })} placeholder="Execução de contrato, Consentimento, Legítimo interesse..." />
              </div>
              <div>
                <Label>Responsável</Label>
                <Input value={editing.responsavel ?? ""} onChange={e => setEditing({ ...editing, responsavel: e.target.value })} />
              </div>
              <div>
                <Label>Criptografia</Label>
                <Input value={editing.criptografia ?? ""} onChange={e => setEditing({ ...editing, criptografia: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Observações</Label>
                <Textarea rows={2} value={editing.observacoes ?? ""} onChange={e => setEditing({ ...editing, observacoes: e.target.value })} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
