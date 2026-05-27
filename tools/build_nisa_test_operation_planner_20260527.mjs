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

function testPriority(row) {
  const nisa = num(row.nisa_score);
  const qual = num(row.qualitative_score, 50);
  const confidence = num(row.data_confidence);
  const decisionBonus = {
    '6月再判定候補': 10,
    比較継続: 5,
    反応再確認: -5,
    警戒: -12,
    保留: -10,
    データ補完: -15,
  }[row.decision] ?? -8;
  const score = Math.round((nisa * 0.55 + qual * 0.20 + confidence * 0.15 + decisionBonus) * 10) / 10;
  return Math.max(0, Math.min(100, score));
}

function priorityClass(score) {
  if (score >= 70) return '第1候補群';
  if (score >= 62) return '第2候補群';
  if (score >= 54) return '補欠候補';
  return '監視のみ';
}

function recordUnit(row) {
  if (row.decision === '6月再判定候補') return '毎営業日';
  if (row.decision === '比較継続') return '週2回';
  if (row.decision === '反応再確認') return '決算後20営業日到達時';
  if (row.decision === '警戒') return 'イベント発生時';
  return '週1回';
}

function nextAction(row, scoreClass) {
  if (scoreClass === '第1候補群') return '6月イベント後の最終確認表へ進める。購入検討ではなく、購入可否判定の対象にする。';
  if (scoreClass === '第2候補群') return '不足データを補完し、第1候補群と比較する。反応が改善しなければ候補順位を上げない。';
  if (scoreClass === '補欠候補') return '質的材料または量的数値のどちらかが弱い。監視を継続し、条件改善時だけ再計算する。';
  return '現時点では購入可否判定に入れず、監視記録に限定する。';
}

const rules = readCsv('625_candidate_operation_rules.csv');
const planRows = rules.map((row) => {
  const priorityScore = testPriority(row);
  const scoreClass = priorityClass(priorityScore);
  return {
    generated_at: generatedAt,
    rank: row.rank,
    ticker: row.ticker,
    company: row.company,
    sector: row.sector,
    quant_score: row.nisa_score,
    qualitative_score: row.qualitative_score,
    data_confidence: row.data_confidence,
    operation_decision: row.decision,
    test_priority_score: priorityScore,
    test_priority_class: scoreClass,
    record_unit: recordUnit(row),
    next_action: nextAction(row, scoreClass),
    june_final_gate: 'CPI、日銀、FOMC、米10年金利、為替、日経平均75日線、決算後20営業日反応を確認',
    hold_test_rule: row.buy_rule,
    stop_or_review_rule: row.stop_rule,
    remaining_input: row.next_input,
  };
}).sort((a, b) => num(b.test_priority_score) - num(a.test_priority_score));

const scheduleRows = [
  {
    date: '5/27',
    phase: '運用表作成',
    task: '量的スコア、質的イベント判定、候補別運用ルールを接続する。',
    output: '候補別運用表、テスト優先度、記録単位',
  },
  {
    date: '5/28',
    phase: '候補10社説明準備',
    task: '第1候補群、第2候補群、補欠候補、監視のみを整理し、銘柄ごとの根拠を確認する。',
    output: '候補10社説明用の根拠表',
  },
  {
    date: '5/29〜6/7',
    phase: '不足データ補完',
    task: 'PER/PBR/ROE、決算後20営業日反応、同業比較、質的イベントの裏取りを追加する。',
    output: '再計算可能な入力表',
  },
  {
    date: '6/8〜6/18',
    phase: '市場イベント確認',
    task: 'CPI、日銀、FOMC、米10年金利、為替、日経平均75日線を確認する。',
    output: '購入可否判定前の市場ゲート',
  },
  {
    date: '6月後半',
    phase: 'NISA 1年保有テスト判定',
    task: '第1候補群を中心に、6月イベント後の数値で再判定する。',
    output: 'テスト対象候補の確定案',
  },
];

