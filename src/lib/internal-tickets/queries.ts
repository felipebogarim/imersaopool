import { supabase } from "@/integrations/supabase/client";
import type { TicketPriority } from "./priority";
import type { TicketStatus } from "./status";

// internal_ticket_* ainda não está no types.ts gerado — mesma ressalva do
// resto do módulo (ver admin.functions.ts).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function db(): any {
  return supabase;
}

export type Sector = {
  id: string;
  name: string;
  active: boolean;
  manager_person_id: string | null;
  default_sla_first_response_minutes: number | null;
  default_sla_resolution_minutes: number | null;
};

export async function listSectors(): Promise<Sector[]> {
  const { data, error } = await db()
    .from("internal_ticket_sectors")
    .select(
      "id, name, active, manager_person_id, default_sla_first_response_minutes, default_sla_resolution_minutes",
    )
    .order("name");
  if (error) throw new Error(error.message);
  return data as Sector[];
}

export type SectorPerson = {
  id: string;
  sector_id: string;
  name: string;
  role_title: string | null;
  email: string;
  is_primary_recipient: boolean;
  is_cc: boolean;
  is_escalation_contact: boolean;
  receives_new_tickets: boolean;
  receives_reminders: boolean;
  receives_escalations: boolean;
  active: boolean;
};

export async function listSectorPeople(): Promise<SectorPerson[]> {
  const { data, error } = await db()
    .from("internal_ticket_sector_people")
    .select(
      "id, sector_id, name, role_title, email, is_primary_recipient, is_cc, is_escalation_contact, receives_new_tickets, receives_reminders, receives_escalations, active",
    )
    .order("name");
  if (error) throw new Error(error.message);
  return data as SectorPerson[];
}

export type Category = {
  id: string;
  name: string;
  default_sector_id: string | null;
  sla_first_response_minutes: number | null;
  sla_resolution_minutes: number | null;
  active: boolean;
};

export async function listCategories(): Promise<Category[]> {
  const { data, error } = await db()
    .from("internal_ticket_categories")
    .select(
      "id, name, default_sector_id, sla_first_response_minutes, sla_resolution_minutes, active",
    )
    .order("name");
  if (error) throw new Error(error.message);
  return data as Category[];
}

export type TicketListRow = {
  id: string;
  ticket_number: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  sector_id: string;
  category_id: string;
  requester_user_id: string;
  commercial_owner_user_id: string;
  sla_first_response_due_at: string | null;
  sla_resolution_due_at: string | null;
  first_response_at: string | null;
  resolved_at: string | null;
  created_at: string;
};

export async function listInternalTickets(): Promise<TicketListRow[]> {
  const { data, error } = await db()
    .from("internal_tickets")
    .select(
      "id, ticket_number, title, status, priority, sector_id, category_id, requester_user_id, commercial_owner_user_id, sla_first_response_due_at, sla_resolution_due_at, first_response_at, resolved_at, created_at",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data as TicketListRow[];
}

export type TicketDetail = TicketListRow & {
  description: string;
  sent_at: string | null;
  received_by_sector_at: string | null;
};

export async function getInternalTicket(ticketId: string): Promise<TicketDetail> {
  const { data, error } = await db()
    .from("internal_tickets")
    .select(
      "id, ticket_number, title, description, status, priority, sector_id, category_id, requester_user_id, commercial_owner_user_id, sla_first_response_due_at, sla_resolution_due_at, sent_at, received_by_sector_at, first_response_at, resolved_at, created_at",
    )
    .eq("id", ticketId)
    .single();
  if (error) throw new Error(error.message);
  return data as TicketDetail;
}

export type TicketEventRow = {
  id: string;
  from_status: TicketStatus | null;
  to_status: TicketStatus | null;
  origin: string;
  author_user_id: string | null;
  observation: string | null;
  created_at: string;
};

export async function listTicketEvents(ticketId: string): Promise<TicketEventRow[]> {
  const { data, error } = await db()
    .from("internal_ticket_events")
    .select("id, from_status, to_status, origin, author_user_id, observation, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data as TicketEventRow[];
}

export type TicketMessageRow = {
  id: string;
  direction: string;
  origin: string;
  sender_email: string | null;
  subject: string | null;
  body_html: string | null;
  body_text: string | null;
  created_at: string;
};

export async function listTicketMessages(ticketId: string): Promise<TicketMessageRow[]> {
  const { data, error } = await db()
    .from("internal_ticket_messages")
    .select("id, direction, origin, sender_email, subject, body_html, body_text, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data as TicketMessageRow[];
}

export type TicketRecipientRow = {
  id: string;
  email: string;
  name_snapshot: string | null;
  role: "principal" | "copia" | "escalonamento";
};

export async function listTicketRecipients(ticketId: string): Promise<TicketRecipientRow[]> {
  const { data, error } = await db()
    .from("internal_ticket_recipients")
    .select("id, email, name_snapshot, role")
    .eq("ticket_id", ticketId);
  if (error) throw new Error(error.message);
  return data as TicketRecipientRow[];
}

export type TicketAttachmentRow = {
  id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

export async function listTicketAttachments(ticketId: string): Promise<TicketAttachmentRow[]> {
  const { data, error } = await db()
    .from("internal_ticket_attachments")
    .select("id, storage_path, file_name, mime_type, size_bytes, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data as TicketAttachmentRow[];
}

export type ClientLite = { id: string; nome_fantasia: string };

export async function listClientsLite(): Promise<ClientLite[]> {
  const { data, error } = await supabase
    .from("clients")
    .select("id, nome_fantasia")
    .order("nome_fantasia");
  if (error) throw new Error(error.message);
  return data;
}

export type ProductLite = { id: string; nome: string };

export async function listProductsLite(): Promise<ProductLite[]> {
  const { data, error } = await supabase.from("own_products").select("id, nome").order("nome");
  if (error) throw new Error(error.message);
  return data;
}

export type ProfileLite = { id: string; full_name: string | null; email: string | null };

export async function listProfilesByIds(ids: string[]): Promise<ProfileLite[]> {
  if (!ids.length) return [];
  const { data, error } = await db()
    .from("profiles")
    .select("id, full_name, email")
    .in("id", Array.from(new Set(ids)));
  if (error) throw new Error(error.message);
  return data as ProfileLite[];
}
