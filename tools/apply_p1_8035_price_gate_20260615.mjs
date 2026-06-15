import fs from 'node:fs';

const csvFile = 'p1_segment_next_gate_input_queue_20260615.csv';
const auditCsv = 'p1_8035_price_gate_apply_audit_20260615.csv';
const auditHtml = 'p1_8035_price_gate_apply_audit_20260615.html';
const yahooUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/8035.T?range=5d&interval=1d';

const updates = new Map([
  ['8035_price_date', {
    value: '2026-06-15',
    source: yahooUrl,
    position: 'Yahoo Finance chart API meta.regularMarketTime=2026-06-15T06:30:00Z',
    confirmation: '計算確認済',
    reason: '8035.Tの直近株価取得時刻を価格ゲートの基準日に反映。財務・イベントゲートには反映しない。'
  }],
  ['8035_current_price', {
    value: '72,760円',
    source: yahooUrl,
    position: 'Yahoo Finance chart API meta.regularMarketPrice=72760 / regularMarketTime=2026-06-15T06:30:00Z',
    confirmation: '計算確認済',
    reason: '8035.Tの直近株価を取得元と時刻つきで反映。PER/PBR確定値ではなく価格ゲート用の入力値として扱う。'
  }]
]);

const headers = [
  'ticker', '銘柄', 'ゲート', '入力ID', '入力項目', '必要な取得元', '単位', '採用条件',
  '入力値', '出所URLまたは資料名', 'ページまたは取得日時', '公式確認',
  'スコア反映', 'P1復帰', '買付上限', '銘柄別確認焦点', '注意点'
];

function parseCsv(text) {
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
  return rows.filter(r => r.some(v => v !== ''));
}

function csvEscape(value) {
  const text = value == null ? '' : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function toCsv(rows) {
  return rows.map(row => row.map(csvEscape).join(',')).join('\n') + '\n';
}

function htmlEscape(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function writeAuditHtml(rows) {
  const trs = rows.map(row => `<tr>${row.map((cell, idx) => {
    const cls = idx === 1 ? 'ok' : idx === 4 ? 'warn' : '';
    return `<td class="${cls}">${htmlEscape(cell)}</td>`;
  }).join('')}</tr>`).join('');
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>8035価格ゲート 反映監査</title>
  <style>
    body{font-family:Arial,"Yu Gothic",Meiryo,sans-serif;margin:0;background:#f5f8fc;color:#071f3a;line-height:1.7;font-size:17px}
    main{max-width:1180px;margin:0 auto;padding:28px}
    h1{font-size:30px;margin:0 0 12px;border-left:8px solid #0068a9;padding-left:14px}
    section{background:#fff;border:1px solid #c9d9e8;border-radius:12px;padding:20px;margin:18px 0;break-inside:avoid}
    .notice{border:2px solid #b30000;background:#fff5f5;color:#8a0000;font-weight:700;padding:14px;border-radius:10px}
    .table-wrap{overflow-x:auto}
    table{width:100%;border-collapse:collapse;table-layout:auto}
    th,td{border:1px solid #c9d9e8;padding:10px;vertical-align:top;word-break:normal;overflow-wrap:break-word}
    th{background:#e6f0f8;text-align:left}
    .ok{color:#007a3d;font-weight:700}.warn{color:#b66a00;font-weight:700}
    @media print{body{background:#fff}main{padding:16mm}section{page-break-inside:avoid}.table-wrap{overflow:visible}}
  </style>
</head>
<body>
<main>
  <h1>8035価格ゲート 反映監査</h1>
  <p>8035.T 東京エレクトロンの価格ゲート不足2項目だけを取得元・時刻つきで反映しました。財務、イベント、購入判断にはまだ進めません。</p>
  <section>
    <p class="notice">今回の反映後もスコア反映0項目、P1復帰0社、買付上限0円を維持します。価格ゲート通過と購入判断は別です。</p>
  </section>
  <section>
    <h2>反映内容</h2>
    <div class="table-wrap"><table><thead><tr><th>入力ID</th><th>処理</th><th>値</th><th>出所</th><th>理由</th></tr></thead><tbody>${trs}</tbody></table></div>
  </section>
</main>
</body>
</html>`;
  fs.writeFileSync(auditHtml, html, 'utf8');
}

function updateNav(file) {
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, 'utf8');
  if (html.includes(auditHtml)) return;
  const link = `<a href="${auditHtml}">8035価格ゲート反映監査</a>`;
  html = html.replace('</nav>', `  ${link}\n</nav>`);
  fs.writeFileSync(file, html, 'utf8');
}

const rows = parseCsv(fs.readFileSync(csvFile, 'utf8'));
const header = rows.shift();
if (header[0]) header[0] = header[0].replace(/^\uFEFF/, '');
if (header.join(',') !== headers.join(',')) {
  throw new Error('Unexpected CSV header');
}

const auditRows = [];
for (const row of rows) {
  const id = row[3];
  const update = updates.get(id);
  if (!update) continue;
  row[8] = update.value;
  row[9] = update.source;
  row[10] = update.position;
  row[11] = update.confirmation;
  row[12] = '禁止';
  row[13] = '0社';
  row[14] = '0円';
  auditRows.push([id, '反映', update.value, update.source, update.reason]);
}

fs.writeFileSync(csvFile, toCsv([headers, ...rows]), 'utf8');
fs.writeFileSync(auditCsv, `\uFEFF${toCsv([['入力ID', '処理', '値', '出所', '理由'], ...auditRows])}`, 'utf8');
writeAuditHtml(auditRows);

for (const file of ['index.html', 'latest_practical_start_20260614.html', 'daily_practical_compact_board_20260614.html']) {
  updateNav(file);
}

console.log(JSON.stringify({
  auditHtml,
  auditCsv,
  applied: auditRows.length,
  buyLimit: '0円'
}, null, 2));
