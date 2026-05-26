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

function inputType(task) {
  if (task.includes('財務')) return 'financial';
  if (task.includes('同業')) return 'peer';
  if (task.includes('PBR') || task.includes('ROE') || task.includes('PER')) return 'valuation';
  if (task.includes('決算後')) return 'reaction';
  if (task.includes('イベント')) return 'event';
  return 'market';
}

function requiredFields(type) {
  if (type === 'financial') return 'source_url / source_date / forecast_per / actual_per / eps_basis';
  if (type === 'valuation') return 'source_url / source_date / per / pbr / roe / sector_median_basis';
  if (type === 'peer') return 'peer_ticker_1 / peer_ticker_2 / peer_per_median / peer_pbr_median / peer_roe_median';
  if (type === 'reaction') return 'event_date / ret_1d_excess / ret_5d_excess / ret_20d_excess / reaction_rating';
  if (type === 'event') return 'event_name / event_date / hypothesis / price_reaction / evidence_rating';
  return 'cpi_result / fomc_result / boj_result / nikkei_status';
}

function sourceHint(type) {
  if (type === 'financial') return '会社IR、決算短信、EDINET、J-Quants';
  if (type === 'valuation') return '会社IR、J-Quants、EDINET、同業中央値CSV';
  if (type === 'peer') return '同業会社IR、J-Quants、既存CSV';
  if (type === 'reaction') return '株価OHLCV、日経平均/TOPIX、イベント日';
  if (type === 'event') return '企業IR、TDnet、公式発表、株価OHLCV';
  return 'FRED、日銀、統計局、指数データ';
}

const checklistRows = readCsv('472_candidate_10_tomorrow_checklist.csv');
const cards = readCsv('471_candidate_10_explanation_cards.csv');

const inputRows = checklistRows.map((row, index) => {
  const type = inputType(row.task);
  return {
    updated_at: generatedAt,
    input_id: `IN-${String(index + 1).padStart(2, '0')}`,
    ticker: row.ticker,
    company: row.company,
    task_no: row.task_no,
    input_type: type,
    task: row.task,
    required_fields: requiredFields(type),
    source_hint: sourceHint(type),
    pass_condition: '出典、基準日、入力値がそろうこと。未確認値は採点に使わない',
    status: '未入力',
  };
});

const byTickerRows = cards.map((card) => {
  const tasks = inputRows.filter((row) => row.ticker === card.ticker);
  return {
    updated_at: generatedAt,
    ticker: card.ticker,
    company: card.company,
    total_tasks: tasks.length,
    financial_tasks: tasks.filter((row) => row.input_type === 'financial').length,
    valuation_tasks: tasks.filter((row) => row.input_type === 'valuation').length,
    peer_tasks: tasks.filter((row) => row.input_type === 'peer').length,
    reaction_tasks: tasks.filter((row) => row.input_type === 'reaction').length,
    event_tasks: tasks.filter((row) => row.input_type === 'event').length,
    current_decision: card.current_decision,
  };
});

const decisionRows = [
  {
    updated_at: generatedAt,
    rule: '入力済み',
    condition: '出典URL、基準日、入力値、予想/実績区分がそろう',
    action: '採用候補として検算へ進める',
  },
  {
    updated_at: generatedAt,
    rule: '一部不足',
    condition: '数値はあるが出典や基準日が不足',
    action: '説明補助に止め、点数へ入れない',
  },
  {
    updated_at: generatedAt,
    rule: '未取得',
    condition: '値がない、または取得元が不安定',
    action: '未接続として残し、候補順位を保守的に扱う',
  },
  {
    updated_at: generatedAt,
    rule: '質的情報',
    condition: 'イベント仮説のみで実績反応がない',
    action: '調査理由として記録し、加点しない',
  },
  {
    updated_at: generatedAt,
    rule: '購入判断',
    condition: '6月イベント実数が未入力',
    action: '購入判断は出さない',
  },
];

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '入力対象',
    value: `${inputRows.length}件`,
    interpretation: '明日候補10社の根拠を固めるために入力・確認する作業。',
  },
  {
    updated_at: generatedAt,
    item: '対象銘柄',
    value: `${byTickerRows.length}社`,
    interpretation: '候補10社を銘柄別に管理。',
  },
  {
    updated_at: generatedAt,
    item: '初期状態',
    value: '全件未入力',
    interpretation: 'このコックピットは明日の入力作業用。未入力値は採点に使わない。',
  },
  {
    updated_at: generatedAt,
    item: '購入判断',
    value: '0社',
    interpretation: '6月イベント後の再判定までは購入判断にしない。',
  },
];

