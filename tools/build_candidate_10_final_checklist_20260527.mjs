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

function priority(row) {
  if (row.selection_level.startsWith('第1層')) return '最優先確認';
  if (row.selection_level.startsWith('第2層')) return '条件付き確認';
  if (row.selection_level.startsWith('第3層')) return '比較・観察';
  if (row.selection_level.startsWith('第4層')) return 'データ補完';
  return '仮説検算';
}

function nextAction(row) {
  const p = priority(row);
  if (p === '最優先確認') return '公式決算・PER/PBR/ROE・20営業日反応を先に補完し、6月再判定の中心に置く。';
  if (p === '条件付き確認') return 'テーマ接続は維持しつつ、割高感・指数劣後・下方修正の有無を確認する。';
  if (p === '比較・観察') return '中心候補とは分け、同業比較とテーマ数字が確認できる場合のみ上げる。';
  if (p === 'データ補完') return '未取得データを先に埋め、点数化できる状態になるまで購入候補扱いにしない。';
  return '構造テーマの仮説を残し、決算後反応と過熱リスクの検算に使う。';
}

const rows = readCsv('575_candidate_10_presentation_brief_detail.csv');
const checklistRows = rows.map((row) => ({
  updated_at: generatedAt,
  rank: row.rank,
  ticker: row.ticker,
  company: row.company,
  priority: priority(row),
  quantitative_score: row.quantitative_score,
  integrated_grade: row.integrated_grade,
  qualitative_themes: row.themes,
  current_reason: row.concise_reason,
  missing_or_check_data: row.first_check,
  stop_or_downgrade_rule: row.stop_rule,
  next_action: nextAction(row),
}));

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '目的',
    detail: '本日選出した10社について、説明時に確認すべき数字と外す条件を1社ごとに明確にする。',
  },
  {
    updated_at: generatedAt,
    item: '扱い',
    detail: '購入対象の確定ではなく、6月再判定に向けた検証対象の管理表として使う。',
  },
  {
    updated_at: generatedAt,
    item: '評価方法',
    detail: '量的評価を主軸にし、質的テーマは確認条件・除外条件として扱う。単純加点はしない。',
  },
  {
    updated_at: generatedAt,
    item: '次工程',
    detail: 'PER/PBR/ROE、決算成長率、決算後反応、同業比較、イベント後の指数比較を補完する。',
  },
];

writeCsv('589_candidate_10_final_checklist_summary.csv', summaryRows, ['updated_at', 'item', 'detail']);
writeCsv('590_candidate_10_final_checklist_detail.csv', checklistRows, [
  'updated_at',
  'rank',
  'ticker',
  'company',
  'priority',
  'quantitative_score',
  'integrated_grade',
  'qualitative_themes',
  'current_reason',
  'missing_or_check_data',
  'stop_or_downgrade_rule',
  'next_action',
]);
writeCsv('591_candidate_10_final_checklist_next_actions.csv', checklistRows.map((row) => ({
  ticker: row.ticker,
  company: row.company,
  priority: row.priority,
  next_action: row.next_action,
})), ['ticker', 'company', 'priority', 'next_action']);

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 最終確認表 2026年5月27日</title>
  <style>
    :root { --ink:#061e38; --line:#cbdff0; --blue:#0b5e94; --bg:#f4f8fb; --soft:#eef7ff; --orange:#b45309; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; line-height:1.65; }
    main { max-width:1240px; margin:0 auto; padding:24px 18px 48px; }
    header { background:#082f53; color:#fff; border-radius:14px; padding:26px; margin-bottom:16px; }
    h1 { margin:0 0 8px; font-size:clamp(26px,4vw,40px); line-height:1.2; }
    h2 { margin:0 0 10px; font-size:22px; border-left:7px solid var(--blue); padding-left:12px; }
    .lead { margin:0; max-width:980px; color:#edf7ff; font-weight:700; }
    section { background:#fff; border:1px solid var(--line); border-radius:12px; box-shadow:0 8px 20px rgba(20,60,90,.08); padding:18px; margin-top:14px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; background:#fff; min-width:900px; }
    .wide table { min-width:1700px; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:9px 11px; vertical-align:top; color:#031f3b; }
    th { background:#e7f2fb; text-align:left; white-space:nowrap; }
    tr:last-child td { border-bottom:0; }
    .note { border:1px solid #f5c77a; border-left:8px solid var(--orange); background:#fff8eb; border-radius:10px; padding:12px 14px; font-weight:700; margin-top:12px; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .actions a { display:inline-flex; align-items:center; justify-content:center; min-height:42px; padding:9px 14px; border-radius:8px; background:var(--blue); color:#fff; text-decoration:none; font-weight:700; }
    @media (max-width:900px) { main { padding:12px 10px 36px; } header,section { padding:16px; } }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>候補10社 最終確認表</h1>
      <p class="lead">10社を説明する際に、各社で確認すべき数字、外す条件、次に行う作業を一覧化した管理表です。</p>
    </header>
    <section>
      <h2>1. この表の位置づけ</h2>
      ${table([
        { key: 'item', label: '項目' },
        { key: 'detail', label: '内容' },
      ], summaryRows)}
      <div class="note">本表は購入対象を確定する資料ではありません。6月再判定に向けて、確認すべき数字を漏らさないための資料です。</div>
    </section>
    <section>
      <h2>2. 10社別の確認事項</h2>
      ${table([
        { key: 'rank', label: '順位' },
        { key: 'ticker', label: '銘柄' },
        { key: 'company', label: '会社名' },
        { key: 'priority', label: '扱い' },
        { key: 'quantitative_score', label: '量的点' },
        { key: 'integrated_grade', label: '統合評価' },
        { key: 'qualitative_themes', label: '質的テーマ' },
        { key: 'current_reason', label: '現時点の根拠' },
        { key: 'missing_or_check_data', label: '追加確認する数字' },
        { key: 'stop_or_downgrade_rule', label: '外す・下げる条件' },
        { key: 'next_action', label: '次の作業' },
      ], checklistRows, 'wide')}
      <div class="actions">
        <a href="590_candidate_10_final_checklist_detail.csv">詳細CSV</a>
        <a href="591_candidate_10_final_checklist_next_actions.csv">次作業CSV</a>
        <a href="today_onepage_summary_20260527.html">1枚要約へ</a>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_final_checklist_20260527.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  rows: checklistRows.length,
  output: 'candidate_10_final_checklist_20260527.html',
}, null, 2));
