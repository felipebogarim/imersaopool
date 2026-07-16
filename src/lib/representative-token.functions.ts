import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const getSchema = z.object({ token: z.string().min(8) });
const submitSchema = z.object({
  token: z.string().min(8),
  data: z.record(z.string(), z.union([z.string(), z.null()])).default({}),
});

export type RepresentativeTokenInfo = {
  immersion_id: string;
  titulo: string;
  client_name: string;
  representative_name: string | null;
  expires_at: string | null;
  already_submitted: boolean;
};

export const getImmersionByToken = createServerFn({ method: "POST" })
  .inputValidator((raw) => getSchema.parse(raw))
  .handler(async ({ data }): Promise<RepresentativeTokenInfo | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("get_immersion_by_token", {
      _token: data.token,
    });
    if (error) throw new Error(error.message);
    if (!rows || (Array.isArray(rows) && rows.length === 0)) return null;
    return (Array.isArray(rows) ? rows[0] : rows) as RepresentativeTokenInfo;
  });

export const submitRepresentativeInput = createServerFn({ method: "POST" })
  .inputValidator((raw) => submitSchema.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("submit_representative_input", {
      _token: data.token,
      _data: data.data as any,
    });
    if (error) throw new Error(error.message);
    return { id: result as string };
  });
