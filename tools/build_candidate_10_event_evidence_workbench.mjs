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

const boardRows = readCsv('419_june_test_10_selection_board.csv');
const hypothesisRows = readCsv('424_candidate_10_event_hypothesis_layers.csv');
const hypothesisByTicker = new Map(hypothesisRows.map((row) => [row.ticker, row]));

const eventCatalog = {
  '6762.T': [
    ['6762-01', 'AIサーバー需要', 'データセンター増設、AIサーバー投資、電源部品需要', '電子部品需要の増加が確認できれば追い風', '日経平均 / TOPIX / 電子部品同業'],
    ['6762-02', '為替・海外売上', '円安、海外売上比率、材料費', '円安は売上換算に追い風だが材料費上昇は逆風', '日経平均 / ドル円'],
    ['6762-03', '電池・磁性材料', 'EV、蓄電池、HDD/データセンター関連部品', 'AI周辺需要が電子部品の構造需要へ波及するか確認', '日経平均 / 電子部品同業'],
  ],
  '2802.T': [
    ['2802-01', '食品値上げ耐性', '食品価格、原材料価格、値上げ浸透', '値上げ後も販売数量が崩れなければ利益率改善の可能性', 'TOPIX / 食品同業'],
    ['2802-02', 'ABF・ヘルスケア', '半導体材料ABF、アミノ酸、ヘルスケア売上', '高PERを正当化できる成長が続くか確認', 'TOPIX / 食品同業 / 半導体材料関連'],
    ['2802-03', '円安・原材料', '為替、穀物、物流費、エネルギー価格', '原価上昇が利益を圧迫しないか確認', '日経平均 / ドル円'],
  ],
  '8766.T': [
    ['8766-01', '保険料率・金利', '保険料改定、国内外金利、運用収益', '金利上昇と保険料率改善が利益へつながるか確認', 'TOPIX / 保険同業'],
    ['8766-02', '自然災害・損害率', '台風、豪雨、地震、損害率', '大規模災害による損害率悪化を確認', 'TOPIX / 保険同業'],
    ['8766-03', '政策保有株売却', '政策保有株売却、自己株買い、株主還元', '資本効率改善が株価評価に反映されるか確認', 'TOPIX / 保険同業'],
  ],
  '8316.T': [
    ['8316-01', '日銀・金利', '日銀会合、長短金利、利ざや', '金利上昇が利ざや改善につながるか確認', 'TOPIX / 銀行指数'],
    ['8316-02', '信用コスト', '貸倒引当、景気悪化、企業倒産', '利ざや改善を信用コストが相殺しないか確認', 'TOPIX / 銀行指数'],
    ['8316-03', '海外金利・為替', '米金利、ドル円、海外事業', '海外金利と為替が利益に与える影響を確認', 'TOPIX / ドル円'],
  ],
  '8306.T': [
    ['8306-01', '日銀・金利', '日銀会合、短期金利、長期金利', '金利正常化が利ざや改善につながるか確認', 'TOPIX / 銀行指数'],
    ['8306-02', '海外金利・景気', '米金利、海外融資、信用コスト', '海外景気悪化時の下押しを確認', 'TOPIX / 銀行指数'],
    ['8306-03', '株主還元', '自社株買い、配当、資本効率', '大型銀行の還元強化が評価されるか確認', 'TOPIX / 銀行指数'],
  ],
  '6367.T': [
    ['6367-01', 'データセンター冷却', 'AIデータセンター、空調・冷却需要', 'AI電力・冷却需要が空調需要に波及するか確認', 'TOPIX / 機械同業'],
    ['6367-02', '地域別空調需要', '猛暑、住宅投資、商業施設投資', '気候・設備投資が売上に反映されるか確認', 'TOPIX / 機械同業'],
    ['6367-03', '中国・為替', '中国需要、欧米需要、ドル円', '地域需要の弱さと円安効果の綱引きを確認', 'TOPIX / ドル円'],
  ],
  '6503.T': [
    ['6503-01', '電力・データセンター', '電力投資、データセンター、受配電設備', 'AIインフラ投資が電力機器需要につながるか確認', 'TOPIX / 電機同業'],
    ['6503-02', 'FA・設備投資', 'FA受注、製造業投資、半導体設備投資', '設備投資サイクルの改善が確認できるか確認', 'TOPIX / 電機同業'],
    ['6503-03', '防衛・宇宙', '防衛予算、衛星、宇宙関連', '政策テーマが売上に結び付くか確認', 'TOPIX / 電機同業'],
  ],
  '5020.T': [
    ['5020-01', '原油・精製マージン', '原油価格、精製マージン、在庫評価', '原油高だけでなく利益率が改善するか確認', 'TOPIX / エネルギー同業'],
    ['5020-02', '中東・海上輸送', 'ホルムズ海峡、中東情勢、輸送費', '供給不安が価格とマージンへどう出るか確認', 'TOPIX / 原油先物'],
    ['5020-03', '脱炭素・構造転換', '再エネ、水素、素材、設備投資', '長期テーマが収益化しているか確認', 'TOPIX / エネルギー同業'],
  ],
  '6146.T': [
    ['6146-01', 'AI半導体・HBM', 'AI半導体、HBM、先端パッケージ', '高精度加工需要が強いか確認', '日経平均 / SOX / 半導体装置同業'],
    ['6146-02', '半導体設備投資', 'メモリ投資、ロジック投資、装置受注', '設備投資サイクルの上向きを確認', '日経平均 / SOX'],
    ['6146-03', '高PER・過熱', 'PER、SOX下落、決算期待', '好材料でも過熱時に下落しやすいか確認', '日経平均 / SOX'],
  ],
  '4385.T': [
    ['4385-01', '国内消費', '個人消費、フリマ流通総額、景気', '消費環境が取引量に効くか確認', 'TOPIX / ネット同業'],
    ['4385-02', 'FinTech・広告', '決済、与信、広告、セグメント利益', '周辺事業の利益化が確認できるか確認', 'TOPIX / ネット同業'],
    ['4385-03', '規制・競争', '規制、手数料、競合、ユーザー成長', '成長鈍化や規制の逆風を確認', 'TOPIX / ネット同業'],
  ],
};

