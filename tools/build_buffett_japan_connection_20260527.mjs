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
  return text.split('\n').map((line) => line.replace(/[ \t]+$/g, '')).join('\n');
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
    item: '追加目的',
    detail: 'バフェット・バークシャー売買監視を、日本株候補の質的確認条件に接続する。',
  },
  {
    updated_at: generatedAt,
    item: '扱い',
    detail: 'バークシャー関連は直接加点しない。保有増、提携、急な売却、同業への波及を確認条件として扱う。',
  },
  {
    updated_at: generatedAt,
    item: '日本株で見る中心',
    detail: '商社、保険、銀行、エネルギー、消費関連。特に商社5社と東京海上HDは別枠で監視する。',
  },
  {
    updated_at: generatedAt,
    item: '通知対象',
    detail: '保有比率の大幅増減、全売却、提携発表、年次書簡・総会での日本株コメント。',
  },
];

const connectionRows = [
  {
    area: '商社5社',
    japan_names: '三菱商事、三井物産、伊藤忠商事、丸紅、住友商事',
    berkshire_fact: 'バークシャーは日本の大手商社5社を長期保有テーマとして扱ってきた。2026年時点でも保有比率引き上げが報じられている。',
    why_it_matters: '資源、為替、株主還元、資本効率、海外投資の複合テーマに接続する。',
    check_numbers: '保有比率、自己株買い、ROE、PBR、資源価格、円安感応度、セグメント利益',
    action_rule: '保有増だけでは上げない。各社の決算、還元、PBR改善が確認できた場合だけ商社候補を残す。',
    alert_rule: 'バークシャー保有比率の大幅低下、全売却、商社への否定的コメントが出た場合は警戒。',
  },
  {
    area: '保険',
    japan_names: '東京海上HD',
    berkshire_fact: 'バークシャー傘下のNational Indemnityと東京海上HDの資本・業務提携が報じられている。',
    why_it_matters: '保険引受、再保険、金利、資本効率、政策保有株売却のテーマに接続する。',
    check_numbers: '保険引受利益、自然災害損害率、政策保有株売却、ROE、PBR、金利感応度',
    action_rule: '提携ニュースだけでは上げない。保険利益、資本効率、決算後反応が確認できた場合に条件付き候補として残す。',
    alert_rule: '提携効果が数字に出ない、自然災害損害率悪化、決算後指数劣後なら下げる。',
  },
  {
    area: '銀行',
    japan_names: '三井住友FG、三菱UFJ FG',
    berkshire_fact: '米国株13Fでは銀行株の増減が金利・信用コスト・資本配分の参考材料になる。',
    why_it_matters: '日銀政策、資金利益、信用コスト、株主還元の確認に接続する。',
    check_numbers: '資金利益、信用コスト、自己株買い、増配、日銀後の金融株反応',
    action_rule: '米国銀行株の売買だけで日本銀行株を上げない。日本の決算と日銀後反応を優先する。',
    alert_rule: '米国銀行株の大幅売却と信用不安ニュースが重なる場合は銀行候補を警戒。',
  },
  {
    area: 'エネルギー',
    japan_names: 'ENEOS、INPEX、商社資源部門',
    berkshire_fact: '13FでChevronなどエネルギー株の増減が確認されることがある。',
    why_it_matters: '原油価格、中東リスク、資源部門利益、在庫評価に接続する。',
    check_numbers: '原油価格、精製マージン、資源セグメント利益、在庫影響、株価の指数比較',
    action_rule: 'エネルギー売買は景気・原油循環の参考にする。1年保有候補では過熱と循環リスクを別管理する。',
    alert_rule: '大幅売却、原油急落、精製マージン悪化が重なる場合は中心候補から外す。',
  },
  {
    area: '消費・航空・メディア',
    japan_names: '直接候補化せず、類似業界の時流確認に使う',
    berkshire_fact: '米国13Fで航空、メディア、消費関連の新規取得・買い増しが出る場合がある。',
    why_it_matters: '米国消費、広告、旅行需要、景気循環の補助材料になる。',
    check_numbers: '売上成長、利益率、客数、広告市況、株価反応',
    action_rule: '日本株へは直接接続しない。国内候補は別途、公式決算と株価反応で確認する。',
    alert_rule: '米国消費関連の急な全売却が出た場合は、景気敏感候補の確認を増やす。',
  },
];

