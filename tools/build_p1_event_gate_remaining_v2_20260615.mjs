import fs from 'node:fs';

const queueCsv = 'p1_segment_next_gate_input_queue_20260615.csv';
const validatorSummaryCsv = 'p1_segment_next_gate_input_validator_summary_20260615.csv';
const htmlFile = 'p1_event_gate_remaining_20260615.html';
const csvFile = 'p1_event_gate_remaining_20260615.csv';

function parseCsv(text) {
  const clean = String(text ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quote = false;
  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];
    const next = clean[i + 1];
    if (quote) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quote = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') quote = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  const headers = rows.shift() ?? [];
  return rows
    .filter((values) => values.some((value) => String(value ?? '').trim() !== ''))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])));
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, rows) {
  fs.writeFileSync(file, `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`, 'utf8');
}

function h(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function updateNav(file) {
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, 'utf8');
  if (html.includes(htmlFile)) return;
  const link = `<a href="${htmlFile}">P1イベント後ゲート 残項目</a>`;
  html = html.replace('</nav>', `  ${link}\n</nav>`);
  fs.writeFileSync(file, html, 'utf8');
}

function passRow(row) {
  const gate = row['ゲート'];
  const confirmation = row['公式確認'];
  if (gate === '価格ゲート') return confirmation === '計算確認済';
  if (gate === '説明可能性ゲート') return confirmation === '運用確認済';
  if (gate === 'イベント後ゲート') return confirmation === 'イベント確認済' || confirmation === '済';
  return confirmation === '済';
}

const queueRows = parseCsv(fs.readFileSync(queueCsv, 'utf8'));
const inputRows = queueRows.filter((row) => String(row['入力値'] ?? '').trim() !== '');
const passedRows = queueRows.filter(passRow);
const gateMap = new Map();
for (const row of queueRows) {
  const key = `${row.ticker}__${row['ゲート']}`;
  if (!gateMap.has(key)) gateMap.set(key, []);
  gateMap.get(key).push(row);
}
const gateRows = [...gateMap.values()];
const passedGates = gateRows.filter((rows) => rows.every(passRow));

const rowById = new Map(queueRows.map((row) => [row['入力ID'], row]));
const cpiDone = ['6503_event_cpi_result', '8035_event_cpi_result'].every((id) => passRow(rowById.get(id) ?? {}));

const items = [
  {
    item: 'CPI公式値・市場反応',
    status: cpiDone ? '確認済' : '部分確認',
    current: cpiDone
      ? 'CPI公式値、米10年金利、NASDAQ、SOX、VIX、ドル円の発表後反応を確認済み。金利急騰は確認されず、SOX当日下落は注意として残す。'
      : 'CPI公式値は入力済み。市場反応の確認が未完了。',
    remaining: cpiDone ? 'CPI単独では残作業なし。日銀・FOMC後の総合確認へ進む。' : '米10年金利、NASDAQ、SOX、VIX、ドル円を同じ基準日で確認する。',
    earliest: '確認済',
    action: 'CPI確認だけでは買付に進めない。日銀・FOMC・指数反応・個別反応を待つ。',
  },
  {
    item: '日銀会合',
    status: '未入力',
    current: '政策変更、為替、日経平均/TOPIX、銀行・商社・輸出株反応が未入力。',
    remaining: '会合結果、声明、国債買入方針、ドル円、日経平均/TOPIX、候補銘柄の反応を確認する。',
    earliest: '2026-06-16以降',
    action: '急な円高ショックまたは日本株急落が出た場合は、予定買付を延期または縮小する。',
  },
  {
    item: 'FOMC',
    status: '未入力',
    current: '政策金利見通し、ドットプロット、議長会見、米10年金利、NASDAQ/SOX反応が未入力。',
    remaining: 'FOMC後に米長期金利が急騰しないか、ハイテク株のリスク許容度が崩れていないかを確認する。',
    earliest: '2026-06-17以降',
    action: '米10年金利急騰またはSOX急落なら、高PER・半導体候補は保留する。',
  },
  {
    item: 'イベント後指数反応',
    status: '未入力',
    current: 'CPI、日銀、FOMCをまとめて通過した後の指数反応が未入力。',
    remaining: '日経平均、TOPIX、S&P500、NASDAQ、SOX、VIXのイベント前後変化を比較する。',
    earliest: '2026-06-18以降',
    action: '指数が弱い場合は個別株比率を下げ、現金比率を上げる。',
  },
  {
    item: 'イベント後個別株反応',
    status: '未入力',
    current: '6503.Tと8035.Tのイベント後反応が未入力。',
    remaining: '対象銘柄の1日/5日反応、指数との差、出来高変化を確認する。',
    earliest: '2026-06-18以降',
    action: '個別株が指数に劣後した場合は、P1復帰を見送る。',
  },
];

