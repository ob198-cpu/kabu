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
  return rows
    .filter((items) => items.some((item) => String(item).trim() !== ''))
    .map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] ?? ''])));
}

function readCsv(name) {
  const file = path.join(ROOT, name);
  if (!fs.existsSync(file)) return [];
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

const cockpitLogTemplate = readCsv('392_semiconductor_result_log_template.csv');

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '目的',
    value: '判定結果の記録化',
    interpretation: '6月実績入力コックピットで出した判定CSVを、6月前向きテスト記録と予実差ログへ移す。',
  },
  {
    updated_at: generatedAt,
    item: '保存方式',
    value: 'CSV整形出力',
    interpretation: 'GitHub Pages単体ではサーバー保存できないため、ブラウザ内でCSVを読み込み、記録用CSVを出力する。',
  },
  {
    updated_at: generatedAt,
    item: '接続先',
    value: '2種類',
    interpretation: '一次判定ログと予実差テンプレートへ接続する。',
  },
  {
    updated_at: generatedAt,
    item: '未対応',
    value: '自動DB保存',
    interpretation: 'Google Sheets、DB、GitHub API等を使う場合は別実装。現段階では静的サイト内のCSV変換まで。',
  },
];

const columnMapRows = [
  ['updated_at', 'decision_logged_at', '判定CSVの作成時刻', '一次判定ログ'],
  ['ticker', 'ticker', '銘柄コード', '一次判定ログ / 予実差ログ'],
  ['company', 'company', '会社名', '一次判定ログ / 予実差ログ'],
  ['cpi_gate', 'cpi_gate', 'CPIゲート結果', '一次判定ログ'],
  ['boj_gate', 'boj_gate', '日銀ゲート結果', '一次判定ログ'],
  ['fomc_gate', 'fomc_gate', 'FOMCゲート結果', '一次判定ログ'],
  ['index_gate', 'index_gate', '指数トレンドゲート結果', '一次判定ログ'],
  ['final_status', 'june_first_status', '6月一次判定', '一次判定ログ'],
  ['reason', 'decision_reason', '判定理由', '一次判定ログ / 予実差ログ'],
  ['event_5d_excess_after', 'pre_event_prediction', '5営業日後の事前仮説または入力値', '予実差ログ'],
  ['final_status', 'actual_result', '一次判定結果', '予実差ログ'],
].map(([source_column, output_column, meaning, destination]) => ({
  updated_at: generatedAt,
  source_column,
  output_column,
  meaning,
  destination,
}));

const decisionLogTemplateRows = cockpitLogTemplate.map((row) => ({
  updated_at: generatedAt,
  decision_logged_at: '',
  ticker: row.ticker,
  company: row.company,
  cpi_gate: '',
  boj_gate: '',
  fomc_gate: '',
  index_gate: '',
  june_first_status: '',
  decision_reason: '',
  next_record_due: '1営業日後 / 5営業日後 / 20営業日後',
  storage_note: 'コックピット出力CSVを変換して記録する。',
}));

const predictionActualTemplateRows = cockpitLogTemplate.map((row) => ({
  updated_at: generatedAt,
  ticker: row.ticker,
  company: row.company,
  event_date: '2026-06-18〜2026-06-24',
  event: '半導体6月一次判定',
  before_event_price: '',
  event_day_price: '',
  return_1d_pct: '',
  return_5d_pct: '',
  return_20d_pct: '',
  benchmark_return_1d_pct: '',
  benchmark_return_5d_pct: '',
  benchmark_return_20d_pct: '',
  excess_1d_pct: '',
  excess_5d_pct: '',
  excess_20d_pct: '',
  pre_event_prediction: '',
  actual_result: '',
  prediction_error_note: '',
  next_model_fix: '',
}));

