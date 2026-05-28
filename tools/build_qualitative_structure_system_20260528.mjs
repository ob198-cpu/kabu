import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const generatedAt = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
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
  if (cell.length || row.length) row.push(cell.replace(/\r$/, ''));
  const headers = rows.shift() || [];
  return rows
    .filter((items) => items.some((item) => String(item).trim() !== ''))
    .map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] || ''])));
}

function readCsv(name) {
  return parseCsv(fs.readFileSync(path.join(ROOT, name), 'utf8'));
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(name, rows, headers) {
  const body = [headers.map(csvEscape).join(',')]
    .concat(rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')))
    .join('\n');
  fs.writeFileSync(path.join(ROOT, name), `${body}\n`, 'utf8');
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function splitExamples(text) {
  return String(text || '')
    .split(/\s*\/\s*|\s*、\s*|\s*;\s*/)
    .map((item) => item.trim())
    .filter(Boolean);
}

const themeCards = readCsv('146_trend_hypothesis_cards.csv');
const evidenceRows = readCsv('147_trend_evidence_matrix.csv');
const candidateMatches = readCsv('253_qualitative_candidate_match.csv');

const themeMasterRows = themeCards.map((row) => ({
  theme_id: row.theme_id,
  theme_name: row.theme,
  layer: 'テーマ・産業領域',
  definition: '資金が向かう市場・産業の仮説。単独では加点しない。',
  causal_chain: row.causal_chain,
  current_evidence: row.current_snapshot,
  first_test_condition: row.first_test_condition,
  reject_condition: row.reject_condition,
  status: row.status
}));

const eventMasterRows = [
  {
    event_type: '決算・上方修正・下方修正',
    layer: 'イベント・ニュース',
    meaning: '会社の実績値または会社予想が変わる出来事。',
    examples: '決算短信、業績予想修正、増配、自社株買い',
    required_source: 'TDnet、企業IR、決算短信',
    scoring_rule: '株価反応、業績数値、会社予想の変化が確認できるまで採点に入れない。'
  },
  {
    event_type: '受注・大型契約・設備投資',
    layer: 'イベント・ニュース',
    meaning: '売上や受注残へ接続しやすい出来事。',
    examples: 'データセンター投資、重電受注、防衛契約、半導体設備投資',
    required_source: '企業IR、官公庁、業界統計、主要顧客の開示',
    scoring_rule: '対象企業の売上構成・受注・利益率へ接続できる場合だけ評価する。'
  },
  {
    event_type: '政策・規制・金利・為替',
    layer: '外部環境イベント',
    meaning: '会社単体ではなく、業界全体の収益条件を変える出来事。',
    examples: '日銀、FOMC、CPI、補助金、防衛予算、円高円安',
    required_source: '日銀、FRB、政府資料、FRED、統計局、官公庁',
    scoring_rule: '対象業界指数または同業群の反応と合わせて見る。個別株へ直接加点しない。'
  },
  {
    event_type: '新製品・技術転換',
    layer: 'イベント・ニュース',
    meaning: '競争環境や需要構造を変える可能性がある出来事。',
    examples: 'Switch 2、新型半導体装置、AI/量子関連発表、医薬品承認',
    required_source: '公式発表、承認資料、決算説明資料、販売実績',
    scoring_rule: '発売・承認だけでなく、販売数、採用、利益率、競合優位を確認する。'
  },
  {
    event_type: 'TOB・M&A・資本政策',
    layer: '企業固有イベント',
    meaning: '株価へ直接影響しやすい特殊イベント。',
    examples: 'TOB、MBO、合併、大株主変動、政策保有株売却',
    required_source: 'TDnet、EDINET、大量保有報告書、企業IR',
    scoring_rule: '通常の1年保有スコアとは別枠。イベント価格・成立条件・流動性を個別に扱う。'
  }
];

const evidenceLayerRows = evidenceRows.map((row) => ({
  theme_id: row.theme_id,
  evidence_question: row.evidence,
  layer: '実績検証層',
  already_available: row.already_available,
  missing_or_manual: row.missing_or_manual,
  source_candidate: row.source_candidate,
  use_in_test: row.use_in_test,
  caution: row.caution,
  score_permission: '取得済みの数値と株価反応がそろうまで点数化しない'
}));

const candidateBridgeRows = candidateMatches.map((row) => {
  const fit = Number(row.qualitative_fit || 0);
  const useClass = fit >= 85 ? '探索優先' : fit >= 75 ? '探索候補' : '参考';
  return {
    theme_id: row.theme_id,
    ticker: row.ticker,
    company: row.company,
    sector: row.sector,
    layer: '企業接続層',
    match_reason: row.match_reason,
    capital_flow_logic: row.capital_flow_logic,
    numeric_needed: row.numeric_needed,
    qualitative_fit_reference: row.qualitative_fit,
    current_use: useClass,
    score_policy: '質的適合は候補発見に使う。購入候補スコアには、公式数値・過去反応・同業反応の確認後に反映する。'
  };
});

const operationRows = [
  {
    step: '1',
    name: 'テーマを登録',
    input: 'AI、金利、資源、防衛などの産業・資金流入テーマ',
    output: 'テーママスター',
    rule: 'テーマ名だけでは加点しない'
  },
  {
    step: '2',
    name: 'イベントを登録',
    input: '決算、受注、政策、金利、TOB、新製品など',
    output: 'イベントマスター',
    rule: 'テーマとイベントを同じ階層に置かない'
  },
  {
    step: '3',
    name: '企業へ接続',
    input: '売上構成、受注、原価、シェア、顧客、同業指数',
    output: '企業接続表',
    rule: '会社の業績に効く経路が説明できない場合は参考止まり'
  },
  {
    step: '4',
    name: '実績で検証',
    input: 'イベント日、1日/5日/20日超過リターン、同業反応',
    output: '実績検証層',
    rule: '実績がない仮説は購入候補スコアへ直接入れない'
  },
  {
    step: '5',
    name: '候補選定に反映',
    input: '量的スコア、長期安定性、実績検証済み質的情報',
    output: '候補維持・保留・除外の説明材料',
    rule: '質的情報は補助・ゲート・警戒条件として扱う'
  }
];

writeCsv('731_qualitative_theme_master.csv', themeMasterRows, [
  'theme_id', 'theme_name', 'layer', 'definition', 'causal_chain', 'current_evidence', 'first_test_condition', 'reject_condition', 'status'
]);
writeCsv('732_qualitative_event_master.csv', eventMasterRows, [
  'event_type', 'layer', 'meaning', 'examples', 'required_source', 'scoring_rule'
]);
writeCsv('733_qualitative_evidence_layer.csv', evidenceLayerRows, [
  'theme_id', 'evidence_question', 'layer', 'already_available', 'missing_or_manual', 'source_candidate', 'use_in_test', 'caution', 'score_permission'
]);
writeCsv('734_qualitative_candidate_bridge.csv', candidateBridgeRows, [
  'theme_id', 'ticker', 'company', 'sector', 'layer', 'match_reason', 'capital_flow_logic', 'numeric_needed', 'qualitative_fit_reference', 'current_use', 'score_policy'
]);
writeCsv('735_qualitative_operation_rules.csv', operationRows, [
  'step', 'name', 'input', 'output', 'rule'
]);

const summaryRows = [
  { item: 'テーマ数', value: themeMasterRows.length, note: '産業・資金流入テーマ。イベントとは別階層。' },
  { item: 'イベント種別', value: eventMasterRows.length, note: '決算、受注、政策、新製品、TOB等。' },
  { item: '実績検証項目', value: evidenceLayerRows.length, note: '既取得と未取得を分ける。' },
  { item: '企業接続件数', value: candidateBridgeRows.length, note: 'テーマから企業へ接続した候補。' },
  { item: '直接加点禁止', value: '採用', note: '仮説のみの質的情報はスコアに直接混ぜない。' }
];

function rowsHtml(rows, headers) {
  return rows.map((row) => `<tr>${headers.map((header) => `<td>${esc(row[header])}</td>`).join('')}</tr>`).join('');
}

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>質的情報 構造化評価システム</title>
  <style>
    :root { --ink:#050b14; --muted:#45566a; --line:#cbd8e6; --navy:#123d63; --blue:#0b5f96; --soft:#f4f8fc; --green:#087f5b; --amber:#a85b00; --red:#b42318; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif; color:var(--ink); background:#eef4fa; line-height:1.75; }
    main { max-width:1220px; margin:0 auto; padding:28px 18px 56px; }
    header { background:#123d63; color:#fff; border-radius:10px; padding:30px; margin-bottom:18px; }
    h1 { margin:0 0 10px; font-size:30px; line-height:1.25; }
    h2 { margin:24px 0 12px; padding-left:12px; border-left:7px solid var(--blue); color:var(--navy); font-size:22px; }
    p { margin:0 0 10px; }
    .grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:12px; margin:16px 0; }
    .card, section { background:#fff; border:1px solid var(--line); border-radius:9px; padding:16px; }
    .card b { display:block; color:var(--navy); }
    .value { font-size:28px; font-weight:900; color:var(--blue); }
    table { width:100%; border-collapse:collapse; table-layout:fixed; background:#fff; }
    th,td { border:1px solid var(--line); padding:8px; vertical-align:top; font-size:12px; overflow-wrap:break-word; }
    th { background:#e6f1fb; color:var(--navy); text-align:left; }
    .flow { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; }
    .step { border:1px solid var(--line); border-radius:8px; padding:12px; background:#f8fbff; }
    .step b { color:var(--navy); }
    .notice { border-left:6px solid var(--amber); background:#fff8ec; padding:12px; border-radius:8px; }
    a { color:#075e91; font-weight:800; }
    @media (max-width:900px) { .grid,.flow { grid-template-columns:1fr; } table { table-layout:auto; } }
  </style>
</head>
<body>
<main>
  <header>
    <h1>質的情報 構造化評価システム</h1>
    <p>テーマ、イベント、企業接続、実績検証、情報信頼度を分けて扱います。AIや半導体などの産業テーマと、決算・TOB・政策などのイベントを同じ階層に並べない設計です。</p>
    <p>作成: ${esc(generatedAt)} / 質的情報は候補発見と説明補助に使い、実績検証前は購入候補スコアへ直接加点しません。</p>
  </header>

  <div class="grid">
    ${summaryRows.map((row) => `<div class="card"><b>${esc(row.item)}</b><div class="value">${esc(row.value)}</div><p>${esc(row.note)}</p></div>`).join('')}
  </div>

  <section>
    <h2>評価の階層</h2>
    <div class="flow">
      ${operationRows.map((row) => `<div class="step"><b>${esc(row.step)}. ${esc(row.name)}</b><br>${esc(row.input)}<br><small>${esc(row.rule)}</small></div>`).join('')}
    </div>
    <p class="notice">「AIが強い」「半導体が強い」という表現だけでは銘柄選定に使いません。ニュースやIRを、どの企業の売上・利益・受注・原価・シェアへ接続するのかを明示し、過去反応または実データで検証します。</p>
  </section>

  <section>
    <h2>テーママスター</h2>
    <table>
      <thead><tr><th>テーマID</th><th>テーマ</th><th>因果連鎖</th><th>確認条件</th><th>除外条件</th></tr></thead>
      <tbody>${rowsHtml(themeMasterRows, ['theme_id', 'theme_name', 'causal_chain', 'first_test_condition', 'reject_condition'])}</tbody>
    </table>
  </section>

  <section>
    <h2>イベントマスター</h2>
    <table>
      <thead><tr><th>イベント種別</th><th>階層</th><th>意味</th><th>例</th><th>必要ソース</th><th>採点ルール</th></tr></thead>
      <tbody>${rowsHtml(eventMasterRows, ['event_type', 'layer', 'meaning', 'examples', 'required_source', 'scoring_rule'])}</tbody>
    </table>
  </section>

  <section>
    <h2>実績検証層</h2>
    <table>
      <thead><tr><th>テーマID</th><th>検証すること</th><th>取得済み</th><th>未取得・手動</th><th>取得候補</th><th>注意点</th></tr></thead>
      <tbody>${rowsHtml(evidenceLayerRows, ['theme_id', 'evidence_question', 'already_available', 'missing_or_manual', 'source_candidate', 'caution'])}</tbody>
    </table>
  </section>

  <section>
    <h2>企業接続層</h2>
    <table>
      <thead><tr><th>テーマID</th><th>銘柄</th><th>会社</th><th>業種</th><th>接続理由</th><th>資金流入ロジック</th><th>必要数値</th><th>扱い</th></tr></thead>
      <tbody>${rowsHtml(candidateBridgeRows, ['theme_id', 'ticker', 'company', 'sector', 'match_reason', 'capital_flow_logic', 'numeric_needed', 'current_use'])}</tbody>
    </table>
  </section>

  <section>
    <h2>出力CSV</h2>
    <p><a href="731_qualitative_theme_master.csv">テーママスター</a> / <a href="732_qualitative_event_master.csv">イベントマスター</a> / <a href="733_qualitative_evidence_layer.csv">実績検証層</a> / <a href="734_qualitative_candidate_bridge.csv">企業接続層</a> / <a href="735_qualitative_operation_rules.csv">運用ルール</a></p>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'qualitative_structure_system_20260528.html'), html, 'utf8');

console.log(JSON.stringify({
  generatedAt,
  output: 'qualitative_structure_system_20260528.html',
  themes: themeMasterRows.length,
  eventTypes: eventMasterRows.length,
  candidateConnections: candidateBridgeRows.length
}, null, 2));
