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

const TARGET = '6146.T';
const BENCHMARK = '^N225';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 candidate-10-disco-20d';

function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  const headers = rows.shift() || [];
  return rows
    .filter((items) => items.some((item) => String(item).trim() !== ''))
    .map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] || ''])));
}

function readCsv(name) {
  return parseCsv(fs.readFileSync(path.join(ROOT, name), 'utf8'));
}

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

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function cleanLines(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n');
}

function round(value, digits = 2) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return Number(n.toFixed(digits));
}

function pct(after, before) {
  const a = Number(after);
  const b = Number(before);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
  return ((a / b) - 1) * 100;
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function numberFromPct(value) {
  const n = Number(String(value ?? '').replace('%', '').trim());
  return Number.isFinite(n) ? n : null;
}

function formatDate(timestampSeconds) {
  const date = new Date(timestampSeconds * 1000);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function fetchChart(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1d&includePrePost=false&events=div%2Csplits`;
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  const result = json.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const timestamps = result?.timestamp || [];
  if (!result || !quote || !timestamps.length) throw new Error('chart result missing');
  return timestamps
    .map((timestamp, index) => ({
      date: formatDate(timestamp),
      close: quote.close?.[index],
      open: quote.open?.[index],
      high: quote.high?.[index],
      low: quote.low?.[index],
      volume: quote.volume?.[index],
    }))
    .filter((row) => Number.isFinite(Number(row.close)));
}

function findByDate(rows, dateText) {
  return rows.find((row) => row.date === dateText) || null;
}

function latestDate(rows) {
  return rows.length ? rows[rows.length - 1].date : '';
}

function buildHtml(summaryRows, detailRows, fetchLog) {
  return cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ディスコ 20営業日反応 再取得 2026年5月26日</title>
  <style>
    :root {
      --ink: #061a33;
      --line: #cbdceb;
      --soft: #eef6ff;
      --blue: #0b66a0;
      --green: #087f5b;
      --amber: #b45309;
      --red: #b42318;
      --bg: #f6f9fc;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Yu Gothic", "Meiryo", system-ui, sans-serif;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.75;
    }
    main {
      width: min(1120px, calc(100% - 32px));
      margin: 0 auto;
      padding: 28px 0 48px;
    }
    .hero {
      background: linear-gradient(135deg, #08345f, #0b66a0);
      color: #fff;
      border-radius: 18px;
      padding: 28px;
      margin-bottom: 18px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: clamp(26px, 4vw, 42px);
      line-height: 1.2;
      letter-spacing: 0;
    }
    .hero p { margin: 0; color: #e8f3ff; }
    .panel {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 20px;
      margin: 16px 0;
      box-shadow: 0 10px 22px rgba(6, 26, 51, .06);
    }
    h2 {
      margin: 0 0 14px;
      border-left: 8px solid var(--blue);
      padding-left: 12px;
      font-size: 23px;
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
    }
    .kpi {
      background: var(--soft);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 14px;
    }
    .kpi b { display: block; font-size: 25px; color: var(--blue); }
    .table-wrap { overflow-x: auto; }
    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 880px;
      background: #fff;
    }
    th, td {
      border: 1px solid var(--line);
      padding: 10px 12px;
      text-align: left;
      vertical-align: top;
      color: #061a33;
      overflow-wrap: anywhere;
    }
    th { background: #e5f1fb; white-space: nowrap; }
    .ok { color: var(--green); font-weight: 900; }
    .warn { color: var(--amber); font-weight: 900; }
    .gap { color: var(--red); font-weight: 900; }
    .links { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
    .links a {
      color: #fff;
      background: var(--blue);
      text-decoration: none;
      border-radius: 10px;
      padding: 9px 13px;
      font-weight: 900;
    }
    @media (max-width: 760px) {
      main { width: min(100% - 20px, 1120px); }
      .hero { padding: 20px; border-radius: 14px; }
      .kpis { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <h1>ディスコ 20営業日反応 再取得</h1>
      <p>候補10社のうち、20営業日目が本日到達したディスコについて、Yahoo Finance chart APIの日次データで20営業日超過リターンを検算します。結果は採点接続候補であり、検算前の購入判断ではありません。</p>
      <div class="links">
        <a href="index.html">トップへ戻る</a>
        <a href="candidate_10_reaction_due_reconstruction_20260526.html">反応到達予定へ</a>
        <a href="502_candidate_10_disco_20d_reaction_summary.csv">要約CSV</a>
        <a href="503_candidate_10_disco_20d_reaction_detail.csv">詳細CSV</a>
      </div>
    </section>
    <section class="panel">
      <h2>1. 要約</h2>
      <div class="kpis">
        ${summaryRows.map((row) => `
        <div class="kpi">
          <span>${esc(row.item)}</span>
          <b>${esc(row.value)}</b>
          <div>${esc(row.interpretation)}</div>
        </div>`).join('')}
      </div>
    </section>
    <section class="panel">
      <h2>2. 計算結果</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>銘柄</th>
              <th>基準日/価格</th>
              <th>20営業日/価格</th>
              <th>株価20日</th>
              <th>日経20日</th>
              <th>超過リターン</th>
              <th>反応点</th>
              <th>扱い</th>
            </tr>
          </thead>
          <tbody>
            ${detailRows.map((row) => `
            <tr>
              <td><strong>${esc(row.ticker)} ${esc(row.company)}</strong></td>
              <td>${esc(row.base_date)}<br>${esc(row.base_close)}</td>
              <td>${esc(row.after_20d_date)}<br>${esc(row.after_20d_close)}</td>
              <td>${esc(row.stock_return_20d_pct)}%</td>
              <td>${esc(row.nikkei_return_20d_pct)}%</td>
              <td><strong>${esc(row.excess_20d_pct)}%</strong></td>
              <td>${esc(row.reaction_score_with_20d)}</td>
              <td>${esc(row.score_connection)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>
    <section class="panel">
      <h2>3. 取得ログ</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>対象</th><th>状態</th><th>件数</th><th>最新日</th><th>メッセージ</th></tr></thead>
          <tbody>
            ${fetchLog.map((row) => `
            <tr>
              <td>${esc(row.symbol)}</td>
              <td class="${row.status === '成功' ? 'ok' : 'gap'}">${esc(row.status)}</td>
              <td>${esc(row.rows)}</td>
              <td>${esc(row.latest_date)}</td>
              <td>${esc(row.message)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>
  </main>
</body>
</html>`);
}

const dueRows = readCsv('500_candidate_10_reaction_due_detail.csv');
const discoDue = dueRows.find((row) => row.ticker === TARGET) || {};
const baseDate = discoDue.base_date || '2026-04-22';
const after20Date = discoDue.estimated_20bd_date || '2026-05-26';
const excess1 = numberFromPct(discoDue.excess_1d_pct);
const excess5 = numberFromPct(discoDue.excess_5d_pct);

const fetchLog = [];
let detailRows = [];

try {
  const [stockRows, nikkeiRows] = await Promise.all([fetchChart(TARGET), fetchChart(BENCHMARK)]);
  fetchLog.push({
    updated_at: generatedAt,
    symbol: TARGET,
    status: '成功',
    rows: stockRows.length,
    latest_date: latestDate(stockRows),
    message: 'Yahoo Finance chart APIから日次データ取得。',
  });
  fetchLog.push({
    updated_at: generatedAt,
    symbol: BENCHMARK,
    status: '成功',
    rows: nikkeiRows.length,
    latest_date: latestDate(nikkeiRows),
    message: 'Yahoo Finance chart APIから日次データ取得。',
  });

  const stockBase = findByDate(stockRows, baseDate);
  const stockAfter = findByDate(stockRows, after20Date);
  const nikkeiBase = findByDate(nikkeiRows, baseDate);
  const nikkeiAfter = findByDate(nikkeiRows, after20Date);

  if (!stockBase || !stockAfter || !nikkeiBase || !nikkeiAfter) {
    const missing = [
      !stockBase ? `${TARGET}基準日` : '',
      !stockAfter ? `${TARGET}20営業日` : '',
      !nikkeiBase ? `${BENCHMARK}基準日` : '',
      !nikkeiAfter ? `${BENCHMARK}20営業日` : '',
    ].filter(Boolean).join(' / ');
    throw new Error(`必要日付が不足: ${missing}`);
  }

  const stockReturn = pct(stockAfter.close, stockBase.close);
  const nikkeiReturn = pct(nikkeiAfter.close, nikkeiBase.close);
  const excess20 = stockReturn - nikkeiReturn;
  const weighted = (excess1 ?? 0) * 0.34 + (excess5 ?? 0) * 0.51 + excess20 * 0.15;
  const reactionScore = clamp(50 + 2 * weighted);

  detailRows = [{
    updated_at: generatedAt,
    ticker: TARGET,
    company: 'ディスコ',
    base_date: baseDate,
    base_close: round(stockBase.close, 2),
    after_20d_date: after20Date,
    after_20d_close: round(stockAfter.close, 2),
    stock_return_20d_pct: round(stockReturn, 2),
    nikkei_base_date: baseDate,
    nikkei_base_close: round(nikkeiBase.close, 2),
    nikkei_after20_date: after20Date,
    nikkei_after20_close: round(nikkeiAfter.close, 2),
    nikkei_return_20d_pct: round(nikkeiReturn, 2),
    excess_1d_pct: round(excess1, 2),
    excess_5d_pct: round(excess5, 2),
    excess_20d_pct: round(excess20, 2),
    reaction_score_with_20d: round(reactionScore, 1),
    data_status: '20営業日反応取得済み',
    score_connection: '採点接続候補。検算後に接続可否を判断。',
    source: 'Yahoo Finance chart API 1d',
  }];
} catch (error) {
  fetchLog.push({
    updated_at: generatedAt,
    symbol: 'calculation',
    status: '失敗',
    rows: '',
    latest_date: '',
    message: error.message,
  });
  detailRows = [{
    updated_at: generatedAt,
    ticker: TARGET,
    company: 'ディスコ',
    base_date: baseDate,
    base_close: '',
    after_20d_date: after20Date,
    after_20d_close: '',
    stock_return_20d_pct: '',
    nikkei_base_date: baseDate,
    nikkei_base_close: '',
    nikkei_after20_date: after20Date,
    nikkei_after20_close: '',
    nikkei_return_20d_pct: '',
    excess_1d_pct: round(excess1, 2),
    excess_5d_pct: round(excess5, 2),
    excess_20d_pct: '',
    reaction_score_with_20d: '',
    data_status: '取得未完了',
    score_connection: '未接続。データ不足のため採点へ入れない。',
    source: 'Yahoo Finance chart API 1d',
  }];
}

const ok = detailRows[0]?.data_status === '20営業日反応取得済み';
const summaryRows = [
  {
    updated_at: generatedAt,
    item: '対象',
    value: '6146.T ディスコ',
    interpretation: '20営業日目が概算上到達したため、最初の再取得対象にした。',
  },
  {
    updated_at: generatedAt,
    item: '取得状態',
    value: ok ? '成功' : '未完了',
    interpretation: ok ? '株価と日経平均の必要日付を取得できた。' : '必要な価格データがそろっていないため、採点へ接続しない。',
  },
  {
    updated_at: generatedAt,
    item: '採点接続',
    value: ok ? '候補' : '不可',
    interpretation: ok ? '検算後に決算後反応スコアへ接続できる候補。購入判断ではない。' : 'データ不足のため未接続。',
  },
];

writeCsv('502_candidate_10_disco_20d_reaction_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'interpretation',
]);

writeCsv('503_candidate_10_disco_20d_reaction_detail.csv', detailRows, [
  'updated_at',
  'ticker',
  'company',
  'base_date',
  'base_close',
  'after_20d_date',
  'after_20d_close',
  'stock_return_20d_pct',
  'nikkei_base_date',
  'nikkei_base_close',
  'nikkei_after20_date',
  'nikkei_after20_close',
  'nikkei_return_20d_pct',
  'excess_1d_pct',
  'excess_5d_pct',
  'excess_20d_pct',
  'reaction_score_with_20d',
  'data_status',
  'score_connection',
  'source',
]);

writeCsv('504_candidate_10_disco_20d_fetch_log.csv', fetchLog, [
  'updated_at',
  'symbol',
  'status',
  'rows',
  'latest_date',
  'message',
]);

fs.writeFileSync(
  path.join(ROOT, 'candidate_10_disco_20d_reaction_update_20260526.html'),
  buildHtml(summaryRows, detailRows, fetchLog),
  'utf8',
);

console.log(`generated candidate_10_disco_20d_reaction_update_20260526.html: ${ok ? 'success' : 'incomplete'}`);
