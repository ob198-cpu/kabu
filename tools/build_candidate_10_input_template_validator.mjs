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

function fieldGuide(type) {
  const guides = {
    financial: 'metric_1=予想PERまたは実績PER / metric_2=EPS基準 / metric_3=PBR / metric_4=ROE',
    valuation: 'metric_1=対象指標値 / metric_2=同業中央値 / metric_3=平均との差 / metric_4=採用可否',
    peer: 'metric_1=同業PER中央値 / metric_2=同業PBR中央値 / metric_3=同業ROE中央値 / metric_4=同業社数',
    reaction: 'metric_1=1日超過リターン / metric_2=5日超過リターン / metric_3=20日超過リターン / metric_4=反応判定',
    event: 'metric_1=イベント後株価反応 / metric_2=実績評価S-A-B-C / metric_3=関連度 / metric_4=継続期間',
    market: 'metric_1=市場指標値 / metric_2=前回差 / metric_3=警戒水準 / metric_4=判定',
  };
  return guides[type] || guides.market;
}

function requiredRule(type) {
  const rules = {
    financial: 'source_url、source_date、metric_1が必須。出典不明なら採点へ接続しない。',
    valuation: 'source_url、source_date、metric_1、benchmark_or_basisが必須。業種比較の基準も記録する。',
    peer: 'source_url、source_date、metric_1、metric_4が必須。同業社数が少ない場合は説明補助に止める。',
    reaction: 'period_or_event_date、source_url、metric_1、metric_2、metric_3が必須。20日未到達なら未接続。',
    event: 'period_or_event_date、source_url、metric_1、metric_2が必須。仮説だけなら採点へ接続しない。',
    market: 'source_url、source_date、metric_1が必須。6月の市場イベント実数は別判定で扱う。',
  };
  return rules[type] || rules.market;
}

const queueRows = readCsv('475_candidate_10_input_queue.csv');

const templateHeaders = [
  'updated_at',
  'input_id',
  'ticker',
  'company',
  'input_type',
  'task',
  'source_url',
  'source_date',
  'period_or_event_date',
  'metric_1',
  'metric_2',
  'metric_3',
  'metric_4',
  'benchmark_or_basis',
  'unit',
  'field_guide',
  'required_rule',
  'status',
  'score_connection',
  'memo',
];

const templateRows = queueRows.map((row) => ({
  updated_at: generatedAt,
  input_id: row.input_id,
  ticker: row.ticker,
  company: row.company,
  input_type: row.input_type,
  task: row.task,
  source_url: '',
  source_date: '',
  period_or_event_date: '',
  metric_1: '',
  metric_2: '',
  metric_3: '',
  metric_4: '',
  benchmark_or_basis: '',
  unit: '',
  field_guide: fieldGuide(row.input_type),
  required_rule: requiredRule(row.input_type),
  status: '未入力',
  score_connection: '未接続',
  memo: '',
}));

const ruleRows = [
  {
    updated_at: generatedAt,
    rule: '出典必須',
    condition: 'source_urlとsource_dateがない',
    result: '説明補助にも採点にも接続しない',
  },
  {
    updated_at: generatedAt,
    rule: '数値必須',
    condition: '必要なmetric欄が空欄',
    result: '未入力として残す',
  },
  {
    updated_at: generatedAt,
    rule: '20営業日未到達',
    condition: '決算後反応の20日値が未到達',
    result: '反応スコアへ接続しない',
  },
  {
    updated_at: generatedAt,
    rule: '質的仮説のみ',
    condition: 'イベント日または株価反応が未入力',
    result: '調査理由として記録し、加点しない',
  },
  {
    updated_at: generatedAt,
    rule: '6月イベント前',
    condition: 'CPI、日銀、FOMC後の実数が未入力',
    result: '購入判断は0社のままにする',
  },
];

const summaryRows = [
  {
    updated_at: generatedAt,
    item: 'テンプレート行数',
    value: `${templateRows.length}件`,
    interpretation: '候補10社を根拠付きで絞るための不足入力欄を1行1作業で管理する。',
  },
  {
    updated_at: generatedAt,
    item: 'CSV操作',
    value: '読み込み・検証・出力に対応',
    interpretation: 'ブラウザ上でCSVを読み込み、未入力と採点接続可否を確認できる。',
  },
  {
    updated_at: generatedAt,
    item: '採点接続',
    value: '初期状態は全件未接続',
    interpretation: '出典、基準日、数値がそろうまで点数へ入れない。',
  },
  {
    updated_at: generatedAt,
    item: '購入判断',
    value: '0社',
    interpretation: 'この画面は入力検証用であり、購入判断ではない。',
  },
];

writeCsv('478_candidate_10_input_template.csv', templateRows, templateHeaders);
writeCsv('479_candidate_10_template_validation_rules.csv', ruleRows, [
  'updated_at',
  'rule',
  'condition',
  'result',
]);
writeCsv('480_candidate_10_template_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'interpretation',
]);

const csvText = fs.readFileSync(path.join(ROOT, '478_candidate_10_input_template.csv'), 'utf8');
const templateJson = JSON.stringify(templateRows);
const csvJson = JSON.stringify(csvText);

