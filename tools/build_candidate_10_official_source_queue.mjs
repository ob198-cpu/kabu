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

const rows = [
  ['6762.T', 'TDK', '公式IR 決算資料', 'https://www.tdk.com/en/ir/ir_library/financial/index.html', '売上、営業利益、純利益、EPS、通期予想、決算説明資料', 'IN-01のイベント実績、必要に応じて財務補足'],
  ['2802.T', '味の素', '公式IR 決算短信', 'https://www.ajinomoto.co.jp/company/jp/ir/library/result.html', '売上、事業利益、EPS、通期予想、セグメント情報', 'IN-02からIN-05の同業比較、PBR/ROE、決算後反応'],
  ['8766.T', '東京海上HD', '公式IR 決算IR電話会議', 'https://www.tokiomarinehd.com/ir/event/presentation/', '決算短信、説明資料、自然災害影響、修正純利益、株主還元', 'IN-06、IN-07の決算後反応とイベント実績'],
  ['8316.T', '三井住友FG', '公式IR 決算関連情報', 'https://www.smfg.co.jp/investor/financial/', '決算短信、説明資料、純利益、ROE、自己資本比率、金利感応度', 'IN-08、IN-09の決算後反応と金利イベント実績'],
  ['8306.T', '三菱UFJ FG', '公式IR 最新IR資料', 'https://www.mufg.jp/ir/index.html', '決算短信、決算ハイライト、データブック、ROE、PBR関連資料', 'IN-10からIN-13の財務、同業比較、PBR/ROE'],
  ['6367.T', 'ダイキン工業', '公式IR 決算情報', 'https://www.daikin.co.jp/investor/library/results_materials', '決算短信、説明資料、売上、営業利益、地域別、空調需要', 'IN-14、IN-15の決算後反応とイベント実績'],
  ['6503.T', '三菱電機', '公式IR 決算関連', 'https://www.mitsubishielectric.co.jp/investors/data/financial-result/', '決算短信、説明資料、FA/半導体関連、受注、営業利益率', 'IN-16、IN-17の決算後反応とイベント実績'],
  ['5020.T', 'ENEOS HD', '公式IR 決算短信・説明資料', 'https://www.hd.eneos.co.jp/ir/library/', '決算短信、説明資料、原油・ナフサ影響、在庫影響、セグメント利益', 'IN-18からIN-22の同業比較、PBR/ROE、反応、イベント実績'],
  ['6146.T', 'ディスコ', '公式IR 決算短信・四半期開示', 'https://www.disco.co.jp/jp/ir/library/fr.html', '決算短信、個別売上速報、出荷額、受注、利益率、通期見通し', 'IN-23からIN-27の財務、同業比較、PBR/ROE、イベント実績'],
  ['4385.T', 'メルカリ', '公式IR 決算情報', 'https://about.mercari.com/ir/library/results/', '決算短信、説明資料、流通総額、売上収益、営業利益、Fintech関連指標', 'IN-28からIN-33の財務、同業比較、PBR/ROE、反応、イベント実績'],
].map((item, index) => ({
  updated_at: generatedAt,
  source_id: `SRC-${String(index + 1).padStart(2, '0')}`,
  ticker: item[0],
  company: item[1],
  source_type: item[2],
  url: item[3],
  fields_to_collect: item[4],
  connected_input_ids: item[5],
  priority: index < 10 ? '最優先' : '通常',
  status: '取得先確認済み。数値入力は未実施',
  score_policy: '出典URL、基準日、数値がそろうまで採点へ接続しない',
}));

const commonRows = [
  {
    updated_at: generatedAt,
    source_id: 'COMMON-01',
    source_type: 'EDINET',
    url: 'https://disclosure2.edinet-fsa.go.jp/',
    purpose: '有価証券報告書でセグメント、リスク、海外売上比率、財務注記を補う',
    limitation: '書類IDやXBRL抽出の実装が必要。すぐ点数へ入れず、公式補完資料として扱う',
  },
  {
    updated_at: generatedAt,
    source_id: 'COMMON-02',
    source_type: 'J-Quants',
    url: 'https://jpx-jquants.com/',
    purpose: 'PER/PBR/ROEなどの統一取得候補',
    limitation: '認証が必要。認証未設定では自動取得に接続しない',
  },
  {
    updated_at: generatedAt,
    source_id: 'COMMON-03',
    source_type: '株価OHLCV',
    url: 'https://query1.finance.yahoo.com/',
    purpose: '決算後1日、5日、20日の超過リターン計算',
    limitation: 'アクセス制限があるため、取得失敗時は再試行または別経路を使う',
  },
  {
    updated_at: generatedAt,
    source_id: 'COMMON-04',
    source_type: 'ベンチマーク',
    url: '日経平均、TOPIX、S&P500相当指数',
    purpose: '+1%目標の比較基準と決算後反応の超過リターン計算',
    limitation: '比較対象と期間を固定し、都合のよい基準に後から変えない',
  },
];

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '公式IR取得先',
    value: `${rows.length}社分`,
    interpretation: '候補10社それぞれについて、まず確認する公式資料ページを固定した。',
  },
  {
    updated_at: generatedAt,
    item: '共通取得元',
    value: `${commonRows.length}系統`,
    interpretation: 'EDINET、J-Quants、株価OHLCV、ベンチマークを補助ルートとして分けた。',
  },
  {
    updated_at: generatedAt,
    item: '採点接続',
    value: '未接続',
    interpretation: '取得先の確認と、数値の入力・検算は別工程として扱う。',
  },
  {
    updated_at: generatedAt,
    item: '購入判断',
    value: '0社',
    interpretation: 'この資料はデータ取得の段取りであり、購入判断ではない。',
  },
];

