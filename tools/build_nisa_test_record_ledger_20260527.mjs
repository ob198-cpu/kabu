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

const ledgerRows = [
  {
    updated_at: generatedAt,
    record_date: '2026-06-18',
    timing: '再判定時',
    ticker: '',
    company: '',
    role: '',
    decision: '',
    reason: '',
    market_gate: '',
    stock_gate: '',
    expected_return_pct: '',
    expected_loss_pct: '',
    benchmark: 'S&P500 / 日経平均 / TOPIX',
    benchmark_return_pct: '',
    stock_return_pct: '',
    excess_return_pct: '',
    action: '',
    note: '',
  },
  {
    updated_at: generatedAt,
    record_date: '2026-07-31',
    timing: '1か月確認',
    ticker: '',
    company: '',
    role: '',
    decision: '',
    reason: '',
    market_gate: '',
    stock_gate: '',
    expected_return_pct: '',
    expected_loss_pct: '',
    benchmark: 'S&P500 / 日経平均 / TOPIX',
    benchmark_return_pct: '',
    stock_return_pct: '',
    excess_return_pct: '',
    action: '',
    note: '',
  },
  {
    updated_at: generatedAt,
    record_date: '2026-09-30',
    timing: '3か月確認',
    ticker: '',
    company: '',
    role: '',
    decision: '',
    reason: '',
    market_gate: '',
    stock_gate: '',
    expected_return_pct: '',
    expected_loss_pct: '',
    benchmark: 'S&P500 / 日経平均 / TOPIX',
    benchmark_return_pct: '',
    stock_return_pct: '',
    excess_return_pct: '',
    action: '',
    note: '',
  },
  {
    updated_at: generatedAt,
    record_date: '2026-12-31',
    timing: '6か月確認',
    ticker: '',
    company: '',
    role: '',
    decision: '',
    reason: '',
    market_gate: '',
    stock_gate: '',
    expected_return_pct: '',
    expected_loss_pct: '',
    benchmark: 'S&P500 / 日経平均 / TOPIX',
    benchmark_return_pct: '',
    stock_return_pct: '',
    excess_return_pct: '',
    action: '',
    note: '',
  },
  {
    updated_at: generatedAt,
    record_date: '2027-06-30',
    timing: '1年確認',
    ticker: '',
    company: '',
    role: '',
    decision: '',
    reason: '',
    market_gate: '',
    stock_gate: '',
    expected_return_pct: '',
    expected_loss_pct: '',
    benchmark: 'S&P500 / 日経平均 / TOPIX',
    benchmark_return_pct: '',
    stock_return_pct: '',
    excess_return_pct: '',
    action: '',
    note: '',
  },
];

const fieldRows = [
  {
    field: 'decision',
    meaning: '主候補維持、比較枠、補完待ち、見送りなどの判定',
    input_rule: '6月判定ルールの結果名とそろえる',
  },
  {
    field: 'market_gate',
    meaning: 'CPI、日銀、FOMC、指数比較の市場ゲート',
    input_rule: '緑、黄、赤のいずれかで記録',
  },
  {
    field: 'stock_gate',
    meaning: '20営業日反応、量的データ、質的確認、下落リスクの銘柄ゲート',
    input_rule: 'Pass、Caution、Failのいずれかで記録',
  },
  {
    field: 'excess_return_pct',
    meaning: '銘柄リターンから比較対象リターンを引いた値',
    input_rule: 'stock_return_pct - benchmark_return_pct',
  },
  {
    field: 'action',
    meaning: '維持、比率縮小、見送り、候補入れ替えなど',
    input_rule: '安全ルールの対応とそろえる',
  },
];

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '用途',
    value: '予想と実績の差を記録',
    meaning: '6月以降のテストで、なぜ残したか、結果がどうだったかを後で検証する。',
  },
  {
    updated_at: generatedAt,
    item: '比較軸',
    value: '指数比 +1%',
    meaning: 'S&P500、日経平均、TOPIXを1%以上上回れたかを記録する。',
  },
  {
    updated_at: generatedAt,
    item: '更新頻度',
    value: '再判定時 / 1か月 / 3か月 / 6か月 / 1年',
    meaning: '短期のブレと1年保有の結果を分けて見る。',
  },
];

