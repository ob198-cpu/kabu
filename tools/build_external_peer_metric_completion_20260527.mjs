import fs from 'fs';
import https from 'https';

const generatedAt = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
}).format(new Date());

const fallbackPrices = {
  '2801.T': 1378.5,
  '2503.T': 2726.5,
  '2502.T': 1514.5,
  '8035.T': 52910
};

const sourceInputs = [
  {
    ticker: '2801.T',
    company: 'キッコーマン',
    group: '食品同業',
    sourceType: '公式短信 + 株価API',
    officialSource: 'https://www.kikkoman.com/jp/ir/assets/tan202603.pdf',
    priceSource: 'Yahoo Finance chart API',
    eps: 65.99,
    bps: 605.40,
    roe: 11.5,
    epsBasis: '2026年3月期 実績EPS',
    bpsBasis: '2026年3月期 1株当たり親会社所有者帰属持分',
    status: '補助値計算可',
    note: '味の素の高PER・高PBRを食品同業内で見るための比較対象。'
  },
  {
    ticker: '2503.T',
    company: 'キリンHD',
    group: '食品・飲料同業',
    sourceType: '公式Factbook + 株価API',
    officialSource: 'https://www.kirinholdings.com/en/investors/files/pdf/factbook_2026.pdf',
    priceSource: 'Yahoo Finance chart API',
    eps: 193,
    bps: null,
    roe: 12.0,
    epsBasis: '2026年予想EPS',
    bpsBasis: 'BPS未取得',
    status: 'PER補助値のみ計算可',
    note: 'EPSとROEは確認できるがBPSが未接続のため、PBRは正式比較に入れない。'
  },
  {
    ticker: '2502.T',
    company: 'アサヒGHD',
    group: '食品・飲料同業',
    sourceType: '公式進捗資料 + 株価API',
    officialSource: 'https://www.asahigroup-holdings.com/en/newsroom/detail/20260226-0109.html',
    priceSource: 'Yahoo Finance chart API',
    eps: null,
    bps: null,
    roe: null,
    epsBasis: '2025年通期決算の正式発表待ち',
    bpsBasis: '2025年通期決算の正式発表待ち',
    status: '同条件比較から除外',
    note: 'システム障害により2025年通期決算発表が遅延。比較に使うと土台がずれるため、現時点では食品同業の正式中央値に入れない。'
  },
  {
    ticker: '8035.T',
    company: '東京エレクトロン',
    group: '半導体製造装置同業',
    sourceType: '公式短信 + 株価API',
    officialSource: 'https://www.tel.com/ir/irta3a00000006g5-att/fy26q4tanshin-e.pdf',
    priceSource: 'Yahoo Finance chart API',
    eps: 1254.57,
    bps: 4498.85,
    roe: 29.6,
    epsBasis: '2026年3月期 実績EPS',
    bpsBasis: '2026年3月期 純資産1株当たり',
    status: '補助値計算可',
    note: 'ディスコ、SCREENの半導体製造装置比較で最大手基準として使う。'
  }
];

