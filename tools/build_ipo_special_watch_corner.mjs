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

function statusClass(text) {
  if (/不可|対象外|禁止|未上場|除外|高/.test(text)) return 'bad';
  if (/監視|確認|保留|条件付き|中/.test(text)) return 'warn';
  if (/可能|通過|低/.test(text)) return 'good';
  return '';
}

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '別枠化の結論',
    value: '通常10社に混ぜない',
    interpretation: 'SpaceX、OpenAI級のIPOは、通常のNISA日本株候補とはリスク・データ量・値動きの性質が違うため、特別監視枠に分ける。',
  },
  {
    updated_at: generatedAt,
    item: 'NISA対象',
    value: '上場後に確認',
    interpretation: '未上場株はNISA不可。Nasdaq等に上場し、利用証券会社がNISA成長投資枠で取扱う場合だけ検討可能。',
  },
  {
    updated_at: generatedAt,
    item: '初期行動',
    value: '上場前・初値は買わない',
    interpretation: 'NISAは損益通算できないため、初値の過熱・ロックアップ・情報不足を避け、5営業日/20営業日の反応を見る。',
  },
  {
    updated_at: generatedAt,
    item: '資金枠',
    value: '最大5%',
    interpretation: '通常候補とは別の実験枠。条件を満たすまでは0%、満たしても総資金の5%以内を上限にする。',
  },
  {
    updated_at: generatedAt,
    item: '通常候補への影響',
    value: '市場イベントとして監視',
    interpretation: '直接買えなくても、AI、半導体、宇宙、防衛、データセンター関連への資金流入/流出イベントとして扱う。',
  },
];

const watchRows = [
  {
    updated_at: generatedAt,
    company: 'SpaceX',
    ticker_or_status: '上場前/報道ベース',
    theme: '宇宙、衛星通信、防衛、AIインフラ、データ伝送',
    current_status: '特別監視',
    nisa_status: '未上場中は不可',
    why_watch: 'IPO規模が非常に大きい場合、AI・宇宙・半導体・防衛テーマの資金配分に影響する可能性がある。',
    direct_buy_rule: '上場後、NISA成長投資枠での取扱確認、5営業日/20営業日反応、S-1数値確認後まで買わない。',
    indirect_watch: 'GOOGL等の出資企業、宇宙関連、衛星通信、防衛、半導体/データセンター資金流出入。',
    risk_level: '高',
  },
  {
    updated_at: generatedAt,
    company: 'OpenAI',
    ticker_or_status: '上場前/報道ベース',
    theme: '生成AI、クラウド、半導体需要、データセンター、AIアプリ',
    current_status: '特別監視',
    nisa_status: '未上場中は不可',
    why_watch: 'AI需要の中心テーマであり、IPO観測だけでもAI関連株の期待・失望に影響する可能性がある。',
    direct_buy_rule: '上場後、証券会社取扱、財務・赤字幅・売上成長・計算資源コストを確認するまで買わない。',
    indirect_watch: 'MSFT、NVDA、半導体装置、電力、データセンター関連への連想。',
    risk_level: '高',
  },
  {
    updated_at: generatedAt,
    company: 'Anthropic等のAI未上場企業',
    ticker_or_status: '上場前/関連候補',
    theme: '生成AI、クラウド、AIモデル、データセンター',
    current_status: '周辺監視',
    nisa_status: '未上場中は不可',
    why_watch: 'OpenAI/SpaceX級のIPO連鎖が起きた場合、AIテーマのバリュエーション基準が変わる可能性がある。',
    direct_buy_rule: '上場後も初値ではなく、公開資料・20営業日反応・指数比較を確認。',
    indirect_watch: 'AI大型IPOの連鎖、NASDAQ、SOX、SMH、既存大型テックへの資金移動。',
    risk_level: '中',
  },
];

