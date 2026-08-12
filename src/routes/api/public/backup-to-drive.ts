import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/backup-to-drive")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyApiKey, getAdmin } = await import("@/lib/backup-shared.server");
        const unauth = await verifyApiKey(request);
        if (unauth) return unauth;

        const { job_id, folder_id } = (await request.json().catch(() => ({}))) as {
          job_id?: string;
          folder_id?: string;
        };
        if (!job_id) return Response.json({ error: "job_id obrigatório" }, { status: 400 });

        const lovableKey = process.env.LOVABLE_API_KEY;
        const gwKey = process.env.GOOGLE_DRIVE_API_KEY;
        if (!lovableKey || !gwKey) {
          return Response.json(
            { error: "Conector Google Drive não configurado no projeto." },
            { status: 500 },
          );
        }

        const admin = getAdmin();
        const { data: job, error } = await admin
          .from("backup_jobs")
          .select("id,tipo,storage_path,tamanho_bytes,created_at")
          .eq("id", job_id)
          .single();
        if (error || !job || !job.storage_path) {
          return Response.json({ error: "job não encontrado" }, { status: 404 });
        }

        const { data: blob, error: dlErr } = await admin.storage
          .from("backups")
          .download(job.storage_path);
        if (dlErr || !blob) {
          return Response.json(
            { error: dlErr?.message ?? "arquivo indisponível" },
            { status: 404 },
          );
        }

        const ext = job.tipo === "codigo" ? "zip" : "json";
        const mime = job.tipo === "codigo" ? "application/zip" : "application/json";
        const filename = `poolflux-backup-${job.tipo}-${job.id}.${ext}`;
        const fileBytes = new Uint8Array(await blob.arrayBuffer());

        const metadata: Record<string, unknown> = { name: filename, mimeType: mime };
        if (folder_id) metadata.parents = [folder_id];

        const boundary = `----poolflux-${crypto.randomUUID()}`;
        const enc = new TextEncoder();
        const head = enc.encode(
          `--${boundary}\r\n` +
            `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
            JSON.stringify(metadata) +
            `\r\n--${boundary}\r\n` +
            `Content-Type: ${mime}\r\n\r\n`,
        );
        const tail = enc.encode(`\r\n--${boundary}--\r\n`);
        const body = new Uint8Array(head.length + fileBytes.length + tail.length);
        body.set(head, 0);
        body.set(fileBytes, head.length);
        body.set(tail, head.length + fileBytes.length);

        const gwUrl =
          "https://connector-gateway.lovable.dev/google_drive/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink";

        const resp = await fetch(gwUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": gwKey,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body,
        });

        const respText = await resp.text();
        if (!resp.ok) {
          await admin.from("backup_historico").insert({
            operacao: `Envio ao Drive (${job.tipo})`,
            resultado: "critico",
            detalhe: `HTTP ${resp.status}: ${respText.slice(0, 300)}`,
            usuario_label: "Sistema",
            job_id: job.id,
          });
          return Response.json(
            { error: `Falha no Google Drive [${resp.status}]: ${respText}` },
            { status: 502 },
          );
        }

        let file: { id?: string; name?: string; webViewLink?: string } = {};
        try {
          file = JSON.parse(respText);
        } catch {
          /* ignore */
        }

        await admin.from("backup_historico").insert({
          operacao: `Envio ao Drive (${job.tipo})`,
          resultado: "ok",
          detalhe: file.webViewLink ?? file.name ?? filename,
          usuario_label: "Sistema",
          job_id: job.id,
        });

        return Response.json({
          ok: true,
          drive_file_id: file.id,
          name: file.name ?? filename,
          web_view_link: file.webViewLink,
        });
      },
    },
  },
});
