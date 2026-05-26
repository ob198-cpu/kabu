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

function num(value) {
  const text = String(value ?? '').replace(/[%倍,円]/g, '').trim();
  if (!text || text === '未取得') return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function present(value) {
  const text = String(value ?? '').trim();
  return text !== '' && text !== '未取得' && text !== '未確認' && text !== '未接続';
}

function round(value, digits = 2) {
  const m = 10 ** digits;
  return Math.round(value * m) / m;
}

const quantRows = readCsv('466_candidate_10_quantitative_evidence.csv');
const officialRows = readCsv('231_top10_official_two_earnings_input.csv');
const universeRows = readCsv('199_universe100_screening.csv');

const latestOfficialByTicker = new Map();
for (const row of officialRows) {
  if (row.period_type !== '最新') continue;
  latestOfficialByTicker.set(row.ticker, row);
}

const supplementalOfficialRows = [
  {
    ticker: '4385.T',
    company: 'メルカリ',
    period: '2026年6月期3Q累計',
    release_date: '2026-05-11',
    eps_yen: '117.93',
    source_url: 'https://finance-frontend-pc-dist.west.edge.storage-yahoo.jp/disclosure/20260511/20260508520767.pdf',
    note: '公式決算短信で基本的1株当たり四半期利益117.93円を確認。3Q累計EPSであり通期予想PERではない。',
  },
];
for (const row of supplementalOfficialRows) {
  if (!latestOfficialByTicker.has(row.ticker)) latestOfficialByTicker.set(row.ticker, row);
}

const universeByTicker = new Map();
for (const row of universeRows) {
  if (!universeByTicker.has(row.ticker)) universeByTicker.set(row.ticker, row);
}

const perMissingRows = quantRows.filter((row) => !present(row.per));

const detailRows = perMissingRows.map((row) => {
  const official = latestOfficialByTicker.get(row.ticker) || {};
  const universe = universeByTicker.get(row.ticker) || {};
  const price = num(universe.close);
  const eps = num(official.eps_yen);
  const estimate = price !== null && eps !== null && eps !== 0 ? round(price / eps, 2) : null;
  const hasEstimate = estimate !== null;
  const isQuarterCumulative = /3Q|第3四半期/.test(String(official.period || ''));
  return {
    updated_at: generatedAt,
    ticker: row.ticker,
    company: row.company,
    sector: row.sector,
    current_per_status: row.per || '未取得',
    price_date: universe.price_date || '',
    base_price_yen: price !== null ? price : '',
    eps_period: official.period || '',
    release_date: official.release_date || '',
    eps_yen: eps !== null ? eps : '',
    actual_per_estimate: hasEstimate ? estimate : '',
    calculation: hasEstimate ? `基準株価 ${price}円 ÷ 公式EPS ${eps}円 = ${estimate}倍` : '公式EPSまたは基準株価が不足',
    source_type: hasEstimate ? (isQuarterCumulative ? '公式3Q累計EPS + 既存株価CSV' : '公式EPS + 既存株価CSV') : '未接続',
    score_connection: '未接続',
    handling: hasEstimate && isQuarterCumulative
      ? '説明補助として使用。3Q累計EPS基準であり、通期PERや予想PERではないため採点へ接続しない。'
      : hasEstimate
        ? '説明補助として使用。予想PERではないため、採点へ戻す前に基準日と採用PER種別を確認する。'
      : '未取得のまま扱う。値を推定して採点へ入れない。',
    source_url: official.source_url || '',
  };
});

const estimateCount = detailRows.filter((row) => present(row.actual_per_estimate)).length;
const stillMissing = detailRows.filter((row) => !present(row.actual_per_estimate)).length;

const summaryRows = [
  {
    updated_at: generatedAt,
    item: 'PER未取得だった銘柄',
    value: `${perMissingRows.length}社`,
    interpretation: '現時点データ接続表でPERが未取得だった対象。',
  },
  {
    updated_at: generatedAt,
    item: '実績PERを試算できた銘柄',
    value: `${estimateCount}社`,
    interpretation: '公式EPSと既存株価CSVがそろったため、説明補助として計算できた対象。',
  },
  {
    updated_at: generatedAt,
    item: '採点へ接続した銘柄',
    value: '0社',
    interpretation: '予想PERと実績PERの基準差を確認するまで、点数へは戻さない。',
  },
  {
    updated_at: generatedAt,
    item: 'PERが残る銘柄',
    value: `${stillMissing}社`,
    interpretation: '公式EPSまたは株価基準が不足し、引き続き追加取得が必要な対象。',
  },
];

const policyRows = [
  {
    rule: '実績PERと予想PERを分ける',
    detail: '今回の試算は、基準株価を直近期の公式EPSで割る実績PERであり、会社予想や市場予想を使う予想PERとは別物として扱う。',
    score_policy: '未接続',
  },
  {
    rule: '不足値を点数へ混ぜない',
    detail: 'PERが未取得の銘柄に仮値を入れて順位を上げ下げしない。説明補助の欄に分けて表示する。',
    score_policy: '未接続',
  },
  {
    rule: '採点へ戻す条件',
    detail: '採用するPER種別、株価基準日、EPS基準期、同業比較の基準を固定し、同じ条件で全銘柄へ適用できる状態にしてから接続する。',
    score_policy: '条件確認後',
  },
  {
    rule: '6月テストでの扱い',
    detail: '6月イベント後の再判定までは、銘柄の割高確認に使う補助情報にとどめる。',
    score_policy: '説明補助',
  },
];

writeCsv('487_candidate_10_per_estimate_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'interpretation',
]);

