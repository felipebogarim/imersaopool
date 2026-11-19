import type { ReactNode } from "react";
import {
  formatBRL,
  formatPct,
  noteText,
  periodText,
  trendOf,
  type ComparisonItem,
  type ImportBlock,
  type ImportedReport,
  type Trend,
} from "@/lib/general-report-import";

// Cores dos gráficos (fixas: o mesmo azul/laranja do relatório de referência, em claro e escuro).
const PREV = "#5B8DB0";
const CURR = "#E0A33E";
const TREND_TEXT: Record<Trend, string> = {
  down: "text-red-600 dark:text-red-400",
  up: "text-emerald-600 dark:text-emerald-400",
  flat: "text-muted-foreground",
};
const TREND_BOX: Record<Trend, string> = {
  down: "border-red-500/40 bg-red-500/10",
  up: "border-emerald-500/40 bg-emerald-500/10",
  flat: "border-border bg-muted/40",
};
const GAIN = "#2E8B57";

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      className="rounded-2xl border border-border bg-card p-5 space-y-4 break-inside-avoid"
      data-pdf-block
    >
      <h3 className="text-base font-bold">{title}</h3>
      {children}
    </section>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <i className="h-3 w-3 rounded-sm" style={{ background: PREV }} />
        Média anterior
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className="h-3 w-3 rounded-sm" style={{ background: CURR }} />
        Média atual
      </span>
    </div>
  );
}

/** Coluna vertical: barra proporcional ao valor, com o rótulo SEMPRE visível acima. */
function VBar({
  cents,
  max,
  color,
  label,
}: {
  cents: number;
  max: number;
  color: string;
  label: string;
}) {
  const h = max > 0 ? Math.max(0, Math.min(100, (cents / max) * 100)) : 0;
  return (
    <div className="flex h-full w-[92px] flex-none flex-col items-center justify-end">
      <span className="mb-1 whitespace-nowrap text-[11px] font-semibold tabular-nums leading-tight">
        {label}
      </span>
      <div
        className="w-14 rounded-t-md"
        style={{ height: `${h}%`, background: color, minHeight: cents > 0 ? 2 : 0 }}
      />
    </div>
  );
}

/** Barra horizontal com o valor logo na ponta da barra (visível sem passar o mouse). */
function HBar({
  cents,
  max,
  color,
  label,
}: {
  cents: number;
  max: number;
  color: string;
  label: string;
}) {
  const w = max > 0 ? Math.max(0, Math.min(100, (cents / max) * 100)) * 0.78 : 0;
  return (
    <div className="relative h-5 w-full">
      <div
        className="absolute left-0 top-0.5 h-4 rounded-r-md"
        style={{ width: `${w}%`, background: color, minWidth: cents > 0 ? 2 : 0 }}
      />
      <span
        className="absolute top-0 whitespace-nowrap text-xs font-semibold leading-5 tabular-nums"
        style={{ left: `calc(${w}% + 6px)` }}
      >
        {label}
      </span>
    </div>
  );
}

function OverallResult({ b }: { b: Extract<ImportBlock, { type: "overall_result" }> }) {
  const t = trendOf(b.change_cents);
  const max = Math.max(b.previous_cents, b.current_cents, 0);
  return (
    <Card title={b.title ?? "Resultado geral"}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-stretch">
        <div className="flex h-64 w-full max-w-sm flex-1 items-end justify-center gap-3 border-b border-border pt-2">
          <VBar
            cents={b.previous_cents}
            max={max}
            color={PREV}
            label={formatBRL(b.previous_cents)}
          />
          <VBar cents={b.current_cents} max={max} color={CURR} label={formatBRL(b.current_cents)} />
        </div>
        <div
          className={`self-center rounded-xl border p-4 sm:min-w-[190px] ${TREND_BOX[t]}`}
          aria-label="Variação líquida"
        >
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Variação líquida
          </div>
          <div className={`text-2xl font-bold tabular-nums ${TREND_TEXT[t]}`}>
            {formatPct(b.change_pct, { sign: true })}
          </div>
          <div className={`text-sm font-semibold tabular-nums ${TREND_TEXT[t]}`}>
            {formatBRL(b.change_cents, { sign: true })}
            <span className="font-normal text-muted-foreground"> /mês</span>
          </div>
        </div>
      </div>
      <div className="flex justify-center gap-3 max-w-sm text-center text-xs text-muted-foreground">
        <span className="w-[92px]">Média anterior</span>
        <span className="w-[92px]">Média atual</span>
      </div>
    </Card>
  );
}

