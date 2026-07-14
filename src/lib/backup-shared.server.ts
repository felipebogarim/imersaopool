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

export function verifyApiKey(request: Request): Response | null {
  const apikey = request.headers.get("apikey") ?? request.headers.get("x-api-key");
  const expected = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!expected || apikey !== expected) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
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

export async function copyBucketToBackup(
  admin: SupabaseClient,
  sourceBucket: string,
  destPrefix: string,
): Promise<{ files: number; bytes: number }> {
  let files = 0;
  let bytes = 0;

  async function walk(prefix: string) {
    const { data, error } = await admin.storage.from(sourceBucket).list(prefix, {
      limit: 1000,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) return;
    for (const item of data ?? []) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
      // folder: no id/metadata
      const isFolder = !item.id && !item.metadata;
      if (isFolder) {
        await walk(fullPath);
        continue;
      }
      const { data: file, error: dlErr } = await admin.storage.from(sourceBucket).download(fullPath);
      if (dlErr || !file) continue;
      const buf = new Uint8Array(await file.arrayBuffer());
      const destPath = `${destPrefix}/${sourceBucket}/${fullPath}`;
      const { error: upErr } = await admin.storage
        .from("backups")
        .upload(destPath, buf, { contentType: file.type || "application/octet-stream", upsert: true });
      if (upErr) continue;
      files += 1;
      bytes += buf.byteLength;
    }
  }

  await walk("");
  return { files, bytes };
}
