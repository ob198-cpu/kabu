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

const qaRows = [
  {
    category: '選定全体',
    question: 'この10社は購入候補として確定ですか。',
    answer: '確定ではありません。本日提示する10社は、6月の市場イベント後に再判定する検証対象です。現時点では、TDKを最優先確認、三井住友FG・味の素・東京海上HDを条件付き確認、その他を比較・補完・検算に分けています。',
    evidence: '本日説明用10社選出根拠、量的×質的統合候補判定',
  },
  {
    category: '選定方法',
    question: '時流テーマを点数に足しているだけではないですか。',
    answer: '足していません。質的テーマは候補抽出、通過条件、除外条件として使い、総合点へ直接加算しません。量的評価・質的評価・元評価の弱い側を上限にして、過大評価を抑えています。',
    evidence: '質的評価ゲート、量的×質的統合候補判定',
  },
  {
    category: '半導体',
    question: '半導体工程で高シェアなら有望なのに、なぜディスコを上位にしないのですか。',
    answer: '構造テーマは有力ですが、現時点では直近の株価反応が弱く、公式数字と20営業日反応の検算が必要です。そのため主候補ではなく仮説検算枠に置いています。テーマだけで上げないための設計です。',
    evidence: '質的テーマ×銘柄接続表、NISA検証対象10社',
  },
  {
    category: 'TDK',
    question: 'なぜTDKが最優先なのですか。',
    answer: '量的評価A、質的評価Aで、AI半導体・HBM周辺、電子部品、円安感応に接続しています。今後は20営業日反応、AI/HBM関連の売上・受注・利益率、為替感応度を確認します。',
    evidence: '本日説明用10社選出根拠、質的テーマ×銘柄接続表',
  },
  {
    category: '金融',
    question: '三井住友FGや東京海上HDを入れる理由は何ですか。',
    answer: '金利上昇、資本効率、株主還元のテーマに接続します。ただし、信用コスト、自然災害損害率、日銀後の金融株反応が条件です。条件付き候補として扱い、無条件の上位候補にはしていません。',
    evidence: '質的テーマ×銘柄接続表',
  },
  {
    category: '味の素',
    question: '味の素はPERが高いのではないですか。',
    answer: '高い可能性があるため、条件付き確認にしています。食品値上げ耐性、ABF/ヘルスケア、原材料・為替のテーマはありますが、値上げ後の数量維持、原材料費、成長率でPERを説明できるかを確認します。',
    evidence: '本日説明用10社選出根拠',
  },
  {
    category: '100社母集団',
    question: '100社前後の母集団はどう扱っていますか。',
    answer: '100社ぴったりを目的にせず、候補として意味のある母集団を作る方針です。本日は、その中から詳細確認へ進める10社を検証対象として整理しています。次工程で母集団全体への質的テーマ接続を広げます。',
    evidence: '母集団定義、質的テーマ×銘柄接続表',
  },
  {
    category: 'NISA',
    question: 'NISAで1年持つ前提に合っていますか。',
    answer: '短期売買ではなく1年保有テストを想定しています。そのため、テーマだけでなく、決算数字、下落耐性、20営業日反応、6月の市場イベント後の再判定を重視しています。',
    evidence: 'NISA 1年保有テスト運用手順',
  },
  {
    category: 'ベンチマーク',
    question: 'S&P500や日経平均連動投信より意味がありますか。',
    answer: '目標は、既存の無難な選択肢を1年で少なくとも+1%ポイント上回れるかを検証することです。現時点では実績ではなく、検証設計と候補整理の段階です。',
    evidence: '+1%ベンチマーク接続、NISA記録台帳',
  },
  {
    category: '6月判断',
    question: 'いつ決めるのですか。',
    answer: '5月中は候補整理とデータ確認です。6月のCPI、日銀、FOMC後に、市場環境、指数反応、各社の確認数字を更新し、残す・下げる・外すに再分類します。',
    evidence: '候補10社 6月再判定カレンダー、6月判定ルール',
  },
];

const wordingRows = [
  {
    type: '言ってよい',
    phrase: '本日提示する10社は、6月再判定に向けた検証対象です。',
    reason: '購入確定と誤解されにくい。',
  },
  {
    type: '言ってよい',
    phrase: '量的評価を主軸に、質的テーマは加点せず確認条件として扱っています。',
    reason: '今回の設計の妥当性を説明できる。',
  },
  {
    type: '言ってよい',
    phrase: 'TDKは最優先確認、三井住友FG・味の素・東京海上HDは条件付き確認です。',
    reason: '候補の強弱を明確に示せる。',
  },
  {
    type: '避ける',
    phrase: 'この10社を買えばよいです。',
    reason: '投資実行判断に見えるため不可。',
  },
  {
    type: '避ける',
    phrase: '半導体工程で高シェアなので必ず上がります。',
    reason: '反証条件を無視した断定になるため不可。',
  },
  {
    type: '避ける',
    phrase: 'AIが選んだので正しいです。',
    reason: '根拠説明にならないため不可。',
  },
];

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '想定質問',
    value: `${qaRows.length}件`,
    meaning: '今日の説明で聞かれやすい質問に対する回答を準備。',
  },
  {
    updated_at: generatedAt,
    item: '表現ルール',
    value: `${wordingRows.length}件`,
    meaning: '購入確定や断定に見える表現を避ける。',
  },
  {
    updated_at: generatedAt,
    item: '説明の軸',
    value: '検証対象の選出',
    meaning: '投資実行判断ではなく、6月再判定に向けた候補整理として説明する。',
  },
];

