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
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n');
}

const testRows = readCsv('566_candidate_10_current_test_set_detail.csv');
const themeRows = readCsv('573_qualitative_theme_stock_bridge_by_stock.csv');
const themeByTicker = new Map(themeRows.map((row) => [row.ticker, row]));

function selectionLevel(row) {
  if (row.integrated_grade === 'A') return '第1層: 優先確認';
  if (row.integrated_grade === 'B') return '第2層: 条件付き確認';
  if (row.integrated_grade === 'C' && row.integrated_role === '検算枠') return '第4層: 仮説検算';
  if (row.integrated_grade === 'C') return '第3層: 比較・観察';
  return '第3層: データ補完';
}

function presentationDecision(row) {
  if (row.integrated_grade === 'A') return '本日説明の最優先候補';
  if (row.integrated_grade === 'B') return '条件付きで残す候補';
  if (row.integrated_role === '検算枠') return 'テーマ検算候補';
  if (row.integrated_role === '補完待ち') return 'データ補完後に再判定';
  return '比較・観察候補';
}

function conciseReason(row, theme) {
  if (row.ticker === '6762.T') return '量的評価A、質的評価A。AI半導体/HBM周辺と円安感応を確認する価値が最も高い。';
  if (row.ticker === '8316.T') return '金利上昇と還元テーマに接続。ただし信用コストと日銀後の銀行株反応が条件。';
  if (row.ticker === '2802.T') return '食品値上げ耐性と原材料・為替テーマに接続。ただしPERの高さと数量維持を確認。';
  if (row.ticker === '8766.T') return '金利・保険料率・資本効率テーマに接続。ただし災害損害率と引受利益を確認。';
  if (row.ticker === '6146.T') return '半導体工程の高シェア仮説は強いが、直近反応が弱いため検算枠に置く。';
  if (theme?.themes) return `${theme.themes}に接続。ただし統合評価${row.integrated_grade}のため中心候補には置かない。`;
  return row.why_included || '';
}

function firstCheck(row, theme) {
  if (row.ticker === '6762.T') return '20営業日反応、AI/HBM関連の売上・受注・利益率、為替感応度。';
  if (row.ticker === '8316.T') return '資金利益、信用コスト、自己株式取得/増配、日銀後の金融株反応。';
  if (row.ticker === '2802.T') return '値上げ後の数量、原材料費、ABF/ヘルスケア成長、PER妥当性。';
  if (row.ticker === '8766.T') return '保険引受利益、自然災害損害率、政策保有株売却、金利感応度。';
  if (row.ticker === '6146.T') return '半導体工程需要、受注/出荷、利益率、SOXや日経半導体株との相対反応。';
  return row.next_action || theme?.next_action || '';
}

function stopRule(row) {
  if (row.integrated_grade === 'A') return '20営業日反応が指数劣後、または公式数字でテーマ接続が確認できない場合は第2層へ下げる。';
  if (row.integrated_grade === 'B') return '追加確認で下方修正、利益率悪化、指数劣後が出た場合は中心候補から外す。';
  if (row.integrated_role === '検算枠') return '弱い株価反応の理由を説明できなければ、6月テスト候補へ戻さない。';
  return '不足データを補完できない、またはテーマが数字に接続しない場合は比較対象に留める。';
}

