export type AgendaView = "day" | "week" | "month" | "year";

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
  duration_minutes: number;
  details: string | null;
  created_at: string;
  updated_at: string;
  invitees?: { invitee_id: string }[];
};

export type AgendaEventForm = {
  title: string;
  startsAt: string;
  durationMinutes: number;
  details: string;
  inviteeIds: string[];
};