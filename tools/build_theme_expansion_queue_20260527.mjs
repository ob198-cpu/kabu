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

const expansionRows = [
  {
    priority: '1',
    theme: 'AI半導体・工程別高シェア',
    target_count: '15-25社',
    candidate_scope: '半導体製造装置、検査、後工程、電子部品、材料',
    first_sources: '決算短信、決算説明資料、公式IR、株価時系列、SOX/NASDAQ/日経半導体株指数',
    required_metrics: '該当セグメント売上、受注、受注残、営業利益率、PER、PBR、ROE、決算後20営業日反応',
    output: '半導体テーマ候補一覧、主候補/検算/除外',
  },
  {
    priority: '2',
    theme: '金利上昇・資本効率',
    target_count: '10-15社',
    candidate_scope: '銀行、保険、リース、還元強化企業',
    first_sources: '決算短信、統合報告書、自己株式取得リリース、日銀イベント、株価時系列',
    required_metrics: '資金利益、信用コスト、ROE、PBR、配当、自社株買い規模、日銀後反応',
    output: '金融・還元テーマ候補一覧',
  },
  {
    priority: '3',
    theme: 'データセンター電力・冷却',
    target_count: '10-15社',
    candidate_scope: '重電、変圧器、電線、空調、冷却、電源部品',
    first_sources: '公式IR、決算説明資料、業界統計、電力需要統計、株価時系列',
    required_metrics: '受注、受注残、DC向け売上比率、営業利益率、設備投資コメント、20営業日反応',
    output: '電力・冷却テーマ候補一覧',
  },
  {
    priority: '4',
    theme: '食品・原材料・為替',
    target_count: '10-15社',
    candidate_scope: '食品、日用品、原材料輸入企業、ブランド企業',
    first_sources: '決算短信、決算説明資料、CPI、為替、原材料価格、株価時系列',
    required_metrics: '価格要因、数量要因、原材料費、営業利益率、海外売上比率、PER妥当性',
    output: '食品・必需品テーマ候補一覧',
  },
  {
    priority: '5',
    theme: '防衛・インフラ強靭化',
    target_count: '8-12社',
    candidate_scope: '重工、防衛電子、通信、建設、電設、測量',
    first_sources: '公式IR、受注開示、政府予算、株価時系列',
    required_metrics: '防衛関連受注、受注残、売上比率、利益率、政策イベント後反応',
    output: '防衛・インフラ候補一覧',
  },
  {
    priority: '6',
    theme: '省人化・FA・ロボット',
    target_count: '10-15社',
    candidate_scope: 'FA、ロボット、物流自動化、センサー、産業ソフト',
    first_sources: '決算短信、受注統計、設備投資統計、株価時系列',
    required_metrics: '受注、地域別売上、営業利益率、在庫循環、設備投資感応度',
    output: '省人化テーマ候補一覧',
  },
  {
    priority: '7',
    theme: '個別イベント',
    target_count: '随時',
    candidate_scope: 'TOB、M&A、大型提携、新商品、IPO関連、承認イベント',
    first_sources: 'TDnet、企業IR、証券取引所、公式発表、株価時系列',
    required_metrics: 'イベント内容、価格反応、発表後1/5/20営業日反応、業績寄与、成立条件',
    output: '特別枠イベント候補一覧',
  },
];

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '拡張対象',
    value: '約70-100社',
    meaning: 'テーマ別に候補を広げ、最終的に10社前後へ絞るための作業キュー。',
  },
  {
    updated_at: generatedAt,
    item: '優先テーマ',
    value: 'AI半導体・工程別高シェア',
    meaning: '今日の議論で最も重要な質的仮説。最初に候補を厚くする。',
  },
  {
    updated_at: generatedAt,
    item: '判定方法',
    value: 'テーマ接続後に量的確認',
    meaning: 'テーマ該当だけで採用せず、決算数字と株価反応で絞る。',
  },
];

writeCsv('582_theme_expansion_queue_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'meaning',
]);

