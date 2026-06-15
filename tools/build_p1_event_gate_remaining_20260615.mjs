import fs from 'node:fs';

const htmlFile = 'p1_event_gate_remaining_20260615.html';
const csvFile = 'p1_event_gate_remaining_20260615.csv';

const rows = [
  {
    item: 'CPI公式値',
    status: '部分確認',
    current: 'BLS公式値は入力済み。CPI-Uは前月比+0.5%、前年比+4.2%、コアは前月比+0.2%、前年比+2.9%。',
    remaining: '米10年金利、NASDAQ、SOX、VIX、ドル円の反応を同じ基準で確認する。',
    earliest: '確認可能',
    action: '市場反応を入れるまではイベントゲートを通さない。'
  },
  {
    item: '日銀会合',
    status: '未到来/結果待ち',
    current: '結果、声明、為替、日経平均/TOPIX反応が未入力。',
    remaining: '政策金利、国債買入方針、円高/円安反応、銀行・輸出・半導体への影響を確認する。',
    earliest: '2026-06-16以降',
    action: '円高ショックまたは日経/TOPIX急落なら半導体・高ボラ候補を保留。'
  },
  {
    item: 'FOMC',
    status: '未到来/結果待ち',
    current: '声明、金利見通し、米10年金利、NASDAQ/SOX反応が未入力。',
    remaining: '政策金利、声明文、ドットプロット、議長会見、米10年金利、NASDAQ、SOX、VIXを確認する。',
    earliest: '2026-06-17以降',
    action: '米10年金利急騰またはSOX急落なら高PER・半導体候補を保留。'
  },
  {
    item: '指数反応',
    status: '未入力',
    current: 'CPI、日銀、FOMCをまとめて通した後の指数反応が未入力。',
    remaining: '日経平均、TOPIX、S&P500、NASDAQ、SOX、VIXのイベント前後変化を比較する。',
    earliest: '2026-06-18以降',
    action: '指数が弱い場合は個別株比率を下げ、現金比率を上げる。'
  },
  {
    item: '個別株反応',
    status: '未入力',
    current: '6503.Tと8035.Tのイベント後反応が未入力。',
    remaining: '各銘柄の1日/5日反応、日経平均/TOPIX/SOXとの差、出来高変化を確認する。',
    earliest: '2026-06-18以降',
    action: '個別株が指数に劣後した場合はP1復帰を見送る。'
  }
];

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
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
  const link = `<a href="${htmlFile}">P1イベント後ゲート残項目</a>`;
  html = html.replace('</nav>', `  ${link}\n</nav>`);
  fs.writeFileSync(file, html, 'utf8');
}

fs.writeFileSync(csvFile, `\uFEFF${[
  ['項目', '状態', '現在', '残作業', '最短確認日', '運用上の扱い'],
  ...rows.map((row) => [row.item, row.status, row.current, row.remaining, row.earliest, row.action])
].map((row) => row.map(csvCell).join(',')).join('\n')}\n`, 'utf8');

const body = rows.map((row) => `<tr>
  <td>${h(row.item)}</td>
  <td class="${row.status.includes('部分') ? 'warn' : 'bad'}">${h(row.status)}</td>
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
    body{font-family:Arial,"Yu Gothic",Meiryo,sans-serif;margin:0;background:#f5f8fc;color:#071f3a;line-height:1.7;font-size:17px}
    main{max-width:1200px;margin:0 auto;padding:28px}
    h1{font-size:30px;margin:0 0 12px;border-left:8px solid #0068a9;padding-left:14px}
    section{background:#fff;border:1px solid #c9d9e8;border-radius:12px;padding:20px;margin:18px 0;break-inside:avoid}
    .notice{border:2px solid #b30000;background:#fff5f5;color:#8a0000;font-weight:700;padding:14px;border-radius:10px}
    .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px}
    .card{border:1px solid #c9d9e8;border-radius:10px;padding:14px;background:#f8fbff}
    .card b{display:block;color:#46627d}.card strong{font-size:28px;color:#003b67}
    .table-wrap{overflow-x:auto}
    table{width:100%;border-collapse:collapse;table-layout:auto}
    th,td{border:1px solid #c9d9e8;padding:10px;vertical-align:top;overflow-wrap:break-word}
    th{background:#e6f0f8;text-align:left}
    .bad{color:#b30000;font-weight:700}.warn{color:#b66a00;font-weight:700}
    @media print{body{background:#fff}main{padding:16mm}section{page-break-inside:avoid}.table-wrap{overflow:visible}}
  </style>
</head>
<body>
<main>
  <h1>P1イベント後ゲート 残項目</h1>
  <p>財務・価格・説明可能性は進みました。残りは6月イベント後の実データ確認です。ここを通すまでは、P1復帰と買付金額は出しません。</p>
  <section>
    <div class="cards">
      <div class="card"><b>入力済み</b><strong>36/44</strong><span>残り8項目</span></div>
      <div class="card"><b>ゲート通過</b><strong>6/8</strong><span>イベント後のみ未通過</span></div>
      <div class="card"><b>P1復帰</b><strong>0社</strong><span>まだ戻さない</span></div>
      <div class="card"><b>買付上限</b><strong>0円</strong><span>購入判断に使わない</span></div>
    </div>
  </section>
  <section>
    <p class="notice">イベント結果が出る前に、CPI・日銀・FOMC後の反応を推測で埋めません。指数と個別株の実反応がそろってから再判定します。</p>
  </section>
  <section>
    <h2>残項目</h2>
    <div class="table-wrap"><table><thead><tr><th>項目</th><th>状態</th><th>現在</th><th>残作業</th><th>最短確認日</th><th>運用上の扱い</th></tr></thead><tbody>${body}</tbody></table></div>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(htmlFile, html, 'utf8');

for (const file of ['index.html', 'latest_practical_start_20260614.html', 'daily_practical_compact_board_20260614.html']) {
  updateNav(file);
}

console.log(JSON.stringify({ htmlFile, csvFile, rows: rows.length, buyLimit: '0円' }, null, 2));
