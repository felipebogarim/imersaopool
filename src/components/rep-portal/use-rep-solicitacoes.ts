import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { repListSolicitacoes } from "@/lib/rep-solicitacoes.functions";

export const REP_SOLICITACOES_KEY = ["rep-portal", "solicitacoes"] as const;

/** Pedidos de apoio do representante logado (cache compartilhado entre as abas do portal). */
export function useRepSolicitacoes() {
  const fn = useServerFn(repListSolicitacoes);
  return useQuery({
    queryKey: REP_SOLICITACOES_KEY,
    queryFn: () => fn(),
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
}