const nisaRows = [
  {
    updated_at: generatedAt,
    condition: '未上場株、私募、セカンダリー取引',
    nisa_judgement: '対象外',
    explanation: 'NISAは上場株式等が中心。未上場の直接持分や私募取引は通常NISAで購入できない。',
    action: '通常候補にも特別枠にも入れず、イベント監視だけ行う。',
  },
  {
    updated_at: generatedAt,
    condition: '米国市場などに上場後',
    nisa_judgement: '条件付き可能',
    explanation: '成長投資枠で外国株式を扱う証券会社なら可能性がある。ただし銘柄ごとの取扱とNISA預り可否確認が必要。',
    action: '証券会社画面でNISA対象表示、注文可能区分、通貨、手数料、為替コストを確認。',
  },
  {
    updated_at: generatedAt,
    condition: 'IPO初値・上場初日',
    nisa_judgement: '原則見送り',
    explanation: '初値は需給と話題性で歪みやすい。NISAは損益通算不可のため、初日高値掴みを避ける。',
    action: '5営業日と20営業日の価格、出来高、指数比を記録。',
  },
  {
    updated_at: generatedAt,
    condition: '上場後20営業日を通過',
    nisa_judgement: '小額検討可',
    explanation: '価格形成と出来高が一巡し、指数比・同業比・公開財務の確認が可能になる。',
    action: '特別枠上限5%以内で、通常候補より厳しいゲートを適用。',
  },
];

const gateRows = [
  {
    updated_at: generatedAt,
    phase: '上場前',
    check_item: 'S-1/目論見書、報道、上場予定日、予定価格レンジ',
    pass_condition: '公開資料で売上、赤字、FCF、株式構造、ロックアップが確認できる',
    fail_action: '数字がない場合は監視だけ。点数化しない。',
  },
  {
    updated_at: generatedAt,
    phase: '上場当日',
    check_item: '初値、終値、出来高、IPO価格からの乖離',
    pass_condition: '買わない。データ記録のみ。',
    fail_action: '初値追いは禁止。通常候補の資金配分も動かさない。',
  },
  {
    updated_at: generatedAt,
    phase: '5営業日後',
    check_item: 'IPO価格比、初値比、NASDAQ比、出来高の落ち着き',
    pass_condition: '初値からの急落が限定的、または過熱が冷めて価格形成が安定',
    fail_action: '急騰継続なら見送り。急落でも公開数字が弱ければ見送り。',
  },
  {
    updated_at: generatedAt,
    phase: '20営業日後',
    check_item: '20日リターン、最大下落率、指数超過、出来高、ニュース反応',
    pass_condition: 'NASDAQまたはS&P500を+1%pt以上上回り、最大下落率が許容範囲',
    fail_action: '指数未達または最大下落率が大きい場合は特別枠0%。',
  },
  {
    updated_at: generatedAt,
    phase: '決算後',
    check_item: '売上成長、営業損益、FCF、粗利率、ガイダンス、設備投資',
    pass_condition: '成長率が高く、赤字拡大やFCF悪化が説明可能',
    fail_action: '成長鈍化、赤字拡大、ガイダンス弱い場合はNISAで買わない。',
  },
];

const scoreRows = [
  {
    updated_at: generatedAt,
    component: '公開資料信頼度',
    weight: '20%',
    formula: 'S-1/目論見書、監査済み財務、株式構造、リスク開示の確認度',
    note: '未上場・報道だけなら0点。数字が取れないものは点数化しない。',
  },
  {
    updated_at: generatedAt,
    component: '価格形成',
    weight: '25%',
    formula: '20営業日リターン、初値比、最大下落率、出来高安定度',
    note: '初値ではなく、公開市場で価格が形成された後に評価する。',
  },
  {
    updated_at: generatedAt,
    component: '指数比較',
    weight: '20%',
    formula: '20営業日/60営業日のS&P500、NASDAQ、関連ETFに対する超過リターン',
    note: '既存投信・指数を+1%pt上回る目標と接続。',
  },
  {
    updated_at: generatedAt,
    component: '事業数字',
    weight: '25%',
    formula: '売上成長、粗利率、営業損益、FCF、設備投資負担、顧客集中',
    note: '夢や話題ではなく、公開数字で確認する。',
  },
  {
    updated_at: generatedAt,
    component: 'NISA適合性',
    weight: '10%',
    formula: '証券会社取扱、成長投資枠可否、流動性、為替・手数料、長期保有に耐えるか',
    note: 'NISAで買えない、または損益通算不可のリスクが大きい場合は停止。',
  },
];

