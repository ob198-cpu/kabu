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

function byTicker(rows) {
  return new Map(rows.map((row) => [row.ticker, row]));
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

function layer(row) {
  if (row.integrated_role === '6月優先確認') return '第1層: 優先確認';
  if (row.integrated_role === '条件付き確認') return '第2層: 条件付き確認';
  if (row.integrated_role === '補完待ち') return '第3層: データ補完';
  if (row.integrated_role === '検算枠') return '第4層: 仮説検算';
  return '比較・観察';
}

function whyIncluded(row) {
  if (row.integrated_role === '6月優先確認') {
    return '量的評価と質的評価がともにA。現時点では最優先で確認する検証対象。';
  }
  if (row.integrated_role === '条件付き確認') {
    return '量的または質的評価がB。公式数字と20営業日反応を確認すれば、6月テスト候補として比較できる。';
  }
  if (row.integrated_role === '補完待ち') {
    return '材料はあるが、PER/PBR/ROEや公式値などの不足データを埋める必要がある。';
  }
  if (row.integrated_role === '検算枠') {
    return '構造テーマは強いが、直近の株価反応が弱いため、仮説が価格に表れているかを検算する。';
  }
  return '時流テーマや比較対象として残し、優先候補との差を確認する。';
}

function purchaseCaution(row) {
  if (row.integrated_grade === 'A') {
    return '6月イベント前の実行判断はしない。市場条件と20営業日反応を確認してから扱いを決める。';
  }
  if (row.integrated_grade === 'B') {
    return '条件付き確認。現段階で主候補化せず、追加データ確認後に再判定する。';
  }
  return '統合Cまたは保留。現時点では購入検討の中心に置かず、補完・検算・比較対象として扱う。';
}

const integratedRows = readCsv('563_dual_axis_integrated_selection_detail.csv');
const clientRowsByTicker = byTicker(readCsv('540_candidate_10_client_explanation_detail.csv'));

const detailRows = integratedRows.map((row) => {
  const client = clientRowsByTicker.get(row.ticker) || {};
  return {
    updated_at: generatedAt,
    rank: row.rank,
    ticker: row.ticker,
    company: row.company,
    test_layer: layer(row),
    integrated_grade: row.integrated_grade,
    integrated_role: row.integrated_role,
    quantitative_score: row.quantitative_score,
    qualitative_driver: row.qualitative_driver,
    why_included: whyIncluded(row),
    purchase_caution: purchaseCaution(row),
    next_action: row.next_condition,
    june_check: client.confirmation || '6月イベント後に市場条件、決算反応、指数比較を確認。',
    treatment: 'NISA 1年保有テストの検証対象整理。投資実行判断ではない。',
  };
});

const namesByRole = (role) => detailRows
  .filter((row) => row.integrated_role === role)
  .map((row) => row.company)
  .join('、') || '該当なし';

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '検証対象',
    value: `${detailRows.length}社`,
    meaning: '購入候補の確定ではなく、6月イベント後に再判定するための確認対象。',
  },
  {
    updated_at: generatedAt,
    item: '第1層',
    value: namesByRole('6月優先確認'),
    meaning: '量的評価と質的評価の両方が比較的強い。最優先で追加確認する。',
  },
  {
    updated_at: generatedAt,
    item: '第2層',
    value: namesByRole('条件付き確認'),
    meaning: '条件を満たせば候補に進めるが、現時点では追加確認が必要。',
  },
  {
    updated_at: generatedAt,
    item: '第3・第4層',
    value: `${detailRows.filter((row) => ['補完待ち', '検算枠', '観察・比較'].includes(row.integrated_role)).length}社`,
    meaning: '補完、検算、比較対象。現時点では中心候補に置かない。',
  },
];

const nextTaskRows = [
  {
    priority: '1',
    task: '第1層・第2層の公式数字確認',
    reason: 'A/B候補を6月テスト候補として説明できる状態にするため。',
    output: '確認済み数値、出典、基準日、未取得理由',
  },
  {
    priority: '2',
    task: '20営業日反応と指数比較の更新',
    reason: '決算後の好材料が実際の株価反応につながったかを見るため。',
    output: '1日/5日/20営業日、対日経平均、対TOPIX',
  },
  {
    priority: '3',
    task: '第3・第4層の補完・検算',
    reason: '材料だけで上げず、弱い理由が解消できるか確認するため。',
    output: '補完後の再判定、比較対象継続または除外',
  },
];

writeCsv('565_candidate_10_current_test_set_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'meaning',
]);

writeCsv('566_candidate_10_current_test_set_detail.csv', detailRows, [
  'updated_at',
  'rank',
  'ticker',
  'company',
  'test_layer',
  'integrated_grade',
  'integrated_role',
  'quantitative_score',
  'qualitative_driver',
  'why_included',
  'purchase_caution',
  'next_action',
  'june_check',
  'treatment',
]);

