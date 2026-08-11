import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { TrendingUp, Tag, FileSearch, Map as MapIcon } from "lucide-react";

export const Route = createFileRoute("/_authenticated/mapa-acoes/")({
  head: () => ({ meta: [{ title: "Mapa de Ações — PoolFlux" }] }),
  component: MapaAcoesPage,
});

function MapaAcoesPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <PageHeader
        title="Mapa de Ações"
        subtitle="Desdobramento Estratégico em 4 Dimensões"
      />
      
      <div className="p-4 sm:p-8 max-w-6xl mx-auto">
        <div className="bg-white border border-slate-200 rounded-xl p-8 md:p-12 text-center shadow-sm">
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Arquitetura de Ação</h2>
            <p className="text-slate-600 leading-relaxed">
              O Mapa de Ações consolida as diretrizes geradas a partir das análises de Performance, Imersões e Preços, desdobrando-as em quatro dimensões operacionais.
            </p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 pt-8">
              {[
                { label: "COMERCIAL", icon: TrendingUp, desc: "Foco em vendas e expansão" },
                { label: "PRODUTO", icon: Tag, desc: "Mix e competitividade" },
                { label: "MARKETING", icon: FileSearch, desc: "Posicionamento e branding" },
                { label: "GOVERNANÇA", icon: MapIcon, desc: "Processos e gestão" }
              ].map((item) => (
                <div key={item.label} className="space-y-3">
                  <div className="h-12 w-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <item.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-800 tracking-widest">{item.label}</h3>
                    <p className="text-[10px] text-slate-400 mt-1 uppercase tracking-tighter">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="pt-12">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Módulo em Estruturação
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
