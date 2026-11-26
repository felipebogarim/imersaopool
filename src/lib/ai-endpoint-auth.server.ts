// Autenticação das rotas HTTP de IA (/api/tts e /api/transcribe-chunk), que não passam pelo
// middleware das server functions. Aceita:
//  1) sessão Supabase válida (Authorization: Bearer <jwt>) de usuário INTERNO — representantes
//     externos (portal) não usam essas rotas hoje e ficam bloqueados até autorização específica;
//  2) token público de representante da imersão (x-rep-token), válido e não expirado — usado
//     pela página pública /r/$token (ditado por voz no formulário do representante).
// Qualquer falha (cabeçalho ausente, token inválido/expirado, erro de verificação) bloqueia.

import { createClient } from "@supabase/supabase-js";

export type AiAuthResult =
  | { ok: true; via: "sessao" | "token_representante"; subject: string }
  | { ok: false; status: 401 | 403; error: string };

export type AiAuthDeps = {
  /** Valida o JWT e devolve o id do usuário, ou null se inválido/expirado. */
  verifySession: (jwt: string) => Promise<string | null>;
  /** Usuário é representante externo (login do portal)? */
  isExternalRep: (userId: string) => Promise<boolean>;
  /** Token público de representante existe e não expirou? */
  validateRepToken: (token: string) => Promise<boolean>;
};

const NEGADO: AiAuthResult = { ok: false, status: 401, error: "Não autenticado." };

export async function authorizeAiRequest(
  request: Request,
  deps: AiAuthDeps = defaultDeps(),
): Promise<AiAuthResult> {
  try {
    let negado: AiAuthResult = NEGADO;
    const auth = request.headers.get("authorization") ?? "";
    if (auth) {
      const jwt = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
      const userId = jwt && jwt.split(".").length === 3 ? await deps.verifySession(jwt) : null;
      if (userId) {
        if (!(await deps.isExternalRep(userId)))
          return { ok: true, via: "sessao", subject: userId };
        negado = { ok: false, status: 403, error: "Sem permissão para este recurso." };
      }
    }
    // Token público da imersão (página /r/$token) vale mesmo sem sessão interna.
    const repToken = (request.headers.get("x-rep-token") ?? "").trim();
    if (repToken.length >= 8 && repToken.length <= 200 && (await deps.validateRepToken(repToken))) {
      return { ok: true, via: "token_representante", subject: `token:${repToken.slice(0, 6)}…` };
    }
    return negado;
  } catch {
    // Falha de verificação = bloqueio (fail-closed), sem detalhar o motivo ao cliente.
    return NEGADO;
  }
}

function defaultDeps(): AiAuthDeps {
  return {
    async verifySession(jwt) {
      const url = process.env.SUPABASE_URL;
      const key = process.env.SUPABASE_PUBLISHABLE_KEY;
      if (!url || !key) return null;
      const client = createClient(url, key, {
        auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await client.auth.getClaims(jwt);
      const sub = data?.claims?.sub;
      return !error && typeof sub === "string" && sub ? sub : null;
    },
    async isExternalRep(userId) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("representatives")
        .select("id")
        .eq("user_id", userId)
        .limit(1);
      if (error) throw new Error("verificação de perfil indisponível");
      return (data ?? []).length > 0;
    },
    async validateRepToken(token) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin.rpc("get_immersion_by_token", { _token: token });
      if (error) throw new Error("verificação de token indisponível");
      return Array.isArray(data) ? data.length > 0 : !!data;
    },
  };
}