writeCsv('567_candidate_10_current_test_set_next_tasks.csv', nextTaskRows, [
  'priority',
  'task',
  'reason',
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
  <title>NISA 1年保有テスト 検証対象10社 2026年5月27日</title>
  <style>
    :root { --ink:#071f3a; --muted:#334155; --line:#cbdff0; --blue:#0b5e94; --bg:#f4f8fb; --soft:#eef7ff; --orange:#b45309; }
    * { box-sizing: border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; line-height:1.75; }
    main { max-width:1180px; margin:0 auto; padding:28px 18px 56px; }
    header { background:#0a426b; color:#fff; border-radius:14px; padding:28px; margin-bottom:18px; }
    h1 { margin:0 0 10px; font-size:clamp(26px,4vw,42px); line-height:1.2; }
    h2 { margin:0 0 12px; font-size:24px; border-left:7px solid var(--blue); padding-left:12px; }
    .lead { margin:0; max-width:920px; color:#edf7ff; font-weight:700; }
    section, .card { background:#fff; border:1px solid var(--line); border-radius:12px; box-shadow:0 10px 22px rgba(20,60,90,.08); }
    section { padding:22px; margin-top:18px; }
    .cards { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:14px; margin:18px 0; }
    .card { padding:16px; }
    .card small { display:block; color:var(--muted); font-weight:700; }
    .card b { display:block; font-size:28px; margin-top:4px; }
    .note { border:1px solid #f5c77a; border-left:8px solid var(--orange); background:#fff8eb; border-radius:10px; padding:14px 16px; font-weight:700; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; background:#fff; min-width:980px; }
    .wide table { min-width:1400px; }
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
      <h1>NISA 1年保有テスト 検証対象10社</h1>
      <p class="lead">100社前後の母集団から進んだ候補について、量的評価と質的評価を分けて確認し、6月イベント後に再判定するための10社一覧です。</p>
    </header>

    <div class="cards">
      <div class="card"><small>検証対象</small><b>${detailRows.length}社</b></div>
      <div class="card"><small>第1層</small><b>${detailRows.filter((row) => row.integrated_role === '6月優先確認').length}社</b></div>
      <div class="card"><small>第2層</small><b>${detailRows.filter((row) => row.integrated_role === '条件付き確認').length}社</b></div>
      <div class="card"><small>補完・検算・比較</small><b>${detailRows.filter((row) => !['6月優先確認', '条件付き確認'].includes(row.integrated_role)).length}社</b></div>
    </div>

    <section>
      <h2>1. 位置づけ</h2>
      <p>この10社は、6月の市場イベント後に候補を絞るための検証対象です。全社を購入検討の中心に置くという意味ではありません。第1層と第2層を優先確認し、第3層以降は不足データの補完または仮説検算として扱います。</p>
      <div class="note">質的材料は点数に足さず、統合評価の上限、通過条件、除外条件として使います。</div>
    </section>

    <section>
      <h2>2. 要約</h2>
      ${table([
        { key: 'item', label: '項目' },
        { key: 'value', label: '結果' },
        { key: 'meaning', label: '意味' },
      ], summaryRows)}
    </section>

    <section>
      <h2>3. 検証対象10社</h2>
      ${table([
        { key: 'rank', label: '順位' },
        { key: 'ticker', label: '銘柄' },
        { key: 'company', label: '会社名' },
        { key: 'test_layer', label: '検証層' },
        { key: 'integrated_grade', label: '統合評価' },
        { key: 'quantitative_score', label: '量的点' },
        { key: 'qualitative_driver', label: '質的材料' },
        { key: 'why_included', label: '残している理由' },
        { key: 'purchase_caution', label: '現時点の扱い' },
        { key: 'next_action', label: '次に確認すること' },
      ], detailRows, 'wide')}
    </section>

    <section>
      <h2>4. 次工程</h2>
      ${table([
        { key: 'priority', label: '優先' },
        { key: 'task', label: '作業' },
        { key: 'reason', label: '目的' },
        { key: 'output', label: '出力' },
      ], nextTaskRows)}
      <div class="actions">
        <a href="565_candidate_10_current_test_set_summary.csv">要約CSV</a>
        <a href="566_candidate_10_current_test_set_detail.csv">詳細CSV</a>
        <a href="567_candidate_10_current_test_set_next_tasks.csv">次工程CSV</a>
        <a class="secondary" href="dual_axis_integrated_selection_20260527.html">統合候補判定へ戻る</a>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_current_test_set_20260527.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  rows: detailRows.length,
  priority: detailRows.filter((row) => row.integrated_role === '6月優先確認').length,
  conditional: detailRows.filter((row) => row.integrated_role === '条件付き確認').length,
}, null, 2));
