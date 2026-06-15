import fs from 'node:fs';

const queueCsv = 'p1_segment_next_gate_input_queue_20260615.csv';
const auditCsv = 'p1_per_pbr_calculation_apply_audit_20260615.csv';
const auditHtml = 'p1_per_pbr_calculation_apply_audit_20260615.html';
const priceSource = 'https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?range=5d&interval=1d';
const priceTime = '2026-06-15T06:30:00Z / 2026-06-15 15:30 JST';

const updates = {
  '6503_per_official': {
    value: '予想PER 25.36倍 / 実績PER 29.54倍',
    source: '三菱電機 2026年3月期 決算短信〔IFRS〕 一部訂正版 + Yahoo Finance chart API',
    position: '会社予想EPS 231.01円、実績EPS 198.31円、株価5,858円、株価取得時刻 2026-06-15 15:30 JST',
    confirmation: '済',
    formula: '予想PER=5,858÷231.01=25.36倍、実績PER=5,858÷198.31=29.54倍',
    reason: '公式EPSと同一基準日の株価で計算。公式PERそのものではなく、計算根拠つきPERとして財務ゲートに入力。'
  },
  '6503_pbr_official': {
    value: 'PBR 2.67倍',
    source: '三菱電機 2026年3月期 決算短信〔IFRS〕 一部訂正版 + Yahoo Finance chart API',
    position: 'BPS 2,191.26円、株価5,858円、株価取得時刻 2026-06-15 15:30 JST',
    confirmation: '済',
    formula: 'PBR=5,858÷2,191.26=2.67倍',
    reason: '公式BPSと同一基準日の株価で計算。公式PBRそのものではなく、計算根拠つきPBRとして財務ゲートに入力。'
  },
  '8035_per_official': {
    value: '実績PER 58.00倍',
    source: '東京エレクトロン 2026年3月期 決算短信〔日本基準〕 + Yahoo Finance chart API',
    position: '実績EPS 1,254.57円、株価72,760円、株価取得時刻 2026-06-15 15:30 JST',
    confirmation: '済',
    formula: '実績PER=72,760÷1,254.57=58.00倍。第2四半期累計予想EPSは通期PER計算に使わない。',
    reason: '公式EPSと同一基準日の株価で計算。通期予想PERは作らず、実績PERだけを計算根拠つきで入力。'
  },
  '8035_pbr_official': {
    value: 'PBR 16.17倍',
    source: '東京エレクトロン 2026年3月期 決算短信〔日本基準〕 + Yahoo Finance chart API',
    position: 'BPS 4,498.85円、株価72,760円、株価取得時刻 2026-06-15 15:30 JST',
    confirmation: '済',
    formula: 'PBR=72,760÷4,498.85=16.17倍',
    reason: '公式BPSと同一基準日の株価で計算。高PBR銘柄として、後続の事業寄与・イベント反応確認を必須にする。'
  }
};

function parseCsv(text) {
  const clean = String(text ?? '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quote = false;
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    const next = clean[i + 1];
    if (quote) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quote = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quote = true;
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
  return rows.filter((r) => r.some((v) => String(v ?? '').trim() !== ''));
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

function writeAuditHtml(rows) {
  const body = rows.map((row) => `<tr>${row.map((cell, idx) => {
    const cls = idx === 1 ? 'ok' : idx === 5 ? 'warn' : '';
    return `<td class="${cls}">${h(cell)}</td>`;
  }).join('')}</tr>`).join('');
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PER/PBR計算入力 反映監査</title>
  <style>
    body{font-family:Arial,"Yu Gothic",Meiryo,sans-serif;margin:0;background:#f5f8fc;color:#071f3a;line-height:1.7;font-size:17px}
    main{max-width:1200px;margin:0 auto;padding:28px}
    h1{font-size:30px;margin:0 0 12px;border-left:8px solid #0068a9;padding-left:14px}
    section{background:#fff;border:1px solid #c9d9e8;border-radius:12px;padding:20px;margin:18px 0;break-inside:avoid}
    .notice{border:2px solid #b30000;background:#fff5f5;color:#8a0000;font-weight:700;padding:14px;border-radius:10px}
    .table-wrap{overflow-x:auto}
    table{width:100%;border-collapse:collapse;table-layout:auto}
    th,td{border:1px solid #c9d9e8;padding:10px;vertical-align:top;overflow-wrap:break-word}
    th{background:#e6f0f8;text-align:left}
    .ok{color:#007a3d;font-weight:700}.warn{color:#b66a00;font-weight:700}
    @media print{body{background:#fff}main{padding:16mm}section{page-break-inside:avoid}.table-wrap{overflow:visible}}
  </style>
</head>
<body>
<main>
  <h1>PER/PBR計算入力 反映監査</h1>
  <p>6503.T 三菱電機、8035.T 東京エレクトロンについて、公式EPS/BPSと同一基準日の株価を使い、計算式付きでPER/PBRを入力しました。</p>
  <section>
    <p class="notice">これは購入判断ではありません。事業寄与と6月イベント後反応が未通過のため、スコア反映0項目、P1復帰0社、買付上限0円を維持します。</p>
  </section>
  <section>
    <h2>反映内容</h2>
    <div class="table-wrap"><table><thead><tr><th>入力ID</th><th>処理</th><th>値</th><th>根拠</th><th>計算式</th><th>注意</th></tr></thead><tbody>${body}</tbody></table></div>
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
  const link = `<a href="${auditHtml}">PER/PBR計算入力監査</a>`;
  html = html.replace('</nav>', `  ${link}\n</nav>`);
  fs.writeFileSync(file, html, 'utf8');
}

const rows = parseCsv(fs.readFileSync(queueCsv, 'utf8'));
const headers = rows.shift();
const auditRows = [];
for (const row of rows) {
  const inputId = row[3];
  const update = updates[inputId];
  if (!update) continue;
  row[8] = update.value;
  row[9] = update.source;
  row[10] = update.position;
  row[11] = update.confirmation;
  row[12] = '禁止';
  row[13] = '0社';
  row[14] = '0円';
  auditRows.push([inputId, '反映', update.value, update.position, update.formula, update.reason]);
}

writeCsv(queueCsv, [headers, ...rows]);
writeCsv(auditCsv, [['入力ID', '処理', '値', '根拠', '計算式', '注意'], ...auditRows]);
writeAuditHtml(auditRows);

for (const file of ['index.html', 'latest_practical_start_20260614.html', 'daily_practical_compact_board_20260614.html']) {
  updateNav(file);
}

console.log(JSON.stringify({
  auditHtml,
  auditCsv,
  applied: auditRows.length,
  priceSource,
  priceTime,
  buyLimit: '0円'
}, null, 2));
