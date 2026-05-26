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

function byTicker(rows) {
  return new Map(rows.map((row) => [row.ticker, row]));
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

function roleComment(role) {
  if (role === '主候補') return '現時点で説明優先。6月イベント後に購入候補として再判定する。';
  if (role === '比較枠') return '候補から外さず、主候補と比較して優位性が出るか確認する。';
  if (role === '反応待ち') return '決算後反応が短すぎるため、5営業日・20営業日を確認してから扱いを決める。';
  if (role === '補完待ち') return 'PERや同業比較など、説明に必要な数値の補完後に再判定する。';
  if (role === '検算枠') return 'テーマ性はあるが、株価反応が弱いため原因検算を優先する。';
  return '確認中。';
}

function shortReason(row) {
  return [
    `評価${row.grade}`,
    `点数${row.score}`,
    `量的評価${row.quantitative_grade}`,
    `信頼度${row.data_confidence}`,
    row.reaction_note,
  ].filter(Boolean).join(' / ');
}

const detail = readCsv('534_candidate_10_selection_completion_detail.csv');
const qualitative = byTicker(readCsv('521_candidate_10_qualitative_validation_checklist.csv'));

const clientRows = detail.map((row) => {
  const q = qualitative.get(row.ticker) || {};
  return {
    updated_at: generatedAt,
    rank: row.rank,
    ticker: row.ticker,
    company: row.company,
    sector: row.sector,
    role: row.test_role,
    score: row.score,
    grade: row.grade,
    quantitative_grade: row.quantitative_grade,
    confidence: row.data_confidence,
    numeric_basis: shortReason(row),
    qualitative_driver: q.qualitative_driver || '確認中',
    confirmation: q.required_confirmation || row.next_action,
    reject_condition: q.reject_condition || row.risk_note,
    role_comment: roleComment(row.test_role),
    client_explanation: `${row.company}は${row.test_role}として扱う。${shortReason(row)}。質的材料は「${q.qualitative_driver || '確認中'}」だが、単独加点せず、確認条件を満たすかで判断する。`,
    next_action: row.next_action,
    june_treatment: row.june_treatment,
    treatment: 'NISA 1年保有テスト候補の説明整理。投資実行判断ではない。',
  };
});

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '現在の到達点',
    value: '10社を役割分け',
    meaning: '主候補3社、比較枠3社、反応待ち1社、補完待ち2社、検算枠1社に分類。',
  },
  {
    updated_at: generatedAt,
    item: '主候補',
    value: 'TDK / 三井住友FG / 味の素',
    meaning: '現時点で数値根拠と説明の整合性が比較的高い3社。',
  },
  {
    updated_at: generatedAt,
    item: '重要な修正',
    value: '質的材料は単独加点しない',
    meaning: '時流・イベント仮説は、確認条件と除外条件で扱う。',
  },
  {
    updated_at: generatedAt,
    item: '次の判定',
    value: '6月イベント後',
    meaning: 'CPI、日銀、FOMC、20営業日反応を更新して再判定。',
  },
];

const messageRows = [
  {
    type: '説明文',
    text: 'NISA 1年保有テストに向けて、候補10社を同じ意味の候補として扱わず、主候補・比較枠・反応待ち・補完待ち・検算枠に分けました。',
  },
  {
    type: '説明文',
    text: '現時点では、TDK、三井住友FG、味の素を主候補として説明できる状態にしています。ただし、購入確定ではなく、6月の市場イベントと20営業日反応を確認して再判定します。',
  },
  {
    type: '説明文',
    text: '時流やイベント材料は、点数へ単純加点せず、実際の数字や会社コメントで確認する条件として整理しています。',
  },
];

writeCsv('539_candidate_10_client_explanation_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'meaning',
]);

writeCsv('540_candidate_10_client_explanation_detail.csv', clientRows, [
  'updated_at',
  'rank',
  'ticker',
  'company',
  'sector',
  'role',
  'score',
  'grade',
  'quantitative_grade',
  'confidence',
  'numeric_basis',
  'qualitative_driver',
  'confirmation',
  'reject_condition',
  'role_comment',
  'client_explanation',
  'next_action',
  'june_treatment',
  'treatment',
]);

writeCsv('541_candidate_10_client_explanation_message.csv', messageRows, [
  'type',
  'text',
]);

