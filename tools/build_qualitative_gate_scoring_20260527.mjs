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
          ${rows.map((row) => `<tr>${headers.map((header) => `<td>${esc(row[header.key])}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function qualitativeGrade(row) {
  if (row.role === '主候補' && row.quantitative_grade === 'A') return 'A';
  if (row.role === '主候補') return 'B';
  if (row.role === '比較枠') return 'B';
  if (row.role === '反応待ち') return 'B';
  if (row.role === '補完待ち') return 'C';
  if (row.role === '検算枠') return 'C';
  return 'C';
}

function capRule(grade) {
  if (grade === 'S') return '量的評価の上限をSまで許容。ただし公式数字と株価反応の両方が必要。';
  if (grade === 'A') return '量的評価の上限をAまで許容。株価反応がそろえばS候補へ進める。';
  if (grade === 'B') return '量的評価の上限をBまでに抑える。確認条件がそろうまで主候補化しない。';
  return '量的評価の上限をCまでに抑える。確認条件が崩れる場合は見送り。';
}

function currentEvidence(row) {
  if (row.role === '主候補' && row.quantitative_grade === 'A') {
    return '量的評価が比較的強く、質的仮説も業績確認条件に接続できる。ただし株価反応の20営業日確認が残る。';
  }
  if (row.role === '主候補') {
    return '質的仮説は説明可能だが、量的評価はBのため、公式数字と20営業日反応の確認が必要。';
  }
  if (row.role === '比較枠') {
    return 'テーマはあるが、量的評価がCのため、質的材料だけでは主候補に上げない。';
  }
  if (row.role === '反応待ち') {
    return '質的仮説はあるが、決算後反応が短期確認中のため、20営業日まで待つ。';
  }
  if (row.role === '補完待ち') {
    return '質的仮説より先に、PER・同業比較・公式値の補完が必要。';
  }
  return 'テーマ性はあるが、20営業日反応が弱いため、仮説の検算を優先する。';
}

function requiredEvidence(row) {
  return [
    row.confirmation,
    '株価反応: 20営業日対日経平均超過リターン',
    '比較: 指数、同業、必要に応じてSOX/NASDAQ/金利/為替',
  ].filter(Boolean).join(' / ');
}

const clientRows = readCsv('540_candidate_10_client_explanation_detail.csv');

const gateRows = clientRows.map((row) => {
  const grade = qualitativeGrade(row);
  return {
    updated_at: generatedAt,
    rank: row.rank,
    ticker: row.ticker,
    company: row.company,
    role: row.role,
    quantitative_grade: row.quantitative_grade,
    quantitative_score: row.score,
    qualitative_grade: grade,
    qualitative_driver: row.qualitative_driver,
    current_evidence: currentEvidence(row),
    required_evidence: requiredEvidence(row),
    reject_condition: row.reject_condition,
    cap_rule: capRule(grade),
    score_treatment: '量的スコアへ単純加点しない。通過条件・上限・除外条件として使う。',
  };
});

const ruleRows = [
  {
    grade: 'S',
    condition: '公式資料の数字と株価反応の両方で仮説が確認できる',
    treatment: '量的評価の上限をSまで許容',
    example: 'セグメント売上・利益・受注が伸び、20営業日反応も指数超過',
  },
  {
    grade: 'A',
    condition: '公式資料の数字では確認できるが、株価反応は確認待ち',
    treatment: '量的評価の上限をAまで許容',
    example: '会社資料では需要継続が確認できるが、20営業日反応が未到達',
  },
  {
    grade: 'B',
    condition: '仮説は妥当だが、数字への接続が弱い、または反応が限定的',
    treatment: '量的評価の上限をBまでに抑える',
    example: 'テーマはあるが、売上・利益・受注への接続がまだ不十分',
  },
  {
    grade: 'C',
    condition: '数字で確認できない、または反応が悪い',
    treatment: '量的評価の上限をCまでに抑え、必要なら見送り',
    example: 'テーマ性はあるが、決算後反応が指数に大きく劣後',
  },
];

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '質的評価の扱い',
    value: 'ゲート方式',
    meaning: '量的スコアへ足さず、上限・通過条件・除外条件として使う。',
  },
  {
    updated_at: generatedAt,
    item: '現時点のS評価',
    value: '0社',
    meaning: '公式数字と20営業日株価反応の両方がそろうまでS評価にしない。',
  },
  {
    updated_at: generatedAt,
    item: '主候補の質的評価',
    value: 'A〜B',
    meaning: 'TDKはA、三井住友FGと味の素はBとして開始。6月反応で更新。',
  },
];

