import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const generatedAt = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date());

const STOCKS = [
  { ticker: '8035.T', company: '東京エレクトロン', structural_rating: 'S' },
  { ticker: '7735.T', company: 'SCREEN HD', structural_rating: 'A' },
  { ticker: '6146.T', company: 'ディスコ', structural_rating: 'A-' },
  { ticker: '6920.T', company: 'レーザーテック', structural_rating: 'A' },
  { ticker: '6857.T', company: 'アドバンテスト', structural_rating: 'B' },
  { ticker: '6762.T', company: 'TDK', structural_rating: 'B' },
];

const BENCHMARKS = [
  { ticker: '^SOX', name: 'SOX指数', trigger_pct: -2.0, weight: 0.45, reason: '半導体株の世界的な地合い' },
  { ticker: '^IXIC', name: 'NASDAQ総合', trigger_pct: -1.5, weight: 0.30, reason: 'AI・グロース株のリスク許容度' },
  { ticker: '^N225', name: '日経平均', trigger_pct: -1.5, weight: 0.25, reason: '日本株全体の地合い' },
];

function escCsv(value) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function writeCsv(name, rows, headers) {
  const body = [headers.join(',')]
    .concat(rows.map((row) => headers.map((header) => escCsv(row[header])).join(',')))
    .join('\n');
  fs.writeFileSync(path.join(ROOT, name), `\uFEFF${body}\n`, 'utf8');
}

function cleanLines(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n');
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function pct(value, digits = 2) {
  if (!Number.isFinite(value)) return '';
  return Number(value).toFixed(digits);
}

function clamp(min, max, value) {
  return Math.max(min, Math.min(max, value));
}

function dateFromTs(ts) {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

async function fetchChart(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 stock-research-prototype',
      Accept: 'application/json',
    },
  });
  if (!response.ok) throw new Error(`${symbol}: HTTP ${response.status}`);
  const json = await response.json();
  const result = json.chart?.result?.[0];
  if (!result) throw new Error(`${symbol}: empty chart result`);
  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const adj = result.indicators?.adjclose?.[0]?.adjclose || quote.close || [];
  const rows = timestamps.map((ts, index) => ({
    date: dateFromTs(ts),
    close: Number(adj[index]),
    volume: quote.volume?.[index] ?? '',
  })).filter((row) => Number.isFinite(row.close) && row.close > 0);
  return {
    symbol,
    currency: result.meta?.currency || '',
    exchange: result.meta?.exchangeName || '',
    rows,
    url,
  };
}

function returns(rows) {
  return rows.map((row, index) => {
    if (index === 0) return { ...row, daily_return_pct: null };
    const prev = rows[index - 1]?.close;
    return {
      ...row,
      daily_return_pct: Number.isFinite(prev) && prev > 0 ? ((row.close / prev) - 1) * 100 : null,
    };
  });
}

function findIndexAtOrAfter(rows, date) {
  return rows.findIndex((row) => row.date >= date);
}

function horizonReturn(rows, startIndex, horizon) {
  if (startIndex < 0 || startIndex + horizon >= rows.length) return null;
  const start = rows[startIndex]?.close;
  const end = rows[startIndex + horizon]?.close;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start <= 0) return null;
  return ((end / start) - 1) * 100;
}

function maxDrawdown(rows) {
  let peak = -Infinity;
  let worst = 0;
  for (const row of rows) {
    if (row.close > peak) peak = row.close;
    if (peak > 0) {
      const dd = ((row.close / peak) - 1) * 100;
      if (dd < worst) worst = dd;
    }
  }
  return worst;
}

