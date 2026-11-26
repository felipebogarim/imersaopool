// Cabeçalhos de autenticação para as rotas HTTP de IA (/api/tts, /api/transcribe-chunk).
// Usuário logado → Bearer da sessão Supabase. Página pública do representante (/r/$token) →
// token público registrado pela própria página. Sem nenhum dos dois, o servidor responde 401.

import { supabase } from "@/integrations/supabase/client";

let publicRepToken: string | null = null;

/** Registrado pela página pública /r/$token enquanto estiver aberta (null ao sair). */
export function setPublicRepToken(token: string | null) {
  publicRepToken = token;
}

export async function aiAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const headers: Record<string, string> = {};
  const jwt = data.session?.access_token;
  if (jwt) headers.Authorization = `Bearer ${jwt}`;
  if (publicRepToken) headers["x-rep-token"] = publicRepToken;
  return headers;
}