writeCsv(csvFile, [
  ['項目', '状況', '現在', '残作業', '最短確認日', '運用上の扱い'],
  ...items.map((row) => [row.item, row.status, row.current, row.remaining, row.earliest, row.action]),
]);

const body = items.map((row) => `<tr>
  <td>${h(row.item)}</td>
  <td class="${row.status === '確認済' ? 'ok' : row.status === '部分確認' ? 'warn' : 'bad'}">${h(row.status)}</td>
  <td>${h(row.current)}</td>
  <td>${h(row.remaining)}</td>
  <td>${h(row.earliest)}</td>
  <td>${h(row.action)}</td>
</tr>`).join('');

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>P1イベント後ゲート 残項目</title>
  <style>
    body{font-family:Arial,"Yu Gothic",Meiryo,sans-serif;margin:0;background:#f5f8fc;color:#061827;line-height:1.75;font-size:18px}
    main{max-width:1200px;margin:0 auto;padding:28px}
    h1{font-size:32px;margin:0 0 12px;border-left:8px solid #0068a9;padding-left:14px}
    section{background:#fff;border:1px solid #c9d9e8;border-radius:12px;padding:20px;margin:18px 0;break-inside:avoid}
    .notice{border:2px solid #b42318;background:#fff5f5;color:#8a0000;font-weight:700;padding:14px;border-radius:10px}
    .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
    .card{border:1px solid #c9d9e8;border-radius:10px;padding:14px;background:#f8fbff}
    .card b{display:block;color:#46627d}.card strong{font-size:30px;color:#003b67}
    .table-wrap{overflow-x:auto}
    table{width:100%;border-collapse:collapse;table-layout:auto}
    th,td{border:1px solid #c9d9e8;padding:11px;vertical-align:top;overflow-wrap:break-word}
    th{background:#e6f0f8;text-align:left}
    .bad{color:#b30000;font-weight:700}.warn{color:#b66a00;font-weight:700}.ok{color:#007a3d;font-weight:700}
    @media print{body{background:#fff}main{padding:16mm}section{page-break-inside:avoid}.table-wrap{overflow:visible}}
  </style>
</head>
<body>
<main>
  <h1>P1イベント後ゲート 残項目</h1>
  <p>財務・価格・説明可能性の確認は進みました。残りは6月イベント後の実データ確認です。ここを通すまで、P1復帰と買付上限は出しません。</p>
  <section>
    <div class="cards">
      <div class="card"><b>入力済み</b><strong>${inputRows.length}/${queueRows.length}</strong><span>必要項目の入力状況</span></div>
      <div class="card"><b>入力項目通過</b><strong>${passedRows.length}/${queueRows.length}</strong><span>根拠・出所・確認区分まで揃った項目</span></div>
      <div class="card"><b>ゲート通過</b><strong>${passedGates.length}/${gateRows.length}</strong><span>銘柄別ゲート単位の通過状況</span></div>
      <div class="card"><b>P1復帰/買付</b><strong>0社/0円</strong><span>購入判断には未使用</span></div>
    </div>
  </section>
  <section>
    <p class="notice">CPI市場反応は確認済みですが、日銀・FOMC・イベント後指数反応・イベント後個別株反応が未入力です。購入判断、候補復帰、買付金額の算出にはまだ使いません。</p>
  </section>
  <section>
    <h2>残項目</h2>
    <div class="table-wrap"><table><thead><tr><th>項目</th><th>状況</th><th>現在</th><th>残作業</th><th>最短確認日</th><th>運用上の扱い</th></tr></thead><tbody>${body}</tbody></table></div>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(htmlFile, html, 'utf8');

for (const file of ['index.html', 'latest_practical_start_20260614.html', 'daily_practical_compact_board_20260614.html']) {
  updateNav(file);
}

console.log(JSON.stringify({
  htmlFile,
  csvFile,
  input: `${inputRows.length}/${queueRows.length}`,
  passed: `${passedRows.length}/${queueRows.length}`,
  gates: `${passedGates.length}/${gateRows.length}`,
  validatorSummary: fs.existsSync(validatorSummaryCsv) ? validatorSummaryCsv : 'not found',
}, null, 2));
