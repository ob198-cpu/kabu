import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const generatedAt = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
}).format(new Date());

function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else cell += ch;
  }
  if (cell.length || row.length) row.push(cell.replace(/\r$/, ''));
  const headers = rows.shift() || [];
  return rows
    .filter((items) => items.some((item) => String(item).trim() !== ''))
    .map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] || ''])));
}

function readCsv(name) {
  return parseCsv(fs.readFileSync(path.join(ROOT, name), 'utf8'));
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function table(headers, rows) {
  return `<table><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${esc(row[header])}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

const top10 = readCsv('764_morning_recalc_top10.csv').map((row) => ({
  順位: row.朝更新順位,
  銘柄: row.銘柄,
  スコア: row.朝更新スコア,
  扱い: row.現時点の扱い,
  '1年%': row['1年騰落率%'],
  過熱: row.過熱判定,
  確認: row.まだ必要な確認
}));

const schedule = readCsv('778_provisional_dated_schedule.csv').map((row) => ({
  日付: row.日付,
  種別: row.種別,
  売買予定: row.売買予定,
  判断基準: row.判断基準
}));

const weights = readCsv('771_provisional_target_weights.csv').map((row) => ({
  銘柄: row.銘柄,
  目標比率: row.目標比率,
  目標金額: row.目標金額,
  理由: row.理由
}));

const tradeSummary = readCsv('768_trade_rule_summary.csv');

const deliverables = [
  {
    成果物: '質的情報レイヤー設計',
    内容: '質的情報を、観測情報、伝播経路、企業接続、実績検証、運用反映に分ける構造を作成。'
  },
  {
    成果物: '10社反映マトリクス',
    内容: '10社ごとに、質的仮説、確認する数字、株価検証、停止条件を整理。'
  },
  {
    成果物: '株価時系列取得',
    内容: '10社と主要指数の1年日次データを取得し、騰落率、最大下落、指数差、過熱判定を計算。'
  },
  {
    成果物: '今朝指標反映の暫定再計算',
    内容: '事前スコア70%、価格確認点30%で暫定順位を算出。過熱銘柄は価格点を上限処理。'
  },
  {
    成果物: '共通+銘柄別 売買ルール',
    内容: '下値、上値、急落、利確、銘柄別補正のルールを実装。'
  },
  {
    成果物: '暫定 売買実行ルール',
    内容: '6月イベント後の投入日、投入率、銘柄別比率、利確、途中決済、決算前後、指数劣後時の分岐を作成。'
  },
  {
    成果物: '具体日付入り予定表',
    内容: '2026年6月10日から8月28日まで、確認日と実行候補日を日付単位で整理。'
  }
];

const nextTasks = [
  {
    優先: '1',
    タスク: 'PER/PBR/ROE、売上・利益成長率の公式値補完',
    目的: 'スコアの未入力部分を減らし、候補順位の説明力を上げる。'
  },
  {
    優先: '2',
    タスク: '決算後1日/5日/20日反応の計算',
    目的: '決算を市場が評価しているかを数字で確認する。'
  },
  {
    優先: '3',
    タスク: '同業中央値比較',
    目的: '銀行、保険、商社、電線など業種ごとの割高・割安を比較する。'
  },
  {
    優先: '4',
    タスク: '6月イベント後の再計算',
    目的: 'CPI、日銀、FOMC後に投入可否と比率を更新する。'
  },
  {
    優先: '5',
    タスク: 'TOPIX比較の別取得元確認',
    目的: 'Yahoo FinanceでTOPIX系データに異常値が出たため、別取得元で比較精度を上げる。'
  }
];

const keyLinks = [
  ['今朝指標反映 10社暫定再計算', 'https://ob198-cpu.github.io/kabu/morning_recalc_top10_20260528.html?v=b82a9d6'],
  ['共通+銘柄別 売買ルール', 'https://ob198-cpu.github.io/kabu/trade_rules_common_stock_20260528.html?v=4d5e713'],
  ['暫定 売買実行ルール', 'https://ob198-cpu.github.io/kabu/provisional_trade_execution_plan_20260528.html?v=d2a870d'],
  ['具体日付予定CSV', 'https://ob198-cpu.github.io/kabu/778_provisional_dated_schedule.csv?v=d2a870d']
];

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>本日の進捗報告書 2026年5月28日</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Noto Sans JP", "Meiryo", "Yu Gothic", Arial, sans-serif; color: #050b14; background: #fff; line-height: 1.55; font-size: 11px; }
    .page { page-break-after: always; padding: 0; }
    .page:last-child { page-break-after: auto; }
    .cover { background: #123d63; color: #fff; min-height: 180mm; padding: 22mm; border-radius: 0; }
    h1 { font-size: 30px; margin: 0 0 12px; letter-spacing: 0; }
    h2 { font-size: 18px; margin: 0 0 8px; padding-left: 8px; border-left: 6px solid #0b5f96; color: #123d63; }
    h3 { font-size: 14px; margin: 10px 0 6px; color: #123d63; }
    .cover h2 { color: #fff; border-color: #8fd3ff; }
    .lead { font-size: 15px; max-width: 860px; }
    .cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 12px 0; }
    .card { border: 1px solid #cbd8e6; border-radius: 8px; padding: 10px; background: #f8fbff; }
    .cover .card { background: rgba(255,255,255,.08); border-color: rgba(255,255,255,.3); color: #fff; }
    .value { font-size: 24px; font-weight: 900; color: #0b5f96; }
    .cover .value { color: #fff; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 6px 0 12px; }
    th, td { border: 1px solid #cbd8e6; padding: 5px; vertical-align: top; overflow-wrap: break-word; }
    th { background: #e6f1fb; color: #123d63; text-align: left; }
    .note { border-left: 6px solid #a85b00; background: #fff8ec; padding: 8px; margin: 8px 0 12px; }
    .danger { border-left: 6px solid #b42318; background: #fff4f2; padding: 8px; margin: 8px 0 12px; }
    .small { font-size: 10px; color: #34465b; }
    .links li { margin: 3px 0; }
    a { color: #075e91; text-decoration: none; }
  </style>
</head>
<body>
  <section class="page cover">
    <h1>本日の進捗報告書</h1>
    <h2>2026年5月28日</h2>
    <p class="lead">NISA 1年保有テストに向けて、候補10社の再計算、質的情報の反映構造、共通+銘柄別の売買ルール、具体日付入りの暫定実行予定を整備しました。</p>
    <div class="cards">
      <div class="card"><b>対象</b><div class="value">10社</div><p>候補を暫定再計算</p></div>
      <div class="card"><b>資金前提</b><div class="value">200万</div><p>NISAテスト想定</p></div>
      <div class="card"><b>初回候補</b><div class="value">6/19</div><p>6/18判定後</p></div>
      <div class="card"><b>現金待機</b><div class="value">10%</div><p>急落・入替対応</p></div>
    </div>
    <p class="danger">本資料は暫定の判断補助資料です。売買を確定するものではありません。最新決算、証券口座の取扱、当日の価格、6月イベント後の市場反応を確認して再判定します。</p>
  </section>

  <section class="page">
    <h2>1. 本日の成果</h2>
    ${table(['成果物', '内容'], deliverables)}
    <h2>2. 売買ルールの整理</h2>
    ${table(['項目', '内容'], tradeSummary)}
  </section>

  <section class="page">
    <h2>3. 今朝指標反映 10社暫定再計算</h2>
    <p class="note">再計算式: 朝更新スコア = 事前スコア70% + 価格確認点30%。価格確認点は過熱判定で上限処理済みです。</p>
    ${table(['順位', '銘柄', 'スコア', '扱い', '1年%', '過熱', '確認'], top10)}
  </section>

  <section class="page">
    <h2>4. 200万円NISA 暫定投入比率</h2>
    ${table(['銘柄', '目標比率', '目標金額', '理由'], weights)}
    <p class="note">最大投資90%、現金待機10%の暫定設計です。6月イベント後の再判定で比率を変更します。</p>
  </section>

  <section class="page">
    <h2>5. 具体日付入り予定表</h2>
    ${table(['日付', '種別', '売買予定', '判断基準'], schedule)}
  </section>

  <section class="page">
    <h2>6. 残タスク</h2>
    ${table(['優先', 'タスク', '目的'], nextTasks)}
    <h2>7. 確認URL</h2>
    <ul class="links">
      ${keyLinks.map(([label, url]) => `<li><b>${esc(label)}</b>: <a href="${esc(url)}">${esc(url)}</a></li>`).join('')}
    </ul>
    <p class="small">作成: ${esc(generatedAt)}</p>
  </section>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'daily_progress_report_20260528.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  output: 'daily_progress_report_20260528.html',
  rows: {
    top10: top10.length,
    schedule: schedule.length,
    weights: weights.length
  }
}, null, 2));
