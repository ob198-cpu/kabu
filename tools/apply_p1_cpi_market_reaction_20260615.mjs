import fs from 'node:fs';

const queueCsv = 'p1_segment_next_gate_input_queue_20260615.csv';
const eventCsv = '102_june_event_result_input.csv';
const auditCsv = 'p1_cpi_market_reaction_apply_audit_20260615.csv';
const auditHtml = 'p1_cpi_market_reaction_apply_audit_20260615.html';

const cpiValue =
  'BLS公式: 2026年5月CPI-Uは前月比+0.5%(季調済)、前年比+4.2%。コアCPIは前月比+0.2%、前年比+2.9%。' +
  'CPI発表当日(6/10)は米10年金利4.528%→4.542%(+1.4bp)、NASDAQ -1.98%、SOX -3.57%、VIX +11.83%、ドル円+0.13%。' +
  '6/12時点では米10年金利4.487%、NASDAQ 25,888.84、SOX 13,371.47、VIX 17.68まで戻り、金利急騰は確認されない。SOX当日下落は注意として継続。';

const source =
  'BLS CPI Summary / Yahoo Finance chart API (^TNX,^IXIC,^SOX,^VIX,JPY=X)';
const sourceUrl =
  'https://www.bls.gov/news.release/cpi.nr0.htm / https://query1.finance.yahoo.com/v8/finance/chart/';
const position =
  'BLS Consumer Price Index Summary 2026/06/10 lines 207-226 / Yahoo chart API 2026/06/09-2026/06/12 close';

const marketRows = [
  ['米10年金利', '4.528%', '4.542%', '+1.4bp', '4.487%', '金利急騰は確認されない'],
  ['NASDAQ', '25,678.82', '25,169.50', '-1.98%', '25,888.84', '当日下落後に6/12時点で回復'],
  ['SOX', '12,657.81', '12,206.46', '-3.57%', '13,371.47', '当日下落は注意。6/12時点では6/9を上回る'],
  ['VIX', '19.87', '22.22', '+11.83%', '17.68', '当日上昇後に低下'],
  ['ドル円', '160.174', '160.384', '+0.13%', '160.130', '大きな円高ショックは確認されない'],
];

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
  return rows.filter((values) => values.some((value) => String(value ?? '').trim() !== ''));
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeRows(file, rows) {
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
  if (html.includes(auditHtml)) return;
  const link = `<a href="${auditHtml}">CPI市場反応 確認ログ</a>`;
  html = html.replace('</nav>', `  ${link}\n</nav>`);
  fs.writeFileSync(file, html, 'utf8');
}

function updateQueue() {
  const rows = parseCsv(fs.readFileSync(queueCsv, 'utf8'));
  const headers = rows.shift();
  const targetIds = new Set(['6503_event_cpi_result', '8035_event_cpi_result']);
  let applied = 0;
  for (const row of rows) {
    if (!targetIds.has(row[3])) continue;
    row[8] = cpiValue;
    row[9] = sourceUrl;
    row[10] = position;
    row[11] = 'イベント確認済';
    row[12] = '禁止';
    row[13] = '0社';
    row[14] = '0円';
    applied += 1;
  }
  writeRows(queueCsv, [headers, ...rows]);
  return applied;
}

function updateEventCsv() {
  const rows = parseCsv(fs.readFileSync(eventCsv, 'utf8'));
  const headers = rows.shift();
  let applied = 0;
  for (const row of rows) {
    if (row[0] !== 'E01') continue;
    row[4] = 'BLS公式: CPI-U 前月比+0.5%、前年比+4.2%。コアCPI 前月比+0.2%、前年比+2.9%。エネルギー前年比+23.5%。';
    row[5] = '確認済: 6/10当日は米10年金利+1.4bp、NASDAQ -1.98%、SOX -3.57%、VIX +11.83%、ドル円+0.13%。6/12時点でNASDAQ/SOXは回復、米10年金利は4.487%へ低下。';
    row[7] = '確認済: CPI公式値と市場反応を確認。金利急騰は確認されず、SOX当日下落は注意として残す。日銀・FOMC前のため購入判断は不可。';
    applied += 1;
  }
  writeRows(eventCsv, [headers, ...rows]);
  return applied;
}

