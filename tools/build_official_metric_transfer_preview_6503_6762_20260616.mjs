import fs from 'node:fs';

const outCsv = 'official_metric_transfer_preview_6503_6762_20260616.csv';
const outHtml = 'official_metric_transfer_preview_6503_6762_20260616.html';
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
    input_id: 'HQ-01-6503.T-PER',
    ticker: '6503.T',
    name: '三菱電機',
    item: 'PER',
    value: '予想PER 25.36倍 / 実績PER 29.54倍',
    unit: '倍',
    period: '株価基準 2026-06-15 15:30 JST / EPS 2026年3月期・2027年3月期予想',
    source: '2026年3月期 決算短信〔IFRS〕（連結）一部訂正版 / PER・PBR計算ログ',
    source_date: '2026-06-11 / 株価 2026-06-15',
    url: 'https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co1.pdf',
    source_line: 'PDF p1 L63-L78, L115-L122 / p1_per_pbr_calculation_apply_audit_20260615.csv',
    formula: '予想PER=5,858÷231.01=25.36 / 実績PER=5,858÷198.31=29.54',
    status: '転記候補',
    reflection: '検算後に財務入力へ反映候補',
    destination: 'P1財務入力',
    note: '公式PERそのものではなく、公式EPSと同一基準日の株価から計算した値。',
  },
  {
    input_id: 'HQ-02-6503.T-PBR',
    ticker: '6503.T',
    name: '三菱電機',
    item: 'PBR',
    value: 'PBR 2.67倍',
    unit: '倍',
    period: '株価基準 2026-06-15 15:30 JST / BPS 2026年3月期末',
    source: '2026年3月期 決算短信〔IFRS〕（連結）一部訂正版 / PER・PBR計算ログ',
    source_date: '2026-06-11 / 株価 2026-06-15',
    url: 'https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co1.pdf',
    source_line: 'PDF p1 L80-L90 / p1_per_pbr_calculation_apply_audit_20260615.csv',
    formula: 'PBR=5,858÷2,191.26=2.67',
    status: '転記候補',
    reflection: '検算後に財務入力へ反映候補',
    destination: 'P1財務入力',
    note: '公式BPSと同一基準日の株価から計算した値。',
  },
  {
    input_id: 'HQ-03-6503.T-ROE',
    ticker: '6503.T',
    name: '三菱電機',
    item: 'ROE',
    value: '9.7',
    unit: '%',
    period: '2026年3月期',
    source: '2026年3月期 決算短信〔IFRS〕（連結）一部訂正版',
    source_date: '2026-06-11 / 原決算発表 2026-04-28',
    url: 'https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co1.pdf',
    source_line: 'PDF p1 L69-L78',
    formula: '会社公表値を使用',
    status: '転記候補',
    reflection: '検算後に財務入力へ反映候補',
    destination: 'P1財務入力',
    note: '収益性確認に使用できる候補値。',
  },
  {
    input_id: 'HQ-04-6503.T-MARGIN',
    ticker: '6503.T',
    name: '三菱電機',
    item: '営業利益率',
    value: '7.3',
    unit: '%',
    period: '2026年3月期',
    source: '2026年3月期 決算短信〔IFRS〕（連結）一部訂正版',
    source_date: '2026-06-11 / 原決算発表 2026-04-28',
    url: 'https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co1.pdf',
    source_line: 'PDF p1 L69-L78',
    formula: '会社公表値を使用',
    status: '転記候補',
    reflection: '検算後に財務入力へ反映候補',
    destination: 'P1財務入力',
    note: '利益率確認に使用できる候補値。',
  },
  {
    input_id: 'HQ-05-6503.T-FORECAST',
    ticker: '6503.T',
    name: '三菱電機',
    item: '今期会社予想',
    value: '売上高予想 6,200,000百万円（+5.2%） / EPS予想 231.01円',
    unit: '百万円・円',
    period: '2027年3月期予想',
    source: '2026年3月期 決算短信〔IFRS〕（連結）一部訂正版',
    source_date: '2026-06-11 / 原決算発表 2026-04-28',
    url: 'https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co1.pdf',
    source_line: 'PDF p1 L115-L122',
    formula: '会社予想値を使用',
    status: '転記候補',
    reflection: '検算後に財務入力へ反映候補',
    destination: 'P1財務入力',
    note: '1年保有の先行き確認に使う候補値。',
  },
  {
    input_id: 'HQ-06-6503.T-YOY',
    ticker: '6503.T',
    name: '三菱電機',
    item: '前期比増減',
    value: '売上 +6.8% / 営業利益 +10.5% / 親会社株主帰属当期純利益 +25.8%',
    unit: '%',
    period: '2026年3月期',
    source: '2026年3月期 決算短信〔IFRS〕（連結）一部訂正版',
    source_date: '2026-06-11 / 原決算発表 2026-04-28',
    url: 'https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co1.pdf',
    source_line: 'PDF p1 L55-L62',
    formula: '会社公表の前期比を使用',
    status: '転記候補',
    reflection: '検算後に財務入力へ反映候補',
    destination: 'P1財務入力',
    note: '成長確認に使う候補値。',
  },
  {
    input_id: 'HQ-07-6503.T-SEGMENT',
    ticker: '6503.T',
    name: '三菱電機',
    item: '受注またはセグメント寄与',
    value: '未接続',
    unit: '',
    period: '',
    source: '未接続',
    source_date: '',
    url: 'https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co1.pdf',
    source_line: '未接続',
    formula: '未設定',
    status: '未接続',
    reflection: '反映禁止',
    destination: 'なし',
    note: 'FA・電力制御等の事業寄与を、全社売上・利益または受注に接続する資料がまだ必要。',
  },
  {
    input_id: 'HQ-08-6762.T-PER',
    ticker: '6762.T',
    name: 'TDK',
    item: 'PER',
    value: '未接続（公式EPS 103.09円 / 予想EPS 118.54円は確認済み）',
    unit: '',
    period: 'FY March 2026 / FY March 2027 forecast',
    source: 'Consolidated Financial Results for FY March 2026',
    source_date: '2026-04-28',
    url: 'https://www.tdk.com/system/files/2026042800_0mqf56xw_en.pdf',
    source_line: 'PDF p1 L65-L71, p2 L142-L154',
    formula: '同一基準日の株価が未接続のためPER計算は保留',
    status: '未接続',
    reflection: '反映禁止',
    destination: 'なし',
    note: '古いスクリーニング値は流用しない。同一基準日の株価を接続してから計算する。',
  },
  {
    input_id: 'HQ-09-6762.T-PBR',
    ticker: '6762.T',
    name: 'TDK',
    item: 'PBR',
    value: '未接続（公式BPS 1,152.30円は確認済み）',
    unit: '',
    period: 'FY March 2026 year-end',
    source: 'Consolidated Financial Results for FY March 2026',
    source_date: '2026-04-28',
    url: 'https://www.tdk.com/system/files/2026042800_0mqf56xw_en.pdf',
    source_line: 'PDF p2 L86-L99',
    formula: '同一基準日の株価が未接続のためPBR計算は保留',
    status: '未接続',
    reflection: '反映禁止',
    destination: 'なし',
    note: '古いスクリーニング値は流用しない。同一基準日の株価を接続してから計算する。',
  },
  {
    input_id: 'HQ-10-6762.T-ROE',
    ticker: '6762.T',
    name: 'TDK',
    item: 'ROE',
    value: '9.8',
    unit: '%',
    period: 'FY March 2026',
    source: 'Consolidated Financial Results for FY March 2026',
    source_date: '2026-04-28',
    url: 'https://www.tdk.com/system/files/2026042800_0mqf56xw_en.pdf',
    source_line: 'PDF p1 L72-L80',
    formula: '会社公表値を使用',
    status: '転記候補',
    reflection: '検算後に財務入力へ反映候補',
    destination: 'P1財務入力',
    note: '収益性確認に使用できる候補値。',
  },
  {
    input_id: 'HQ-11-6762.T-MARGIN',
    ticker: '6762.T',
    name: 'TDK',
    item: '営業利益率',
    value: '10.9',
    unit: '%',
    period: 'FY March 2026',
    source: 'Consolidated Financial Results for FY March 2026',
    source_date: '2026-04-28',
    url: 'https://www.tdk.com/system/files/2026042800_0mqf56xw_en.pdf',
    source_line: 'PDF p1 L72-L80',
    formula: '会社公表値を使用',
    status: '転記候補',
    reflection: '検算後に財務入力へ反映候補',
    destination: 'P1財務入力',
    note: '利益率確認に使用できる候補値。',
  },
  {
    input_id: 'HQ-12-6762.T-FORECAST',
    ticker: '6762.T',
    name: 'TDK',
    item: '今期会社予想',
    value: 'Net sales forecast 2,580,000 million yen（+3.0%） / EPS forecast 118.54 yen',
    unit: 'million yen・yen',
    period: 'FY March 2027 forecast',
    source: 'Consolidated Financial Results for FY March 2026',
    source_date: '2026-04-28',
    url: 'https://www.tdk.com/system/files/2026042800_0mqf56xw_en.pdf',
    source_line: 'PDF p2 L142-L154',
    formula: '会社予想値を使用',
    status: '転記候補',
    reflection: '検算後に財務入力へ反映候補',
    destination: 'P1財務入力',
    note: '1年保有の先行き確認に使う候補値。',
  },
  {
    input_id: 'HQ-13-6762.T-YOY',
    ticker: '6762.T',
    name: 'TDK',
    item: '前期比増減',
    value: 'Net sales +13.6% / Operating profit +21.5% / Net profit attributable to owners of parent +17.0%',
    unit: '%',
    period: 'FY March 2026',
    source: 'Consolidated Financial Results for FY March 2026',
    source_date: '2026-04-28',
    url: 'https://www.tdk.com/system/files/2026042800_0mqf56xw_en.pdf',
    source_line: 'PDF p1 L56-L71',
    formula: '会社公表の前期比を使用',
    status: '転記候補',
    reflection: '検算後に財務入力へ反映候補',
    destination: 'P1財務入力',
    note: '成長確認に使う候補値。',
  },
  {
    input_id: 'HQ-14-6762.T-SEGMENT',
    ticker: '6762.T',
    name: 'TDK',
    item: '受注またはセグメント寄与',
    value: 'Energy Application Products sales 1,370,304 million yen（+16.5%）',
    unit: 'million yen・%',
    period: 'FY March 2026',
    source: 'Consolidated Financial Results for FY March 2026',
    source_date: '2026-04-28',
    url: 'https://www.tdk.com/system/files/2026042800_0mqf56xw_en.pdf',
    source_line: 'PDF p7 L288-L296',
    formula: '製品別売上の会社公表値を使用',
    status: '転記候補',
    reflection: '検算後にテーマ寄与確認へ反映候補',
    destination: 'P1財務入力・質的テーマ接続',
    note: '電池・電子部品テーマが全社売上のどこに出ているかを見る候補値。',
  },
  {
    input_id: 'HQ-15-THEME-SEMICONDUCTOR',
    ticker: '複数',
    name: '半導体製造装置・材料',
    item: '仮説・実績・反証',
    value: '未接続',
    unit: '',
    period: '',
    source: 'theme_event_validation_ledger_20260614.html',
    source_date: '2026-06-14',
    url: 'theme_event_validation_ledger_20260614.html',
    source_line: '既存検証台帳',
    formula: 'イベント仮説、過去反応、会社業績寄与の結合が未完了',
    status: '未接続',
    reflection: '反映禁止',
    destination: 'なし',
    note: '質的テーマは単純加点しない。実績反応と財務寄与がそろうまで購入スコアに混ぜない。',
  },
  {
    input_id: 'HQ-16-THEME-AI-INFRA',
    ticker: '複数',
    name: 'AIインフラ・データセンター',
    item: '仮説・実績・反証',
    value: '未接続',
    unit: '',
    period: '',
    source: 'theme_event_validation_ledger_20260614.html',
    source_date: '2026-06-14',
    url: 'theme_event_validation_ledger_20260614.html',
    source_line: '既存検証台帳',
    formula: 'イベント仮説、過去反応、会社業績寄与の結合が未完了',
    status: '未接続',
    reflection: '反映禁止',
    destination: 'なし',
    note: '需要増仮説だけでは反映しない。受注・売上・利益率または指数超過反応の確認が必要。',
  },
  {
    input_id: 'HQ-17-THEME-RATE-FINANCE',
    ticker: '複数',
    name: '金利・金融',
    item: '仮説・実績・反証',
    value: '未接続',
    unit: '',
    period: '',
    source: 'june_event_execution_flow_20260615.html',
    source_date: '2026-06-15',
    url: 'june_event_execution_flow_20260615.html',
    source_line: '既存イベント運用表',
    formula: '日銀・米金利・銀行株反応・信用コストの結合が未完了',
    status: '未接続',
    reflection: '反映禁止',
    destination: 'なし',
    note: '金利上昇だけで銀行株へ単純加点しない。利ざや改善と信用コスト悪化を分けて見る。',
  },
];