writeCsv('474_candidate_10_input_cockpit_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'interpretation',
]);

writeCsv('475_candidate_10_input_queue.csv', inputRows, [
  'updated_at',
  'input_id',
  'ticker',
  'company',
  'task_no',
  'input_type',
  'task',
  'required_fields',
  'source_hint',
  'pass_condition',
  'status',
]);

writeCsv('476_candidate_10_input_by_ticker.csv', byTickerRows, [
  'updated_at',
  'ticker',
  'company',
  'total_tasks',
  'financial_tasks',
  'valuation_tasks',
  'peer_tasks',
  'reaction_tasks',
  'event_tasks',
  'current_decision',
]);

writeCsv('477_candidate_10_input_decision_rules.csv', decisionRows, [
  'updated_at',
  'rule',
  'condition',
  'action',
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

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 明日入力コックピット</title>
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
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 18px;
      margin: 16px 0;
      box-shadow: 0 8px 20px rgba(20, 57, 91, .06);
    }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; }
    table { width: 100%; min-width: 980px; border-collapse: collapse; table-layout: fixed; background: white; }
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
      table { min-width: 760px; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <h1>候補10社 明日入力コックピット</h1>
      <p>明日、候補10社の根拠を固めるために入力・確認する項目を、銘柄別、作業別、必要項目別に整理しました。</p>
      <div class="actions">
        <a class="button" href="candidate_10_explanation_cards_20260526.html">説明カードへ戻る</a>
        <a class="button" href="475_candidate_10_input_queue.csv">入力キューCSV</a>
        <a class="button" href="476_candidate_10_input_by_ticker.csv">銘柄別CSV</a>
        <a class="button" href="477_candidate_10_input_decision_rules.csv">判定ルールCSV</a>
      </div>
      <div class="kpis">
        <div class="kpi"><b>${inputRows.length}</b><span>入力・確認項目</span></div>
        <div class="kpi"><b>${byTickerRows.length}</b><span>対象銘柄</span></div>
        <div class="kpi"><b>未入力</b><span>初期状態</span></div>
        <div class="kpi"><b>0社</b><span>購入判断</span></div>
      </div>
    </section>

    <div class="notice">
      入力値は、出典・基準日・予想/実績区分がそろうまで採点へ接続しません。
    </div>

    <section class="panel">
      <h2>銘柄別の入力件数</h2>
      ${table(
        [
          { key: 'ticker', label: '銘柄' },
          { key: 'company', label: '会社' },
          { key: 'total_tasks', label: '合計' },
          { key: 'financial_tasks', label: '財務' },
          { key: 'peer_tasks', label: '同業' },
          { key: 'reaction_tasks', label: '反応' },
          { key: 'event_tasks', label: 'イベント' },
          { key: 'current_decision', label: '現在の扱い' },
        ],
        byTickerRows,
      )}
    </section>

    <section class="panel">
      <h2>入力キュー</h2>
      ${table(
        [
          { key: 'input_id', label: 'ID' },
          { key: 'ticker', label: '銘柄' },
          { key: 'company', label: '会社' },
          { key: 'input_type', label: '分類' },
          { key: 'task', label: '作業' },
          { key: 'required_fields', label: '必要項目' },
          { key: 'source_hint', label: '取得元候補' },
          { key: 'status', label: '状態' },
        ],
        inputRows,
      )}
    </section>

    <section class="panel">
      <h2>判定ルール</h2>
      ${table(
        [
          { key: 'rule', label: '区分' },
          { key: 'condition', label: '条件' },
          { key: 'action', label: '扱い' },
        ],
        decisionRows,
      )}
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_input_cockpit_20260526.html'), html, 'utf8');

console.log('created candidate_10_input_cockpit_20260526.html');
console.log(`inputs=${inputRows.length}, tickers=${byTickerRows.length}`);
