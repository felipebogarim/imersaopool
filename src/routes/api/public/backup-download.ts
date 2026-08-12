import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/backup-download")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyApiKey, getAdmin } = await import("@/lib/backup-shared.server");
        const unauth = await verifyApiKey(request);
        if (unauth) return unauth;

        const { job_id } = (await request.json().catch(() => ({}))) as { job_id?: string };
        if (!job_id) return Response.json({ error: "job_id obrigatório" }, { status: 400 });

        const admin = getAdmin();
        const { data: job, error } = await admin
          .from("backup_jobs")
          .select("id,tipo,storage_path")
          .eq("id", job_id)
          .single();
        if (error || !job || !job.storage_path) {
          return Response.json({ error: "job não encontrado" }, { status: 404 });
        }

        const { data, error: dlErr } = await admin.storage.from("backups").download(job.storage_path);
        if (dlErr || !data) {
          return Response.json({ error: dlErr?.message ?? "arquivo não encontrado" }, { status: 404 });
        }

        const ext = job.tipo === "codigo" ? "zip" : "json";
        const contentType = job.tipo === "codigo" ? "application/zip" : "application/json";
        const filename = `backup-${job.tipo}-${job.id}.${ext}`;
        const buf = await data.arrayBuffer();
        return new Response(buf, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${filename}"`,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
