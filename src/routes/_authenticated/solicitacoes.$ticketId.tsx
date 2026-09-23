import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getInternalTicket,
  listCategories,
  listProfilesByIds,
  listSectors,
  listTicketAttachments,
  listTicketEvents,
  listTicketMessages,
  listTicketProductIds,
  listTicketRecipients,
  listTicketSectorStops,
  listProductsLite,
} from "@/lib/internal-tickets/queries";
import { TICKET_STATUS_LABEL } from "@/lib/internal-tickets/status";
import { TICKET_PRIORITY_LABEL } from "@/lib/internal-tickets/priority";
import { buildSectorTimeline } from "@/lib/internal-tickets/sector-timeline";
import { SectorTimeline } from "@/components/internal-tickets/SectorTimeline";
import { StatusChangePanel } from "@/components/internal-tickets/detail/StatusChangePanel";
import { ReassignSectorPanel } from "@/components/internal-tickets/detail/ReassignSectorPanel";
import { ManualInteractionPanel } from "@/components/internal-tickets/detail/ManualInteractionPanel";
import { AttachmentsPanel } from "@/components/internal-tickets/detail/AttachmentsPanel";
import { TicketTimelineFeed } from "@/components/internal-tickets/detail/TicketTimelineFeed";

export const Route = createFileRoute("/_authenticated/solicitacoes/$ticketId")({
  head: () => ({ meta: [{ title: "Ticket — Solicitações Internas — PoolFlux" }] }),
  component: TicketDetailPage,
});

function TicketDetailPage() {
  const { ticketId } = Route.useParams();

  const ticketQuery = useQuery({
    queryKey: ["internal-ticket", ticketId],
    queryFn: () => getInternalTicket(ticketId),
  });
  const sectorsQuery = useQuery({ queryKey: ["internal-ticket-sectors"], queryFn: listSectors });
  const categoriesQuery = useQuery({
    queryKey: ["internal-ticket-categories"],
    queryFn: listCategories,
  });
  const recipientsQuery = useQuery({
    queryKey: ["internal-ticket-recipients", ticketId],
    queryFn: () => listTicketRecipients(ticketId),
  });
  const eventsQuery = useQuery({
    queryKey: ["internal-ticket-events", ticketId],
    queryFn: () => listTicketEvents(ticketId),
  });
  const messagesQuery = useQuery({
    queryKey: ["internal-ticket-messages", ticketId],
    queryFn: () => listTicketMessages(ticketId),
  });
  const attachmentsQuery = useQuery({
    queryKey: ["internal-ticket-attachments", ticketId],
    queryFn: () => listTicketAttachments(ticketId),
  });
  const sectorStopsQuery = useQuery({
    queryKey: ["internal-ticket-sector-stops", ticketId],
    queryFn: () => listTicketSectorStops(ticketId),
  });
  const productIdsQuery = useQuery({
    queryKey: ["internal-ticket-product-ids", ticketId],
    queryFn: () => listTicketProductIds(ticketId),
  });
  const productsQuery = useQuery({
    queryKey: ["internal-ticket-products-lite"],
    queryFn: listProductsLite,
  });
  const ticket = ticketQuery.data;
  const profilesQuery = useQuery({
    queryKey: [
      "internal-ticket-profiles",
      ticket?.requester_user_id,
      ticket?.commercial_owner_user_id,
    ],
    queryFn: () => listProfilesByIds([ticket!.requester_user_id, ticket!.commercial_owner_user_id]),
    enabled: Boolean(ticket),
  });

  const sectorNameById = (id: string) => sectorsQuery.data?.find((s) => s.id === id)?.name ?? "—";
  const sectorName = ticket ? sectorNameById(ticket.sector_id) : "—";
  const categoryName = categoriesQuery.data?.find((c) => c.id === ticket?.category_id)?.name ?? "—";
  const requesterName =
    profilesQuery.data?.find((p) => p.id === ticket?.requester_user_id)?.full_name ?? "—";
  const ownerName =
    profilesQuery.data?.find((p) => p.id === ticket?.commercial_owner_user_id)?.full_name ?? "—";

  const sectorTimeline = useMemo(
    () =>
      buildSectorTimeline(
        (sectorStopsQuery.data ?? []).map((s) => ({
          sectorId: s.sector_id,
          enteredAt: new Date(s.entered_at),
          leftAt: s.left_at ? new Date(s.left_at) : null,
        })),
        (eventsQuery.data ?? []).map((e) => ({
          toStatus: e.to_status,
          createdAt: new Date(e.created_at),
        })),
      ),
    [sectorStopsQuery.data, eventsQuery.data],
  );

  if (ticketQuery.isLoading || !ticket) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Carregando…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-10">
      <PageHeader
        title={ticket.title}
        subtitle={ticket.ticket_number}
        actions={
          <Button asChild variant="ghost" size="sm" className="gap-2">
            <Link to="/solicitacoes">
              <ArrowLeft className="h-4 w-4" /> Voltar
            </Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-8">
        <div className="flex flex-wrap gap-2 text-xs">
          <Badge variant="outline">{TICKET_STATUS_LABEL[ticket.status]}</Badge>
          <Badge variant="outline">{TICKET_PRIORITY_LABEL[ticket.priority]}</Badge>
          <Badge variant="outline">{sectorName}</Badge>
          <Badge variant="outline">{categoryName}</Badge>
        </div>

        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{ticket.description}</p>

        <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
          <p>
            Solicitante: <span className="text-foreground">{requesterName}</span>
          </p>
          <p>
            Responsável comercial: <span className="text-foreground">{ownerName}</span>
          </p>
        </div>

        {recipientsQuery.data && recipientsQuery.data.length > 0 && (
          <div className="rounded-lg border p-3 text-xs">
            <p className="mb-1 font-medium text-muted-foreground">Destinatários</p>
            <ul className="space-y-0.5">
              {recipientsQuery.data.map((r) => (
                <li key={r.id}>
                  {r.name_snapshot ?? r.email} ({r.email}) — {r.role}
                </li>
              ))}
            </ul>
          </div>
        )}

        {productIdsQuery.data && productIdsQuery.data.length > 0 && (
          <div className="rounded-lg border p-3 text-xs">
            <p className="mb-1 font-medium text-muted-foreground">Produtos</p>
            <div className="flex flex-wrap gap-1">
              {productIdsQuery.data.map((id) => (
                <Badge key={id} variant="outline">
                  {productsQuery.data?.find((p) => p.id === id)?.nome ?? id}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <StatusChangePanel ticketId={ticketId} currentStatus={ticket.status} />

        <ReassignSectorPanel
          ticketId={ticketId}
          currentSectorId={ticket.sector_id}
          currentSectorName={sectorName}
          sectors={sectorsQuery.data ?? []}
        />

        <div className="space-y-2 rounded-lg border p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Timeline de setores
          </p>
          <SectorTimeline entries={sectorTimeline} sectorName={sectorNameById} />
        </div>

        <ManualInteractionPanel ticketId={ticketId} />

        <AttachmentsPanel ticketId={ticketId} />

        <TicketTimelineFeed
          events={eventsQuery.data ?? []}
          messages={messagesQuery.data ?? []}
          attachments={attachmentsQuery.data ?? []}
        />
      </div>
    </div>
  );
}