function fetchPrice(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=5d&interval=1d`;
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) throw new Error(`HTTP ${res.statusCode}`);
          const data = JSON.parse(body);
          const meta = data.chart?.result?.[0]?.meta;
          resolve({
            ticker,
            price: Number(meta?.regularMarketPrice ?? fallbackPrices[ticker]),
            priceStatus: '取得',
            marketTime: meta?.regularMarketTime ?? ''
          });
        } catch (error) {
          resolve({
            ticker,
            price: fallbackPrices[ticker],
            priceStatus: `代替値使用: ${error.message}`,
            marketTime: ''
          });
        }
      });
    }).on('error', (error) => {
      resolve({
        ticker,
        price: fallbackPrices[ticker],
        priceStatus: `代替値使用: ${error.message}`,
        marketTime: ''
      });
    });
  });
}

function round(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return '';
  return Number(value).toFixed(digits).replace(/\.00$/, '');
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, rows) {
  fs.writeFileSync(file, rows.map(row => row.map(csvEscape).join(',')).join('\n') + '\n', 'utf8');
}

const prices = Object.fromEntries((await Promise.all(sourceInputs.map(item => fetchPrice(item.ticker)))).map(item => [item.ticker, item]));

const detail = sourceInputs.map(item => {
  const price = prices[item.ticker]?.price ?? fallbackPrices[item.ticker];
  const per = item.eps ? price / item.eps : null;
  const pbr = item.bps ? price / item.bps : null;
  return {
    ...item,
    price,
    priceStatus: prices[item.ticker]?.priceStatus ?? '未取得',
    marketTime: prices[item.ticker]?.marketTime ?? '',
    per,
    pbr
  };
});

const ajinomoto = {
  ticker: '2802.T',
  company: '味の素',
  per: 42.38,
  pbr: 6.60,
  roe: 17.75
};

const tel = detail.find(item => item.ticker === '8035.T');
const kikkoman = detail.find(item => item.ticker === '2801.T');
const kirin = detail.find(item => item.ticker === '2503.T');

const summaryRows = [
  ['作成', '項目', '結果', '意味'],
  [generatedAt, '食品同業比較', `味の素PER ${ajinomoto.per}倍 / キッコーマン補助PER ${round(kikkoman.per)}倍 / キリン補助PER ${round(kirin.per)}倍`, '味の素は選定候補の中で成長性はあるが、食品同業比較ではPERが高い。ABF・ヘルスケア・利益成長で説明できるかを確認条件にする。'],
  [generatedAt, '食品同業PBR', `味の素PBR ${ajinomoto.pbr}倍 / キッコーマン補助PBR ${round(kikkoman.pbr)}倍 / キリンPBR 未接続`, '味の素のPBRも高いため、単なる生活必需品枠としては扱わない。成長枠として別評価する。'],
  [generatedAt, 'アサヒGHD', '同条件比較から除外', '2025年通期決算の正式発表待ち。現時点で無理にPER/PBR/ROEを作らない。'],
  [generatedAt, '東京エレクトロンPER補完', `株価 ${round(tel.price)}円 / EPS ${tel.eps}円 / 補助PER ${round(tel.per)}倍`, 'ディスコ、SCREENを半導体製造装置内で比較するための最大手基準を追加。'],
  [generatedAt, '次に反映すること', '候補スコアへ直接加点しない', '同業比較はまず説明補助、割高警戒、除外条件に使う。購入候補スコアへ混ぜるのは、同一基準のデータがそろってから。']
];

const detailRows = [
  ['作成', '銘柄', 'グループ', '株価', 'EPS', 'BPS', 'ROE', '補助PER', '補助PBR', '状態', '根拠資料', '算出式/扱い', '注記']
];
for (const item of detail) {
  detailRows.push([
    generatedAt,
    `${item.ticker} ${item.company}`,
    item.group,
    item.price ? `${round(item.price)}円` : '未取得',
    item.eps ? `${round(item.eps)}円` : '未取得',
    item.bps ? `${round(item.bps)}円` : item.bpsBasis,
    item.roe ? `${round(item.roe)}%` : '未取得',
    item.per ? `${round(item.per)}倍` : '未算出',
    item.pbr ? `${round(item.pbr)}倍` : '未算出',
    item.status,
    item.officialSource,
    item.eps ? `PER=株価÷EPS。PBR=株価÷BPS。${item.epsBasis} / ${item.bpsBasis}` : '同条件の公式EPS/BPSが未接続のため算出しない。',
    item.note
  ]);
}

const ruleRows = [
  ['作成', 'ルール', '内容'],
  [generatedAt, '同業比較の扱い', '候補スコアに単純加点しない。割高警戒、説明補助、除外条件、追加確認条件として使う。'],
  [generatedAt, '食品比較の注意', '味の素は食品安定枠ではなく、高PER成長枠として扱う。食品同業より高いPER/PBRを利益成長で説明できなければ保留。'],
  [generatedAt, '半導体比較の注意', '東京エレクトロンの補助PERを基準にし、ディスコやSCREENのPER/PBRが成長率・受注・決算後反応で説明できるかを見る。'],
  [generatedAt, '未公表・未接続データ', '同条件比較に入れない。代替値は表示しても購入候補スコアに混ぜない。']
];

writeCsv('704_external_peer_metric_completion_summary.csv', summaryRows);
writeCsv('705_external_peer_metric_completion_detail.csv', detailRows);
writeCsv('706_external_peer_metric_completion_rules.csv', ruleRows);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>外部同業 数値補完結果 2026年5月27日</title>
  <style>
    :root { --ink:#071f3a; --muted:#4c6178; --line:#d7e4f2; --soft:#f5f9fd; --blue:#0b5f96; --green:#087f5b; --red:#b42318; --amber:#ad5a00; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",sans-serif; color:var(--ink); background:#eef4fa; line-height:1.75; }
    main { max-width:1180px; margin:0 auto; padding:28px 18px 56px; }
    .hero { background:#123d63; color:white; border-radius:8px; padding:28px; margin-bottom:18px; }
    h1 { margin:0 0 8px; font-size:30px; }
    h2 { margin:24px 0 12px; padding-left:12px; border-left:8px solid var(--blue); font-size:23px; }
    .note { color:#e8f4ff; }
    .grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin:16px 0; }
    .card { background:white; border:1px solid var(--line); border-radius:8px; padding:16px; }
    .label { color:var(--muted); font-size:13px; }
    .value { font-size:24px; font-weight:800; margin-top:4px; }
    .ok { color:var(--green); font-weight:800; }
    .warn { color:var(--amber); font-weight:800; }
    .bad { color:var(--red); font-weight:800; }
    table { width:100%; border-collapse:collapse; background:white; border:1px solid var(--line); table-layout:fixed; }
    th, td { border:1px solid var(--line); padding:10px; vertical-align:top; overflow-wrap:anywhere; word-break:break-word; font-size:13px; }
    th { background:#e6f1fb; text-align:left; }
    .wide th:nth-child(1), .wide td:nth-child(1) { width:15%; }
    .wide th:nth-child(2), .wide td:nth-child(2) { width:12%; }
    .wide th:nth-child(10), .wide td:nth-child(10) { width:11%; }
    .formula { background:#fff; border:1px solid var(--line); border-radius:8px; padding:16px; }
    .formula code { display:block; background:#f4f7fb; border:1px solid var(--line); border-radius:6px; padding:10px; white-space:normal; overflow-wrap:anywhere; color:#111; }
    .footer { margin-top:24px; color:var(--muted); font-size:13px; }
    a { color:#064f88; font-weight:700; }
    @media (max-width:800px) { .grid { grid-template-columns:1fr; } h1 { font-size:24px; } table { table-layout:auto; } }
  </style>
</head>
<body>
<main>
  <section class="hero">
    <h1>外部同業 数値補完結果</h1>
    <div class="note">作成: ${generatedAt} / 目的: 候補10社だけでは弱い同業比較を補い、割高・割安の説明力を上げる。</div>
  </section>

  <section class="grid">
    <div class="card"><div class="label">食品同業で計算できた銘柄</div><div class="value">2/3</div><div>キッコーマン、キリンHD</div></div>
    <div class="card"><div class="label">アサヒGHD</div><div class="value warn">除外</div><div>通期決算の正式発表待ち</div></div>
    <div class="card"><div class="label">東京エレクトロンPER</div><div class="value ok">${round(tel.per)}倍</div><div>公式EPSと株価で補助計算</div></div>
    <div class="card"><div class="label">スコア反映</div><div class="value warn">直接加点なし</div><div>説明補助・警戒条件に使用</div></div>
  </section>

  <h2>1. 結論</h2>
  <table>
    <thead><tr><th>項目</th><th>結果</th><th>判断への意味</th></tr></thead>
    <tbody>
      ${summaryRows.slice(1).map(row => `<tr><td>${row[1]}</td><td>${row[2]}</td><td>${row[3]}</td></tr>`).join('')}
    </tbody>
  </table>

  <h2>2. 補完した数値</h2>
  <table class="wide">
    <thead><tr>${detailRows[0].map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>
      ${detailRows.slice(1).map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}
    </tbody>
  </table>

  <h2>3. 算出式と運用ルール</h2>
  <div class="formula">
    <code>補助PER = 株価 ÷ 1株当たり利益(EPS)</code>
    <code>補助PBR = 株価 ÷ 1株当たり純資産(BPS)</code>
    <code>同業比較は購入候補スコアへ直接加点しない。割高警戒、説明補助、除外条件、追加確認条件として使う。</code>
  </div>

  <h2>4. 次の反映</h2>
  <table>
    <thead><tr><th>対象</th><th>反映内容</th><th>次アクション</th></tr></thead>
    <tbody>
      <tr><td>味の素</td><td>食品同業よりPER/PBRが高いことを明示。食品安定枠ではなく、高PER成長枠として扱う。</td><td>ABF、ヘルスケア、利益成長、決算後反応で説明できるか確認。</td></tr>
      <tr><td>ディスコ / SCREEN</td><td>東京エレクトロンの補助PERを最大手基準として追加。</td><td>半導体製造装置内での相対割高と決算後反応を再確認。</td></tr>
      <tr><td>アサヒGHD</td><td>同条件比較に入れない。</td><td>正式な通期決算が出た後に再取得。</td></tr>
    </tbody>
  </table>

  <div class="footer">
    CSV: <a href="704_external_peer_metric_completion_summary.csv">要約</a> /
    <a href="705_external_peer_metric_completion_detail.csv">明細</a> /
    <a href="706_external_peer_metric_completion_rules.csv">ルール</a>
  </div>
</main>
</body>
</html>
`;

fs.writeFileSync('external_peer_metric_completion_20260527.html', html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  output: 'external_peer_metric_completion_20260527.html',
  rows: detail.length
}, null, 2));
