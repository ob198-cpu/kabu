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

const marketGateRows = [
  {
    updated_at: generatedAt,
    gate: '米CPI',
    watch: '米5月CPI発表後の米10年金利、NASDAQ、SOX、ドル円',
    green: 'CPIが市場予想から大きく上振れず、米10年金利の急騰が限定的',
    yellow: 'CPIは高いが、株価指数が崩れず、金利上昇も一時的',
    red: 'CPI再加速と米10年金利急騰が同時に発生',
    action: '赤なら個別株比率を下げ、半導体・高PER候補は再確認まで保留',
  },
  {
    updated_at: generatedAt,
    gate: '日銀',
    watch: '政策金利、声明、国債買入れ、ドル円、銀行株、内需株',
    green: '円相場が急変せず、銀行株・内需株が市場に大きく劣後しない',
    yellow: '円高または銀行株の反応がまちまち',
    red: '急な円高、銀行株の市場劣後、輸出・海外比率高い銘柄の急落',
    action: '赤なら銀行・海外比率高い候補は比率を下げ、追加判断を延期',
  },
  {
    updated_at: generatedAt,
    gate: 'FOMC',
    watch: '政策金利、SEP、ドットプロット、米10年金利、NASDAQ、SOX',
    green: '金利見通しが大きく悪化せず、NASDAQ/SOXが崩れない',
    yellow: '金利は高止まりだが、株式市場の下落が限定的',
    red: 'ドットプロット悪化、米10年金利急騰、NASDAQ/SOXの大幅下落',
    action: '赤なら半導体・成長株を保留し、守り寄り候補へ比重を移す',
  },
  {
    updated_at: generatedAt,
    gate: '指数比較',
    watch: 'S&P500、日経平均、TOPIXに対して+1%以上上回れる見込み',
    green: '候補群の相対強度が指数を上回り、下落耐性も悪化しない',
    yellow: '候補群の優位性が小さい',
    red: '指数連動投資を1%以上上回る根拠が弱い',
    action: '赤なら個別株比率を下げ、指数・現金比率を上げる',
  },
];

const stockGateRows = [
  {
    updated_at: generatedAt,
    gate: '20営業日反応',
    pass: '対日経平均の20営業日超過リターンが0%以上。主候補は+3%以上なら強い',
    caution: '-5%〜0%は理由確認。決算内容と市場全体の影響を分解',
    fail: '-5%以下、または弱い反応の理由が説明できない',
    action: 'Failは主候補から外し、比較枠または検算枠へ下げる',
  },
  {
    updated_at: generatedAt,
    gate: '量的データ',
    pass: 'PER、ROE、売上成長、利益成長、信頼度が説明可能',
    caution: 'PER補助値や同業比較不足が残る',
    fail: '重要指標が未取得、または説明に耐えない',
    action: 'Failは候補確定に使わず、補完待ちへ戻す',
  },
  {
    updated_at: generatedAt,
    gate: '質的材料',
    pass: '会社資料・セグメント数値・市場統計で仮説を確認できる',
    caution: '話題性はあるが数字への接続が弱い',
    fail: '質的材料だけで、売上・利益・受注・株価反応に接続できない',
    action: '質的材料は単独加点せず、Failなら上限評価を下げる',
  },
  {
    updated_at: generatedAt,
    gate: '下落リスク',
    pass: '決算後・市場イベント後も急落や指数劣後が限定的',
    caution: '短期過熱、PER高、出来高急増などがある',
    fail: 'イベント後に急落、または高PER調整が継続',
    action: 'Failは購入候補ではなく観察候補に下げる',
  },
];

const finalDecisionRows = [
  {
    updated_at: generatedAt,
    result: '主候補維持',
    condition: '市場ゲートが赤でなく、量的データが説明可能、20営業日反応が悪化していない',
    action: '6月再判定で候補に残す',
  },
  {
    updated_at: generatedAt,
    result: '比較枠へ下げる',
    condition: '数字は悪くないが、指数を1%以上上回る根拠が弱い、または反応が鈍い',
    action: '購入候補ではなく比較対象として残す',
  },
  {
    updated_at: generatedAt,
    result: '補完待ち',
    condition: 'PER、同業比較、公式値、決算後反応のどれかが説明に不足',
    action: '数値がそろうまで候補確定に使わない',
  },
  {
    updated_at: generatedAt,
    result: '見送り',
    condition: '市場ゲート赤、20営業日反応Fail、質的仮説が数字で確認できない',
    action: 'NISA 1年保有テスト候補から外す',
  },
];

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '目的',
    value: '6月の再判定を機械的に進める',
    meaning: 'イベント後に感覚で判断せず、残す・下げる・補完待ち・見送りを条件で分ける。',
  },
  {
    updated_at: generatedAt,
    item: '重要方針',
    value: '質的材料は単独加点しない',
    meaning: '時流・イベント仮説は確認条件として使う。',
  },
  {
    updated_at: generatedAt,
    item: '+1%目標',
    value: '指数超過が弱ければ比率を下げる',
    meaning: 'S&P500、日経平均、TOPIXを1%以上上回る根拠が薄い場合、個別株比率を抑える。',
  },
];

