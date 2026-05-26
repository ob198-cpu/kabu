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

const gradeRank = new Map([
  ['S', 4],
  ['A', 3],
  ['B', 2],
  ['C', 1],
  ['保留', 0],
  ['', 0],
]);

const rankGrade = new Map([...gradeRank.entries()].map(([grade, value]) => [value, grade]));

function gradeValue(grade) {
  return gradeRank.get(grade) ?? 0;
}

function minGrade(...grades) {
  const min = Math.min(...grades.map(gradeValue));
  return rankGrade.get(min) || '保留';
}

function integratedRole(row, integratedGrade) {
  if (integratedGrade === 'S') return '6月主候補';
  if (integratedGrade === 'A') return '6月優先確認';
  if (integratedGrade === 'B') return '条件付き確認';
  if (row.role === '補完待ち') return '補完待ち';
  if (row.role === '検算枠') return '検算枠';
  return '観察・比較';
}

function reason(row, gate, integratedGrade) {
  const parts = [
    `元評価${row.grade || '-'}`,
    `量的評価${row.quantitative_grade || '-'}`,
    `質的評価${gate.qualitative_grade || '-'}`,
    `統合後${integratedGrade}`,
  ];
  if (integratedGrade !== row.grade) {
    parts.push('質的ゲートまたは量的評価の弱い側を上限として採用');
  }
  return parts.join(' / ');
}

function nextCondition(row, gate, integratedGrade) {
  if (integratedGrade === 'A') {
    return '20営業日反応が指数超過で継続し、公式数字で質的仮説を確認できれば主候補継続。';
  }
  if (integratedGrade === 'B') {
    return '公式数字、20営業日反応、指数比較の不足部分を確認してから主候補化を判断。';
  }
  if (integratedGrade === 'C' && row.role === '検算枠') {
    return '弱い20営業日反応の理由が説明できなければ、6月テスト候補へ戻さない。';
  }
  if (integratedGrade === 'C') {
    return '量的評価または質的確認が弱いため、補完後または比較対象に留める。';
  }
  return '不足データを補完して再判定。';
}

const clientRows = readCsv('540_candidate_10_client_explanation_detail.csv');
const gateRowsByTicker = byTicker(readCsv('560_qualitative_gate_detail.csv'));

const integratedRows = clientRows.map((row) => {
  const gate = gateRowsByTicker.get(row.ticker) || {};
  const integratedGrade = minGrade(row.grade, row.quantitative_grade, gate.qualitative_grade);
  return {
    updated_at: generatedAt,
    rank: row.rank,
    ticker: row.ticker,
    company: row.company,
    original_role: row.role,
    quantitative_score: row.score,
    original_grade: row.grade,
    quantitative_grade: row.quantitative_grade,
    qualitative_grade: gate.qualitative_grade || '',
    integrated_grade: integratedGrade,
    integrated_role: integratedRole(row, integratedGrade),
    qualitative_driver: row.qualitative_driver,
    integration_reason: reason(row, gate, integratedGrade),
    next_condition: nextCondition(row, gate, integratedGrade),
    treatment: '統合後の検証候補整理。投資実行判断ではない。',
  };
});

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '統合方式',
    value: '最小評価で上限をかける',
    meaning: '元評価、量的評価、質的評価のうち弱い評価を優先し、過大評価を防ぐ。',
  },
  {
    updated_at: generatedAt,
    item: '統合S',
    value: `${integratedRows.filter((row) => row.integrated_grade === 'S').length}社`,
    meaning: '公式数字と20営業日反応がそろうまでSは出さない。',
  },
  {
    updated_at: generatedAt,
    item: '6月優先確認',
    value: integratedRows.filter((row) => row.integrated_role === '6月優先確認').map((row) => row.company).join('、') || '該当なし',
    meaning: '現時点で最も前に置くが、6月イベント後に再判定する。',
  },
  {
    updated_at: generatedAt,
    item: '条件付き確認',
    value: `${integratedRows.filter((row) => row.integrated_role === '条件付き確認').length}社`,
    meaning: '主候補化には、公式数字、20営業日反応、指数比較の確認が必要。',
  },
];