function average(values) {
  const nums = values.filter((value) => Number.isFinite(value));
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function hitRate(values) {
  const nums = values.filter((value) => Number.isFinite(value));
  if (!nums.length) return null;
  return nums.filter((value) => value >= 0).length / nums.length * 100;
}

const allSymbols = [...STOCKS.map((row) => row.ticker), ...BENCHMARKS.map((row) => row.ticker)];
const chartMap = new Map();

for (const symbol of allSymbols) {
  const chart = await fetchChart(symbol);
  chart.rows = returns(chart.rows);
  chartMap.set(symbol, chart);
}

const eventRows = [];
for (const benchmark of BENCHMARKS) {
  const benchmarkChart = chartMap.get(benchmark.ticker);
  const benchmarkEvents = benchmarkChart.rows.filter((row) => Number.isFinite(row.daily_return_pct) && row.daily_return_pct <= benchmark.trigger_pct);
  for (const event of benchmarkEvents) {
    const benchmarkStart = findIndexAtOrAfter(benchmarkChart.rows, event.date);
    for (const stock of STOCKS) {
      const stockChart = chartMap.get(stock.ticker);
      const stockStart = findIndexAtOrAfter(stockChart.rows, event.date);
      const stock1 = horizonReturn(stockChart.rows, stockStart, 1);
      const stock5 = horizonReturn(stockChart.rows, stockStart, 5);
      const stock20 = horizonReturn(stockChart.rows, stockStart, 20);
      const bench1 = horizonReturn(benchmarkChart.rows, benchmarkStart, 1);
      const bench5 = horizonReturn(benchmarkChart.rows, benchmarkStart, 5);
      const bench20 = horizonReturn(benchmarkChart.rows, benchmarkStart, 20);
      eventRows.push({
        updated_at: generatedAt,
        benchmark: benchmark.name,
        benchmark_ticker: benchmark.ticker,
        trigger_pct: benchmark.trigger_pct,
        event_date: event.date,
        benchmark_daily_return_pct: pct(event.daily_return_pct),
        ticker: stock.ticker,
        company: stock.company,
        structural_rating: stock.structural_rating,
        stock_return_1d_pct: pct(stock1),
        benchmark_return_1d_pct: pct(bench1),
        excess_1d_pct: pct(Number.isFinite(stock1) && Number.isFinite(bench1) ? stock1 - bench1 : null),
        stock_return_5d_pct: pct(stock5),
        benchmark_return_5d_pct: pct(bench5),
        excess_5d_pct: pct(Number.isFinite(stock5) && Number.isFinite(bench5) ? stock5 - bench5 : null),
        stock_return_20d_pct: pct(stock20),
        benchmark_return_20d_pct: pct(bench20),
        excess_20d_pct: pct(Number.isFinite(stock20) && Number.isFinite(bench20) ? stock20 - bench20 : null),
      });
    }
  }
}

const benchmarkSummaryRows = [];
for (const stock of STOCKS) {
  for (const benchmark of BENCHMARKS) {
    const rows = eventRows.filter((row) => row.ticker === stock.ticker && row.benchmark_ticker === benchmark.ticker);
    const ex1 = rows.map((row) => Number(row.excess_1d_pct));
    const ex5 = rows.map((row) => Number(row.excess_5d_pct));
    const ex20 = rows.map((row) => Number(row.excess_20d_pct));
    benchmarkSummaryRows.push({
      updated_at: generatedAt,
      ticker: stock.ticker,
      company: stock.company,
      structural_rating: stock.structural_rating,
      benchmark: benchmark.name,
      benchmark_ticker: benchmark.ticker,
      benchmark_weight: benchmark.weight,
      down_event_count: rows.length,
      avg_excess_1d_pct: pct(average(ex1)),
      avg_excess_5d_pct: pct(average(ex5)),
      avg_excess_20d_pct: pct(average(ex20)),
      hit_rate_5d_pct: pct(hitRate(ex5), 1),
      interpretation: rows.length
        ? '下落日の同日から1/5/20営業日後に、比較指数より強かったかを確認。'
        : '該当下落イベントなし。',
    });
  }
}

const stockSummaryRows = STOCKS.map((stock) => {
  const chart = chartMap.get(stock.ticker);
  const details = benchmarkSummaryRows.filter((row) => row.ticker === stock.ticker);
  const weightedEx1 = details.reduce((sum, row) => sum + Number(row.avg_excess_1d_pct || 0) * Number(row.benchmark_weight), 0);
  const weightedEx5 = details.reduce((sum, row) => sum + Number(row.avg_excess_5d_pct || 0) * Number(row.benchmark_weight), 0);
  const weightedEx20 = details.reduce((sum, row) => sum + Number(row.avg_excess_20d_pct || 0) * Number(row.benchmark_weight), 0);
  const weightedHit5 = details.reduce((sum, row) => sum + Number(row.hit_rate_5d_pct || 0) * Number(row.benchmark_weight), 0);
  const drawdown = maxDrawdown(chart.rows);
  const ret1y = chart.rows.length > 1 ? ((chart.rows.at(-1).close / chart.rows[0].close) - 1) * 100 : null;
  const rawScore = 50
    + weightedEx1 * 1.5
    + weightedEx5 * 2.5
    + weightedEx20 * 1.2
    + (weightedHit5 - 50) * 0.35
    - Math.max(0, Math.abs(drawdown) - 30) * 0.7;
  const score = Math.round(clamp(0, 100, rawScore));
  let status = '要確認';
  if (score >= 75) status = '下落耐性あり';
  if (score < 60) status = '下落耐性弱い';
  return {
    updated_at: generatedAt,
    ticker: stock.ticker,
    company: stock.company,
    structural_rating: stock.structural_rating,
    rows: chart.rows.length,
    latest_date: chart.rows.at(-1)?.date || '',
    latest_close: pct(chart.rows.at(-1)?.close, 1),
    ret1y_pct: pct(ret1y),
    max_drawdown_1y_pct: pct(drawdown),
    weighted_excess_1d_pct: pct(weightedEx1),
    weighted_excess_5d_pct: pct(weightedEx5),
    weighted_excess_20d_pct: pct(weightedEx20),
    weighted_hit_rate_5d_pct: pct(weightedHit5, 1),
    downside_resilience_score: score,
    downside_resilience_status: status,
    score_policy: '構造優位の確認材料。購入判断ではなく、6月テスト候補の優先順位と停止条件に使う。',
  };
}).sort((a, b) => b.downside_resilience_score - a.downside_resilience_score);

const methodRows = [
  {
    item: '対象期間',
    formula: 'Yahoo Finance chart APIの1年日次終値',
    note: '構造優位6社、SOX指数、NASDAQ総合、日経平均を取得。',
  },
  {
    item: '下落日定義',
    formula: 'SOX <= -2.0%、NASDAQ <= -1.5%、日経平均 <= -1.5%',
    note: '半導体、AI/グロース、日本株全体の3種類の悪い地合いを分ける。',
  },
  {
    item: '超過リターン',
    formula: '銘柄リターン - 比較指数リターン',
    note: 'イベント当日から1営業日後、5営業日後、20営業日後を計算。',
  },
  {
    item: '耐性スコア',
    formula: '50 + 1日超過×1.5 + 5日超過×2.5 + 20日超過×1.2 + (5日勝率-50)×0.35 - 1年最大下落ペナルティ',
    note: '構造優位だけではなく、実際に下落局面で耐えたかを評価。',
  },
  {
    item: '注意',
    formula: '日米市場の日付差は簡易一致',
    note: '厳密運用では市場カレンダーと翌営業日対応を精緻化する。',
  },
];

const sources = allSymbols.map((symbol) => {
  const chart = chartMap.get(symbol);
  return {
    updated_at: generatedAt,
    symbol,
    rows: chart.rows.length,
    first_date: chart.rows[0]?.date || '',
    latest_date: chart.rows.at(-1)?.date || '',
    source: 'Yahoo Finance chart API',
    source_url: chart.url,
    status: '取得済み',
  };
});

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '取得対象',
    value: `${STOCKS.length}銘柄 + ${BENCHMARKS.length}指数`,
    interpretation: '構造優位6社とSOX/NASDAQ/日経平均を取得。',
  },
  {
    updated_at: generatedAt,
    item: '下落イベント',
    value: `${eventRows.length / STOCKS.length}件`,
    interpretation: 'SOX、NASDAQ、日経平均の下落日を合計。各銘柄に対して1/5/20営業日の反応を計算。',
  },
  {
    updated_at: generatedAt,
    item: '下落耐性あり',
    value: `${stockSummaryRows.filter((row) => row.downside_resilience_status === '下落耐性あり').length}社`,
    interpretation: '1年日次データ上、指数下落日に相対的に強かった銘柄。',
  },
  {
    updated_at: generatedAt,
    item: '本体スコアへの扱い',
    value: '直接加点しない',
    interpretation: '下落耐性は構造仮説の検証材料。決算・割高・+1%比較と合わせて使う。',
  },
];

