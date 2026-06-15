import fs from 'node:fs';

const htmlFile = 'event_pre_baseline_20260615.html';
const csvFile = 'event_pre_baseline_20260615.csv';
const generatedAt = new Date().toLocaleString('ja-JP', {
  timeZone: 'Asia/Tokyo',
  hour12: false,
});

const targets = [
  { group: '日銀前の日本株・為替基準値', symbol: '^N225', name: '日経平均' },
  { group: '日銀前の日本株・為替基準値', symbol: '1306.T', name: 'TOPIX連動ETF(代替)' },
  { group: '日銀前の日本株・為替基準値', symbol: 'JPY=X', name: 'ドル円' },
  { group: '候補銘柄のイベント前基準値', symbol: '6503.T', name: '三菱電機' },
  { group: '候補銘柄のイベント前基準値', symbol: '8035.T', name: '東京エレクトロン' },
  { group: 'FOMC前の米国・半導体基準値', symbol: '^TNX', name: '米10年金利' },
  { group: 'FOMC前の米国・半導体基準値', symbol: '^IXIC', name: 'NASDAQ' },
  { group: 'FOMC前の米国・半導体基準値', symbol: '^SOX', name: 'SOX指数' },
  { group: 'FOMC前の米国・半導体基準値', symbol: '^VIX', name: 'VIX' },
];

function h(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, rows) {
  fs.writeFileSync(file, `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`, 'utf8');
}

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts * 1000).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour12: false,
  });
}

function formatNumber(value, symbol) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '';
  const num = Number(value);
  if (symbol === '^TNX') return `${num.toFixed(3)}%`;
  if (symbol === 'JPY=X') return num.toFixed(3);
  return num.toLocaleString('ja-JP', { maximumFractionDigits: 2 });
}

async function fetchSymbol(target) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(target.symbol)}?range=5d&interval=1d`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const json = await response.json();
    const result = json?.chart?.result?.[0];
    const timestamps = result?.timestamp ?? [];
    const closes = result?.indicators?.quote?.[0]?.close ?? [];
    let latest = null;
    for (let i = closes.length - 1; i >= 0; i -= 1) {
      if (closes[i] !== null && closes[i] !== undefined) {
        latest = { timestamp: timestamps[i], close: closes[i] };
        break;
      }
    }
    if (!latest) throw new Error('no close data');
    const proxyNote = target.symbol === '1306.T'
      ? 'TOPIX指数の直接データが取得できないため、TOPIX連動ETFを地合い確認用の代替値として記録。'
      : 'イベント前の比較基準値として記録。';
    return {
      ...target,
      closeRaw: latest.close,
      close: formatNumber(latest.close, target.symbol),
      date: formatDate(latest.timestamp),
      status: '取得済',
      source: url,
      note: target.symbol === '^TNX' ? 'Yahoo ^TNXは米10年金利の値として取得。単位を確認して記録。' : proxyNote,
    };
  } catch (error) {
    return {
      ...target,
      closeRaw: '',
      close: '',
      date: '',
      status: '取得失敗',
      source: url,
      note: `取得失敗: ${error.message}`,
    };
  }
}

function updateNav(file) {
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, 'utf8');
  if (html.includes(htmlFile)) return;
  const link = `<a href="${htmlFile}">6月イベント前 基準値</a>`;
  html = html.replace('</nav>', `  ${link}\n</nav>`);
  fs.writeFileSync(file, html, 'utf8');
}

const results = await Promise.all(targets.map(fetchSymbol));

writeCsv(csvFile, [
  ['取得時刻', '区分', 'シンボル', '名称', '基準値', '基準値日時', '状態', '出所', '備考'],
  ...results.map((row) => [generatedAt, row.group, row.symbol, row.name, row.close, row.date, row.status, row.source, row.note]),
]);

const grouped = Map.groupBy(results, (row) => row.group);
const sections = [...grouped.entries()].map(([group, rows]) => {
  const body = rows.map((row) => `<tr>
    <td>${h(row.symbol)}</td>
    <td>${h(row.name)}</td>
    <td class="value">${h(row.close)}</td>
    <td>${h(row.date)}</td>
    <td class="${row.status === '取得済' ? 'ok' : 'bad'}">${h(row.status)}</td>
    <td>${h(row.note)}</td>
  </tr>`).join('');
  return `<section>
    <h2>${h(group)}</h2>
    <div class="table-wrap"><table><thead><tr><th>シンボル</th><th>名称</th><th>基準値</th><th>基準値日時</th><th>状態</th><th>備考</th></tr></thead><tbody>${body}</tbody></table></div>
  </section>`;
}).join('');

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月イベント前 基準値</title>
  <style>
    body{font-family:Arial,"Yu Gothic",Meiryo,sans-serif;margin:0;background:#f5f8fc;color:#061827;line-height:1.75;font-size:18px}
    main{max-width:1180px;margin:0 auto;padding:28px}
    h1{font-size:32px;margin:0 0 12px;border-left:8px solid #0068a9;padding-left:14px}
    section{background:#fff;border:1px solid #c9d9e8;border-radius:12px;padding:20px;margin:18px 0;break-inside:avoid}
    .notice{border:2px solid #b42318;background:#fff5f5;color:#8a0000;font-weight:700;padding:14px;border-radius:10px}
    .table-wrap{overflow-x:auto}
    table{width:100%;border-collapse:collapse;table-layout:auto}
    th,td{border:1px solid #c9d9e8;padding:11px;vertical-align:top;overflow-wrap:break-word}
    th{background:#e6f0f8;text-align:left}
    .value{font-size:21px;font-weight:700;color:#003b67}
    .ok{color:#007a3d;font-weight:700}.bad{color:#b30000;font-weight:700}
    @media print{body{background:#fff}main{padding:16mm}section{page-break-inside:avoid}.table-wrap{overflow:visible}}
  </style>
</head>
<body>
<main>
  <h1>6月イベント前 基準値</h1>
  <p>日銀会合、FOMC、イベント後の指数・個別株反応を判定するため、イベント前の基準値を固定します。このページは購入判断ではなく、発表後に比較するための記録です。</p>
  <section>
    <p class="notice">この基準値だけでは買付判断に進みません。発表後の変化率、指数との差、候補銘柄の反応を入力してから再判定します。P1復帰0社・買付上限0円は維持します。</p>
  </section>
  ${sections}
  <section>
    <h2>次に入力するもの</h2>
    <p>日銀会合後: 政策変更、ドル円、日経平均/TOPIX、6503.T・8035.Tの反応。</p>
    <p>FOMC後: 米10年金利、NASDAQ、SOX、VIX、6503.T・8035.Tの反応。</p>
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
  generatedAt,
  fetched: results.filter((row) => row.status === '取得済').length,
  failed: results.filter((row) => row.status !== '取得済').map((row) => row.symbol),
  buyLimit: '0円',
}, null, 2));