writeCsv('556_nisa_test_record_ledger_template.csv', ledgerRows, [
  'updated_at',
  'record_date',
  'timing',
  'ticker',
  'company',
  'role',
  'decision',
  'reason',
  'market_gate',
  'stock_gate',
  'expected_return_pct',
  'expected_loss_pct',
  'benchmark',
  'benchmark_return_pct',
  'stock_return_pct',
  'excess_return_pct',
  'action',
  'note',
]);

writeCsv('557_nisa_test_record_field_rules.csv', fieldRows, [
  'field',
  'meaning',
  'input_rule',
]);

writeCsv('558_nisa_test_record_ledger_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'meaning',
]);

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NISA 1年保有テスト 記録台帳 2026年5月27日</title>
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
    .metric strong { display:block; color:var(--blue); font-size:22px; line-height:1.35; }
    .notice { border-left:8px solid var(--amber); background:#fff7ed; padding:14px; border-radius:8px; font-weight:900; color:#111827; }
    .toolbar { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .button { display:inline-flex; align-items:center; min-height:38px; padding:8px 12px; border-radius:8px; border:1px solid #9cc8ec; background:#fff; color:var(--navy); text-decoration:none; font-weight:900; font-size:13px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:8px; }
    table { width:100%; min-width:1280px; border-collapse:collapse; table-layout:fixed; }
    .field-table table { min-width:860px; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:9px; vertical-align:top; text-align:left; overflow-wrap:anywhere; word-break:break-word; color:#061a33; }
    th { background:#e6f1fb; color:#073b63; font-weight:900; }
    tr:last-child td { border-bottom:0; }
    th:last-child,td:last-child { border-right:0; }
    @media (max-width:900px) { .summary { grid-template-columns:1fr; } main { width:min(100% - 20px,1280px); } section { padding:16px; } }
  </style>
</head>
<body>
  <header>
    <h1>NISA 1年保有テスト 記録台帳</h1>
    <p>6月以降の判定、投入、保有中の差分、指数比較を記録するための台帳です。</p>
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
      <p class="notice">この台帳は検証用です。記録を残すことで、予想と実績の差を後から確認できます。</p>
      <div class="toolbar">
        <a class="button" href="556_nisa_test_record_ledger_template.csv">556 台帳CSV</a>
        <a class="button" href="557_nisa_test_record_field_rules.csv">557 入力ルールCSV</a>
        <a class="button" href="558_nisa_test_record_ledger_summary.csv">558 要約CSV</a>
        <a class="button" href="nisa_one_year_test_operation_plan_20260527.html">運用手順へ</a>
      </div>
    </section>

    <section>
      <h2>記録台帳テンプレート</h2>
      ${table(
        [
          { key: 'record_date', label: '記録日' },
          { key: 'timing', label: 'タイミング' },
          { key: 'ticker', label: 'コード' },
          { key: 'company', label: '銘柄' },
          { key: 'role', label: '役割' },
          { key: 'decision', label: '判定' },
          { key: 'reason', label: '理由' },
          { key: 'market_gate', label: '市場ゲート' },
          { key: 'stock_gate', label: '銘柄ゲート' },
          { key: 'expected_return_pct', label: '想定上昇率' },
          { key: 'expected_loss_pct', label: '想定下落率' },
          { key: 'benchmark', label: '比較対象' },
          { key: 'benchmark_return_pct', label: '指数騰落率' },
          { key: 'stock_return_pct', label: '銘柄騰落率' },
          { key: 'excess_return_pct', label: '超過リターン' },
          { key: 'action', label: '対応' },
          { key: 'note', label: 'メモ' },
        ],
        ledgerRows,
      )}
    </section>

    <section class="field-table">
      <h2>入力ルール</h2>
      ${table(
        [
          { key: 'field', label: '項目' },
          { key: 'meaning', label: '意味' },
          { key: 'input_rule', label: '入力ルール' },
        ],
        fieldRows,
      )}
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'nisa_test_record_ledger_20260527.html'), html, 'utf8');

console.log('created nisa_test_record_ledger_20260527.html');