writeCsv('359_downside_resilience_summary.csv', summaryRows, ['updated_at', 'item', 'value', 'interpretation']);
writeCsv('360_downside_resilience_by_stock.csv', stockSummaryRows, [
  'updated_at',
  'ticker',
  'company',
  'structural_rating',
  'rows',
  'latest_date',
  'latest_close',
  'ret1y_pct',
  'max_drawdown_1y_pct',
  'weighted_excess_1d_pct',
  'weighted_excess_5d_pct',
  'weighted_excess_20d_pct',
  'weighted_hit_rate_5d_pct',
  'downside_resilience_score',
  'downside_resilience_status',
  'score_policy',
]);
writeCsv('361_downside_resilience_by_benchmark.csv', benchmarkSummaryRows, [
  'updated_at',
  'ticker',
  'company',
  'structural_rating',
  'benchmark',
  'benchmark_ticker',
  'benchmark_weight',
  'down_event_count',
  'avg_excess_1d_pct',
  'avg_excess_5d_pct',
  'avg_excess_20d_pct',
  'hit_rate_5d_pct',
  'interpretation',
]);
writeCsv('362_downside_resilience_event_detail.csv', eventRows, [
  'updated_at',
  'benchmark',
  'benchmark_ticker',
  'trigger_pct',
  'event_date',
  'benchmark_daily_return_pct',
  'ticker',
  'company',
  'structural_rating',
  'stock_return_1d_pct',
  'benchmark_return_1d_pct',
  'excess_1d_pct',
  'stock_return_5d_pct',
  'benchmark_return_5d_pct',
  'excess_5d_pct',
  'stock_return_20d_pct',
  'benchmark_return_20d_pct',
  'excess_20d_pct',
]);
writeCsv('363_downside_resilience_method.csv', methodRows, ['item', 'formula', 'note']);
writeCsv('364_downside_resilience_sources.csv', sources, ['updated_at', 'symbol', 'rows', 'first_date', 'latest_date', 'source', 'source_url', 'status']);

