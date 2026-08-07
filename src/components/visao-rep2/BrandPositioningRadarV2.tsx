import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import type { VisaoRep2 } from "@/lib/visao-rep2-schema";
import { useMemo } from "react";
import { buildTeiaVM } from "@/lib/visao-rep2-teia";

export function BrandPositioningRadarV2({ 
  atual, 
  referencia,
  comparaveis = []
}: { 
  atual: VisaoRep2; 
  referencia?: VisaoRep2;
  comparaveis?: VisaoRep2[];
}) {
  const vm = useMemo(() => {
    const list = referencia ? [referencia] : comparaveis;
    const teia = buildTeiaVM(atual, list);
    
    // Adaptador de TeiaVM para o formato de visualização esperado no Recharts
    if (teia.status !== "ok") return { status: teia.status, descricaoAcessivel: "", data: [], baseCount: 0 };
    
    return {
      status: "ok" as const,
      data: teia.pontos.map(p => ({
        subject: p.label,
        value: p.atual,
        media: p.media,
        fullMark: 100
      })),
      baseCount: teia.baseCount,
      descricaoAcessivel: teia.descricaoAcessivel
    };
  }, [atual, referencia, comparaveis]);

  if (vm.status === "loading") {
    return (
      <div className="flex h-[300px] w-full items-center justify-center sm:h-[340px]">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  if (vm.status === "error") {
    return (
      <div className="flex h-[300px] w-full items-center justify-center rounded-xl bg-muted/20 text-xs text-muted-foreground sm:h-[340px]">
        Não foi possível gerar a teia comparativa
      </div>
    );
  }

  const temMedia = vm.baseCount >= 1;
  const insuficiente = !temMedia && vm.status === "ok";

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Teia comparativa de posicionamento
      </p>

      <div
        className="relative h-[300px] w-full sm:h-[340px]"
        role="img"
        aria-label={vm.descricaoAcessivel}
      >
        {insuficiente && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/40 backdrop-blur-[1px]">
            <div className="rounded-full border bg-background/90 px-3 py-1 text-[10px] font-medium text-muted-foreground shadow-sm">
              Base comparável insuficiente
            </div>
          </div>
        )}
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="80%" data={vm.data}>
            <PolarGrid stroke="var(--border)" strokeWidth={1} />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 500 }}
            />
            <PolarRadiusAxis
              angle={30}
              domain={[0, 100]}
              tick={{ fill: "var(--muted-foreground)", fontSize: 9 }}
              axisLine={false}
              tickCount={6}
              stroke="var(--border)"
            />
            {temMedia && (
              <Radar
                name="Média das demais"
                dataKey="media"
                stroke="var(--muted-foreground)"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                fill="var(--muted-foreground)"
                fillOpacity={0.05}
                dot={{ r: 2.5, fill: "var(--muted-foreground)" }}
              />
            )}
            <Radar
              name="Representante"
              dataKey="value"
              stroke="var(--primary)"
              strokeWidth={2}
              fill="var(--primary)"
              fillOpacity={0.15}
              dot={{ r: 4, fill: "var(--primary)", strokeWidth: 2, stroke: "var(--background)" }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap justify-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-3 rounded-full bg-primary" />
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            Este relatório
          </span>
        </div>
        {temMedia && (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-3 rounded-full border border-dashed border-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              Média do grupo
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
