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
const inflight = new Map<string, Promise<AuthGateData>>();
let generation = 0;

export function clearAuthGateCache() {
  cache = null;
  inflight.clear();
  generation += 1;
}

async function loadWithRetry(userId: string): Promise<AuthGateData> {
  try {
    return await load(userId);
  } catch {
    // Logo após o login o token pode ainda não estar propagado: tenta de novo.
    await new Promise((r) => setTimeout(r, 600));
    return load(userId);
  }
}

async function load(userId: string): Promise<AuthGateData> {
  const [profileResult, rolesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("active_company_id, nda_accepted_at")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", userId),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (rolesResult.error) throw rolesResult.error;

  const p = profileResult.data;
  const roles = rolesResult.data;

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
    if (termsRes?.error) throw termsRes.error;
    if (mfaRes?.error) throw mfaRes.error;
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
  const existing = inflight.get(userId);
  if (existing) return existing;

  const requestGeneration = generation;
  const request = load(userId)
    .then((data) => {
      if (generation === requestGeneration) {
        cache = { userId: data.userId, at: Date.now(), data };
      }
      return data;
    })
    .finally(() => {
      if (inflight.get(userId) === request) inflight.delete(userId);
    });
  inflight.set(userId, request);
  return request;
}
