import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/backup-run")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyApiKey, getAdmin, logHistorico, APP_TABLES, APP_BUCKETS, copyBucketToBackup } =
          await import("@/lib/backup-shared.server");
        const unauth = verifyApiKey(request);
        if (unauth) return unauth;

        const body = (await request.json().catch(() => ({}))) as {
          tipo?: "json" | "completo" | "arquivos";
          origem?: "manual" | "auto";
          iniciado_por?: string;
        };
        const tipo = body.tipo ?? "json";
        const origem = body.origem ?? "manual";
        if (!["json", "completo", "arquivos"].includes(tipo)) {
          return Response.json({ error: "tipo inválido" }, { status: 400 });
        }

        const admin = getAdmin();
        const { data: job, error: jobErr } = await admin
          .from("backup_jobs")
          .insert({ tipo, status: "executando", origem, iniciado_por: body.iniciado_por ?? null })
          .select("id")
          .single();
        if (jobErr || !job) {
          return Response.json({ error: jobErr?.message ?? "job insert failed" }, { status: 500 });
        }
        const jobId = job.id as string;

        try {
          let totalBytes = 0;
          let storagePath = "";

          if (tipo === "json" || tipo === "completo") {
            const dump: Record<string, unknown[]> = {};
            for (const t of APP_TABLES) {
              const { data } = await admin.from(t).select("*");
              dump[t] = data ?? [];
            }
            const payload = JSON.stringify({
              generated_at: new Date().toISOString(),
              tables: dump,
            });
            const bytes = new TextEncoder().encode(payload);
            const path = tipo === "json" ? `json/${jobId}.json` : `completo/${jobId}/dump.json`;
            const { error: upErr } = await admin.storage
              .from("backups")
              .upload(path, bytes, { contentType: "application/json", upsert: true });
            if (upErr) throw new Error(`upload dump: ${upErr.message}`);
            totalBytes += bytes.byteLength;
            storagePath = tipo === "json" ? path : `completo/${jobId}`;
          }

          if (tipo === "completo" || tipo === "arquivos") {
            const destPrefix = tipo === "completo" ? `completo/${jobId}` : `arquivos/${jobId}`;
            for (const b of APP_BUCKETS) {
              const { bytes } = await copyBucketToBackup(admin, b, destPrefix);
              totalBytes += bytes;
            }
            if (tipo === "arquivos") storagePath = destPrefix;
          }

          await admin
            .from("backup_jobs")
            .update({
              status: "ok",
              tamanho_bytes: totalBytes,
              storage_path: storagePath,
              concluido_em: new Date().toISOString(),
            })
            .eq("id", jobId);

          await logHistorico(admin, {
            operacao: `Backup ${tipo} criado`,
            resultado: "ok",
            detalhe: `${(totalBytes / (1024 * 1024)).toFixed(2)} MB`,
            job_id: jobId,
            usuario_label: origem === "auto" ? "Agendador" : "Manual",
          });

          return Response.json({ job_id: jobId, bytes: totalBytes, storage_path: storagePath });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await admin
            .from("backup_jobs")
            .update({ status: "erro", erro: msg, concluido_em: new Date().toISOString() })
            .eq("id", jobId);
          await logHistorico(admin, {
            operacao: `Backup ${tipo} falhou`,
            resultado: "critico",
            detalhe: msg,
            job_id: jobId,
          });
          return Response.json({ error: msg, job_id: jobId }, { status: 500 });
        }
      },
    },
  },
});
