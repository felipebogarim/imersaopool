import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { syncAgendaInvitees } from "@/lib/agenda.functions";
import type { AgendaEvent, AgendaEventForm, AgendaUser } from "@/lib/agenda-types";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: AgendaEvent | null;
  initialStartsAt: string;
  currentUserId: string;
  companyId: string;
  users: AgendaUser[];
  onSaved: () => void;
};

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 240, 480];

function toInputValue(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}

export function AgendaEventDialog({
  open,
  onOpenChange,
  event,
  initialStartsAt,
  currentUserId,
  companyId,
  users,
  onSaved,
}: Props) {
  const syncInvitees = useServerFn(syncAgendaInvitees);
  const canEdit = !event || event.owner_id === currentUserId;
  const [form, setForm] = useState<AgendaEventForm>({
    title: "",
    startsAt: toInputValue(initialStartsAt),
    durationMinutes: 60,
    details: "",
    inviteeIds: [],
  });
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      title: event?.title ?? "",
      startsAt: toInputValue(event?.starts_at ?? initialStartsAt),
      durationMinutes: event?.duration_minutes ?? 60,
      details: event?.details ?? "",
      inviteeIds: event?.invitees?.map((invitee) => invitee.invitee_id) ?? [],
    });
    setSearch("");
  }, [event, initialStartsAt, open]);

  const availableUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users
      .filter((user) => user.id !== currentUserId)
      .filter((user) => !term || `${user.full_name ?? ""} ${user.email ?? ""}`.toLowerCase().includes(term));
  }, [currentUserId, search, users]);

  function toggleInvitee(userId: string) {
    setForm((current) => ({
      ...current,
      inviteeIds: current.inviteeIds.includes(userId)
        ? current.inviteeIds.filter((id) => id !== userId)
        : [...current.inviteeIds, userId],
    }));
  }

  async function save() {
    if (!form.title.trim()) return toast.error("Informe o título do compromisso");
    if (!form.startsAt) return toast.error("Informe a data e o horário");
    const startsAt = new Date(form.startsAt);
    if (Number.isNaN(startsAt.getTime())) return toast.error("Data ou horário inválido");

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        starts_at: startsAt.toISOString(),
        duration_minutes: form.durationMinutes,
        details: form.details.trim() || null,
        owner_id: currentUserId,
        company_id: companyId,
      };
      let eventId = event?.id;
      if (event) {
        const { error } = await supabase.from("agenda_events").update(payload).eq("id", event.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("agenda_events").insert(payload).select("id").single();
        if (error) throw error;
        eventId = data.id;
      }
      if (!eventId) throw new Error("Não foi possível identificar o compromisso salvo");

      const result = await syncInvitees({ data: { eventId, inviteeIds: form.inviteeIds } });
      toast.success(event ? "Compromisso atualizado" : "Compromisso criado", {
        description: result.sent > 0
          ? `${result.sent} convite${result.sent > 1 ? "s" : ""} enviado${result.sent > 1 ? "s" : ""} por e-mail.`
          : undefined,
      });
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error("Não foi possível salvar o compromisso", {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!event || !canEdit || !confirm(`Excluir o compromisso “${event.title}”?`)) return;
    setSaving(true);
    const { error } = await supabase.from("agenda_events").delete().eq("id", event.id);
    setSaving(false);
    if (error) return toast.error("Não foi possível excluir", { description: error.message });
    toast.success("Compromisso excluído");
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{event ? (canEdit ? "Editar compromisso" : "Detalhes do compromisso") : "Novo compromisso"}</DialogTitle>
          <DialogDescription>
            {canEdit ? "Organize a data e convide participantes da sua empresa." : "Você participa deste compromisso como convidado."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agenda-title">Título</Label>
            <Input
              id="agenda-title"
              value={form.title}
              onChange={(e) => setForm((current) => ({ ...current, title: e.target.value }))}
              disabled={!canEdit}
              placeholder="Ex.: Reunião de alinhamento"
              maxLength={160}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_180px]">
            <div className="space-y-2">
              <Label htmlFor="agenda-start">Data e horário</Label>
              <Input
                id="agenda-start"
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm((current) => ({ ...current, startsAt: e.target.value }))}
                disabled={!canEdit}
              />
            </div>
            <div className="space-y-2">
              <Label>Duração</Label>
              <Select
                value={String(form.durationMinutes)}
                onValueChange={(value) => setForm((current) => ({ ...current, durationMinutes: Number(value) }))}
                disabled={!canEdit}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DURATIONS.map((duration) => (
                    <SelectItem key={duration} value={String(duration)}>{durationLabel(duration)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="agenda-details">Detalhes</Label>
            <Textarea
              id="agenda-details"
              value={form.details}
              onChange={(e) => setForm((current) => ({ ...current, details: e.target.value }))}
              disabled={!canEdit}
              placeholder="Pauta, local ou informações importantes"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2"><UserRound className="h-4 w-4" /> Convidados</Label>
            {canEdit && (
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou e-mail"
              />
            )}
            <div className="max-h-52 overflow-y-auto rounded-md border bg-muted/20 p-1">
              {availableUsers.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
              ) : availableUsers.map((user) => {
                const selected = form.inviteeIds.includes(user.id);
                if (!canEdit && !selected) return null;
                return (
                  <button
                    key={user.id}
                    type="button"
                    className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left hover:bg-accent disabled:hover:bg-transparent"
                    onClick={() => toggleInvitee(user.id)}
                    disabled={!canEdit}
                  >
                    <Checkbox checked={selected} className="pointer-events-none" />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{user.full_name ?? user.email ?? "Usuário"}</span>
                      {user.email && <span className="block truncate text-xs text-muted-foreground">{user.email}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:justify-between sm:space-x-0">
          {event && canEdit ? (
            <Button type="button" variant="destructive" onClick={remove} disabled={saving}>
              <Trash2 /> Excluir
            </Button>
          ) : <span />}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
            {canEdit && (
              <Button type="button" onClick={save} disabled={saving || !form.title.trim()}>
                {saving && <Loader2 className="animate-spin" />} Salvar
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}