const presentationRows = testRows.map((row) => {
  const theme = themeByTicker.get(row.ticker) || {};
  return {
    updated_at: generatedAt,
    rank: row.rank,
    ticker: row.ticker,
    company: row.company,
    selection_level: selectionLevel(row),
    presentation_decision: presentationDecision(row),
    quantitative_score: row.quantitative_score,
    integrated_grade: row.integrated_grade,
    theme_count: theme.matched_theme_count || '0',
    themes: theme.themes || '',
    concise_reason: conciseReason(row, theme),
    first_check: firstCheck(row, theme),
    stop_rule: stopRule(row),
    current_treatment: '本日説明時点の検証候補。投資実行判断ではない。',
  };
});

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '本日選出する対象',
    value: '10社',
    meaning: '100社前後の母集団から詳細確認へ進める検証対象。購入対象の確定ではない。',
  },
  {
    updated_at: generatedAt,
    item: '第1層',
    value: presentationRows.filter((row) => row.selection_level === '第1層: 優先確認').map((row) => row.company).join('、') || '該当なし',
    meaning: '今日の説明で最も前に置ける候補。',
  },
  {
    updated_at: generatedAt,
    item: '第2層',
    value: presentationRows.filter((row) => row.selection_level === '第2層: 条件付き確認').map((row) => row.company).join('、') || '該当なし',
    meaning: '追加確認が通れば候補化できる銘柄。',
  },
  {
    updated_at: generatedAt,
    item: '説明方針',
    value: '強弱を分けて説明',
    meaning: '10社すべてを同じ候補とは言わず、優先確認、条件付き、比較・補完・検算に分ける。',
  },
];

const narrativeRows = [
  {
    section: '結論',
    text: '本日提示する10社は、購入候補の確定ではなく、6月イベント後に再判定する検証対象です。現時点で最も説明可能なのはTDK、条件付き確認は三井住友FG、味の素、東京海上HDです。',
  },
  {
    section: '選定方法',
    text: '量的評価を主軸に、質的テーマは点数へ足さず、候補抽出・通過条件・除外条件として扱いました。強いテーマがあっても、株価反応や公式数字が弱ければ上位候補にしません。',
  },
  {
    section: '半導体テーマの扱い',
    text: '半導体工程の高シェア仮説は有力ですが、現時点では公式数字と株価反応で検算が必要です。ディスコはテーマ性が強い一方、統合評価はCのため検算枠に置きます。',
  },
  {
    section: '6月の判断',
    text: '米CPI、日銀、FOMC後に、市場環境、20営業日反応、各社決算数字を更新し、候補を残す・下げる・外すに再分類します。',
  },
];

writeCsv('574_candidate_10_presentation_brief_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'meaning',
]);

writeCsv('575_candidate_10_presentation_brief_detail.csv', presentationRows, [
  'updated_at',
  'rank',
  'ticker',
  'company',
  'selection_level',
  'presentation_decision',
  'quantitative_score',
  'integrated_grade',
  'theme_count',
  'themes',
  'concise_reason',
  'first_check',
  'stop_rule',
  'current_treatment',
]);

