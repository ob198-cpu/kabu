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
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  const headers = rows.shift() ?? [];
  return {
    headers,
    rows: rows
      .filter((items) => items.some((item) => String(item).trim() !== ''))
      .map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] ?? '']))),
  };
}

function readCsvWithHeaders(name) {
  const file = path.join(ROOT, name);
  if (!fs.existsSync(file)) return { headers: [], rows: [] };
  return parseCsv(fs.readFileSync(file, 'utf8'));
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

function statusClass(status) {
  if (/NG|不足|不一致|失敗/.test(status)) return 'bad';
  if (/確認|注意/.test(status)) return 'warn';
  if (/OK|一致|通過/.test(status)) return 'good';
  return '';
}

const sample = readCsvWithHeaders('402_semiconductor_dry_run_sample_result_log.csv');
const decision = readCsvWithHeaders('403_semiconductor_dry_run_decision_log.csv');
const prediction = readCsvWithHeaders('404_semiconductor_dry_run_prediction_actual_template.csv');
const bridgeDecision = readCsvWithHeaders('397_semiconductor_forward_decision_log_template.csv');
const bridgePrediction = readCsvWithHeaders('398_semiconductor_forward_prediction_actual_template.csv');

const requiredSampleHeaders = [
  'updated_at',
  'ticker',
  'company',
  'cpi_gate',
  'boj_gate',
  'fomc_gate',
  'index_gate',
  'per_after',
  'pbr_after',
  'roe_after',
  'revenue_yoy_after',
  'profit_yoy_after',
  'downside_after',
  'event_5d_excess_after',
  'sox_excess_after',
  'guidance_improved',
  'demand_comment',
  'final_status',
  'reason',
];

const requiredDecisionHeaders = [
  'updated_at',
  'decision_logged_at',
  'ticker',
  'company',
  'cpi_gate',
  'boj_gate',
  'fomc_gate',
  'index_gate',
  'june_first_status',
  'decision_reason',
  'next_record_due',
  'storage_note',
];

const requiredPredictionHeaders = [
  'updated_at',
  'ticker',
  'company',
  'event_date',
  'event',
  'before_event_price',
  'event_day_price',
  'return_1d_pct',
  'return_5d_pct',
  'return_20d_pct',
  'benchmark_return_1d_pct',
  'benchmark_return_5d_pct',
  'benchmark_return_20d_pct',
  'excess_1d_pct',
  'excess_5d_pct',
  'excess_20d_pct',
  'pre_event_prediction',
  'actual_result',
  'prediction_error_note',
  'next_model_fix',
];

function hasAll(headers, required) {
  const missing = required.filter((header) => !headers.includes(header));
  return { ok: missing.length === 0, missing };
}

function byTicker(rows) {
  return new Map(rows.map((row) => [row.ticker, row]));
}

const sampleByTicker = byTicker(sample.rows);
const decisionByTicker = byTicker(decision.rows);
const predictionByTicker = byTicker(prediction.rows);

const rowCountRows = [
  {
    updated_at: generatedAt,
    file: '402_semiconductor_dry_run_sample_result_log.csv',
    expected_rows: 6,
    actual_rows: sample.rows.length,
    status: sample.rows.length === 6 ? 'OK' : 'NG',
    note: '入力CSVサンプルは半導体6社分。',
  },
  {
    updated_at: generatedAt,
    file: '403_semiconductor_dry_run_decision_log.csv',
    expected_rows: sample.rows.length,
    actual_rows: decision.rows.length,
    status: decision.rows.length === sample.rows.length ? 'OK' : 'NG',
    note: '一次判定ログは入力CSVと同じ件数である必要がある。',
  },
  {
    updated_at: generatedAt,
    file: '404_semiconductor_dry_run_prediction_actual_template.csv',
    expected_rows: sample.rows.length,
    actual_rows: prediction.rows.length,
    status: prediction.rows.length === sample.rows.length ? 'OK' : 'NG',
    note: '予実差テンプレートも入力CSVと同じ件数である必要がある。',
  },
];

const headerChecks = [
  ['402_semiconductor_dry_run_sample_result_log.csv', sample.headers, requiredSampleHeaders],
  ['403_semiconductor_dry_run_decision_log.csv', decision.headers, requiredDecisionHeaders],
  ['404_semiconductor_dry_run_prediction_actual_template.csv', prediction.headers, requiredPredictionHeaders],
  ['397_semiconductor_forward_decision_log_template.csv', bridgeDecision.headers, requiredDecisionHeaders],
  ['398_semiconductor_forward_prediction_actual_template.csv', bridgePrediction.headers, requiredPredictionHeaders],
].map(([file, headers, required]) => {
  const check = hasAll(headers, required);
  return {
    updated_at: generatedAt,
    file,
    required_columns: required.length,
    actual_columns: headers.length,
    missing_columns: check.missing.join(' / '),
    status: check.ok ? 'OK' : 'NG',
  };
});

const conversionRows = sample.rows.map((row) => {
  const d = decisionByTicker.get(row.ticker) ?? {};
  const p = predictionByTicker.get(row.ticker) ?? {};
  const checks = [
    d.june_first_status === row.final_status,
    d.decision_reason === row.reason,
    d.cpi_gate === row.cpi_gate,
    d.boj_gate === row.boj_gate,
    d.fomc_gate === row.fomc_gate,
    d.index_gate === row.index_gate,
    p.pre_event_prediction === row.final_status,
    p.prediction_error_note === row.reason,
  ];
  const failed = checks.filter((ok) => !ok).length;
  return {
    updated_at: generatedAt,
    ticker: row.ticker,
    company: row.company,
    sample_final_status: row.final_status,
    decision_log_status: d.june_first_status || '',
    prediction_log_pre_event: p.pre_event_prediction || '',
    failed_checks: failed,
    status: failed === 0 ? 'OK' : 'NG',
    note: failed === 0 ? '入力CSVの判定と理由がログ側へ一致している。' : '変換結果に不一致あり。',
  };
});

const dummySafetyRows = sample.rows.map((row) => ({
  updated_at: generatedAt,
  ticker: row.ticker,
  company: row.company,
  has_dummy_label: String(row.reason || '').includes('ダミー') ? 'OK' : 'NG',
  final_status: row.final_status,
  note: String(row.reason || '').includes('ダミー') ? '理由欄にダミー明記あり。' : 'ダミー明記がない。',
}));

const allOk = [
  ...rowCountRows.map((row) => row.status === 'OK'),
  ...headerChecks.map((row) => row.status === 'OK'),
  ...conversionRows.map((row) => row.status === 'OK'),
  ...dummySafetyRows.map((row) => row.has_dummy_label === 'OK'),
].every(Boolean);

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '検算対象',
    value: 'ドライランCSV一式',
    interpretation: 'サンプル入力、一次判定ログ、予実差テンプレートの件数・列・変換内容を確認した。',
  },
  {
    updated_at: generatedAt,
    item: '件数チェック',
    value: rowCountRows.every((row) => row.status === 'OK') ? 'OK' : 'NG',
    interpretation: '入力6件に対し、一次判定ログ・予実差テンプレートも6件で一致。',
  },
  {
    updated_at: generatedAt,
    item: '列チェック',
    value: headerChecks.every((row) => row.status === 'OK') ? 'OK' : 'NG',
    interpretation: '必要列がそろっているか確認。',
  },
  {
    updated_at: generatedAt,
    item: '変換チェック',
    value: conversionRows.every((row) => row.status === 'OK') ? 'OK' : 'NG',
    interpretation: 'final_statusとreasonが一次判定ログ・予実差テンプレートへ一致して移っているか確認。',
  },
  {
    updated_at: generatedAt,
    item: '総合',
    value: allOk ? '通過' : '要修正',
    interpretation: allOk ? '本番前のCSV変換ルートは機械検算上は通過。' : '不一致があるため本番前に修正が必要。',
  },
];

