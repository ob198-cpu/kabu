import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE = 'source_winner_portfolio_260522.csv';
const EXTRACTED = '636_winner_portfolio_holdings_extracted.csv';
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
  return rows.filter((items) => items.some((item) => String(item).trim() !== ''));
}

function readNamedCsv(name) {
  const rows = parseCsv(fs.readFileSync(path.join(ROOT, name), 'utf8'));
  const headers = rows.shift() || [];
  return rows.map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] || ''])));
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

function asText(row, index) {
  return String(row[index - 1] ?? '').trim();
}

function parsePercent(value) {
  const text = String(value ?? '').trim().replace('%', '').replace('+', '').replace(',', '');
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function parseNumber(value) {
  const text = String(value ?? '').trim().replace('+', '').replace(',', '');
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

const knownNames = {
  '4689': 'LINEヤフー',
  '6058': 'ベクトル',
  '6594': 'ニデック',
  '6758': 'ソニーG',
  '8729': 'ソニーFG',
  '7956': 'ピジョン',
  '8035': '東京エレクトロン',
  '7735': 'SCREEN HD',
  '8919': 'カチタス',
  '9843': 'ニトリHD',
  '9983': 'ファーストリテイリング',
  '9984': 'ソフトバンクG',
  '6516': '山洋電気',
  '7203': 'トヨタ自動車',
  '7011': '三菱重工業',
  '5401': '日本製鉄',
  '5411': 'JFE HD',
  '8053': '住友商事',
  '3612': 'ワールド',
  '9022': 'JR東海',
  '9024': '西武HD',
  '9201': '日本航空',
  '9202': 'ANA HD',
  '7173': '東京きらぼしFG',
  '8316': '三井住友FG',
  '8306': '三菱UFJ FG',
  '3962': 'チェンジHD',
  '4373': 'シンプレクスHD',
  '1306': 'TOPIX連動型ETF',
  '1321': '日経225連動型ETF',
  '2080': 'PBR1倍割れ改善ETF',
  '2516': '東証グロース250 ETF',
};

function themeFor(ticker) {
  if (['8035', '7735', '9983', '9984', '6516', '6594'].includes(ticker)) return '半導体・AI・大型成長';
  if (['7011', '7012', '5401', '5411', '8053', '7203'].includes(ticker)) return '資本財・重工・景気循環';
  if (['7173', '8316', '8306', '8729'].includes(ticker)) return '金利・金融';
  if (['1306', '1321', '2080', '2516'].includes(ticker)) return '指数・ETF';
  if (['9022', '9024', '9201', '9202'].includes(ticker)) return 'リオープン・交通';
  if (['3962', '4373', '6058'].includes(ticker)) return '中小型・成長';
  return '個別テーマ';
}

function roleFor(row) {
  const weight = parsePercent(row.portfolio_weight_pct) ?? 0;
  const ret = parsePercent(row.source_return_pct) ?? 0;
  const contribution = parseNumber(row.estimated_total_contribution) ?? 0;
  if (themeFor(row.ticker) === '指数・ETF') return '市場ベータの土台';
  if (weight >= 5 && contribution > 500) return '収益けん引枠';
  if (ret >= 100) return '上昇寄与枠';
  if (ret < 0) return '検証・見直し枠';
  return '分散補助枠';
}

function extractHoldingsFromSource() {
  const raw = parseCsv(fs.readFileSync(path.join(ROOT, SOURCE), 'utf8'));
  const extracted = [];
  for (let i = 0; i < raw.length; i += 1) {
    const row = raw[i];
    const ticker = asText(row, 3);
    if (!/^\d{4}$/.test(ticker)) continue;
    const sourceName = asText(row, 4);
    const currentPrice = parseNumber(asText(row, 7));
    const referencePrice = parseNumber(asText(row, 8));
    const computedReturn = currentPrice && referencePrice
      ? Math.round(((currentPrice / referencePrice) - 1) * 1000) / 10
      : null;
    extracted.push({
      generated_at: generatedAt,
      source_row: i + 1,
      ticker,
      company: knownNames[ticker] || sourceName || '名称未確認',
      source_name_raw: sourceName,
      theme: themeFor(ticker),
      role: '',
      portfolio_weight_pct: asText(row, 5),
      source_return_pct: asText(row, 6),
      computed_return_pct: computedReturn ?? '',
      current_price_or_value: asText(row, 7),
      reference_price_or_value: asText(row, 8),
      estimated_units: asText(row, 14),
      estimated_cost_value_man_yen: asText(row, 15),
      estimated_market_value_man_yen: asText(row, 16),
      estimated_unrealized_pnl_man_yen: asText(row, 17),
      actual_weight_pct: asText(row, 19),
      estimated_income_or_metric: asText(row, 22),
      estimated_risk_adjustment: asText(row, 23),
      estimated_total_contribution: asText(row, 24),
      source_action_memo_raw: asText(row, 26),
    });
  }
  return extracted;
}

const holdings = fs.existsSync(path.join(ROOT, SOURCE))
  ? extractHoldingsFromSource()
  : readNamedCsv(EXTRACTED);

holdings.forEach((row) => {
  row.generated_at = generatedAt;
  row.company = knownNames[row.ticker] || row.company || row.source_name_raw || '名称未確認';
  row.theme = row.theme || themeFor(row.ticker);
  row.role = roleFor(row);
});

const topContributors = [...holdings]
  .filter((row) => parseNumber(row.estimated_total_contribution) !== null)
  .sort((a, b) => (parseNumber(b.estimated_total_contribution) ?? 0) - (parseNumber(a.estimated_total_contribution) ?? 0))
  .slice(0, 12);

const themeRows = [...new Set(holdings.map((row) => row.theme))].map((theme) => {
  const items = holdings.filter((row) => row.theme === theme);
  const avgReturn = items.reduce((sum, row) => sum + (parsePercent(row.source_return_pct) ?? 0), 0) / items.length;
  const weight = items.reduce((sum, row) => sum + (parsePercent(row.portfolio_weight_pct) ?? 0), 0);
  const contribution = items.reduce((sum, row) => sum + (parseNumber(row.estimated_total_contribution) ?? 0), 0);
  return {
    generated_at: generatedAt,
    theme,
    count: items.length,
    tickers: items.map((row) => `${row.ticker} ${row.company}`).join(' / '),
    total_weight_pct: Math.round(weight * 10) / 10,
    average_return_pct: Math.round(avgReturn * 10) / 10,
    estimated_total_contribution: Math.round(contribution * 10) / 10,
    system_use: theme === '指数・ETF'
      ? '個別株が指数+1%を超える必要があるか確認する基準枠として使う。'
      : '候補銘柄の質的テーマが実際の勝ち筋と近いか確認する参照枠として使う。',
  };
}).sort((a, b) => Number(b.estimated_total_contribution) - Number(a.estimated_total_contribution));

const currentCandidates = readNamedCsv('630_candidate_selection_explanation_table.csv');
const holdingMap = new Map(holdings.map((row) => [`${row.ticker}.T`, row]));
const themeSet = new Map(holdings.map((row) => [row.theme, row]));

function candidateThemeBridge(candidate) {
  const exact = holdingMap.get(candidate.ticker);
  if (exact) {
    return {
      connection: '直接一致',
      reference_ticker: `${exact.ticker} ${exact.company}`,
      reference_theme: exact.theme,
      reference_return_pct: exact.source_return_pct,
      reference_role: exact.role,
      system_action: '勝者ポートフォリオ内での役割と、現在候補としての量的/質的根拠を照合する。',
    };
  }
  let theme = '未接続';
  if (candidate.qualitative_theme.includes('半導体') || candidate.sector.includes('電子') || candidate.sector.includes('半導体')) theme = '半導体・AI・大型成長';
  else if (candidate.sector.includes('銀行') || candidate.qualitative_theme.includes('金利')) theme = '金利・金融';
  else if (candidate.sector.includes('重工')) theme = '資本財・重工・景気循環';
  else if (candidate.sector.includes('投資')) theme = '半導体・AI・大型成長';
  else if (candidate.sector.includes('食品')) theme = '未接続';
  const reference = themeSet.get(theme);
  return {
    connection: reference ? 'テーマ近似' : '未接続',
    reference_ticker: reference ? `${reference.ticker} ${reference.company}` : '',
    reference_theme: theme,
    reference_return_pct: reference?.source_return_pct || '',
    reference_role: reference?.role || '',
    system_action: reference
      ? '同じテーマの勝者例として参照。ただし現在候補は別銘柄なので、決算・PER・反応で別途確認する。'
      : '勝者ポートフォリオとの接続は弱い。既存の量的スコアと6月再判定を優先する。',
  };
}

const bridgeRows = currentCandidates.map((candidate) => {
  const bridge = candidateThemeBridge(candidate);
  return {
    generated_at: generatedAt,
    ticker: candidate.ticker,
    company: candidate.company,
    current_class: candidate.test_priority_class,
    quant_score: candidate.quant_score,
    qualitative_score: candidate.qualitative_score,
    connection: bridge.connection,
    reference_ticker: bridge.reference_ticker,
    reference_theme: bridge.reference_theme,
    reference_return_pct: bridge.reference_return_pct,
    reference_role: bridge.reference_role,
    system_action: bridge.system_action,
    caution: '参照ポートフォリオは将来リターンの保証ではない。勝ち筋の構造確認と候補比較の補助に限定する。',
  };
});

const improvementRows = [
  {
    item: '勝者ポートフォリオ参照ゲート',
    current_issue: '候補の良し悪しを単独スコアで見ており、実際に勝った構成との比較が弱い。',
    improvement: '過去の高寄与銘柄、テーマ、役割を参照し、候補が同じ勝ち筋に乗っているかを確認する。',
    use_rule: '直接一致は強い参照、テーマ近似は補助、未接続は量的スコアを優先。',
  },
  {
    item: '集中寄与リスクの確認',
    current_issue: 'ポートフォリオ全体の成績が一部銘柄に偏っている可能性を見落とす。',
    improvement: '評価額・含み益・寄与額の上位を抽出し、どのテーマが利益を作ったかを見る。',
    use_rule: '高寄与テーマは候補選定の仮説に使うが、PER・決算反応・下落耐性で再確認する。',
  },
  {
    item: 'ETF/指数との比較',
    current_issue: '個別株を選ぶ意味が、指数との比較に接続しきれていない。',
    improvement: '1306、1321など指数系を基準枠として扱い、個別候補が指数+1%目標に必要かを確認する。',
    use_rule: '個別株候補が明確に上回る見込みを示せない場合、個別株比率を下げる判断材料にする。',
  },
  {
    item: '銘柄名欠損への対応',
    current_issue: '添付CSVは日本語見出し・一部銘柄名が文字化けしている。',
    improvement: '銘柄コードと数値を主キーにし、銘柄名は既知コード表または外部公式データで補完する。',
    use_rule: '名称が壊れていても、銘柄コード・比率・騰落率・評価額系数値は計算に使える。',
  },
];

const summaryRows = [
  {
    generated_at: generatedAt,
    item: '読み取り結果',
    detail: `添付CSVから銘柄コード付きの保有行${holdings.length}件を抽出した。日本語見出しと一部銘柄名は元データ側で文字化けしているため、数値と銘柄コードを主に使用する。`,
  },
  {
    generated_at: generatedAt,
    item: '活用方法',
    detail: '勝者ポートフォリオを、銘柄選定の正解としてではなく、勝ち筋・寄与集中・テーマ構造を確認する参照データとして使う。',
  },
  {
    generated_at: generatedAt,
    item: '既存システムへの改善',
    detail: '候補銘柄に対して、直接一致、テーマ近似、未接続を判定し、NISA 1年保有テストの説明力を高める。',
  },
];

writeCsv('635_winner_portfolio_summary.csv', summaryRows, ['generated_at', 'item', 'detail']);
writeCsv('636_winner_portfolio_holdings_extracted.csv', holdings, [
  'generated_at',
  'source_row',
  'ticker',
  'company',
  'source_name_raw',
  'theme',
  'role',
  'portfolio_weight_pct',
  'source_return_pct',
  'computed_return_pct',
  'current_price_or_value',
  'reference_price_or_value',
  'estimated_units',
  'estimated_cost_value_man_yen',
  'estimated_market_value_man_yen',
  'estimated_unrealized_pnl_man_yen',
  'actual_weight_pct',
  'estimated_income_or_metric',
  'estimated_risk_adjustment',
  'estimated_total_contribution',
  'source_action_memo_raw',
]);
writeCsv('637_winner_portfolio_theme_summary.csv', themeRows, [
  'generated_at',
  'theme',
  'count',
  'tickers',
  'total_weight_pct',
  'average_return_pct',
  'estimated_total_contribution',
  'system_use',
]);
writeCsv('638_winner_portfolio_candidate_bridge.csv', bridgeRows, [
  'generated_at',
  'ticker',
  'company',
  'current_class',
  'quant_score',
  'qualitative_score',
  'connection',
  'reference_ticker',
  'reference_theme',
  'reference_return_pct',
  'reference_role',
  'system_action',
  'caution',
]);
writeCsv('639_winner_portfolio_system_improvements.csv', improvementRows, ['item', 'current_issue', 'improvement', 'use_rule']);

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>勝者ポートフォリオ参照システム 2026年5月27日</title>
  <style>
    :root { --ink:#061e38; --line:#cbdff0; --blue:#0b5e94; --bg:#f4f8fb; --orange:#b45309; --green:#126b45; --red:#a82424; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; line-height:1.65; }
    main { max-width:1400px; margin:0 auto; padding:24px 18px 48px; }
    header { background:#082f53; color:#fff; border-radius:14px; padding:26px; margin-bottom:16px; }
    h1 { margin:0 0 8px; font-size:clamp(26px,4vw,40px); line-height:1.2; }
    h2 { margin:0 0 10px; font-size:22px; border-left:7px solid var(--blue); padding-left:12px; }
    .lead { margin:0; max-width:1100px; color:#edf7ff; font-weight:700; }
    section { background:#fff; border:1px solid var(--line); border-radius:12px; box-shadow:0 8px 20px rgba(20,60,90,.08); padding:18px; margin-top:14px; break-inside:avoid; page-break-inside:avoid; }
    .cards { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .card { border:1px solid var(--line); border-radius:10px; padding:14px; background:#f8fbfe; }
    .card b { display:block; font-size:28px; color:var(--blue); }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; background:#fff; min-width:980px; }
    .wide table { min-width:2200px; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:9px 11px; vertical-align:top; color:#031f3b; }
    th { background:#e7f2fb; text-align:left; white-space:nowrap; }
    tr:last-child td { border-bottom:0; }
    .note { border:1px solid #f5c77a; border-left:8px solid var(--orange); background:#fff8eb; border-radius:10px; padding:12px 14px; font-weight:700; margin-top:12px; }
    .actions { display:flex; flex-wrap:wrap; gap:10px; margin-top:14px; }
    .actions a { display:inline-flex; align-items:center; justify-content:center; min-height:42px; padding:9px 14px; border-radius:8px; background:var(--blue); color:#fff; text-decoration:none; font-weight:700; }
    @media (max-width:900px) { main { padding:12px 10px 36px; } header,section { padding:16px; } .cards { grid-template-columns:1fr; } }
    @media print {
      body { background:#fff; }
      main { max-width:none; padding:10mm; }
      section { box-shadow:none; }
      .table-wrap { overflow:visible; }
      table { min-width:0; font-size:10px; }
      .wide table { min-width:0; }
      th,td { padding:5px 6px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>勝者ポートフォリオ参照システム</h1>
      <p class="lead">添付CSVの数値部分を抽出し、既存のNISA候補選定へ接続する資料です。勝者ポートフォリオを正解として扱うのではなく、勝ち筋・寄与集中・テーマ構造を確認する参照データとして使います。</p>
    </header>

    <section>
      <h2>1. 読み取り結果</h2>
      ${table([
        { key: 'item', label: '項目' },
        { key: 'detail', label: '内容' },
      ], summaryRows)}
      <div class="note">添付CSVは日本語見出しと一部銘柄名が文字化けしています。銘柄コード、比率、騰落率、価格、評価額系数値を中心に利用します。</div>
    </section>

    <section>
      <h2>2. 数値サマリー</h2>
      <div class="cards">
        <div class="card"><b>${holdings.length}</b><span>抽出保有行</span></div>
        <div class="card"><b>${themeRows.length}</b><span>テーマ分類</span></div>
        <div class="card"><b>${topContributors[0]?.ticker || '-'}</b><span>最大寄与銘柄</span></div>
        <div class="card"><b>${bridgeRows.filter((row) => row.connection !== '未接続').length}</b><span>候補との接続件数</span></div>
      </div>
    </section>

    <section>
      <h2>3. 既存システムへの改善点</h2>
      ${table([
        { key: 'item', label: '改善項目' },
        { key: 'current_issue', label: '現状の弱点' },
        { key: 'improvement', label: '改善内容' },
        { key: 'use_rule', label: '使い方' },
      ], improvementRows, 'wide')}
    </section>

    <section>
      <h2>4. テーマ別の勝ち筋</h2>
      ${table([
        { key: 'theme', label: 'テーマ' },
        { key: 'count', label: '件数' },
        { key: 'total_weight_pct', label: '資料上比率合計' },
        { key: 'average_return_pct', label: '平均騰落率' },
        { key: 'estimated_total_contribution', label: '推定寄与合計' },
        { key: 'tickers', label: '銘柄' },
        { key: 'system_use', label: 'システムでの使い方' },
      ], themeRows, 'wide')}
    </section>

    <section>
      <h2>5. 現候補との接続</h2>
      ${table([
        { key: 'ticker', label: '候補銘柄' },
        { key: 'company', label: '会社名' },
        { key: 'current_class', label: '現在分類' },
        { key: 'quant_score', label: '量的' },
        { key: 'qualitative_score', label: '質的' },
        { key: 'connection', label: '接続' },
        { key: 'reference_ticker', label: '参照銘柄' },
        { key: 'reference_theme', label: '参照テーマ' },
        { key: 'reference_return_pct', label: '参照騰落率' },
        { key: 'reference_role', label: '参照役割' },
        { key: 'system_action', label: '反映方法' },
        { key: 'caution', label: '注意' },
      ], bridgeRows, 'wide')}
    </section>

    <section>
      <h2>6. 抽出保有行</h2>
      ${table([
        { key: 'ticker', label: '銘柄' },
        { key: 'company', label: '会社名補完' },
        { key: 'theme', label: 'テーマ' },
        { key: 'role', label: '役割' },
        { key: 'portfolio_weight_pct', label: '資料上比率' },
        { key: 'source_return_pct', label: '資料上騰落率' },
        { key: 'computed_return_pct', label: '価格から再計算' },
        { key: 'current_price_or_value', label: '現在値系' },
        { key: 'reference_price_or_value', label: '基準値系' },
        { key: 'estimated_units', label: '推定口数' },
        { key: 'estimated_cost_value_man_yen', label: '推定取得額' },
        { key: 'estimated_market_value_man_yen', label: '推定評価額' },
        { key: 'estimated_unrealized_pnl_man_yen', label: '推定損益' },
        { key: 'estimated_total_contribution', label: '推定総寄与' },
      ], holdings, 'wide')}
      <div class="actions">
        <a href="635_winner_portfolio_summary.csv">要約CSV</a>
        <a href="636_winner_portfolio_holdings_extracted.csv">抽出CSV</a>
        <a href="637_winner_portfolio_theme_summary.csv">テーマCSV</a>
        <a href="638_winner_portfolio_candidate_bridge.csv">候補接続CSV</a>
        <a href="639_winner_portfolio_system_improvements.csv">改善CSV</a>
      </div>
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'winner_portfolio_reference_system_20260527.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  holdings: holdings.length,
  themes: themeRows.length,
  bridgeRows: bridgeRows.length,
  output: 'winner_portfolio_reference_system_20260527.html',
}, null, 2));