function writeAudit() {
  const rows = [
    ['項目', '6/9終値', '6/10終値', '当日変化', '6/12終値', '判定'],
    ...marketRows,
  ];
  writeRows(auditCsv, rows);

  const body = marketRows
    .map((row) => `<tr>${row.map((cell, index) => `<td class="${index === 5 ? 'judge' : ''}">${h(cell)}</td>`).join('')}</tr>`)
    .join('');
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CPI市場反応 確認ログ</title>
  <style>
    body{font-family:Arial,"Yu Gothic",Meiryo,sans-serif;margin:0;background:#f5f8fc;color:#061827;line-height:1.75;font-size:18px}
    main{max-width:1180px;margin:0 auto;padding:28px}
    h1{font-size:32px;margin:0 0 12px;border-left:8px solid #0068a9;padding-left:14px}
    section{background:#fff;border:1px solid #c9d9e8;border-radius:12px;padding:20px;margin:18px 0;break-inside:avoid}
    .notice{border:2px solid #b42318;background:#fff5f5;color:#8a0000;font-weight:700;padding:14px;border-radius:10px}
    .summary{border:2px solid #c97a00;background:#fff9ed;color:#5f3700;font-weight:700;padding:14px;border-radius:10px}
    .table-wrap{overflow-x:auto}
    table{width:100%;border-collapse:collapse;table-layout:auto}
    th,td{border:1px solid #c9d9e8;padding:11px;vertical-align:top;overflow-wrap:break-word}
    th{background:#e6f0f8;text-align:left}
    .judge{font-weight:700;color:#064b73}
    @media print{body{background:#fff}main{padding:16mm}section{page-break-inside:avoid}.table-wrap{overflow:visible}}
  </style>
</head>
<body>
<main>
  <h1>CPI市場反応 確認ログ</h1>
  <section>
    <p class="summary">CPI公式値と発表後の市場反応を確認しました。金利急騰は確認されず、SOXは当日下落したものの6/12時点で回復しています。ただし、日銀・FOMC・イベント後の個別反応が未確認のため、P1復帰0社・買付上限0円を維持します。</p>
  </section>
  <section>
    <h2>確認した市場反応</h2>
    <div class="table-wrap"><table><thead><tr><th>項目</th><th>6/9終値</th><th>6/10終値</th><th>当日変化</th><th>6/12終値</th><th>判定</th></tr></thead><tbody>${body}</tbody></table></div>
  </section>
  <section>
    <h2>反映先</h2>
    <p>6503 三菱電機、8035 東京エレクトロンの「6月CPI結果」行を「イベント確認済」に更新しました。これは市場反応の確認完了であり、購入判断の許可ではありません。</p>
    <p class="notice">購入判断に進むには、日銀会合、FOMC、イベント後指数反応、イベント後個別株反応の確認がまだ必要です。</p>
  </section>
  <section>
    <h2>データ出所</h2>
    <p>BLS Consumer Price Index Summary 2026/06/10、Yahoo Finance chart API（^TNX、^IXIC、^SOX、^VIX、JPY=X）の2026/06/09〜2026/06/12終値。</p>
  </section>
</main>
</body>
</html>`;
  fs.writeFileSync(auditHtml, html, 'utf8');
}

const queueApplied = updateQueue();
const eventApplied = updateEventCsv();
writeAudit();

for (const file of ['index.html', 'latest_practical_start_20260614.html', 'daily_practical_compact_board_20260614.html']) {
  updateNav(file);
}

console.log(JSON.stringify({
  queueApplied,
  eventApplied,
  auditHtml,
  auditCsv,
  p1Return: '0社',
  buyLimit: '0円',
}, null, 2));