const qualitativeRows = [
  {
    theme: 'バフェット・バークシャー売買監視',
    event: '13F、10-Q、年次書簡、株主総会で保有増減やコメントが出る',
    chain: 'バークシャー売買事実 -> 業界・資本配分の仮説 -> 日本株同業・関連銘柄の確認 -> 決算数字と株価反応で検証',
    beneficiary_type: '商社、保険、銀行、エネルギー、消費関連。ただし直接加点しない。',
    japan_examples: '三菱商事、三井物産、伊藤忠、丸紅、住友商事、東京海上HD、三井住友FG、三菱UFJ FG、ENEOSなど',
    hypothesis_layer: 'A',
    evidence_layer: '一部接続可',
    required_numbers: '保有比率、売買増減率、決算数字、ROE/PBR/PER、株主還元、決算後反応、指数比較',
    reject_condition: '13Fだけで理由を断定する、開示遅れを無視する、公式数字に接続しない、急な売却が出る',
    scoring_use: '質的監視項目。量的スコアへ直接加点せず、確認条件・警戒条件・除外条件に使う。',
  },
];

writeCsv('602_buffett_japan_connection_summary.csv', summaryRows, ['updated_at', 'item', 'detail']);
writeCsv('603_buffett_japan_connection_detail.csv', connectionRows, [
  'area',
  'japan_names',
  'berkshire_fact',
  'why_it_matters',
  'check_numbers',
  'action_rule',
  'alert_rule',
]);
writeCsv('604_buffett_qualitative_item.csv', qualitativeRows, [
  'theme',
  'event',
  'chain',
  'beneficiary_type',
  'japan_examples',
  'hypothesis_layer',
  'evidence_layer',
  'required_numbers',
  'reject_condition',
  'scoring_use',
]);

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>バフェット売買 日本株接続 2026年5月27日</title>
  <style>
    :root { --ink:#061e38; --line:#cbdff0; --blue:#0b5e94; --bg:#f4f8fb; --orange:#b45309; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; line-height:1.65; }
    main { max-width:1260px; margin:0 auto; padding:24px 18px 48px; }
    header { background:#082f53; color:#fff; border-radius:14px; padding:26px; margin-bottom:16px; }
    h1 { margin:0 0 8px; font-size:clamp(26px,4vw,40px); line-height:1.2; }
    h2 { margin:0 0 10px; font-size:22px; border-left:7px solid var(--blue); padding-left:12px; }
    .lead { margin:0; max-width:1000px; color:#edf7ff; font-weight:700; }
    section { background:#fff; border:1px solid var(--line); border-radius:12px; box-shadow:0 8px 20px rgba(20,60,90,.08); padding:18px; margin-top:14px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; background:#fff; min-width:900px; }
    .wide table { min-width:1600px; }
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
      <h1>バフェット売買 日本株接続</h1>
      <p class="lead">バークシャーの売買監視を、日本株候補の質的確認条件に接続するための表です。売買事実、理由仮説、確認数字、警戒条件を分けます。</p>
    </header>
    <section>
      <h2>1. 位置づけ</h2>
      ${table([
        { key: 'item', label: '項目' },
        { key: 'detail', label: '内容' },
      ], summaryRows)}
      <div class="note">バークシャー関連は、銘柄を上げる理由ではなく、確認すべき数字を決める入口として扱います。</div>
    </section>
    <section>
      <h2>2. 日本株への接続表</h2>
      ${table([
        { key: 'area', label: '領域' },
        { key: 'japan_names', label: '日本株候補' },
        { key: 'berkshire_fact', label: 'バークシャー関連事実' },
        { key: 'why_it_matters', label: 'なぜ見るか' },
        { key: 'check_numbers', label: '確認数字' },
        { key: 'action_rule', label: '扱い' },
        { key: 'alert_rule', label: '通知・警戒条件' },
      ], connectionRows, 'wide')}
    </section>
    <section>
      <h2>3. 質的アイデア項目としての定義</h2>
      ${table([
        { key: 'theme', label: 'テーマ' },
        { key: 'event', label: '出来事' },
        { key: 'chain', label: '連鎖' },
        { key: 'beneficiary_type', label: '対象領域' },
        { key: 'japan_examples', label: '日本株例' },
        { key: 'required_numbers', label: '確認数字' },
        { key: 'reject_condition', label: '否定条件' },
        { key: 'scoring_use', label: 'スコアでの扱い' },
      ], qualitativeRows, 'wide')}
      <p class="links">
        参照先:
        <a href="buffett_monitor_corner_20260527.html">バフェット売買監視</a> /
        <a href="https://www.berkshirehathaway.com/reports.html" target="_blank" rel="noreferrer">Berkshire Hathaway Reports</a> /
        <a href="https://www.sec.gov/edgar/search/" target="_blank" rel="noreferrer">SEC EDGAR</a>
      </p>
      <div class="actions">
        <a href="602_buffett_japan_connection_summary.csv">概要CSV</a>
        <a href="603_buffett_japan_connection_detail.csv">接続表CSV</a>
        <a href="604_buffett_qualitative_item.csv">質的項目CSV</a>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'buffett_japan_connection_20260527.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  rows: connectionRows.length,
  output: 'buffett_japan_connection_20260527.html',
}, null, 2));
