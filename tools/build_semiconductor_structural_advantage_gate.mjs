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
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ''));
    rows.push(row);
  }
  if (!rows.length) return [];
  const headers = rows.shift();
  return rows
    .filter((cells) => cells.some((cellValue) => String(cellValue ?? '').trim() !== ''))
    .map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ''])));
}

function readCsv(name) {
  const full = path.join(ROOT, name);
  if (!fs.existsSync(full)) return [];
  return parseCsv(fs.readFileSync(full, 'utf8'));
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

function cleanLines(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n');
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

const candidateChecklist = readCsv('350_forward_candidate_checklist.csv');
const plus1Rows = readCsv('310_candidate_plus1_gate.csv');
const completionRows = readCsv('339_candidate_data_completion_matrix.csv');

const candidateByTicker = new Map(candidateChecklist.map((row) => [row.ticker, row]));
const plus1ByTicker = new Map(plus1Rows.map((row) => [row.ticker, row]));
const completionByTicker = new Map(completionRows.map((row) => [row.ticker, row]));

const structuralUniverse = [
  {
    ticker: '8035.T',
    company: '東京エレクトロン',
    process: 'リソグラフィ前後のコータ/デベロッパ',
    structural_evidence: 'コータ/デベロッパ世界シェア90%、EUV/High NA向けはほぼ100%と公式説明。',
    demand_link: 'AI・先端ロジック・DRAM・NANDの微細化、EUV/High NA、歩留まり改善に接続。',
    source_quality: '公式・数値あり',
    structural_rating: 'S',
    moat_score: 95,
    indispensability_score: 95,
    demand_duration_score: 85,
    revenue_connection_score: 75,
    price_risk_note: '半導体製造装置投資サイクル、中国規制、SOX下落、高PER局面に注意。',
    source_url: 'https://www.tel.com/blog/all/20260428_001.html',
  },
  {
    ticker: '7735.T',
    company: 'SCREEN HD',
    process: '半導体洗浄装置',
    structural_evidence: '枚葉式洗浄、バッチ式洗浄、スピンスクラバで世界シェアNo.1と公式説明。',
    demand_link: '微細化・高集積化で洗浄工程の重要性が高まる。累計出荷15,000台の実績。',
    source_quality: '公式・シェア表現あり',
    structural_rating: 'A',
    moat_score: 88,
    indispensability_score: 90,
    demand_duration_score: 82,
    revenue_connection_score: 72,
    price_risk_note: '装置投資サイクル、メモリ市況、中国向け規制、受注変動に注意。',
    source_url: 'https://www.screen.co.jp/spe/information/spe250701',
  },
  {
    ticker: '6146.T',
    company: 'ディスコ',
    process: 'ダイシング、グラインディング、レーザーソー、精密加工ツール',
    structural_evidence: '半導体・電子部品製造に使う精密加工装置と加工ツールを提供。レーザーソー累計出荷4,000台超、AI/HBM等の需要接続を公式説明。',
    demand_link: 'HBM、先端ロジック、パワー半導体、薄化・切断・SiC加工に接続。',
    source_quality: '公式・需要接続あり / シェア数値は未接続',
    structural_rating: 'A-',
    moat_score: 84,
    indispensability_score: 88,
    demand_duration_score: 84,
    revenue_connection_score: 70,
    price_risk_note: '現候補10社内。1年騰落は強いが、60日最大下落が大きく、半導体サイクルに敏感。',
    source_url: 'https://www.disco.co.jp/eg/news/corp/20260302.html',
  },
  {
    ticker: '6920.T',
    company: 'レーザーテック',
    process: 'EUVマスクブランクス欠陥検査、フォトマスク関連検査',
    structural_evidence: 'EUVマスクブランクス欠陥検査装置が業界標準として採用、最先端リソグラフィで高シェアと公式説明。',
    demand_link: 'EUV・先端リソグラフィ・検査/計測の不可欠性に接続。',
    source_quality: '公式・高シェア表現あり / 数値は未接続',
    structural_rating: 'A',
    moat_score: 88,
    indispensability_score: 92,
    demand_duration_score: 80,
    revenue_connection_score: 68,
    price_risk_note: '期待先行・高バリュエーション・大型顧客投資の変動に注意。',
    source_url: 'https://www.lasertec.co.jp/company/business.html',
  },
  {
    ticker: '6857.T',
    company: 'アドバンテスト',
    process: '半導体テスト装置',
    structural_evidence: 'AI/HBM/先端半導体の検査需要に近いが、今回ページでは公式シェア根拠を未接続。',
    demand_link: 'AIチップ、HBM、高性能半導体の検査需要に接続する仮説。',
    source_quality: '公式ソース未接続',
    structural_rating: 'B',
    moat_score: 72,
    indispensability_score: 78,
    demand_duration_score: 80,
    revenue_connection_score: 55,
    price_risk_note: '既に期待が乗りやすい。高PER・SOX下落・決算失望時の反応を必ず確認。',
    source_url: '',
  },
  {
    ticker: '6762.T',
    company: 'TDK',
    process: '電子部品、受動部品、電源・センサー関連',
    structural_evidence: '現候補10社内。半導体製造装置ではなく、AI・データセンター周辺の部品需要仮説として扱う。',
    demand_link: 'AIサーバー、電源、通信、電子部品需要への接続仮説。',
    source_quality: '本ページでは公式ソース未接続',
    structural_rating: 'B',
    moat_score: 68,
    indispensability_score: 64,
    demand_duration_score: 74,
    revenue_connection_score: 65,
    price_risk_note: '1年騰落は強いが、半導体製造工程の高シェア銘柄とは別枠。部品サイクル・為替・顧客在庫に注意。',
    source_url: '',
  },
];

function weightedScore(row) {
  return Math.round(
    row.moat_score * 0.30
    + row.indispensability_score * 0.25
    + row.demand_duration_score * 0.20
    + row.revenue_connection_score * 0.15
    + sourceScore(row.source_quality) * 0.10,
  );
}

function sourceScore(sourceQuality) {
  if (sourceQuality.includes('数値あり')) return 95;
  if (sourceQuality.includes('シェア表現')) return 85;
  if (sourceQuality.includes('需要接続')) return 75;
  return 45;
}

const structuralRows = structuralUniverse.map((row, index) => {
  const candidate = candidateByTicker.get(row.ticker) || {};
  const plus1 = plus1ByTicker.get(row.ticker) || {};
  const completion = completionByTicker.get(row.ticker) || {};
  const score = weightedScore(row);
  let role = '構造仮説の調査候補';
  if (['S', 'A', 'A-'].includes(row.structural_rating) && candidate.ticker) role = '現候補10社の構造確認枠';
  if (['S', 'A', 'A-'].includes(row.structural_rating) && !candidate.ticker) role = '100社母集団への追加検討枠';
  if (row.structural_rating === 'B') role = candidate.ticker ? '現候補10社の補助仮説枠' : 'ソース補完後に再評価';
  return {
    updated_at: generatedAt,
    rank: index + 1,
    ticker: row.ticker,
    company: row.company,
    process: row.process,
    structural_rating: row.structural_rating,
    structural_score: score,
    moat_score: row.moat_score,
    indispensability_score: row.indispensability_score,
    demand_duration_score: row.demand_duration_score,
    revenue_connection_score: row.revenue_connection_score,
    source_quality: row.source_quality,
    current_candidate_connection: candidate.ticker ? '現候補10社に接続' : '現候補10社には未接続',
    nisa_score: plus1.nisa_score || candidate.nisa_score || '',
    plus1_status: plus1.plus1_status || candidate.plus1_status || '',
    completion_score: completion.completion_score || candidate.completion_score || '',
    role,
    demand_link: row.demand_link,
    structural_evidence: row.structural_evidence,
    price_risk_note: row.price_risk_note,
    score_policy: '本体スコアへ直接加点しない。SOX下落耐性、決算、PER/PBR/ROE、+1%比較を通過してから購入検討可否へ接続。',
    source_url: row.source_url,
  };
});

const gateRules = [
  {
    rule_id: 'SG1',
    gate: '構造優位の入口',
    condition: '公式情報で高シェア、業界標準、不可欠工程、代替困難性のいずれかが確認できる',
    pass: 'S/A評価として調査優先度を上げる',
    fail: 'ニューステーマだけならB/C扱いにして本体スコアへ混ぜない',
  },
  {
    rule_id: 'SG2',
    gate: '収益接続',
    condition: '受注、売上、利益率、会社予想、設備投資需要に接続している',
    pass: '量的スコアの検証対象に進める',
    fail: '技術は強いが株価根拠としては保留',
  },
  {
    rule_id: 'SG3',
    gate: '価格耐性',
    condition: 'SOX、日経平均、NASDAQ下落時に相対的に耐えるかを確認',
    pass: '1年保有テスト候補へ進める可能性',
    fail: '押し目待ち、比率低下、または候補維持',
  },
  {
    rule_id: 'SG4',
    gate: '割高・過熱',
    condition: 'PER/PBR/ROE、52週位置、60日最大下落率、出来高急増を確認',
    pass: '小口テスト候補として検討',
    fail: '構造は強くても開始可否確認へ進めない',
  },
  {
    rule_id: 'SG5',
    gate: '+1%目的',
    condition: 'S&P500/日経平均等の比較対象を1%以上上回る見込みがある',
    pass: 'NISA 1年保有テスト候補に残す',
    fail: '個別株比率を下げ、指数・投信を優先',
  },
];

const sourceRows = structuralUniverse.map((row) => ({
  updated_at: generatedAt,
  ticker: row.ticker,
  company: row.company,
  source_quality: row.source_quality,
  source_url: row.source_url || '未接続',
  source_note: row.structural_evidence,
}));

const integrationPolicy = [
  {
    item: '質的仮説の扱い',
    policy: '高シェア・不可欠工程・代替困難性は候補発見と調査優先度に使う。',
    reason: '構造的に需要が残りやすい企業を拾うため。',
  },
  {
    item: '本体スコアへの扱い',
    policy: '質的仮説は本体スコアへ直接加点しない。',
    reason: '良いストーリーだけで購入判断に近づけるのを防ぐため。',
  },
  {
    item: '1年作戦への扱い',
    policy: '構造優位がS/Aでも、SOX下落耐性、決算、割高、+1%比較を通す。',
    reason: '技術優位と1年リターンは同じではないため。',
  },
  {
    item: '半導体下落リスク',
    policy: '半導体全体の下落時に耐えるかを別テストにする。',
    reason: 'AIテーマが強くても、金利・設備投資・在庫循環でまとめて売られることがあるため。',
  },
  {
    item: '次工程',
    policy: 'SOX指数、日経平均、候補株価を使い、下落局面の相対耐性を検証する。',
    reason: '構造的に強いという仮説が、実際の株価耐性に表れるか確認するため。',
  },
];

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '構造優位候補',
    value: `${structuralRows.length}社`,
    interpretation: '半導体・AI周辺で、不可欠工程、高シェア、代替困難性を持つ可能性がある企業を別枠化。',
  },
  {
    updated_at: generatedAt,
    item: 'S/A評価',
    value: `${structuralRows.filter((row) => ['S', 'A', 'A-'].includes(row.structural_rating)).length}社`,
    interpretation: '公式情報で構造優位の根拠が比較的強い企業。購入判断ではなく、調査優先度。',
  },
  {
    updated_at: generatedAt,
    item: '現候補10社との接続',
    value: `${structuralRows.filter((row) => row.current_candidate_connection === '現候補10社に接続').length}社`,
    interpretation: '現候補10社に含まれるのはディスコ、TDK。東京エレクトロン、SCREEN、レーザーテック等は追加検討枠。',
  },
  {
    updated_at: generatedAt,
    item: '本体スコアへの反映',
    value: '直接加点しない',
    interpretation: '質的仮説は、SOX下落耐性、決算、割高、+1%比較を通過してから接続する。',
  },
  {
    updated_at: generatedAt,
    item: '次の検証',
    value: '下落耐性',
    interpretation: '半導体指数や日経平均が下がった時に、構造優位銘柄が相対的に耐えるかを検証する。',
  },
];

