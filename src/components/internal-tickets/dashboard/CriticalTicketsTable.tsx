import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DashboardTicket } from "@/lib/internal-tickets/dashboard-metrics";
import { TICKET_PRIORITY_LABEL } from "@/lib/internal-tickets/priority";
import { TICKET_STATUS_LABEL } from "@/lib/internal-tickets/status";

export function CriticalTicketsTable({
  tickets,
  ticketTitle,
  ticketNumber,
  sectorName,
  onSelect,
}: {
  tickets: DashboardTicket[];
  ticketTitle: (id: string) => string;
  ticketNumber: (id: string) => string;
  sectorName: (id: string) => string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b p-3">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <h3 className="text-sm font-semibold">Tickets críticos</h3>
        <span className="text-xs text-muted-foreground">urgentes ou atrasados</span>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ticket</TableHead>
            <TableHead>Setor</TableHead>
            <TableHead>Prioridade</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tickets.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                Nenhum ticket crítico no momento.
              </TableCell>
            </TableRow>
          )}
          {tickets.slice(0, 10).map((t) => (
            <TableRow
              key={t.id}
              className="cursor-pointer hover:bg-muted/40"
              onClick={() => onSelect(t.id)}
            >
              <TableCell className="font-medium">
                <span className="text-xs text-muted-foreground">{ticketNumber(t.id)}</span>
                <span className="block">{ticketTitle(t.id)}</span>
              </TableCell>
              <TableCell>{sectorName(t.sectorId)}</TableCell>
              <TableCell>
                <Badge variant="outline">{TICKET_PRIORITY_LABEL[t.priority]}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant="outline">{TICKET_STATUS_LABEL[t.status]}</Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
