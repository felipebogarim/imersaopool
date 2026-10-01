/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isConsultant } from "@/lib/gro-nr1";

const db = supabase as any;

export function useGroContext() {
  return useQuery({
    queryKey: ["gro-context"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Sessão não encontrada");
      const [{ data: profile, error: profileError }, { data: roleRows, error: roleError }] =
        await Promise.all([
          db
            .from("profiles")
            .select("active_company_id, company_id, full_name")
            .eq("id", auth.user.id)
            .single(),
          db.from("user_roles").select("role").eq("user_id", auth.user.id),
        ]);
      if (profileError) throw profileError;
      if (roleError) throw roleError;
      const roles = (roleRows ?? []).map((row: { role: string }) => row.role);
      const consultant = isConsultant(roles);
      const companyId = consultant ? profile.active_company_id : profile.company_id;
      if (!companyId) throw new Error("Selecione uma empresa para acessar o GRO NR1");
      const { data: company, error: companyError } = await db
        .from("companies")
        .select("id, nome")
        .eq("id", companyId)
        .single();
      if (companyError) throw companyError;
      return {
        userId: auth.user.id,
        userName: profile.full_name ?? auth.user.email ?? "Usuário",
        roles,
        isConsultant: consultant,
        companyId,
        companyName: company.nome as string,
      };
    },
  });
}
