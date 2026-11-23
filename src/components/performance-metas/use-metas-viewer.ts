import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { viewerRoleFromRoles, type MetasViewerRole } from "@/lib/performance-metas";

export type MetasViewer = {
  role: MetasViewerRole;
  /** Representantes vinculados ao usuário (`representatives.user_id`). */
  repIds: string[];
  loading: boolean;
};

/**
 * Perfil de tela da área Metas. É apenas apresentação: a autorização definitiva
 * (quem lê/escreve metas oficiais e sugestões) virá do backend em etapa futura.
 */
export function useMetasViewer(): MetasViewer {
  const { data, isLoading } = useQuery({
    queryKey: ["performance-metas", "viewer"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return { role: "representante" as MetasViewerRole, repIds: [] as string[] };
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      const role = viewerRoleFromRoles((roleRows ?? []).map((r) => String(r.role)));
      const { data: reps } = await supabase.from("representatives").select("id").eq("user_id", uid);
      return { role, repIds: (reps ?? []).map((r) => r.id) };
    },
  });
  return {
    role: data?.role ?? "representante",
    repIds: data?.repIds ?? [],
    loading: isLoading,
  };
}