const headers = [
  '作成時刻',
  '入力ID',
  'ticker',
  '銘柄またはテーマ',
  '入力項目',
  '転記候補値',
  '単位',
  '対象期間',
  '根拠資料',
  '資料日付',
  'URL',
  '根拠行',
  '計算式',
  '状態',
  '反映可否',
  '反映先',
  '注意',
];

const csvRows = rows.map((row) => ({
  作成時刻: generatedAt,
  入力ID: row.input_id,
  ticker: row.ticker,
  銘柄またはテーマ: row.name,
  入力項目: row.item,
  転記候補値: row.value,
  単位: row.unit,
  対象期間: row.period,
  根拠資料: row.source,
  資料日付: row.source_date,
  URL: row.url,
  根拠行: row.source_line,
  計算式: row.formula,
  状態: row.status,
  反映可否: row.reflection,
  反映先: row.destination,
  注意: row.note,
}));

writeCsv(outCsv, headers, csvRows);

const candidateCount = rows.filter((row) => row.status === '転記候補').length;
const blockedCount = rows.length - candidateCount;
const financeRows = rows.filter((row) => row.input_id.includes('6503') || row.input_id.includes('6762'));
const financeCandidate = financeRows.filter((row) => row.status === '転記候補').length;
const themeRows = rows.filter((row) => row.input_id.includes('THEME'));
const themeCandidate = themeRows.filter((row) => row.status === '転記候補').length;