function table(headers, rows, className = '') {
  return `
    <div class="table-wrap ${className}">
      <table>
        <thead><tr>${headers.map((header) => `<th>${esc(header.label)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows.map((row) => `<tr>${headers.map((header) => `<td>${esc(row[header.key])}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function roleBlock(role) {
  const rows = clientRows.filter((row) => row.role === role);
  return `
    <section>
      <h2>${esc(role)}</h2>
      ${table(
        [
          { key: 'rank', label: '順位' },
          { key: 'ticker', label: 'コード' },
          { key: 'company', label: '銘柄' },
          { key: 'score', label: '点数' },
          { key: 'numeric_basis', label: '数値根拠' },
          { key: 'qualitative_driver', label: '質的材料' },
          { key: 'confirmation', label: '確認条件' },
          { key: 'reject_condition', label: '外す条件' },
          { key: 'role_comment', label: '扱い' },
        ],
        rows,
      )}
    </section>`;
}

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 顧客向け説明整理 2026年5月27日</title>
  <style>
    :root { --ink:#061a33; --muted:#334155; --line:#c9d9ea; --bg:#f4f8fc; --navy:#0d3658; --blue:#0b6fa4; --soft:#eef7ff; --green:#0f766e; --amber:#b45309; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; background:var(--bg); color:var(--ink); line-height:1.72; letter-spacing:0; }
    header { background:var(--navy); color:#fff; padding:34px clamp(18px,4vw,58px); }
    h1 { margin:0 0 8px; font-size:clamp(28px,4vw,42px); letter-spacing:0; }
    header p { margin:0; color:#fff; font-weight:800; max-width:1120px; }
    main { width:min(1260px, calc(100% - 32px)); margin:24px auto 56px; }
    section { background:#fff; border:1px solid var(--line); border-radius:8px; padding:22px; margin:18px 0; break-inside:avoid; }
    h2 { margin:0 0 14px; padding-left:12px; border-left:8px solid var(--blue); font-size:24px; }
    .summary { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .metric { border:1px solid var(--line); border-radius:8px; padding:14px; background:var(--soft); min-height:126px; }
    .metric span { display:block; color:var(--muted); font-weight:900; }
    .metric strong { display:block; color:var(--blue); font-size:22px; line-height:1.35; }
    .notice { border-left:8px solid var(--amber); background:#fff7ed; padding:14px; border-radius:8px; font-weight:900; color:#111827; }
    .toolbar { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .button { display:inline-flex; align-items:center; min-height:38px; padding:8px 12px; border-radius:8px; border:1px solid #9cc8ec; background:#fff; color:var(--navy); text-decoration:none; font-weight:900; font-size:13px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:8px; }
    table { width:100%; min-width:1180px; border-collapse:collapse; table-layout:fixed; }
    .message table { min-width:720px; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:9px; vertical-align:top; text-align:left; overflow-wrap:anywhere; word-break:break-word; color:#061a33; }
    th { background:#e6f1fb; color:#073b63; font-weight:900; }
    tr:last-child td { border-bottom:0; }
    th:last-child,td:last-child { border-right:0; }
    @media (max-width:1000px) { .summary { grid-template-columns:repeat(2,minmax(0,1fr)); } }
    @media (max-width:680px) { main { width:min(100% - 20px,1260px); } .summary { grid-template-columns:1fr; } section { padding:16px; } }
  </style>
</head>
<body>
  <header>
    <h1>候補10社 顧客向け説明整理</h1>
    <p>候補10社を、数値根拠・質的材料・確認条件・外す条件に分けて説明するための資料です。</p>
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
      <p class="notice">この資料はNISA 1年保有テスト候補の説明整理です。投資実行判断ではありません。</p>
      <div class="toolbar">
        <a class="button" href="539_candidate_10_client_explanation_summary.csv">539 要約CSV</a>
        <a class="button" href="540_candidate_10_client_explanation_detail.csv">540 詳細CSV</a>
        <a class="button" href="541_candidate_10_client_explanation_message.csv">541 説明文CSV</a>
        <a class="button" href="candidate_10_selection_completion_pack_20260526.html">選定完了パックへ</a>
        <a class="button" href="index.html">メインページへ</a>
      </div>
    </section>

    <section class="message">
      <h2>説明文</h2>
      ${table(
        [
          { key: 'type', label: '区分' },
          { key: 'text', label: '文面' },
        ],
        messageRows,
        'message',
      )}
    </section>

    ${['主候補', '比較枠', '反応待ち', '補完待ち', '検算枠'].map(roleBlock).join('\n')}
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_client_explanation_20260527.html'), html, 'utf8');

console.log(`created candidate_10_client_explanation_20260527.html rows=${clientRows.length}`);