writeCsv('354_structural_advantage_summary.csv', summaryRows, ['updated_at', 'item', 'value', 'interpretation']);
writeCsv('355_structural_advantage_candidates.csv', structuralRows, [
  'updated_at',
  'rank',
  'ticker',
  'company',
  'process',
  'structural_rating',
  'structural_score',
  'moat_score',
  'indispensability_score',
  'demand_duration_score',
  'revenue_connection_score',
  'source_quality',
  'current_candidate_connection',
  'nisa_score',
  'plus1_status',
  'completion_score',
  'role',
  'demand_link',
  'structural_evidence',
  'price_risk_note',
  'score_policy',
  'source_url',
]);
writeCsv('356_structural_gate_rules.csv', gateRules, ['rule_id', 'gate', 'condition', 'pass', 'fail']);
writeCsv('357_structural_source_log.csv', sourceRows, ['updated_at', 'ticker', 'company', 'source_quality', 'source_url', 'source_note']);
writeCsv('358_structural_integration_policy.csv', integrationPolicy, ['item', 'policy', 'reason']);

function badge(text) {
  const t = String(text ?? '');
  let cls = 'mid';
  if (['S', 'A', 'A-'].includes(t)) cls = 'ok';
  if (t === 'B') cls = 'warn';
  if (t.includes('直接加点しない') || t.includes('未接続')) cls = 'neutral';
  return `<span class="badge ${cls}">${esc(t)}</span>`;
}