function table(sectionRows) {
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>入力ID</th>
            <th>対象</th>
            <th>項目</th>
            <th>転記候補値</th>
            <th>状態</th>
            <th>反映可否</th>
            <th>根拠・計算式</th>
            <th>注意</th>
          </tr>
        </thead>
        <tbody>
          ${sectionRows.map((row) => `
            <tr>
              <td>${h(row.input_id)}</td>
              <td><b>${h(row.ticker)}</b><br>${h(row.name)}</td>
              <td>${h(row.item)}</td>
              <td><b>${h(row.value)}</b><br><span>${h(row.period)}</span></td>
              <td class="${row.status === '転記候補' ? 'ok' : 'bad'}">${h(row.status)}</td>
              <td class="${row.reflection === '反映禁止' ? 'bad' : 'ok'}">${h(row.reflection)}</td>
              <td>${h(row.source_line)}<br>${h(row.formula)}<br><a href="${h(row.url)}">${h(row.source)}</a></td>
              <td>${h(row.note)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>公式数値 転記プレビュー 6503・6762</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--red:#b42318;--green:#116b4f;--amber:#9a5b00}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.75}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:34px}
    header h1{margin:0 0 10px;font-size:clamp(34px,4vw,50px);line-height:1.18;letter-spacing:0}
    header p{margin:0;font-size:20px;font-weight:900;max-width:1220px}
    main{max-width:1440px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:20px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:28px}
    p{margin:0 0 10px}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:16px}
    .card strong{display:block;font-size:34px;line-height:1.25;color:var(--blue)}
    .card span{display:block;font-weight:900;color:#263e55}
    .notice{border:2px solid var(--red);background:#fff1f1;color:#8a0000;border-radius:10px;padding:14px 16px;font-weight:900;margin:0}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:9px 10px;vertical-align:top;overflow-wrap:anywhere}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    td span{color:#354b5f;font-weight:800}
    .bad{color:var(--red)!important;font-weight:900}
    .ok{color:var(--green)!important;font-weight:900}
    .links{display:flex;gap:12px;flex-wrap:wrap}
    .links a{display:inline-block;border:1px solid var(--line);border-radius:10px;background:#fbfdff;color:#004f86;text-decoration:none;font-weight:900;padding:10px 14px}
    a{color:#004f86;font-weight:900}
    footer{font-size:13px;color:#526b82;margin:20px 0}
    @media(max-width:980px){main{padding:12px}.cards{grid-template-columns:1fr}body{font-size:17px}}
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:10px;padding:5px}}
  </style>
</head>
<body>
<header>
  <h1>公式数値 転記プレビュー 6503・6762</h1>
  <p>公式資料から抜いた数値を、どこまで入力候補へ移せるか確認する画面です。まだ購入判断へ直結させず、転記候補と反映禁止を分けます。</p>
</header>
<main>
  <section>
    <h2>現在の判定</h2>
    <div class="cards">
      <div class="card"><b>高優先項目</b><strong>${rows.length}件</strong><span>財務14件・質的テーマ3件</span></div>
      <div class="card"><b>転記候補</b><strong>${candidateCount}件</strong><span>公式値または計算根拠がつながった項目</span></div>
      <div class="card"><b>反映禁止</b><strong>${blockedCount}件</strong><span>未接続を点数に混ぜない</span></div>
      <div class="card"><b>購入判断</b><strong class="bad">不可</strong><span>反映後も6月イベント・口座確認が必要</span></div>
    </div>
  </section>

  <section>
    <p class="notice">このページは「転記前の確認」です。転記候補であっても、ランキング・買付比率・注文票へ自動反映しません。未接続項目は反映禁止として止めます。</p>
  </section>

  <section>
    <h2>内訳</h2>
    <div class="cards">
      <div class="card"><b>財務項目</b><strong>${financeCandidate}/${financeRows.length}</strong><span>6503はPER/PBRまで候補化、6762はPER/PBRが未接続</span></div>
      <div class="card"><b>質的テーマ</b><strong>${themeCandidate}/${themeRows.length}</strong><span>仮説・実績・反証の結合が未完了</span></div>
      <div class="card"><b>P1復帰</b><strong>0社</strong><span>このページだけでは復帰しない</span></div>
      <div class="card"><b>買付上限</b><strong>0円</strong><span>イベント・口座・最終ゲート前</span></div>
    </div>
  </section>

  <section>
    <h2>転記候補</h2>
    ${table(rows.filter((row) => row.status === '転記候補'))}
  </section>

  <section>
    <h2>反映禁止・未接続</h2>
    ${table(rows.filter((row) => row.status !== '転記候補'))}
  </section>

  <section>
    <h2>関連ページ</h2>
    <div class="links">
      <a href="financial_qualitative_high_priority_workbench_20260616.html">高優先ワークベンチ</a>
      <a href="financial_qualitative_high_priority_source_map_20260616.html">公式確認先マップ</a>
      <a href="official_metric_candidates_6503_6762_20260616.html">公式数値候補</a>
      <a href="financial_qualitative_reflection_validator_20260616.html">反映判定ゲート</a>
      <a href="${outCsv}">CSVを開く</a>
      <a href="index.html">ホームへ戻る</a>
    </div>
  </section>

  <footer>更新: ${generatedAt} / 本画面は投資助言・自動売買ではありません。実売買前には公式決算、証券会社画面、本人操作、NISA口座区分を確認します。</footer>
</main>
</body>
</html>`;

fs.writeFileSync(outHtml, html, 'utf8');
console.log(`wrote ${outCsv} and ${outHtml}`);
