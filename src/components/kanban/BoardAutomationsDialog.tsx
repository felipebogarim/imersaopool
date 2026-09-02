import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import type { Board, KList } from "@/lib/kanban-types";

interface Props {
  board: Board;
  lists: KList[];
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const TRIGGERS = [
  { v: "card_moved_to_list", label: "Quando card é movido para lista" },
  { v: "card_created", label: "Quando um card é criado" },
  { v: "due_date_approaching", label: "Quando o prazo se aproxima" },
  { v: "checklist_completed", label: "Quando um checklist é concluído" },
];

const ACTIONS = [
  { v: "move_to_list", label: "Mover para lista" },
  { v: "assign_member", label: "Atribuir a responsável" },
  { v: "add_label", label: "Adicionar label" },
  { v: "send_notification", label: "Enviar notificação" },
  { v: "archive_card", label: "Arquivar card" },
];

export function BoardAutomationsDialog({ board, lists, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState("card_moved_to_list");
  const [action, setAction] = useState("assign_member");
  const [triggerListId, setTriggerListId] = useState("");
  const [actionListId, setActionListId] = useState("");
  const [actionUserEmail, setActionUserEmail] = useState("");

  const { data: automations = [] } = useQuery({
    queryKey: ["kanban-automations", board.id],
    queryFn: async () => {
      const { data } = await supabase.from("kanban_automations").select("*").eq("board_id", board.id).order("created_at");
      return data ?? [];
    },
    enabled: open,
  });

  async function create() {
    if (!name.trim()) return toast.error("Dê um nome à automação");
    const { data: u } = await supabase.auth.getUser();
    const trigger_config: any = {};
    const action_config: any = {};
    if (trigger === "card_moved_to_list") trigger_config.list_id = triggerListId || undefined;
    if (action === "move_to_list") action_config.list_id = actionListId;
    if (action === "assign_member" || action === "send_notification") {
      if (actionUserEmail.trim()) {
        const mail = actionUserEmail.trim().toLowerCase();
        const { data: prof } = await supabase.from("profiles").select("id").eq("email", mail).maybeSingle();
        if (!prof && action === "assign_member") return toast.error("Usuário não encontrado");
        if (prof) action_config.user_id = prof.id;
        if (action === "send_notification") {
          action_config.email = mail;
          action_config.message = `Automação "${name}" disparada`;
        }
      }
    }


    const { error } = await supabase.from("kanban_automations").insert({
      board_id: board.id, name: name.trim(),
      trigger: trigger as any, trigger_config,
      action: action as any, action_config,
      created_by: u.user!.id,
    });
    if (error) return toast.error(error.message);
    toast.success("Automação criada");
    setCreating(false); setName(""); setTriggerListId(""); setActionListId(""); setActionUserEmail("");
    qc.invalidateQueries({ queryKey: ["kanban-automations", board.id] });
  }

  async function toggle(a: any) {
    await supabase.from("kanban_automations").update({ enabled: !a.enabled }).eq("id", a.id);
    qc.invalidateQueries({ queryKey: ["kanban-automations", board.id] });
  }
  async function del(id: string) {
    if (!confirm("Excluir automação?")) return;
    await supabase.from("kanban_automations").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["kanban-automations", board.id] });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Automações do board</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <ul className="divide-y rounded-lg border">
            {automations.length === 0 && (
              <li className="p-4 text-sm text-muted-foreground">Nenhuma automação configurada.</li>
            )}
            {automations.map((a: any) => (
              <li key={a.id} className="flex items-center justify-between p-3">
                <div>
                  <div className="text-sm font-medium">{a.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {TRIGGERS.find((t) => t.v === a.trigger)?.label} → {ACTIONS.find((x) => x.v === a.action)?.label}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={a.enabled} onCheckedChange={() => toggle(a)} />
                  <button onClick={() => del(a.id)}><Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" /></button>
                </div>
              </li>
            ))}
          </ul>

          {creating ? (
            <div className="space-y-2 rounded-lg border p-3">
              <Input placeholder="Nome da automação" value={name} onChange={(e) => setName(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Gatilho</label>
                  <Select value={trigger} onValueChange={setTrigger}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TRIGGERS.map((t) => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                  {trigger === "card_moved_to_list" && (
                    <Select value={triggerListId} onValueChange={setTriggerListId}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Qualquer lista" /></SelectTrigger>
                      <SelectContent>{lists.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Ação</label>
                  <Select value={action} onValueChange={setAction}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ACTIONS.map((t) => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                  {action === "move_to_list" && (
                    <Select value={actionListId} onValueChange={setActionListId}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Lista destino" /></SelectTrigger>
                      <SelectContent>{lists.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                  {(action === "assign_member" || action === "send_notification") && (
                    <Input className="mt-1" placeholder="e-mail do usuário" value={actionUserEmail} onChange={(e) => setActionUserEmail(e.target.value)} />
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={create}>Criar</Button>
                <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>Cancelar</Button>
              </div>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setCreating(true)} className="w-full gap-2">
              <Plus className="h-4 w-4" /> Nova automação
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