function MonthlyByState({ b }: { b: Extract<ImportBlock, { type: "monthly_by_state" }> }) {
  const max = Math.max(0, ...b.items.flatMap((i) => [i.previous_cents, i.current_cents]));
  return (
    <Card title={b.title ?? "Média mensal por estado: anterior vs. atual"}>
      <Legend />
      <div className="overflow-x-auto">
        <div className="flex" style={{ minWidth: b.items.length * 170 }}>
          {b.items.map((i, k) => {
            const t = trendOf(i.change_cents);
            return (
              <div key={`${i.uf}-${k}`} className="flex-1 min-w-[170px] px-1.5">
                <div className="flex h-56 items-end justify-center gap-1 border-b border-border">
                  <VBar
                    cents={i.previous_cents}
                    max={max}
                    color={PREV}
                    label={formatBRL(i.previous_cents)}
                  />
                  <VBar
                    cents={i.current_cents}
                    max={max}
                    color={CURR}
                    label={formatBRL(i.current_cents)}
                  />
                </div>
                <div className="pt-2 text-center">
                  <div className="text-sm font-bold">{i.uf}</div>
                  <div className={`text-xs font-semibold tabular-nums ${TREND_TEXT[t]}`}>
                    {formatBRL(i.change_cents, { sign: true })}
                  </div>
                  <div className={`text-xs tabular-nums ${TREND_TEXT[t]}`}>
                    {formatPct(i.change_pct, { sign: true })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}

const th =
  "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";
const num = "px-3 py-2 text-right tabular-nums whitespace-nowrap";

function LossConcentration({ b }: { b: Extract<ImportBlock, { type: "loss_concentration" }> }) {
  return (
    <Card title={b.title ?? "Concentração das perdas"}>
      <div className="flex flex-wrap gap-3 text-sm">
        <span className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-1.5">
          Perda bruta do recorte:{" "}
          <strong className="text-red-600 dark:text-red-400 tabular-nums">
            {formatBRL(b.scope_gross_loss_cents)}/mês
          </strong>
        </span>
        <span className="rounded-lg border border-border bg-muted/40 px-3 py-1.5">
          Participação: <strong className="tabular-nums">{formatPct(b.scope_share_pct)}</strong> da
          perda bruta
        </span>
        <span className="rounded-lg border border-border bg-muted/40 px-3 py-1.5">
          <strong className="tabular-nums">{b.scope_records}</strong> registros
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className={th}>#</th>
              <th className={th}>Conta</th>
              <th className={th}>UF</th>
              <th className={`${th} text-right`}>Média anterior</th>
              <th className={`${th} text-right`}>Média atual</th>
              <th className={`${th} text-right`}>Queda mensal</th>
              <th className={th}>Relato comercial</th>
            </tr>
          </thead>
          <tbody>
            {b.rows.map((r, k) => {
              const t = trendOf(r.change_cents);
              return (
                <tr key={k} className="border-b border-border/60 align-top">
                  <td className="px-3 py-2 font-semibold">{r.position}º</td>
                  <td className="px-3 py-2 font-medium">{r.account}</td>
                  <td className="px-3 py-2">{r.uf}</td>
                  <td className={num}>{formatBRL(r.previous_cents)}</td>
                  <td className={num}>{formatBRL(r.current_cents)}</td>
                  <td className={`${num} font-semibold ${TREND_TEXT[t]}`}>
                    {formatBRL(r.change_cents, { sign: true })}
                    <div className="text-xs font-normal">
                      {formatPct(r.change_pct, { sign: true })}
                    </div>
                  </td>
                  <td className="px-3 py-2 min-w-[220px] text-muted-foreground">
                    {noteText(r.note)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Top10({ b }: { b: Extract<ImportBlock, { type: "top10_growth" }> }) {
  const max = Math.max(0, ...b.items.map((i) => i.gain_cents));
  return (
    <Card title={b.title ?? "Top 10 crescimentos"}>
      <ul className="space-y-2">
        {b.items.map((i, k) => (
          <li key={k} className="grid grid-cols-[minmax(120px,220px)_1fr] items-center gap-3">
            <div className="text-sm leading-tight">
              <div className="font-medium">{i.account}</div>
              <div className="text-xs text-muted-foreground">{i.uf}</div>
            </div>
            <HBar
              cents={i.gain_cents}
              max={max}
              color={GAIN}
              label={formatBRL(i.gain_cents, { sign: true })}
            />
          </li>
        ))}
      </ul>
      {b.no_base && b.no_base.length > 0 && (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-3 space-y-1.5">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Sem base no ano anterior
          </div>
          <ul className="space-y-1 text-sm">
            {b.no_base.map((i, k) => (
              <li key={k} className="flex flex-wrap justify-between gap-2">
                <span>
                  <strong>{i.account}</strong> · {i.uf}
                </span>
                <span className="tabular-nums">{formatBRL(i.current_cents)} (média atual)</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function Top6Comparison({ items, title }: { items: ComparisonItem[]; title?: string }) {
  const max = Math.max(0, ...items.flatMap((i) => [i.previous_cents, i.current_cents]));
  return (
    <Card title={title ?? "Top 6 crescimentos · Comparativo"}>
      <Legend />
      <ul className="space-y-4">
        {items.map((i, k) => (
          <li
            key={k}
            className="grid items-center gap-3 sm:grid-cols-[minmax(120px,200px)_1fr_auto]"
          >
            <div className="text-sm leading-tight">
              <div className="font-medium">{i.account}</div>
              <div className="text-xs text-muted-foreground">{i.uf}</div>
            </div>
            <div className="space-y-1.5">
              {(
                [
                  [i.previous_cents, PREV],
                  [i.current_cents, CURR],
                ] as const
              ).map(([c, col], n) => (
                <HBar key={n} cents={c} max={max} color={col} label={formatBRL(c)} />
              ))}
            </div>
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-right">
              <div className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatBRL(i.gain_cents, { sign: true })}
              </div>
              <div className="text-xs tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatPct(i.gain_pct, { sign: true })}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Top6Reasons({ b }: { b: Extract<ImportBlock, { type: "top6_reasons" }> }) {
  return (
    <Card title={b.title ?? "Motivos de crescimento · Top 6"}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className={th}>Conta</th>
              <th className={th}>UF</th>
              <th className={`${th} text-right`}>Média anterior</th>
              <th className={`${th} text-right`}>Média atual</th>
              <th className={`${th} text-right`}>Crescimento mensal</th>
              <th className={th}>Relato comercial</th>
            </tr>
          </thead>
          <tbody>
            {b.items.map((r, k) => (
              <tr key={k} className="border-b border-border/60 align-top">
                <td className="px-3 py-2 font-medium">{r.account}</td>
                <td className="px-3 py-2">{r.uf}</td>
                <td className={num}>{formatBRL(r.previous_cents)}</td>
                <td className={num}>{formatBRL(r.current_cents)}</td>
                <td className={`${num} font-semibold ${TREND_TEXT[trendOf(r.gain_cents)]}`}>
                  {formatBRL(r.gain_cents, { sign: true })}
                </td>
                <td className="px-3 py-2 min-w-[220px] text-muted-foreground">
                  {noteText(r.note)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Intro({
  report,
  b,
}: {
  report: ImportedReport;
  b: Extract<ImportBlock, { type: "intro" }>;
}) {
  return (
    <header className="rounded-2xl bg-primary p-6 text-primary-foreground" data-pdf-block>
      <h2 className="text-2xl font-bold">{b.title ?? report.title}</h2>
      {(b.subtitle ?? periodText(report.period)) && (
        <p className="mt-1 opacity-90">{b.subtitle ?? periodText(report.period)}</p>
      )}
      <div className="mt-5 space-y-5 text-sm leading-relaxed opacity-95">
        {b.themes.map((t, i) => (
          <p key={i}>
            <strong className="font-bold">{t.headline}</strong>
            {t.detail && (
              <>
                <br />
                {t.detail}
              </>
            )}
          </p>
        ))}
      </div>
    </header>
  );
}

/** Relatório importado, exibido na ordem aprovada. Só formata: nada é recalculado. */
export function ImportedReportView({ report }: { report: ImportedReport }) {
  const hasIntro = report.blocks.some((b) => b.type === "intro");
  return (
    <article className="space-y-6" id="general-report-article">
      {!hasIntro && (
        <header className="rounded-2xl bg-primary p-6 text-primary-foreground" data-pdf-block>
          <h2 className="text-2xl font-bold">{report.title}</h2>
          <p className="mt-1 opacity-90">{periodText(report.period)}</p>
        </header>
      )}
      {report.blocks.map((b, i) => {
        switch (b.type) {
          case "intro":
            return <Intro key={i} report={report} b={b} />;
          case "overall_result":
            return <OverallResult key={i} b={b} />;
          case "monthly_by_state":
            return <MonthlyByState key={i} b={b} />;
          case "loss_concentration":
            return <LossConcentration key={i} b={b} />;
          case "top10_growth":
            return <Top10 key={i} b={b} />;
          case "top6_comparison":
            return <Top6Comparison key={i} items={b.items} title={b.title} />;
          case "top6_reasons":
            return <Top6Reasons key={i} b={b} />;
        }
      })}
    </article>
  );
}