const sourceRows = [
  {
    updated_at: generatedAt,
    source_name: '国税庁 NISA制度',
    url: 'https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/1535.htm',
    use: 'NISAの非課税対象が上場株式等であることの制度確認。',
  },
  {
    updated_at: generatedAt,
    source_name: '金融庁 NISA関連説明',
    url: 'https://www.fsa.go.jp/access/r4/234.html',
    use: '成長投資枠の対象と除外条件の制度確認。',
  },
  {
    updated_at: generatedAt,
    source_name: '楽天証券 成長投資枠',
    url: 'https://www.rakuten-sec.co.jp/web/nisa/growth/',
    use: '国内株式・外国株式など、証券会社での取扱確認例。',
  },
  {
    updated_at: generatedAt,
    source_name: 'Axios SpaceX/OpenAI IPO報道',
    url: 'https://www.axios.com/2026/05/20/openai-ipo-spacex-musk',
    use: 'OpenAIのIPO準備報道確認。報道ベースのため監視情報として扱う。',
  },
  {
    updated_at: generatedAt,
    source_name: 'Axios SpaceX IPO filing報道',
    url: 'https://www.axios.com/2026/05/20/elon-musk-spacex-ipo',
    use: 'SpaceX IPO filing報道確認。SEC/目論見書の原資料確認前は購入判断に使わない。',
  },
];

writeCsv('371_ipo_special_watch_summary.csv', summaryRows, ['updated_at', 'item', 'value', 'interpretation']);
writeCsv('372_ipo_special_watchlist.csv', watchRows, [
  'updated_at',
  'company',
  'ticker_or_status',
  'theme',
  'current_status',
  'nisa_status',
  'why_watch',
  'direct_buy_rule',
  'indirect_watch',
  'risk_level',
]);
writeCsv('373_ipo_nisa_eligibility_rules.csv', nisaRows, [
  'updated_at',
  'condition',
  'nisa_judgement',
  'explanation',
  'action',
]);
writeCsv('374_ipo_observation_gate_rules.csv', gateRows, [
  'updated_at',
  'phase',
  'check_item',
  'pass_condition',
  'fail_action',
]);
writeCsv('375_ipo_special_score_model.csv', scoreRows, [
  'updated_at',
  'component',
  'weight',
  'formula',
  'note',
]);
writeCsv('376_ipo_special_sources.csv', sourceRows, [
  'updated_at',
  'source_name',
  'url',
  'use',
]);

