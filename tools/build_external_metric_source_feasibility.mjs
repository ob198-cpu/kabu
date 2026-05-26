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

const sourceRows = [
  {
    updated_at: generatedAt,
    source: 'J-Quants',
    data: '株価、上場銘柄情報、財務系データ',
    reliability: '高',
    current_result: '認証なしでは403',
    requirement: 'APIアカウント、IDトークン、取得項目の契約範囲確認',
    use_policy: 'キー取得後は第一候補。スコア接続可',
  },
  {
    updated_at: generatedAt,
    source: 'EDINET XBRL',
    data: '有価証券報告書の実績EPS、純資産、利益、ROE計算材料',
    reliability: '高',
    current_result: 'コード・文書ID取得ルートは既に開始済み',
    requirement: 'XBRLタグ対応、年度差、実績値と予想値の分離',
    use_policy: '実績指標の補完に使用。予想PERは会社予想または別ソースが必要',
  },
  {
    updated_at: generatedAt,
    source: '会社IR/決算短信',
    data: '会社予想、EPS、配当、セグメント説明',
    reliability: '高',
    current_result: 'PDF/HTML取得は可能だが会社別の表構造差がある',
    requirement: '銘柄別テンプレート、PDF表抽出または手入力欄',
    use_policy: '公式値として採用可。ただし抽出ログを残す',
  },
  {
    updated_at: generatedAt,
    source: 'TDnet',
    data: '決算短信、上方修正、下方修正、自社株買い',
    reliability: '高',
    current_result: 'ページ取得は可能。長期安定抽出は未完成',
    requirement: '開示分類、PDF/HTML/XBRL取得、イベント履歴DB',
    use_policy: 'イベント実績層に使用。指標値は抽出確認後に限定',
  },
  {
    updated_at: generatedAt,
    source: 'Yahoo Finance quote API',
    data: 'PER/PBR等の参考値が取れる可能性',
    reliability: '中',
    current_result: '現在の確認では429 Too Many Requests',
    requirement: 'レート制限回避不可。一次ソースにはしない',
    use_policy: '参考値まで。公式/準公式確認なしにスコア接続しない',
  },
];

const tickerRows = [
  {
    updated_at: generatedAt,
    ticker: '8306.T',
    company: '三菱UFJ FG',
    missing_metric: 'PER',
    preferred_route: 'J-Quantsまたは会社IR EPS + 株価',
    fallback_route: 'EDINET実績EPS + 株価は実績PERとして別列管理',
    current_status: '外部取得待ち',
    score_policy: '未接続',
  },
  {
    updated_at: generatedAt,
    ticker: '6146.T',
    company: 'ディスコ',
    missing_metric: 'PER',
    preferred_route: 'J-Quantsまたは会社IR EPS + 株価',
    fallback_route: 'EDINET実績EPS + 株価は実績PERとして別列管理',
    current_status: '外部取得待ち',
    score_policy: '未接続',
  },
  {
    updated_at: generatedAt,
    ticker: '4385.T',
    company: 'メルカリ',
    missing_metric: 'PER',
    preferred_route: 'J-Quantsまたは会社IR EPS + 株価',
    fallback_route: 'EDINET実績EPS + 株価は実績PERとして別列管理',
    current_status: '外部取得待ち',
    score_policy: '未接続',
  },
  {
    updated_at: generatedAt,
    ticker: '2802.T',
    company: '味の素',
    missing_metric: '同業中央値',
    preferred_route: '同業2社以上のJ-Quantsまたは会社IR指標',
    fallback_route: '既存CSVの同業候補を再点検し、不足銘柄のみ追加',
    current_status: '外部取得待ち',
    score_policy: '未接続',
  },
  {
    updated_at: generatedAt,
    ticker: '5020.T',
    company: 'ENEOS HD',
    missing_metric: '同業中央値',
    preferred_route: '同業2社以上のJ-Quantsまたは会社IR指標',
    fallback_route: '既存CSVの同業候補を再点検し、不足銘柄のみ追加',
    current_status: '外部取得待ち',
    score_policy: '未接続',
  },
  {
    updated_at: generatedAt,
    ticker: '4385.T',
    company: 'メルカリ',
    missing_metric: '同業中央値',
    preferred_route: '同業2社以上のJ-Quantsまたは会社IR指標',
    fallback_route: 'ネット/EC同業の比較対象を再固定',
    current_status: '外部取得待ち',
    score_policy: '未接続',
  },
];

