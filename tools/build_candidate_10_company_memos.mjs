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

function shortAssessment(row) {
  if (row.work_status === '説明優先') return `${row.company}は、現時点で説明優先に置く。主な理由は、${row.evidence_summary}。`;
  if (row.work_status === '比較維持') return `${row.company}は、10社内で比較を継続する。上位候補との差は、${row.remaining_issue}`;
  if (row.work_status === '反応更新待ち') return `${row.company}は、決算後反応の更新を待つ。1日反応だけでは扱いを固定しない。`;
  if (row.work_status === '補完後に再判定') return `${row.company}は、補完後に再判定する。試算値や不足値をそのまま順位固定に使わない。`;
  if (row.work_status === '検算優先') return `${row.company}は、検算優先に置く。構造仮説はあるが、実績反応が弱い。`;
  return `${row.company}は追加確認対象。`;
}

function nextTrigger(row, reaction) {
  const triggers = [];
  if (reaction?.estimated_20bd_date) triggers.push(`20営業日反応: ${reaction.estimated_20bd_date}`);
  if (row.work_status === '反応更新待ち') triggers.push('5営業日反応の更新');
  if (row.sector_adjustment_status !== '補正参考可') triggers.push('同業比較または広義比較の不足確認');
  if (row.work_status.includes('補完')) triggers.push('公式値または説明補助値の検算');
  if (row.work_status === '検算優先') triggers.push('弱い反応の原因検算');
  return triggers.join(' / ') || '6月イベント後に再確認';
}

const draftRows = readCsv('519_candidate_10_selection_draft_detail.csv');
const qualitativeByTicker = byTicker(readCsv('521_candidate_10_qualitative_validation_checklist.csv'));
const broadByTicker = byTicker(readCsv('528_candidate_10_broad_peer_reference_detail.csv'));
const reactionByTicker = byTicker(readCsv('500_candidate_10_reaction_due_detail.csv'));

const memoRows = draftRows.map((row) => {
  const qualitative = qualitativeByTicker.get(row.ticker);
  const broad = broadByTicker.get(row.ticker);
  const reaction = reactionByTicker.get(row.ticker);
  return {
    updated_at: generatedAt,
    order: row.draft_rank,
    ticker: row.ticker,
    company: row.company,
    status: row.work_status,
    grade: row.draft_grade,
    score: row.draft_score,
    headline: shortAssessment(row),
    numeric_basis: row.evidence_summary,
    qualitative_hypothesis: qualitative?.qualitative_driver || '',
    confirmation_needed: qualitative?.required_confirmation || '',
    reject_condition: qualitative?.reject_condition || '',
    peer_reference: broad ? `${broad.broad_status}: ${broad.reason}` : row.sector_adjustment_status,
    reaction_schedule: reaction ? `${reaction.event_date}決算 / 1日 ${reaction.excess_1d_pct || '未到達'} / 5日 ${reaction.excess_5d_pct || '未到達'} / 20営業日 ${reaction.estimated_20bd_date || '未設定'}` : '',
    next_trigger: nextTrigger(row, reaction),
    treatment: '明日説明用メモ。投資実行判断ではない。',
  };
});

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '1社別メモ',
    value: `${memoRows.length}社`,
    meaning: '明日説明するため、各銘柄の根拠・弱点・次の確認条件を整理。',
  },
  {
    updated_at: generatedAt,
    item: '説明優先',
    value: `${memoRows.filter((row) => row.status === '説明優先').length}社`,
    meaning: '先に説明する対象。ただし6月再判定までは実行判断ではない。',
  },
  {
    updated_at: generatedAt,
    item: '注意付き',
    value: `${memoRows.filter((row) => row.status !== '説明優先').length}社`,
    meaning: '比較維持、反応待ち、補完後再判定、検算優先に分けて扱う。',
  },
];

writeCsv('529_candidate_10_company_memos_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'meaning',
]);

