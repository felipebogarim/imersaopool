import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type DirectorRepNote = {
  representative_id: string;
  company_id: string;
  last_immersion: string | null;
  general_perception: string | null;
  perceived_opportunities: string | null;
  notes: string | null;
  updated_at: string;
};

export type DirectorRepNoteInput = Pick<
  DirectorRepNote,
  | "representative_id"
  | "last_immersion"
  | "general_perception"
  | "perceived_opportunities"
  | "notes"
>;

type DirectorRepNotesDatabase = {
  public: {
    Tables: {
      director_rep_notes: {
        Row: DirectorRepNote;
        Insert: Omit<DirectorRepNote, "updated_at"> & {
          updated_at?: string;
          updated_by: string;
        };
        Update: Partial<DirectorRepNote> & { updated_by?: string };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const notesClient = supabase as unknown as SupabaseClient<DirectorRepNotesDatabase>;

async function currentContext() {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error("Entre novamente para consultar os representantes.");

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("active_company_id")
    .eq("id", auth.user.id)
    .single();
  if (profileError) throw profileError;
  if (!profile.active_company_id) {
    throw new Error("Selecione uma empresa para consultar os representantes.");
  }
  return { userId: auth.user.id, companyId: profile.active_company_id };
}

export async function fetchDirectorRepNotes(): Promise<DirectorRepNote[]> {
  const { companyId } = await currentContext();
  const { data, error } = await notesClient
    .from("director_rep_notes")
    .select(
      "representative_id, company_id, last_immersion, general_perception, perceived_opportunities, notes, updated_at",
    )
    .eq("company_id", companyId);
  if (error) throw error;
  return data ?? [];
}

export async function saveDirectorRepNote(input: DirectorRepNoteInput): Promise<void> {
  const { companyId, userId } = await currentContext();
  const payload = {
    ...input,
    company_id: companyId,
    updated_by: userId,
  };
  const { error } = await notesClient
    .from("director_rep_notes")
    .upsert(payload, { onConflict: "representative_id" });
  if (error) throw error;
}
