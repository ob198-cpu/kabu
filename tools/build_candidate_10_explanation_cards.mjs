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

function byTicker(rows) {
  return new Map(rows.map((row) => [row.ticker, row]));
}

function splitItems(value) {
  return String(value || '')
    .split(/\s*\/\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function metricSentence(row) {
  const items = [
    `PER ${row.per}`,
    `PBR ${row.pbr}`,
    `ROE ${row.roe_pct}`,
    `売上成長 ${row.revenue_yoy_pct}`,
    `利益成長 ${row.profit_yoy_pct}`,
  ];
  return items.join('、');
}

function priorityReason(row, quant, qual) {
  if (row.current_role === '最初に確認') {
    return `現時点の10社内で量的評価が最も高く、データ信頼度も高いため、最初に確認する候補です。`;
  }
  if (row.current_role === '補完後に確認') {
    return `量的条件は候補として確認する価値がありますが、決算後反応、同業比較、イベント因果のいずれかを補ってから判断します。`;
  }
  if (row.current_role === '補完優先') {
    return `時流との関係はありますが、未完了項目が多いため、補完が進んだ場合に候補として扱います。`;
  }
  return `点数だけでは候補に見える部分がありますが、未完了項目が多いため、現時点では比較対象として残します。`;
}

function tomorrowCheck(row) {
  const checks = [];
  const remaining = row.remaining_check || '';
  if (remaining.includes('財務指標')) checks.push('PERなど不足する財務指標を公式IR、EDINET、J-Quants等で確認');
  if (remaining.includes('業種別補正')) checks.push('同業2社以上のPER/PBR/ROE中央値を確認');
  if (remaining.includes('決算後反応')) checks.push('決算後1日、5日、20日の対ベンチマーク超過リターンを確認');
  if (remaining.includes('イベント因果')) checks.push('質的仮説に対応するイベント日と株価反応を確認');
  if (!checks.length) checks.push('6月イベント後に市場環境を再確認');
  return checks.join(' / ');
}

function gateCondition(row) {
  const remaining = row.remaining_check || '';
  const conditions = [];
  conditions.push('6月のCPI、FOMC、日銀後の市場環境を確認');
  if (remaining.includes('財務指標')) conditions.push('不足財務指標が取得できない場合は候補順位を下げる');
  if (remaining.includes('業種別補正')) conditions.push('同業比較が成立しない場合は割安判断を保留');
  if (remaining.includes('イベント因果')) conditions.push('イベント反応が弱い場合は時流根拠を外す');
  return conditions.join(' / ');
}

const selectionRows = readCsv('468_candidate_10_selection_decision.csv');
const quantitativeRows = readCsv('466_candidate_10_quantitative_evidence.csv');
const qualitativeRows = readCsv('467_candidate_10_qualitative_evidence.csv');

const quantByTicker = byTicker(quantitativeRows);
const qualByTicker = byTicker(qualitativeRows);

const cardRows = selectionRows.map((row) => {
  const quant = quantByTicker.get(row.ticker) || {};
  const qual = qualByTicker.get(row.ticker) || {};
  const themes = splitItems(qual.qualitative_themes);
  return {
    updated_at: generatedAt,
    selection_rank: row.selection_rank,
    ticker: row.ticker,
    company: row.company,
    current_role: row.current_role,
    quantitative_grade: row.quantitative_grade,
    qualitative_status: row.qualitative_status,
    numeric_basis: metricSentence(quant),
    qualitative_basis: themes.join(' / '),
    selection_basis: priorityReason(row, quant, qual),
    unfinished_items: row.remaining_check,
    tomorrow_check: tomorrowCheck(row),
    june_gate_condition: gateCondition(row),
    current_decision: 'テスト候補の確認対象。購入判断ではない',
  };
});

const checklistRows = cardRows.flatMap((row) =>
  splitItems(row.tomorrow_check).map((task, index) => ({
    updated_at: generatedAt,
    ticker: row.ticker,
    company: row.company,
    task_no: index + 1,
    task,
    expected_output: task.includes('財務')
      ? '不足財務指標の採用可否'
      : task.includes('同業')
        ? '同業中央値の成立可否'
        : task.includes('決算後')
          ? 'イベント後リターン判定'
          : '質的仮説の実績確認',
    score_policy: '確認後に採用可否を判定。未確認のまま加点しない',
  })),
);

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '説明カード',
    value: `${cardRows.length}社`,
    interpretation: '候補10社について、数値根拠、時流仮説、未完了項目を銘柄別に整理。',
  },
  {
    updated_at: generatedAt,
    item: '明日確認する作業',
    value: `${checklistRows.length}件`,
    interpretation: '不足指標、同業比較、決算後反応、イベント因果を銘柄別に確認。',
  },
  {
    updated_at: generatedAt,
    item: '質的情報',
    value: '未加点',
    interpretation: '実績確認前は、調査理由として扱い、点数には加えない。',
  },
  {
    updated_at: generatedAt,
    item: '購入判断',
    value: '0社',
    interpretation: '6月イベント後の再判定前のため、購入判断ではない。',
  },
];

