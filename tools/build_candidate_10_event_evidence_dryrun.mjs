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

function cleanLines(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n');
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function toNumber(value) {
  const n = Number(String(value ?? '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function pct(after, before) {
  const a = toNumber(after);
  const b = toNumber(before);
  if (a === null || b === null || b === 0) return '';
  return Number((((a - b) / b) * 100).toFixed(2));
}

function diff(a, b) {
  if (a === '' || b === '') return '';
  return Number((Number(a) - Number(b)).toFixed(2));
}

function evaluate(row) {
  const reverse = String(row.direction_match || '').includes('逆');
  const ex1 = toNumber(row.excess_return_1d_pct);
  const ex5 = toNumber(row.excess_return_5d_pct);
  const ex20 = toNumber(row.excess_return_20d_pct);
  if ([ex1, ex5, ex20].some((v) => v === null)) return '未判定';
  if (reverse) return 'C';
  if (ex1 >= 0 && (ex5 >= 3 || ex20 >= 3)) return 'S';
  if (ex5 >= 1 || ex20 >= 1) return 'A';
  if (ex5 > -1 && ex20 > -1) return 'B';
  return 'C';
}

function calculate(row) {
  const stock1 = pct(row.stock_price_1d, row.stock_price_before);
  const stock5 = pct(row.stock_price_5d, row.stock_price_before);
  const stock20 = pct(row.stock_price_20d, row.stock_price_before);
  const bench1 = pct(row.benchmark_1d, row.benchmark_before);
  const bench5 = pct(row.benchmark_5d, row.benchmark_before);
  const bench20 = pct(row.benchmark_20d, row.benchmark_before);
  const next = {
    ...row,
    stock_return_1d_pct: stock1,
    stock_return_5d_pct: stock5,
    stock_return_20d_pct: stock20,
    benchmark_return_1d_pct: bench1,
    benchmark_return_5d_pct: bench5,
    benchmark_return_20d_pct: bench20,
    excess_return_1d_pct: diff(stock1, bench1),
    excess_return_5d_pct: diff(stock5, bench5),
    excess_return_20d_pct: diff(stock20, bench20),
  };
  next.evidence_rating = evaluate(next);
  next.purchase_status = '購入判断不可';
  next.note = 'ドライラン用の架空値。実績値ではない。';
  return next;
}

const templateRows = readCsv('428_candidate_10_event_evidence_input_template.csv');
const sampleScenarios = [
  { stock: [1000, 1035, 1070, 1100], bench: [40000, 40200, 40400, 40600], direction: '一致' },
  { stock: [1000, 1010, 1015, 1025], bench: [40000, 40200, 40300, 40400], direction: '一致' },
  { stock: [1000, 990, 985, 980], bench: [40000, 40100, 40200, 40300], direction: '一致' },
  { stock: [1000, 1040, 1030, 1015], bench: [40000, 40400, 40500, 40600], direction: '短期のみ' },
  { stock: [1000, 1005, 1045, 1085], bench: [40000, 39900, 40000, 40100], direction: '一致' },
  { stock: [1000, 960, 940, 925], bench: [40000, 39200, 39000, 38800], direction: '逆方向' },
  { stock: [1000, 1020, 1035, 1048], bench: [40000, 40050, 40100, 40150], direction: '一致' },
  { stock: [1000, 1008, 1002, 1003], bench: [40000, 4000, 40000, 40020], direction: '一致', badBench: true },
  { stock: [1000, 1030, 1060, 1065], bench: [40000, 40100, 40250, 40300], direction: '一致' },
  { stock: [1000, 1002, 1005, 1007], bench: [40000, 40100, 40200, 40300], direction: '一致' },
];

const dryrunInputRows = templateRows.slice(0, 10).map((row, index) => {
  const scenario = sampleScenarios[index];
  const bench = scenario.badBench ? [40000, 40000, 40000, 40000] : scenario.bench;
  return {
    ...row,
    updated_at: generatedAt,
    event_date: 'DRYRUN-2026-06',
    event_source: '架空検算データ',
    stock_price_before: scenario.stock[0],
    stock_price_1d: scenario.stock[1],
    stock_price_5d: scenario.stock[2],
    stock_price_20d: scenario.stock[3],
    benchmark_before: bench[0],
    benchmark_1d: bench[1],
    benchmark_5d: bench[2],
    benchmark_20d: bench[3],
    direction_match: scenario.direction,
    evidence_rating: '未計算',
    purchase_status: '購入判断不可',
    note: 'ドライラン用の架空値。実績値ではない。',
  };
});

const calculatedRows = dryrunInputRows.map(calculate);
const verificationRows = calculatedRows.map((row) => {
  const hasReturns = ['stock_return_1d_pct', 'stock_return_5d_pct', 'stock_return_20d_pct', 'benchmark_return_1d_pct', 'benchmark_return_5d_pct', 'benchmark_return_20d_pct', 'excess_return_1d_pct', 'excess_return_5d_pct', 'excess_return_20d_pct']
    .every((key) => row[key] !== '');
  const hasRating = ['S', 'A', 'B', 'C', '未判定'].includes(row.evidence_rating);
  const noPurchase = row.purchase_status === '購入判断不可';
  return {
    updated_at: generatedAt,
    event_id: row.event_id,
    ticker: row.ticker,
    company: row.company,
    returns_calculated: hasReturns ? 'OK' : 'NG',
    rating_calculated: hasRating ? 'OK' : 'NG',
    purchase_blocked: noPurchase ? 'OK' : 'NG',
    evidence_rating: row.evidence_rating,
    check_result: hasReturns && hasRating && noPurchase ? '通過' : '要修正',
  };
});

const bridgeRows = [
  {
    updated_at: generatedAt,
    item: 'ドライランの位置づけ',
    detail: '架空データで計算器・CSV入出力・S〜C判定を検査する。売買判断には使わない。',
    next_action: '実イベント発生日に公式ソースと実株価を入力する。',
  },
  {
    updated_at: generatedAt,
    item: '6月テストへの接続',
    detail: 'CPI、日銀、FOMC、決算、製品・政策イベントごとに前日/1日/5日/20日の反応を記録する。',
    next_action: 'S/Aは候補維持の説明材料、Bは中立、Cは時流根拠から外す。',
  },
  {
    updated_at: generatedAt,
    item: '+1%目標への接続',
    detail: '個別株が日経平均/TOPIX/S&P500等を1%以上上回るかをイベント別に確認する。',
    next_action: 'イベント実績が弱い銘柄は個別株比率を下げ、指数・現金比率を上げる。',
  },
];

const operationRows = [
  {
    updated_at: generatedAt,
    step: 1,
    operation: 'テンプレートから10件を抽出',
    result: `${dryrunInputRows.length}件`,
  },
  {
    updated_at: generatedAt,
    step: 2,
    operation: '架空株価・架空指数を入力',
    result: '入力完了',
  },
  {
    updated_at: generatedAt,
    step: 3,
    operation: '個別リターン・指数リターン・超過リターンを計算',
    result: verificationRows.every((row) => row.returns_calculated === 'OK') ? '通過' : '要修正',
  },
  {
    updated_at: generatedAt,
    step: 4,
    operation: 'S〜C判定と購入判断ブロックを確認',
    result: verificationRows.every((row) => row.check_result === '通過') ? '通過' : '要修正',
  },
];

const headers = Object.keys(templateRows[0]);
writeCsv('432_candidate_10_event_dryrun_input.csv', dryrunInputRows, headers);
writeCsv('433_candidate_10_event_dryrun_calculated.csv', calculatedRows, headers);
writeCsv('434_candidate_10_event_dryrun_verification.csv', verificationRows, [
  'updated_at',
  'event_id',
  'ticker',
  'company',
  'returns_calculated',
  'rating_calculated',
  'purchase_blocked',
  'evidence_rating',
  'check_result',
]);
writeCsv('435_candidate_10_event_dryrun_bridge_to_selection.csv', bridgeRows, [
  'updated_at',
  'item',
  'detail',
  'next_action',
]);
writeCsv('436_candidate_10_event_dryrun_operation_log.csv', operationRows, [
  'updated_at',
  'step',
  'operation',
  'result',
]);

const ratingCounts = calculatedRows.reduce((acc, row) => {
  acc[row.evidence_rating] = (acc[row.evidence_rating] || 0) + 1;
  return acc;
}, {});

const passCount = verificationRows.filter((row) => row.check_result === '通過').length;
const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>イベント実績層 ドライラン検算</title>
  <style>
    :root {
      --ink: #111827;
      --muted: #4b5563;
      --line: #cfdced;
      --bg: #f5f8fc;
      --panel: #ffffff;
      --navy: #113a5c;
      --blue: #176da3;
      --green: #087a4d;
      --red: #b42318;
      --orange: #b65c00;
      --yellow: #fff7d6;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Yu Gothic", "Meiryo", Arial, sans-serif;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.7;
      letter-spacing: 0;
    }
    main {
      width: min(1160px, calc(100% - 32px));
      margin: 0 auto;
      padding: 28px 0 56px;
    }
    .hero {
      background: var(--navy);
      color: white;
      border-radius: 18px;
      padding: 26px;
      margin-bottom: 18px;
    }
    h1 {
      font-size: clamp(26px, 4vw, 42px);
      line-height: 1.2;
      margin: 0 0 10px;
      letter-spacing: 0;
    }
    h2 {
      font-size: 24px;
      color: var(--navy);
      margin: 0 0 10px;
      letter-spacing: 0;
    }
    p { margin: 0 0 12px; }
    .hero p { color: #e8f4ff; }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 18px;
      margin-bottom: 16px;
      box-shadow: 0 8px 20px rgba(20, 57, 91, .06);
    }
    .notice {
      border: 2px solid #f0c36c;
      background: var(--yellow);
      border-radius: 14px;
      padding: 14px 16px;
      font-weight: 800;
      color: #5f3900;
      margin-bottom: 16px;
    }
    .kpis {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
      margin-top: 16px;
    }
    .kpi {
      background: white;
      color: var(--ink);
      border: 1px solid #c9def3;
      border-radius: 12px;
      padding: 12px;
    }
    .kpi b { display: block; color: var(--blue); font-size: 28px; line-height: 1; }
    .kpi span { display: block; color: var(--muted); font-size: 12px; margin-top: 5px; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; }
    table {
      width: 100%;
      min-width: 900px;
      border-collapse: collapse;
      table-layout: fixed;
      background: white;
    }
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
    th {
      background: #e8f4ff;
      color: #073b63;
      font-weight: 800;
    }
    tr:last-child td { border-bottom: 0; }
    th:last-child, td:last-child { border-right: 0; }
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 28px;
      padding: 4px 9px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: #f8fbff;
      font-weight: 800;
      font-size: 12px;
      white-space: nowrap;
    }
    .badge.green { color: var(--green); background: #edf9f3; border-color: #bce7d2; }
    .badge.red { color: var(--red); background: #fff1f1; border-color: #ffd1d1; }
    .badge.orange { color: var(--orange); background: #fff3e2; border-color: #ffd7a3; }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 12px;
    }
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
    .small { color: var(--muted); font-size: 13px; }
    @media (max-width: 900px) {
      main { width: min(100% - 20px, 1160px); padding-top: 16px; }
      .kpis { grid-template-columns: 1fr 1fr; }
      table { min-width: 760px; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <h1>イベント実績層 ドライラン検算</h1>
      <p>イベント実績CSVに実数が入った時、個別リターン、指数リターン、超過リターン、S〜C判定が正しく出るかを架空データで検査しました。ここに表示している株価は実績値ではありません。</p>
      <div class="actions">
        <a class="button" href="candidate_10_event_evidence_workbench_20260526.html">イベント実績層へ戻る</a>
        <a class="button" href="index.html">トップへ戻る</a>
        <a class="button" href="433_candidate_10_event_dryrun_calculated.csv">計算済みCSV</a>
      </div>
      <div class="kpis">
        <div class="kpi"><b>${dryrunInputRows.length}</b><span>検算行数</span></div>
        <div class="kpi"><b>${passCount}</b><span>通過行数</span></div>
        <div class="kpi"><b>${ratingCounts.S || 0}/${ratingCounts.A || 0}/${ratingCounts.B || 0}/${ratingCounts.C || 0}</b><span>S/A/B/C件数</span></div>
        <div class="kpi"><b>0社</b><span>購入判断</span></div>
      </div>
    </section>

    <div class="notice">
      注意: このページは計算器の検査です。架空データのため、銘柄評価や売買判断には使いません。
    </div>

    <section class="panel">
      <h2>検算結果</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width: 110px;">ID</th>
              <th style="width: 110px;">銘柄</th>
              <th style="width: 170px;">会社</th>
              <th style="width: 120px;">リターン</th>
              <th style="width: 120px;">判定</th>
              <th style="width: 120px;">購入ブロック</th>
              <th style="width: 120px;">評価</th>
              <th style="width: 120px;">結果</th>
            </tr>
          </thead>
          <tbody>
            ${verificationRows.map((row) => `
              <tr>
                <td>${esc(row.event_id)}</td>
                <td>${esc(row.ticker)}</td>
                <td>${esc(row.company)}</td>
                <td>${esc(row.returns_calculated)}</td>
                <td>${esc(row.rating_calculated)}</td>
                <td>${esc(row.purchase_blocked)}</td>
                <td><span class="badge ${row.evidence_rating === 'C' ? 'red' : row.evidence_rating === 'B' ? 'orange' : 'green'}">${esc(row.evidence_rating)}</span></td>
                <td><span class="badge green">${esc(row.check_result)}</span></td>
              </tr>`).join('\n')}
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2>計算済みサンプル</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width: 110px;">ID</th>
              <th style="width: 110px;">銘柄</th>
              <th>テーマ</th>
              <th style="width: 120px;">5日個別</th>
              <th style="width: 120px;">5日指数</th>
              <th style="width: 120px;">5日超過</th>
              <th style="width: 120px;">20日超過</th>
              <th style="width: 120px;">評価</th>
            </tr>
          </thead>
          <tbody>
            ${calculatedRows.map((row) => `
              <tr>
                <td>${esc(row.event_id)}</td>
                <td>${esc(row.ticker)}</td>
                <td>${esc(row.event_theme)}</td>
                <td>${esc(row.stock_return_5d_pct)}%</td>
                <td>${esc(row.benchmark_return_5d_pct)}%</td>
                <td>${esc(row.excess_return_5d_pct)}%</td>
                <td>${esc(row.excess_return_20d_pct)}%</td>
                <td><span class="badge ${row.evidence_rating === 'C' ? 'red' : row.evidence_rating === 'B' ? 'orange' : 'green'}">${esc(row.evidence_rating)}</span></td>
              </tr>`).join('\n')}
          </tbody>
        </table>
      </div>
      <div class="actions">
        <a class="button" href="432_candidate_10_event_dryrun_input.csv">入力CSV</a>
        <a class="button" href="433_candidate_10_event_dryrun_calculated.csv">計算済みCSV</a>
        <a class="button" href="434_candidate_10_event_dryrun_verification.csv">検算CSV</a>
        <a class="button" href="435_candidate_10_event_dryrun_bridge_to_selection.csv">選定接続CSV</a>
        <a class="button" href="436_candidate_10_event_dryrun_operation_log.csv">作業ログCSV</a>
      </div>
    </section>

    <section class="panel">
      <h2>6月テストへの接続</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width: 190px;">項目</th>
              <th>内容</th>
              <th>次の作業</th>
            </tr>
          </thead>
          <tbody>
            ${bridgeRows.map((row) => `
              <tr>
                <td>${esc(row.item)}</td>
                <td>${esc(row.detail)}</td>
                <td>${esc(row.next_action)}</td>
              </tr>`).join('\n')}
          </tbody>
        </table>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_event_evidence_dryrun_verification_20260526.html'), html, 'utf8');

console.log('created candidate_10_event_evidence_dryrun_verification_20260526.html');
console.log(`dryrun rows=${dryrunInputRows.length}, pass=${passCount}`);
