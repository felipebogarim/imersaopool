import { supabase } from "@/integrations/supabase/client";

export type AuthGateData = {
  userId: string;
  roles: string[];
  activeCompanyId: string | null;
  ndaAcceptedAt: string | null;
  termsOk: boolean;
  mustEnrollMfa: boolean;
};

const TTL_MS = 60_000;

let cache: { userId: string; at: number; data: AuthGateData } | null = null;
let inflight: Promise<AuthGateData> | null = null;

export function clearAuthGateCache() {
  cache = null;
  inflight = null;
}

async function load(userId: string): Promise<AuthGateData> {
  const [{ data: p }, { data: roles }] = await Promise.all([
    supabase
      .from("profiles")
      .select("active_company_id, nda_accepted_at")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);

  const roleList = (roles ?? []).map((r: any) => r.role as string);
  const isComercialOnly =
    roleList.length > 0 && roleList.every((r) => r === "comercial");

  let termsOk = true;
  let mustEnrollMfa = false;

  if (!isComercialOnly) {
    const promises: Promise<any>[] = [Promise.resolve(supabase.rpc("get_my_terms_status"))];
    if (roleList.includes("admin"))
      promises.push(Promise.resolve(supabase.rpc("get_admin_mfa_status")));
    const [termsRes, mfaRes] = await Promise.all(promises);
    const row: any = Array.isArray(termsRes?.data) ? termsRes.data[0] : termsRes?.data;

    termsOk = !row || row.status === "aceito";
    const mfaRow: any = Array.isArray(mfaRes?.data) ? mfaRes.data[0] : mfaRes?.data;
    mustEnrollMfa = Boolean(mfaRow?.must_enroll_now);
  }

  return {
    userId,
    roles: roleList,
    activeCompanyId: p?.active_company_id ?? null,
    ndaAcceptedAt: p?.nda_accepted_at ?? null,
    termsOk,
    mustEnrollMfa,
  };
}

export async function getAuthGate(userId: string): Promise<AuthGateData> {
  if (cache && cache.userId === userId && Date.now() - cache.at < TTL_MS) {
    return cache.data;
  }
  if (inflight) return inflight;
  inflight = load(userId)
    .then((data) => {
      cache = { userId, at: Date.now(), data };
      return data;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}
