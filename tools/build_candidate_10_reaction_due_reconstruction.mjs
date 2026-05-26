import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const TODAY = '2026-05-26';

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

function present(value) {
  const text = String(value ?? '').trim();
  return text !== '' && text !== '未取得' && text !== '未確認' && text !== '未接続';
}

function parseDate(text) {
  const [year, month, day] = String(text || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(date) {
  if (!date) return '';
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const JP_HOLIDAYS = new Set([
  '2026-04-29',
  '2026-05-04',
  '2026-05-05',
  '2026-05-06',
]);

function isBusinessDay(date) {
  const day = date.getUTCDay();
  if (day === 0 || day === 6) return false;
  return !JP_HOLIDAYS.has(formatDate(date));
}

function addBusinessDays(dateText, days) {
  const date = parseDate(dateText);
  if (!date) return '';
  let added = 0;
  while (added < days) {
    date.setUTCDate(date.getUTCDate() + 1);
    if (isBusinessDay(date)) added += 1;
  }
  return formatDate(date);
}

function compareDate(a, b) {
  const da = parseDate(a);
  const db = parseDate(b);
  if (!da || !db) return null;
  return da.getTime() - db.getTime();
}

function normalizePct(value) {
  if (!present(value)) return '';
  return String(value).includes('%') ? String(value) : `${value}%`;
}

const currentRows = readCsv('491_candidate_10_reaction_maturity_detail.csv');
const detailRows236 = readCsv('236_top10_earnings_reaction_detail.csv');
const completedRows273 = readCsv('273_top20_earnings_reaction_completed.csv');

const latest236ByTicker = new Map();
for (const row of detailRows236) {
  if (row.period_type === '最新' && !latest236ByTicker.has(row.ticker)) {
    latest236ByTicker.set(row.ticker, row);
  }
}

const completed273ByTicker = new Map(completedRows273.map((row) => [row.ticker, row]));

function sourceForTicker(current) {
  const source236 = latest236ByTicker.get(current.ticker);
  if (source236) {
    return {
      source_kind: '既存詳細CSVから復元',
      event_date: source236.release_date || source236.base_date || '',
      event_type: `${source236.period || ''} 決算`.trim(),
      base_date: source236.base_date || source236.release_date || '',
      after_1d_date: source236.after_1d_date || '',
      excess_1d_pct: normalizePct(source236.excess_1d_pct),
      after_5d_date: source236.after_5d_date || '',
      excess_5d_pct: normalizePct(source236.excess_5d_pct),
      after_20d_date: source236.after_20d_date || '',
      excess_20d_pct: normalizePct(source236.excess_20d_pct),
      existing_reaction_score: source236.score || current.existing_reaction_score || '',
      source_url: source236.source_url || current.source_url || '',
    };
  }

  const source273 = completed273ByTicker.get(current.ticker);
  if (source273) {
    return {
      source_kind: '既存完了CSVから使用',
      event_date: source273.event_date || '',
      event_type: source273.event_type || '',
      base_date: source273.base_date || source273.event_date || '',
      after_1d_date: source273.after_1d_date || '',
      excess_1d_pct: normalizePct(source273.excess_1d_pct),
      after_5d_date: source273.after_5d_date || '',
      excess_5d_pct: normalizePct(source273.excess_5d_pct),
      after_20d_date: source273.after_20d_date || '',
      excess_20d_pct: normalizePct(source273.excess_20d_pct),
      existing_reaction_score: source273.earnings_reaction_score || current.existing_reaction_score || '',
      source_url: source273.event_url || current.source_url || '',
    };
  }

  return {
    source_kind: '未接続',
    event_date: current.event_date || '',
    event_type: current.event_type || '',
    base_date: current.event_date || '',
    after_1d_date: '',
    excess_1d_pct: current.excess_1d_pct || '',
    after_5d_date: '',
    excess_5d_pct: current.excess_5d_pct || '',
    after_20d_date: '',
    excess_20d_pct: current.excess_20d_pct || '',
    existing_reaction_score: current.existing_reaction_score || '',
    source_url: current.source_url || '',
  };
}

function classify(row, source) {
  const hasShort = present(source.excess_1d_pct) && present(source.excess_5d_pct);
  const has20 = present(source.excess_20d_pct);
  const due20 = source.base_date ? addBusinessDays(source.base_date, 20) : '';
  const dateCmp = due20 ? compareDate(due20, TODAY) : null;
  const dueStatus = has20
    ? '20営業日確定済み'
    : !due20
      ? 'イベント日未接続'
      : dateCmp !== null && dateCmp <= 0
        ? '20営業日到達済み・再取得必要'
        : '20営業日未到達';

  const reconstruction = hasShort
    ? source.source_kind === '既存詳細CSVから復元'
      ? '1日/5日復元済み'
      : '1日/5日接続済み'
    : source.existing_reaction_score
      ? '既存反応点のみ'
      : '未接続';

  const scoreConnection = has20 ? '接続候補' : '未接続';
  const reason = has20
    ? '1日、5日、20営業日の反応がそろったため、検算後に採点接続を検討できる。'
    : dueStatus === '20営業日到達済み・再取得必要'
      ? '20営業日目は概算上到達しているが、終値と指数比較の再取得が必要。再取得まで採点へ接続しない。'
      : dueStatus === '20営業日未到達'
        ? '1日/5日反応は確認できるが、20営業日反応が未到達のため採点へ接続しない。'
        : '決算日または基準株価が未接続のため、まず公式発表日と基準株価を確認する。';

  return {
    hasShort,
    has20,
    due20,
    dueStatus,
    reconstruction,
    scoreConnection,
    reason,
  };
}

const detailRows = currentRows.map((current) => {
  const source = sourceForTicker(current);
  const state = classify(current, source);
  return {
    updated_at: generatedAt,
    current_rank: current.rank,
    ticker: current.ticker,
    company: current.company,
    sector: current.sector,
    source_kind: source.source_kind,
    event_date: source.event_date,
    event_type: source.event_type,
    base_date: source.base_date,
    after_1d_date: source.after_1d_date,
    excess_1d_pct: source.excess_1d_pct,
    after_5d_date: source.after_5d_date,
    excess_5d_pct: source.excess_5d_pct,
    estimated_20bd_date: state.due20,
    after_20d_date: source.after_20d_date,
    excess_20d_pct: source.excess_20d_pct,
    existing_reaction_score: source.existing_reaction_score,
    reconstruction_status: state.reconstruction,
    due_status: state.dueStatus,
    score_connection: state.scoreConnection,
    reason: state.reason,
    source_url: source.source_url,
  };
});

const queueRows = detailRows.map((row) => {
  let priority = 3;
  let task = '20営業日反応の到達待ち';
  let expected_output = '20営業日到達後に終値、日経平均、超過リターンを再計算する。';
  if (row.due_status === 'イベント日未接続') {
    priority = 1;
    task = '公式決算日と基準株価の接続';
    expected_output = '公式発表日、基準終値、1日/5日反応を取得する。';
  } else if (row.due_status === '20営業日到達済み・再取得必要') {
    priority = 1;
    task = '20営業日反応の再取得';
    expected_output = '20営業日超過リターンを取得し、採点接続候補にできるか検算する。';
  } else if (row.reconstruction_status === '1日/5日復元済み') {
    priority = 2;
    task = '復元済み1日/5日反応の出典確認';
    expected_output = 'イベント日、基準株価、指数比較が説明資料に使える状態か確認する。';
  }
  return {
    updated_at: generatedAt,
    priority,
    ticker: row.ticker,
    company: row.company,
    current_status: `${row.reconstruction_status} / ${row.due_status}`,
    next_task: task,
    expected_output,
  };
}).sort((a, b) => Number(a.priority) - Number(b.priority) || a.ticker.localeCompare(b.ticker));

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '対象銘柄',
    value: `${detailRows.length}社`,
    interpretation: '現在の候補10社について、決算後反応データの到達状況を確認した。',
  },
  {
    updated_at: generatedAt,
    item: '1日/5日反応を確認できる銘柄',
    value: `${detailRows.filter((row) => row.reconstruction_status === '1日/5日復元済み' || row.reconstruction_status === '1日/5日接続済み').length}社`,
    interpretation: '短期反応の説明補助には使える。ただし20営業日反応が未確定なら採点には接続しない。',
  },
  {
    updated_at: generatedAt,
    item: '20営業日反応が確定している銘柄',
    value: `${detailRows.filter((row) => row.due_status === '20営業日確定済み').length}社`,
    interpretation: '現時点で採点接続候補まで進められる銘柄数。検算前のため最終判断ではない。',
  },
  {
    updated_at: generatedAt,
    item: '20営業日到達予定あり',
    value: `${detailRows.filter((row) => row.estimated_20bd_date).length}社`,
    interpretation: '到達日が見える銘柄。到達後に再取得すれば、決算後反応の信頼度を上げられる。',
  },
  {
    updated_at: generatedAt,
    item: 'イベント日未接続',
    value: `${detailRows.filter((row) => row.due_status === 'イベント日未接続').length}社`,
    interpretation: 'まず公式決算日、基準株価、指数比較を接続する必要がある。',
  },
  {
    updated_at: generatedAt,
    item: '採点へ接続した銘柄',
    value: `${detailRows.filter((row) => row.score_connection === '接続候補').length}社`,
    interpretation: '現段階では未確定値を点数へ混ぜない。購入判断ではなく、データ補完のための整理である。',
  },
];

const csvHeaders = [
  'updated_at',
  'current_rank',
  'ticker',
  'company',
  'sector',
  'source_kind',
  'event_date',
  'event_type',
  'base_date',
  'after_1d_date',
  'excess_1d_pct',
  'after_5d_date',
  'excess_5d_pct',
  'estimated_20bd_date',
  'after_20d_date',
  'excess_20d_pct',
  'existing_reaction_score',
  'reconstruction_status',
  'due_status',
  'score_connection',
  'reason',
  'source_url',
];

writeCsv('499_candidate_10_reaction_due_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'interpretation',
]);

