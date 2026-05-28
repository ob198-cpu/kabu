import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const generatedAt = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
}).format(new Date());

const candidates = [
  ['8316.T', '三井住友FG'],
  ['8766.T', '東京海上HD'],
  ['8306.T', '三菱UFJ FG'],
  ['7011.T', '三菱重工'],
  ['8058.T', '三菱商事'],
  ['6501.T', '日立製作所'],
  ['8031.T', '三井物産'],
  ['5802.T', '住友電工'],
  ['5801.T', '古河電工'],
  ['8001.T', '伊藤忠商事']
];

const benchmarks = [
  ['^N225', '日経平均'],
  ['^GSPC', 'S&P500']
];

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(name, rows, headers) {
  const body = [headers.map(csvEscape).join(',')]
    .concat(rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')))
    .join('\n');
  fs.writeFileSync(path.join(ROOT, name), `${body}\n`, 'utf8');
}

function round(value, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : '';
}

async function fetchChart(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'application/json'
    }
  });
  if (!res.ok) throw new Error(`${symbol}: HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`${symbol}: chart result missing`);
  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const closes = quote.close || [];
  const rows = timestamps
    .map((timestamp, index) => ({
      date: new Date(timestamp * 1000).toISOString().slice(0, 10),
      close: closes[index]
    }))
    .filter((row) => Number.isFinite(row.close));
  if (rows.length < 20) throw new Error(`${symbol}: insufficient rows`);
  return { symbol, url, rows };
}

function pct(now, past) {
  if (!Number.isFinite(now) || !Number.isFinite(past) || past === 0) return null;
  return ((now / past) - 1) * 100;
}

function maxDrawdown(closes) {
  let peak = closes[0];
  let worst = 0;
  for (const close of closes) {
    if (close > peak) peak = close;
    const dd = ((close / peak) - 1) * 100;
    if (dd < worst) worst = dd;
  }
  return worst;
}

function annualVolatility(closes) {
  const returns = [];
  for (let i = 1; i < closes.length; i += 1) {
    returns.push(Math.log(closes[i] / closes[i - 1]));
  }
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function metrics(symbol, name, chart) {
  const closes = chart.rows.map((row) => row.close);
  const last = closes.at(-1);
  const first = closes[0];
  const day20 = closes.length > 20 ? closes.at(-21) : null;
  const day60 = closes.length > 60 ? closes.at(-61) : null;
  const day120 = closes.length > 120 ? closes.at(-121) : null;
  return {
    symbol,
    名称: name,
    開始日: chart.rows[0].date,
    最終日: chart.rows.at(-1).date,
    データ件数: chart.rows.length,
    開始値: round(first),
    最新値: round(last),
    '20日騰落率%': round(pct(last, day20)),
    '60日騰落率%': round(pct(last, day60)),
    '120日騰落率%': round(pct(last, day120)),
    '1年騰落率%': round(pct(last, first)),
    '1年最大下落%': round(maxDrawdown(closes)),
    '年率変動%': round(annualVolatility(closes)),
    取得元: chart.url
  };
}

function scoreFromPrice(row, n225Return, spReturn) {
  const ret = Number(row['1年騰落率%']);
  const dd = Number(row['1年最大下落%']);
  const vol = Number(row['年率変動%']);
  const excessNikkei = Number.isFinite(ret) && Number.isFinite(n225Return) ? ret - n225Return : null;
  const excessSp = Number.isFinite(ret) && Number.isFinite(spReturn) ? ret - spReturn : null;
  const overheat = ret > 150 || vol > 55;
  const trend = Math.max(0, Math.min(100, 50 + (ret / 2)));
  const drawdown = Math.max(0, Math.min(100, 100 + dd));
  const stability = Math.max(0, Math.min(100, 100 - vol));
  const benchmark = Math.max(0, Math.min(100, 50 + ((excessNikkei ?? 0) / 2)));
  const rawPriceCheck = (trend * 0.35) + (drawdown * 0.25) + (stability * 0.20) + (benchmark * 0.20);
  const priceCheck = overheat ? Math.min(rawPriceCheck, 55) : rawPriceCheck;
  return {
    ...row,
    '日経平均との差%': round(excessNikkei),
    'S&P500差%': round(excessSp),
    過熱判定: overheat ? '過熱・データ確認' : '通常範囲',
    価格確認点: round(priceCheck, 1),
    価格面の扱い: overheat ? '過熱確認を優先' : priceCheck >= 70 ? '価格面は強い' : priceCheck >= 55 ? '価格面は中立' : '価格面は要注意'
  };
}

const charts = new Map();
for (const [symbol] of candidates.concat(benchmarks)) {
  charts.set(symbol, await fetchChart(symbol));
}

const benchmarkRows = benchmarks.map(([symbol, name]) => metrics(symbol, name, charts.get(symbol)));
const n225Return = Number(benchmarkRows.find((row) => row.symbol === '^N225')?.['1年騰落率%']);
const spReturn = Number(benchmarkRows.find((row) => row.symbol === '^GSPC')?.['1年騰落率%']);
const candidateRows = candidates
  .map(([symbol, name]) => metrics(symbol, name, charts.get(symbol)))
  .map((row) => scoreFromPrice(row, n225Return, spReturn))
  .sort((a, b) => Number(b.価格確認点) - Number(a.価格確認点));

const summaryRows = [
  {
    項目: '取得できたデータ',
    内容: 'Yahoo Finance chart APIから10社、日経平均、S&P500の1年日次終値を取得。'
  },
  {
    項目: '計算した内容',
    内容: '20日、60日、120日、1年騰落率、1年最大下落、年率変動、日経平均差、S&P500差、過熱判定、価格確認点。'
  },
  {
    項目: '使い方',
    内容: '価格確認点は候補の絞り込み補助。財務、業績、決算後反応、質的検証を入れる前の最終判断には使わない。'
  },
  {
    項目: '過熱判定',
    内容: '1年騰落率が+150%超、または年率変動が55%超の場合は、価格点を上限55点に抑え、過熱確認を優先する。'
  },
  {
    項目: '注意',
    内容: 'S&P500差は為替未調整。NISA候補の最終比較では円換算、税制、売買可能性、6月イベント後の再判定が必要。'
  },
  {
    項目: 'TOPIXの扱い',
    内容: 'Yahoo FinanceのTOPIX系データは分割・単位調整で異常値が出たため、このページでは採用しない。TOPIX比較は別取得元で再確認する。'
  }
];

writeCsv('761_top10_yahoo_price_metrics.csv', candidateRows, Object.keys(candidateRows[0]));
writeCsv('762_benchmark_yahoo_price_metrics.csv', benchmarkRows, Object.keys(benchmarkRows[0]));
writeCsv('763_top10_price_metrics_summary.csv', summaryRows, Object.keys(summaryRows[0]));

function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${esc(row[header])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>10社 株価時系列 取得結果</title>
  <style>
    :root { --ink:#050b14; --navy:#123d63; --blue:#0b5f96; --line:#cbd8e6; --bg:#eef4fa; --amber:#a85b00; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif; color:var(--ink); background:var(--bg); line-height:1.75; }
    main { max-width:1280px; margin:0 auto; padding:28px 18px 56px; }
    header { background:var(--navy); color:#fff; border-radius:10px; padding:28px; margin-bottom:18px; }
    h1 { margin:0 0 10px; font-size:30px; }
    h2 { margin:24px 0 12px; padding-left:12px; border-left:7px solid var(--blue); color:var(--navy); }
    section { background:#fff; border:1px solid var(--line); border-radius:9px; padding:16px; margin:16px 0; }
    .grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .card { border:1px solid var(--line); border-radius:9px; background:#f8fbff; padding:14px; }
    .value { font-size:30px; font-weight:900; color:var(--blue); }
    .note { border-left:6px solid var(--amber); background:#fff8ec; border-radius:8px; padding:12px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:8px; background:#fff; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; }
    th,td { border:1px solid var(--line); padding:8px; vertical-align:top; font-size:12px; overflow-wrap:break-word; color:#050b14; }
    th { background:#e6f1fb; color:var(--navy); text-align:left; }
    a { color:#075e91; font-weight:800; }
    .links { display:flex; flex-wrap:wrap; gap:10px; }
    .links a { border:1px solid var(--blue); color:#fff; background:var(--blue); border-radius:8px; padding:9px 12px; text-decoration:none; }
    @media (max-width:980px) { .grid { grid-template-columns:1fr 1fr; } table { table-layout:auto; } }
  </style>
</head>
<body>
<main>
  <header>
    <h1>10社 株価時系列 取得結果</h1>
    <p>10社候補と主要指数の1年日次終値を取得し、価格面の確認指標を計算しました。これは候補検証の一部であり、財務・業績・決算後反応と合わせて再判定します。</p>
    <p>作成: ${esc(generatedAt)}</p>
  </header>

  <section>
    <div class="grid">
      <div class="card"><b>取得銘柄</b><div class="value">10</div><p>候補10社</p></div>
      <div class="card"><b>指数</b><div class="value">2</div><p>日経平均、S&P500</p></div>
      <div class="card"><b>日経平均1年</b><div class="value">${esc(round(n225Return, 1))}%</div><p>Yahoo Finance取得値</p></div>
      <div class="card"><b>S&P500 1年</b><div class="value">${esc(round(spReturn, 1))}%</div><p>為替未調整</p></div>
    </div>
    <p class="note">価格が強い銘柄をそのまま採用するのではなく、過熱、最大下落、財務、業績、イベント後反応を合わせて確認します。</p>
  </section>

  <section>
    <h2>要約</h2>
    ${table(Object.keys(summaryRows[0]), summaryRows)}
  </section>

  <section>
    <h2>10社価格確認</h2>
    ${table(Object.keys(candidateRows[0]), candidateRows)}
  </section>

  <section>
    <h2>指数</h2>
    ${table(Object.keys(benchmarkRows[0]), benchmarkRows)}
  </section>

  <section>
    <h2>CSV</h2>
    <div class="links">
      <a href="761_top10_yahoo_price_metrics.csv">10社価格指標CSV</a>
      <a href="762_benchmark_yahoo_price_metrics.csv">指数価格指標CSV</a>
      <a href="763_top10_price_metrics_summary.csv">要約CSV</a>
      <a href="top10_decision_control_board_20260528.html">10社判定コントロール表</a>
    </div>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'top10_price_metrics_refresh_20260528.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  output: 'top10_price_metrics_refresh_20260528.html',
  candidateRows: candidateRows.length,
  benchmarkRows: benchmarkRows.length
}, null, 2));
