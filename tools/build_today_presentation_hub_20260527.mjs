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

const linkRows = [
  {
    order: '1',
    title: '本日説明用 10社選出根拠',
    url: 'candidate_10_presentation_brief_20260527.html',
    purpose: '最初に見せる資料。結論、選定方法、10社の強弱、確認条件を説明する。',
  },
  {
    order: '2',
    title: '本日説明用 Q&A',
    url: 'candidate_10_presentation_qa_20260527.html',
    purpose: '突っ込まれやすい質問への回答。購入確定ではないこと、質的加点ではないことを説明する。',
  },
  {
    order: '3',
    title: '本日説明用 トークスクリプト',
    url: 'candidate_10_talk_script_20260527.html',
    purpose: '5分程度で説明するための読み上げ文とLINE報告文。',
  },
  {
    order: '4',
    title: '質的テーマ×銘柄 接続表',
    url: 'qualitative_theme_stock_bridge_20260527.html',
    purpose: '各銘柄がどの時流テーマに接続しているかを確認する。',
  },
  {
    order: '5',
    title: '質的アイデア地図',
    url: 'qualitative_idea_map_20260527.html',
    purpose: '半導体、電力、金利、為替などの質的アイデア全体を見る。',
  },
  {
    order: '6',
    title: 'テーマ別候補拡張キュー',
    url: 'theme_expansion_queue_20260527.html',
    purpose: '10社の次に100社前後へ広げる作業計画を示す。',
  },
  {
    order: '7',
    title: '量的×質的 統合候補判定',
    url: 'dual_axis_integrated_selection_20260527.html',
    purpose: '質的テーマを加点せず、弱い評価を上限にする計算ルールを確認する。',
  },
];

const conclusionRows = [
  {
    item: '本日の結論',
    text: '10社を購入対象として確定するのではなく、6月再判定に向けた検証対象として整理した。',
  },
  {
    item: '最優先確認',
    text: 'TDK。量的評価A、質的評価A。AI半導体・HBM・電子部品・円安感応を確認する。',
  },
  {
    item: '条件付き確認',
    text: '三井住友FG、味の素、東京海上HD。テーマはあるが、公式数字と20営業日反応の確認が必要。',
  },
  {
    item: '検算・比較',
    text: 'ディスコは半導体工程の構造テーマが強いが、直近反応が弱いため検算枠。その他も比較・補完として扱う。',
  },
];

writeCsv('584_today_presentation_hub_links.csv', linkRows, [
  'order',
  'title',
  'url',
  'purpose',
]);

writeCsv('585_today_presentation_hub_conclusion.csv', conclusionRows, [
  'item',
  'text',
]);

function table(headers, rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map((header) => `<th>${esc(header.label)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${header.key === 'url' ? `<a href="${esc(row[header.key])}">${esc(row[header.key])}</a>` : esc(row[header.key])}</td>`).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>`;
}

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>本日説明資料ハブ 2026年5月27日</title>
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
    table { width:100%; border-collapse:collapse; background:#fff; min-width:860px; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:10px 12px; vertical-align:top; color:#031f3b; }
    th { background:#e7f2fb; text-align:left; white-space:nowrap; }
    tr:last-child td { border-bottom:0; }
    a { color:var(--blue); font-weight:700; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .actions a { display:inline-flex; align-items:center; justify-content:center; min-height:42px; padding:9px 14px; border-radius:8px; background:var(--blue); color:#fff; text-decoration:none; font-weight:700; }
    @media (max-width:900px) { main { padding:14px 10px 40px; } header,section { padding:18px; } }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>本日説明資料ハブ</h1>
      <p class="lead">今日見せる資料を順番にまとめた入口です。最初は10社選出根拠、必要に応じてQ&A、トークスクリプト、質的テーマ資料へ進みます。</p>
    </header>

    <section>
      <h2>1. まず伝える結論</h2>
      ${table([
        { key: 'item', label: '項目' },
        { key: 'text', label: '内容' },
      ], conclusionRows)}
      <div class="note">説明の中心は「購入確定」ではなく「6月再判定に向けた検証対象の選出」です。</div>
    </section>

    <section>
      <h2>2. 資料の順番</h2>
      ${table([
        { key: 'order', label: '順番' },
        { key: 'title', label: '資料' },
        { key: 'url', label: 'リンク' },
        { key: 'purpose', label: '用途' },
      ], linkRows)}
      <div class="actions">
        <a href="candidate_10_presentation_brief_20260527.html">最初の資料を開く</a>
        <a href="584_today_presentation_hub_links.csv">リンクCSV</a>
        <a href="585_today_presentation_hub_conclusion.csv">結論CSV</a>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'today_presentation_hub_20260527.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  links: linkRows.length,
  output: 'today_presentation_hub_20260527.html',
}, null, 2));