const requirementRows = [
  {
    updated_at: generatedAt,
    item: 'APIキー',
    needed_for: 'J-Quants自動取得',
    must_have: 'はい',
    effect_if_missing: '公式・準公式の自動PER/PBR/ROE取得が止まる',
  },
  {
    updated_at: generatedAt,
    item: '銘柄別IR抽出テンプレート',
    needed_for: '会社IR/決算短信からEPS・予想を抽出',
    must_have: 'はい',
    effect_if_missing: 'PDFの表構造差により完全自動化が不安定になる',
  },
  {
    updated_at: generatedAt,
    item: '実績PERと予想PERの別列',
    needed_for: '基準混在防止',
    must_have: 'はい',
    effect_if_missing: '成長株や赤字転換銘柄の評価が歪む',
  },
  {
    updated_at: generatedAt,
    item: '出典URLと基準日',
    needed_for: '後日検算・顧客説明',
    must_have: 'はい',
    effect_if_missing: '値の再現性がなくなり、計算したふりに見える',
  },
];

const nextTaskRows = [
  {
    updated_at: generatedAt,
    priority: '1',
    task: 'J-Quants接続可否を決める',
    action: 'APIキーが使えるなら自動取得、使えないなら会社IR/EDINETルートへ切替',
    output: 'データ取得方法の確定',
  },
  {
    updated_at: generatedAt,
    priority: '2',
    task: 'PER計算列を分離する',
    action: 'forecast_per、actual_per、per_source、per_dateを別列化',
    output: '基準混在しない入力表',
  },
  {
    updated_at: generatedAt,
    priority: '3',
    task: '会社IR/EDINETから3銘柄のEPSを補完',
    action: '8306、6146、4385のEPS/利益/株式数または1株利益を取得',
    output: 'PER計算候補',
  },
  {
    updated_at: generatedAt,
    priority: '4',
    task: '同業中央値を再計算',
    action: '2802、5020、4385の同業2社以上を同じ基準で補完',
    output: '業種補正の再接続可否',
  },
];

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '自動取得の第一候補',
    value: 'J-Quants',
    interpretation: '信頼性は高いが認証が必要。',
  },
  {
    updated_at: generatedAt,
    item: '公式補完の現実ルート',
    value: '会社IR/EDINET',
    interpretation: '実績値は可能性が高い。予想PERは会社予想EPSの抽出が必要。',
  },
  {
    updated_at: generatedAt,
    item: '参考API',
    value: 'Yahooは429',
    interpretation: '現在は安定取得に使えない。一次ソース扱いにしない。',
  },
  {
    updated_at: generatedAt,
    item: 'スコア接続',
    value: '0件',
    interpretation: '外部値の出典確認前なので、購入候補スコアには戻していない。',
  },
];

writeCsv('460_external_metric_source_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'interpretation',
]);

writeCsv('461_per_source_feasibility.csv', sourceRows, [
  'updated_at',
  'source',
  'data',
  'reliability',
  'current_result',
  'requirement',
  'use_policy',
]);

writeCsv('462_ticker_metric_fetch_route.csv', tickerRows, [
  'updated_at',
  'ticker',
  'company',
  'missing_metric',
  'preferred_route',
  'fallback_route',
  'current_status',
  'score_policy',
]);

writeCsv('463_source_requirements.csv', requirementRows, [
  'updated_at',
  'item',
  'needed_for',
  'must_have',
  'effect_if_missing',
]);

writeCsv('464_next_connector_tasks.csv', nextTaskRows, [
  'updated_at',
  'priority',
  'task',
  'action',
  'output',
]);

