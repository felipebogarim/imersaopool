// Relatório gerencial de performance do representante.
// Gera um HTML visual (KPIs, barras, distribuição de farol) em nova aba,
// pronto para leitura na tela ou "Salvar como PDF" pela impressão do navegador.
//
// GOVERNANÇA DE MÉTRICAS: todos os números vêm de src/lib/performance-metrics.ts.
// Cada bloco declara explicitamente qual métrica está exibindo; número, faixa e
// ordenação sempre derivam da MESMA métrica.
// IMPORTANTE: nunca exibe valores monetários — apenas percentuais, faixas e faróis.
import {
  FAROL_HEX,
  FAROL_LABEL,
  FAROL_ORDER,
  type FarolStatus,
} from "./performance-farol";
import {
  METRIC_DEFS,
  calculateRepresentativeMetrics,
  clientesCriticos,
  clientesNaMeta,
  rankExpansionOpportunities,
  rankLowestAchievement,
  rankTopPerformers,
  type ClientMetrics,
} from "./performance-metrics";

export type ReportRow = {
  razao_social: string;
  categoria: string | null;
  metas?: Record<string, number> | null;
  realizado?: Record<string, number> | null;
  familia_pct?: Record<string, number> | null;
  metas_status?: Record<string, FarolStatus> | null;
  total_pct?: number | null;
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]!));

/** Ratio (1 = 100%) → texto percentual. */
const pctR = (n: number | null | undefined) =>
  n == null || Number.isNaN(n) ? "—" : `${(n * 100).toFixed(1).replace(".", ",")}%`;
const pct = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;

function distBar(counts: Record<FarolStatus, number>, total: number) {
  if (!total) return `<div class="bar empty"></div>`;
  const seg = FAROL_ORDER.filter((s) => counts[s] > 0)
    .map(
      (s) =>
        `<span class="seg" style="width:${(counts[s] / total) * 100}%;background:#${FAROL_HEX[s]}" title="${FAROL_LABEL[s]}: ${counts[s]}"></span>`,
    )
    .join("");
  return `<div class="bar">${seg}</div>`;
}

