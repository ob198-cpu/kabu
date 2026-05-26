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

const candidates = readCsv('590_candidate_10_final_checklist_detail.csv');

const fieldRows = [
  {
    field: 'PER/PBR/ROE',
    purpose: '割高感、資本効率、同業比較を確認する',
    source: '公式決算、有価証券報告書、J-Quants、証券会社画面',
    score_use: '購入候補スコアの質/割安、ハード除外条件',
    priority: '最重要',
    status: '追加取得',
    deadline: '5/27中',
  },
  {
    field: '売上成長率・営業利益成長率',
    purpose: '決算成長率が本当に続いているか確認する',
    source: '決算短信、決算説明資料、会社IR',
    score_use: '量的スコアの成長項目',
    priority: '最重要',
    status: '追加取得',
    deadline: '5/27中',
  },
  {
    field: '決算後1日/5日/20営業日反応',
    purpose: '良い決算が株価に反映されたか、指数に負けていないか確認する',
    source: 'Yahoo Finance chart API、日経平均/TOPIX比較',
    score_use: '決算後反応スコア、中心候補から外す条件',
    priority: '最重要',
    status: '追加取得',
    deadline: '5/27中',
  },
  {
    field: '同業比較',
    purpose: 'PERやROEを業種差込みで評価し、単純比較の誤差を減らす',
    source: '同業候補表、公式決算、J-Quants、証券会社画面',
    score_use: '業種別補正、割高判定',
    priority: '高',
    status: '追加取得',
    deadline: '5/28午前',
  },
  {
    field: '質的テーマ確認数字',
    purpose: 'AI半導体、金利、食品値上げ、冷却などのテーマが売上・利益に接続するか確認する',
    source: '会社IR、決算説明資料、業界統計、公式統計',
    score_use: '単純加点せず、確認条件・除外条件に使用',
    priority: '高',
    status: '追加取得',
    deadline: '5/28午前',
  },
  {
    field: '6月イベント後の市場条件',
    purpose: 'CPI、日銀、FOMC後の金利・為替・指数の状態を反映する',
    source: 'FRED、日銀、FRB、Yahoo Finance chart API',
    score_use: '6月再判定ゲート',
    priority: '最重要',
    status: '6月入力',
    deadline: '6月イベント後',
  },
];

function companyFieldPlan(row, field) {
  if (field.field === '質的テーマ確認数字') return row.missing_or_check_data;
  if (field.field === '決算後1日/5日/20営業日反応') return '決算日後の対日経平均/TOPIX超過リターンを確認';
  if (field.field === '同業比較') return `${row.company}と同業2-5社でPER/PBR/ROEと成長率を比較`;
  if (field.field === '6月イベント後の市場条件') return '米CPI・日銀・FOMC後に市場条件を再入力';
  return '公式決算・証券会社画面で数値を補完';
}

const matrixRows = [];
for (const row of candidates) {
  for (const field of fieldRows) {
    matrixRows.push({
      updated_at: generatedAt,
      rank: row.rank,
      ticker: row.ticker,
      company: row.company,
      priority_bucket: row.priority,
      required_field: field.field,
      need_level: field.priority,
      current_status: field.status,
      planned_source: field.source,
      purpose: field.purpose,
      score_use: field.score_use,
      company_specific_check: companyFieldPlan(row, field),
      deadline: field.deadline,
    });
  }
}

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '対象',
    detail: `候補10社 × 必要データ${fieldRows.length}項目 = ${matrixRows.length}件の確認タスク`,
  },
  {
    updated_at: generatedAt,
    item: '優先順位',
    detail: 'PER/PBR/ROE、成長率、決算後反応を先に埋める。質的テーマは数字に接続できるものだけ残す。',
  },
  {
    updated_at: generatedAt,
    item: '本日の到達点',
    detail: '10社の不足データと取得元、スコアへの使い道、期限を一覧化した。',
  },
  {
    updated_at: generatedAt,
    item: '次の作業',
    detail: '最優先確認と条件付き確認の4社から数値補完し、残り6社を比較・補完・検算として順に確認する。',
  },
];