const evidenceRows = boardRows.flatMap((row) => {
  const events = eventCatalog[row.ticker] || [
    [`${row.ticker}-01`, '個別イベント', '決算、政策、業界ニュース', '株価反応で確認', '日経平均 / TOPIX'],
  ];
  const h = hypothesisByTicker.get(row.ticker) || {};
  return events.map(([eventId, eventTheme, eventSignal, hypothesis, benchmark]) => ({
    updated_at: generatedAt,
    event_id: eventId,
    ticker: row.ticker,
    company: row.company,
    lane: row.lane,
    event_theme: eventTheme,
    qualitative_signal: eventSignal,
    hypothesis_layer: hypothesis,
    prior_hypothesis_note: h.hypothesis_layer || '',
    event_date: '',
    event_source: '',
    benchmark,
    stock_price_before: '',
    stock_price_1d: '',
    stock_price_5d: '',
    stock_price_20d: '',
    benchmark_before: '',
    benchmark_1d: '',
    benchmark_5d: '',
    benchmark_20d: '',
    stock_return_1d_pct: '',
    stock_return_5d_pct: '',
    stock_return_20d_pct: '',
    benchmark_return_1d_pct: '',
    benchmark_return_5d_pct: '',
    benchmark_return_20d_pct: '',
    excess_return_1d_pct: '',
    excess_return_5d_pct: '',
    excess_return_20d_pct: '',
    direction_match: '',
    evidence_rating: '未判定',
    score_policy: '仮説だけでは加点しない。実績入力後に説明材料または候補維持条件として使う。',
    purchase_status: '購入判断不可',
    note: '6月イベント後に実数を入力して判定する。',
  }));
});

const summaryRows = boardRows.map((row) => {
  const events = evidenceRows.filter((event) => event.ticker === row.ticker);
  return {
    updated_at: generatedAt,
    ticker: row.ticker,
    company: row.company,
    current_lane: row.lane,
    event_hypotheses: events.length,
    evidence_completed: 0,
    evidence_pending: events.length,
    qualitative_score_added_now: 0,
    next_required_work: 'イベント日、公式ソース、株価1日/5日/20日、ベンチマーク反応を入力',
    purchase_status: '購入判断不可',
    reason: '時流仮説は候補発見に使うが、実績層が未入力のため購入候補スコアには入れない。',
  };
});