const nextRows = [
  {
    updated_at: generatedAt,
    priority: 1,
    action: 'ブラウザで手動読込確認',
    reason: '機械検算は通過したが、実際のファイル選択・CSV出力操作はブラウザで確認する必要がある。',
    output: '読込プレビュー、一次判定ログCSV、予実差テンプレートCSV',
  },
  {
    updated_at: generatedAt,
    priority: 2,
    action: '6月イベント後の実績値入力',
    reason: 'ドライランはダミーのため、本番は6月10日以降の実値で入力する。',
    output: '半導体6月一次判定ログ',
  },
  {
    updated_at: generatedAt,
    priority: 3,
    action: '1/5/20営業日後の予実差記録',
    reason: '候補判定が実際に株価反応へつながったかを検証するため。',
    output: '予実差ログとモデル修正点',
  },
];

writeCsv('406_semiconductor_dry_run_verification_summary.csv', summaryRows, ['updated_at', 'item', 'value', 'interpretation']);
writeCsv('407_semiconductor_dry_run_row_count_check.csv', rowCountRows, ['updated_at', 'file', 'expected_rows', 'actual_rows', 'status', 'note']);
writeCsv('408_semiconductor_dry_run_column_check.csv', headerChecks, ['updated_at', 'file', 'required_columns', 'actual_columns', 'missing_columns', 'status']);
writeCsv('409_semiconductor_dry_run_conversion_check.csv', conversionRows, ['updated_at', 'ticker', 'company', 'sample_final_status', 'decision_log_status', 'prediction_log_pre_event', 'failed_checks', 'status', 'note']);
writeCsv('410_semiconductor_dry_run_dummy_safety_check.csv', dummySafetyRows, ['updated_at', 'ticker', 'company', 'has_dummy_label', 'final_status', 'note']);
writeCsv('411_semiconductor_dry_run_next_actions.csv', nextRows, ['updated_at', 'priority', 'action', 'reason', 'output']);

