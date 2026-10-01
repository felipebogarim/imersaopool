/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as any;

async function rows(
  table: string,
  companyId: string,
  periodColumn: string | null,
  periodIds: string[],
) {
  let query = db.from(table).select("*").eq("company_id", companyId);
  if (periodColumn && periodIds.length) query = query.in(periodColumn, periodIds);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export function useGroWorkspaceData(companyId?: string, periodIds: string[] = []) {
  return useQuery({
    queryKey: ["gro-workspace", companyId, [...periodIds].sort().join(",")],
    enabled: !!companyId && periodIds.length > 0,
    queryFn: async () => {
      const [
        steps,
        documents,
        practices,
        questionnaires,
        fieldReports,
        reports,
        risks,
        actions,
        culture,
      ] = await Promise.all([
        rows("gro_consultancy_steps", companyId!, "period_id", periodIds),
        rows("gro_documents", companyId!, "period_id", periodIds),
        rows("gro_good_practices", companyId!, "period_id", periodIds),
        rows("gro_questionnaires", companyId!, "period_id", periodIds),
        rows("gro_field_reports", companyId!, "period_id", periodIds),
        rows("gro_final_reports", companyId!, "period_id", periodIds),
        rows("gro_risks", companyId!, "period_id", periodIds),
        rows("gro_actions", companyId!, "origin_period_id", periodIds),
        rows("gro_culture_reads", companyId!, "period_id", periodIds),
      ]);
      const actionIds = actions.map((action: { id: string }) => action.id);
      const questionnaireIds = questionnaires.map((item: { id: string }) => item.id);
      const [evidencesResult, responsesResult] = await Promise.all([
        actionIds.length
          ? db.from("gro_evidences").select("*").in("action_id", actionIds)
          : Promise.resolve({ data: [], error: null }),
        questionnaireIds.length
          ? db
              .from("gro_questionnaire_responses")
              .select("id, questionnaire_id, source, submitted_at")
              .in("questionnaire_id", questionnaireIds)
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (evidencesResult.error) throw evidencesResult.error;
      if (responsesResult.error) throw responsesResult.error;
      return {
        steps,
        documents,
        practices,
        questionnaires,
        responses: responsesResult.data ?? [],
        fieldReports,
        reports,
        risks,
        actions,
        evidences: evidencesResult.data ?? [],
        culture,
      };
    },
  });
}
