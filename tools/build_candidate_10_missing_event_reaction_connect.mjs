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

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 candidate-10-missing-event';

const EVENTS = [
  {
    ticker: '8766.T',
    company: '東京海上HD',
    sector: '保険',
    event_date: '2026-05-20',
    event_type: '2026年3月期通期決算',
    source_note: '公式決算短信PDFから発表日を確認',
    source_url: 'https://www.tokiomarinehd.com/ir/financial/',
  },
  {
    ticker: '6367.T',
    company: 'ダイキン工業',
    sector: '空調',
    event_date: '2026-05-12',
    event_type: '2026年3月期通期決算',
    source_note: '公式決算短信PDFから発表日を確認',
    source_url: 'https://www.daikin.co.jp/investor/library/results_materials',
  },
];

const BENCHMARK = '^N225';
const JP_HOLIDAYS = new Set([
  '2026-04-29',
  '2026-05-04',
  '2026-05-05',
  '2026-05-06',
]);

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

function parseDate(text) {
  const [year, month, day] = String(text || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateFromDate(date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(timestampSeconds) {
  return formatDateFromDate(new Date(timestampSeconds * 1000));
}

function isBusinessDay(date) {
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return false;
  return !JP_HOLIDAYS.has(formatDateFromDate(date));
}

function addBusinessDays(dateText, days) {
  const date = parseDate(dateText);
  if (!date) return '';
  let added = 0;
  while (added < days) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (isBusinessDay(date)) added += 1;
  }
  return formatDateFromDate(date);
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

function returnPair(stockBase, stockAfter, nikkeiBase, nikkeiAfter) {
  if (!stockBase || !stockAfter || !nikkeiBase || !nikkeiAfter) {
    return { stock_return_pct: '', nikkei_return_pct: '', excess_pct: '' };
  }
  const stockReturn = pct(stockAfter.close, stockBase.close);
  const nikkeiReturn = pct(nikkeiAfter.close, nikkeiBase.close);
  return {
    stock_return_pct: round(stockReturn, 2),
    nikkei_return_pct: round(nikkeiReturn, 2),
    excess_pct: round(stockReturn - nikkeiReturn, 2),
  };
}

function buildHtml(summaryRows, detailRows, fetchLog) {
  return cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 未接続イベント反応 接続結果 2026年5月26日</title>
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
      background: var(--bg);
      color: var(--ink);
      line-height: 1.75;
    }
    main { width: min(1160px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 48px; }
    .hero {
      background: linear-gradient(135deg, #08345f, #0b66a0);
      color: #fff;
      padding: 28px;
      border-radius: 18px;
      margin-bottom: 18px;
    }
    h1 { margin: 0 0 8px; font-size: clamp(26px, 4vw, 42px); line-height: 1.2; letter-spacing: 0; }
    .hero p { color: #e8f3ff; margin: 0; }
    .panel {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 20px;
      margin: 16px 0;
      box-shadow: 0 10px 22px rgba(6, 26, 51, .06);
    }
    h2 { margin: 0 0 14px; border-left: 8px solid var(--blue); padding-left: 12px; font-size: 23px; }
    .kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .kpi { background: var(--soft); border: 1px solid var(--line); border-radius: 12px; padding: 14px; }
    .kpi b { display: block; font-size: 25px; color: var(--blue); }
    .table-wrap { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; min-width: 980px; background: #fff; }
    th, td { border: 1px solid var(--line); padding: 10px 12px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
    th { background: #e5f1fb; white-space: nowrap; }
    .ok { color: var(--green); font-weight: 900; }
    .warn { color: var(--amber); font-weight: 900; }
    .gap { color: var(--red); font-weight: 900; }
    .links { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
    .links a { background: var(--blue); color: #fff; text-decoration: none; border-radius: 10px; padding: 9px 13px; font-weight: 900; }
    @media (max-width: 760px) {
      main { width: min(100% - 20px, 1160px); }
      .hero { padding: 20px; border-radius: 14px; }
      .kpis { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <h1>未接続イベント反応の接続結果</h1>
      <p>候補10社のうち、決算日が未接続だった東京海上HDとダイキン工業について、公式決算短信PDFで発表日を確認し、Yahoo Finance chart APIで株価と日経平均の反応を計算しました。</p>
      <div class="links">
        <a href="index.html">トップへ戻る</a>
        <a href="candidate_10_reaction_due_reconstruction_20260526.html">反応到達予定へ</a>
        <a href="505_candidate_10_missing_event_reaction_summary.csv">要約CSV</a>
        <a href="506_candidate_10_missing_event_reaction_detail.csv">詳細CSV</a>
      </div>
    </section>
    <section class="panel">
      <h2>1. 要約</h2>
      <div class="kpis">
        ${summaryRows.map((row) => `
        <div class="kpi"><span>${esc(row.item)}</span><b>${esc(row.value)}</b><div>${esc(row.interpretation)}</div></div>`).join('')}
      </div>
    </section>
    <section class="panel">
      <h2>2. 銘柄別反応</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>銘柄</th>
              <th>決算日</th>
              <th>基準終値</th>
              <th>1日超過</th>
              <th>5日超過</th>
              <th>20営業日予定</th>
              <th>接続状態</th>
              <th>扱い</th>
            </tr>
          </thead>
          <tbody>
            ${detailRows.map((row) => `
            <tr>
              <td><strong>${esc(row.ticker)} ${esc(row.company)}</strong><br>${esc(row.sector)}</td>
              <td>${esc(row.event_date)}<br>${esc(row.event_type)}</td>
              <td>${esc(row.base_close)}</td>
              <td>${esc(row.after_1d_date)}<br><strong>${esc(row.excess_1d_pct)}</strong></td>
              <td>${esc(row.after_5d_date)}<br><strong>${esc(row.excess_5d_pct)}</strong></td>
              <td>${esc(row.estimated_20bd_date)}</td>
              <td>${esc(row.event_connection_status)}</td>
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

const symbols = [...new Set([...EVENTS.map((event) => event.ticker), BENCHMARK])];
const chartMap = new Map();
const fetchLog = [];

for (const symbol of symbols) {
  try {
    const rows = await fetchChart(symbol);
    chartMap.set(symbol, rows);
    fetchLog.push({
      updated_at: generatedAt,
      symbol,
      status: '成功',
      rows: rows.length,
      latest_date: latestDate(rows),
      message: 'Yahoo Finance chart APIから日次データ取得。',
    });
  } catch (error) {
    fetchLog.push({
      updated_at: generatedAt,
      symbol,
      status: '失敗',
      rows: '',
      latest_date: '',
      message: error.message,
    });
  }
}

const nikkeiRows = chartMap.get(BENCHMARK) || [];
const detailRows = EVENTS.map((event) => {
  const stockRows = chartMap.get(event.ticker) || [];
  const baseDate = event.event_date;
  const after1Date = addBusinessDays(baseDate, 1);
  const after5Date = addBusinessDays(baseDate, 5);
  const after20Date = addBusinessDays(baseDate, 20);
  const baseStock = findByDate(stockRows, baseDate);
  const baseNikkei = findByDate(nikkeiRows, baseDate);
  const after1Stock = findByDate(stockRows, after1Date);
  const after1Nikkei = findByDate(nikkeiRows, after1Date);
  const after5Stock = findByDate(stockRows, after5Date);
  const after5Nikkei = findByDate(nikkeiRows, after5Date);
  const after1 = returnPair(baseStock, after1Stock, baseNikkei, after1Nikkei);
  const after5 = returnPair(baseStock, after5Stock, baseNikkei, after5Nikkei);
  const hasBase = Boolean(baseStock && baseNikkei);
  const has1 = after1.excess_pct !== '';
  const has5 = after5.excess_pct !== '';
  return {
    updated_at: generatedAt,
    ticker: event.ticker,
    company: event.company,
    sector: event.sector,
    event_date: event.event_date,
    event_type: event.event_type,
    base_date: baseDate,
    base_close: baseStock ? round(baseStock.close, 2) : '',
    after_1d_date: has1 ? after1Date : '',
    stock_return_1d_pct: after1.stock_return_pct,
    nikkei_return_1d_pct: after1.nikkei_return_pct,
    excess_1d_pct: after1.excess_pct === '' ? '' : `${after1.excess_pct}%`,
    after_5d_date: has5 ? after5Date : '',
    stock_return_5d_pct: after5.stock_return_pct,
    nikkei_return_5d_pct: after5.nikkei_return_pct,
    excess_5d_pct: after5.excess_pct === '' ? '' : `${after5.excess_pct}%`,
    estimated_20bd_date: after20Date,
    event_connection_status: hasBase ? '接続済み' : '未接続',
    reaction_maturity: has1 && has5 ? '1日/5日接続済み' : has1 ? '1日接続済み・5日未到達' : '反応未到達',
    score_connection: has1 && has5
      ? '説明補助。20営業日反応まで採点へ接続しない。'
      : '説明補助未満。必要日付が未到達のため採点へ接続しない。',
    source_note: event.source_note,
    source_url: event.source_url,
  };
});

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '対象',
    value: `${EVENTS.length}社`,
    interpretation: '東京海上HDとダイキン工業の公式決算日を既存PDFから確認した。',
  },
  {
    updated_at: generatedAt,
    item: '決算日接続',
    value: `${detailRows.filter((row) => row.event_connection_status === '接続済み').length}社`,
    interpretation: '基準日の株価と日経平均を接続できた銘柄数。',
  },
  {
    updated_at: generatedAt,
    item: '1日/5日接続',
    value: `${detailRows.filter((row) => row.reaction_maturity === '1日/5日接続済み').length}社`,
    interpretation: '短期反応を説明補助として使える銘柄数。20営業日反応までは採点へ接続しない。',
  },
];

writeCsv('505_candidate_10_missing_event_reaction_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'interpretation',
]);

writeCsv('506_candidate_10_missing_event_reaction_detail.csv', detailRows, [
  'updated_at',
  'ticker',
  'company',
  'sector',
  'event_date',
  'event_type',
  'base_date',
  'base_close',
  'after_1d_date',
  'stock_return_1d_pct',
  'nikkei_return_1d_pct',
  'excess_1d_pct',
  'after_5d_date',
  'stock_return_5d_pct',
  'nikkei_return_5d_pct',
  'excess_5d_pct',
  'estimated_20bd_date',
  'event_connection_status',
  'reaction_maturity',
  'score_connection',
  'source_note',
  'source_url',
]);

writeCsv('507_candidate_10_missing_event_reaction_fetch_log.csv', fetchLog, [
  'updated_at',
  'symbol',
  'status',
  'rows',
  'latest_date',
  'message',
]);

fs.writeFileSync(
  path.join(ROOT, 'candidate_10_missing_event_reaction_connect_20260526.html'),
  buildHtml(summaryRows, detailRows, fetchLog),
  'utf8',
);

console.log('generated candidate_10_missing_event_reaction_connect_20260526.html');
