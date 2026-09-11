import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { AgendaCalendar, createStartsAt, moveCursor, periodTitle, visibleRange } from "@/components/agenda/AgendaCalendar";
import { AgendaEventDialog } from "@/components/agenda/AgendaEventDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getAgendaUsers } from "@/lib/agenda.functions";
import type { AgendaEvent, AgendaUser, AgendaView } from "@/lib/agenda-types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/ferramentas/agenda")({
  head: () => ({
    meta: [
      { title: "Agenda — PoolFlux" },
      { name: "description", content: "Agenda compartilhada para organizar compromissos e convidar participantes." },
      { property: "og:title", content: "Agenda — PoolFlux" },
      { property: "og:description", content: "Agenda compartilhada para organizar compromissos e convidar participantes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgendaPage,
});

const VIEWS: { value: AgendaView; label: string }[] = [
  { value: "day", label: "Dia" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mês" },
  { value: "year", label: "Ano" },
];

function AgendaPage() {
  const queryClient = useQueryClient();
  const loadUsers = useServerFn(getAgendaUsers);
  const [view, setView] = useState<AgendaView>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<AgendaEvent | null>(null);
  const [newStartsAt, setNewStartsAt] = useState(() => createStartsAt(new Date()));
  const range = useMemo(() => visibleRange(view, cursor), [cursor, view]);

  const { data: account, isLoading: accountLoading } = useQuery({
    queryKey: ["agenda-account"],
    queryFn: async () => {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) throw new Error("Sessão não encontrada");
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("active_company_id")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (error) throw error;
      return { userId: auth.user.id, companyId: profile?.active_company_id ?? null };
    },
  });

  const { data: users = [] } = useQuery({
    queryKey: ["agenda-users"],
    queryFn: () => loadUsers() as Promise<AgendaUser[]>,
    enabled: Boolean(account?.userId),
    staleTime: 5 * 60_000,
  });

  const { data: events = [], isLoading: eventsLoading, error } = useQuery({
    queryKey: ["agenda-events", range.start.toISOString(), range.end.toISOString()],
    queryFn: async () => {
      const { data, error: queryError } = await supabase
        .from("agenda_events")
        .select("*, invitees:agenda_event_invitees(invitee_id)")
        .gte("starts_at", range.start.toISOString())
        .lt("starts_at", range.end.toISOString())
        .order("starts_at");
      if (queryError) throw queryError;
      return (data ?? []) as AgendaEvent[];
    },
    enabled: Boolean(account?.userId),
  });

  function openNew(date = new Date()) {
    setSelectedEvent(null);
    setNewStartsAt(createStartsAt(date));
    setDialogOpen(true);
  }

  function openEvent(event: AgendaEvent) {
    setSelectedEvent(event);
    setNewStartsAt(event.starts_at);
    setDialogOpen(true);
  }

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["agenda-events"] });
  }

  return (
    <div className="min-h-screen">
      <PageHeader
        title="Agenda"
        subtitle="Organize seus compromissos e convide participantes."
        actions={<Button onClick={() => openNew()}><Plus /> Novo compromisso</Button>}
      />

      <div className="space-y-4 px-4 py-5 sm:px-8">
        <div className="flex flex-col gap-3 rounded-lg border bg-card p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Período anterior" onClick={() => setCursor((date) => moveCursor(view, date, -1))}>
              <ChevronLeft />
            </Button>
            <Button variant="outline" onClick={() => setCursor(new Date())}>Hoje</Button>
            <Button variant="outline" size="icon" aria-label="Próximo período" onClick={() => setCursor((date) => moveCursor(view, date, 1))}>
              <ChevronRight />
            </Button>
            <h2 className="ml-2 text-base font-semibold capitalize sm:text-lg">{periodTitle(view, cursor)}</h2>
          </div>

          <div className="grid grid-cols-4 rounded-md border bg-muted/30 p-1">
            {VIEWS.map((item) => (
              <Button
                key={item.value}
                variant="ghost"
                size="sm"
                onClick={() => setView(item.value)}
                className={cn("shadow-none", view === item.value && "bg-background text-foreground shadow-sm")}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="gap-1.5"><span className="h-2 w-2 rounded-full bg-primary" /> Meus compromissos</Badge>
          <Badge variant="outline" className="gap-1.5"><span className="h-2 w-2 rounded-full bg-warning" /> Convites recebidos</Badge>
        </div>

        {accountLoading || eventsLoading ? (
          <div className="grid min-h-[480px] place-items-center rounded-lg border bg-card text-sm text-muted-foreground">
            <span className="flex items-center gap-2"><CalendarDays className="h-5 w-5" /> Carregando agenda…</span>
          </div>
        ) : error ? (
          <div className="grid min-h-60 place-items-center rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
            <p className="text-sm text-destructive">Não foi possível carregar a agenda.</p>
          </div>
        ) : account?.companyId ? (
          <AgendaCalendar
            view={view}
            cursor={cursor}
            events={events}
            currentUserId={account.userId}
            onSelectDay={openNew}
            onSelectEvent={openEvent}
          />
        ) : (
          <div className="grid min-h-60 place-items-center rounded-lg border bg-card p-6 text-center">
            <p className="max-w-md text-sm text-muted-foreground">Selecione uma empresa ativa para usar a Agenda.</p>
          </div>
        )}
      </div>

      {account?.companyId && (
        <AgendaEventDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          event={selectedEvent}
          initialStartsAt={newStartsAt}
          currentUserId={account.userId}
          companyId={account.companyId}
          users={users}
          onSaved={refresh}
        />
      )}
    </div>
  );
}