writeCsv('576_candidate_10_presentation_narrative.csv', narrativeRows, [
  'section',
  'text',
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
  <title>本日説明用 10社選出根拠 2026年5月27日</title>
  <style>
    :root { --ink:#061e38; --muted:#334155; --line:#cbdff0; --blue:#0b5e94; --bg:#f4f8fb; --soft:#eef7ff; --orange:#b45309; --green:#0c7a43; --red:#b91c1c; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; line-height:1.75; }
    main { max-width:1220px; margin:0 auto; padding:28px 18px 56px; }
    header { background:#082f53; color:#fff; border-radius:14px; padding:30px; margin-bottom:18px; }
    h1 { margin:0 0 10px; font-size:clamp(26px,4vw,42px); line-height:1.2; }
    h2 { margin:0 0 12px; font-size:24px; border-left:7px solid var(--blue); padding-left:12px; }
    .lead { margin:0; max-width:940px; color:#edf7ff; font-weight:700; }
    section,.card { background:#fff; border:1px solid var(--line); border-radius:12px; box-shadow:0 10px 22px rgba(20,60,90,.08); }
    section { padding:22px; margin-top:18px; }
    .cards { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; margin:18px 0; }
    .card { padding:16px; }
    .card small { display:block; color:var(--muted); font-weight:700; }
    .card b { display:block; font-size:28px; margin-top:4px; }
    .note { border:1px solid #f5c77a; border-left:8px solid var(--orange); background:#fff8eb; border-radius:10px; padding:14px 16px; font-weight:700; }
    .narrative { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
    .narrative article { border:1px solid var(--line); background:var(--soft); border-radius:10px; padding:14px; }
    .narrative h3 { margin:0 0 6px; font-size:18px; color:var(--blue); }
    .narrative p { margin:0; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; background:#fff; min-width:980px; }
    .wide table { min-width:1660px; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:10px 12px; vertical-align:top; color:#031f3b; }
    th { background:#e7f2fb; text-align:left; white-space:nowrap; }
    tr:last-child td { border-bottom:0; }
    .level1 { color:var(--green); font-weight:800; }
    .level2 { color:var(--orange); font-weight:800; }
    .level3 { color:var(--red); font-weight:800; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .actions a { display:inline-flex; align-items:center; justify-content:center; min-height:42px; padding:9px 14px; border-radius:8px; background:var(--blue); color:#fff; text-decoration:none; font-weight:700; }
    .actions a.secondary { background:#fff; color:var(--blue); border:1px solid var(--line); }
    @media (max-width:900px) { .cards,.narrative { grid-template-columns:1fr; } main { padding:14px 10px 40px; } header,section { padding:18px; } }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>本日説明用 10社選出根拠</h1>
      <p class="lead">今日説明するための結論、選定方法、銘柄別根拠、確認条件を1枚にまとめた資料です。10社を同列に扱わず、説明可能性の強弱を分けています。</p>
    </header>

    <div class="cards">
      <div class="card"><small>本日選出</small><b>10社</b></div>
      <div class="card"><small>第1層</small><b>${presentationRows.filter((row) => row.selection_level === '第1層: 優先確認').length}社</b></div>
      <div class="card"><small>第2層</small><b>${presentationRows.filter((row) => row.selection_level === '第2層: 条件付き確認').length}社</b></div>
      <div class="card"><small>補完・検算</small><b>${presentationRows.filter((row) => !['第1層: 優先確認', '第2層: 条件付き確認'].includes(row.selection_level)).length}社</b></div>
    </div>

    <section>
      <h2>1. 本日の結論</h2>
      <div class="narrative">
        ${narrativeRows.map((row) => `<article><h3>${esc(row.section)}</h3><p>${esc(row.text)}</p></article>`).join('')}
      </div>
      <div class="note">本資料はNISA 1年保有テストの候補整理です。投資実行判断ではなく、6月イベント後の再判定に向けた説明資料です。</div>
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
      <h2>3. 10社選出表</h2>
      ${table([
        { key: 'rank', label: '順位' },
        { key: 'ticker', label: '銘柄' },
        { key: 'company', label: '会社名' },
        { key: 'selection_level', label: '層' },
        { key: 'presentation_decision', label: '本日の扱い' },
        { key: 'quantitative_score', label: '量的点' },
        { key: 'integrated_grade', label: '統合評価' },
        { key: 'theme_count', label: 'テーマ数' },
        { key: 'themes', label: '質的テーマ' },
        { key: 'concise_reason', label: '選出根拠' },
        { key: 'first_check', label: '最初に確認する数字' },
        { key: 'stop_rule', label: '外す条件' },
      ], presentationRows, 'wide')}
      <div class="actions">
        <a href="574_candidate_10_presentation_brief_summary.csv">要約CSV</a>
        <a href="575_candidate_10_presentation_brief_detail.csv">詳細CSV</a>
        <a href="576_candidate_10_presentation_narrative.csv">説明要旨CSV</a>
        <a class="secondary" href="qualitative_theme_stock_bridge_20260527.html">質的テーマ接続表へ戻る</a>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_presentation_brief_20260527.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  rows: presentationRows.length,
  firstLayer: presentationRows.filter((row) => row.selection_level === '第1層: 優先確認').length,
  secondLayer: presentationRows.filter((row) => row.selection_level === '第2層: 条件付き確認').length,
  output: 'candidate_10_presentation_brief_20260527.html',
}, null, 2));
