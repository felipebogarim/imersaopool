import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AdminMfaStatus = {
  is_admin: boolean;
  has_verified_factor: boolean;
  enforcement_started_at: string | null;
  deadline: string | null;
  days_left: number | null;
  grace_active: boolean;
  must_enroll_now: boolean;
  current_aal: string | null;
};

export type AalInfo = {
  currentLevel: "aal1" | "aal2" | null;
  nextLevel: "aal1" | "aal2" | null;
};

export function useAdminMfaStatus() {
  return useQuery<AdminMfaStatus | null>({
    queryKey: ["admin-mfa-status"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_admin_mfa_status");
      const row = Array.isArray(data) ? data[0] : data;
      return (row as AdminMfaStatus) ?? null;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

export function useAalLevels() {
  const [info, setInfo] = useState<AalInfo>({ currentLevel: null, nextLevel: null });
  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (!mounted) return;
      setInfo({
        currentLevel: (data?.currentLevel as any) ?? null,
        nextLevel: (data?.nextLevel as any) ?? null,
      });
    }
    load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => load());
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
    };
  }, []);
  return info;
}

/** Dismiss the grace banner for a single session. */
const SESSION_DISMISS_KEY = "admin_mfa_banner_dismissed";
export function useBannerDismiss() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(SESSION_DISMISS_KEY) === "1";
  });
  return {
    dismissed,
    dismiss: () => {
      sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
      setDismissed(true);
    },
    reset: () => {
      sessionStorage.removeItem(SESSION_DISMISS_KEY);
      setDismissed(false);
    },
  };
}