const ratingRuleRows = [
  {
    updated_at: generatedAt,
    rating: 'S',
    condition: '1日・5日・20日の超過リターンが概ねプラスで、5日または20日が+3%以上。仮説方向とも一致。',
    use: '候補維持を強く支持。ただし財務・割高・市場イベントゲートを別途通す。',
  },
  {
    updated_at: generatedAt,
    rating: 'A',
    condition: '5日または20日の超過リターンが+1%以上で、仮説方向と大きく矛盾しない。',
    use: '候補維持を支持。追加確認を残す。',
  },
  {
    updated_at: generatedAt,
    rating: 'B',
    condition: '反応は中立、または1日だけ強く5日/20日で失速。',
    use: '候補維持は可能だが、時流材料は弱い扱い。',
  },
  {
    updated_at: generatedAt,
    rating: 'C',
    condition: '超過リターンがマイナス、または仮説と逆方向の反応。',
    use: '時流材料を根拠から外す。ほかの定量条件が弱ければ候補から外す。',
  },
  {
    updated_at: generatedAt,
    rating: '未判定',
    condition: 'イベント日、株価、指数のいずれかが未入力。',
    use: 'スコアに入れない。説明資料では未検証として扱う。',
  },
];

const sourcePlanRows = evidenceRows.map((row) => ({
  updated_at: generatedAt,
  event_id: row.event_id,
  ticker: row.ticker,
  company: row.company,
  event_theme: row.event_theme,
  primary_source: '企業IR、決算短信、決算説明資料、日銀/FRB/官公庁、取引所開示',
  price_source: '株価OHLCV、日経平均/TOPIX、必要に応じてSOX・業種指数',
  validation_unit: 'イベント前日終値、イベント後1営業日/5営業日/20営業日の終値',
  formula: '超過リターン = 個別株リターン - ベンチマークリターン',
  status: '取得待ち',
}));

const operationRows = [
  {
    updated_at: generatedAt,
    step: 1,
    operation: 'イベントを登録',
    detail: '決算、日銀、FOMC、製品発売、政策、業界需給などをevent_dateとevent_sourceに記録する。',
    output: '428_candidate_10_event_evidence_input_template.csv',
  },
  {
    updated_at: generatedAt,
    step: 2,
    operation: '株価と指数を入力',
    detail: 'イベント前日、1営業日後、5営業日後、20営業日後の個別株とベンチマークを入れる。',
    output: '株価反応の比較表',
  },
  {
    updated_at: generatedAt,
    step: 3,
    operation: '超過リターンを計算',
    detail: '個別株が指数をどれだけ上回ったかを見る。イベントで市場全体が上がっただけの錯覚を避ける。',
    output: 'excess_return_1d/5d/20d',
  },
  {
    updated_at: generatedAt,
    step: 4,
    operation: 'S〜C判定',
    detail: '反応が仮説方向と一致し、5日/20日でも残るかを見る。短期の一瞬だけなら過信しない。',
    output: 'evidence_rating',
  },
  {
    updated_at: generatedAt,
    step: 5,
    operation: '10社候補を再判定',
    detail: '定量スコアを主、イベント実績を補助として使う。仮説単体は購入候補スコアに入れない。',
    output: '6月テスト候補の維持/保留/除外',
  },
];

writeCsv('427_candidate_10_event_evidence_summary.csv', summaryRows, [
  'updated_at',
  'ticker',
  'company',
  'current_lane',
  'event_hypotheses',
  'evidence_completed',
  'evidence_pending',
  'qualitative_score_added_now',
  'next_required_work',
  'purchase_status',
  'reason',
]);

writeCsv('428_candidate_10_event_evidence_input_template.csv', evidenceRows, [
  'updated_at',
  'event_id',
  'ticker',
  'company',
  'lane',
  'event_theme',
  'qualitative_signal',
  'hypothesis_layer',
  'prior_hypothesis_note',
  'event_date',
  'event_source',
  'benchmark',
  'stock_price_before',
  'stock_price_1d',
  'stock_price_5d',
  'stock_price_20d',
  'benchmark_before',
  'benchmark_1d',
  'benchmark_5d',
  'benchmark_20d',
  'stock_return_1d_pct',
  'stock_return_5d_pct',
  'stock_return_20d_pct',
  'benchmark_return_1d_pct',
  'benchmark_return_5d_pct',
  'benchmark_return_20d_pct',
  'excess_return_1d_pct',
  'excess_return_5d_pct',
  'excess_return_20d_pct',
  'direction_match',
  'evidence_rating',
  'score_policy',
  'purchase_status',
  'note',
]);

