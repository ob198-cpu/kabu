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
        <tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${esc(row[header.key])}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>`;
}

const detailRows = readCsv('575_candidate_10_presentation_brief_detail.csv');
const topRows = detailRows.filter((row) => row.selection_level.startsWith('第1層') || row.selection_level.startsWith('第2層'));

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '本日の結論',
    value: '10社を検証対象として整理',
    detail: '購入対象の確定ではなく、6月再判定に向けて量的評価と質的確認条件を分けて説明できる状態にした。',
  },
  {
    updated_at: generatedAt,
    item: '最優先確認',
    value: 'TDK',
    detail: '量的評価A、質的評価A。AI半導体、HBM、電子部品、円安感応を確認する優先度が高い。',
  },
  {
    updated_at: generatedAt,
    item: '条件付き確認',
    value: '三井住友FG、味の素、東京海上HD',
    detail: 'テーマ接続はあるが、公式数字、20営業日反応、指数比較、割高感の追加確認が必要。',
  },
  {
    updated_at: generatedAt,
    item: '説明上の注意',
    value: '質的テーマは非加点',
    detail: '時流テーマは点数へ単純加算せず、確認条件、通過条件、除外条件として扱う。',
  },
];

const actionRows = [
  {
    period: '本日',
    action: '10社の検証対象と説明根拠を提示',
    check: '最優先確認、条件付き確認、比較・補完・検算の役割を分けて説明する。',
  },
  {
    period: '5月中',
    action: '不足データ補完',
    check: '公式決算値、PER/PBR/ROE、20営業日反応、テーマ別確認数字を補完する。',
  },
  {
    period: '6月イベント後',
    action: '再判定',
    check: '米CPI、日銀、FOMC後に、残す・下げる・外すを再分類する。',
  },
  {
    period: '購入検討前',
    action: '証券会社画面・最新決算・市場条件を再確認',
    check: '本資料のみで投資実行判断を行わず、直近数値と市場イベント結果で確認する。',
  },
];

writeCsv('586_today_onepage_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'detail',
]);

writeCsv('587_today_onepage_top_candidates.csv', topRows, [
  'rank',
  'ticker',
  'company',
  'selection_level',
  'presentation_decision',
  'quantitative_score',
  'integrated_grade',
  'themes',
  'concise_reason',
  'first_check',
  'stop_rule',
]);

writeCsv('588_today_onepage_actions.csv', actionRows, [
  'period',
  'action',
  'check',
]);

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>本日説明 1枚要約 2026年5月27日</title>
  <style>
    :root { --ink:#061e38; --muted:#334155; --line:#cbdff0; --blue:#0b5e94; --bg:#f4f8fb; --soft:#eef7ff; --orange:#b45309; --green:#0c7a43; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; line-height:1.65; }
    main { max-width:1180px; margin:0 auto; padding:24px 18px 48px; }
    header { background:#082f53; color:#fff; border-radius:14px; padding:26px; margin-bottom:16px; }
    h1 { margin:0 0 8px; font-size:clamp(26px,4vw,40px); line-height:1.2; }
    h2 { margin:0 0 10px; font-size:22px; border-left:7px solid var(--blue); padding-left:12px; }
    .lead { margin:0; max-width:920px; color:#edf7ff; font-weight:700; }
    section,.card { background:#fff; border:1px solid var(--line); border-radius:12px; box-shadow:0 8px 20px rgba(20,60,90,.08); }
    section { padding:18px; margin-top:14px; }
    .cards { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin:14px 0; }
    .card { padding:14px; }
    .card small { display:block; color:var(--muted); font-weight:700; }
    .card b { display:block; font-size:24px; margin-top:4px; }
    .note { border:1px solid #f5c77a; border-left:8px solid var(--orange); background:#fff8eb; border-radius:10px; padding:12px 14px; font-weight:700; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; background:#fff; min-width:900px; }
    .wide table { min-width:1460px; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:9px 11px; vertical-align:top; color:#031f3b; }
    th { background:#e7f2fb; text-align:left; white-space:nowrap; }
    tr:last-child td { border-bottom:0; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .actions a { display:inline-flex; align-items:center; justify-content:center; min-height:42px; padding:9px 14px; border-radius:8px; background:var(--blue); color:#fff; text-decoration:none; font-weight:700; }
    .actions a.secondary { background:#fff; color:var(--blue); border:1px solid var(--line); }
    @media print {
      body { background:#fff; }
      main { max-width:none; padding:0; }
      header,section,.card { box-shadow:none; break-inside:avoid; }
      .actions { display:none; }
    }
    @media (max-width:900px) { .cards { grid-template-columns:1fr; } main { padding:12px 10px 36px; } header,section { padding:16px; } }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>本日説明 1枚要約</h1>
      <p class="lead">NISA 1年保有テストに向けた検証対象10社の選出根拠を、最初に確認するための要約です。</p>
    </header>

    <div class="cards">
      <div class="card"><small>本日選出</small><b>10社</b></div>
      <div class="card"><small>最優先確認</small><b>TDK</b></div>
      <div class="card"><small>条件付き確認</small><b>3社</b></div>
      <div class="card"><small>本日の扱い</small><b>検証対象</b></div>
    </div>

    <section>
      <h2>1. 結論</h2>
      ${table([
        { key: 'item', label: '項目' },
        { key: 'value', label: '内容' },
        { key: 'detail', label: '説明' },
      ], summaryRows)}
      <div class="note">10社を購入対象として確定する資料ではありません。6月再判定に向けた検証対象の選出資料です。</div>
    </section>

    <section>
      <h2>2. 前に置く4社</h2>
      ${table([
        { key: 'rank', label: '順位' },
        { key: 'ticker', label: '銘柄' },
        { key: 'company', label: '会社名' },
        { key: 'selection_level', label: '層' },
        { key: 'quantitative_score', label: '量的点' },
        { key: 'integrated_grade', label: '統合評価' },
        { key: 'themes', label: '質的テーマ' },
        { key: 'concise_reason', label: '根拠' },
        { key: 'first_check', label: '確認数字' },
        { key: 'stop_rule', label: '外す条件' },
      ], topRows, 'wide')}
    </section>

    <section>
      <h2>3. 次の進め方</h2>
      ${table([
        { key: 'period', label: '時期' },
        { key: 'action', label: '作業' },
        { key: 'check', label: '確認内容' },
      ], actionRows)}
      <div class="actions">
        <a href="today_presentation_hub_20260527.html">説明資料ハブへ</a>
        <a href="586_today_onepage_summary.csv">要約CSV</a>
        <a href="587_today_onepage_top_candidates.csv">候補CSV</a>
        <a href="588_today_onepage_actions.csv">次工程CSV</a>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'today_onepage_summary_20260527.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  topRows: topRows.length,
  output: 'today_onepage_summary_20260527.html',
}, null, 2));
