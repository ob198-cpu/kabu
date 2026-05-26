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

const scriptRows = [
  {
    order: '1',
    title: '冒頭',
    duration: '30秒',
    text: '本日は、NISA 1年保有テストに向けた検証対象10社の選出根拠を説明します。購入対象を確定する資料ではなく、6月の市場イベント後に再判定するための候補整理です。',
  },
  {
    order: '2',
    title: '選定方針',
    duration: '45秒',
    text: '選定では量的評価を主軸にし、時流やイベントなどの質的テーマは点数に直接足していません。質的テーマは、候補を拾う入口、確認すべき数字、外す条件として使っています。',
  },
  {
    order: '3',
    title: '候補の強弱',
    duration: '45秒',
    text: '10社は同列ではありません。現時点で最も前に置けるのはTDKです。三井住友FG、味の素、東京海上HDは条件付き確認です。その他は比較、補完、検算として扱います。',
  },
  {
    order: '4',
    title: 'TDK',
    duration: '45秒',
    text: 'TDKは量的評価A、質的評価Aで、AI半導体、HBM、電子部品、円安感応に接続しています。今後は20営業日反応、関連売上・受注・利益率、為替感応度を確認します。',
  },
  {
    order: '5',
    title: '条件付き候補',
    duration: '60秒',
    text: '三井住友FGと東京海上HDは金利上昇、資本効率、還元テーマに接続します。ただし信用コスト、自然災害損害率、日銀後の金融株反応が条件です。味の素は食品値上げ耐性、原材料、為替、ABF/ヘルスケアに接続しますが、PERの高さと数量維持を確認します。',
  },
  {
    order: '6',
    title: '半導体工程の扱い',
    duration: '45秒',
    text: '半導体工程で高シェアの企業は有力な質的テーマです。ただしテーマだけでは候補を上げません。ディスコは構造テーマが強い一方、現時点では直近反応が弱いため、主候補ではなく仮説検算枠に置いています。',
  },
  {
    order: '7',
    title: '6月の再判定',
    duration: '45秒',
    text: '6月は米CPI、日銀、FOMC後に、市場環境、指数との比較、各社の確認数字を更新します。そのうえで、候補を残す、下げる、外すに再分類します。',
  },
  {
    order: '8',
    title: '締め',
    duration: '30秒',
    text: '本日の結論は、10社を購入候補として確定することではなく、説明可能な根拠を持って検証対象を整理したことです。6月の実データを入れて、改めて判断できる状態にします。',
  },
];

const lineRows = [
  {
    type: 'LINE報告',
    text: '本日は、NISA 1年保有テストに向けて、100社前後の母集団から詳細確認する10社を整理しました。量的評価を主軸に、時流テーマは点数に足さず、確認条件・除外条件として扱う形にしています。',
  },
  {
    type: 'LINE報告',
    text: '現時点ではTDKを最優先確認、三井住友FG・味の素・東京海上HDを条件付き確認、その他は比較・補完・検算に分類しています。6月のCPI・日銀・FOMC後に、市場環境と各社の確認数字を入れて再判定します。',
  },
];

writeCsv('580_candidate_10_talk_script.csv', scriptRows, [
  'order',
  'title',
  'duration',
  'text',
]);

writeCsv('581_candidate_10_line_report.csv', lineRows, [
  'type',
  'text',
]);

function table(headers, rows) {
  return `
    <div class="table-wrap">
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
  <title>本日説明用 トークスクリプト 2026年5月27日</title>
  <style>
    :root { --ink:#061e38; --muted:#334155; --line:#cbdff0; --blue:#0b5e94; --bg:#f4f8fb; --orange:#b45309; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; line-height:1.75; }
    main { max-width:1080px; margin:0 auto; padding:28px 18px 56px; }
    header { background:#082f53; color:#fff; border-radius:14px; padding:30px; margin-bottom:18px; }
    h1 { margin:0 0 10px; font-size:clamp(26px,4vw,40px); line-height:1.2; }
    h2 { margin:0 0 12px; font-size:24px; border-left:7px solid var(--blue); padding-left:12px; }
    .lead { margin:0; max-width:900px; color:#edf7ff; font-weight:700; }
    section { background:#fff; border:1px solid var(--line); border-radius:12px; box-shadow:0 10px 22px rgba(20,60,90,.08); padding:22px; margin-top:18px; }
    .note { border:1px solid #f5c77a; border-left:8px solid var(--orange); background:#fff8eb; border-radius:10px; padding:14px 16px; font-weight:700; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; background:#fff; min-width:900px; }
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
      <h1>本日説明用 トークスクリプト</h1>
      <p class="lead">そのまま読める短い説明文です。断定せず、選定根拠と6月再判定の位置づけを明確にします。</p>
    </header>

    <section>
      <h2>1. 5分説明</h2>
      ${table([
        { key: 'order', label: '順番' },
        { key: 'title', label: '項目' },
        { key: 'duration', label: '目安' },
        { key: 'text', label: '話す内容' },
      ], scriptRows)}
    </section>

    <section>
      <h2>2. LINE報告文</h2>
      ${table([
        { key: 'type', label: '区分' },
        { key: 'text', label: '文章' },
      ], lineRows)}
      <div class="note">必要に応じて2文に分けて送信できます。</div>
      <div class="actions">
        <a href="580_candidate_10_talk_script.csv">トークCSV</a>
        <a href="581_candidate_10_line_report.csv">LINE文CSV</a>
        <a class="secondary" href="candidate_10_presentation_brief_20260527.html">10社選出根拠へ戻る</a>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_talk_script_20260527.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  scriptRows: scriptRows.length,
  output: 'candidate_10_talk_script_20260527.html',
}, null, 2));
