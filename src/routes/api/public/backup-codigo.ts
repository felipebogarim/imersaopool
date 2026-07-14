import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/backup-codigo")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyApiKey, getAdmin, logHistorico } = await import("@/lib/backup-shared.server");
        const unauth = verifyApiKey(request);
        if (unauth) return unauth;

        const body = (await request.json().catch(() => ({}))) as {
          origem?: "manual" | "auto";
          iniciado_por?: string;
        };
        const origem = body.origem ?? "manual";
        const admin = getAdmin();

        const { data: cfg } = await admin
          .from("backup_config")
          .select("github_repo, github_branch")
          .limit(1)
          .maybeSingle();
        const repo = cfg?.github_repo as string | undefined;
        const branch = (cfg?.github_branch as string | undefined) ?? "main";
        if (!repo) {
          return Response.json({ error: "GitHub repo não configurado" }, { status: 400 });
        }
        const token = process.env.GITHUB_TOKEN;
        if (!token) {
          return Response.json({ error: "GITHUB_TOKEN não configurado" }, { status: 400 });
        }

        const { data: job, error: jobErr } = await admin
          .from("backup_jobs")
          .insert({ tipo: "codigo", status: "executando", origem, iniciado_por: body.iniciado_por ?? null })
          .select("id")
          .single();
        if (jobErr || !job) return Response.json({ error: jobErr?.message }, { status: 500 });
        const jobId = job.id as string;

        try {
          const res = await fetch(`https://api.github.com/repos/${repo}/zipball/${branch}`, {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github+json",
              "User-Agent": "poolflux-backup",
            },
          });
          if (!res.ok) throw new Error(`GitHub ${res.status}: ${await res.text()}`);
          const buf = new Uint8Array(await res.arrayBuffer());
          const path = `codigo/${jobId}.zip`;
          const { error: upErr } = await admin.storage
            .from("backups")
            .upload(path, buf, { contentType: "application/zip", upsert: true });
          if (upErr) throw new Error(upErr.message);

          await admin
            .from("backup_jobs")
            .update({
              status: "ok",
              tamanho_bytes: buf.byteLength,
              storage_path: path,
              concluido_em: new Date().toISOString(),
            })
            .eq("id", jobId);
          await logHistorico(admin, {
            operacao: "Backup código criado",
            resultado: "ok",
            detalhe: `${(buf.byteLength / (1024 * 1024)).toFixed(2)} MB`,
            job_id: jobId,
            usuario_label: origem === "auto" ? "Agendador" : "Manual",
          });
          return Response.json({ job_id: jobId, bytes: buf.byteLength, storage_path: path });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          await admin
            .from("backup_jobs")
            .update({ status: "erro", erro: msg, concluido_em: new Date().toISOString() })
            .eq("id", jobId);
          await logHistorico(admin, {
            operacao: "Backup código falhou",
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
