import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertTriangle,
  Lightbulb,
  MoreVertical,
  Pencil,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import type { GeneralReportContent, ReportBlock } from "@/lib/general-report-lib";

const PALETTE = [
  "#3a8fb0",
  "#e8a33d",
  "#5aa469",
  "#c8553d",
  "#7a6bb5",
  "#2f6f8a",
  "#b5b5b5",
  "#d17aa0",
];
type ChartBlock = Extract<ReportBlock, { type: "chart" }>;

function fmt(v: unknown) {
  return typeof v === "number"
    ? v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })
    : String(v);
}

function ChartBlockView({ b }: { b: ChartBlock }) {
  const common = { data: b.data, margin: { top: 8, right: 12, left: 0, bottom: 4 } };
  const axes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,.25)" />
      <XAxis
        dataKey={b.x}
        tick={{ fontSize: 11 }}
        interval={0}
        angle={b.data.length > 6 ? -25 : 0}
        textAnchor={b.data.length > 6 ? "end" : "middle"}
        height={b.data.length > 6 ? 60 : 30}
      />
      <YAxis tick={{ fontSize: 11 }} tickFormatter={fmt} width={60} />
      <Tooltip formatter={(v) => fmt(v)} />
      {b.series.length > 1 && <Legend />}
    </>
  );
  return (
    <figure className="rounded-xl border border-border bg-card p-4 break-inside-avoid">
      <figcaption className="text-sm font-semibold mb-2">{b.title}</figcaption>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {b.kind === "pie" ? (
            <PieChart>
              <Pie
                data={b.data}
                dataKey={b.series[0]}
                nameKey={b.x}
                outerRadius={100}
                label={(e: any) => String(e[b.x]).slice(0, 14)}
              >
                {b.data.map((_, i) => (
                  <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => fmt(v)} />
            </PieChart>
          ) : b.kind === "line" ? (
            <LineChart {...common}>
              {axes}
              {b.series.map((s, i) => (
                <Line
                  key={s}
                  type="monotone"
                  dataKey={s}
                  stroke={PALETTE[i % PALETTE.length]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          ) : b.kind === "area" ? (
            <AreaChart {...common}>
              {axes}
              {b.series.map((s, i) => (
                <Area
                  key={s}
                  type="monotone"
                  dataKey={s}
                  stroke={PALETTE[i % PALETTE.length]}
                  fill={PALETTE[i % PALETTE.length]}
                  fillOpacity={0.25}
                />
              ))}
            </AreaChart>
          ) : (
            <BarChart {...common}>
              {axes}
              {b.series.map((s, i) => (
                <Bar key={s} dataKey={s} fill={PALETTE[i % PALETTE.length]} radius={[4, 4, 0, 0]} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      {b.insight && <p className="text-sm text-muted-foreground mt-2">{b.insight}</p>}
    </figure>
  );
}

function ImageBlockView({ b }: { b: Extract<ReportBlock, { type: "image" }> }) {
  const { data: url } = useQuery({
    queryKey: ["general-report-image", b.fileId],
    staleTime: 50 * 60 * 1000,
    queryFn: async () => {
      const db = supabase as any;
      const { data: f } = await db
        .from("general_report_files")
        .select("storage_path")
        .eq("id", b.fileId)
        .maybeSingle();
      if (!f) return null;
      const { data } = await supabase.storage
        .from("general-reports")
        .createSignedUrl(f.storage_path, 3600);
      return data?.signedUrl ?? null;
    },
  });
  return (
    <figure className="rounded-xl border border-border bg-card overflow-hidden break-inside-avoid">
      {url ? (
        <img src={url} alt={b.caption} className="w-full max-h-[480px] object-contain bg-muted" />
      ) : (
        <div className="h-40 bg-muted animate-pulse" />
      )}
      <figcaption className="p-4 space-y-2">
        {b.caption && <p className="text-sm font-semibold">{b.caption}</p>}
        {b.observations.length > 0 && (
          <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
            {b.observations.map((o, i) => (
              <li key={i}>{o}</li>
            ))}
          </ul>
        )}
      </figcaption>
    </figure>
  );
}

const TONE = {
  destaque: { cls: "border-primary/40 bg-primary/5", Icon: Sparkles },
  atencao: { cls: "border-amber-500/50 bg-amber-500/10", Icon: AlertTriangle },
  oportunidade: { cls: "border-emerald-500/50 bg-emerald-500/10", Icon: Lightbulb },
} as const;

function Block({ b }: { b: ReportBlock }) {
  switch (b.type) {
    case "text":
      return <p className="text-sm leading-relaxed whitespace-pre-line">{b.text}</p>;
    case "bullets":
      return (
        <div>
          {b.title && <h4 className="text-sm font-semibold mb-1">{b.title}</h4>}
          <ul className="list-disc pl-5 space-y-1 text-sm">
            {b.items.map((i, k) => (
              <li key={k}>{i}</li>
            ))}
          </ul>
        </div>
      );
    case "kpis":
      return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {b.items.map((k, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 break-inside-avoid">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</div>
              <div className="text-2xl font-bold mt-1">{k.value}</div>
              {k.hint && <div className="text-xs text-muted-foreground mt-1">{k.hint}</div>}
            </div>
          ))}
        </div>
      );
    case "chart":
      return <ChartBlockView b={b} />;
    case "table":
      return (
        <div className="overflow-x-auto rounded-xl border border-border break-inside-avoid">
          {b.title && (
            <div className="px-4 py-2 text-sm font-semibold border-b border-border">{b.title}</div>
          )}
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                {b.columns.map((c, i) => (
                  <th key={i} className="text-left px-3 py-2 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i} className="border-t border-border">
                  {r.map((c, j) => (
                    <td key={j} className="px-3 py-2">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "image":
      return <ImageBlockView b={b} />;
    case "callout": {
      const { cls, Icon } = TONE[b.tone];
      return (
        <div className={`flex gap-3 rounded-xl border p-4 text-sm break-inside-avoid ${cls}`}>
          <Icon className="h-4 w-4 mt-0.5 shrink-0" />
          <p>{b.text}</p>
        </div>
      );
    }
  }
}

export interface BlockActions {
  onEdit: (chapterIdx: number, blockIdx: number) => void;
  onDelete: (chapterIdx: number, blockIdx: number) => void;
  onAskAi: (chapterIdx: number, blockIdx: number) => void;
}

function BlockKebab({
  onEdit,
  onDelete,
  onAskAi,
}: {
  onEdit: () => void;
  onDelete: () => void;
  onAskAi: () => void;
}) {
  return (
    <div className="absolute right-1 top-1 z-10 print:hidden" data-pdf-ignore>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="icon"
            variant="secondary"
            className="h-7 w-7 opacity-70 hover:opacity-100"
            aria-label="Ações do bloco"
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onAskAi}>
            <Wand2 className="h-4 w-4 mr-2" />
            Pedir alteração à IA
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export function ReportView({
  report,
  actions,
}: {
  report: GeneralReportContent;
  actions?: BlockActions;
}) {
  return (
    <article className="space-y-8" id="general-report-article">
      <header className="rounded-2xl bg-primary text-primary-foreground p-6" data-pdf-block>
        <h2 className="text-2xl font-bold">{report.title}</h2>
        {report.subtitle && <p className="opacity-90 mt-1">{report.subtitle}</p>}
        {report.executive_summary && (
          <p className="mt-4 text-sm leading-relaxed opacity-95">{report.executive_summary}</p>
        )}
      </header>
      {report.chapters.map((ch, i) => (
        <section key={i} className="space-y-4">
          <div className="border-l-4 border-primary pl-3" data-pdf-block>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Capítulo {String(i + 1).padStart(2, "0")}
            </div>
            <h3 className="text-lg font-bold">{ch.title}</h3>
            {ch.summary && <p className="text-sm text-muted-foreground">{ch.summary}</p>}
          </div>
          {ch.blocks.map((b, k) => (
            <div key={k} className="relative group" data-pdf-block>
              {actions && (
                <BlockKebab
                  onEdit={() => actions.onEdit(i, k)}
                  onDelete={() => actions.onDelete(i, k)}
                  onAskAi={() => actions.onAskAi(i, k)}
                />
              )}
              <Block b={b} />
            </div>
          ))}
        </section>
      ))}
      {report.gaps && report.gaps.length > 0 && (
        <section className="rounded-xl border border-dashed border-border p-4" data-pdf-block>
          <h4 className="text-sm font-semibold mb-1">Lacunas e limitações do material</h4>
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
            {report.gaps.map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