const summaryCards = summaryRows.map((row) => `
      <div class="kpi">
        <span>${esc(row.item)}</span>
        <b>${esc(row.value)}</b>
        <small>${esc(row.interpretation)}</small>
      </div>
`).join('');

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>半導体・AI 構造優位ゲート 2026年5月26日</title>
  <style>
    :root {
      --ink:#071f36;
      --muted:#49657f;
      --blue:#0b5d92;
      --light:#eef6fd;
      --line:#c9dceb;
      --ok:#057a55;
      --warn:#b76b00;
      --stop:#b42318;
      --bg:#f7fbff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Yu Gothic", "Meiryo", Arial, sans-serif;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.75;
      font-size: 15px;
    }
    header {
      background: linear-gradient(135deg, #07375e, #0c6b96);
      color: #fff;
      padding: 30px 24px;
    }
    main { max-width: 1240px; margin: 0 auto; padding: 24px; }
    h1 { margin: 0 0 8px; font-size: 30px; letter-spacing: 0; }
    h2 {
      margin: 28px 0 12px;
      padding-left: 12px;
      border-left: 7px solid var(--blue);
      font-size: 22px;
    }
    p { margin: 8px 0; }
    .lead, .card {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 18px;
      box-shadow: 0 2px 9px rgba(0,40,80,.06);
    }
    .toolbar { display:flex; flex-wrap:wrap; gap:10px; margin-top: 14px; }
    .button {
      display:inline-block;
      padding:8px 12px;
      border:1px solid #9fc1db;
      border-radius:8px;
      background:#fff;
      color:#07375e;
      text-decoration:none;
      font-weight:700;
    }
    .kpis {
      display:grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 12px;
      margin: 18px 0;
    }
    .kpi {
      background:#fff;
      border:1px solid var(--line);
      border-radius:10px;
      padding:14px;
      min-height: 138px;
    }
    .kpi span { display:block; color:var(--muted); font-weight:700; }
    .kpi b { display:block; font-size:28px; color:#06456f; margin:4px 0; }
    .kpi small { display:block; color:#17324a; line-height:1.55; }
    .logic {
      display:grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
    }
    .logic div {
      background:#fff;
      border:1px solid var(--line);
      border-radius:8px;
      padding:12px;
      min-height:120px;
    }
    .logic strong { display:block; color:#07375e; margin-bottom:4px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; background:#fff; }
    table { width:100%; border-collapse:collapse; min-width: 1120px; }
    th, td { border-bottom:1px solid var(--line); padding:10px; text-align:left; vertical-align:top; }
    th { background:#e6f2fb; color:#06385d; white-space:nowrap; }
    tr:last-child td { border-bottom:0; }
    .badge { display:inline-block; padding:4px 8px; border-radius:999px; font-weight:700; white-space:nowrap; }
    .badge.ok { background:#e8f7ef; color:var(--ok); }
    .badge.mid { background:#eef6fd; color:#0b5d92; }
    .badge.warn { background:#fff4df; color:var(--warn); }
    .badge.neutral { background:#edf0f3; color:#293847; }
    .note { color:var(--muted); font-size:13px; }
    .warn-box {
      border-left: 7px solid var(--warn);
      background: #fff9ed;
      padding: 14px;
      border-radius: 8px;
      margin-top: 12px;
    }
    .ok-box {
      border-left: 7px solid var(--ok);
      background: #f0fbf5;
      padding: 14px;
      border-radius: 8px;
      margin-top: 12px;
    }
    @media (max-width: 860px) {
      main { padding: 14px; }
      header { padding: 22px 16px; }
      h1 { font-size: 24px; }
      .logic { grid-template-columns: 1fr; }
      table { min-width: 980px; }
    }
    @media print {
      body { background:#fff; font-size: 13px; }
      header { background:#07375e !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .card, .lead, .kpi { box-shadow:none; }
      h2, .card, .lead, .kpis, .table-wrap { break-inside: avoid; page-break-inside: avoid; }
      a { color: inherit; text-decoration: none; }
    }
  </style>
</head>
<body>
<header>
  <h1>半導体・AI 構造優位ゲート</h1>
  <p>AIテーマを単純加点せず、不可欠工程・高シェア・代替困難・収益接続・株価耐性に分解して扱うためのページです。</p>
</header>
<main>
  <section class="lead">
    <p><b>目的:</b> 「AI需要が強いから半導体を買う」ではなく、「半導体を作る上で代替しにくい工程を握る企業か」を確認します。</p>
    <p><b>重要:</b> 構造優位は強い仮説ですが、利益保証ではありません。本体スコアへ直接足さず、SOX下落耐性、決算、割高、+1%比較を通過してからNISA 1年保有テスト候補へ接続します。</p>
    <div class="toolbar">
      <a class="button" href="354_structural_advantage_summary.csv">354 要約CSV</a>
      <a class="button" href="355_structural_advantage_candidates.csv">355 候補CSV</a>
      <a class="button" href="356_structural_gate_rules.csv">356 ゲートCSV</a>
      <a class="button" href="357_structural_source_log.csv">357 公式ソースCSV</a>
      <a class="button" href="358_structural_integration_policy.csv">358 反映方針CSV</a>
      <a class="button" href="semiconductor_downside_resilience_20260526.html">半導体下落耐性検証へ</a>
      <a class="button" href="semiconductor_quant_gate_connection_20260526.html">半導体量的ゲート接続へ</a>
      <a class="button" href="june_forward_test_record_20260526.html">6月前向きテスト記録へ</a>
      <a class="button" href="event_type_reaction_db_20260526.html">イベント種類別反応DBへ</a>
      <a class="button" href="index.html">メインページへ</a>
    </div>
  </section>

  <section class="kpis">
    ${summaryCards}
  </section>

  <h2>考え方</h2>
  <section class="card">
    <div class="logic">
      <div><strong>1. 構造仮説</strong>不可欠工程、高シェア、代替困難性を確認する。</div>
      <div><strong>2. 収益接続</strong>受注、売上、利益率、会社予想へつながるかを見る。</div>
      <div><strong>3. 価格耐性</strong>SOXや日経が下がった局面で相対的に耐えるかを見る。</div>
      <div><strong>4. 割高確認</strong>PER、PBR、52週位置、最大下落率で過熱を確認する。</div>
      <div><strong>5. +1%比較</strong>指数・投信を1%以上上回る目的に合うか確認する。</div>
    </div>
    <div class="warn-box">
      <b>このページの結論:</b> 東京エレクトロンのような高シェア・不可欠工程は、1年テスト候補を探すうえで強い質的仮説になります。ただし、半導体製造装置は設備投資サイクルと金利に左右されるため、「構造が強い = すぐ投資可」ではありません。
    </div>
  </section>

  <h2>構造優位候補</h2>
  <div class="table-wrap">
    <table>
      <thead><tr><th>銘柄</th><th>工程</th><th>評価</th><th>構造点</th><th>根拠</th><th>需要接続</th><th>現候補接続</th><th>扱い</th><th>注意点</th></tr></thead>
      <tbody>
        ${structuralRows.map((row) => `
          <tr>
            <td><b>${esc(row.ticker)}</b><br>${esc(row.company)}</td>
            <td>${esc(row.process)}</td>
            <td>${badge(row.structural_rating)}</td>
            <td><b>${esc(row.structural_score)}</b><br><span class="note">堀${esc(row.moat_score)} / 不可欠${esc(row.indispensability_score)} / 需要${esc(row.demand_duration_score)} / 収益${esc(row.revenue_connection_score)}</span></td>
            <td>${esc(row.structural_evidence)}<br><a href="${esc(row.source_url)}">${esc(row.source_quality)}</a></td>
            <td>${esc(row.demand_link)}</td>
            <td>${badge(row.current_candidate_connection)}</td>
            <td>${esc(row.role)}</td>
            <td>${esc(row.price_risk_note)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <h2>ゲートルール</h2>
  <div class="table-wrap">
    <table>
      <thead><tr><th>ルール</th><th>ゲート</th><th>条件</th><th>通過時</th><th>未通過時</th></tr></thead>
      <tbody>
        ${gateRules.map((row) => `
          <tr>
            <td>${esc(row.rule_id)}</td>
            <td><b>${esc(row.gate)}</b></td>
            <td>${esc(row.condition)}</td>
            <td>${esc(row.pass)}</td>
            <td>${esc(row.fail)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <h2>1年作戦への接続</h2>
  <section class="card">
    <div class="ok-box">
      <b>使える点:</b> 半導体やAIの最終製品ではなく、製造工程のボトルネックを握る企業を探す発想は、時流テーマを現実的に扱ううえで有効です。特に高シェア・不可欠工程・公式根拠がある企業は、100社母集団から10社へ絞る時の優先順位を上げられます。
    </div>
    <div class="warn-box">
      <b>使ってはいけない点:</b> 構造優位だけで「1年稼げる」とは判定しません。次工程で、SOX下落局面の耐性、日経平均比、決算反応、PER/PBR/ROE、+1%比較を通します。
    </div>
  </section>

  <h2>公式ソース</h2>
  <div class="table-wrap">
    <table>
      <thead><tr><th>銘柄</th><th>ソース状態</th><th>リンク</th><th>確認した根拠</th></tr></thead>
      <tbody>
        ${sourceRows.map((row) => `
          <tr>
            <td>${esc(row.ticker)} ${esc(row.company)}</td>
            <td>${badge(row.source_quality)}</td>
            <td>${row.source_url === '未接続' ? '未接続' : `<a href="${esc(row.source_url)}">${esc(row.source_url)}</a>`}</td>
            <td>${esc(row.source_note)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <p class="note">更新日時: ${esc(generatedAt)}</p>
</main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'semiconductor_structural_advantage_gate_20260526.html'), html, 'utf8');

console.log(`generated semiconductor structural advantage gate: ${structuralRows.length} rows`);
