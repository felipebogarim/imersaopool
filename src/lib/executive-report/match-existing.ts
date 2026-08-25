// Identifica se uma ação do Relatório Executivo já existia como ação
// do cliente (espelho da Gestão de Tarefas mostrado na Visão Imersão 2)
// ou se é uma sugestão nova, gerada na geração do relatório.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ExistingClientAction = {
  id: string;
  title: string;
  board_id: string;
  created_at: string;
};

const STOPWORDS = new Set([
  "DE","DA","DO","DAS","DOS","E","A","O","AS","OS","EM","NO","NA","NOS","NAS",
  "PARA","POR","COM","UM","UMA","AO","AOS","QUE",
]);

export function normText(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return normText(s)
    .split(" ")
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function similarity(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const union = new Set([...ta, ...tb]).size;
  const jaccard = inter / union;
  const containment = inter / Math.min(ta.size, tb.size);
  return Math.max(jaccard, containment * 0.95);
}

/** Nome de cliente normalizado, sem sufixos societários. */
function normClient(s: string | null | undefined): string {
  return normText(s)
    .replace(/\b(LTDA|EPP|ME|EIRELI|SA|COMERCIO|COM|IMPORTACAO|IMP|E)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sameClient(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 4) return false;
  return a.includes(b) || b.includes(a);
}

/** Ações já existentes do cliente na Gestão de Tarefas. */
export function useExistingClientActions(clientId?: string | null, clientName?: string | null) {
  return useQuery({
    queryKey: ["exec-existing-actions", clientId, clientName],
    enabled: Boolean(clientId || clientName),
    queryFn: async (): Promise<ExistingClientAction[]> => {
      const select = "id, title, board_id, created_at, metadata";
      const byId = new Map<string, ExistingClientAction>();
      const nName = normClient(clientName);

      const ids = new Set<string>();
      if (clientId) ids.add(clientId);
      const token = nName.split(" ")[0] ?? "";
      if (token.length >= 3) {
        const { data: cli } = await supabase
          .from("clients")
          .select("id, nome_fantasia, razao_social")
          .or(`nome_fantasia.ilike.%${token}%,razao_social.ilike.%${token}%`)
          .limit(200);
        for (const c of (cli ?? []) as any[]) {
          if (sameClient(normClient(c.nome_fantasia), nName) || sameClient(normClient(c.razao_social), nName)) {
            ids.add(c.id);
          }
        }
      }

      if (ids.size) {
        const { data } = await supabase
          .from("kanban_cards")
          .select(select)
          .in("metadata->>client_id", Array.from(ids))
          .order("created_at", { ascending: false });
        for (const r of (data ?? []) as any[]) byId.set(r.id, r as ExistingClientAction);
      }

      if (token.length >= 3) {
        const { data } = await supabase
          .from("kanban_cards")
          .select(select)
          .ilike("metadata->>client_name", `%${token}%`)
          .order("created_at", { ascending: false })
          .limit(300);
        for (const r of (data ?? []) as any[]) {
          if (sameClient(normClient(r.metadata?.client_name), nName)) byId.set(r.id, r as ExistingClientAction);
        }
      }

      return Array.from(byId.values());
    },
  });
}

export type ActionOrigin = {
  existing: ExistingClientAction | null;
  /** título oficial que deve ser exibido (o do card existente, quando houver) */
  displayTitle: string;
};

const THRESHOLD = 0.6;

/** Decide se a ação do relatório já estava prevista e qual título usar. */
export function resolveActionOrigin(
  title: string,
  existingActions: ExistingClientAction[],
): ActionOrigin {
  let best: ExistingClientAction | null = null;
  let bestScore = 0;
  for (const c of existingActions) {
    const s = similarity(title, c.title);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  if (best && bestScore >= THRESHOLD) {
    return { existing: best, displayTitle: best.title };
  }
  return { existing: null, displayTitle: title };
}
