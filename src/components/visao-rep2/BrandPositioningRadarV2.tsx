// Teia comparativa de posicionamento — exclusiva da Visão Rep 2.
// Índices analíticos derivados das entrevistas (nunca pesquisa de mercado,
// nunca dados de performance). A Visão Rep original não usa este componente.

import { useMemo } from "react";
import {
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { VisaoRep2 } from "@/lib/visao-rep2-schema";
import { buildTeiaVM, confiancaLabel, fmtDelta, fmtScore, type TeiaPonto } from "@/lib/visao-rep2-teia";

function BrandPositioningTooltipV2({ active, payload }: { active?: boolean; payload?: any[] }) {
  const p: TeiaPonto | undefined = payload?.[0]?.payload?.ponto;
  if (!active || !p) return null;
  const leitura = p.leitura && p.leitura.length > 240 ? `${p.leitura.slice(0, 237)}…` : p.leitura;
  return (
    <div className="max-w-[18rem] rounded-lg border bg-popover p-3 text-xs text-popover-foreground shadow-md">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">{p.longLabel}</p>
      <p className="mt-1.5">Entrevista atual: <span className="font-semibold tabular-nums">{fmtScore(p.atual)}</span></p>
      {p.media != null ? (
        <>
          <p>Média das demais: <span className="tabular-nums">{fmtScore(p.media)}</span></p>
          <p>Diferença: <span className="tabular-nums">{fmtDelta(p.delta ?? 0)}</span></p>
        </>
      ) : null}
      <p>Confiança: {confiancaLabel(p.confianca)}</p>
      {leitura ? <p className="mt-1.5 leading-5 text-muted-foreground">{leitura}</p> : null}
      {p.perspectivas.length ? (
        <p className="mt-1.5 text-muted-foreground">Perspectivas: {p.perspectivas.join(", ")}</p>
      ) : null}
    </div>
  );
}


export function BrandPositioningRadarV2({
  atual,
  comparaveis = [],
}: {
  atual: VisaoRep2;
  /** Relatórios comparáveis: um por representante, sem o representante atual. */
  comparaveis?: VisaoRep2[];
}) {
  const vm = useMemo(() => {
    try {
      return buildTeiaVM(atual, comparaveis);
    } catch (e) {
      console.error("[BrandPositioningRadarV2] falha ao montar a teia", e);
      return null;
    }
  }, [atual, comparaveis]);

  if (!vm) {
    return (
      <p className="text-sm text-muted-foreground">Não foi possível carregar a comparação neste momento.</p>
    );
  }
  if (vm.status === "sem_dados") {
    return (
      <div className="rounded-lg border border-dashed p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Teia comparativa de posicionamento
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Este relatório foi importado sem a seção de posicionamento de marca (6 dimensões). Regere com IA ou inclua a
          seção no arquivo para exibir a teia.
        </p>
      </div>
    );
  }
  if (vm.status === "incompleto") {
    return (
      <div className="rounded-lg border border-dashed p-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Teia ainda não disponível
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Informação insuficiente em: {vm.ausentes.join(", ")}.
        </p>
      </div>
    );
  }

  const dados = vm.pontos.map(p => ({
    dimensao: p.label,
    atual: p.atual,
    media: p.media,
    ponto: p,
  }));
  const temMedia = vm.baseCount >= 2;

  return (
    <div className="flex flex-col items-center justify-center gap-2">
      <p className="text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        Teia comparativa de posicionamento
      </p>

      <div
        className="h-[300px] w-full sm:h-[340px]"
        role="img"
        aria-label={vm.descricaoAcessivel}
      >
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={dados} outerRadius="72%">
            <PolarGrid stroke="var(--border)" strokeOpacity={0.7} />
            <PolarAngleAxis
              dataKey="dimensao"
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <PolarRadiusAxis
              domain={[0, 100]}
              tickFormatter={(v: number) => (v === 0 ? "" : String(v))}
              tick={{ fill: "var(--muted-foreground)", fontSize: 9 }}
              axisLine={false}
              tickCount={6}
              stroke="var(--border)"
            />
            {temMedia ? (
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
            ) : null}
            <Radar
              name="Entrevista atual"
              dataKey="atual"
              stroke="var(--primary)"
              strokeWidth={2.5}
              fill="var(--primary)"
              fillOpacity={0.14}
              dot={{ r: 3, fill: "var(--primary)" }}
            />
            <Tooltip content={<BrandPositioningTooltipV2 />} />
            {temMedia ? (
              <Legend
                verticalAlign="bottom"
                height={24}
                wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }}
              />
            ) : null}
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
