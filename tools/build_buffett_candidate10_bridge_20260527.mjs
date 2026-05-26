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
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  const headers = rows.shift() || [];
  return rows
    .filter((items) => items.some((item) => String(item).trim() !== ''))
    .map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] || ''])));
}

function readCsv(name) {
  return parseCsv(fs.readFileSync(path.join(ROOT, name), 'utf8'));
}

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

const candidates = readCsv('590_candidate_10_final_checklist_detail.csv');

function bridgeFor(row) {
  if (row.ticker === '8766.T') {
    return {
      relation: '直接接続: 保険・提携監視',
      check: 'バークシャー傘下会社との提携、保険引受利益、自然災害損害率、政策保有株売却、ROE/PBR',
      action: '提携ニュースだけで上げない。保険利益と資本効率が確認できれば条件付き確認を維持。',
      alert: '提携効果が数字に出ない、自然災害損害率悪化、決算後指数劣後なら下げる。',
      qualitative_gate: '確認条件',
    };
  }
  if (row.ticker === '8316.T' || row.ticker === '8306.T') {
    return {
      relation: '間接接続: 銀行・金利・信用コスト',
      check: '米国銀行株の売買変化、資金利益、信用コスト、日銀後の金融株反応、自己株買い/増配',
      action: '米国銀行株の動きは補助材料。日本の決算と日銀後反応を優先する。',
      alert: '米国銀行株の大幅売却と信用不安ニュースが重なる場合は警戒。',
      qualitative_gate: '警戒条件',
    };
  }
  if (row.ticker === '5020.T') {
    return {
      relation: '間接接続: エネルギー・原油循環',
      check: 'Chevronなどエネルギー株の増減、原油価格、精製マージン、在庫影響、指数比較',
      action: '原油・資源循環の参考材料にする。1年保有候補では過熱と循環リスクを別管理。',
      alert: 'エネルギー株の大幅売却、原油急落、精製マージン悪化が重なる場合は下げる。',
      qualitative_gate: '警戒条件',
    };
  }
  if (['8058.T', '8031.T', '8001.T', '8002.T', '8053.T'].includes(row.ticker)) {
    return {
      relation: '直接接続: 商社5社',
      check: 'バークシャー保有比率、自己株買い、ROE、PBR、資源価格、円安感応度、セグメント利益',
      action: '保有増だけでは上げない。決算・還元・PBR改善が確認できる場合だけ残す。',
      alert: '保有比率の大幅低下、全売却、商社への否定的コメントが出た場合は警戒。',
      qualitative_gate: '確認条件',
    };
  }
  return {
    relation: '直接接続なし',
    check: 'バークシャー売買とは直接接続しない。通常の量的評価と各社テーマで確認。',
    action: 'バフェット項目は加点にも減点にも使わない。',
    alert: '市場全体のリスク材料としてのみ確認。',
    qualitative_gate: '対象外',
  };
}

const bridgeRows = candidates.map((row) => {
  const bridge = bridgeFor(row);
  return {
    updated_at: generatedAt,
    rank: row.rank,
    ticker: row.ticker,
    company: row.company,
    current_priority: row.priority,
    quantitative_score: row.quantitative_score,
    integrated_grade: row.integrated_grade,
    buffett_relation: bridge.relation,
    buffett_check: bridge.check,
    action_rule: bridge.action,
    alert_rule: bridge.alert,
    qualitative_gate: bridge.qualitative_gate,
    score_use: '直接加点しない。確認条件・警戒条件として使用。',
  };
});

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '対象',
    detail: '候補10社へバフェット・バークシャー売買監視を接続。',
  },
  {
    updated_at: generatedAt,
    item: '直接接続',
    detail: `${bridgeRows.filter((row) => row.buffett_relation.startsWith('直接接続:')).length}件。東京海上HD、商社系が該当。`,
  },
  {
    updated_at: generatedAt,
    item: '間接接続',
    detail: `${bridgeRows.filter((row) => row.buffett_relation.startsWith('間接接続')).length}件。銀行、エネルギーが該当。`,
  },
  {
    updated_at: generatedAt,
    item: '使い方',
    detail: '売買事実は質的監視材料。スコアへ直接足さず、確認条件・警戒条件として使う。',
  },
];

