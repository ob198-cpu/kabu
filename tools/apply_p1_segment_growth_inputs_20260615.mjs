import fs from 'node:fs';

const queueCsv = 'p1_segment_next_gate_input_queue_20260615.csv';
const auditCsv = 'p1_segment_growth_apply_audit_20260615.csv';
const auditHtml = 'p1_segment_growth_apply_audit_20260615.html';

const updates = {
  '6503_order_or_segment_growth': {
    value: '部門別受注: インフラ+3%、エネルギーシステム+14%、防衛・宇宙+5%、FAシステム+22%、セミコンダクター・デバイス+19%。2026年度計画は連結売上+5%、調整後営業利益+18%。',
    source: '三菱電機 2026年3月期 決算短信〔IFRS〕 一部訂正版',
    url: 'https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co1.pdf',
    position: 'P15 L718-L728、P15 L674-L677',
    confirmation: '済',
    reason: '電力・FA・半導体・防衛などのテーマが、受注と会社計画に接続しているかを確認するための事業寄与入力。'
  },
  '8035_order_or_segment_growth': {
    value: 'WFE市場はCY2026-2027に年1500億-1700億ドル、CY2025比+20%以上。先端デバイス向け+30%以上。塗布・現像シェア90%以上でFY2027売上+50%以上、エッチングシェア50%以上でFY2027売上+25%以上、先端パッケージングFY2026売上約2,000億円・FY2027+60%以上。',
    source: '東京エレクトロン 2026年3月期 決算説明会資料',
    url: 'https://www.tel.co.jp/ir/library/report/jngpc500000000l6-att/fy26q4presentations-j.pdf',
    position: 'P14 L349-L359、P15 L361-L372',
    confirmation: '済',
    reason: '半導体製造装置テーマを、WFE市場見通し、製品シェア、製品別売上成長ドライバーで確認するための事業寄与入力。'
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
  <title>事業寄与入力 反映監査</title>
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
  <h1>事業寄与入力 反映監査</h1>
  <p>テーマ名だけで残さないため、公式資料から事業・受注・市場見通しに接続する数値を入力しました。</p>
  <section>
    <p class="notice">財務ゲートは進みますが、6月イベント後ゲートが未通過のため、スコア反映0項目、P1復帰0社、買付上限0円を維持します。</p>
  </section>
  <section>
    <h2>反映内容</h2>
    <div class="table-wrap"><table><thead><tr><th>入力ID</th><th>処理</th><th>値</th><th>資料</th><th>確認位置</th><th>理由</th></tr></thead><tbody>${body}</tbody></table></div>
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
  const link = `<a href="${auditHtml}">事業寄与入力監査</a>`;
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
  row[9] = `${update.source} / ${update.url}`;
  row[10] = update.position;
  row[11] = update.confirmation;
  row[12] = '禁止';
  row[13] = '0社';
  row[14] = '0円';
  auditRows.push([inputId, '反映', update.value, update.source, update.position, update.reason]);
}

writeCsv(queueCsv, [headers, ...rows]);
writeCsv(auditCsv, [['入力ID', '処理', '値', '資料', '確認位置', '理由'], ...auditRows]);
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