writeCsv('470_candidate_10_explanation_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'interpretation',
]);

writeCsv('471_candidate_10_explanation_cards.csv', cardRows, [
  'updated_at',
  'selection_rank',
  'ticker',
  'company',
  'current_role',
  'quantitative_grade',
  'qualitative_status',
  'numeric_basis',
  'qualitative_basis',
  'selection_basis',
  'unfinished_items',
  'tomorrow_check',
  'june_gate_condition',
  'current_decision',
]);

writeCsv('472_candidate_10_tomorrow_checklist.csv', checklistRows, [
  'updated_at',
  'ticker',
  'company',
  'task_no',
  'task',
  'expected_output',
  'score_policy',
]);

const gateRows = cardRows.map((row) => ({
  updated_at: generatedAt,
  ticker: row.ticker,
  company: row.company,
  keep_condition: row.june_gate_condition,
  hold_condition: '不足データが残る、またはイベント反応が弱い場合は保留',
  remove_condition: '不足データが重大、または量的条件と質的仮説が矛盾する場合は候補から外す',
  current_decision: '購入判断ではない',
}));

writeCsv('473_candidate_10_june_gate_by_ticker.csv', gateRows, [
  'updated_at',
  'ticker',
  'company',
  'keep_condition',
  'hold_condition',
  'remove_condition',
  'current_decision',
]);

