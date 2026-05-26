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

function byKey(rows, key) {
  return new Map(rows.map((row) => [row[key], row]));
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

const themeRows = readCsv('569_qualitative_idea_map_detail.csv');
const themeByName = byKey(themeRows, 'theme');
const candidateRows = readCsv('566_candidate_10_current_test_set_detail.csv');

const bridgeSeed = [
  {
    ticker: '6762.T',
    themes: ['HBM・先端パッケージ', 'AI半導体投資', '円安'],
    connection: 'AIサーバー、HDD/電源周辺部材、電子部品需要に接続。量的評価と質的評価がともにA。',
    priority: '第1層',
  },
  {
    ticker: '8316.T',
    themes: ['金利上昇', '自社株買い・増配・資本効率'],
    connection: '日銀政策、利ざや、株主還元に接続。信用コストと金利方向の確認が必要。',
    priority: '第2層',
  },
  {
    ticker: '2802.T',
    themes: ['食品値上げ耐性', '円高', '原油・ナフサ下落'],
    connection: '値上げ耐性、原材料、ABF/ヘルスケアに接続。PERの高さを成長率で説明できるか確認。',
    priority: '第2層',
  },
  {
    ticker: '5020.T',
    themes: ['原油・中東リスク', '原油・ナフサ下落'],
    connection: '油価、精製マージン、在庫影響に接続。1年保有適性は油価循環の検証が必要。',
    priority: '比較・観察',
  },
  {
    ticker: '6367.T',
    themes: ['データセンター冷却', '円安'],
    connection: 'AIデータセンター冷却テーマに接続。ただし寄与が全社数字に出ているか確認が必要。',
    priority: '比較・観察',
  },
  {
    ticker: '6503.T',
    themes: ['データセンター電力不足', 'データセンター冷却', '防衛・安全保障', '人手不足・省人化'],
    connection: '電力、FA、防衛、インフラに接続。テーマが広いため事業別数字の確認が必要。',
    priority: '比較・観察',
  },
  {
    ticker: '8766.T',
    themes: ['金利上昇', '自社株買い・増配・資本効率'],
    connection: '金利、保険料率、政策保有株売却に接続。自然災害損害率と保険引受利益を確認。',
    priority: '第2層',
  },
  {
    ticker: '4385.T',
    themes: ['人手不足・省人化', '国内消費・プラットフォーム'],
    connection: '国内消費、FinTech、広告に接続。ただし公式値とPER比較の補完が先。',
    priority: '補完待ち',
  },
  {
    ticker: '8306.T',
    themes: ['金利上昇', '自社株買い・増配・資本効率'],
    connection: '日銀政策、資金利益、還元に接続。PER/PBR/ROEと信用コストの確認が必要。',
    priority: '補完待ち',
  },
  {
    ticker: '6146.T',
    themes: ['AI半導体投資', '半導体工程の寡占・高シェア', 'HBM・先端パッケージ'],
    connection: '半導体加工工程の構造テーマに接続。ただし直近反応が弱いため仮説検算を優先。',
    priority: '検算枠',
  },
];

function themeDetail(themeName) {
  return themeByName.get(themeName) || {
    hypothesis_layer: '未登録',
    evidence_layer: '未登録',
    required_numbers: 'テーマ定義を追加する',
    reject_condition: 'テーマ定義を追加する',
    scoring_use: '未登録テーマ。採点に使わない。',
  };
}

function candidate(ticker) {
  return candidateRows.find((row) => row.ticker === ticker) || {};
}

function gateFromLayers(stock, theme) {
  const grade = stock.integrated_grade || '保留';
  if (grade === 'A' && ['S', 'A'].includes(theme.hypothesis_layer)) return '優先確認';
  if (grade === 'B') return '条件付き確認';
  if (grade === 'C') return '仮説検算';
  return '補完待ち';
}

function gateReason(gate) {
  if (gate === '優先確認') return '量的評価と質的仮説がそろっているため、確認数字を優先して取りに行く。';
  if (gate === '条件付き確認') return 'テーマはあるが、量的評価または実績層が不足しているため条件確認が必要。';
  if (gate === '仮説検算') return 'テーマはあるが、価格反応または量的評価が弱いため、仮説が市場に反映されているか検算する。';
  return '不足データを補完するまで候補上位には置かない。';
}

const detailRows = bridgeSeed.flatMap((seed) => {
  const stock = candidate(seed.ticker);
  return seed.themes.map((themeName) => {
    const theme = themeDetail(themeName);
    const gate = gateFromLayers(stock, theme);
    return {
      updated_at: generatedAt,
      ticker: seed.ticker,
      company: stock.company || '',
      test_layer: stock.test_layer || seed.priority,
      integrated_grade: stock.integrated_grade || '',
      theme: themeName,
      hypothesis_layer: theme.hypothesis_layer,
      evidence_layer: theme.evidence_layer,
      connection: seed.connection,
      required_numbers: theme.required_numbers,
      reject_condition: theme.reject_condition,
      qualitative_gate: gate,
      gate_reason: gateReason(gate),
      scoring_use: theme.scoring_use,
      treatment: '質的テーマ接続。量的スコアへ単純加点しない。',
    };
  });
});

const stockSummaryRows = bridgeSeed.map((seed) => {
  const stock = candidate(seed.ticker);
  const matched = detailRows.filter((row) => row.ticker === seed.ticker);
  const gates = matched.map((row) => row.qualitative_gate);
  const hasPriority = gates.includes('優先確認');
  const hasConditional = gates.includes('条件付き確認');
  return {
    updated_at: generatedAt,
    ticker: seed.ticker,
    company: stock.company || '',
    integrated_grade: stock.integrated_grade || '',
    matched_theme_count: matched.length,
    themes: matched.map((row) => row.theme).join(' / '),
    highest_theme_gate: hasPriority ? '優先確認' : hasConditional ? '条件付き確認' : gates[0] || '補完待ち',
    next_action: stock.next_action || '',
    treatment: stock.purchase_caution || '投資実行判断ではない。',
  };
});

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '接続済み銘柄',
    value: `${stockSummaryRows.length}社`,
    meaning: 'NISA検証対象10社に質的テーマを接続。',
  },
  {
    updated_at: generatedAt,
    item: 'テーマ接続数',
    value: `${detailRows.length}件`,
    meaning: '1銘柄に複数テーマを接続し、確認数字と否定条件を持たせた。',
  },
  {
    updated_at: generatedAt,
    item: '優先確認',
    value: detailRows.filter((row) => row.qualitative_gate === '優先確認').map((row) => `${row.company}:${row.theme}`).join(' / ') || '該当なし',
    meaning: '質的テーマとして前に置けるが、量的データ確認後に再判定する。',
  },
  {
    updated_at: generatedAt,
    item: '運用上の扱い',
    value: '非加点',
    meaning: 'テーマ接続は候補抽出と確認条件に使い、総合点へ直接足さない。',
  },
];