writeCsv('500_candidate_10_reaction_due_detail.csv', detailRows, csvHeaders);

writeCsv('501_candidate_10_reaction_reconstruction_queue.csv', queueRows, [
  'updated_at',
  'priority',
  'ticker',
  'company',
  'current_status',
  'next_task',
  'expected_output',
]);

const badgeClass = {
  '20営業日確定済み': 'ok',
  '20営業日到達済み・再取得必要': 'warn',
  '20営業日未到達': 'wait',
  'イベント日未接続': 'gap',
};

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 決算後反応の到達予定と復元状況 2026年5月26日</title>
  <style>
    :root {
      --ink: #061a33;
      --muted: #3b4f66;
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
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      padding: 28px 0 48px;
    }
    .hero {
      background: linear-gradient(135deg, #08345f, #0b66a0);
      color: #fff;
      border-radius: 18px;
      padding: 28px;
      margin-bottom: 20px;
      box-shadow: 0 18px 40px rgba(6, 26, 51, .18);
    }
    .hero h1 {
      margin: 0 0 10px;
      font-size: clamp(26px, 4vw, 44px);
      line-height: 1.2;
      letter-spacing: 0;
    }
    .hero p {
      margin: 0;
      max-width: 920px;
      color: #e8f3ff;
      font-size: 16px;
    }
    .nav {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 16px 0 0;
    }
    .nav a {
      color: #fff;
      border: 1px solid rgba(255,255,255,.42);
      border-radius: 999px;
      padding: 7px 12px;
      text-decoration: none;
      font-weight: 700;
      font-size: 13px;
      background: rgba(255,255,255,.1);
    }
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
      font-size: 24px;
      border-left: 8px solid var(--blue);
      padding-left: 12px;
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
    .kpi .label {
      color: var(--muted);
      font-size: 13px;
      font-weight: 700;
    }
    .kpi .value {
      font-size: 28px;
      font-weight: 900;
      color: var(--blue);
      margin-top: 4px;
    }
    .table-wrap { overflow-x: auto; }
    table {
      width: 100%;
      border-collapse: collapse;
      min-width: 980px;
      background: #fff;
    }
    th, td {
      border: 1px solid var(--line);
      padding: 10px 12px;
      vertical-align: top;
      text-align: left;
      word-break: normal;
      overflow-wrap: anywhere;
      color: #061a33;
    }
    th {
      background: #e5f1fb;
      white-space: nowrap;
      font-weight: 900;
    }
    .badge {
      display: inline-block;
      border-radius: 999px;
      padding: 3px 9px;
      font-size: 12px;
      font-weight: 900;
      white-space: nowrap;
      border: 1px solid currentColor;
    }
    .ok { color: var(--green); background: #e9f8f1; }
    .warn { color: var(--amber); background: #fff7ed; }
    .wait { color: var(--blue); background: #eef6ff; }
    .gap { color: var(--red); background: #fff1f0; }
    .note {
      border-left: 5px solid var(--amber);
      background: #fff7ed;
      padding: 12px 14px;
      border-radius: 10px;
      margin-top: 12px;
      font-weight: 700;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .card {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 14px;
      background: #fbfdff;
    }
    .card h3 {
      margin: 0 0 8px;
      font-size: 18px;
    }
    .links {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 14px;
    }
    .links a {
      display: inline-block;
      background: var(--blue);
      color: #fff;
      padding: 9px 13px;
      border-radius: 10px;
      text-decoration: none;
      font-weight: 900;
    }
    @media (max-width: 760px) {
      main { width: min(100% - 20px, 1180px); }
      .hero { padding: 20px; border-radius: 14px; }
      .kpis, .cards { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <h1>候補10社 決算後反応の到達予定と復元状況</h1>
      <p>候補10社の決算後反応について、既存CSVから復元できる1日/5日反応、20営業日の到達予定、採点へ接続してよいかを分けて整理しました。未確定値は点数へ混ぜません。</p>
      <div class="nav">
        <a href="index.html">トップへ戻る</a>
        <a href="#summary">要約</a>
        <a href="#detail">銘柄別</a>
        <a href="#queue">次の作業</a>
        <a href="499_candidate_10_reaction_due_summary.csv">要約CSV</a>
        <a href="500_candidate_10_reaction_due_detail.csv">詳細CSV</a>
        <a href="501_candidate_10_reaction_reconstruction_queue.csv">作業CSV</a>
      </div>
    </section>

    <section class="panel" id="summary">
      <h2>1. 要約</h2>
      <div class="kpis">
        ${summaryRows.map((row) => `
        <div class="kpi">
          <div class="label">${esc(row.item)}</div>
          <div class="value">${esc(row.value)}</div>
          <div>${esc(row.interpretation)}</div>
        </div>`).join('')}
      </div>
      <div class="note">このページは、候補10社を絞るためのデータ到達状況です。採点へ接続した銘柄は0社であり、購入判断ではありません。</div>
    </section>

    <section class="panel" id="detail">
      <h2>2. 銘柄別の到達予定</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>順位</th>
              <th>銘柄</th>
              <th>復元状況</th>
              <th>決算日</th>
              <th>1日超過</th>
              <th>5日超過</th>
              <th>20営業日概算</th>
              <th>到達状況</th>
              <th>採点接続</th>
              <th>理由</th>
            </tr>
          </thead>
          <tbody>
            ${detailRows.map((row) => `
            <tr>
              <td>${esc(row.current_rank)}</td>
              <td><strong>${esc(row.ticker)} ${esc(row.company)}</strong><br>${esc(row.sector)}</td>
              <td>${esc(row.reconstruction_status)}<br><small>${esc(row.source_kind)}</small></td>
              <td>${esc(row.event_date || '未接続')}<br><small>${esc(row.event_type)}</small></td>
              <td>${esc(row.after_1d_date)}<br><strong>${esc(row.excess_1d_pct)}</strong></td>
              <td>${esc(row.after_5d_date)}<br><strong>${esc(row.excess_5d_pct)}</strong></td>
              <td>${esc(row.estimated_20bd_date || '未接続')}</td>
              <td><span class="badge ${badgeClass[row.due_status] || 'gap'}">${esc(row.due_status)}</span></td>
              <td>${esc(row.score_connection)}</td>
              <td>${esc(row.reason)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel" id="queue">
      <h2>3. 次の作業</h2>
      <div class="cards">
        ${queueRows.map((row) => `
        <div class="card">
          <h3>優先${esc(row.priority)} ${esc(row.ticker)} ${esc(row.company)}</h3>
          <p><strong>現状:</strong> ${esc(row.current_status)}</p>
          <p><strong>作業:</strong> ${esc(row.next_task)}</p>
          <p><strong>出力:</strong> ${esc(row.expected_output)}</p>
        </div>`).join('')}
      </div>
      <div class="links">
        <a href="candidate_10_reaction_maturity_bridge_20260526.html">前工程を見る</a>
        <a href="candidate_10_selection_readiness_20260526.html">選出準備状況を見る</a>
        <a href="candidate_10_universe_lineage_20260526.html">選出経路を見る</a>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_reaction_due_reconstruction_20260526.html'), html, 'utf8');

console.log('generated candidate_10_reaction_due_reconstruction_20260526.html');
