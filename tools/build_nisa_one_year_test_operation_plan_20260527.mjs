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

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '目的',
    value: 'NISA 1年保有テスト',
    meaning: 'S&P500、日経平均、TOPIX、通常の投資会社運用を1%以上上回る可能性を検証する。',
  },
  {
    updated_at: generatedAt,
    item: '開始判断',
    value: '6月イベント後',
    meaning: 'CPI、日銀、FOMC、候補銘柄の20営業日反応を確認してから再判定する。',
  },
  {
    updated_at: generatedAt,
    item: '資金配分',
    value: '0〜40%',
    meaning: 'ゲート通過状況に応じて、個別株テスト比率を0%、10〜20%、30〜40%に分ける。',
  },
  {
    updated_at: generatedAt,
    item: '安全策',
    value: '未通過なら投入しない',
    meaning: '指数超過の根拠が弱い場合、個別株比率を下げる。',
  },
];

const scenarioRows = [
  {
    updated_at: generatedAt,
    scenario: 'A 強めにテスト',
    condition: '市場ゲートが赤なし、主候補3社の20営業日反応が悪化せず、指数を1%以上上回る根拠がある',
    individual_ratio: '30〜40%',
    benchmark_or_cash_ratio: '60〜70%',
    action: '主候補3社を中心に少額分散。比較枠は1社まで補助的に検討。',
  },
  {
    updated_at: generatedAt,
    scenario: 'B 小さくテスト',
    condition: '市場ゲートは赤ではないが、候補の優位性が一部弱い、または20営業日反応がまちまち',
    individual_ratio: '10〜20%',
    benchmark_or_cash_ratio: '80〜90%',
    action: '主候補のうち通過条件が明確な銘柄だけに限定。比較枠は入れない。',
  },
  {
    updated_at: generatedAt,
    scenario: 'C 見送り',
    condition: 'CPI・日銀・FOMCのいずれかが赤、または指数を1%以上上回る根拠が弱い',
    individual_ratio: '0%',
    benchmark_or_cash_ratio: '100%',
    action: '個別株への投入を行わず、データ更新と候補入れ替えを継続。',
  },
];

const processRows = [
  {
    updated_at: generatedAt,
    step: '1',
    period: '2026-05-27〜2026-06-09',
    task: '候補10社の追加確認',
    detail: '主候補3社の説明根拠、比較枠3社の上げ下げ条件、補完待ち銘柄の不足値を整理。',
    output: '候補10社説明整理、次データ確認タスク',
  },
  {
    updated_at: generatedAt,
    step: '2',
    period: '2026-06-10',
    task: '米CPI確認',
    detail: 'CPI、米10年金利、ドル円、NASDAQ/SOXの反応を確認。',
    output: '市場ゲート判定',
  },
  {
    updated_at: generatedAt,
    step: '3',
    period: '2026-06-15〜2026-06-17',
    task: '日銀・FOMC確認',
    detail: '政策金利、声明、金利見通し、円相場、銀行株・半導体株・指数の反応を確認。',
    output: '6月再判定',
  },
  {
    updated_at: generatedAt,
    step: '4',
    period: '2026-06-18〜2026-06-24',
    task: '初回テスト可否',
    detail: 'A/B/Cシナリオに従い、個別株比率を0%、10〜20%、30〜40%に分ける。',
    output: '検証候補または見送り判断',
  },
  {
    updated_at: generatedAt,
    step: '5',
    period: '毎月1回',
    task: '1年保有テスト記録',
    detail: '候補銘柄、指数、想定との差、下落理由、イベント後反応を記録する。',
    output: '月次検証ログ',
  },
];

const riskRows = [
  {
    updated_at: generatedAt,
    trigger: '検証候補が日経平均/TOPIX/S&P500を1%以上上回る根拠が弱い',
    action: '個別株比率を下げる',
    meaning: '個別株へ入れる予定額を減らし、指数・現金側へ残す。無理に10社へ資金を入れない。',
  },
  {
    updated_at: generatedAt,
    trigger: '投入後に銘柄が-5%下落',
    action: '理由確認',
    meaning: '市場全体要因か、個別悪材料か、決算後反応の悪化かを分ける。即売り固定ではない。',
  },
  {
    updated_at: generatedAt,
    trigger: '投入後に銘柄が-8〜10%下落し、指数より大きく劣後',
    action: '比率縮小または候補入れ替え検討',
    meaning: 'NISA枠の長期保有前提でも、仮説が崩れた場合は観察枠へ下げる。',
  },
  {
    updated_at: generatedAt,
    trigger: '会社の下方修正、主力事業の悪化、質的仮説の否定',
    action: '購入候補から外す',
    meaning: 'イベント仮説が数字で否定された場合は、テーマ性だけで残さない。',
  },
  {
    updated_at: generatedAt,
    trigger: '日経平均が75日線を明確に下回り、候補群も同時に劣後',
    action: '新規投入停止',
    meaning: '市場全体が崩れている場合は、個別株の有望性より安全側を優先する。',
  },
];