function table(headers, rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map((header) => `<th>${esc(header.label)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>${headers.map((header) => `<td>${esc(row[header.key])}</td>`).join('')}</tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>外部指標取得ルート 現実性判定</title>
  <style>
    :root {
      --ink: #111827;
      --muted: #4b5563;
      --line: #cfdced;
      --bg: #f5f8fc;
      --panel: #ffffff;
      --navy: #113a5c;
      --blue: #176da3;
      --yellow: #fff7d6;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Yu Gothic", "Meiryo", Arial, sans-serif;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.75;
      letter-spacing: 0;
    }
    main { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 56px; }
    .hero {
      background: var(--navy);
      color: white;
      border-radius: 18px;
      padding: 26px;
      margin-bottom: 18px;
    }
    h1 { font-size: clamp(26px, 4vw, 42px); line-height: 1.2; margin: 0 0 10px; letter-spacing: 0; }
    h2 { font-size: 24px; color: var(--navy); margin: 0 0 10px; letter-spacing: 0; }
    p { margin: 0 0 12px; }
    .hero p { color: #e8f4ff; }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 18px;
      margin-bottom: 16px;
      box-shadow: 0 8px 20px rgba(20, 57, 91, .06);
    }
    .notice {
      border: 2px solid #f0c36c;
      background: var(--yellow);
      border-radius: 14px;
      padding: 14px 16px;
      font-weight: 800;
      color: #5f3900;
      margin-bottom: 16px;
    }
    .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 16px; }
    .kpi { background: white; color: var(--ink); border: 1px solid #c9def3; border-radius: 12px; padding: 12px; }
    .kpi b { display: block; color: var(--blue); font-size: 26px; line-height: 1.15; }
    .kpi span { display: block; color: var(--muted); font-size: 12px; margin-top: 5px; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; }
    table { width: 100%; min-width: 980px; border-collapse: collapse; table-layout: fixed; background: white; }
    th, td {
      border-bottom: 1px solid var(--line);
      border-right: 1px solid var(--line);
      padding: 9px 10px;
      vertical-align: top;
      text-align: left;
      overflow-wrap: anywhere;
      word-break: break-word;
      color: var(--ink);
    }
    th { background: #e8f4ff; color: #073b63; font-weight: 800; }
    tr:last-child td { border-bottom: 0; }
    th:last-child, td:last-child { border-right: 0; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      padding: 8px 12px;
      border-radius: 10px;
      border: 1px solid #9dc7e8;
      background: #fff;
      color: var(--navy);
      text-decoration: none;
      font-weight: 800;
    }
    @media (max-width: 900px) {
      main { width: min(100% - 20px, 1180px); padding-top: 16px; }
      .kpis { grid-template-columns: 1fr 1fr; }
      table { min-width: 820px; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <h1>外部指標取得ルート 現実性判定</h1>
      <p>既存CSVに直接使えるPERがなかったため、外部から取得するルートを信頼性・必要条件・スコア接続可否で分けました。</p>
      <div class="actions">
        <a class="button" href="existing_metric_reuse_scan_20260526.html">既存CSVスキャンへ戻る</a>
        <a class="button" href="461_per_source_feasibility.csv">取得元CSV</a>
        <a class="button" href="462_ticker_metric_fetch_route.csv">銘柄別ルートCSV</a>
        <a class="button" href="464_next_connector_tasks.csv">次作業CSV</a>
      </div>
      <div class="kpis">
        <div class="kpi"><b>J-Quants</b><span>第一候補・認証必須</span></div>
        <div class="kpi"><b>IR/EDINET</b><span>公式補完ルート</span></div>
        <div class="kpi"><b>Yahoo 429</b><span>現在は不安定</span></div>
        <div class="kpi"><b>0件</b><span>スコア接続</span></div>
      </div>
    </section>

    <div class="notice">
      重要: 外部値は、出典URL・取得日時・予想/実績区分・基準株価がそろうまで採点へ接続しません。
    </div>

    <section class="panel">
      <h2>取得元の現実性</h2>
      ${table(
        [
          { key: 'source', label: '取得元' },
          { key: 'data', label: '取れるデータ' },
          { key: 'reliability', label: '信頼性' },
          { key: 'current_result', label: '現在の結果' },
          { key: 'requirement', label: '必要条件' },
          { key: 'use_policy', label: '使い方' },
        ],
        sourceRows,
      )}
    </section>

    <section class="panel">
      <h2>銘柄別の取得ルート</h2>
      ${table(
        [
          { key: 'ticker', label: '銘柄' },
          { key: 'company', label: '会社' },
          { key: 'missing_metric', label: '不足指標' },
          { key: 'preferred_route', label: '第一ルート' },
          { key: 'fallback_route', label: '代替ルート' },
          { key: 'current_status', label: '状態' },
          { key: 'score_policy', label: 'スコア' },
        ],
        tickerRows,
      )}
    </section>

    <section class="panel">
      <h2>次の実装タスク</h2>
      ${table(
        [
          { key: 'priority', label: '優先' },
          { key: 'task', label: 'タスク' },
          { key: 'action', label: '実施内容' },
          { key: 'output', label: '成果物' },
        ],
        nextTaskRows,
      )}
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'external_metric_source_feasibility_20260526.html'), html, 'utf8');

console.log('created external_metric_source_feasibility_20260526.html');
console.log(`sources=${sourceRows.length}, routes=${tickerRows.length}`);
