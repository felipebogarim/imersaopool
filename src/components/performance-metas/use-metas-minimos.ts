// Mínimos de meta por categoria/portfólio (gestão), compartilhados entre a lista e o painel.

import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMetasMinimos } from "@/lib/performance-metas.functions";

export const MINIMOS_QUERY_KEY = ["performance-metas", "minimos"] as const;

export function useMetasMinimos(enabled = true) {
  const fn = useServerFn(getMetasMinimos);
  return useQuery({
    queryKey: MINIMOS_QUERY_KEY,
    queryFn: () => fn(),
    enabled,
    staleTime: 60_000,
  });
}
