// Relatório gerencial de performance do representante.
// Gera um HTML visual (KPIs, barras, distribuição de farol) em nova aba,
// pronto para leitura na tela ou "Salvar como PDF" pela impressão do navegador.
// IMPORTANTE: nunca exibe valores monetários — apenas percentuais, faixas e faróis.
import {
  FAROL_HEX,
  FAROL_LABEL,
  FAROL_MIDPOINT,
  FAROL_ORDER,
  type FarolStatus,
} from "./performance-farol";

export type ReportRow = {
  razao_social: string;
  categoria: string | null;
  metas_status?: Record<string, FarolStatus> | null;
  total_pct_status?: FarolStatus | null;
};

const esc = (s: unknown) =>
  String(s ?? "").replace(/[<>&"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c]!));

const pct = (n: number) => `${n.toFixed(1).replace(".", ",")}%`;

function statusOfRow(r: ReportRow, familias: string[]): FarolStatus | null {
  if (r.total_pct_status) return r.total_pct_status;
  const vals = familias.map((f) => r.metas_status?.[f]).filter(Boolean) as FarolStatus[];
  if (!vals.length) return null;
  if (vals.every((v) => v === "sem_compra")) return "sem_compra";
  const counts: Record<string, number> = {};
  for (const v of vals) counts[v] = (counts[v] ?? 0) + 1;
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as FarolStatus) ?? null;
}

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

  const zero = () =>
    FAROL_ORDER.reduce((a, s) => ((a[s] = 0), a), {} as Record<FarolStatus, number>);

  // Distribuição geral por cliente
  const geral = zero();
  let comStatus = 0;
  const rowScores: { nome: string; cat: string; score: number; status: FarolStatus | null; zeros: number }[] = [];
  for (const r of rows) {
    const st = statusOfRow(r, familias);
    if (st) {
      geral[st] += 1;
      comStatus += 1;
    }
    const cells = familias.map((f) => r.metas_status?.[f]).filter(Boolean) as FarolStatus[];
    const score = cells.length
      ? cells.reduce((s, c) => s + FAROL_MIDPOINT[c], 0) / cells.length
      : st
        ? FAROL_MIDPOINT[st]
        : 0;
    rowScores.push({
      nome: r.razao_social,
      cat: r.categoria ?? "—",
      score,
      status: st,
      zeros: cells.filter((c) => c === "sem_compra").length,
    });
  }

  // Distribuição por família
  const perFam = familias.map((f) => {
    const c = zero();
    let n = 0;
    let acc = 0;
    for (const r of rows) {
      const st = r.metas_status?.[f];
      if (!st) continue;
      c[st] += 1;
      n += 1;
      acc += FAROL_MIDPOINT[st];
    }
    return { familia: f, counts: c, total: n, media: n ? acc / n : 0 };
  });
  const famOrdenadas = [...perFam].sort((a, b) => b.media - a.media);

  // Distribuição por categoria
  const catMap = new Map<string, { counts: Record<FarolStatus, number>; total: number; acc: number }>();
  for (const r of rowScores) {
    const e = catMap.get(r.cat) ?? { counts: zero(), total: 0, acc: 0 };
    if (r.status) e.counts[r.status] += 1;
    e.total += 1;
    e.acc += r.score;
    catMap.set(r.cat, e);
  }
  const cats = [...catMap.entries()].sort((a, b) => b[1].total - a[1].total);

  const mediaGeral = rowScores.length ? rowScores.reduce((s, r) => s + r.score, 0) / rowScores.length : 0;
  const acimaMeta = geral.otimo + geral.excelente;
  const semCompra = geral.sem_compra;
  const criticos = geral.abaixo_meta + geral.sem_compra;

  const destaques = [...rowScores].sort((a, b) => b.score - a.score).slice(0, 10);
  const atencao = [...rowScores]
    .sort((a, b) => b.zeros - a.zeros || a.score - b.score)
    .slice(0, 10);

  // Clientes por faixa, agrupados por categoria (para kebab: visualizar / exportar)
  const clientesPorFaixa: Record<string, { cat: string; nome: string; score: number }[]> = {};
  for (const s of FAROL_ORDER) clientesPorFaixa[s] = [];
  for (const r of rowScores) {
    if (r.status) clientesPorFaixa[r.status].push({ cat: r.cat, nome: r.nome, score: r.score });
  }
  for (const s of FAROL_ORDER) {
    clientesPorFaixa[s].sort((a, b) => a.cat.localeCompare(b.cat) || a.nome.localeCompare(b.nome));
  }

  const legenda = FAROL_ORDER.map(
    (s) => `<span class="lg"><i style="background:#${FAROL_HEX[s]}"></i>${FAROL_LABEL[s]}</span>`,
  ).join("");


  const kpi = (label: string, value: string, sub: string) =>
    `<div class="kpi"><div class="kpi-l">${label}</div><div class="kpi-v">${value}</div><div class="kpi-s">${sub}</div></div>`;

  const famRows = famOrdenadas
    .map(
      (f) => `<tr>
      <td class="nm">${esc(f.familia)}</td>
      <td class="num">${pct(f.media)}</td>
      <td class="barcell">
        <div class="hbar"><span style="width:${Math.min(100, f.media)}%"></span></div>
      </td>
      <td class="barcell">${distBar(f.counts, f.total)}</td>
      <td class="num small">${f.total}</td>
    </tr>`,
    )
    .join("");

  const catRows = cats
    .map(
      ([nome, e]) => `<tr>
      <td class="nm">${esc(nome)}</td>
      <td class="num small">${e.total}</td>
      <td class="num">${pct(e.total ? e.acc / e.total : 0)}</td>
      <td class="barcell">${distBar(e.counts, e.total)}</td>
    </tr>`,
    )
    .join("");

  const listRows = (arr: typeof destaques) =>
    arr
      .map(
        (r) => `<tr>
        <td class="nm">${esc(r.nome)}</td>
        <td class="small">${esc(r.cat)}</td>
        <td class="num">${pct(r.score)}</td>
        <td><span class="pill" style="background:#${r.status ? FAROL_HEX[r.status] : "E5E5E5"}">${r.status ? FAROL_LABEL[r.status] : "—"}</span></td>
      </tr>`,
      )
      .join("");

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
<title>Relatório Gerencial — ${esc(representante)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 28px 32px 48px; color: #0f172a; background: #f8fafc; }
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
  @media print { body { background: #fff; padding: 0 6px; } .toolbar { display: none; } .card, .kpi { break-inside: avoid; } h2 { break-after: avoid; } }
  @media (max-width: 780px) { .grid { grid-template-columns: repeat(2, 1fr); } .two { grid-template-columns: 1fr; } }
</style></head><body>
<div class="toolbar"><button onclick="window.print()">Salvar como PDF</button></div>
<header>
  <h1>Relatório Gerencial de Performance</h1>
  <div class="sub"><strong>${esc(representante)}</strong> • Período: ${esc(periodo)} • Gerado em ${new Date().toLocaleString("pt-BR")}</div>
</header>

<div class="grid">
  ${kpi("Clientes na base", String(rows.length), `${familias.length} famílias avaliadas`)}
  ${kpi("Atingimento médio estimado", pct(mediaGeral), "média das faixas de farol")}
  ${kpi("Clientes na meta ou acima", comStatus ? pct((acimaMeta / comStatus) * 100) : "—", `${acimaMeta} de ${comStatus} clientes`)}
  ${kpi("Clientes críticos", comStatus ? pct((criticos / comStatus) * 100) : "—", `${semCompra} sem compra no período`)}
</div>

<h2>Distribuição geral do farol</h2>
<div class="card">
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

</div>

<h2>Performance por família de produto</h2>
<div class="card">
  <table><thead><tr><th>Família</th><th style="text-align:right">Atingimento</th><th>Escala</th><th>Distribuição do farol</th><th style="text-align:right">Clientes</th></tr></thead>
  <tbody>${famRows || `<tr><td colspan="5" class="small">Sem dados de família.</td></tr>`}</tbody></table>
  <div class="legend">${legenda}</div>
</div>

<h2>Performance por categoria de cliente</h2>
<div class="card">
  <table><thead><tr><th>Categoria</th><th style="text-align:right">Clientes</th><th style="text-align:right">Atingimento</th><th>Distribuição do farol</th></tr></thead>
  <tbody>${catRows || `<tr><td colspan="4" class="small">Sem categorias.</td></tr>`}</tbody></table>
</div>

<h2>Destaques e pontos de atenção</h2>
<div class="two">
  <div class="card">
    <h2 style="margin:12px 0 4px">Top 10 — melhor desempenho</h2>
    <table><thead><tr><th>Cliente</th><th>Categoria</th><th style="text-align:right">Atingimento</th><th>Faixa</th></tr></thead>
    <tbody>${listRows(destaques) || `<tr><td colspan="4" class="small">Sem dados.</td></tr>`}</tbody></table>
  </div>
  <div class="card">
    <h2 style="margin:12px 0 4px">Top 10 — maior oportunidade</h2>
    <table><thead><tr><th>Cliente</th><th>Categoria</th><th style="text-align:right">Atingimento</th><th>Faixa</th></tr></thead>
    <tbody>${listRows(atencao) || `<tr><td colspan="4" class="small">Sem dados.</td></tr>`}</tbody></table>
  </div>
</div>

<div class="note">
  Documento gerencial confidencial. Os percentuais são estimativas derivadas das faixas de farol (ponto médio de cada faixa);
  nenhum valor monetário de meta ou venda é exibido.
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
