import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  AREA_LABEL,
  PRIORITY_LABEL,
  formatVisitDate,
  type ExecutiveAction,
  type ExecutiveReportData,
} from "@/lib/executive-report/types";
import { ActionCard } from "./ActionCard";

export function ChapterHeader({ num, title }: { num: string; title: string }) {
  return (
    <div className="mb-4 rounded-lg bg-primary/95 px-4 py-3 text-primary-foreground">
      <p className="text-[10px] font-semibold tracking-[0.18em] opacity-80">CAPÍTULO {num}</p>
      <h2 className="text-base font-bold uppercase tracking-wide sm:text-lg">{title}</h2>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="text-sm">{value || "—"}</p>
    </div>
  );
}

export function BriefingChapter({ data }: { data: ExecutiveReportData }) {
  return (
    <section>
      <ChapterHeader num="01" title="Briefing executivo" />
      <Card>
        <CardContent className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Cliente" value={data.client.display_name} />
          <Info label="Data da imersão" value={formatVisitDate(data.client.visit_date)} />
          <Info label="Local" value={data.client.location} />
          <Info label="Representante" value={data.client.representative} />
          <Info label="Consultor" value={data.client.consultant} />
          <Info label="Categoria comercial" value={data.client.category} />
          <Info label="Atingimento geral" value={data.client.attainment} />
          {data.brands_observed.length > 0 && (
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Marcas observadas
              </p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {data.brands_observed.map((b) => (
                  <Badge key={b} variant="outline">
                    {b}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

export function LeituraChapter({ data }: { data: ExecutiveReportData }) {
  if (!data.executive_reading) return null;
  return (
    <section>
      <ChapterHeader num="02" title="Leitura executiva" />
      <Card>
        <CardContent className="p-5">
          <MarkdownView markdown={data.executive_reading} className="text-[15px]" />
        </CardContent>
      </Card>
    </section>
  );
}


export function DiagnosticoChapter({
  data,
  readOnly,
  originOf,
  onValidate,
  onEdit,
  onReject,
}: {
  data: ExecutiveReportData;
  readOnly?: boolean;
  originOf?: (a: ExecutiveAction) => { existing: boolean; displayTitle: string } | undefined;
  onValidate?: (a: ExecutiveAction) => void;
  onEdit?: (a: ExecutiveAction) => void;
  onReject?: (a: ExecutiveAction) => void;
}) {

  return (
    <section>
      <ChapterHeader num="03" title="Do diagnóstico à ação" />
      <div className="space-y-4">
        {data.decision_blocks.map((b, i) => {
          const acts = data.actions.filter((a) => b.action_ids.includes(a.id));
          return (
            <Card key={b.id}>
              <CardContent className="p-5">
                <p className="text-xs font-bold tracking-widest text-primary">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-1 text-lg font-semibold leading-snug">{b.title}</h3>
                {b.cause && (
                  <div className="mt-4">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Causa
                    </p>
                    <p className="text-sm leading-relaxed">{b.cause}</p>
                  </div>
                )}
                {b.impact && (
                  <div className="mt-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      O que isso gera
                    </p>
                    <p className="text-sm leading-relaxed">{b.impact}</p>
                  </div>
                )}
                {b.evidence?.quote && (
                  <blockquote className="mt-4 border-l-2 border-primary pl-4">
                    <p className="text-sm italic leading-relaxed">“{b.evidence.quote}”</p>
                    {(b.evidence.author || b.evidence.role) && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {[b.evidence.author, b.evidence.role].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </blockquote>
                )}
                {acts.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Ações sugeridas
                    </p>
                    {acts.map((a) => (
                      <ActionCard
                        key={a.id}
                        action={a}
                        readOnly={readOnly}
                        origin={originOf?.(a)}
                        onValidate={() => onValidate?.(a)}
                        onEdit={() => onEdit?.(a)}
                        onReject={() => onReject?.(a)}
                      />
                    ))}

                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

export function NaoPrioridadeChapter({ data }: { data: ExecutiveReportData }) {
  if (!data.do_not_prioritize.length) return null;
  return (
    <section>
      <ChapterHeader num="04" title="Onde não concentrar energia agora" />
      <div className="grid gap-4 md:grid-cols-2">
        {data.do_not_prioritize.map((n, i) => (
          <Card key={n.id ?? i}>
            <CardContent className="p-5">
              <h3 className="text-base font-semibold">{n.title}</h3>
              {n.cause && (
                <div className="mt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Causa
                  </p>
                  <p className="text-sm leading-relaxed">{n.cause}</p>
                </div>
              )}
              {n.decision && (
                <div className="mt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    Decisão recomendada
                  </p>
                  <p className="text-sm leading-relaxed">{n.decision}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

export function PlanoAcaoResumo({ actions }: { actions: ExecutiveAction[] }) {
  return (
    <div className="space-y-2">
      {actions.map((a) => (
        <div
          key={a.id}
          className="flex flex-col gap-1 rounded-md border bg-card p-3 sm:flex-row sm:items-center sm:gap-3"
        >
          <div className="flex shrink-0 gap-2">
            <Badge variant="outline" className="text-[10px] uppercase">
              {PRIORITY_LABEL[a.priority]}
            </Badge>
            <Badge variant="outline" className="text-[10px] uppercase">
              {AREA_LABEL[a.area]}
            </Badge>
          </div>
          <p className="flex-1 text-sm font-medium">{a.title}</p>
        </div>
      ))}
    </div>
  );
}