writeCsv('488_candidate_10_per_estimate_detail.csv', detailRows, [
  'updated_at',
  'ticker',
  'company',
  'sector',
  'current_per_status',
  'price_date',
  'base_price_yen',
  'eps_period',
  'release_date',
  'eps_yen',
  'actual_per_estimate',
  'calculation',
  'source_type',
  'score_connection',
  'handling',
  'source_url',
]);

writeCsv('489_candidate_10_per_estimate_connection_policy.csv', policyRows, [
  'rule',
  'detail',
  'score_policy',
]);

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 PER試算ブリッジ 2026年5月26日</title>
  <style>
    :root {
      --ink: #061a33;
      --muted: #40536a;
      --line: #c8d9ea;
      --soft: #edf6ff;
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
      letter-spacing: 0;
    }
    header {
      background: linear-gradient(135deg, #062a4a, #0b668d);
      color: #fff;
      padding: 34px clamp(18px, 4vw, 58px);
    }
    h1 { margin: 0 0 8px; font-size: clamp(26px, 4vw, 42px); letter-spacing: 0; }
    header p { margin: 0; color: #eaf5ff; font-weight: 800; max-width: 1060px; }
    main { width: min(1220px, calc(100% - 32px)); margin: 24px auto 56px; }
    section {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 22px;
      margin: 18px 0;
      break-inside: avoid;
    }
    h2 {
      margin: 0 0 14px;
      padding-left: 12px;
      border-left: 8px solid var(--blue);
      font-size: 24px;
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }
    .metric {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
      background: var(--soft);
      min-height: 120px;
    }
    .metric span { display: block; color: var(--muted); font-weight: 900; }
    .metric strong { display: block; font-size: 30px; color: var(--blue); }
    .notice {
      border-left: 8px solid var(--amber);
      background: #fff7ed;
      padding: 14px;
      border-radius: 8px;
      font-weight: 900;
      margin-top: 14px;
    }
    .toolbar { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
    .button {
      display: inline-flex;
      align-items: center;
      min-height: 38px;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid #9cc8ec;
      background: #fff;
      color: #062a4a;
      text-decoration: none;
      font-weight: 900;
      font-size: 13px;
    }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; min-width: 1080px; }
    th, td {
      border-bottom: 1px solid var(--line);
      padding: 9px;
      text-align: left;
      vertical-align: top;
      color: var(--ink);
      word-break: break-word;
    }
    th { background: #e6f1fb; font-weight: 900; }
    tr:last-child td { border-bottom: 0; }
    .ok { color: var(--green); font-weight: 900; }
    .pending { color: var(--amber); font-weight: 900; }
    .gap { color: var(--red); font-weight: 900; }
    .formula {
      font-family: Consolas, "Yu Gothic", monospace;
      background: #f7fbff;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 12px;
      margin: 10px 0;
      font-weight: 900;
    }
    @media (max-width: 860px) {
      .summary { grid-template-columns: 1fr; }
      main { width: min(100% - 20px, 1220px); }
      section { padding: 16px; }
    }
    @media print {
      body { background: #fff; }
      section { break-inside: avoid; }
      .table-wrap { overflow: visible; }
      table { min-width: 0; font-size: 10px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>候補10社 PER試算ブリッジ</h1>
    <p>PER未取得の銘柄について、公式EPSと既存株価CSVで説明補助の試算ができるかを確認します。試算値は採点へ接続せず、根拠確認の材料として分けて管理します。</p>
  </header>
  <main>
    <section>
      <h2>概要</h2>
      <div class="summary">
        ${summaryRows.map((row) => `
        <div class="metric">
          <span>${esc(row.item)}</span>
          <strong>${esc(row.value)}</strong>
          <small>${esc(row.interpretation)}</small>
        </div>`).join('')}
      </div>
      <p class="notice">重要: 今回の数値は「実績PER試算」です。予想PERではないため、同じ基準で全銘柄を比較できる状態になるまで、NISA 1年保有スコアには入れません。</p>
      <div class="toolbar">
        <a class="button" href="487_candidate_10_per_estimate_summary.csv">487 要約CSV</a>
        <a class="button" href="488_candidate_10_per_estimate_detail.csv">488 詳細CSV</a>
        <a class="button" href="489_candidate_10_per_estimate_connection_policy.csv">489 接続ルールCSV</a>
        <a class="button" href="candidate_10_current_data_connection_20260526.html">現時点データ接続へ</a>
        <a class="button" href="index.html">メインページへ</a>
      </div>
    </section>

    <section>
      <h2>計算式</h2>
      <div class="formula">実績PER試算 = 基準株価 ÷ 直近期の公式EPS</div>
      <p>この式は「割高かどうかを確認するための補助」です。会社予想EPSや市場予想EPSを使う予想PERとは意味が違うため、採点へ直接戻すと比較基準が崩れます。</p>
    </section>

    <section>
      <h2>PER未取得銘柄の確認結果</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>銘柄</th><th>現状PER</th><th>株価基準日</th><th>基準株価</th><th>EPS基準期</th><th>公式EPS</th><th>実績PER試算</th><th>計算過程</th><th>採点接続</th><th>扱い</th>
            </tr>
          </thead>
          <tbody>
            ${detailRows.map((row) => `
            <tr>
              <td>${esc(row.ticker)} ${esc(row.company)}</td>
              <td class="gap">${esc(row.current_per_status)}</td>
              <td>${esc(row.price_date || '未取得')}</td>
              <td>${row.base_price_yen ? `${esc(row.base_price_yen)}円` : '<span class="gap">未取得</span>'}</td>
              <td>${esc(row.eps_period || '未取得')}</td>
              <td>${row.eps_yen ? `${esc(row.eps_yen)}円` : '<span class="gap">未取得</span>'}</td>
              <td class="${row.actual_per_estimate ? 'ok' : 'gap'}">${row.actual_per_estimate ? `${esc(row.actual_per_estimate)}倍` : '未取得'}</td>
              <td>${esc(row.calculation)}</td>
              <td class="pending">${esc(row.score_connection)}</td>
              <td>${esc(row.handling)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h2>接続ルール</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>ルール</th><th>内容</th><th>採点上の扱い</th></tr></thead>
          <tbody>
            ${policyRows.map((row) => `
            <tr><td>${esc(row.rule)}</td><td>${esc(row.detail)}</td><td>${esc(row.score_policy)}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_per_estimate_bridge_20260526.html'), html, 'utf8');

console.log(`created candidate_10_per_estimate_bridge_20260526.html, estimates=${estimateCount}, still_missing=${stillMissing}`);
