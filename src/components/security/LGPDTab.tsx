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
import { Plus, Scale, ClockAlert, CheckCheck, Ban } from "lucide-react";

const TIPO_LABEL: Record<string, string> = {
  acesso: "Acesso aos dados",
  correcao: "Correção",
  exclusao: "Exclusão",
  portabilidade: "Portabilidade",
  revogacao_consentimento: "Revogar consentimento",
  oposicao: "Oposição",
  anonimizacao: "Anonimização",
  confirmacao: "Confirmação de tratamento",
  outros: "Outros",
};

const STATUS_META: Record<string, string> = {
  aberta: "bg-sky-100 text-sky-800",
  em_analise: "bg-amber-100 text-amber-800",
  aguardando_titular: "bg-purple-100 text-purple-800",
  concluida: "bg-emerald-100 text-emerald-800",
  recusada: "bg-red-100 text-red-800",
  encaminhada: "bg-slate-100 text-slate-700",
};

type Row = {
  id: string; titular_nome: string; titular_email: string; titular_documento: string | null;
  tipo: string; descricao: string | null; status: string;
  prazo_legal_em: string | null; respondida_em: string | null; resposta: string | null;
  created_at: string;
};

const EMPTY: Partial<Row> = {
  titular_nome: "", titular_email: "", titular_documento: "",
  tipo: "acesso", descricao: "", status: "aberta",
};

export function LGPDTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Row> | null>(null);

  const q = useQuery({
    queryKey: ["privacy-requests"],
    queryFn: async () => {
      const { data, error } = await supabase.from("privacy_requests")
        .select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const rows = q.data ?? [];
  const abertas = rows.filter(r => !["concluida", "recusada", "encaminhada"].includes(r.status)).length;
  const atrasadas = rows.filter(r => r.prazo_legal_em && new Date(r.prazo_legal_em) < new Date() && !["concluida", "recusada"].includes(r.status)).length;
  const concluidas = rows.filter(r => r.status === "concluida").length;
  const recusadas = rows.filter(r => r.status === "recusada").length;

  function startNew() {
    // LGPD art. 19: prazo padrão de 15 dias
    const prazo = new Date();
    prazo.setDate(prazo.getDate() + 15);
    setEditing({ ...EMPTY, prazo_legal_em: prazo.toISOString().slice(0, 10) });
    setOpen(true);
  }
  function startEdit(r: Row) {
    setEditing({ ...r, prazo_legal_em: r.prazo_legal_em ? r.prazo_legal_em.slice(0, 10) : null });
    setOpen(true);
  }
  async function save() {
    if (!editing?.titular_nome || !editing?.titular_email || !editing?.tipo) {
      return alert("Nome, email e tipo são obrigatórios");
    }
    const payload = {
      titular_nome: editing.titular_nome,
      titular_email: editing.titular_email,
      titular_documento: editing.titular_documento ?? null,
      tipo: editing.tipo,
      descricao: editing.descricao ?? null,
      status: editing.status ?? "aberta",
      prazo_legal_em: editing.prazo_legal_em ? new Date(editing.prazo_legal_em).toISOString() : null,
      resposta: editing.resposta ?? null,
      respondida_em: editing.status === "concluida" || editing.status === "recusada"
        ? (editing.respondida_em ?? new Date().toISOString())
        : editing.respondida_em ?? null,
    };
    if (editing.id) {
      const { error } = await supabase.from("privacy_requests").update(payload).eq("id", editing.id);
      if (error) return alert(error.message);
    } else {
      const { error } = await supabase.from("privacy_requests").insert(payload);
      if (error) return alert(error.message);
    }
    await supabase.rpc("log_security_event", {
      _tipo: "lgpd",
      _acao: editing.id ? "atualizar_solicitacao" : "criar_solicitacao",
      _recurso: editing.titular_email,
      _resultado: "sucesso",
      _nivel_risco: "info",
      _metadata: { tipo: editing.tipo, status: payload.status } as any,
    });
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["privacy-requests"] });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Scale className="h-4 w-4" /> Em aberto</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{abertas}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><ClockAlert className="h-4 w-4" /> Fora do prazo</CardTitle></CardHeader>
          <CardContent><div className={`text-3xl font-bold ${atrasadas > 0 ? "text-red-700" : ""}`}>{atrasadas}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><CheckCheck className="h-4 w-4" /> Concluídas</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold text-emerald-700">{concluidas}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2"><Ban className="h-4 w-4" /> Recusadas</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold">{recusadas}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Solicitações de titulares (LGPD)</CardTitle>
          <Button onClick={startNew}><Plus className="h-4 w-4 mr-2" /> Nova solicitação</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titular</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Criada em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(r => {
                const atrasada = r.prazo_legal_em && new Date(r.prazo_legal_em) < new Date()
                  && !["concluida", "recusada"].includes(r.status);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium text-sm">{r.titular_nome}</div>
                      <div className="text-xs text-muted-foreground">{r.titular_email}</div>
                    </TableCell>
                    <TableCell className="text-xs">{TIPO_LABEL[r.tipo] ?? r.tipo}</TableCell>
                    <TableCell>
                      <Badge className={STATUS_META[r.status] ?? "bg-slate-100"} variant="secondary">
                        {r.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.prazo_legal_em
                        ? <span className={atrasada ? "text-red-700 font-semibold" : ""}>{new Date(r.prazo_legal_em).toLocaleDateString("pt-BR")}</span>
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString("pt-BR")}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => startEdit(r)}>Abrir</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma solicitação registrada.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Solicitação LGPD" : "Nova solicitação LGPD"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome do titular *</Label>
                <Input value={editing.titular_nome ?? ""} onChange={e => setEditing({ ...editing, titular_nome: e.target.value })} />
              </div>
              <div>
                <Label>Email do titular *</Label>
                <Input type="email" value={editing.titular_email ?? ""} onChange={e => setEditing({ ...editing, titular_email: e.target.value })} />
              </div>
              <div>
                <Label>Documento (CPF/RG)</Label>
                <Input value={editing.titular_documento ?? ""} onChange={e => setEditing({ ...editing, titular_documento: e.target.value })} />
              </div>
              <div>
                <Label>Tipo *</Label>
                <Select value={editing.tipo} onValueChange={v => setEditing({ ...editing, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TIPO_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={editing.status} onValueChange={v => setEditing({ ...editing, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(STATUS_META).map(k => <SelectItem key={k} value={k}>{k.replace(/_/g, " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Prazo legal (LGPD: 15 dias)</Label>
                <Input type="date" value={(editing.prazo_legal_em ?? "").toString().slice(0, 10)} onChange={e => setEditing({ ...editing, prazo_legal_em: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Descrição da solicitação</Label>
                <Textarea rows={3} value={editing.descricao ?? ""} onChange={e => setEditing({ ...editing, descricao: e.target.value })} />
              </div>
              <div className="col-span-2">
                <Label>Resposta ao titular</Label>
                <Textarea rows={3} value={editing.resposta ?? ""} onChange={e => setEditing({ ...editing, resposta: e.target.value })} placeholder="Registro da resposta enviada ao titular..." />
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
