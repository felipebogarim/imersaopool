import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ACTION_FILES_BUCKET, readActionMeta, statusOrDefault } from "@/lib/action-tracking";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const admin = supabaseAdmin as any;

export type RepActionReportFile = {
  id: string;
  name: string;
  mime: string | null;
  size: number | null;
  url: string | null;
};

export type RepActionReport = {
  id: string;
  cardId: string;
  actionTitle: string;
  representativeId: string | null;
  representativeName: string;
  clientName: string;
  status: ReturnType<typeof statusOrDefault> | null;
  note: string | null;
  createdAt: string;
  files: RepActionReportFile[];
};

/** Reports enviados pelos representantes, restritos a admin/gestor e aos cards acessíveis. */
export const getRepActionReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RepActionReport[]> => {
    const roles = await Promise.all(
      (["admin", "gestor"] as const).map((role) =>
        context.supabase.rpc("has_role", { _user_id: context.userId, _role: role }),
      ),
    );
    if (!roles.some((role) => role.data === true)) throw new Error("Sem permissão para acessar.");

    // Usa o cliente autenticado para manter o escopo de empresa/boards definido pela RLS.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = context.supabase as any;
    const { data: cards, error: cardsError } = await db
      .from("kanban_cards")
      .select("id, title, metadata")
      .not("metadata->>rep_id", "is", null)
      .is("archived_at", null);
    if (cardsError) throw new Error(cardsError.message);
    const cardIds = (cards ?? []).map((card: { id: string }) => card.id);
    if (!cardIds.length) return [];

    const { data: updates, error: updatesError } = await db
      .from("kanban_action_updates")
      .select("id, card_id, status, note, created_at")
      .eq("source", "representante")
      .in("card_id", cardIds)
      .order("created_at", { ascending: false })
      .limit(500);
    if (updatesError) throw new Error(updatesError.message);
    const updateIds = (updates ?? []).map((update: { id: string }) => update.id);

    const { data: files, error: filesError } = updateIds.length
      ? await db
          .from("kanban_action_update_files")
          .select("id, update_id, file_name, mime_type, size_bytes, storage_path")
          .in("update_id", updateIds)
      : { data: [], error: null };
    if (filesError) throw new Error(filesError.message);

    const signedUrls = new Map<string, string | null>();
    await Promise.all(
      (files ?? []).map(async (file: { id: string; storage_path: string }) => {
        const { data } = await admin.storage
          .from(ACTION_FILES_BUCKET)
          .createSignedUrl(file.storage_path, 3600);
        signedUrls.set(file.id, data?.signedUrl ?? null);
      }),
    );

    const cardsById = new Map<string, { id: string; title: string; metadata: unknown }>(
      (cards ?? []).map((card: { id: string; title: string; metadata: unknown }) => [
        card.id,
        card,
      ]),
    );
    return (updates ?? []).flatMap(
      (update: {
        id: string;
        card_id: string;
        status: string | null;
        note: string | null;
        created_at: string;
      }) => {
        const card = cardsById.get(update.card_id);
        if (!card) return [];
        const metadata = readActionMeta(card.metadata);
        return [
          {
            id: update.id,
            cardId: update.card_id,
            actionTitle: card.title,
            representativeId: metadata.rep_id ?? null,
            representativeName: metadata.rep_name ?? "Representante",
            clientName: metadata.client_name ?? "Cliente não informado",
            status: update.status ? statusOrDefault(update.status) : null,
            note: update.note,
            createdAt: update.created_at,
            files: (files ?? [])
              .filter((file: { update_id: string }) => file.update_id === update.id)
              .map(
                (file: {
                  id: string;
                  file_name: string;
                  mime_type: string | null;
                  size_bytes: number | null;
                }): RepActionReportFile => ({
                  id: file.id,
                  name: file.file_name,
                  mime: file.mime_type,
                  size: file.size_bytes,
                  url: signedUrls.get(file.id) ?? null,
                }),
              ),
          },
        ];
      },
    );
  });