const ruleRows = [
  {
    rule: '統合評価 = min(元評価, 量的評価, 質的評価)',
    detail: '点数が高くても、量的評価または質的評価が弱ければ統合評価を下げる。',
  },
  {
    rule: '質的評価は加点しない',
    detail: 'イベントや時流は、点数加算ではなく、通過条件・上限・除外条件に使う。',
  },
  {
    rule: 'Sは出しにくくする',
    detail: '公式数字と20営業日株価反応の両方がそろうまでS評価にしない。',
  },
  {
    rule: '統合Cは観察または補完',
    detail: '統合Cは、6月テスト候補の中心ではなく、補完後の検算・比較対象として扱う。',
  },
];

writeCsv('562_dual_axis_integrated_selection_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'meaning',
]);

writeCsv('563_dual_axis_integrated_selection_detail.csv', integratedRows, [
  'updated_at',
  'rank',
  'ticker',
  'company',
  'original_role',
  'quantitative_score',
  'original_grade',
  'quantitative_grade',
  'qualitative_grade',
  'integrated_grade',
  'integrated_role',
  'qualitative_driver',
  'integration_reason',
  'next_condition',
  'treatment',
]);

writeCsv('564_dual_axis_integrated_selection_rules.csv', ruleRows, [
  'rule',
  'detail',
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

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>量的×質的 統合候補判定 2026年5月27日</title>
  <style>
    :root {
      --ink: #08233f;
      --muted: #334155;
      --line: #cbdff0;
      --soft: #f6fbff;
      --blue: #0b5e94;
      --green: #0c7a43;
      --orange: #b45309;
      --red: #b91c1c;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f3f8fc;
      color: var(--ink);
      font-family: "Yu Gothic", "Meiryo", system-ui, sans-serif;
      line-height: 1.75;
    }
    main { max-width: 1180px; margin: 0 auto; padding: 28px 18px 56px; }
    header {
      background: linear-gradient(135deg, #0a426b, #116b8d);
      color: #fff;
      border-radius: 14px;
      padding: 28px;
      margin-bottom: 18px;
    }
    h1 { margin: 0 0 10px; font-size: clamp(26px, 4vw, 42px); line-height: 1.2; }
    h2 { margin: 0 0 12px; font-size: 24px; border-left: 7px solid var(--blue); padding-left: 12px; }
    .lead { max-width: 900px; margin: 0; color: #e8f4ff; font-weight: 700; }
    .grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin: 18px 0; }
    .card, section {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 12px;
      box-shadow: 0 10px 24px rgba(18, 52, 86, .08);
    }
    .card { padding: 16px; }
    .card small { display: block; color: var(--muted); font-weight: 700; }
    .card b { display: block; font-size: 30px; margin-top: 4px; }
    section { padding: 22px; margin-top: 18px; }
    .note {
      border: 1px solid #f5c77a;
      border-left: 8px solid var(--orange);
      background: #fff8eb;
      border-radius: 10px;
      padding: 14px 16px;
      font-weight: 700;
    }
    .flow {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin-top: 12px;
    }
    .flow div {
      position: relative;
      border: 1px solid var(--line);
      background: var(--soft);
      border-radius: 10px;
      padding: 14px;
      min-height: 120px;
    }
    .flow b { display: block; color: var(--blue); margin-bottom: 6px; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; }
    table { width: 100%; border-collapse: collapse; background: #fff; min-width: 980px; }
    th, td { border-bottom: 1px solid var(--line); border-right: 1px solid var(--line); padding: 10px 12px; vertical-align: top; color: #031f3b; }
    th { background: #e7f2fb; text-align: left; white-space: nowrap; }
    tr:last-child td { border-bottom: 0; }
    .wide table { min-width: 1280px; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
    .actions a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 42px;
      padding: 9px 14px;
      border-radius: 8px;
      background: var(--blue);
      color: #fff;
      text-decoration: none;
      font-weight: 700;
    }
    .actions a.secondary { background: #fff; color: var(--blue); border: 1px solid var(--line); }
    @media (max-width: 900px) {
      .grid, .flow { grid-template-columns: 1fr; }
      main { padding: 14px 10px 40px; }
      header, section { padding: 18px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>量的×質的 統合候補判定</h1>
      <p class="lead">量的スコアと質的材料を足し算せず、弱い側を上限として扱うことで、時流だけで候補を上げすぎないための判定表です。</p>
    </header>

    <div class="grid">
      <div class="card"><small>統合S</small><b>${integratedRows.filter((row) => row.integrated_grade === 'S').length}社</b></div>
      <div class="card"><small>6月優先確認</small><b>${integratedRows.filter((row) => row.integrated_role === '6月優先確認').length}社</b></div>
      <div class="card"><small>条件付き確認</small><b>${integratedRows.filter((row) => row.integrated_role === '条件付き確認').length}社</b></div>
      <div class="card"><small>観察・補完・検算</small><b>${integratedRows.filter((row) => !['6月主候補', '6月優先確認', '条件付き確認'].includes(row.integrated_role)).length}社</b></div>
    </div>

    <section>
      <h2>1. この判定の目的</h2>
      <p>6月テスト候補を選ぶ前に、量的評価、質的評価、元の候補評価のうち最も弱い評価を採用します。これにより、イベント材料だけで高く見せること、または点数だけで質的リスクを見落とすことを防ぎます。</p>
      <div class="note">このページは検証候補の整理であり、投資実行判断ではありません。6月のCPI、日銀、FOMC、市場反応、各社追加確認後に再判定します。</div>
    </section>

    <section>
      <h2>2. 判定式</h2>
      <div class="flow">
        <div><b>元評価</b>候補説明資料でのS/A/B/C。既存の候補順位と説明上の位置づけ。</div>
        <div><b>量的評価</b>決算成長、株価反応、PER/PBR/ROE、下落耐性などの数値評価。</div>
        <div><b>質的評価</b>時流・イベント・構造材料が公式数字や株価反応に接続できるか。</div>
        <div><b>統合評価</b>統合評価 = min(元評価, 量的評価, 質的評価)。弱い側を上限にする。</div>
      </div>
    </section>

    <section>
      <h2>3. 要約</h2>
      ${table([
        { key: 'item', label: '項目' },
        { key: 'value', label: '結果' },
        { key: 'meaning', label: '意味' },
      ], summaryRows)}
    </section>

    <section>
      <h2>4. 統合候補判定</h2>
      ${table([
        { key: 'rank', label: '順位' },
        { key: 'ticker', label: '銘柄' },
        { key: 'company', label: '会社名' },
        { key: 'quantitative_score', label: '量的点' },
        { key: 'original_grade', label: '元評価' },
        { key: 'quantitative_grade', label: '量的評価' },
        { key: 'qualitative_grade', label: '質的評価' },
        { key: 'integrated_grade', label: '統合評価' },
        { key: 'integrated_role', label: '扱い' },
        { key: 'integration_reason', label: '判定理由' },
        { key: 'next_condition', label: '次に確認する条件' },
      ], integratedRows, 'wide')}
    </section>

    <section>
      <h2>5. ルール</h2>
      ${table([
        { key: 'rule', label: 'ルール' },
        { key: 'detail', label: '内容' },
      ], ruleRows)}
      <div class="actions">
        <a href="562_dual_axis_integrated_selection_summary.csv">要約CSV</a>
        <a href="563_dual_axis_integrated_selection_detail.csv">詳細CSV</a>
        <a href="564_dual_axis_integrated_selection_rules.csv">ルールCSV</a>
        <a class="secondary" href="candidate_10_delivery_hub_20260527.html">候補10社資料ハブへ戻る</a>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'dual_axis_integrated_selection_20260527.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  rows: integratedRows.length,
  s: integratedRows.filter((row) => row.integrated_grade === 'S').length,
  a: integratedRows.filter((row) => row.integrated_grade === 'A').length,
  b: integratedRows.filter((row) => row.integrated_grade === 'B').length,
  c: integratedRows.filter((row) => row.integrated_grade === 'C').length,
}, null, 2));