writeCsv('545_candidate_10_june_gate_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'meaning',
]);
writeCsv('546_candidate_10_june_market_gate_rules.csv', marketGateRows, [
  'updated_at',
  'gate',
  'watch',
  'green',
  'yellow',
  'red',
  'action',
]);
writeCsv('547_candidate_10_june_stock_gate_rules.csv', stockGateRows, [
  'updated_at',
  'gate',
  'pass',
  'caution',
  'fail',
  'action',
]);
writeCsv('548_candidate_10_june_final_decision_rules.csv', finalDecisionRows, [
  'updated_at',
  'result',
  'condition',
  'action',
]);

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 6月判定ルール 2026年5月27日</title>
  <style>
    :root { --ink:#061a33; --muted:#334155; --line:#c9d9ea; --bg:#f4f8fc; --navy:#0d3658; --blue:#0b6fa4; --soft:#eef7ff; --amber:#b45309; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; background:var(--bg); color:var(--ink); line-height:1.72; letter-spacing:0; }
    header { background:var(--navy); color:#fff; padding:34px clamp(18px,4vw,58px); }
    h1 { margin:0 0 8px; font-size:clamp(28px,4vw,42px); letter-spacing:0; }
    header p { margin:0; color:#fff; font-weight:800; max-width:1120px; }
    main { width:min(1260px, calc(100% - 32px)); margin:24px auto 56px; }
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
    table { width:100%; min-width:1120px; border-collapse:collapse; table-layout:fixed; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:9px; vertical-align:top; text-align:left; overflow-wrap:anywhere; word-break:break-word; color:#061a33; }
    th { background:#e6f1fb; color:#073b63; font-weight:900; }
    tr:last-child td { border-bottom:0; }
    th:last-child,td:last-child { border-right:0; }
    @media (max-width:900px) { .summary { grid-template-columns:1fr; } main { width:min(100% - 20px,1260px); } section { padding:16px; } }
  </style>
</head>
<body>
  <header>
    <h1>候補10社 6月判定ルール</h1>
    <p>6月のCPI・日銀・FOMC・決算後20営業日反応を確認した後、残す・下げる・補完待ち・見送りを分けるルールです。</p>
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
      <p class="notice">このルールは再判定のための条件表です。日付前に購入を確定しません。</p>
      <div class="toolbar">
        <a class="button" href="545_candidate_10_june_gate_summary.csv">545 要約CSV</a>
        <a class="button" href="546_candidate_10_june_market_gate_rules.csv">546 市場ゲートCSV</a>
        <a class="button" href="547_candidate_10_june_stock_gate_rules.csv">547 銘柄ゲートCSV</a>
        <a class="button" href="548_candidate_10_june_final_decision_rules.csv">548 最終分岐CSV</a>
        <a class="button" href="candidate_10_june_decision_calendar_20260527.html">6月カレンダーへ</a>
      </div>
    </section>

    <section>
      <h2>市場ゲート</h2>
      ${table(
        [
          { key: 'gate', label: '確認対象' },
          { key: 'watch', label: '見る数値' },
          { key: 'green', label: '進めやすい条件' },
          { key: 'yellow', label: '注意条件' },
          { key: 'red', label: '止める条件' },
          { key: 'action', label: '対応' },
        ],
        marketGateRows,
      )}
    </section>

    <section>
      <h2>銘柄ゲート</h2>
      ${table(
        [
          { key: 'gate', label: '確認対象' },
          { key: 'pass', label: '残す条件' },
          { key: 'caution', label: '注意条件' },
          { key: 'fail', label: '下げる条件' },
          { key: 'action', label: '対応' },
        ],
        stockGateRows,
      )}
    </section>

    <section>
      <h2>最終分岐</h2>
      ${table(
        [
          { key: 'result', label: '判定' },
          { key: 'condition', label: '条件' },
          { key: 'action', label: '対応' },
        ],
        finalDecisionRows,
      )}
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_june_gate_rules_20260527.html'), html, 'utf8');

console.log('created candidate_10_june_gate_rules_20260527.html');
