import { createFileRoute } from "@tanstack/react-router";

type ItemStatus = "ok" | "atencao" | "critico";

export const Route = createFileRoute("/api/public/backup-audit")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyApiKey, getAdmin, logHistorico } = await import("@/lib/backup-shared.server");
        const unauth = verifyApiKey(request);
        if (unauth) return unauth;

        const admin = getAdmin();
        const categorias: Array<{ tipo: "json" | "completo" | "arquivos"; label: string }> = [
          { tipo: "json", label: "Backup JSON" },
          { tipo: "completo", label: "Backup Completo" },
          { tipo: "arquivos", label: "Backup de Arquivos" },
        ];

        const now = Date.now();
        const relatorio: Array<{ label: string; status: ItemStatus; detail: string }> = [];
        let graves = 0;
        let medios = 0;
        let baixos = 0;

        for (const cat of categorias) {
          const { data } = await admin
            .from("backup_jobs")
            .select("created_at, tamanho_bytes")
            .eq("tipo", cat.tipo)
            .eq("status", "ok")
            .order("created_at", { ascending: false })
            .limit(1);
          const last = data?.[0];
          if (!last) {
            relatorio.push({ label: cat.label, status: "critico", detail: "Nenhum backup encontrado" });
            graves += 1;
            continue;
          }
          const days = (now - new Date(last.created_at as string).getTime()) / (1000 * 60 * 60 * 24);
          const mb = ((last.tamanho_bytes as number | null) ?? 0) / (1024 * 1024);
          if (days > 14) {
            graves += 1;
            relatorio.push({
              label: cat.label,
              status: "critico",
              detail: `Último há ${days.toFixed(0)} dias (${mb.toFixed(1)} MB)`,
            });
          } else if (days > 7) {
            medios += 1;
            relatorio.push({
              label: cat.label,
              status: "atencao",
              detail: `Último há ${days.toFixed(0)} dias (${mb.toFixed(1)} MB)`,
            });
          } else {
            baixos += 0;
            relatorio.push({
              label: cat.label,
              status: "ok",
              detail: `Último há ${days.toFixed(1)} dias (${mb.toFixed(1)} MB)`,
            });
          }
        }

        const status: ItemStatus = graves > 0 ? "critico" : medios > 0 ? "atencao" : "ok";
        const { data: audit, error } = await admin
          .from("backup_auditoria")
          .insert({ status, graves, medios, baixos, relatorio })
          .select("id")
          .single();
        if (error) return Response.json({ error: error.message }, { status: 500 });

        await logHistorico(admin, {
          operacao: "Auditoria executada",
          resultado: status,
          detalhe: `Graves: ${graves} · Médios: ${medios}`,
          usuario_label: "Auditor",
        });

        return Response.json({ audit_id: audit.id, status, graves, medios, baixos, relatorio });
      },
    },
  },
});