function table(headers, rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map((header) => `<th>${esc(header.label)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>${headers.map((header) => `<td>${esc(row[header.key])}</td>`).join('')}</tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

const cardHtml = cardRows
  .map(
    (row) => `
      <article class="card">
        <div class="card-head">
          <span class="rank">${esc(row.selection_rank)}</span>
          <div>
            <h3>${esc(row.ticker)} ${esc(row.company)}</h3>
            <p>${esc(row.current_role)} / 量的評価 ${esc(row.quantitative_grade)} / ${esc(row.qualitative_status)}</p>
          </div>
        </div>
        <dl>
          <dt>数値根拠</dt>
          <dd>${esc(row.numeric_basis)}</dd>
          <dt>時流・イベント仮説</dt>
          <dd>${esc(row.qualitative_basis)}</dd>
          <dt>候補として確認する理由</dt>
          <dd>${esc(row.selection_basis)}</dd>
          <dt>未完了項目</dt>
          <dd>${esc(row.unfinished_items)}</dd>
          <dt>明日の確認</dt>
          <dd>${esc(row.tomorrow_check)}</dd>
          <dt>現在の扱い</dt>
          <dd>${esc(row.current_decision)}</dd>
        </dl>
      </article>
    `,
  )
  .join('');

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 銘柄別説明カード</title>
  <style>
    :root {
      --ink: #111827;
      --muted: #4b5563;
      --line: #cfdced;
      --bg: #f5f8fc;
      --panel: #ffffff;
      --navy: #113a5c;
      --blue: #176da3;
      --yellow: #fff7d6;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Yu Gothic", "Meiryo", Arial, sans-serif;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.75;
      letter-spacing: 0;
    }
    main { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 56px; }
    .hero {
      background: var(--navy);
      color: white;
      border-radius: 18px;
      padding: 26px;
      margin-bottom: 18px;
    }
    h1 { font-size: clamp(26px, 4vw, 42px); line-height: 1.2; margin: 0 0 10px; letter-spacing: 0; }
    h2 { font-size: 24px; color: var(--navy); margin: 0 0 10px; letter-spacing: 0; }
    h3 { margin: 0; font-size: 19px; color: var(--navy); letter-spacing: 0; }
    p { margin: 0 0 12px; }
    .hero p { color: #e8f4ff; }
    .notice {
      border: 2px solid #f0c36c;
      background: var(--yellow);
      border-radius: 14px;
      padding: 14px 16px;
      font-weight: 800;
      color: #5f3900;
      margin-bottom: 16px;
    }
    .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 16px; }
    .kpi { background: white; color: var(--ink); border: 1px solid #c9def3; border-radius: 12px; padding: 12px; }
    .kpi b { display: block; color: var(--blue); font-size: 28px; line-height: 1; }
    .kpi span { display: block; color: var(--muted); font-size: 12px; margin-top: 5px; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      padding: 8px 12px;
      border-radius: 10px;
      border: 1px solid #9dc7e8;
      background: #fff;
      color: var(--navy);
      text-decoration: none;
      font-weight: 800;
    }
    .cards {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 16px;
      box-shadow: 0 8px 20px rgba(20, 57, 91, .06);
    }
    .card-head {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 10px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--line);
    }
    .rank {
      display: inline-flex;
      width: 34px;
      height: 34px;
      align-items: center;
      justify-content: center;
      border-radius: 999px;
      background: #e8f4ff;
      color: var(--navy);
      font-weight: 900;
      flex: 0 0 auto;
    }
    .card-head p { margin: 3px 0 0; color: var(--muted); font-weight: 700; }
    dl { margin: 0; display: grid; gap: 8px; }
    dt { font-weight: 900; color: var(--navy); }
    dd { margin: -6px 0 0; }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 18px;
      margin: 16px 0;
      box-shadow: 0 8px 20px rgba(20, 57, 91, .06);
    }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; }
    table { width: 100%; min-width: 920px; border-collapse: collapse; table-layout: fixed; background: white; }
    th, td {
      border-bottom: 1px solid var(--line);
      border-right: 1px solid var(--line);
      padding: 9px 10px;
      vertical-align: top;
      text-align: left;
      overflow-wrap: anywhere;
      word-break: break-word;
      color: var(--ink);
    }
    th { background: #e8f4ff; color: #073b63; font-weight: 800; }
    tr:last-child td { border-bottom: 0; }
    th:last-child, td:last-child { border-right: 0; }
    @media (max-width: 900px) {
      main { width: min(100% - 20px, 1180px); padding-top: 16px; }
      .kpis { grid-template-columns: 1fr 1fr; }
      .cards { grid-template-columns: 1fr; }
      table { min-width: 760px; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <h1>候補10社 銘柄別説明カード</h1>
      <p>候補10社について、数値根拠、時流・イベント仮説、未完了項目、明日の確認作業を銘柄別に整理しました。</p>
      <div class="actions">
        <a class="button" href="candidate_10_rational_selection_board_20260526.html">選定作業表へ戻る</a>
        <a class="button" href="471_candidate_10_explanation_cards.csv">説明カードCSV</a>
        <a class="button" href="472_candidate_10_tomorrow_checklist.csv">明日確認CSV</a>
        <a class="button" href="473_candidate_10_june_gate_by_ticker.csv">6月判定CSV</a>
      </div>
      <div class="kpis">
        <div class="kpi"><b>${cardRows.length}</b><span>説明対象</span></div>
        <div class="kpi"><b>${checklistRows.length}</b><span>明日確認する作業</span></div>
        <div class="kpi"><b>未加点</b><span>質的情報</span></div>
        <div class="kpi"><b>0社</b><span>購入判断</span></div>
      </div>
    </section>

    <div class="notice">
      このページは、明日候補10社を根拠付きで説明するための作業資料です。購入判断は6月イベント後に再判定します。
    </div>

    <section class="cards">
      ${cardHtml}
    </section>

    <section class="panel">
      <h2>明日の確認作業</h2>
      ${table(
        [
          { key: 'ticker', label: '銘柄' },
          { key: 'company', label: '会社' },
          { key: 'task_no', label: 'No.' },
          { key: 'task', label: '確認作業' },
          { key: 'expected_output', label: '成果' },
          { key: 'score_policy', label: '点数への扱い' },
        ],
        checklistRows,
      )}
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_explanation_cards_20260526.html'), html, 'utf8');

console.log('created candidate_10_explanation_cards_20260526.html');
console.log(`cards=${cardRows.length}, checklist=${checklistRows.length}`);