writeCsv('559_qualitative_gate_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'meaning',
]);
writeCsv('560_qualitative_gate_detail.csv', gateRows, [
  'updated_at',
  'rank',
  'ticker',
  'company',
  'role',
  'quantitative_grade',
  'quantitative_score',
  'qualitative_grade',
  'qualitative_driver',
  'current_evidence',
  'required_evidence',
  'reject_condition',
  'cap_rule',
  'score_treatment',
]);
writeCsv('561_qualitative_gate_rules.csv', ruleRows, [
  'grade',
  'condition',
  'treatment',
  'example',
]);

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>質的評価ゲート 2026年5月27日</title>
  <style>
    :root { --ink:#061a33; --muted:#334155; --line:#c9d9ea; --bg:#f4f8fc; --navy:#0d3658; --blue:#0b6fa4; --soft:#eef7ff; --amber:#b45309; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; background:var(--bg); color:var(--ink); line-height:1.72; letter-spacing:0; }
    header { background:var(--navy); color:#fff; padding:34px clamp(18px,4vw,58px); }
    h1 { margin:0 0 8px; font-size:clamp(28px,4vw,42px); letter-spacing:0; }
    header p { margin:0; color:#fff; font-weight:800; max-width:1120px; }
    main { width:min(1280px, calc(100% - 32px)); margin:24px auto 56px; }
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
    table { width:100%; min-width:1240px; border-collapse:collapse; table-layout:fixed; }
    .rules table { min-width:900px; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:9px; vertical-align:top; text-align:left; overflow-wrap:anywhere; word-break:break-word; color:#061a33; }
    th { background:#e6f1fb; color:#073b63; font-weight:900; }
    tr:last-child td { border-bottom:0; }
    th:last-child,td:last-child { border-right:0; }
    @media (max-width:900px) { .summary { grid-template-columns:1fr; } main { width:min(100% - 20px,1280px); } section { padding:16px; } }
  </style>
</head>
<body>
  <header>
    <h1>質的評価ゲート</h1>
    <p>時流・イベント・テーマ材料をS/A/B/Cで整理し、量的スコアへ足さず、上限・通過条件・除外条件として扱う資料です。</p>
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
      <p class="notice">質的材料は単純加点しません。公式数字と株価反応で確認できた場合にだけ、量的評価の上限を広げます。</p>
      <div class="toolbar">
        <a class="button" href="559_qualitative_gate_summary.csv">559 要約CSV</a>
        <a class="button" href="560_qualitative_gate_detail.csv">560 詳細CSV</a>
        <a class="button" href="561_qualitative_gate_rules.csv">561 ルールCSV</a>
        <a class="button" href="candidate_10_client_explanation_20260527.html">候補10社説明へ</a>
      </div>
    </section>

    <section>
      <h2>S/A/B/C ルール</h2>
      ${table(
        [
          { key: 'grade', label: '評価' },
          { key: 'condition', label: '条件' },
          { key: 'treatment', label: '扱い' },
          { key: 'example', label: '例' },
        ],
        ruleRows,
        'rules',
      )}
    </section>

    <section>
      <h2>候補10社 質的評価</h2>
      ${table(
        [
          { key: 'rank', label: '順位' },
          { key: 'ticker', label: 'コード' },
          { key: 'company', label: '銘柄' },
          { key: 'role', label: '役割' },
          { key: 'quantitative_grade', label: '量的評価' },
          { key: 'qualitative_grade', label: '質的評価' },
          { key: 'qualitative_driver', label: '質的材料' },
          { key: 'current_evidence', label: '現時点の根拠' },
          { key: 'required_evidence', label: '必要な確認' },
          { key: 'reject_condition', label: '外す条件' },
          { key: 'cap_rule', label: '上限ルール' },
        ],
        gateRows,
      )}
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'qualitative_gate_scoring_20260527.html'), html, 'utf8');

console.log('created qualitative_gate_scoring_20260527.html');