writeCsv('530_candidate_10_company_memos_detail.csv', memoRows, [
  'updated_at',
  'order',
  'ticker',
  'company',
  'status',
  'grade',
  'score',
  'headline',
  'numeric_basis',
  'qualitative_hypothesis',
  'confirmation_needed',
  'reject_condition',
  'peer_reference',
  'reaction_schedule',
  'next_trigger',
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
  <title>候補10社 1社別メモ 2026年5月26日</title>
  <style>
    :root { --ink:#061a33; --muted:#3f5168; --line:#c9d9ea; --bg:#f4f8fc; --navy:#0d3658; --blue:#0b6fa4; --soft:#eef7ff; --amber:#b45309; --green:#087f5b; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; background:var(--bg); color:var(--ink); line-height:1.72; letter-spacing:0; }
    header { background:var(--navy); color:#fff; padding:34px clamp(18px,4vw,58px); }
    h1 { margin:0 0 8px; font-size:clamp(28px,4vw,42px); letter-spacing:0; }
    header p { margin:0; color:#e7f3ff; font-weight:800; max-width:1120px; }
    main { width:min(1240px, calc(100% - 32px)); margin:24px auto 56px; }
    section { background:#fff; border:1px solid var(--line); border-radius:8px; padding:22px; margin:18px 0; break-inside:avoid; }
    h2 { margin:0 0 14px; padding-left:12px; border-left:8px solid var(--blue); font-size:24px; }
    .summary { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
    .metric { border:1px solid var(--line); border-radius:8px; padding:14px; background:var(--soft); min-height:118px; }
    .metric span { display:block; color:var(--muted); font-weight:900; }
    .metric strong { display:block; color:var(--blue); font-size:30px; line-height:1.2; }
    .memo-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
    .memo { border:1px solid var(--line); border-radius:8px; padding:14px; background:#fff; }
    .memo h3 { margin:0 0 8px; color:var(--navy); font-size:18px; }
    .badge { display:inline-flex; border:1px solid #b7d4ec; border-radius:999px; padding:3px 9px; color:var(--green); font-weight:900; font-size:12px; }
    .memo p { margin:7px 0; font-size:13px; }
    .notice { border-left:8px solid var(--amber); background:#fff7ed; padding:14px; border-radius:8px; font-weight:900; }
    .toolbar { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .button { display:inline-flex; align-items:center; min-height:38px; padding:8px 12px; border-radius:8px; border:1px solid #9cc8ec; background:#fff; color:var(--navy); text-decoration:none; font-weight:900; font-size:13px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:8px; }
    table { width:100%; min-width:1540px; border-collapse:collapse; table-layout:fixed; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:9px; vertical-align:top; text-align:left; overflow-wrap:anywhere; word-break:break-word; }
    th { background:#e6f1fb; color:#073b63; font-weight:900; }
    tr:last-child td { border-bottom:0; }
    th:last-child,td:last-child { border-right:0; }
    @media (max-width:900px) { main { width:min(100% - 20px,1240px); } .summary,.memo-grid { grid-template-columns:1fr; } section { padding:16px; } }
  </style>
</head>
<body>
  <header>
    <h1>候補10社 1社別メモ</h1>
    <p>明日そのまま説明に使えるように、各銘柄の数字根拠、質的仮説、崩れる条件、次の確認条件をまとめます。</p>
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
      <p class="notice">このメモは候補説明用です。6月のイベント確認と決算後反応の到達前に、実行判断として扱いません。</p>
      <div class="toolbar">
        <a class="button" href="529_candidate_10_company_memos_summary.csv">529 要約CSV</a>
        <a class="button" href="530_candidate_10_company_memos_detail.csv">530 詳細CSV</a>
        <a class="button" href="candidate_10_tomorrow_brief_20260526.html">明日説明ブリーフへ</a>
        <a class="button" href="candidate_10_selection_draft_20260526.html">選定ドラフトへ</a>
        <a class="button" href="index.html">メインページへ</a>
      </div>
    </section>

    <section>
      <h2>1社別メモ</h2>
      <div class="memo-grid">
        ${memoRows.map((row) => `
        <article class="memo">
          <h3>${esc(row.order)}. ${esc(row.company)} ${esc(row.ticker)}</h3>
          <span class="badge">${esc(row.status)} / ${esc(row.grade)} / ${esc(row.score)}</span>
          <p><b>要点:</b> ${esc(row.headline)}</p>
          <p><b>質的仮説:</b> ${esc(row.qualitative_hypothesis)}</p>
          <p><b>確認条件:</b> ${esc(row.confirmation_needed)}</p>
          <p><b>崩れる条件:</b> ${esc(row.reject_condition)}</p>
          <p><b>次:</b> ${esc(row.next_trigger)}</p>
        </article>`).join('')}
      </div>
    </section>

    <section>
      <h2>詳細表</h2>
      ${table(
        [
          { key: 'order', label: '順番' },
          { key: 'ticker', label: '銘柄' },
          { key: 'company', label: '会社' },
          { key: 'status', label: '分類' },
          { key: 'grade', label: '評価' },
          { key: 'score', label: '作業点' },
          { key: 'headline', label: '要点' },
          { key: 'numeric_basis', label: '数字根拠' },
          { key: 'qualitative_hypothesis', label: '質的仮説' },
          { key: 'confirmation_needed', label: '確認条件' },
          { key: 'reject_condition', label: '崩れる条件' },
          { key: 'peer_reference', label: '同業参考' },
          { key: 'reaction_schedule', label: '反応予定' },
          { key: 'next_trigger', label: '次の確認' },
          { key: 'treatment', label: '扱い' },
        ],
        memoRows,
      )}
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_company_memos_20260526.html'), html, 'utf8');

console.log(`created candidate_10_company_memos_20260526.html rows=${memoRows.length}`);
