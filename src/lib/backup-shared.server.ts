import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const APP_TABLES = [
  "action_plans",
  "ai_compilations",
  "attachments",
  "capitulos",
  "clients",
  "companies",
  "competitor_products",
  "entity_permissions",
  "familias_produto",
  "field_visit_inputs",
  "immersions",
  "interviews",
  "own_products",
  "perspectivas",
  "price_competitors",
  "product_equivalences",
  "profiles",
  "rep_performance_rows",
  "rep_performance_uploads",
  "representative_inputs",
  "representatives",
  "roteiro_perfis",
  "roteiros",
  "sessao_capitulo_itens",
  "sessao_capitulos",
  "session_notes",
  "user_roles",
] as const;

export const APP_BUCKETS = ["imersoes-anexos", "product-images"] as const;

export function getAdmin(): SupabaseClient {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function verifyApiKey(request: Request): Promise<Response | null> {
  const apikey = request.headers.get("apikey") ?? request.headers.get("x-api-key");
  const authHeader = request.headers.get("Authorization");
  
  // Se for uma requisição interna autenticada (via server function ou app local)
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false }
    });
    
    // getClaims is not standard for anon client, let's use getUser
    const { data: { user } } = await admin.auth.getUser(token);
    if (user?.id) {
      const { data: isAdmin } = await admin.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (isAdmin) return null;
    }
  }

  // Fallback para cron/service calls usando o secret dedicado
  const cronSecret = process.env.BACKUP_CRON_SECRET;
  if (cronSecret && apikey === cronSecret) return null;

  return new Response(JSON.stringify({ error: "unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}

export async function logHistorico(
  admin: SupabaseClient,
  entry: {
    operacao: string;
    resultado?: "ok" | "atencao" | "critico";
    detalhe?: string;
    usuario_label?: string;
    job_id?: string;
  },
) {
  await admin.from("backup_historico").insert({
    operacao: entry.operacao,
    resultado: entry.resultado ?? "ok",
    detalhe: entry.detalhe ?? null,
    usuario_label: entry.usuario_label ?? "Sistema",
    job_id: entry.job_id ?? null,
  });
}

/**
 * Gera um manifesto (lista) de todos os arquivos dos buckets da aplicação.
 * NÃO duplica os binários — apenas registra metadados suficientes para
 * auditoria e restauração posterior. Isso é o que permite o backup rodar
 * em segundos no worker Cloudflare, independente do volume total.
 */
export async function buildStorageManifest(
  admin: SupabaseClient,
): Promise<{
  generated_at: string;
  buckets: Record<string, { count: number; bytes: number; files: Array<{ path: string; size: number; mimetype: string; updated_at: string | null }> }>;
  totals: { count: number; bytes: number };
}> {
  const { data, error } = await admin.rpc("list_storage_objects");
  if (error) throw new Error(`list_storage_objects: ${error.message}`);
  const rows = (data ?? []) as Array<{
    bucket_id: string;
    name: string;
    size: number;
    mimetype: string;
    updated_at: string | null;
  }>;
  const buckets: Record<string, { count: number; bytes: number; files: Array<{ path: string; size: number; mimetype: string; updated_at: string | null }> }> = {};
  let totalCount = 0;
  let totalBytes = 0;
  for (const b of APP_BUCKETS) buckets[b] = { count: 0, bytes: 0, files: [] };
  for (const r of rows) {
    if (!buckets[r.bucket_id]) buckets[r.bucket_id] = { count: 0, bytes: 0, files: [] };
    buckets[r.bucket_id].files.push({
      path: r.name,
      size: Number(r.size) || 0,
      mimetype: r.mimetype ?? "",
      updated_at: r.updated_at,
    });
    buckets[r.bucket_id].count += 1;
    buckets[r.bucket_id].bytes += Number(r.size) || 0;
    totalCount += 1;
    totalBytes += Number(r.size) || 0;
  }
  return { generated_at: new Date().toISOString(), buckets, totals: { count: totalCount, bytes: totalBytes } };
}
