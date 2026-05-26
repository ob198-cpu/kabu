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

function table(headers, rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map((header) => `<th>${esc(header.label)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map((row) => `<tr>${headers.map((header) => `<td>${header.link ? `<a href="${esc(row[header.link])}">${esc(row[header.key])}</a>` : esc(row[header.key])}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

const hubRows = [
  {
    updated_at: generatedAt,
    order: 1,
    title: '候補10社 顧客向け説明整理',
    purpose: '最初に見せる資料。10社を主候補・比較枠・反応待ち・補完待ち・検算枠に分けて説明する。',
    file: 'candidate_10_client_explanation_20260527.html',
    status: '公開済み',
  },
  {
    updated_at: generatedAt,
    order: 2,
    title: '候補10社 選定完了パック',
    purpose: '10社の役割、点数、数値根拠、注意点を一覧で確認する。',
    file: 'candidate_10_selection_completion_pack_20260526.html',
    status: '公開済み',
  },
  {
    updated_at: generatedAt,
    order: 3,
    title: '候補10社 6月再判定カレンダー',
    purpose: 'CPI・日銀・FOMCと、各銘柄の20営業日反応の確認日を時系列で見る。',
    file: 'candidate_10_june_decision_calendar_20260527.html',
    status: '公開済み',
  },
  {
    updated_at: generatedAt,
    order: 4,
    title: '候補10社 6月判定ルール',
    purpose: '6月イベント後に、残す・下げる・補完待ち・見送りを分ける条件を見る。',
    file: 'candidate_10_june_gate_rules_20260527.html',
    status: '公開済み',
  },
  {
    updated_at: generatedAt,
    order: 5,
    title: '候補10社 次データ確認タスク',
    purpose: '次に埋めるデータ、優先度、反映先を銘柄別に確認する。',
    file: 'candidate_10_next_data_tasks_20260526.html',
    status: '公開済み',
  },
  {
    updated_at: generatedAt,
    order: 6,
    title: '候補10社 作業完了状況',
    purpose: '本日の到達点と未完了項目を短く確認する。',
    file: 'candidate_10_delivery_status_brief_20260526.html',
    status: '公開済み',
  },
];

const statusRows = [
  {
    updated_at: generatedAt,
    item: '候補10社説明準備',
    status: '完了',
    detail: '10社の役割分け、説明文、注意点、次の確認条件を作成済み。',
  },
  {
    updated_at: generatedAt,
    item: '6月再判定準備',
    status: '完了',
    detail: '市場イベント、銘柄反応、判定ルールを作成済み。',
  },
  {
    updated_at: generatedAt,
    item: '投資実行判断',
    status: '未実施',
    detail: '6月イベント結果と未来日到達データの更新後に再判定する。',
  },
];

writeCsv('549_candidate_10_delivery_hub_links.csv', hubRows, [
  'updated_at',
  'order',
  'title',
  'purpose',
  'file',
  'status',
]);

writeCsv('550_candidate_10_delivery_hub_status.csv', statusRows, [
  'updated_at',
  'item',
  'status',
  'detail',
]);

const cards = hubRows.map((row) => `
  <article class="card">
    <div class="num">${esc(row.order)}</div>
    <div>
      <h3>${esc(row.title)}</h3>
      <p>${esc(row.purpose)}</p>
      <a class="button" href="${esc(row.file)}">開く</a>
    </div>
  </article>`).join('');

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 納品資料ハブ 2026年5月27日</title>
  <style>
    :root { --ink:#061a33; --muted:#334155; --line:#c9d9ea; --bg:#f4f8fc; --navy:#0d3658; --blue:#0b6fa4; --soft:#eef7ff; --green:#0f766e; --amber:#b45309; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; background:var(--bg); color:var(--ink); line-height:1.72; letter-spacing:0; }
    header { background:var(--navy); color:#fff; padding:34px clamp(18px,4vw,58px); }
    h1 { margin:0 0 8px; font-size:clamp(28px,4vw,42px); letter-spacing:0; }
    header p { margin:0; color:#fff; font-weight:800; max-width:1120px; }
    main { width:min(1160px, calc(100% - 32px)); margin:24px auto 56px; }
    section { background:#fff; border:1px solid var(--line); border-radius:8px; padding:22px; margin:18px 0; break-inside:avoid; }
    h2 { margin:0 0 14px; padding-left:12px; border-left:8px solid var(--blue); font-size:24px; }
    .notice { border-left:8px solid var(--amber); background:#fff7ed; padding:14px; border-radius:8px; font-weight:900; color:#111827; }
    .cards { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
    .card { display:grid; grid-template-columns:52px 1fr; gap:12px; border:1px solid var(--line); border-radius:8px; padding:16px; background:var(--soft); }
    .num { width:44px; height:44px; border-radius:50%; background:var(--blue); color:#fff; display:grid; place-items:center; font-weight:900; font-size:20px; }
    h3 { margin:0 0 6px; font-size:19px; color:var(--navy); }
    p { margin:0 0 10px; }
    .button { display:inline-flex; align-items:center; min-height:36px; padding:8px 12px; border-radius:8px; border:1px solid #9cc8ec; background:#fff; color:var(--navy); text-decoration:none; font-weight:900; font-size:13px; }
    .toolbar { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:8px; }
    table { width:100%; min-width:840px; border-collapse:collapse; table-layout:fixed; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:9px; vertical-align:top; text-align:left; overflow-wrap:anywhere; word-break:break-word; color:#061a33; }
    th { background:#e6f1fb; color:#073b63; font-weight:900; }
    a { color:#0b5cab; font-weight:900; }
    tr:last-child td { border-bottom:0; }
    th:last-child,td:last-child { border-right:0; }
    @media (max-width:780px) { main { width:min(100% - 20px,1160px); } section { padding:16px; } .cards { grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <header>
    <h1>候補10社 納品資料ハブ</h1>
    <p>顧客へ見せる順番で、候補10社の説明資料・6月カレンダー・判定ルールをまとめた入口です。</p>
  </header>
  <main>
    <section>
      <h2>見る順番</h2>
      <p class="notice">最初は「候補10社 顧客向け説明整理」から開き、必要に応じてカレンダーと判定ルールへ進みます。</p>
      <div class="cards">${cards}</div>
      <div class="toolbar">
        <a class="button" href="549_candidate_10_delivery_hub_links.csv">549 リンクCSV</a>
        <a class="button" href="550_candidate_10_delivery_hub_status.csv">550 状況CSV</a>
        <a class="button" href="index.html">メインページへ</a>
      </div>
    </section>
    <section>
      <h2>現在の状態</h2>
      ${table(
        [
          { key: 'item', label: '項目' },
          { key: 'status', label: '状態' },
          { key: 'detail', label: '内容' },
        ],
        statusRows,
      )}
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_delivery_hub_20260527.html'), html, 'utf8');

console.log('created candidate_10_delivery_hub_20260527.html');