const operationRows = [
  {
    updated_at: generatedAt,
    step: 1,
    action: '6月実績入力コックピットで判定',
    detail: '実数を入力し、判定結果CSVを出力する。',
  },
  {
    updated_at: generatedAt,
    step: 2,
    action: 'このページでCSVを読み込む',
    detail: 'ファイル選択でコックピット出力CSVを読み込む。',
  },
  {
    updated_at: generatedAt,
    step: 3,
    action: '一次判定ログCSVへ変換',
    detail: '銘柄別にCPI、日銀、FOMC、指数、最終判定、理由を整理する。',
  },
  {
    updated_at: generatedAt,
    step: 4,
    action: '予実差テンプレートCSVへ変換',
    detail: '1/5/20営業日後に価格反応と予測誤差を追記できる形へ変換する。',
  },
  {
    updated_at: generatedAt,
    step: 5,
    action: '記録表へ保存',
    detail: '静的サイトでは自動保存不可。出力CSVをExcel/スプレッドシート/リポジトリへ保存する。',
  },
];

const limitationRows = [
  {
    updated_at: generatedAt,
    limitation: 'GitHub Pagesは静的サイト',
    impact: 'ページ上で入力した内容をサーバーへ直接保存できない。',
    workaround: 'CSVとして出力し、Excel/スプレッドシート/リポジトリへ保存する。',
  },
  {
    updated_at: generatedAt,
    limitation: '自動保存には認証が必要',
    impact: 'Google Sheets APIやGitHub APIへ保存するには認証・権限管理が必要。',
    workaround: '本格運用ではGoogle Sheets、SQLite/DB、またはApps Script接続を追加する。',
  },
  {
    updated_at: generatedAt,
    limitation: '未来値は自動入力しない',
    impact: 'CPI、日銀、FOMC後の実数は発表後に入力する必要がある。',
    workaround: '発表後に公式値または取得APIから入力し、判定ログを保存する。',
  },
];

