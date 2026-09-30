export type AgendaView = "day" | "week" | "month" | "bimonth" | "year";
export type AgendaEventType = "imersao" | "reuniao" | "outro";

export type AgendaUser = {
  id: string;
  full_name: string | null;
  email: string | null;
};

export type AgendaEvent = {
  id: string;
  owner_id: string;
  company_id: string;
  title: string;
  starts_at: string;
  ends_at: string;
  event_type: AgendaEventType;
  duration_minutes: number;
  details: string | null;
  created_at: string;
  updated_at: string;
  invitees?: { invitee_id: string }[];
};

export type AgendaEventForm = {
  title: string;
  startsAt: string;
  endsAt: string;
  eventType: AgendaEventType;
  details: string;
  inviteeIds: string[];
};
