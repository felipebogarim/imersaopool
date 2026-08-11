import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated/precos/mapa")({
  head: () => ({ meta: [{ title: "Mapa de Preços — PoolFlux" }] }),
  component: () => (
    <div className="min-h-screen bg-[#F8FAFC]">
      <PageHeader title="Mapa de Preços" subtitle="Monitoramento de preços por região e canal" />
      <div className="p-8 max-w-6xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center shadow-sm">
          <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            Módulo em Estruturação
          </span>
        </div>
      </div>
    </div>
  ),
});