const table = (headers, rows) => `
  <div class="table-wrap">
    <table>
      <thead><tr>${headers.map((header) => `<th>${esc(header.label)}</th>`).join('')}</tr></thead>
      <tbody>
        ${rows.map((row) => `<tr>${headers.map((header) => `<td${header.className ? ` class="${header.className(row)}"` : ''}>${esc(header.value ? header.value(row) : row[header.key])}</td>`).join('')}</tr>`).join('\n')}
      </tbody>
    </table>
  </div>`;

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>IPO・未上場メガイベント特別枠</title>
  <style>
    :root {
      --ink: #111827;
      --muted: #4b5563;
      --line: #cbd5e1;
      --bg: #f6f8fb;
      --panel: #ffffff;
      --navy: #12385f;
      --blue: #1f6f9f;
      --green: #047857;
      --green-bg: #ecfdf5;
      --amber: #b45309;
      --amber-bg: #fffbeb;
      --red: #b91c1c;
      --red-bg: #fef2f2;
      --violet: #5b21b6;
      --violet-bg: #f5f3ff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Yu Gothic", "Meiryo", Arial, sans-serif;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.7;
      letter-spacing: 0;
    }
    main { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 26px 0 48px; }
    .hero {
      background: linear-gradient(135deg, #12385f, #1f4f7d 58%, #3b2b74);
      color: #fff;
      border-radius: 16px;
      padding: 26px;
      margin-bottom: 18px;
      box-shadow: 0 12px 28px rgba(17, 24, 39, .12);
    }
    h1 { margin: 0 0 10px; font-size: 30px; line-height: 1.25; }
    h2 { margin: 0 0 12px; color: var(--navy); font-size: 22px; line-height: 1.35; }
    h3 { margin: 0 0 8px; color: var(--navy); font-size: 17px; }
    p { margin: 0 0 10px; }
    .lead { color: #e5eefb; max-width: 920px; }
    .toolbar { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
    .button {
      display: inline-flex;
      align-items: center;
      min-height: 38px;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid #b8d5ef;
      background: #fff;
      color: var(--navy);
      text-decoration: none;
      font-weight: 700;
      font-size: 13px;
    }
    .button.dark { background: transparent; color: #fff; border-color: #9cc8ec; }
    section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 18px;
      margin-bottom: 16px;
      box-shadow: 0 8px 20px rgba(17, 24, 39, .06);
    }
    .kpis { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; margin-bottom: 16px; }
    .kpi {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 14px;
    }
    .kpi span { display: block; color: var(--muted); font-size: 12px; }
    .kpi b { display: block; color: var(--navy); font-size: 20px; line-height: 1.25; margin-top: 4px; }
    .cards { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .card {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 14px;
      background: #fff;
    }
    .card b { color: var(--navy); }
    .flow { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 10px; }
    .step { border: 1px solid var(--line); border-radius: 10px; padding: 12px; background: #f8fbff; min-height: 122px; position: relative; }
    .step:not(:last-child)::after { content: "→"; position: absolute; right: -14px; top: 42%; color: var(--blue); font-weight: 800; }
    .step b { display: block; color: var(--navy); margin-bottom: 4px; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; background: #fff; }
    table { width: 100%; border-collapse: collapse; min-width: 980px; }
    th, td { border-bottom: 1px solid var(--line); padding: 10px; text-align: left; vertical-align: top; color: #111827; overflow-wrap: anywhere; }
    th { background: #eaf3fb; color: #0f3b63; font-size: 13px; white-space: nowrap; }
    td { font-size: 13px; }
    .good { color: var(--green); font-weight: 800; }
    .warn { color: var(--amber); font-weight: 800; }
    .bad { color: var(--red); font-weight: 800; }
    .note { border-left: 5px solid var(--blue); padding: 12px 14px; background: #f8fbff; border-radius: 10px; }
    .warning { border-color: #f59e0b; background: var(--amber-bg); }
    .danger { border-color: #ef4444; background: var(--red-bg); }
    .special { border-color: #8b5cf6; background: var(--violet-bg); }
    ul { margin: 0; padding-left: 20px; }
    li { margin: 3px 0; }
    @media (max-width: 900px) {
      main { width: min(100% - 20px, 1180px); }
      .kpis, .cards, .flow { grid-template-columns: 1fr; }
      .step:not(:last-child)::after { display: none; }
    }
  </style>
</head>
<body>
<main>
  <section class="hero">
    <h1>IPO・未上場メガイベント特別枠</h1>
    <p class="lead">SpaceX、OpenAI級のIPOは、通常の日本株NISA候補10社とは別枠で監視します。上場前はNISAで買えないため、直接候補ではなく、市場イベント・AI/半導体/宇宙テーマへの波及、上場後のNISA適格性を確認するコーナーです。</p>
    <div class="toolbar">
      <a class="button dark" href="index.html">メインページへ</a>
      <a class="button dark" href="event_collection_hub.html">上場・IPO・イベント収集へ</a>
      <a class="button dark" href="event_causality_validation_20260525.html">イベント因果チェックへ</a>
      <a class="button dark" href="semiconductor_quant_gate_connection_20260526.html">半導体量的ゲート接続へ</a>
      <a class="button" href="371_ipo_special_watch_summary.csv">371 要約CSV</a>
      <a class="button" href="372_ipo_special_watchlist.csv">372 監視リストCSV</a>
      <a class="button" href="373_ipo_nisa_eligibility_rules.csv">373 NISA可否CSV</a>
      <a class="button" href="374_ipo_observation_gate_rules.csv">374 観察ゲートCSV</a>
      <a class="button" href="375_ipo_special_score_model.csv">375 スコアCSV</a>
      <a class="button" href="376_ipo_special_sources.csv">376 取得元CSV</a>
    </div>
  </section>

  <div class="kpis">
    ${summaryRows.map((row) => `<div class="kpi"><span>${esc(row.item)}</span><b>${esc(row.value)}</b></div>`).join('\n')}
  </div>

  <section>
    <h2>運用上の結論</h2>
    <div class="note special">
      <p><b>通常候補10社には混ぜません。</b> これは別枠の「巨大IPO・未上場イベント監視」です。</p>
      <p>未上場の間はNISAで買えません。上場後も、証券会社のNISA成長投資枠で取扱が確認でき、公開財務・初値後の値動き・20営業日反応が揃うまでは購入検討に進めません。</p>
    </div>
  </section>

  <section>
    <h2>なぜ別枠か</h2>
    <div class="cards">
      <div class="card"><b>データ不足</b><p>上場前は株価、出来高、PER、決算後反応、指数比較が揃わないため通常スコアに混ぜられません。</p></div>
      <div class="card"><b>NISA確認が必要</b><p>未上場株は不可。上場後も、外国株として証券会社がNISA預りで扱うか確認が必要です。</p></div>
      <div class="card"><b>市場イベントとして重要</b><p>直接買えなくても、AI、半導体、宇宙、防衛、データセンター関連の資金流入/流出に影響します。</p></div>
    </div>
  </section>

  <section>
    <h2>監視対象</h2>
    ${table([
      { label: '対象', key: 'company' },
      { label: '状態', key: 'ticker_or_status' },
      { label: 'テーマ', key: 'theme' },
      { label: '扱い', key: 'current_status', className: (row) => statusClass(row.current_status) },
      { label: 'NISA', key: 'nisa_status', className: (row) => statusClass(row.nisa_status) },
      { label: '見る理由', key: 'why_watch' },
      { label: '直接買う条件', key: 'direct_buy_rule' },
      { label: '間接影響', key: 'indirect_watch' },
      { label: 'リスク', key: 'risk_level', className: (row) => statusClass(row.risk_level) },
    ], watchRows)}
  </section>

  <section>
    <h2>NISA可否ルール</h2>
    ${table([
      { label: '条件', key: 'condition' },
      { label: 'NISA判断', key: 'nisa_judgement', className: (row) => statusClass(row.nisa_judgement) },
      { label: '説明', key: 'explanation' },
      { label: '行動', key: 'action' },
    ], nisaRows)}
  </section>

  <section>
    <h2>観察フロー</h2>
    <div class="flow">
      <div class="step"><b>1. 上場前</b><span>報道とS-1/目論見書の有無だけ記録。買わない。</span></div>
      <div class="step"><b>2. 上場日</b><span>初値・出来高・IPO価格比を記録。初値追いは禁止。</span></div>
      <div class="step"><b>3. 5営業日</b><span>急騰/急落、出来高、NASDAQ比を確認。</span></div>
      <div class="step"><b>4. 20営業日</b><span>指数+1%比較、最大下落率、価格形成を確認。</span></div>
      <div class="step"><b>5. 決算後</b><span>売上成長、赤字、FCF、ガイダンスで最終確認。</span></div>
    </div>
  </section>

  <section>
    <h2>観察ゲート</h2>
    ${table([
      { label: '段階', key: 'phase' },
      { label: '見る項目', key: 'check_item' },
      { label: '進める条件', key: 'pass_condition' },
      { label: '停止時の扱い', key: 'fail_action' },
    ], gateRows)}
  </section>

  <section>
    <h2>特別枠スコア設計</h2>
    <div class="note warning">
      <p><b>このスコアは上場後にだけ使います。</b> 報道や期待だけでは点数化しません。</p>
    </div>
    ${table([
      { label: '構成要素', key: 'component' },
      { label: '重み', key: 'weight' },
      { label: '計算内容', key: 'formula' },
      { label: '注意', key: 'note' },
    ], scoreRows)}
  </section>

  <section>
    <h2>取得元・確認先</h2>
    ${table([
      { label: '取得元', key: 'source_name' },
      { label: 'URL', value: (row) => row.url },
      { label: '用途', key: 'use' },
    ], sourceRows)}
  </section>
</main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'ipo_special_watch_corner_20260526.html'), html, 'utf8');

console.log('built IPO special watch corner');