export function exportPerformanceReport(opts: {
  representante: string;
  periodo: string;
  familias: string[];
  rows: ReportRow[];
}) {
  const { representante, periodo, familias, rows } = opts;

  // ---- CAMADA CENTRAL DE MÉTRICAS -----------------------------------------
  const rep = calculateRepresentativeMetrics(
    rows.map((r) => ({
      razao_social: r.razao_social,
      categoria: r.categoria,
      metas: r.metas ?? null,
      realizado: r.realizado ?? null,
      familia_pct: r.familia_pct ?? null,
      metas_status: r.metas_status ?? null,
      total_pct: r.total_pct ?? null,
    })),
    familias,
  );

  const geral = rep.distribuicao_clientes;
  const comStatus = rep.universo_clientes;
  const naMeta = clientesNaMeta(rep.clientes).length;
  const criticos = clientesCriticos(rep.clientes).length;
  const semCompra = geral.sem_compra;

  const famOrdenadas = [...rep.familias_metrics].sort(
    (a, b) => (b.metrics.real_achievement ?? -1) - (a.metrics.real_achievement ?? -1),
  );
  const cats = rep.categorias;

  const destaques = rankTopPerformers(rep.clientes, 10);
  const piores = rankLowestAchievement(rep.clientes, 10);
  const oportunidades = rankExpansionOpportunities(rep.clientes, 10);

  // Clientes por faixa (farol derivado do real_achievement do cliente)
  const clientesPorFaixa: Record<string, { cat: string; nome: string; score: number }[]> = {};
  for (const s of FAROL_ORDER) clientesPorFaixa[s] = [];
  for (const c of rep.clientes) {
    if (c.farol)
      clientesPorFaixa[c.farol].push({
        cat: c.categoria ?? "—",
        nome: c.razao_social,
        score: (c.metrics.real_achievement ?? 0) * 100,
      });
  }
  for (const s of FAROL_ORDER) {
    clientesPorFaixa[s].sort((a, b) => a.cat.localeCompare(b.cat) || a.nome.localeCompare(b.nome));
  }

  const legenda = FAROL_ORDER.map(
    (s) => `<span class="lg"><i style="background:#${FAROL_HEX[s]}"></i>${FAROL_LABEL[s]}</span>`,
  ).join("");

  const kpi = (label: string, value: string, sub: string, tip = "") =>
    `<div class="kpi"${tip ? ` title="${esc(tip)}"` : ""}><div class="kpi-l">${label}</div><div class="kpi-v">${value}</div><div class="kpi-s">${sub}</div></div>`;

  const famRows = famOrdenadas
    .map(
      (f) => `<tr>
      <td class="nm">${esc(f.familia)}</td>
      <td class="num">${pctR(f.metrics.real_achievement)}</td>
      <td class="num">${pctR(f.metrics.portfolio_balance_index)}</td>
      <td class="barcell">${distBar(f.distribuicao, f.universo)}</td>
      <td class="num small">${f.clientes_que_compraram}</td>
    </tr>`,
    )
    .join("");

  const catRows = cats
    .map(
      (c) => `<tr>
      <td class="nm">${esc(c.categoria)}</td>
      <td class="num small">${c.clientes}</td>
      <td class="num">${pctR(c.metrics.real_achievement)}</td>
      <td class="num">${pctR(c.metrics.portfolio_balance_index)}</td>
      <td class="barcell">${distBar(c.distribuicao, c.universo)}</td>
    </tr>`,
    )
    .join("");

  // Rankings: número exibido e faixa derivam SEMPRE de real_achievement.
  const listRows = (arr: ClientMetrics[]) =>
    arr
      .map(
        (r) => `<tr>
        <td class="nm">${esc(r.razao_social)}</td>
        <td class="small">${esc(r.categoria ?? "—")}</td>
        <td class="num">${pctR(r.metrics.real_achievement)}</td>
        <td><span class="pill" style="background:#${r.farol ? FAROL_HEX[r.farol] : "E5E5E5"}">${r.farol ? FAROL_LABEL[r.farol] : "—"}</span></td>
      </tr>`,
      )
      .join("");

  const oportunidadeRows = oportunidades
    .map(
      (r) => `<tr>
      <td class="nm">${esc(r.razao_social)}</td>
      <td class="small">${esc(r.categoria ?? "—")}</td>
      <td class="num">${r.familias_sem_compra.length}</td>
      <td class="num">${pctR(r.cobertura)}</td>
      <td class="num">${pctR(r.metrics.real_achievement)}</td>
    </tr>`,
    )
    .join("");


  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Relatório Gerencial — ${esc(representante)}</title>
<style>
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 28px 32px 48px; color: #0f172a; background: #f8fafc; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  header { border-bottom: 3px solid #0f172a; padding-bottom: 14px; margin-bottom: 22px; }
  h1 { font-size: 22px; margin: 0 0 4px; letter-spacing: -.02em; }
  .sub { color: #64748b; font-size: 13px; }
  h2 { font-size: 14px; text-transform: uppercase; letter-spacing: .08em; color: #334155; margin: 28px 0 10px; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
  .kpi { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px 16px; }
  .kpi-l { font-size: 11px; text-transform: uppercase; letter-spacing: .06em; color: #64748b; }
  .kpi-v { font-size: 28px; font-weight: 700; margin: 4px 0 2px; letter-spacing: -.03em; }
  .kpi-s { font-size: 11px; color: #94a3b8; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 6px 14px 12px; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; color: #64748b; padding: 8px 6px; border-bottom: 1px solid #e2e8f0; }
  td { padding: 7px 6px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  td.nm { font-weight: 600; }
  td.num { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
  .small { color: #64748b; font-weight: 400; }
  .barcell { width: 28%; }
  .hbar { background: #f1f5f9; border-radius: 999px; height: 8px; overflow: hidden; }
  .hbar span { display: block; height: 8px; background: linear-gradient(90deg,#0ea5e9,#10b981); border-radius: 999px; }
  .bar { display: flex; height: 10px; border-radius: 999px; overflow: hidden; background: #f1f5f9; }
  .bar .seg { display: block; height: 10px; }
  .bar.empty { background: #f1f5f9; }
  .legend { display: flex; flex-wrap: wrap; gap: 12px; margin: 10px 0 4px; font-size: 11px; color: #475569; }
  .lg { display: inline-flex; align-items: center; gap: 5px; }
  .lg i { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
  .pill { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10.5px; font-weight: 600; color: #0f172a; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .note { margin-top: 26px; font-size: 10.5px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
  .toolbar { position: fixed; top: 14px; right: 18px; }
  .toolbar button { background: #0f172a; color: #fff; border: 0; border-radius: 8px; padding: 9px 14px; font-size: 12px; cursor: pointer; }
  .kebabcell { position: relative; width: 36px; text-align: right; }
  .kebab { background: transparent; border: 0; font-size: 18px; line-height: 1; cursor: pointer; color: #64748b; padding: 2px 6px; border-radius: 6px; }
  .kebab:hover { background: #f1f5f9; color: #0f172a; }
  .menu { display: none; position: absolute; right: 4px; top: 28px; background: #fff; border: 1px solid #e2e8f0; border-radius: 10px; box-shadow: 0 8px 24px rgba(15,23,42,.12); z-index: 20; min-width: 210px; overflow: hidden; }
  .menu.open { display: block; }
  .menu button { display: block; width: 100%; text-align: left; background: none; border: 0; padding: 9px 12px; font-size: 12px; cursor: pointer; color: #0f172a; }
  .menu button:hover { background: #f8fafc; }
  .overlay { display: none; position: fixed; inset: 0; background: rgba(15,23,42,.45); align-items: flex-start; justify-content: center; padding: 40px 16px; z-index: 50; }
  .modal { background: #fff; border-radius: 14px; width: min(760px, 100%); max-height: 82vh; overflow: auto; padding: 16px 20px 22px; }
  .mhead { display: flex; align-items: center; justify-content: space-between; gap: 12px; position: sticky; top: -16px; background: #fff; padding: 6px 0 12px; }
  .mhead button { background: #0f172a; color: #fff; border: 0; border-radius: 8px; padding: 7px 12px; font-size: 12px; cursor: pointer; }
  .modal h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: #334155; margin: 16px 0 4px; }
  .modal .cnt { color: #94a3b8; font-weight: 400; }

  @page { margin: 12mm 10mm; }
  @media print {
    body { background: #f8fafc; padding: 0 6px; }
    .toolbar, .kebabcell, .menu, .overlay { display: none !important; }
    .card, .kpi { break-inside: avoid; background: #fff !important; border-color: #e2e8f0 !important; }
    .bar, .hbar, .bar .seg, .hbar span, .pill, .lg i { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    h2 { break-after: avoid; }
  }
  @media (max-width: 780px) { .grid { grid-template-columns: repeat(2, 1fr); } .two { grid-template-columns: 1fr; } }
</style></head><body>
<div class="toolbar"><button onclick="window.print()">Salvar como PDF</button></div>
<header>
  <h1>Relatório Gerencial de Performance</h1>
  <div class="sub"><strong>${esc(representante)}</strong> • Período: ${esc(periodo)} • Gerado em ${new Date().toLocaleString("pt-BR")}</div>
</header>

<div class="grid">
  ${kpi("Clientes na base", String(rep.clientes.length), `${familias.length} famílias avaliadas`)}
  ${kpi("Atingimento real geral", pctR(rep.metrics.real_achievement), METRIC_DEFS.real_achievement.formula, METRIC_DEFS.real_achievement.tooltip)}
  ${kpi("Clientes na meta ou acima", comStatus ? pct((naMeta / comStatus) * 100) : "—", `${naMeta} de ${comStatus} clientes · atingimento real ≥ 100%`)}
  ${kpi("Clientes críticos", comStatus ? pct((criticos / comStatus) * 100) : "—", `${semCompra} sem compra · sem compra + abaixo da meta`)}
</div>

<h2>Indicadores analíticos complementares</h2>
<div class="grid">
  ${kpi("Média de atingimento dos clientes", pctR(rep.metrics.client_average_achievement), METRIC_DEFS.client_average_achievement.formula, METRIC_DEFS.client_average_achievement.tooltip)}
  ${kpi("Índice ponderado do farol", pctR(rep.metrics.weighted_farol_index), METRIC_DEFS.weighted_farol_index.formula, METRIC_DEFS.weighted_farol_index.tooltip)}
  ${kpi("Índice de equilíbrio do portfólio", pctR(rep.metrics.portfolio_balance_index), METRIC_DEFS.portfolio_balance_index.formula, METRIC_DEFS.portfolio_balance_index.tooltip)}
  ${kpi("Famílias avaliadas", String(familias.length), "universo de famílias da versão de Performance")}
</div>

<h2>Distribuição geral do farol</h2>
<div class="card">
  <div class="kpi-s" style="padding:6px 0 0">Farol derivado do atingimento real de cada cliente.</div>
  <div style="padding:12px 0 2px">${distBar(geral, comStatus)}</div>
  <div class="legend">${legenda}</div>
  <table><thead><tr><th>Faixa</th><th>Clientes</th><th>Participação</th><th style="width:40%"></th><th style="width:36px"></th></tr></thead><tbody>
  ${FAROL_ORDER.map(
    (s) => `<tr>
      <td class="nm"><span class="pill" style="background:#${FAROL_HEX[s]}">${FAROL_LABEL[s]}</span></td>
      <td class="num">${geral[s]}</td>
      <td class="num">${comStatus ? pct((geral[s] / comStatus) * 100) : "—"}</td>
      <td class="barcell"><div class="hbar"><span style="width:${comStatus ? (geral[s] / comStatus) * 100 : 0}%;background:#${FAROL_HEX[s]}"></span></div></td>
      <td class="kebabcell">
        <button class="kebab" data-faixa="${s}" title="Ações">⋮</button>
        <div class="menu" id="menu-${s}">
          <button data-act="view" data-faixa="${s}">Visualizar clientes</button>
          <button data-act="csv" data-faixa="${s}">Exportar lista de clientes</button>
        </div>
      </td>
    </tr>`,
  ).join("")}
  </tbody></table>
  <div class="kpi-s">Validação: ${FAROL_ORDER.reduce((s, k) => s + geral[k], 0)} clientes classificados de ${rep.clientes.length} na base.</div>
</div>

<h2>Performance por família de produto</h2>
<div class="card">
  <table><thead><tr><th>Família</th><th style="text-align:right" title="${esc(METRIC_DEFS.real_achievement.tooltip)}">Atingimento real</th><th style="text-align:right" title="${esc(METRIC_DEFS.portfolio_balance_index.tooltip)}">Índice de equilíbrio</th><th>Distribuição do farol</th><th style="text-align:right">Clientes que compraram</th></tr></thead>
  <tbody>${famRows || `<tr><td colspan="5" class="small">Sem dados de família.</td></tr>`}</tbody></table>
  <div class="legend">${legenda}</div>
</div>

<h2>Performance por categoria de cliente</h2>
<div class="card">
  <table><thead><tr><th>Categoria</th><th style="text-align:right">Clientes</th><th style="text-align:right" title="${esc(METRIC_DEFS.real_achievement.tooltip)}">Atingimento real</th><th style="text-align:right" title="${esc(METRIC_DEFS.portfolio_balance_index.tooltip)}">Índice de equilíbrio</th><th>Distribuição do farol</th></tr></thead>
  <tbody>${catRows || `<tr><td colspan="5" class="small">Sem categorias.</td></tr>`}</tbody></table>
</div>

<h2>Rankings de desempenho</h2>
<div class="two">
  <div class="card">
    <h2 style="margin:12px 0 4px">Top 10 — melhor desempenho</h2>
    <div class="kpi-s">Ordenado e exibido por atingimento real (decrescente).</div>
    <table><thead><tr><th>Cliente</th><th>Categoria</th><th style="text-align:right">Atingimento real</th><th>Faixa</th></tr></thead>
    <tbody>${listRows(destaques) || `<tr><td colspan="4" class="small">Sem dados.</td></tr>`}</tbody></table>
  </div>
  <div class="card">
    <h2 style="margin:12px 0 4px">Top 10 — menor atingimento</h2>
    <div class="kpi-s">Ordenado e exibido por atingimento real (crescente).</div>
    <table><thead><tr><th>Cliente</th><th>Categoria</th><th style="text-align:right">Atingimento real</th><th>Faixa</th></tr></thead>
    <tbody>${listRows(piores) || `<tr><td colspan="4" class="small">Sem dados.</td></tr>`}</tbody></table>
  </div>
</div>

<h2>Top 10 — oportunidades de expansão de portfólio</h2>
<div class="card">
  <div class="kpi-s">Critério: 1) mais famílias sem compra, 2) menor cobertura de famílias, 3) menor atingimento real.</div>
  <table><thead><tr><th>Cliente</th><th>Categoria</th><th style="text-align:right">Famílias sem compra</th><th style="text-align:right">Cobertura de famílias</th><th style="text-align:right">Atingimento real</th></tr></thead>
  <tbody>${oportunidadeRows || `<tr><td colspan="5" class="small">Sem dados.</td></tr>`}</tbody></table>
</div>

<div class="note">
  Documento gerencial confidencial. Métricas: <strong>Atingimento real</strong> = ${esc(METRIC_DEFS.real_achievement.formula)};
  <strong>Média de atingimento dos clientes</strong> = ${esc(METRIC_DEFS.client_average_achievement.formula)};
  <strong>Índice ponderado do farol</strong> = ${esc(METRIC_DEFS.weighted_farol_index.formula)};
  <strong>Índice de equilíbrio do portfólio</strong> = ${esc(METRIC_DEFS.portfolio_balance_index.formula)}.
  Nenhum valor monetário de meta ou venda é exibido.
</div>


<div class="overlay" id="ov"><div class="modal">
  <div class="mhead"><strong id="mtitle"></strong><button id="mclose">Fechar</button></div>
  <div id="mbody"></div>
</div></div>

<script>
  var DATA = ${JSON.stringify(clientesPorFaixa)};
  var LABEL = ${JSON.stringify(FAROL_LABEL)};
  var HEX = ${JSON.stringify(FAROL_HEX)};
  var REP = ${JSON.stringify(representante)};
  var PER = ${JSON.stringify(periodo)};
  function esc(s){return String(s==null?"":s).replace(/[<>&"]/g,function(c){return {"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;"}[c];});}
  function groupByCat(list){var m={};list.forEach(function(c){(m[c.cat]=m[c.cat]||[]).push(c);});return m;}
  function closeMenus(){document.querySelectorAll('.menu.open').forEach(function(m){m.classList.remove('open');});}
  document.addEventListener('click',function(e){
    var t=e.target;
    if(t.classList&&t.classList.contains('kebab')){
      e.stopPropagation();
      var m=document.getElementById('menu-'+t.dataset.faixa);
      var was=m.classList.contains('open'); closeMenus(); if(!was)m.classList.add('open');
      return;
    }
    if(t.dataset&&t.dataset.act){
      closeMenus();
      var f=t.dataset.faixa;
      if(t.dataset.act==='view')view(f); else csv(f);
      return;
    }
    closeMenus();
  });
  function view(f){
    var g=groupByCat(DATA[f]||[]);
    var cats=Object.keys(g).sort();
    var html=cats.length?cats.map(function(c){
      return '<h3>'+esc(c)+' <span class="cnt">'+g[c].length+'</span></h3><table><thead><tr><th>Cliente</th><th style="text-align:right">Atingimento</th></tr></thead><tbody>'+
        g[c].map(function(r){return '<tr><td class="nm">'+esc(r.nome)+'</td><td class="num">'+r.score.toFixed(1).replace('.',',')+'%</td></tr>';}).join('')+
      '</tbody></table>';
    }).join(''):'<p class="small">Nenhum cliente nesta faixa.</p>';
    document.getElementById('mtitle').innerHTML='Clientes — <span class="pill" style="background:#'+HEX[f]+'">'+esc(LABEL[f])+'</span>';
    document.getElementById('mbody').innerHTML=html;
    document.getElementById('ov').style.display='flex';
  }
  document.getElementById('mclose').onclick=function(){document.getElementById('ov').style.display='none';};
  document.getElementById('ov').onclick=function(e){if(e.target.id==='ov')this.style.display='none';};
  function csv(f){
    var g=groupByCat(DATA[f]||[]);
    var cats=Object.keys(g).sort();
    var lines=['sep=;','Representante;'+REP,'Periodo;'+PER,'Faixa;'+LABEL[f],'','Categoria;Cliente;Atingimento (%)'];
    cats.forEach(function(c){
      g[c].forEach(function(r){lines.push('"'+c.replace(/"/g,'""')+'";"'+r.nome.replace(/"/g,'""')+'";'+r.score.toFixed(1).replace('.',','));});
      lines.push('');
    });
    var blob=new Blob(['\\uFEFF'+lines.join('\\r\\n')],{type:'text/csv;charset=utf-8;'});
    var a=document.createElement('a');
    a.href=URL.createObjectURL(blob);
    a.download='clientes-'+f+'-'+REP.replace(/[^a-z0-9]+/gi,'-').toLowerCase()+'.csv';
    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);
  }
</script>
</body></html>`;


  const w = window.open("", "_blank");
  if (!w) {
    alert("Bloqueado pelo navegador. Permita pop-ups para gerar o relatório.");
    return;
  }
  w.document.write(html);
  w.document.close();
}
