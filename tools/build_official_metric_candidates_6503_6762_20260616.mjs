import fs from 'node:fs';

const outCsv = 'official_metric_candidates_6503_6762_20260616.csv';
const outHtml = 'official_metric_candidates_6503_6762_20260616.html';
const generatedAt = new Date().toLocaleString('ja-JP', {
  timeZone: 'Asia/Tokyo',
  hour12: false,
});

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, headers, rows) {
  fs.writeFileSync(
    file,
    `\uFEFF${[headers, ...rows.map((row) => headers.map((header) => row[header] ?? ''))]
      .map((row) => row.map(csvCell).join(','))
      .join('\n')}\n`,
    'utf8',
  );
}

function h(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const rows = [
  {
    ticker: '6503.T',
    name: '三菱電機',
    source_name: '2026年3月期 決算短信〔IFRS〕（連結）一部訂正版',
    source_date: '2026-06-11 / 原決算発表 2026-04-28',
    source_url: 'https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co1.pdf',
    metric: '売上高',
    value: '5,894,747',
    unit: '百万円',
    period: '2026年3月期',
    yoy: '+6.8%',
    source_line: 'PDF p1 L55-L62',
    input_judgement: '公式候補',
    score_reflection: '入力候補。検算後に反映',
  },
  {
    ticker: '6503.T',
    name: '三菱電機',
    source_name: '2026年3月期 決算短信〔IFRS〕（連結）一部訂正版',
    source_date: '2026-06-11 / 原決算発表 2026-04-28',
    source_url: 'https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co1.pdf',
    metric: '営業利益',
    value: '433,095',
    unit: '百万円',
    period: '2026年3月期',
    yoy: '+10.5%',
    source_line: 'PDF p1 L55-L62',
    input_judgement: '公式候補',
    score_reflection: '入力候補。検算後に反映',
  },
  {
    ticker: '6503.T',
    name: '三菱電機',
    source_name: '2026年3月期 決算短信〔IFRS〕（連結）一部訂正版',
    source_date: '2026-06-11 / 原決算発表 2026-04-28',
    source_url: 'https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co1.pdf',
    metric: '親会社株主帰属当期純利益',
    value: '407,758',
    unit: '百万円',
    period: '2026年3月期',
    yoy: '+25.8%',
    source_line: 'PDF p1 L55-L62',
    input_judgement: '公式候補',
    score_reflection: '入力候補。検算後に反映',
  },
  {
    ticker: '6503.T',
    name: '三菱電機',
    source_name: '2026年3月期 決算短信〔IFRS〕（連結）一部訂正版',
    source_date: '2026-06-11 / 原決算発表 2026-04-28',
    source_url: 'https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co1.pdf',
    metric: 'EPS',
    value: '198.31',
    unit: '円',
    period: '2026年3月期',
    yoy: '',
    source_line: 'PDF p1 L63-L78',
    input_judgement: '公式候補',
    score_reflection: 'PER計算候補。株価基準日が必要',
  },
  {
    ticker: '6503.T',
    name: '三菱電機',
    source_name: '2026年3月期 決算短信〔IFRS〕（連結）一部訂正版',
    source_date: '2026-06-11 / 原決算発表 2026-04-28',
    source_url: 'https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co1.pdf',
    metric: 'ROE',
    value: '9.7',
    unit: '%',
    period: '2026年3月期',
    yoy: '',
    source_line: 'PDF p1 L69-L78',
    input_judgement: '公式候補',
    score_reflection: '入力候補。検算後に反映',
  },
  {
    ticker: '6503.T',
    name: '三菱電機',
    source_name: '2026年3月期 決算短信〔IFRS〕（連結）一部訂正版',
    source_date: '2026-06-11 / 原決算発表 2026-04-28',
    source_url: 'https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co1.pdf',
    metric: '営業利益率',
    value: '7.3',
    unit: '%',
    period: '2026年3月期',
    yoy: '',
    source_line: 'PDF p1 L69-L78',
    input_judgement: '公式候補',
    score_reflection: '入力候補。検算後に反映',
  },
  {
    ticker: '6503.T',
    name: '三菱電機',
    source_name: '2026年3月期 決算短信〔IFRS〕（連結）一部訂正版',
    source_date: '2026-06-11 / 原決算発表 2026-04-28',
    source_url: 'https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co1.pdf',
    metric: 'BPS',
    value: '2,191.26',
    unit: '円',
    period: '2026年3月期末',
    yoy: '',
    source_line: 'PDF p1 L80-L90',
    input_judgement: '公式候補',
    score_reflection: 'PBR計算候補。株価基準日が必要',
  },
  {
    ticker: '6503.T',
    name: '三菱電機',
    source_name: '2026年3月期 決算短信〔IFRS〕（連結）一部訂正版',
    source_date: '2026-06-11 / 原決算発表 2026-04-28',
    source_url: 'https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co1.pdf',
    metric: '2027年3月期 売上高予想',
    value: '6,200,000',
    unit: '百万円',
    period: '2027年3月期予想',
    yoy: '+5.2%',
    source_line: 'PDF p1 L115-L122',
    input_judgement: '公式候補',
    score_reflection: '会社予想候補。検算後に反映',
  },
  {
    ticker: '6503.T',
    name: '三菱電機',
    source_name: '2026年3月期 決算短信〔IFRS〕（連結）一部訂正版',
    source_date: '2026-06-11 / 原決算発表 2026-04-28',
    source_url: 'https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co1.pdf',
    metric: '2027年3月期 EPS予想',
    value: '231.01',
    unit: '円',
    period: '2027年3月期予想',
    yoy: '',
    source_line: 'PDF p1 L115-L122',
    input_judgement: '公式候補',
    score_reflection: '予想PER計算候補。株価基準日が必要',
  },
  {
    ticker: '6762.T',
    name: 'TDK',
    source_name: 'Consolidated Financial Results for FY March 2026',
    source_date: '2026-04-28',
    source_url: 'https://www.tdk.com/system/files/2026042800_0mqf56xw_en.pdf',
    metric: 'Net sales',
    value: '2,504,820',
    unit: 'million yen',
    period: 'FY March 2026',
    yoy: '+13.6%',
    source_line: 'PDF p1 L56-L71',
    input_judgement: '公式候補',
    score_reflection: '入力候補。検算後に反映',
  },
  {
    ticker: '6762.T',
    name: 'TDK',
    source_name: 'Consolidated Financial Results for FY March 2026',
    source_date: '2026-04-28',
    source_url: 'https://www.tdk.com/system/files/2026042800_0mqf56xw_en.pdf',
    metric: 'Operating profit',
    value: '272,415',
    unit: 'million yen',
    period: 'FY March 2026',
    yoy: '+21.5%',
    source_line: 'PDF p1 L56-L71',
    input_judgement: '公式候補',
    score_reflection: '入力候補。検算後に反映',
  },
  {
    ticker: '6762.T',
    name: 'TDK',
    source_name: 'Consolidated Financial Results for FY March 2026',
    source_date: '2026-04-28',
    source_url: 'https://www.tdk.com/system/files/2026042800_0mqf56xw_en.pdf',
    metric: 'Net profit attributable to owners of parent',
    value: '195,663',
    unit: 'million yen',
    period: 'FY March 2026',
    yoy: '+17.0%',
    source_line: 'PDF p1 L62-L71',
    input_judgement: '公式候補',
    score_reflection: '入力候補。検算後に反映',
  },
  {
    ticker: '6762.T',
    name: 'TDK',
    source_name: 'Consolidated Financial Results for FY March 2026',
    source_date: '2026-04-28',
    source_url: 'https://www.tdk.com/system/files/2026042800_0mqf56xw_en.pdf',
    metric: 'Basic EPS',
    value: '103.09',
    unit: 'yen',
    period: 'FY March 2026',
    yoy: '',
    source_line: 'PDF p1 L65-L71',
    input_judgement: '公式候補',
    score_reflection: 'PER計算候補。株価基準日が必要',
  },
  {
    ticker: '6762.T',
    name: 'TDK',
    source_name: 'Consolidated Financial Results for FY March 2026',
    source_date: '2026-04-28',
    source_url: 'https://www.tdk.com/system/files/2026042800_0mqf56xw_en.pdf',
    metric: 'ROE',
    value: '9.8',
    unit: '%',
    period: 'FY March 2026',
    yoy: '',
    source_line: 'PDF p1 L72-L80',
    input_judgement: '公式候補',
    score_reflection: '入力候補。検算後に反映',
  },
  {
    ticker: '6762.T',
    name: 'TDK',
    source_name: 'Consolidated Financial Results for FY March 2026',
    source_date: '2026-04-28',
    source_url: 'https://www.tdk.com/system/files/2026042800_0mqf56xw_en.pdf',
    metric: 'Operating profit margin',
    value: '10.9',
    unit: '%',
    period: 'FY March 2026',
    yoy: '',
    source_line: 'PDF p1 L72-L80',
    input_judgement: '公式候補',
    score_reflection: '入力候補。検算後に反映',
  },
  {
    ticker: '6762.T',
    name: 'TDK',
    source_name: 'Consolidated Financial Results for FY March 2026',
    source_date: '2026-04-28',
    source_url: 'https://www.tdk.com/system/files/2026042800_0mqf56xw_en.pdf',
    metric: 'BPS',
    value: '1,152.30',
    unit: 'yen',
    period: 'FY March 2026 year-end',
    yoy: '',
    source_line: 'PDF p2 L86-L99',
    input_judgement: '公式候補',
    score_reflection: 'PBR計算候補。株価基準日が必要',
  },
  {
    ticker: '6762.T',
    name: 'TDK',
    source_name: 'Consolidated Financial Results for FY March 2026',
    source_date: '2026-04-28',
    source_url: 'https://www.tdk.com/system/files/2026042800_0mqf56xw_en.pdf',
    metric: 'FY March 2027 net sales forecast',
    value: '2,580,000',
    unit: 'million yen',
    period: 'FY March 2027 forecast',
    yoy: '+3.0%',
    source_line: 'PDF p2 L142-L154',
    input_judgement: '公式候補',
    score_reflection: '会社予想候補。検算後に反映',
  },
  {
    ticker: '6762.T',
    name: 'TDK',
    source_name: 'Consolidated Financial Results for FY March 2026',
    source_date: '2026-04-28',
    source_url: 'https://www.tdk.com/system/files/2026042800_0mqf56xw_en.pdf',
    metric: 'FY March 2027 EPS forecast',
    value: '118.54',
    unit: 'yen',
    period: 'FY March 2027 forecast',
    yoy: '',
    source_line: 'PDF p2 L142-L154',
    input_judgement: '公式候補',
    score_reflection: '予想PER計算候補。株価基準日が必要',
  },
  {
    ticker: '6762.T',
    name: 'TDK',
    source_name: 'Consolidated Financial Results for FY March 2026',
    source_date: '2026-04-28',
    source_url: 'https://www.tdk.com/system/files/2026042800_0mqf56xw_en.pdf',
    metric: 'Sales by product: Energy Application Products',
    value: '1,370,304',
    unit: 'million yen',
    period: 'FY March 2026',
    yoy: '+16.5%',
    source_line: 'PDF p7 L288-L296',
    input_judgement: '公式候補',
    score_reflection: 'テーマ寄与候補。検算後に反映',
  },
];

const headers = [
  '作成時刻',
  'ticker',
  'name',
  'source_name',
  'source_date',
  'source_url',
  'metric',
  'value',
  'unit',
  'period',
  'yoy',
  'source_line',
  'input_judgement',
  'score_reflection',
];
writeCsv(outCsv, headers, rows.map((row) => ({ 作成時刻: generatedAt, ...row })));

function table(sectionRows) {
  return `<div class="table-wrap"><table>
    <thead><tr><th>銘柄</th><th>項目</th><th>値</th><th>単位</th><th>対象期間</th><th>前年比</th><th>資料</th><th>反映扱い</th></tr></thead>
    <tbody>${sectionRows.map((row) => `<tr>
      <td><b>${h(row.ticker)}</b><br>${h(row.name)}</td>
      <td>${h(row.metric)}</td>
      <td class="num">${h(row.value)}</td>
      <td>${h(row.unit)}</td>
      <td>${h(row.period)}</td>
      <td>${h(row.yoy)}</td>
      <td><a href="${h(row.source_url)}" target="_blank" rel="noopener">${h(row.source_name)}</a><br><span>${h(row.source_date)} / ${h(row.source_line)}</span></td>
      <td>${h(row.score_reflection)}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6503・6762 公式数値候補</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--red:#b42318;--green:#116b4f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.75}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:34px}
    header h1{margin:0 0 10px;font-size:clamp(34px,4vw,50px);line-height:1.18;letter-spacing:0}
    header p{margin:0;font-size:19px;font-weight:900;max-width:1180px}
    main{max-width:1440px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:20px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:28px}
    p{margin:0 0 10px}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:16px}
    .card strong{display:block;font-size:32px;color:var(--blue);line-height:1.25}
    .card span{display:block;font-weight:900;color:#263e55}
    .notice{border:2px solid var(--red);background:#fff1f1;color:#8a0000;border-radius:10px;padding:14px 16px;font-weight:900;margin:0}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:9px 10px;vertical-align:top;overflow-wrap:anywhere}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    a{color:#004f86;font-weight:900}
    span{font-weight:800;color:#526b82}
    .num{font-weight:900;color:var(--navy);font-size:19px}
    .bad{color:var(--red)!important;font-weight:900}
    @media(max-width:980px){main{padding:12px}.cards{grid-template-columns:1fr}body{font-size:17px}}
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:10px;padding:5px}}
  </style>
</head>
<body>
<header>
  <h1>6503・6762 公式数値候補</h1>
  <p>三菱電機とTDKについて、公式決算資料から入力候補にできる数値を整理しました。PER/PBRは株価基準日が必要なため、まだ確定値として扱いません。</p>
</header>
<main>
  <section>
    <h2>今回の到達点</h2>
    <div class="cards">
      <div class="card"><b>公式数値候補</b><strong>${rows.length}件</strong><span>財務・予想・テーマ寄与</span></div>
      <div class="card"><b>対象銘柄</b><strong>2社</strong><span>6503 三菱電機 / 6762 TDK</span></div>
      <div class="card"><b>PER/PBR</b><strong class="bad">未確定</strong><span>株価基準日の接続が必要</span></div>
      <div class="card"><b>買付反映</b><strong class="bad">未反映</strong><span>検算前は比率へ使わない</span></div>
    </div>
  </section>

  <section>
    <p class="notice">このページは公式資料からの入力候補です。まだ購入判断ではありません。次に、入力CSVへ転記し、資料日付・対象期間・株価基準日・確認者をそろえて反映判定ゲートへ通します。</p>
    <p>CSV: <a href="${h(outCsv)}">${h(outCsv)}</a></p>
  </section>

  <section>
    <h2>三菱電機 6503.T</h2>
    ${table(rows.filter((row) => row.ticker === '6503.T'))}
  </section>

  <section>
    <h2>TDK 6762.T</h2>
    ${table(rows.filter((row) => row.ticker === '6762.T'))}
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(outHtml, html, 'utf8');

console.log(JSON.stringify({
  outHtml,
  outCsv,
  rows: rows.length,
}, null, 2));