writeCsv('577_candidate_10_presentation_qa_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'meaning',
]);

writeCsv('578_candidate_10_presentation_qa.csv', qaRows, [
  'category',
  'question',
  'answer',
  'evidence',
]);

writeCsv('579_candidate_10_presentation_wording.csv', wordingRows, [
  'type',
  'phrase',
  'reason',
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
  <title>本日説明用 想定質問と回答 2026年5月27日</title>
  <style>
    :root { --ink:#061e38; --muted:#334155; --line:#cbdff0; --blue:#0b5e94; --bg:#f4f8fb; --soft:#eef7ff; --orange:#b45309; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; line-height:1.75; }
    main { max-width:1180px; margin:0 auto; padding:28px 18px 56px; }
    header { background:#082f53; color:#fff; border-radius:14px; padding:30px; margin-bottom:18px; }
    h1 { margin:0 0 10px; font-size:clamp(26px,4vw,40px); line-height:1.2; }
    h2 { margin:0 0 12px; font-size:24px; border-left:7px solid var(--blue); padding-left:12px; }
    .lead { margin:0; max-width:920px; color:#edf7ff; font-weight:700; }
    section,.card { background:#fff; border:1px solid var(--line); border-radius:12px; box-shadow:0 10px 22px rgba(20,60,90,.08); }
    section { padding:22px; margin-top:18px; }
    .cards { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:14px; margin:18px 0; }
    .card { padding:16px; }
    .card small { display:block; color:var(--muted); font-weight:700; }
    .card b { display:block; font-size:28px; margin-top:4px; }
    .note { border:1px solid #f5c77a; border-left:8px solid var(--orange); background:#fff8eb; border-radius:10px; padding:14px 16px; font-weight:700; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; background:#fff; min-width:920px; }
    .wide table { min-width:1220px; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:10px 12px; vertical-align:top; color:#031f3b; }
    th { background:#e7f2fb; text-align:left; white-space:nowrap; }
    tr:last-child td { border-bottom:0; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .actions a { display:inline-flex; align-items:center; justify-content:center; min-height:42px; padding:9px 14px; border-radius:8px; background:var(--blue); color:#fff; text-decoration:none; font-weight:700; }
    .actions a.secondary { background:#fff; color:var(--blue); border:1px solid var(--line); }
    @media (max-width:900px) { .cards { grid-template-columns:1fr; } main { padding:14px 10px 40px; } header,section { padding:18px; } }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>本日説明用 想定質問と回答</h1>
      <p class="lead">10社選出について、聞かれやすい質問と回答、避ける表現を整理した補助資料です。</p>
    </header>

    <div class="cards">
      <div class="card"><small>想定質問</small><b>${qaRows.length}件</b></div>
      <div class="card"><small>表現ルール</small><b>${wordingRows.length}件</b></div>
      <div class="card"><small>説明軸</small><b>検証対象</b></div>
    </div>

    <section>
      <h2>1. 説明の前提</h2>
      <p>本日の資料は、購入対象を確定するためではなく、6月再判定に向けて検証対象を選出した根拠を説明するものです。量的評価を主軸にし、質的テーマは加点ではなく確認条件として扱います。</p>
      <div class="note">断定表現は避け、候補の強弱と不足データを明示します。</div>
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
      <h2>3. 想定質問と回答</h2>
      ${table([
        { key: 'category', label: '分類' },
        { key: 'question', label: '質問' },
        { key: 'answer', label: '回答' },
        { key: 'evidence', label: '参照資料' },
      ], qaRows, 'wide')}
    </section>

    <section>
      <h2>4. 表現ルール</h2>
      ${table([
        { key: 'type', label: '区分' },
        { key: 'phrase', label: '表現' },
        { key: 'reason', label: '理由' },
      ], wordingRows)}
      <div class="actions">
        <a href="577_candidate_10_presentation_qa_summary.csv">要約CSV</a>
        <a href="578_candidate_10_presentation_qa.csv">Q&A CSV</a>
        <a href="579_candidate_10_presentation_wording.csv">表現CSV</a>
        <a class="secondary" href="candidate_10_presentation_brief_20260527.html">10社選出根拠へ戻る</a>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_presentation_qa_20260527.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  questions: qaRows.length,
  output: 'candidate_10_presentation_qa_20260527.html',
}, null, 2));