writeCsv('481_candidate_10_official_source_queue.csv', rows, [
  'updated_at',
  'source_id',
  'ticker',
  'company',
  'source_type',
  'url',
  'fields_to_collect',
  'connected_input_ids',
  'priority',
  'status',
  'score_policy',
]);
writeCsv('482_candidate_10_common_source_rules.csv', commonRows, [
  'updated_at',
  'source_id',
  'source_type',
  'url',
  'purpose',
  'limitation',
]);
writeCsv('483_candidate_10_official_source_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'interpretation',
]);

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 公式データ取得キュー</title>
  <style>
    :root {
      --ink: #061a33;
      --muted: #52677f;
      --line: #c8d9ea;
      --soft: #eef6ff;
      --blue: #0b66a0;
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
      background: linear-gradient(135deg, #052c50, #0b668d);
      color: #fff;
      padding: 34px clamp(18px, 4vw, 58px);
    }
    h1 { margin: 0 0 8px; font-size: clamp(26px, 4vw, 42px); letter-spacing: 0; }
    header p { margin: 0; color: #eaf5ff; font-weight: 800; max-width: 980px; }
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
      padding-left: 12px;
      border-left: 8px solid var(--blue);
      font-size: 24px;
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
      min-height: 110px;
    }
    .metric strong { display: block; font-size: 26px; color: var(--blue); }
    .notice {
      border-left: 8px solid var(--amber);
      background: #fff7ed;
      padding: 14px;
      border-radius: 8px;
      font-weight: 900;
    }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 8px; }
    table { width: 100%; border-collapse: collapse; min-width: 980px; }
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
    a { color: var(--blue); font-weight: 800; }
    @media (max-width: 860px) {
      .summary { grid-template-columns: 1fr; }
      main { width: min(100% - 20px, 1180px); }
      section { padding: 16px; }
    }
    @media print {
      body { background: #fff; }
      section { break-inside: avoid; }
      .table-wrap { overflow: visible; }
      table { min-width: 0; font-size: 11px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>候補10社 公式データ取得キュー</h1>
    <p>明日、候補10社を根拠付きで絞るために、まず確認する公式IRページと取得する数値を固定した一覧です。</p>
  </header>
  <main>
    <section>
      <h2>位置づけ</h2>
      <div class="summary">
        <div class="metric"><span>公式IR取得先</span><strong>${rows.length}社</strong><small>候補10社すべて</small></div>
        <div class="metric"><span>共通取得元</span><strong>${commonRows.length}系統</strong><small>EDINET等の補助ルート</small></div>
        <div class="metric"><span>採点接続</span><strong>未接続</strong><small>数値入力後に検算</small></div>
        <div class="metric"><span>購入判断</span><strong>0社</strong><small>6月イベント後に別判定</small></div>
      </div>
      <p class="notice">取得先を確認しただけでは点数に入れません。実際の数値、基準日、出典URL、予想/実績区分がそろった行だけをCSV入力・検証画面で検算します。</p>
    </section>

    <section>
      <h2>10社ごとの公式取得先</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>銘柄</th><th>取得先</th><th>取得する主な数値</th><th>接続する入力作業</th><th>状態</th></tr></thead>
          <tbody>
            ${rows.map((row) => `
            <tr>
              <td>${esc(row.source_id)}</td>
              <td>${esc(row.ticker)} ${esc(row.company)}</td>
              <td><a href="${esc(row.url)}" target="_blank" rel="noopener">${esc(row.source_type)}</a></td>
              <td>${esc(row.fields_to_collect)}</td>
              <td>${esc(row.connected_input_ids)}</td>
              <td>${esc(row.status)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>

    <section>
      <h2>共通取得元</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>ID</th><th>取得元</th><th>用途</th><th>注意点</th></tr></thead>
          <tbody>
            ${commonRows.map((row) => `
            <tr>
              <td>${esc(row.source_id)}</td>
              <td><a href="${esc(row.url)}" target="_blank" rel="noopener">${esc(row.source_type)}</a></td>
              <td>${esc(row.purpose)}</td>
              <td>${esc(row.limitation)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_official_source_queue_20260526.html'), html, 'utf8');

console.log(`created candidate_10_official_source_queue_20260526.html, rows=${rows.length}`);