writeCsv('395_semiconductor_forward_log_bridge_summary.csv', summaryRows, ['updated_at', 'item', 'value', 'interpretation']);
writeCsv('396_semiconductor_forward_log_column_map.csv', columnMapRows, ['updated_at', 'source_column', 'output_column', 'meaning', 'destination']);
writeCsv('397_semiconductor_forward_decision_log_template.csv', decisionLogTemplateRows, ['updated_at', 'decision_logged_at', 'ticker', 'company', 'cpi_gate', 'boj_gate', 'fomc_gate', 'index_gate', 'june_first_status', 'decision_reason', 'next_record_due', 'storage_note']);
writeCsv('398_semiconductor_forward_prediction_actual_template.csv', predictionActualTemplateRows, ['updated_at', 'ticker', 'company', 'event_date', 'event', 'before_event_price', 'event_day_price', 'return_1d_pct', 'return_5d_pct', 'return_20d_pct', 'benchmark_return_1d_pct', 'benchmark_return_5d_pct', 'benchmark_return_20d_pct', 'excess_1d_pct', 'excess_5d_pct', 'excess_20d_pct', 'pre_event_prediction', 'actual_result', 'prediction_error_note', 'next_model_fix']);
writeCsv('399_semiconductor_forward_log_operation.csv', operationRows, ['updated_at', 'step', 'action', 'detail']);
writeCsv('400_semiconductor_forward_log_limitations.csv', limitationRows, ['updated_at', 'limitation', 'impact', 'workaround']);

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
  <title>半導体 判定ログ接続</title>
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
    .toolbar a, button, .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      min-height: 40px;
      padding: 9px 14px;
      border-radius: 8px;
      background: #fff;
      color: #07385b;
      text-decoration: none;
      border: 1px solid #b8d4ee;
      box-shadow: 0 2px 6px rgba(0,0,0,.08);
      font-weight: 800;
      cursor: pointer;
    }
    button.primary { background: #0b5f92; color: #fff; border-color: #0b5f92; }
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
    input[type=file] {
      width: 100%;
      padding: 12px;
      border: 1px dashed #8bb9dd;
      border-radius: 10px;
      background: #fbfdff;
      margin-top: 10px;
    }
    .actions { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
    .preview {
      max-height: 360px;
      overflow: auto;
      border: 1px solid var(--line);
      border-radius: 10px;
      margin-top: 12px;
      background: #fff;
    }
    @media (max-width: 860px) { table { font-size: 14px; } }
    @media print {
      body { background: #fff; color: #000; }
      header { background: #fff; color: #000; border-bottom: 3px solid #000; }
      .toolbar, .actions, input { display: none; }
      .card, .section { box-shadow: none; page-break-inside: avoid; }
      tr { page-break-inside: avoid; }
      th, td { color: #000; }
    }
  </style>
</head>
<body>
  <header>
    <h1>半導体 判定ログ接続</h1>
    <p style="color:#e6f3ff">6月実績入力コックピットの判定結果CSVを、6月前向きテスト記録と予実差ログへ変換するページです。</p>
    <div class="notice">正直な制約: GitHub Pagesだけでは入力結果をサーバーへ直接保存できません。このページでは、CSVを読み込み、記録用CSVへ整形して出力します。</div>
    <div class="toolbar">
      <a href="index.html">トップ</a>
      <a href="semiconductor_june_result_input_cockpit_20260526.html">6月実績入力</a>
      <a href="june_forward_test_record_20260526.html">6月前向きテスト記録</a>
      <a href="semiconductor_june_recheck_checklist_20260526.html">6月再判定</a>
      <a href="current_vs_history_materials_20260525.html">資料一覧</a>
    </div>
  </header>

  <main>
    <section class="grid">
      ${summaryRows.map((row) => `
        <div class="card">
          <h3>${esc(row.item)}</h3>
          <div class="kpi">${esc(row.value)}</div>
          <p>${esc(row.interpretation)}</p>
        </div>
      `).join('')}
    </section>

    <h2>1. CSV変換</h2>
    <section class="section">
      <p>6月実績入力コックピットで出力した <b>semiconductor_june_result_log.csv</b> を選択してください。ブラウザ内だけで変換します。</p>
      <input id="csvFile" type="file" accept=".csv,text/csv">
      <div class="actions">
        <button class="primary" type="button" onclick="downloadDecisionLog()">一次判定ログCSVを出力</button>
        <button type="button" onclick="downloadPredictionLog()">予実差テンプレートCSVを出力</button>
      </div>
      <div id="status" class="card" style="margin-top:14px">CSV未読込</div>
      <div class="preview" id="preview"></div>
    </section>

    <h2>2. 列の対応</h2>
    <section class="section">
      ${table(
        ['入力列', '出力列', '意味', '接続先'],
        columnMapRows,
        [
          (row) => esc(row.source_column),
          (row) => esc(row.output_column),
          (row) => esc(row.meaning),
          (row) => esc(row.destination),
        ],
      )}
    </section>

    <h2>3. 手順</h2>
    <section class="section">
      ${table(
        ['手順', '作業', '内容'],
        operationRows,
        [
          (row) => esc(row.step),
          (row) => esc(row.action),
          (row) => esc(row.detail),
        ],
      )}
    </section>

    <h2>4. 制約と対応</h2>
    <section class="section">
      ${table(
        ['制約', '影響', '対応'],
        limitationRows,
        [
          (row) => `<strong>${esc(row.limitation)}</strong>`,
          (row) => esc(row.impact),
          (row) => esc(row.workaround),
        ],
      )}
    </section>

    <h2>5. 出力ファイル</h2>
    <section class="section">
      ${table(
        ['ファイル', '内容'],
        [
          ['395_semiconductor_forward_log_bridge_summary.csv', '要約'],
          ['396_semiconductor_forward_log_column_map.csv', '列対応表'],
          ['397_semiconductor_forward_decision_log_template.csv', '一次判定ログテンプレート'],
          ['398_semiconductor_forward_prediction_actual_template.csv', '予実差テンプレート'],
          ['399_semiconductor_forward_log_operation.csv', '操作手順'],
          ['400_semiconductor_forward_log_limitations.csv', '制約と対応'],
        ].map(([file, contents]) => ({ file, contents })),
        [
          (row) => `<a href="${esc(row.file)}">${esc(row.file)}</a>`,
          (row) => esc(row.contents),
        ],
      )}
    </section>
  </main>

  <script>
    let importedRows = [];

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
          if (ch === '"' && next === '"') { cell += '"'; i += 1; }
          else if (ch === '"') quoted = false;
          else cell += ch;
        } else if (ch === '"') quoted = true;
        else if (ch === ',') { row.push(cell); cell = ''; }
        else if (ch === '\\n') { row.push(cell.replace(/\\r$/, '')); rows.push(row); row = []; cell = ''; }
        else cell += ch;
      }
      if (cell.length || row.length) { row.push(cell.replace(/\\r$/, '')); rows.push(row); }
      const headers = rows.shift() || [];
      return rows.filter((items) => items.some((item) => String(item).trim() !== '')).map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] || ''])));
    }

    function csvEscape(value) {
      const text = String(value ?? '');
      return /[",\\n\\r]/.test(text) ? '"' + text.replaceAll('"', '""') + '"' : text;
    }

    function toCsv(rows, headers) {
      return '\\uFEFF' + [headers.join(',')].concat(rows.map((row) => headers.map((header) => csvEscape(row[header])).join(','))).join('\\n');
    }

    function download(name, rows, headers) {
      const blob = new Blob([toCsv(rows, headers)], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    }

    function decisionRows() {
      return importedRows.map((row) => ({
        updated_at: new Date().toISOString(),
        decision_logged_at: row.updated_at || '',
        ticker: row.ticker || '',
        company: row.company || '',
        cpi_gate: row.cpi_gate || '',
        boj_gate: row.boj_gate || '',
        fomc_gate: row.fomc_gate || '',
        index_gate: row.index_gate || '',
        june_first_status: row.final_status || '',
        decision_reason: row.reason || '',
        next_record_due: '1営業日後 / 5営業日後 / 20営業日後',
        storage_note: '6月実績入力コックピット出力CSVから変換',
      }));
    }

    function predictionRows() {
      return importedRows.map((row) => ({
        updated_at: new Date().toISOString(),
        ticker: row.ticker || '',
        company: row.company || '',
        event_date: '2026-06-18〜2026-06-24',
        event: '半導体6月一次判定',
        before_event_price: '',
        event_day_price: '',
        return_1d_pct: '',
        return_5d_pct: '',
        return_20d_pct: '',
        benchmark_return_1d_pct: '',
        benchmark_return_5d_pct: '',
        benchmark_return_20d_pct: '',
        excess_1d_pct: '',
        excess_5d_pct: '',
        excess_20d_pct: '',
        pre_event_prediction: row.final_status || '',
        actual_result: '',
        prediction_error_note: row.reason || '',
        next_model_fix: '',
      }));
    }

    function renderPreview() {
      if (!importedRows.length) {
        document.getElementById('preview').innerHTML = '';
        return;
      }
      const rows = decisionRows();
      document.getElementById('preview').innerHTML = '<table><thead><tr><th>銘柄</th><th>CPI</th><th>日銀</th><th>FOMC</th><th>指数</th><th>一次判定</th><th>理由</th></tr></thead><tbody>' +
        rows.map((row) => '<tr><td><b>' + row.ticker + ' ' + row.company + '</b></td><td>' + row.cpi_gate + '</td><td>' + row.boj_gate + '</td><td>' + row.fomc_gate + '</td><td>' + row.index_gate + '</td><td>' + row.june_first_status + '</td><td>' + row.decision_reason + '</td></tr>').join('') +
        '</tbody></table>';
    }

    document.getElementById('csvFile').addEventListener('change', async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      const text = await file.text();
      importedRows = parseCsv(text);
      document.getElementById('status').textContent = importedRows.length + '件を読み込みました。サーバー保存はしていません。必要なCSVを出力してください。';
      renderPreview();
    });

    function downloadDecisionLog() {
      if (!importedRows.length) { alert('先にCSVを読み込んでください。'); return; }
      const headers = ['updated_at','decision_logged_at','ticker','company','cpi_gate','boj_gate','fomc_gate','index_gate','june_first_status','decision_reason','next_record_due','storage_note'];
      download('semiconductor_june_decision_log.csv', decisionRows(), headers);
    }

    function downloadPredictionLog() {
      if (!importedRows.length) { alert('先にCSVを読み込んでください。'); return; }
      const headers = ['updated_at','ticker','company','event_date','event','before_event_price','event_day_price','return_1d_pct','return_5d_pct','return_20d_pct','benchmark_return_1d_pct','benchmark_return_5d_pct','benchmark_return_20d_pct','excess_1d_pct','excess_5d_pct','excess_20d_pct','pre_event_prediction','actual_result','prediction_error_note','next_model_fix'];
      download('semiconductor_june_prediction_actual_log.csv', predictionRows(), headers);
    }
  </script>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'semiconductor_forward_log_bridge_20260526.html'), html, 'utf8');