function badge(text) {
  const t = String(text ?? '');
  let cls = 'mid';
  if (t.includes('あり')) cls = 'ok';
  if (t.includes('弱い')) cls = 'stop';
  if (t.includes('直接加点')) cls = 'neutral';
  return `<span class="badge ${cls}">${esc(t)}</span>`;
}

const summaryCards = summaryRows.map((row) => `
      <div class="kpi">
        <span>${esc(row.item)}</span>
        <b>${esc(row.value)}</b>
        <small>${esc(row.interpretation)}</small>
      </div>
`).join('');

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>半導体構造優位 下落耐性検証 2026年5月26日</title>
  <style>
    :root {
      --ink:#071f36;
      --muted:#49657f;
      --blue:#0b5d92;
      --light:#eef6fd;
      --line:#c9dceb;
      --ok:#057a55;
      --warn:#b76b00;
      --stop:#b42318;
      --bg:#f7fbff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Yu Gothic", "Meiryo", Arial, sans-serif;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.75;
      font-size: 15px;
    }
    header {
      background: linear-gradient(135deg, #07375e, #0c6b96);
      color: #fff;
      padding: 30px 24px;
    }
    main { max-width: 1240px; margin: 0 auto; padding: 24px; }
    h1 { margin: 0 0 8px; font-size: 30px; letter-spacing: 0; }
    h2 {
      margin: 28px 0 12px;
      padding-left: 12px;
      border-left: 7px solid var(--blue);
      font-size: 22px;
    }
    p { margin: 8px 0; }
    .lead, .card {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 18px;
      box-shadow: 0 2px 9px rgba(0,40,80,.06);
    }
    .toolbar { display:flex; flex-wrap:wrap; gap:10px; margin-top: 14px; }
    .button {
      display:inline-block;
      padding:8px 12px;
      border:1px solid #9fc1db;
      border-radius:8px;
      background:#fff;
      color:#07375e;
      text-decoration:none;
      font-weight:700;
    }
    .kpis {
      display:grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 12px;
      margin: 18px 0;
    }
    .kpi {
      background:#fff;
      border:1px solid var(--line);
      border-radius:10px;
      padding:14px;
      min-height: 132px;
    }
    .kpi span { display:block; color:var(--muted); font-weight:700; }
    .kpi b { display:block; font-size:28px; color:#06456f; margin:4px 0; }
    .kpi small { display:block; color:#17324a; line-height:1.55; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; background:#fff; }
    table { width:100%; border-collapse:collapse; min-width: 1080px; }
    th, td { border-bottom:1px solid var(--line); padding:10px; text-align:left; vertical-align:top; }
    th { background:#e6f2fb; color:#06385d; white-space:nowrap; }
    tr:last-child td { border-bottom:0; }
    .badge { display:inline-block; padding:4px 8px; border-radius:999px; font-weight:700; white-space:nowrap; }
    .badge.ok { background:#e8f7ef; color:var(--ok); }
    .badge.mid { background:#eef6fd; color:#0b5d92; }
    .badge.stop { background:#fdecec; color:var(--stop); }
    .badge.neutral { background:#edf0f3; color:#293847; }
    .note { color:var(--muted); font-size:13px; }
    .warn-box {
      border-left: 7px solid var(--warn);
      background: #fff9ed;
      padding: 14px;
      border-radius: 8px;
      margin-top: 12px;
    }
    @media (max-width: 760px) {
      main { padding: 14px; }
      header { padding: 22px 16px; }
      h1 { font-size: 24px; }
      table { min-width: 960px; }
    }
    @media print {
      body { background:#fff; font-size: 13px; }
      header { background:#07375e !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .card, .lead, .kpi { box-shadow:none; }
      h2, .card, .lead, .kpis, .table-wrap { break-inside: avoid; page-break-inside: avoid; }
      a { color: inherit; text-decoration: none; }
    }
  </style>
</head>
<body>
<header>
  <h1>半導体構造優位 下落耐性検証</h1>
  <p>構造的に強い半導体・AI周辺銘柄が、SOX・NASDAQ・日経平均の下落局面で本当に相対的に耐えたかを検証します。</p>
</header>
<main>
  <section class="lead">
    <p><b>目的:</b> 「高シェアで技術が強い」という質的仮説を、実際の下落局面の株価データで検証します。</p>
    <p><b>重要:</b> 下落耐性スコアは購入判断ではありません。構造優位の検証材料であり、決算・割高・+1%比較と合わせて使います。</p>
    <div class="toolbar">
      <a class="button" href="359_downside_resilience_summary.csv">359 要約CSV</a>
      <a class="button" href="360_downside_resilience_by_stock.csv">360 銘柄別CSV</a>
      <a class="button" href="361_downside_resilience_by_benchmark.csv">361 指数別CSV</a>
      <a class="button" href="362_downside_resilience_event_detail.csv">362 明細CSV</a>
      <a class="button" href="363_downside_resilience_method.csv">363 計算式CSV</a>
      <a class="button" href="364_downside_resilience_sources.csv">364 取得元CSV</a>
      <a class="button" href="semiconductor_structural_advantage_gate_20260526.html">構造優位ゲートへ</a>
      <a class="button" href="semiconductor_quant_gate_connection_20260526.html">量的ゲート接続へ</a>
      <a class="button" href="june_forward_test_record_20260526.html">6月前向きテスト記録へ</a>
      <a class="button" href="index.html">メインページへ</a>
    </div>
  </section>

  <section class="kpis">
    ${summaryCards}
  </section>

  <h2>銘柄別 下落耐性</h2>
  <div class="table-wrap">
    <table>
      <thead><tr><th>順位</th><th>銘柄</th><th>構造評価</th><th>耐性点</th><th>判定</th><th>1年騰落</th><th>最大下落</th><th>加重超過 1日/5日/20日</th><th>5日勝率</th><th>扱い</th></tr></thead>
      <tbody>
        ${stockSummaryRows.map((row, index) => `
          <tr>
            <td>${index + 1}</td>
            <td><b>${esc(row.ticker)}</b><br>${esc(row.company)}<br><span class="note">${esc(row.latest_date)} / ${esc(row.latest_close)}</span></td>
            <td>${esc(row.structural_rating)}</td>
            <td><b>${esc(row.downside_resilience_score)}</b></td>
            <td>${badge(row.downside_resilience_status)}</td>
            <td>${esc(row.ret1y_pct)}%</td>
            <td>${esc(row.max_drawdown_1y_pct)}%</td>
            <td>${esc(row.weighted_excess_1d_pct)}% / ${esc(row.weighted_excess_5d_pct)}% / ${esc(row.weighted_excess_20d_pct)}%</td>
            <td>${esc(row.weighted_hit_rate_5d_pct)}%</td>
            <td>${esc(row.score_policy)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <h2>計算式</h2>
  <div class="table-wrap">
    <table>
      <thead><tr><th>項目</th><th>式</th><th>説明</th></tr></thead>
      <tbody>
        ${methodRows.map((row) => `
          <tr>
            <td><b>${esc(row.item)}</b></td>
            <td>${esc(row.formula)}</td>
            <td>${esc(row.note)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <h2>指数別の反応</h2>
  <div class="table-wrap">
    <table>
      <thead><tr><th>銘柄</th><th>比較指数</th><th>下落日数</th><th>平均超過1日</th><th>平均超過5日</th><th>平均超過20日</th><th>5日勝率</th></tr></thead>
      <tbody>
        ${benchmarkSummaryRows.map((row) => `
          <tr>
            <td><b>${esc(row.ticker)}</b><br>${esc(row.company)}</td>
            <td>${esc(row.benchmark)}</td>
            <td>${esc(row.down_event_count)}</td>
            <td>${esc(row.avg_excess_1d_pct)}%</td>
            <td>${esc(row.avg_excess_5d_pct)}%</td>
            <td>${esc(row.avg_excess_20d_pct)}%</td>
            <td>${esc(row.hit_rate_5d_pct)}%</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <h2>解釈</h2>
  <section class="card">
    <p>この検証は、構造的に強い企業が「下落しない」と言うためのものではありません。半導体・AIの地合いが悪い日に、比較指数より相対的に強いかを確認するものです。</p>
    <div class="warn-box">
      <b>次の扱い:</b> 下落耐性が弱い銘柄は、構造優位があっても小口、押し目待ち、候補維持に戻します。下落耐性が高い銘柄だけを、決算・割高・+1%比較へ進めます。
    </div>
  </section>

  <h2>取得元</h2>
  <div class="table-wrap">
    <table>
      <thead><tr><th>シンボル</th><th>件数</th><th>期間</th><th>取得元</th><th>状態</th></tr></thead>
      <tbody>
        ${sources.map((row) => `
          <tr>
            <td>${esc(row.symbol)}</td>
            <td>${esc(row.rows)}</td>
            <td>${esc(row.first_date)} - ${esc(row.latest_date)}</td>
            <td><a href="${esc(row.source_url)}">${esc(row.source)}</a></td>
            <td>${badge(row.status)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <p class="note">更新日時: ${esc(generatedAt)}</p>
</main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'semiconductor_downside_resilience_20260526.html'), html, 'utf8');

console.log(`generated semiconductor downside resilience: ${stockSummaryRows.length} stocks, ${eventRows.length} event rows`);
