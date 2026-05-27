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
  return text.split('\n').map((line) => line.replace(/[ \t]+$/g, '')).join('\n');
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

function num(value, fallback = 0) {
  const parsed = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function plainReason(row) {
  const quant = num(row.quant_score);
  const qual = num(row.qualitative_score);
  const conf = num(row.data_confidence);
  const parts = [];
  if (row.test_priority_class === '第1候補群') {
    parts.push('量的スコアと質的確認の両方が相対的に高い');
  } else if (row.test_priority_class === '第2候補群') {
    parts.push('質的テーマとの接続は強いが、量的スコアは第1候補群より低い');
  } else if (row.test_priority_class === '補欠候補') {
    parts.push('一部スコアは高いが、質的材料または反応確認が不足');
  } else {
    parts.push('現時点では購入可否判定へ進む根拠が足りない');
  }
  parts.push(`量的${quant}点、質的${qual}点、信頼度${conf}点`);
  return parts.join('。') + '。';
}

function mainRisk(row) {
  if (row.operation_decision === '警戒') return '質的イベントに警戒条件があるため、指数反応と追加ニュースを優先確認する。';
  if (row.operation_decision === '反応再確認') return '決算後反応が弱い、または確認が未到達のため、20営業日反応を見る。';
  if (row.test_priority_class === '第2候補群') return '半導体・AIテーマは強いが、PER/PBR、金利、SOX指数下落時の耐性確認が必要。';
  if (row.test_priority_class === '補欠候補') return 'スコアの一部が高くても、質的イベント接続または反応確認が弱い。';
  if (row.test_priority_class === '第1候補群') return '割高感、原材料費、数量減、6月イベント後の市場全体悪化を確認する。';
  return '監視対象として記録し、条件改善時だけ再計算する。';
}

function presentationLine(row) {
  if (row.test_priority_class === '第1候補群') {
    return `${row.company}は現時点で最も説明しやすい第1候補群です。ただし、6月イベント後の再判定が前提です。`;
  }
  if (row.test_priority_class === '第2候補群') {
    return `${row.company}は時流テーマとの接続があり、数字の追加確認後に候補上位へ残すか判断します。`;
  }
  if (row.test_priority_class === '補欠候補') {
    return `${row.company}は一部指標が強いものの、現時点では補欠として追加確認します。`;
  }
  return `${row.company}は現時点では監視中心です。条件改善が出るまで購入可否判定へ進めません。`;
}

const operationRows = readCsv('628_nisa_test_operation_plan.csv');
const ruleRows = readCsv('625_candidate_operation_rules.csv');
const ruleMap = new Map(ruleRows.map((row) => [row.ticker, row]));

const explanationRows = operationRows.map((row, index) => {
  const rule = ruleMap.get(row.ticker) || {};
  return {
    generated_at: generatedAt,
    explanation_rank: index + 1,
    ticker: row.ticker,
    company: row.company,
    sector: row.sector,
    test_priority_class: row.test_priority_class,
    test_priority_score: row.test_priority_score,
    quant_score: row.quant_score,
    qualitative_score: row.qualitative_score,
    data_confidence: row.data_confidence,
    operation_decision: row.operation_decision,
    selection_reason: plainReason(row),
    qualitative_theme: rule.qualitative_themes || '未接続',
    main_risk: mainRisk(row),
    june_condition: row.june_final_gate,
    remaining_input: row.remaining_input,
    presentation_line: presentationLine(row),
  };
});

const summaryRows = [
  {
    generated_at: generatedAt,
    item: '資料の目的',
    detail: 'NISA 1年保有テスト候補を、量的スコア、質的材料、データ信頼度、6月確認条件で説明できる形に整理した。',
  },
  {
    generated_at: generatedAt,
    item: '現時点の第1候補群',
    detail: explanationRows.filter((row) => row.test_priority_class === '第1候補群').map((row) => `${row.ticker} ${row.company}`).join('、') || '該当なし',
  },
  {
    generated_at: generatedAt,
    item: '現時点の第2候補群',
    detail: explanationRows.filter((row) => row.test_priority_class === '第2候補群').map((row) => `${row.ticker} ${row.company}`).join('、') || '該当なし',
  },
  {
    generated_at: generatedAt,
    item: '判断の前提',
    detail: '購入対象の確定ではない。6月の市場イベントと不足データを確認して再判定する。',
  },
];

const checklistRows = [
  {
    check_item: '量的根拠',
    done: '対応済み',
    detail: 'NISA 1年保有スコア、データ信頼度、テスト優先度を表示。',
  },
  {
    check_item: '質的根拠',
    done: '対応済み',
    detail: 'AI半導体、金利、バフェット売買、食品値上げ耐性、原油などの質的テーマを接続。',
  },
  {
    check_item: '直接加点の抑止',
    done: '対応済み',
    detail: '質的材料は確認条件・警戒条件として扱い、購入候補へ直接昇格させない。',
  },
  {
    check_item: '6月再判定条件',
    done: '対応済み',
    detail: 'CPI、日銀、FOMC、米10年金利、為替、日経平均75日線、決算後20営業日反応を確認。',
  },
  {
    check_item: '残る作業',
    done: '継続',
    detail: 'PER/PBR/ROE、同業比較、公式決算値、決算後20営業日反応の追加確認。',
  },
];

writeCsv('629_candidate_selection_explanation_summary.csv', summaryRows, ['generated_at', 'item', 'detail']);
writeCsv('630_candidate_selection_explanation_table.csv', explanationRows, [
  'generated_at',
  'explanation_rank',
  'ticker',
  'company',
  'sector',
  'test_priority_class',
  'test_priority_score',
  'quant_score',
  'qualitative_score',
  'data_confidence',
  'operation_decision',
  'selection_reason',
  'qualitative_theme',
  'main_risk',
  'june_condition',
  'remaining_input',
  'presentation_line',
]);
writeCsv('631_candidate_selection_explanation_checklist.csv', checklistRows, ['check_item', 'done', 'detail']);

const topRows = explanationRows.filter((row) => ['第1候補群', '第2候補群', '補欠候補'].includes(row.test_priority_class));

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補選定 説明資料 2026年5月27日</title>
  <style>
    :root { --ink:#061e38; --line:#cbdff0; --blue:#0b5e94; --bg:#f4f8fb; --orange:#b45309; --green:#126b45; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; line-height:1.65; }
    main { max-width:1360px; margin:0 auto; padding:24px 18px 48px; }
    header { background:#082f53; color:#fff; border-radius:14px; padding:26px; margin-bottom:16px; }
    h1 { margin:0 0 8px; font-size:clamp(26px,4vw,40px); line-height:1.2; }
    h2 { margin:0 0 10px; font-size:22px; border-left:7px solid var(--blue); padding-left:12px; }
    .lead { margin:0; max-width:1080px; color:#edf7ff; font-weight:700; }
    section { background:#fff; border:1px solid var(--line); border-radius:12px; box-shadow:0 8px 20px rgba(20,60,90,.08); padding:18px; margin-top:14px; break-inside:avoid; page-break-inside:avoid; }
    .cards { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
    .card { border:1px solid var(--line); border-radius:10px; padding:14px; background:#f8fbfe; }
    .card h3 { margin:0 0 6px; font-size:18px; color:var(--blue); }
    .card b { display:block; font-size:24px; color:#061e38; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; background:#fff; min-width:980px; }
    .wide table { min-width:2400px; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:9px 11px; vertical-align:top; color:#031f3b; }
    th { background:#e7f2fb; text-align:left; white-space:nowrap; }
    tr:last-child td { border-bottom:0; }
    .note { border:1px solid #f5c77a; border-left:8px solid var(--orange); background:#fff8eb; border-radius:10px; padding:12px 14px; font-weight:700; margin-top:12px; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .actions a { display:inline-flex; align-items:center; justify-content:center; min-height:42px; padding:9px 14px; border-radius:8px; background:var(--blue); color:#fff; text-decoration:none; font-weight:700; }
    @media (max-width:900px) { main { padding:12px 10px 36px; } header,section { padding:16px; } .cards { grid-template-columns:1fr; } }
    @media print {
      body { background:#fff; }
      main { max-width:none; padding:10mm; }
      section { box-shadow:none; }
      .table-wrap { overflow:visible; }
      table { min-width:0; font-size:10px; }
      .wide table { min-width:0; }
      th,td { padding:5px 6px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>候補選定 説明資料</h1>
      <p class="lead">NISA 1年保有テストに向け、なぜ候補に残すのか、なぜ監視に留めるのかを説明するための資料です。量的データを主軸に、質的材料は確認条件として整理しています。</p>
    </header>

    <section>
      <h2>1. 要約</h2>
      ${table([
        { key: 'item', label: '項目' },
        { key: 'detail', label: '内容' },
      ], summaryRows)}
      <div class="note">本資料は購入対象の確定ではありません。6月イベント後の再判定に向けた候補説明資料です。</div>
    </section>

    <section>
      <h2>2. 説明しやすい候補群</h2>
      <div class="cards">
        ${topRows.map((row) => `<article class="card"><h3>${esc(row.test_priority_class)}</h3><b>${esc(row.ticker)} ${esc(row.company)}</b><p>${esc(row.presentation_line)}</p><p>${esc(row.selection_reason)}</p></article>`).join('')}
      </div>
    </section>

    <section>
      <h2>3. 作業チェック</h2>
      ${table([
        { key: 'check_item', label: '確認項目' },
        { key: 'done', label: '状態' },
        { key: 'detail', label: '内容' },
      ], checklistRows, 'wide')}
    </section>

    <section>
      <h2>4. 銘柄別の説明表</h2>
      ${table([
        { key: 'explanation_rank', label: '説明順位' },
        { key: 'ticker', label: '銘柄' },
        { key: 'company', label: '会社名' },
        { key: 'sector', label: '業種' },
        { key: 'test_priority_class', label: '候補群' },
        { key: 'test_priority_score', label: '優先度' },
        { key: 'quant_score', label: '量的' },
        { key: 'qualitative_score', label: '質的' },
        { key: 'data_confidence', label: '信頼度' },
        { key: 'operation_decision', label: '運用区分' },
        { key: 'selection_reason', label: '選定理由' },
        { key: 'qualitative_theme', label: '質的テーマ' },
        { key: 'main_risk', label: '主な注意点' },
        { key: 'june_condition', label: '6月確認条件' },
        { key: 'remaining_input', label: '残り入力' },
        { key: 'presentation_line', label: '説明文' },
      ], explanationRows, 'wide')}
      <div class="actions">
        <a href="629_candidate_selection_explanation_summary.csv">要約CSV</a>
        <a href="630_candidate_selection_explanation_table.csv">説明表CSV</a>
        <a href="631_candidate_selection_explanation_checklist.csv">チェックCSV</a>
        <a href="nisa_test_operation_planner_20260527.html">運用プランへ</a>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_selection_explanation_20260527.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  rows: explanationRows.length,
  topRows: topRows.map((row) => `${row.ticker} ${row.company}`),
  output: 'candidate_selection_explanation_20260527.html',
}, null, 2));