writeCsv('571_qualitative_theme_stock_bridge_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'meaning',
]);

writeCsv('572_qualitative_theme_stock_bridge_detail.csv', detailRows, [
  'updated_at',
  'ticker',
  'company',
  'test_layer',
  'integrated_grade',
  'theme',
  'hypothesis_layer',
  'evidence_layer',
  'connection',
  'required_numbers',
  'reject_condition',
  'qualitative_gate',
  'gate_reason',
  'scoring_use',
  'treatment',
]);

writeCsv('573_qualitative_theme_stock_bridge_by_stock.csv', stockSummaryRows, [
  'updated_at',
  'ticker',
  'company',
  'integrated_grade',
  'matched_theme_count',
  'themes',
  'highest_theme_gate',
  'next_action',
  'treatment',
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
  <title>質的テーマ×銘柄 接続表 2026年5月27日</title>
  <style>
    :root { --ink:#071f3a; --muted:#334155; --line:#cbdff0; --blue:#0b5e94; --bg:#f4f8fb; --soft:#eef7ff; --orange:#b45309; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; line-height:1.75; }
    main { max-width:1220px; margin:0 auto; padding:28px 18px 56px; }
    header { background:#0a426b; color:#fff; border-radius:14px; padding:28px; margin-bottom:18px; }
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
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; background:#fff; min-width:980px; }
    .wide table { min-width:1720px; }
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
      <h1>質的テーマ×銘柄 接続表</h1>
      <p class="lead">質的アイデア地図を、NISA検証対象10社へ接続した表です。テーマを点数に足さず、確認すべき数字と否定条件を銘柄別に持たせます。</p>
    </header>

    <div class="cards">
      <div class="card"><small>接続済み銘柄</small><b>${stockSummaryRows.length}社</b></div>
      <div class="card"><small>テーマ接続</small><b>${detailRows.length}件</b></div>
      <div class="card"><small>優先確認テーマ</small><b>${detailRows.filter((row) => row.qualitative_gate === '優先確認').length}件</b></div>
      <div class="card"><small>扱い</small><b>非加点</b></div>
    </div>

    <section>
      <h2>1. 目的</h2>
      <p>「半導体工程で高シェアなら恩恵を受ける可能性がある」といった質的アイデアを、銘柄ごとの確認作業へ落とし込みます。これにより、時流の見立てを候補抽出に使いながら、売上・受注・利益率・株価反応で検証する流れに接続します。</p>
      <div class="note">この表は銘柄選択の補助資料です。テーマ該当だけで購入候補に上げず、量的評価と6月イベント後の再判定を通します。</div>
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
      <h2>3. 銘柄別テーマ接続</h2>
      ${table([
        { key: 'ticker', label: '銘柄' },
        { key: 'company', label: '会社名' },
        { key: 'integrated_grade', label: '統合評価' },
        { key: 'matched_theme_count', label: '接続テーマ数' },
        { key: 'themes', label: '接続テーマ' },
        { key: 'highest_theme_gate', label: '質的ゲート' },
        { key: 'next_action', label: '次に確認すること' },
        { key: 'treatment', label: '現時点の扱い' },
      ], stockSummaryRows, 'wide')}
    </section>

    <section>
      <h2>4. テーマ接続明細</h2>
      ${table([
        { key: 'ticker', label: '銘柄' },
        { key: 'company', label: '会社名' },
        { key: 'theme', label: 'テーマ' },
        { key: 'hypothesis_layer', label: '仮説層' },
        { key: 'evidence_layer', label: '実績層' },
        { key: 'connection', label: '接続理由' },
        { key: 'required_numbers', label: '確認する数字' },
        { key: 'reject_condition', label: '否定条件' },
        { key: 'qualitative_gate', label: '質的ゲート' },
        { key: 'gate_reason', label: '判定理由' },
      ], detailRows, 'wide')}
      <div class="actions">
        <a href="571_qualitative_theme_stock_bridge_summary.csv">要約CSV</a>
        <a href="572_qualitative_theme_stock_bridge_detail.csv">明細CSV</a>
        <a href="573_qualitative_theme_stock_bridge_by_stock.csv">銘柄別CSV</a>
        <a class="secondary" href="qualitative_idea_map_20260527.html">質的アイデア地図へ戻る</a>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'qualitative_theme_stock_bridge_20260527.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  stocks: stockSummaryRows.length,
  links: detailRows.length,
  output: 'qualitative_theme_stock_bridge_20260527.html',
}, null, 2));