const recordRows = [
  {
    updated_at: generatedAt,
    field: '銘柄',
    detail: 'コード、会社名、役割、購入候補になった理由',
  },
  {
    updated_at: generatedAt,
    field: '購入前スコア',
    detail: '量的評価、質的確認、決算後反応、信頼度、ゲート判定',
  },
  {
    updated_at: generatedAt,
    field: '比較対象',
    detail: 'S&P500、日経平均、TOPIX、必要に応じて同業指数',
  },
  {
    updated_at: generatedAt,
    field: '1か月後/3か月後/6か月後/1年後',
    detail: '候補銘柄と指数の差、想定との差、外部イベントの影響を記録',
  },
  {
    updated_at: generatedAt,
    field: '判断変更',
    detail: '残す、下げる、見送り、入れ替えの理由を記録',
  },
];

writeCsv('551_nisa_one_year_test_operation_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'meaning',
]);
writeCsv('552_nisa_one_year_test_allocation_scenarios.csv', scenarioRows, [
  'updated_at',
  'scenario',
  'condition',
  'individual_ratio',
  'benchmark_or_cash_ratio',
  'action',
]);
writeCsv('553_nisa_one_year_test_process.csv', processRows, [
  'updated_at',
  'step',
  'period',
  'task',
  'detail',
  'output',
]);
writeCsv('554_nisa_one_year_test_risk_rules.csv', riskRows, [
  'updated_at',
  'trigger',
  'action',
  'meaning',
]);
writeCsv('555_nisa_one_year_test_record_fields.csv', recordRows, [
  'updated_at',
  'field',
  'detail',
]);

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NISA 1年保有テスト 運用手順 2026年5月27日</title>
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
    .metric { border:1px solid var(--line); border-radius:8px; padding:14px; background:var(--soft); min-height:132px; }
    .metric span { display:block; color:var(--muted); font-weight:900; }
    .metric strong { display:block; color:var(--blue); font-size:22px; line-height:1.35; }
    .notice { border-left:8px solid var(--amber); background:#fff7ed; padding:14px; border-radius:8px; font-weight:900; color:#111827; }
    .toolbar { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .button { display:inline-flex; align-items:center; min-height:38px; padding:8px 12px; border-radius:8px; border:1px solid #9cc8ec; background:#fff; color:var(--navy); text-decoration:none; font-weight:900; font-size:13px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:8px; }
    table { width:100%; min-width:1080px; border-collapse:collapse; table-layout:fixed; }
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
    <h1>NISA 1年保有テスト 運用手順</h1>
    <p>6月の再判定後に、個別株比率をどう決め、何を記録し、どの条件で下げるかを整理した手順です。</p>
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
      <p class="notice">この資料は運用テストの手順です。購入確定ではありません。</p>
      <div class="toolbar">
        <a class="button" href="551_nisa_one_year_test_operation_summary.csv">551 要約CSV</a>
        <a class="button" href="552_nisa_one_year_test_allocation_scenarios.csv">552 配分CSV</a>
        <a class="button" href="553_nisa_one_year_test_process.csv">553 手順CSV</a>
        <a class="button" href="554_nisa_one_year_test_risk_rules.csv">554 リスクCSV</a>
        <a class="button" href="candidate_10_june_gate_rules_20260527.html">6月判定ルールへ</a>
      </div>
    </section>

    <section>
      <h2>配分シナリオ</h2>
      ${table(
        [
          { key: 'scenario', label: 'シナリオ' },
          { key: 'condition', label: '条件' },
          { key: 'individual_ratio', label: '個別株比率' },
          { key: 'benchmark_or_cash_ratio', label: '指数・現金比率' },
          { key: 'action', label: '対応' },
        ],
        scenarioRows,
      )}
    </section>

    <section>
      <h2>実施手順</h2>
      ${table(
        [
          { key: 'step', label: '手順' },
          { key: 'period', label: '時期' },
          { key: 'task', label: '作業' },
          { key: 'detail', label: '内容' },
          { key: 'output', label: '成果' },
        ],
        processRows,
      )}
    </section>

    <section>
      <h2>安全ルール</h2>
      ${table(
        [
          { key: 'trigger', label: 'トリガー' },
          { key: 'action', label: '対応' },
          { key: 'meaning', label: '意味' },
        ],
        riskRows,
      )}
    </section>

    <section>
      <h2>記録項目</h2>
      ${table(
        [
          { key: 'field', label: '項目' },
          { key: 'detail', label: '記録内容' },
        ],
        recordRows,
      )}
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'nisa_one_year_test_operation_plan_20260527.html'), html, 'utf8');

console.log('created nisa_one_year_test_operation_plan_20260527.html');