writeCsv('605_buffett_candidate10_bridge_summary.csv', summaryRows, ['updated_at', 'item', 'detail']);
writeCsv('606_buffett_candidate10_bridge_detail.csv', bridgeRows, [
  'updated_at',
  'rank',
  'ticker',
  'company',
  'current_priority',
  'quantitative_score',
  'integrated_grade',
  'buffett_relation',
  'buffett_check',
  'action_rule',
  'alert_rule',
  'qualitative_gate',
  'score_use',
]);

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>バフェット監視×候補10社 接続表 2026年5月27日</title>
  <style>
    :root { --ink:#061e38; --line:#cbdff0; --blue:#0b5e94; --bg:#f4f8fb; --orange:#b45309; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; line-height:1.65; }
    main { max-width:1280px; margin:0 auto; padding:24px 18px 48px; }
    header { background:#082f53; color:#fff; border-radius:14px; padding:26px; margin-bottom:16px; }
    h1 { margin:0 0 8px; font-size:clamp(26px,4vw,40px); line-height:1.2; }
    h2 { margin:0 0 10px; font-size:22px; border-left:7px solid var(--blue); padding-left:12px; }
    .lead { margin:0; max-width:1000px; color:#edf7ff; font-weight:700; }
    section { background:#fff; border:1px solid var(--line); border-radius:12px; box-shadow:0 8px 20px rgba(20,60,90,.08); padding:18px; margin-top:14px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; background:#fff; min-width:900px; }
    .wide table { min-width:1750px; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:9px 11px; vertical-align:top; color:#031f3b; }
    th { background:#e7f2fb; text-align:left; white-space:nowrap; }
    tr:last-child td { border-bottom:0; }
    .note { border:1px solid #f5c77a; border-left:8px solid var(--orange); background:#fff8eb; border-radius:10px; padding:12px 14px; font-weight:700; margin-top:12px; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .actions a { display:inline-flex; align-items:center; justify-content:center; min-height:42px; padding:9px 14px; border-radius:8px; background:var(--blue); color:#fff; text-decoration:none; font-weight:700; }
    @media (max-width:900px) { main { padding:12px 10px 36px; } header,section { padding:16px; } }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>バフェット監視×候補10社 接続表</h1>
      <p class="lead">候補10社に対して、バークシャー売買監視が直接関係するか、間接的な警戒材料か、対象外かを整理した表です。</p>
    </header>
    <section>
      <h2>1. 概要</h2>
      ${table([
        { key: 'item', label: '項目' },
        { key: 'detail', label: '内容' },
      ], summaryRows)}
      <div class="note">バフェット項目は直接加点しません。確認条件・警戒条件として扱います。</div>
    </section>
    <section>
      <h2>2. 候補10社への接続</h2>
      ${table([
        { key: 'rank', label: '順位' },
        { key: 'ticker', label: '銘柄' },
        { key: 'company', label: '会社名' },
        { key: 'current_priority', label: '現扱い' },
        { key: 'quantitative_score', label: '量的点' },
        { key: 'integrated_grade', label: '統合評価' },
        { key: 'buffett_relation', label: '接続' },
        { key: 'buffett_check', label: '確認内容' },
        { key: 'action_rule', label: '扱い' },
        { key: 'alert_rule', label: '警戒条件' },
        { key: 'qualitative_gate', label: '質的ゲート' },
        { key: 'score_use', label: 'スコアでの扱い' },
      ], bridgeRows, 'wide')}
      <div class="actions">
        <a href="605_buffett_candidate10_bridge_summary.csv">概要CSV</a>
        <a href="606_buffett_candidate10_bridge_detail.csv">接続表CSV</a>
        <a href="buffett_japan_connection_20260527.html">日本株接続へ</a>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'buffett_candidate10_bridge_20260527.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  rows: bridgeRows.length,
  direct: bridgeRows.filter((row) => row.buffett_relation.startsWith('直接接続:')).length,
  indirect: bridgeRows.filter((row) => row.buffett_relation.startsWith('間接接続')).length,
  output: 'buffett_candidate10_bridge_20260527.html',
}, null, 2));
