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

function priority(row) {
  if (row.status === '説明優先') return '高';
  if (row.status === '比較維持') return '中';
  if (row.status === '検算優先') return '高';
  return '要確認';
}

function taskFor(row) {
  const tasks = [];
  if (row.next_trigger.includes('20営業日反応')) {
    tasks.push('20営業日到達日に、対象銘柄と日経平均のリターン差を更新する');
  }
  if (row.next_trigger.includes('5営業日反応')) {
    tasks.push('5営業日反応を更新し、20営業日反応までの仮扱いとして明記する');
  }
  if (row.next_trigger.includes('同業比較')) {
    tasks.push('同業比較または広義同業比較の不足理由を確認し、説明欄へ反映する');
  }
  if (row.next_trigger.includes('公式値') || row.next_trigger.includes('補助値')) {
    tasks.push('公式EPS・通期予想・補助PERの整合性を検算する');
  }
  if (row.next_trigger.includes('弱い反応')) {
    tasks.push('弱い決算後反応の原因を、指数比較・決算内容・過熱度から検算する');
  }
  if (!tasks.length) {
    tasks.push('6月のCPI・日銀・FOMC後に、候補維持または再判定を行う');
  }
  return tasks.join(' / ');
}

const memoRows = readCsv('530_candidate_10_company_memos_detail.csv');

const taskRows = memoRows.map((row) => ({
  updated_at: generatedAt,
  order: row.order,
  ticker: row.ticker,
  company: row.company,
  status: row.status,
  priority: priority(row),
  next_trigger: row.next_trigger,
  data_task: taskFor(row),
  source_basis: row.reaction_schedule,
  output: '1社別メモ、選定ドラフト、説明ブリーフを更新',
  treatment: '確認結果がそろうまで投資実行判断には使わない。未取得値は点数へ混ぜない。',
}));

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '確認タスク',
    value: `${taskRows.length}件`,
    meaning: '候補10社それぞれに、次に確認するデータ作業を設定。',
  },
  {
    updated_at: generatedAt,
    item: '優先度 高',
    value: `${taskRows.filter((row) => row.priority === '高').length}件`,
    meaning: '説明優先または検算優先の銘柄で、明日の根拠整理に直結する作業。',
  },
  {
    updated_at: generatedAt,
    item: '要確認',
    value: `${taskRows.filter((row) => row.priority === '要確認').length}件`,
    meaning: '反応待ち、補完後再判定、日付到達後に扱いを更新する作業。',
  },
];

writeCsv('531_candidate_10_next_data_tasks_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'meaning',
]);

writeCsv('532_candidate_10_next_data_tasks_detail.csv', taskRows, [
  'updated_at',
  'order',
  'ticker',
  'company',
  'status',
  'priority',
  'next_trigger',
  'data_task',
  'source_basis',
  'output',
  'treatment',
]);

function table(headers, rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map((header) => `<th>${esc(header.label)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map((row) => `<tr>${headers.map((header) => `<td>${esc(row[header.key])}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 次データ確認タスク 2026年5月26日</title>
  <style>
    :root { --ink:#061a33; --muted:#334155; --line:#c9d9ea; --bg:#f4f8fc; --navy:#0d3658; --blue:#0b6fa4; --soft:#eef7ff; --amber:#b45309; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; background:var(--bg); color:var(--ink); line-height:1.72; letter-spacing:0; }
    header { background:var(--navy); color:#fff; padding:34px clamp(18px,4vw,58px); }
    h1 { margin:0 0 8px; font-size:clamp(28px,4vw,42px); letter-spacing:0; }
    header p { margin:0; color:#fff; font-weight:800; max-width:1120px; }
    main { width:min(1240px, calc(100% - 32px)); margin:24px auto 56px; }
    section { background:#fff; border:1px solid var(--line); border-radius:8px; padding:22px; margin:18px 0; break-inside:avoid; }
    h2 { margin:0 0 14px; padding-left:12px; border-left:8px solid var(--blue); font-size:24px; }
    .summary { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
    .metric { border:1px solid var(--line); border-radius:8px; padding:14px; background:var(--soft); min-height:118px; }
    .metric span { display:block; color:var(--muted); font-weight:900; }
    .metric strong { display:block; color:var(--blue); font-size:30px; line-height:1.2; }
    .notice { border-left:8px solid var(--amber); background:#fff7ed; padding:14px; border-radius:8px; font-weight:900; color:#111827; }
    .toolbar { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .button { display:inline-flex; align-items:center; min-height:38px; padding:8px 12px; border-radius:8px; border:1px solid #9cc8ec; background:#fff; color:var(--navy); text-decoration:none; font-weight:900; font-size:13px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:8px; }
    table { width:100%; min-width:1180px; border-collapse:collapse; table-layout:fixed; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:9px; vertical-align:top; text-align:left; overflow-wrap:anywhere; word-break:break-word; }
    th { background:#e6f1fb; color:#073b63; font-weight:900; }
    tr:last-child td { border-bottom:0; }
    th:last-child,td:last-child { border-right:0; }
    @media (max-width:900px) { main { width:min(100% - 20px,1240px); } .summary { grid-template-columns:1fr; } section { padding:16px; } }
  </style>
</head>
<body>
  <header>
    <h1>候補10社 次データ確認タスク</h1>
    <p>候補10社について、次に確認するデータ、優先度、反映先を銘柄別に整理した作業表です。</p>
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
      <p class="notice">この表はデータ確認作業の一覧です。確認結果がそろうまで、投資実行判断として扱いません。</p>
      <div class="toolbar">
        <a class="button" href="531_candidate_10_next_data_tasks_summary.csv">531 要約CSV</a>
        <a class="button" href="532_candidate_10_next_data_tasks_detail.csv">532 詳細CSV</a>
        <a class="button" href="candidate_10_company_memos_20260526.html">1社別メモへ</a>
        <a class="button" href="candidate_10_tomorrow_brief_20260526.html">明日説明ブリーフへ</a>
        <a class="button" href="index.html">メインページへ</a>
      </div>
    </section>

    <section>
      <h2>銘柄別タスク</h2>
      ${table(
        [
          { key: 'order', label: '順位' },
          { key: 'ticker', label: 'コード' },
          { key: 'company', label: '銘柄' },
          { key: 'status', label: '分類' },
          { key: 'priority', label: '優先度' },
          { key: 'next_trigger', label: '次の条件' },
          { key: 'data_task', label: 'データ確認作業' },
          { key: 'source_basis', label: '根拠日程' },
          { key: 'output', label: '反映先' },
          { key: 'treatment', label: '扱い' },
        ],
        taskRows,
      )}
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_next_data_tasks_20260526.html'), html, 'utf8');

console.log(`created candidate_10_next_data_tasks_20260526.html rows=${taskRows.length}`);