writeCsv('592_candidate_10_data_completion_summary.csv', summaryRows, ['updated_at', 'item', 'detail']);
writeCsv('593_candidate_10_required_fields.csv', fieldRows, [
  'field',
  'purpose',
  'source',
  'score_use',
  'priority',
  'status',
  'deadline',
]);
writeCsv('594_candidate_10_data_completion_matrix.csv', matrixRows, [
  'updated_at',
  'rank',
  'ticker',
  'company',
  'priority_bucket',
  'required_field',
  'need_level',
  'current_status',
  'planned_source',
  'purpose',
  'score_use',
  'company_specific_check',
  'deadline',
]);

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 データ補完作業表 2026年5月27日</title>
  <style>
    :root { --ink:#061e38; --line:#cbdff0; --blue:#0b5e94; --bg:#f4f8fb; --orange:#b45309; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; line-height:1.65; }
    main { max-width:1280px; margin:0 auto; padding:24px 18px 48px; }
    header { background:#082f53; color:#fff; border-radius:14px; padding:26px; margin-bottom:16px; }
    h1 { margin:0 0 8px; font-size:clamp(26px,4vw,40px); line-height:1.2; }
    h2 { margin:0 0 10px; font-size:22px; border-left:7px solid var(--blue); padding-left:12px; }
    .lead { margin:0; max-width:1000px; color:#edf7ff; font-weight:700; }
    section { background:#fff; border:1px solid var(--line); border-radius:12px; box-shadow:0 8px 20px rgba(20,60,90,.08); padding:18px; margin-top:14px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; background:#fff; min-width:900px; }
    .wide table { min-width:1800px; }
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
      <h1>候補10社 データ補完作業表</h1>
      <p class="lead">明日までに根拠付きで10社を説明するため、必要データ、取得元、スコアへの使い道、期限を整理した作業表です。</p>
    </header>
    <section>
      <h2>1. 概要</h2>
      ${table([
        { key: 'item', label: '項目' },
        { key: 'detail', label: '内容' },
      ], summaryRows)}
      <div class="note">取得できていないデータを点数に混ぜません。取得できた数字だけをスコアに使い、未取得分は確認タスクとして残します。</div>
    </section>
    <section>
      <h2>2. 必要データ項目</h2>
      ${table([
        { key: 'field', label: 'データ' },
        { key: 'purpose', label: '目的' },
        { key: 'source', label: '取得元候補' },
        { key: 'score_use', label: 'スコアでの使い道' },
        { key: 'priority', label: '必要度' },
        { key: 'status', label: '状態' },
        { key: 'deadline', label: '期限' },
      ], fieldRows)}
    </section>
    <section>
      <h2>3. 10社別 データ補完マトリクス</h2>
      ${table([
        { key: 'rank', label: '順位' },
        { key: 'ticker', label: '銘柄' },
        { key: 'company', label: '会社名' },
        { key: 'priority_bucket', label: '扱い' },
        { key: 'required_field', label: '必要データ' },
        { key: 'need_level', label: '必要度' },
        { key: 'current_status', label: '状態' },
        { key: 'planned_source', label: '取得元候補' },
        { key: 'score_use', label: '使い道' },
        { key: 'company_specific_check', label: '会社別確認' },
        { key: 'deadline', label: '期限' },
      ], matrixRows, 'wide')}
      <div class="actions">
        <a href="592_candidate_10_data_completion_summary.csv">概要CSV</a>
        <a href="593_candidate_10_required_fields.csv">必要項目CSV</a>
        <a href="594_candidate_10_data_completion_matrix.csv">補完マトリクスCSV</a>
        <a href="candidate_10_final_checklist_20260527.html">10社確認表へ</a>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_data_completion_board_20260527.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  candidates: candidates.length,
  fields: fieldRows.length,
  tasks: matrixRows.length,
  output: 'candidate_10_data_completion_board_20260527.html',
}, null, 2));