writeCsv('429_candidate_10_event_rating_rules.csv', ratingRuleRows, ['updated_at', 'rating', 'condition', 'use']);
writeCsv('430_candidate_10_event_source_plan.csv', sourcePlanRows, [
  'updated_at',
  'event_id',
  'ticker',
  'company',
  'event_theme',
  'primary_source',
  'price_source',
  'validation_unit',
  'formula',
  'status',
]);
writeCsv('431_candidate_10_event_evidence_operation.csv', operationRows, [
  'updated_at',
  'step',
  'operation',
  'detail',
  'output',
]);

const topSummary = [
  ['対象銘柄', `${boardRows.length}社`],
  ['イベント仮説', `${evidenceRows.length}件`],
  ['実績入力済み', '0件'],
  ['今回の質的加点', '0点'],
  ['購入判断', '0社'],
];

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 イベント実績層ワークベンチ</title>
  <style>
    :root {
      --ink: #111827;
      --muted: #4b5563;
      --line: #cfdced;
      --bg: #f5f8fc;
      --panel: #ffffff;
      --navy: #113a5c;
      --blue: #176da3;
      --sky: #e8f4ff;
      --green: #087a4d;
      --red: #b42318;
      --orange: #b65c00;
      --yellow: #fff7d6;
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
    main {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
      padding: 28px 0 56px;
    }
    .hero {
      background: var(--navy);
      color: white;
      border-radius: 18px;
      padding: 26px;
      margin-bottom: 18px;
      display: grid;
      grid-template-columns: minmax(0, 1.4fr) minmax(280px, .6fr);
      gap: 20px;
      align-items: center;
    }
    h1 {
      font-size: clamp(26px, 4vw, 42px);
      line-height: 1.2;
      margin: 0 0 10px;
      letter-spacing: 0;
    }
    h2 {
      font-size: 24px;
      color: var(--navy);
      margin: 0 0 10px;
      letter-spacing: 0;
    }
    h3 { margin: 0 0 8px; color: var(--navy); }
    p { margin: 0 0 12px; }
    .hero p { color: #e8f4ff; }
    .kpis {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .kpi {
      background: white;
      color: var(--ink);
      border-radius: 12px;
      padding: 12px;
      border: 1px solid #c9def3;
    }
    .kpi b { display: block; color: var(--blue); font-size: 26px; line-height: 1; }
    .kpi span { color: var(--muted); font-size: 12px; }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 18px;
      margin-bottom: 16px;
      box-shadow: 0 8px 20px rgba(20, 57, 91, .06);
    }
    .notice {
      border: 2px solid #f0c36c;
      background: var(--yellow);
      border-radius: 14px;
      padding: 14px 16px;
      font-weight: 700;
      color: #5f3900;
      margin-bottom: 16px;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 14px;
    }
    .flow {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 8px;
    }
    .flow .step {
      min-height: 96px;
      border: 1px solid var(--line);
      background: #f8fbff;
      border-radius: 12px;
      padding: 10px;
      position: relative;
    }
    .flow .step:not(:last-child)::after {
      content: ">";
      position: absolute;
      right: -8px;
      top: 36px;
      color: var(--blue);
      font-weight: 900;
    }
    .step b { color: var(--blue); }
    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 28px;
      padding: 4px 9px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: #f8fbff;
      font-weight: 700;
      font-size: 12px;
      white-space: nowrap;
    }
    .badge.red { color: var(--red); background: #fff1f1; border-color: #ffd1d1; }
    .badge.green { color: var(--green); background: #edf9f3; border-color: #bce7d2; }
    .badge.orange { color: var(--orange); background: #fff3e2; border-color: #ffd7a3; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; }
    table {
      width: 100%;
      min-width: 920px;
      border-collapse: collapse;
      table-layout: fixed;
      background: white;
    }
    th, td {
      border-bottom: 1px solid var(--line);
      border-right: 1px solid var(--line);
      padding: 9px 10px;
      vertical-align: top;
      text-align: left;
      overflow-wrap: anywhere;
      word-break: break-word;
      color: var(--ink);
    }
    th {
      background: #e8f4ff;
      color: #073b63;
      font-weight: 800;
    }
    tr:last-child td { border-bottom: 0; }
    th:last-child, td:last-child { border-right: 0; }
    .small { color: var(--muted); font-size: 13px; }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 12px;
    }
    a.button, button.button, label.button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 40px;
      padding: 8px 12px;
      border-radius: 10px;
      border: 1px solid #9dc7e8;
      background: #fff;
      color: var(--navy);
      text-decoration: none;
      font-weight: 800;
      cursor: pointer;
    }
    input[type="file"] { display: none; }
    #csvPreview { margin-top: 12px; }
    .formula {
      background: #f7fafc;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 12px;
      font-family: Consolas, "Yu Gothic", monospace;
      white-space: normal;
      overflow-wrap: anywhere;
    }
    @media (max-width: 900px) {
      main { width: min(100% - 20px, 1180px); padding-top: 16px; }
      .hero { grid-template-columns: 1fr; padding: 20px; }
      .grid-2 { grid-template-columns: 1fr; }
      .flow { grid-template-columns: 1fr; }
      .flow .step:not(:last-child)::after { display: none; }
      table { min-width: 760px; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <div>
        <h1>候補10社 イベント実績層ワークベンチ</h1>
        <p>質的データで「なぜ伸びるか」の仮説を作り、株価・指数・出来高の実績反応で検証するための作業台です。仮説は候補発見に使いますが、実績が入るまでは購入候補スコアへ加点しません。</p>
        <div class="actions">
          <a class="button" href="index.html">トップへ戻る</a>
          <a class="button" href="june_test_10_selection_board_20260526.html">10社選定表</a>
          <a class="button" href="428_candidate_10_event_evidence_input_template.csv">入力テンプレートCSV</a>
        </div>
      </div>
      <div class="kpis">
        ${topSummary.map(([label, value]) => `<div class="kpi"><b>${esc(value)}</b><span>${esc(label)}</span></div>`).join('\n')}
      </div>
    </section>

    <div class="notice">
      重要: 現時点ではイベント仮説の実績層が未入力です。したがって、質的データによる加点は0点、購入判断は0社です。
    </div>

    <section class="panel">
      <h2>このページで行うこと</h2>
      <div class="flow">
        <div class="step"><b>1. 仮説</b><br>時流・ニュース・製品・政策から関連テーマを出す。</div>
        <div class="step"><b>2. 銘柄</b><br>テーマに関係する候補10社へひも付ける。</div>
        <div class="step"><b>3. 日付</b><br>イベント日と公式ソースを記録する。</div>
        <div class="step"><b>4. 反応</b><br>1日・5日・20日の株価反応を入れる。</div>
        <div class="step"><b>5. 比較</b><br>日経平均/TOPIX等を上回ったかを見る。</div>
        <div class="step"><b>6. 判定</b><br>S〜Cで実績層を評価し、10社を再判定する。</div>
      </div>
    </section>

    <section class="grid-2">
      <div class="panel">
        <h2>計算式</h2>
        <div class="formula">
          個別リターン = (イベント後株価 - イベント前株価) ÷ イベント前株価 × 100<br>
          ベンチマークリターン = (イベント後指数 - イベント前指数) ÷ イベント前指数 × 100<br>
          超過リターン = 個別リターン - ベンチマークリターン
        </div>
        <p class="small">市場全体が上がっただけの反応を、個別銘柄の実力として扱わないための式です。</p>
      </div>
      <div class="panel">
        <h2>CSV読み込み・計算・出力</h2>
        <p class="small">入力後のCSVをここへ読み込むと、個別リターン、ベンチマークリターン、超過リターン、S〜C判定をブラウザ内で計算します。実績値が入っていない行は未判定のままです。</p>
        <label class="button" for="csvFile">CSVを読み込む</label>
        <button class="button" id="downloadCsv" type="button" hidden>計算済みCSVを出力</button>
        <input id="csvFile" type="file" accept=".csv,text/csv">
        <div id="csvPreview" class="small">未読み込み</div>
      </div>
    </section>

    <section class="panel">
      <h2>候補10社の実績層ステータス</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width: 110px;">銘柄</th>
              <th style="width: 170px;">会社</th>
              <th style="width: 120px;">区分</th>
              <th style="width: 110px;">仮説件数</th>
              <th style="width: 130px;">実績入力</th>
              <th>次に必要な作業</th>
              <th style="width: 130px;">判定</th>
            </tr>
          </thead>
          <tbody>
            ${summaryRows.map((row) => `
              <tr>
                <td>${esc(row.ticker)}</td>
                <td>${esc(row.company)}</td>
                <td>${esc(row.current_lane)}</td>
                <td>${esc(row.event_hypotheses)}件</td>
                <td>${esc(row.evidence_completed)} / ${esc(row.event_hypotheses)}</td>
                <td>${esc(row.next_required_work)}</td>
                <td><span class="badge red">${esc(row.purchase_status)}</span></td>
              </tr>`).join('\n')}
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel">
      <h2>イベント実績層 入力テンプレート</h2>
      <p class="small">下表は入力対象の一部です。全件はCSVに出力しています。</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width: 110px;">ID</th>
              <th style="width: 110px;">銘柄</th>
              <th style="width: 170px;">テーマ</th>
              <th>質的シグナル</th>
              <th>仮説層</th>
              <th style="width: 170px;">比較対象</th>
              <th style="width: 120px;">評価</th>
            </tr>
          </thead>
          <tbody>
            ${evidenceRows.slice(0, 18).map((row) => `
              <tr>
                <td>${esc(row.event_id)}</td>
                <td>${esc(row.ticker)}</td>
                <td>${esc(row.event_theme)}</td>
                <td>${esc(row.qualitative_signal)}</td>
                <td>${esc(row.hypothesis_layer)}</td>
                <td>${esc(row.benchmark)}</td>
                <td><span class="badge orange">${esc(row.evidence_rating)}</span></td>
              </tr>`).join('\n')}
          </tbody>
        </table>
      </div>
      <div class="actions">
        <a class="button" href="427_candidate_10_event_evidence_summary.csv">概要CSV</a>
        <a class="button" href="428_candidate_10_event_evidence_input_template.csv">入力CSV</a>
        <a class="button" href="429_candidate_10_event_rating_rules.csv">判定ルールCSV</a>
        <a class="button" href="430_candidate_10_event_source_plan.csv">取得計画CSV</a>
        <a class="button" href="431_candidate_10_event_evidence_operation.csv">運用手順CSV</a>
      </div>
    </section>

    <section class="panel">
      <h2>S〜C判定ルール</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width: 90px;">評価</th>
              <th>条件</th>
              <th>使い方</th>
            </tr>
          </thead>
          <tbody>
            ${ratingRuleRows.map((row) => `
              <tr>
                <td><span class="badge ${row.rating === 'C' ? 'red' : row.rating === '未判定' ? 'orange' : 'green'}">${esc(row.rating)}</span></td>
                <td>${esc(row.condition)}</td>
                <td>${esc(row.use)}</td>
              </tr>`).join('\n')}
          </tbody>
        </table>
      </div>
    </section>
  </main>
  <script>
    const fileInput = document.getElementById('csvFile');
    const preview = document.getElementById('csvPreview');
    const downloadButton = document.getElementById('downloadCsv');
    let calculatedRows = [];

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
        } else if (ch === '\\n') {
          row.push(cell.replace(/\\r$/, ''));
          rows.push(row);
          row = [];
          cell = '';
        } else cell += ch;
      }
      if (cell.length || row.length) rows.push([...row, cell.replace(/\\r$/, '')]);
      return rows.filter((items) => items.some((item) => String(item).trim() !== ''));
    }

    function toNumber(value) {
      const n = Number(String(value ?? '').replace(/,/g, ''));
      return Number.isFinite(n) ? n : null;
    }

    function pct(after, before) {
      const a = toNumber(after);
      const b = toNumber(before);
      if (a === null || b === null || b === 0) return '';
      return Number((((a - b) / b) * 100).toFixed(2));
    }

    function diff(a, b) {
      if (a === '' || b === '') return '';
      return Number((Number(a) - Number(b)).toFixed(2));
    }

    function evaluate(row) {
      const reverse = String(row.direction_match || '').includes('逆');
      const ex1 = toNumber(row.excess_return_1d_pct);
      const ex5 = toNumber(row.excess_return_5d_pct);
      const ex20 = toNumber(row.excess_return_20d_pct);
      if ([ex1, ex5, ex20].some((v) => v === null)) return '未判定';
      if (reverse) return 'C';
      if (ex1 >= 0 && (ex5 >= 3 || ex20 >= 3)) return 'S';
      if (ex5 >= 1 || ex20 >= 1) return 'A';
      if (ex5 > -1 && ex20 > -1) return 'B';
      return 'C';
    }

    function rowObjects(rows) {
      const headers = rows[0] || [];
      return rows.slice(1).map((items) => Object.fromEntries(headers.map((h, i) => [h, items[i] ?? ''])));
    }

    function calculateRows(rows) {
      return rows.map((row) => {
        const stock1 = pct(row.stock_price_1d, row.stock_price_before);
        const stock5 = pct(row.stock_price_5d, row.stock_price_before);
        const stock20 = pct(row.stock_price_20d, row.stock_price_before);
        const bench1 = pct(row.benchmark_1d, row.benchmark_before);
        const bench5 = pct(row.benchmark_5d, row.benchmark_before);
        const bench20 = pct(row.benchmark_20d, row.benchmark_before);
        const next = {
          ...row,
          stock_return_1d_pct: stock1,
          stock_return_5d_pct: stock5,
          stock_return_20d_pct: stock20,
          benchmark_return_1d_pct: bench1,
          benchmark_return_5d_pct: bench5,
          benchmark_return_20d_pct: bench20,
          excess_return_1d_pct: diff(stock1, bench1),
          excess_return_5d_pct: diff(stock5, bench5),
          excess_return_20d_pct: diff(stock20, bench20),
        };
        next.evidence_rating = evaluate(next);
        next.purchase_status = '購入判断不可';
        return next;
      });
    }

    function toCsv(rows) {
      if (!rows.length) return '';
      const headers = Object.keys(rows[0]);
      const esc = (value) => {
        const text = String(value ?? '');
        return /[",\\n\\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
      };
      return '\\uFEFF' + [headers.join(','), ...rows.map((row) => headers.map((h) => esc(row[h])).join(','))].join('\\n') + '\\n';
    }

    function escHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      }[ch]));
    }

    fileInput.addEventListener('change', async () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      const text = await file.text();
      const rows = parseCsv(text);
      const headers = rows[0] || [];
      const data = rowObjects(rows);
      calculatedRows = calculateRows(data);
      const previewHeaders = ['event_id', 'ticker', 'event_theme', 'stock_return_5d_pct', 'benchmark_return_5d_pct', 'excess_return_5d_pct', 'evidence_rating', 'purchase_status'];
      const headHtml = previewHeaders.map((h) => \`<th>\${escHtml(h)}</th>\`).join('');
      const bodyHtml = calculatedRows.slice(0, 8).map((row) => \`<tr>\${previewHeaders.map((h) => \`<td>\${escHtml(row[h])}</td>\`).join('')}</tr>\`).join('');
      const judged = calculatedRows.filter((row) => row.evidence_rating !== '未判定').length;
      downloadButton.hidden = false;
      preview.innerHTML = \`
        <p><b>\${escHtml(file.name)}</b> を読み込みました。データ行: \${data.length}件、列: \${headers.length}列。S〜C判定済み: \${judged}件。</p>
        <div class="table-wrap"><table><thead><tr>\${headHtml}</tr></thead><tbody>\${bodyHtml}</tbody></table></div>
      \`;
    });

    downloadButton.addEventListener('click', () => {
      const csv = toCsv(calculatedRows);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'candidate_10_event_evidence_calculated.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  </script>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_event_evidence_workbench_20260526.html'), html, 'utf8');

console.log('created candidate_10_event_evidence_workbench_20260526.html');
console.log(`created ${summaryRows.length} summary rows and ${evidenceRows.length} event evidence rows`);