function table(headers, rows, cells) {
  return `<table>
    <thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((row) => `<tr>${cells.map((cell) => `<td>${cell(row)}</td>`).join('')}</tr>`).join('')}</tbody>
  </table>`;
}

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>半導体 ドライラン検算</title>
  <style>
    :root {
      --ink: #061d35;
      --muted: #334155;
      --blue: #0b5f92;
      --green: #047857;
      --amber: #b45309;
      --red: #b91c1c;
      --line: #cfe0f3;
      --panel: #fff;
      --soft: #f6fbff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Yu Gothic", "Meiryo", system-ui, sans-serif;
      color: var(--ink);
      background: var(--soft);
      line-height: 1.75;
    }
    header {
      background: linear-gradient(135deg, #082f49, #0b5f92);
      color: #fff;
      padding: 34px 26px 30px;
    }
    main {
      width: min(1180px, calc(100% - 28px));
      margin: 22px auto 60px;
    }
    h1, h2, h3 { margin: 0; line-height: 1.35; }
    h1 { font-size: clamp(26px, 4vw, 42px); }
    h2 {
      margin-top: 34px;
      padding-left: 12px;
      border-left: 7px solid var(--blue);
      font-size: 24px;
    }
    p { color: var(--muted); margin: 8px 0; }
    a { color: #075985; font-weight: 800; }
    .toolbar { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
    .toolbar a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      padding: 9px 14px;
      border-radius: 8px;
      background: #fff;
      color: #07385b;
      text-decoration: none;
      border: 1px solid #b8d4ee;
      box-shadow: 0 2px 6px rgba(0,0,0,.08);
      font-weight: 800;
    }
    .notice {
      margin-top: 16px;
      background: rgba(255,255,255,.12);
      border: 1px solid rgba(255,255,255,.35);
      padding: 14px 16px;
      border-radius: 10px;
      color: #fff;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 12px;
      margin-top: 16px;
    }
    .card, .section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 18px;
      box-shadow: 0 6px 20px rgba(8, 42, 73, .06);
      break-inside: avoid;
    }
    .section { margin-top: 14px; }
    .kpi { font-size: 28px; color: var(--blue); font-weight: 900; }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      background: #fff;
      table-layout: fixed;
    }
    th, td {
      border: 1px solid #d5e4f4;
      padding: 10px;
      vertical-align: top;
      overflow-wrap: anywhere;
      word-break: break-word;
      color: var(--ink);
    }
    th { background: #e7f2fb; text-align: left; font-weight: 900; }
    tbody tr:nth-child(even) { background: #fbfdff; }
    .good { color: var(--green); font-weight: 900; }
    .warn { color: var(--amber); font-weight: 900; }
    .bad { color: var(--red); font-weight: 900; }
    .badge {
      display: inline-block;
      padding: 3px 9px;
      border-radius: 999px;
      background: #e0f2fe;
      color: #075985;
      font-weight: 900;
    }
    @media (max-width: 860px) { table { font-size: 14px; } }
  </style>
</head>
<body>
  <header>
    <h1>半導体 ドライラン検算</h1>
    <p style="color:#e6f3ff">ドライランCSV一式が、件数・列・変換内容の面で正しくつながっているかを機械的に確認したページです。</p>
    <div class="notice">結論: ${allOk ? '機械検算は通過です。' : '不一致があり、修正が必要です。'} ただし、これはダミーデータの検算であり、6月の実績値ではありません。</div>
    <div class="toolbar">
      <a href="index.html">トップ</a>
      <a href="semiconductor_june_dry_run_test_20260526.html">ドライラン確認</a>
      <a href="semiconductor_forward_log_bridge_20260526.html">判定ログ接続</a>
      <a href="semiconductor_june_result_input_cockpit_20260526.html">6月実績入力</a>
      <a href="current_vs_history_materials_20260525.html">資料一覧</a>
    </div>
  </header>

  <main>
    <section class="grid">
      ${summaryRows.map((row) => `
        <div class="card">
          <h3>${esc(row.item)}</h3>
          <div class="kpi ${statusClass(row.value)}">${esc(row.value)}</div>
          <p>${esc(row.interpretation)}</p>
        </div>
      `).join('')}
    </section>

    <h2>1. 件数チェック</h2>
    <section class="section">
      ${table(
        ['ファイル', '期待件数', '実件数', '状態', '説明'],
        rowCountRows,
        [
          (row) => esc(row.file),
          (row) => esc(row.expected_rows),
          (row) => esc(row.actual_rows),
          (row) => `<span class="${statusClass(row.status)}">${esc(row.status)}</span>`,
          (row) => esc(row.note),
        ],
      )}
    </section>

    <h2>2. 列チェック</h2>
    <section class="section">
      ${table(
        ['ファイル', '必要列数', '実列数', '不足列', '状態'],
        headerChecks,
        [
          (row) => esc(row.file),
          (row) => esc(row.required_columns),
          (row) => esc(row.actual_columns),
          (row) => esc(row.missing_columns || 'なし'),
          (row) => `<span class="${statusClass(row.status)}">${esc(row.status)}</span>`,
        ],
      )}
    </section>

    <h2>3. 変換内容チェック</h2>
    <section class="section">
      ${table(
        ['銘柄', '入力判定', '一次ログ判定', '予実差側の事前判定', '不一致数', '状態'],
        conversionRows,
        [
          (row) => `<strong>${esc(row.ticker)} ${esc(row.company)}</strong>`,
          (row) => esc(row.sample_final_status),
          (row) => esc(row.decision_log_status),
          (row) => esc(row.prediction_log_pre_event),
          (row) => esc(row.failed_checks),
          (row) => `<span class="${statusClass(row.status)}">${esc(row.status)}</span>`,
        ],
      )}
    </section>

    <h2>4. ダミー明記チェック</h2>
    <section class="section">
      ${table(
        ['銘柄', 'ダミー明記', '判定', '説明'],
        dummySafetyRows,
        [
          (row) => `<strong>${esc(row.ticker)} ${esc(row.company)}</strong>`,
          (row) => `<span class="${statusClass(row.has_dummy_label)}">${esc(row.has_dummy_label)}</span>`,
          (row) => esc(row.final_status),
          (row) => esc(row.note),
        ],
      )}
    </section>

    <h2>5. 次アクション</h2>
    <section class="section">
      ${table(
        ['優先', '作業', '理由', '出力'],
        nextRows,
        [
          (row) => esc(row.priority),
          (row) => esc(row.action),
          (row) => esc(row.reason),
          (row) => esc(row.output),
        ],
      )}
    </section>

    <h2>6. 出力ファイル</h2>
    <section class="section">
      ${table(
        ['ファイル', '内容'],
        [
          ['406_semiconductor_dry_run_verification_summary.csv', '検算要約'],
          ['407_semiconductor_dry_run_row_count_check.csv', '件数チェック'],
          ['408_semiconductor_dry_run_column_check.csv', '列チェック'],
          ['409_semiconductor_dry_run_conversion_check.csv', '変換内容チェック'],
          ['410_semiconductor_dry_run_dummy_safety_check.csv', 'ダミー明記チェック'],
          ['411_semiconductor_dry_run_next_actions.csv', '次アクション'],
        ].map(([file, contents]) => ({ file, contents })),
        [
          (row) => `<a href="${esc(row.file)}">${esc(row.file)}</a>`,
          (row) => esc(row.contents),
        ],
      )}
    </section>
  </main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'semiconductor_dry_run_verification_20260526.html'), html, 'utf8');