writeCsv('583_theme_expansion_queue_detail.csv', expansionRows, [
  'priority',
  'theme',
  'target_count',
  'candidate_scope',
  'first_sources',
  'required_metrics',
  'output',
]);

function table(headers, rows, className = '') {
  return `
    <div class="table-wrap ${className}">
      <table>
        <thead><tr>${headers.map((header) => `<th>${esc(header.label)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${esc(row[header.key])}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>`;
}

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>テーマ別候補拡張キュー 2026年5月27日</title>
  <style>
    :root { --ink:#061e38; --muted:#334155; --line:#cbdff0; --blue:#0b5e94; --bg:#f4f8fb; --orange:#b45309; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; line-height:1.75; }
    main { max-width:1180px; margin:0 auto; padding:28px 18px 56px; }
    header { background:#082f53; color:#fff; border-radius:14px; padding:30px; margin-bottom:18px; }
    h1 { margin:0 0 10px; font-size:clamp(26px,4vw,40px); line-height:1.2; }
    h2 { margin:0 0 12px; font-size:24px; border-left:7px solid var(--blue); padding-left:12px; }
    .lead { margin:0; max-width:920px; color:#edf7ff; font-weight:700; }
    section { background:#fff; border:1px solid var(--line); border-radius:12px; box-shadow:0 10px 22px rgba(20,60,90,.08); padding:22px; margin-top:18px; }
    .note { border:1px solid #f5c77a; border-left:8px solid var(--orange); background:#fff8eb; border-radius:10px; padding:14px 16px; font-weight:700; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; background:#fff; min-width:920px; }
    .wide table { min-width:1380px; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:10px 12px; vertical-align:top; color:#031f3b; }
    th { background:#e7f2fb; text-align:left; white-space:nowrap; }
    tr:last-child td { border-bottom:0; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .actions a { display:inline-flex; align-items:center; justify-content:center; min-height:42px; padding:9px 14px; border-radius:8px; background:var(--blue); color:#fff; text-decoration:none; font-weight:700; }
    .actions a.secondary { background:#fff; color:var(--blue); border:1px solid var(--line); }
    @media (max-width:900px) { main { padding:14px 10px 40px; } header,section { padding:18px; } }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>テーマ別候補拡張キュー</h1>
      <p class="lead">10社だけで終わらせず、100社前後の意味ある母集団へ広げるための作業表です。</p>
    </header>

    <section>
      <h2>1. 目的</h2>
      <p>今日の10社は検証対象ですが、最終的にはテーマ別に70-100社程度まで候補を広げ、量的評価と質的テーマの両方で絞ります。この表は、どのテーマから何社程度を追加し、どの数字で確認するかを固定するためのものです。</p>
      <div class="note">テーマ該当だけでは採用せず、決算数字と株価反応で確認します。</div>
    </section>

    <section>
      <h2>2. 要約</h2>
      ${table([
        { key: 'item', label: '項目' },
        { key: 'value', label: '内容' },
        { key: 'meaning', label: '意味' },
      ], summaryRows)}
    </section>

    <section>
      <h2>3. 拡張キュー</h2>
      ${table([
        { key: 'priority', label: '優先' },
        { key: 'theme', label: 'テーマ' },
        { key: 'target_count', label: '目安社数' },
        { key: 'candidate_scope', label: '候補範囲' },
        { key: 'first_sources', label: '最初に見る資料' },
        { key: 'required_metrics', label: '確認する数字' },
        { key: 'output', label: '出力' },
      ], expansionRows, 'wide')}
      <div class="actions">
        <a href="582_theme_expansion_queue_summary.csv">要約CSV</a>
        <a href="583_theme_expansion_queue_detail.csv">詳細CSV</a>
        <a class="secondary" href="qualitative_idea_map_20260527.html">質的アイデア地図へ戻る</a>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'theme_expansion_queue_20260527.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  rows: expansionRows.length,
  output: 'theme_expansion_queue_20260527.html',
}, null, 2));
