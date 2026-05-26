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

function table(headers, rows, className = '') {
  return `
    <div class="table-wrap ${className}">
      <table>
        <thead><tr>${headers.map((header) => `<th>${esc(header.label)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map((row) => `<tr>${headers.map((header) => `<td>${header.link ? `<a href="${esc(row[header.link])}" target="_blank" rel="noopener">${esc(row[header.key])}</a>` : esc(row[header.key])}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

const detailRows = readCsv('540_candidate_10_client_explanation_detail.csv');
const taskRowsByTicker = new Map(readCsv('532_candidate_10_next_data_tasks_detail.csv').map((row) => [row.ticker, row]));

const marketRows = [
  {
    updated_at: generatedAt,
    date: '2026-06-10',
    event: '米5月CPI発表',
    source: 'BLS',
    source_url: 'https://www.bls.gov/schedule/news_release/cpi.htm',
    check_item: '前年比、前月比、コアCPI、米10年金利、ドル円、NASDAQ/SOX反応',
    action: 'インフレ再加速と金利急騰が同時に出た場合、6月の個別株比率を下げる。予想内なら候補再判定を継続。',
  },
  {
    updated_at: generatedAt,
    date: '2026-06-15〜2026-06-16',
    event: '日銀金融政策決定会合',
    source: '日本銀行',
    source_url: 'https://www.boj.or.jp/en/mopo/mpmsche_minu/index.htm',
    check_item: '政策金利、声明、国債買入れ、円高/円安、銀行株・輸出株・内需株の反応',
    action: '急な円高または銀行株の市場劣後が出た場合、銀行・海外比率が高い候補の比率を抑える。',
  },
  {
    updated_at: generatedAt,
    date: '2026-06-16〜2026-06-17',
    event: 'FOMC',
    source: 'FRB',
    source_url: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
    check_item: '政策金利、SEP、ドットプロット、米10年金利、NASDAQ/SOX、ドル円',
    action: '金利上振れ・高PER株売りが強い場合、半導体・成長株の候補を減点。落ち着けば候補維持。',
  },
  {
    updated_at: generatedAt,
    date: '2026-07-28〜2026-07-29',
    event: 'FOMC追加確認',
    source: 'FRB',
    source_url: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
    check_item: '6月判断後の金利・株式市場の継続性',
    action: '6月に小さく開始した場合の継続・停止・追加判断に使う。',
  },
  {
    updated_at: generatedAt,
    date: '2026-07-30〜2026-07-31',
    event: '日銀追加確認',
    source: '日本銀行',
    source_url: 'https://www.boj.or.jp/en/mopo/mpmsche_minu/index.htm',
    check_item: '円相場、銀行株、内需株、輸出株の反応',
    action: '夏の追加判断で、銀行・輸出・内需の比率を調整する。',
  },
];

function extractDate(nextTrigger) {
  const match = String(nextTrigger || '').match(/20営業日反応:\s*(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : '';
}

const reactionRows = detailRows.map((row) => {
  const task = taskRowsByTicker.get(row.ticker) || {};
  return {
    updated_at: generatedAt,
    date: extractDate(task.next_trigger) || '',
    ticker: row.ticker,
    company: row.company,
    role: row.role,
    current_reaction: row.numeric_basis,
    check_item: '決算後20営業日の対日経平均超過リターンを確認',
    action: row.role === '主候補'
      ? '20営業日反応が悪化しなければ主候補を維持。悪化時は比較枠へ下げる。'
      : row.role === '検算枠'
        ? '弱い反応の原因が説明できなければ主候補へ戻さない。'
        : '結果を見て、主候補化・比較維持・除外のいずれかに再分類。',
  };
});

const combinedRows = [
  ...marketRows.map((row) => ({
    updated_at: row.updated_at,
    date: row.date,
    type: '市場イベント',
    target: row.event,
    check_item: row.check_item,
    action: row.action,
    source: row.source,
    source_url: row.source_url,
  })),
  ...reactionRows.map((row) => ({
    updated_at: row.updated_at,
    date: row.date,
    type: '銘柄イベント',
    target: `${row.company}（${row.ticker}）`,
    check_item: row.check_item,
    action: row.action,
    source: '既存株価データ / 日経平均比較',
    source_url: '',
  })),
].sort((a, b) => String(a.date).localeCompare(String(b.date)));

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '6月の判定軸',
    value: '市場イベント + 銘柄反応',
    meaning: 'CPI・日銀・FOMCと、候補10社の決算後20営業日反応を合わせて見る。',
  },
  {
    updated_at: generatedAt,
    item: '購入判断',
    value: 'イベント後に再判定',
    meaning: '日付前に購入確定扱いにしない。',
  },
  {
    updated_at: generatedAt,
    item: '+1%目標',
    value: '指数超過が前提',
    meaning: 'S&P500・日経平均・TOPIXを1%以上上回る見込みが弱い場合、個別株比率を下げる。',
  },
];

writeCsv('542_candidate_10_june_decision_calendar_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'meaning',
]);

writeCsv('543_candidate_10_june_decision_calendar_events.csv', combinedRows, [
  'updated_at',
  'date',
  'type',
  'target',
  'check_item',
  'action',
  'source',
  'source_url',
]);

writeCsv('544_candidate_10_june_decision_calendar_reactions.csv', reactionRows, [
  'updated_at',
  'date',
  'ticker',
  'company',
  'role',
  'current_reaction',
  'check_item',
  'action',
]);

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 6月再判定カレンダー 2026年5月27日</title>
  <style>
    :root { --ink:#061a33; --muted:#334155; --line:#c9d9ea; --bg:#f4f8fc; --navy:#0d3658; --blue:#0b6fa4; --soft:#eef7ff; --amber:#b45309; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; background:var(--bg); color:var(--ink); line-height:1.72; letter-spacing:0; }
    header { background:var(--navy); color:#fff; padding:34px clamp(18px,4vw,58px); }
    h1 { margin:0 0 8px; font-size:clamp(28px,4vw,42px); letter-spacing:0; }
    header p { margin:0; color:#fff; font-weight:800; max-width:1120px; }
    main { width:min(1260px, calc(100% - 32px)); margin:24px auto 56px; }
    section { background:#fff; border:1px solid var(--line); border-radius:8px; padding:22px; margin:18px 0; break-inside:avoid; }
    h2 { margin:0 0 14px; padding-left:12px; border-left:8px solid var(--blue); font-size:24px; }
    .summary { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
    .metric { border:1px solid var(--line); border-radius:8px; padding:14px; background:var(--soft); min-height:120px; }
    .metric span { display:block; color:var(--muted); font-weight:900; }
    .metric strong { display:block; color:var(--blue); font-size:24px; line-height:1.35; }
    .notice { border-left:8px solid var(--amber); background:#fff7ed; padding:14px; border-radius:8px; font-weight:900; color:#111827; }
    .toolbar { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .button { display:inline-flex; align-items:center; min-height:38px; padding:8px 12px; border-radius:8px; border:1px solid #9cc8ec; background:#fff; color:var(--navy); text-decoration:none; font-weight:900; font-size:13px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:8px; }
    table { width:100%; min-width:1160px; border-collapse:collapse; table-layout:fixed; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:9px; vertical-align:top; text-align:left; overflow-wrap:anywhere; word-break:break-word; color:#061a33; }
    th { background:#e6f1fb; color:#073b63; font-weight:900; }
    a { color:#0b5cab; font-weight:900; }
    tr:last-child td { border-bottom:0; }
    th:last-child,td:last-child { border-right:0; }
    @media (max-width:900px) { .summary { grid-template-columns:1fr; } main { width:min(100% - 20px,1260px); } section { padding:16px; } }
  </style>
</head>
<body>
  <header>
    <h1>候補10社 6月再判定カレンダー</h1>
    <p>市場イベントと候補10社の決算後反応を同じ時系列で確認し、6月の再判定に使う資料です。</p>
  </header>
  <main>
    <section>
      <h2>概要</h2>
      <div class="summary">
        ${summaryRows.map((row) => `
        <div class="metric">
          <span>${esc(row.item)}</span>
          <strong>${esc(row.value)}</strong>
          <small>${esc(row.meaning)}</small>
        </div>`).join('')}
      </div>
      <p class="notice">日付前に購入を確定しません。イベント結果と銘柄反応を更新してから再判定します。</p>
      <div class="toolbar">
        <a class="button" href="542_candidate_10_june_decision_calendar_summary.csv">542 要約CSV</a>
        <a class="button" href="543_candidate_10_june_decision_calendar_events.csv">543 イベントCSV</a>
        <a class="button" href="544_candidate_10_june_decision_calendar_reactions.csv">544 反応CSV</a>
        <a class="button" href="candidate_10_client_explanation_20260527.html">顧客向け説明整理へ</a>
        <a class="button" href="index.html">メインページへ</a>
      </div>
    </section>

    <section>
      <h2>時系列チェック</h2>
      ${table(
        [
          { key: 'date', label: '日付' },
          { key: 'type', label: '区分' },
          { key: 'target', label: '対象' },
          { key: 'check_item', label: '確認する数値' },
          { key: 'action', label: '条件分岐' },
          { key: 'source', label: '出典', link: 'source_url' },
        ],
        combinedRows,
      )}
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_june_decision_calendar_20260527.html'), html, 'utf8');

console.log(`created candidate_10_june_decision_calendar_20260527.html rows=${combinedRows.length}`);