const summaryRows = [
  {
    generated_at: generatedAt,
    item: '目的',
    detail: '候補銘柄を、6月のNISA 1年保有テストに向けて記録・再判定できる運用表へ変換した。',
  },
  {
    generated_at: generatedAt,
    item: '判定方法',
    detail: '量的スコア55%、質的スコア20%、データ信頼度15%、運用区分補正を使い、テスト優先度を作成した。',
  },
  {
    generated_at: generatedAt,
    item: '注意',
    detail: '本表は購入対象の確定ではない。6月イベント後の再判定と記録運用のための表。',
  },
];

writeCsv('626_nisa_test_operation_summary.csv', summaryRows, ['generated_at', 'item', 'detail']);
writeCsv('627_nisa_test_operation_schedule.csv', scheduleRows, ['date', 'phase', 'task', 'output']);
writeCsv('628_nisa_test_operation_plan.csv', planRows, [
  'generated_at',
  'rank',
  'ticker',
  'company',
  'sector',
  'quant_score',
  'qualitative_score',
  'data_confidence',
  'operation_decision',
  'test_priority_score',
  'test_priority_class',
  'record_unit',
  'next_action',
  'june_final_gate',
  'hold_test_rule',
  'stop_or_review_rule',
  'remaining_input',
]);

const classCounts = [...new Set(planRows.map((row) => row.test_priority_class))]
  .map((className) => ({
    className,
    count: planRows.filter((row) => row.test_priority_class === className).length,
  }));

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NISA 1年保有テスト 運用プラン 2026年5月27日</title>
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
    .cards { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .card { border:1px solid var(--line); border-radius:10px; padding:14px; background:#f8fbfe; }
    .card b { display:block; font-size:26px; color:var(--blue); }
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
      <h1>NISA 1年保有テスト 運用プラン</h1>
      <p class="lead">候補銘柄を、6月の市場イベント後に再判定するための運用表です。量的スコアを主軸に、質的イベントは確認条件として扱い、記録単位と次アクションを明確にします。</p>
    </header>

    <section>
      <h2>1. 位置づけ</h2>
      ${table([
        { key: 'item', label: '項目' },
        { key: 'detail', label: '内容' },
      ], summaryRows)}
      <div class="note">本表は投資実行判断ではありません。候補の記録、比較、6月再判定のための運用表です。</div>
    </section>

    <section>
      <h2>2. 候補群の内訳</h2>
      <div class="cards">
        ${classCounts.map((row) => `<div class="card"><b>${esc(row.count)}件</b><span>${esc(row.className)}</span></div>`).join('')}
      </div>
    </section>

    <section>
      <h2>3. 実施スケジュール</h2>
      ${table([
        { key: 'date', label: '時期' },
        { key: 'phase', label: '工程' },
        { key: 'task', label: '作業内容' },
        { key: 'output', label: '成果物' },
      ], scheduleRows, 'wide')}
    </section>

    <section>
      <h2>4. 候補別 運用プラン</h2>
      ${table([
        { key: 'rank', label: '元順位' },
        { key: 'ticker', label: '銘柄' },
        { key: 'company', label: '会社名' },
        { key: 'sector', label: '業種' },
        { key: 'quant_score', label: '量的スコア' },
        { key: 'qualitative_score', label: '質的点' },
        { key: 'data_confidence', label: '信頼度' },
        { key: 'operation_decision', label: '運用区分' },
        { key: 'test_priority_score', label: 'テスト優先度' },
        { key: 'test_priority_class', label: '候補群' },
        { key: 'record_unit', label: '記録単位' },
        { key: 'next_action', label: '次アクション' },
        { key: 'june_final_gate', label: '6月最終確認' },
        { key: 'hold_test_rule', label: '保有テストへ進む条件' },
        { key: 'stop_or_review_rule', label: '停止/再確認ルール' },
        { key: 'remaining_input', label: '残り入力' },
      ], planRows, 'wide')}
      <div class="actions">
        <a href="626_nisa_test_operation_summary.csv">概要CSV</a>
        <a href="627_nisa_test_operation_schedule.csv">スケジュールCSV</a>
        <a href="628_nisa_test_operation_plan.csv">運用プランCSV</a>
        <a href="candidate_operation_rule_system_20260527.html">候補別ルールへ</a>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'nisa_test_operation_planner_20260527.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  candidates: planRows.length,
  classCounts,
  output: 'nisa_test_operation_planner_20260527.html',
}, null, 2));