const typeCounts = templateRows.reduce((acc, row) => {
  acc[row.input_type] = (acc[row.input_type] || 0) + 1;
  return acc;
}, {});

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 CSV入力・検証テンプレート</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #061a33;
      --muted: #4a5f78;
      --line: #c9d9ea;
      --soft: #eef6ff;
      --blue: #0b66a0;
      --green: #087f5b;
      --red: #b42318;
      --amber: #b45309;
      --bg: #f6f9fc;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Yu Gothic", "Meiryo", system-ui, sans-serif;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.75;
    }
    header {
      background: linear-gradient(135deg, #05345d, #0b6a95);
      color: #fff;
      padding: 34px clamp(18px, 4vw, 58px);
    }
    header h1 { margin: 0 0 8px; font-size: clamp(26px, 4vw, 42px); letter-spacing: 0; }
    header p { margin: 0; max-width: 980px; color: #e8f4ff; font-weight: 700; }
    main { width: min(1180px, calc(100% - 32px)); margin: 24px auto 56px; }
    section {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 22px;
      margin: 18px 0;
      break-inside: avoid;
    }
    h2 {
      margin: 0 0 14px;
      font-size: 24px;
      padding-left: 12px;
      border-left: 8px solid var(--blue);
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }
    .metric {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
      background: var(--soft);
      min-height: 108px;
    }
    .metric strong { display: block; font-size: 26px; color: var(--blue); }
    .metric span { display: block; font-weight: 700; }
    .buttons { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    button, .link-button {
      border: 0;
      border-radius: 7px;
      background: var(--blue);
      color: #fff;
      padding: 10px 14px;
      font-weight: 800;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      min-height: 42px;
    }
    button.secondary { background: #174264; }
    input[type="file"] {
      border: 1px dashed var(--line);
      padding: 9px;
      background: #fff;
      border-radius: 7px;
      min-height: 42px;
    }
    .notice {
      border-left: 8px solid var(--amber);
      background: #fff7ed;
      padding: 14px;
      border-radius: 8px;
      font-weight: 800;
    }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; min-width: 880px; }
    th, td {
      border-bottom: 1px solid var(--line);
      padding: 10px;
      text-align: left;
      vertical-align: top;
      color: var(--ink);
      word-break: break-word;
    }
    th { background: #e6f1fb; font-weight: 900; }
    tr:last-child td { border-bottom: 0; }
    .ok { color: var(--green); font-weight: 900; }
    .ng { color: var(--red); font-weight: 900; }
    .pending { color: var(--amber); font-weight: 900; }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    .card {
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
      background: #fbfdff;
    }
    .card h3 { margin: 0 0 8px; font-size: 18px; }
    code { background: #edf4fb; padding: 2px 5px; border-radius: 5px; }
    @media (max-width: 860px) {
      .summary, .grid { grid-template-columns: 1fr; }
      main { width: min(100% - 20px, 1180px); }
      section { padding: 16px; }
    }
    @media print {
      body { background: #fff; }
      section { break-inside: avoid; }
      .buttons, input { display: none; }
      .table-wrap { overflow: visible; }
      table { min-width: 0; font-size: 11px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>候補10社 CSV入力・検証テンプレート</h1>
    <p>候補10社を根拠付きで選ぶために、PER/PBR/ROE、同業比較、決算後反応、イベント実績を入力して、採点へ接続できる状態かを確認する画面です。</p>
  </header>
  <main>
    <section>
      <h2>この画面で行うこと</h2>
      <div class="summary">
        <div class="metric"><span>入力対象</span><strong>${templateRows.length}件</strong><small>10社分の不足確認項目</small></div>
        <div class="metric"><span>CSV操作</span><strong>対応</strong><small>読み込み、検証、出力</small></div>
        <div class="metric"><span>初期状態</span><strong>未接続</strong><small>未入力値は採点に使わない</small></div>
        <div class="metric"><span>購入判断</span><strong>0社</strong><small>6月イベント後に別判定</small></div>
      </div>
      <p class="notice">このテンプレートは、根拠データをそろえるための作業画面です。出典・基準日・数値がそろうまで、点数や購入判断には接続しません。</p>
    </section>

    <section>
      <h2>CSV操作</h2>
      <div class="buttons">
        <button type="button" id="downloadTemplate">テンプレートCSVを保存</button>
        <input type="file" id="fileInput" accept=".csv,text/csv">
        <button type="button" id="validateCsv" class="secondary">読み込んだCSVを検証</button>
        <button type="button" id="downloadValidated" class="secondary">検証結果CSVを保存</button>
      </div>
      <p id="validationSummary" class="notice">まだCSVは読み込まれていません。まずテンプレートを保存し、値を入力してから読み込んでください。</p>
      <div class="table-wrap">
        <table id="previewTable">
          <thead><tr><th>入力ID</th><th>銘柄</th><th>種別</th><th>作業</th><th>検証結果</th><th>採点接続</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
    </section>

    <section>
      <h2>入力種別の内訳</h2>
      <div class="grid">
        ${Object.entries(typeCounts).map(([type, count]) => `
        <div class="card">
          <h3>${esc(type)}: ${count}件</h3>
          <p>${esc(fieldGuide(type))}</p>
          <p><strong>接続条件:</strong> ${esc(requiredRule(type))}</p>
        </div>`).join('')}
      </div>
    </section>

    <section>
      <h2>初期テンプレート一覧</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>入力ID</th><th>銘柄</th><th>種別</th><th>作業</th><th>入力ガイド</th><th>接続条件</th></tr></thead>
          <tbody>
            ${templateRows.map((row) => `
            <tr>
              <td>${esc(row.input_id)}</td>
              <td>${esc(row.ticker)} ${esc(row.company)}</td>
              <td>${esc(row.input_type)}</td>
              <td>${esc(row.task)}</td>
              <td>${esc(row.field_guide)}</td>
              <td>${esc(row.required_rule)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>
  </main>
  <script>
    const templateRows = ${templateJson};
    const templateCsv = ${csvJson};
    const headers = ${JSON.stringify(templateHeaders)};
    let currentRows = templateRows.map((row) => ({ ...row }));

    function downloadText(filename, text) {
      const blob = new Blob(['\\uFEFF' + text.replace(/^\\uFEFF/, '')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    }

    function parseCsv(text) {
      text = text.replace(/^\\uFEFF/, '');
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
        } else if (ch === '\\n') {
          row.push(cell.replace(/\\r$/, ''));
          rows.push(row);
          row = [];
          cell = '';
        } else cell += ch;
      }
      if (cell.length || row.length) {
        row.push(cell.replace(/\\r$/, ''));
        rows.push(row);
      }
      const cols = rows.shift() || [];
      return rows.filter((items) => items.some((item) => String(item).trim() !== '')).map((items) => {
        const obj = {};
        cols.forEach((col, index) => { obj[col] = items[index] || ''; });
        return obj;
      });
    }

    function escCsv(value) {
      const text = String(value ?? '');
      if (/[",\\n\\r]/.test(text)) return '"' + text.replaceAll('"', '""') + '"';
      return text;
    }

    function toCsv(rows) {
      return [headers.concat(['validation_result']).join(',')]
        .concat(rows.map((row) => headers.concat(['validation_result']).map((header) => escCsv(row[header] || '')).join(',')))
        .join('\\n');
    }

    function has(row, key) {
      return String(row[key] || '').trim() !== '';
    }

    function validateRow(row) {
      const type = row.input_type || 'market';
      const common = has(row, 'source_url') && (has(row, 'source_date') || has(row, 'period_or_event_date'));
      let ok = false;
      if (type === 'financial') ok = common && has(row, 'metric_1');
      else if (type === 'valuation') ok = common && has(row, 'metric_1') && has(row, 'benchmark_or_basis');
      else if (type === 'peer') ok = common && has(row, 'metric_1') && has(row, 'metric_4');
      else if (type === 'reaction') ok = has(row, 'period_or_event_date') && has(row, 'source_url') && has(row, 'metric_1') && has(row, 'metric_2') && has(row, 'metric_3');
      else if (type === 'event') ok = has(row, 'period_or_event_date') && has(row, 'source_url') && has(row, 'metric_1') && has(row, 'metric_2');
      else ok = common && has(row, 'metric_1');
      return ok ? '接続可' : '未接続';
    }

    function render(rows) {
      let okCount = 0;
      const body = document.querySelector('#previewTable tbody');
      body.innerHTML = rows.map((row) => {
        const validation = validateRow(row);
        const connection = validation === '接続可' ? '検算へ進める' : '採点へ入れない';
        if (validation === '接続可') okCount += 1;
        row.validation_result = validation;
        row.score_connection = connection;
        const cls = validation === '接続可' ? 'ok' : 'pending';
        return '<tr>' +
          '<td>' + (row.input_id || '') + '</td>' +
          '<td>' + (row.ticker || '') + ' ' + (row.company || '') + '</td>' +
          '<td>' + (row.input_type || '') + '</td>' +
          '<td>' + (row.task || '') + '</td>' +
          '<td class="' + cls + '">' + validation + '</td>' +
          '<td>' + connection + '</td>' +
          '</tr>';
      }).join('');
      document.getElementById('validationSummary').textContent =
        '検証結果: 接続可 ' + okCount + '件 / 未接続 ' + (rows.length - okCount) + '件。購入判断はこの画面では出しません。';
    }

    document.getElementById('downloadTemplate').addEventListener('click', () => {
      downloadText('478_candidate_10_input_template.csv', templateCsv);
    });

    document.getElementById('fileInput').addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const text = await file.text();
      currentRows = parseCsv(text);
      render(currentRows);
    });

    document.getElementById('validateCsv').addEventListener('click', () => render(currentRows));
    document.getElementById('downloadValidated').addEventListener('click', () => {
      render(currentRows);
      downloadText('candidate_10_input_validated.csv', toCsv(currentRows));
    });

    render(currentRows);
  </script>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_input_template_validator_20260526.html'), html, 'utf8');

console.log(`created candidate_10_input_template_validator_20260526.html, rows=${templateRows.length}`);
