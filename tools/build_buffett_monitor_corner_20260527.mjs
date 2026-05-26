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

function table(headers, rows, className = '') {
  return `
    <div class="table-wrap ${className}">
      <table>
        <thead><tr>${headers.map((header) => `<th>${esc(header.label)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${esc(row[header.key])}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>`;
}

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '追加項目',
    detail: 'バフェット・バークシャー売買銘柄監視を質的データ項目に追加。',
  },
  {
    updated_at: generatedAt,
    item: '使い方',
    detail: '13Fで確認できる売買事実を入口にし、理由は仮説として分ける。量的スコアへ直接加点しない。',
  },
  {
    updated_at: generatedAt,
    item: '監視対象',
    detail: '新規取得、買い増し、大幅売却、全売却、上位保有の急減、現金比率や自社株買い停止。',
  },
  {
    updated_at: generatedAt,
    item: '注意',
    detail: '13Fは四半期遅れの開示であり、本人の売買理由は直接開示されない。売買理由は10-Q、年次報告、株主総会発言、業界状況から検証する。',
  },
];

const latestRows = [
  {
    filing_period: '2026 Q1',
    as_of: '2026-03-31',
    filed_date: '2026-05-15',
    source: 'Berkshire Hathaway Form 13F / SEC EDGAR / 13F.info',
    fact: '集約ベースで29銘柄、時価約2631億ドルの米国上場株保有が確認される。',
    interpretation: '保有リスト全体の変化を見る材料。購入判断の直接根拠ではない。',
  },
  {
    filing_period: '2026 Q1',
    as_of: '2026-03-31',
    filed_date: '2026-05-15',
    source: '13F集計サイト、報道記事',
    fact: '新規取得、買い増し、売却、全売却が発生。報道ではDelta Air Linesの新規取得やNew York Timesの買い増し、ChevronやBank of Americaの一部売却が話題。',
    interpretation: '日本株では直接銘柄候補にしない。航空、メディア、エネルギー、銀行などの資金配分変化を質的監視材料にする。',
  },
  {
    filing_period: '2026 Q1',
    as_of: '2026-03-31',
    filed_date: '2026-05-15',
    source: 'Berkshire 10-Q/13F、報道',
    fact: '売買理由は13Fに明記されない。',
    interpretation: '理由は「割安」「業界見通し」「資本配分」「担当者変更」「リスク削減」など複数仮説に分け、決め打ちしない。',
  },
];

const ruleRows = [
  {
    rule: '新規取得',
    trigger: '13Fで前四半期ゼロから新規保有が出た場合',
    action: '業界、バリュエーション、売上・利益の安定性、同業の日本株候補を確認する。',
    score_use: '質的テーマ候補。直接加点しない。',
  },
  {
    rule: '買い増し',
    trigger: '保有株数が前四半期比で10%以上増加、または保有順位が大きく上昇した場合',
    action: '買い増し理由の仮説を作り、同業や関連日本株に波及するか確認する。',
    score_use: '確認条件。量的評価A/Bと合う場合のみ検証対象に残す。',
  },
  {
    rule: '大幅売却',
    trigger: '保有株数が前四半期比で20%以上減少した場合',
    action: '急な売却として通知対象。業界見通し悪化、割高、資本配分変更、担当者変更などを分けて確認する。',
    score_use: '除外条件または警戒条件。',
  },
  {
    rule: '全売却',
    trigger: '前四半期にあった銘柄が13Fから消えた場合',
    action: '強い警戒材料として通知対象。類似業界の候補は、量的評価が強くても追加確認まで保留する。',
    score_use: 'ハード警戒条件。',
  },
  {
    rule: '上位保有の急減',
    trigger: '上位10銘柄の保有株数が5%以上減少した場合',
    action: '市場全体への示唆が大きい可能性があるため、関連セクターと指数反応を確認する。',
    score_use: '市場環境ゲート。',
  },
  {
    rule: '開示遅れ補正',
    trigger: '13F開示日は四半期末から約45日後',
    action: '現在の株価・決算・ニュースで鮮度を補正する。',
    score_use: '古い情報の過信防止。',
  },
];

const watchRows = [
  {
    watch_item: '13F提出日',
    source: 'SEC EDGAR、13F.info、HoldingsChannel',
    frequency: '四半期ごと',
    alert: '新規提出が出たら保有増減表を更新',
  },
  {
    watch_item: 'Berkshire 10-Q/10-K',
    source: 'Berkshire Hathaway IR、SEC EDGAR',
    frequency: '四半期・年次',
    alert: '株式売買総額、現金、自己株買い、保険損益を確認',
  },
  {
    watch_item: '株主総会・年次書簡',
    source: 'Berkshire Hathaway公式資料、主要報道',
    frequency: '年次・イベント時',
    alert: '本人または経営陣の資本配分コメントを確認',
  },
  {
    watch_item: '大幅売却ニュース',
    source: 'SEC、主要金融報道、13F集計',
    frequency: '随時',
    alert: '20%以上売却、全売却、上位保有急減を通知',
  },
];

writeCsv('598_buffett_monitor_summary.csv', summaryRows, ['updated_at', 'item', 'detail']);
writeCsv('599_buffett_monitor_rules.csv', ruleRows, ['rule', 'trigger', 'action', 'score_use']);
writeCsv('600_buffett_monitor_latest_snapshot.csv', latestRows, ['filing_period', 'as_of', 'filed_date', 'source', 'fact', 'interpretation']);
writeCsv('601_buffett_monitor_watch_sources.csv', watchRows, ['watch_item', 'source', 'frequency', 'alert']);

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>バフェット・バークシャー売買監視 2026年5月27日</title>
  <style>
    :root { --ink:#061e38; --line:#cbdff0; --blue:#0b5e94; --bg:#f4f8fb; --orange:#b45309; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; line-height:1.65; }
    main { max-width:1240px; margin:0 auto; padding:24px 18px 48px; }
    header { background:#082f53; color:#fff; border-radius:14px; padding:26px; margin-bottom:16px; }
    h1 { margin:0 0 8px; font-size:clamp(26px,4vw,40px); line-height:1.2; }
    h2 { margin:0 0 10px; font-size:22px; border-left:7px solid var(--blue); padding-left:12px; }
    .lead { margin:0; max-width:1000px; color:#edf7ff; font-weight:700; }
    section { background:#fff; border:1px solid var(--line); border-radius:12px; box-shadow:0 8px 20px rgba(20,60,90,.08); padding:18px; margin-top:14px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; background:#fff; min-width:900px; }
    .wide table { min-width:1450px; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:9px 11px; vertical-align:top; color:#031f3b; }
    th { background:#e7f2fb; text-align:left; white-space:nowrap; }
    tr:last-child td { border-bottom:0; }
    .note { border:1px solid #f5c77a; border-left:8px solid var(--orange); background:#fff8eb; border-radius:10px; padding:12px 14px; font-weight:700; margin-top:12px; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .actions a { display:inline-flex; align-items:center; justify-content:center; min-height:42px; padding:9px 14px; border-radius:8px; background:var(--blue); color:#fff; text-decoration:none; font-weight:700; }
    .links a { color:#064f80; font-weight:700; }
    @media (max-width:900px) { main { padding:12px 10px 36px; } header,section { padding:16px; } }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>バフェット・バークシャー売買監視</h1>
      <p class="lead">バークシャーの13F・10-Q・年次書簡を、質的データの監視項目として扱うページです。売買事実と理由仮説を分け、急な売却を通知対象にします。</p>
    </header>
    <section>
      <h2>1. 追加した質的項目</h2>
      ${table([
        { key: 'item', label: '項目' },
        { key: 'detail', label: '内容' },
      ], summaryRows)}
      <div class="note">「バフェットが買ったから買う」とは扱いません。売買事実を入口にし、理由仮説と量的確認を通ったものだけ検証対象にします。</div>
    </section>
    <section>
      <h2>2. 最新確認メモ</h2>
      ${table([
        { key: 'filing_period', label: '対象' },
        { key: 'as_of', label: '基準日' },
        { key: 'filed_date', label: '提出日' },
        { key: 'source', label: '出典' },
        { key: 'fact', label: '確認事実' },
        { key: 'interpretation', label: '扱い' },
      ], latestRows, 'wide')}
    </section>
    <section>
      <h2>3. 通知・判定ルール</h2>
      ${table([
        { key: 'rule', label: 'ルール' },
        { key: 'trigger', label: 'トリガー' },
        { key: 'action', label: 'アクション' },
        { key: 'score_use', label: 'スコアでの扱い' },
      ], ruleRows, 'wide')}
    </section>
    <section>
      <h2>4. 監視元</h2>
      ${table([
        { key: 'watch_item', label: '監視項目' },
        { key: 'source', label: '取得元' },
        { key: 'frequency', label: '頻度' },
        { key: 'alert', label: '通知条件' },
      ], watchRows)}
      <p class="links">
        参照先:
        <a href="https://www.sec.gov/edgar/search/" target="_blank" rel="noreferrer">SEC EDGAR</a> /
        <a href="https://13f.info/13f/000119312526226661-berkshire-hathaway-inc-q1-2026" target="_blank" rel="noreferrer">13F.info Q1 2026</a> /
        <a href="https://www.berkshirehathaway.com/reports.html" target="_blank" rel="noreferrer">Berkshire Hathaway Reports</a>
      </p>
      <div class="actions">
        <a href="598_buffett_monitor_summary.csv">概要CSV</a>
        <a href="599_buffett_monitor_rules.csv">ルールCSV</a>
        <a href="600_buffett_monitor_latest_snapshot.csv">最新メモCSV</a>
        <a href="601_buffett_monitor_watch_sources.csv">監視元CSV</a>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'buffett_monitor_corner_20260527.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  rules: ruleRows.length,
  output: 'buffett_monitor_corner_20260527.html',
}, null, 2));
