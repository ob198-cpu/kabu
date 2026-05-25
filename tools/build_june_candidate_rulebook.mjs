import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const REPORT_DIR = path.resolve(ROOT, '..', 'reports');
fs.mkdirSync(REPORT_DIR, { recursive: true });

const generatedAt = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date());

const VERIFIED_EVENTS = [
  {
    date: '2026-06-10',
    event: '米5月CPI',
    source: 'BLS CPI release schedule',
    source_url: 'https://www.bls.gov/schedule/news_release/cpi.htm',
    check: '総合CPI前年比、前月比、コア前月比、米10年金利',
    proceed: '総合前年比3.8%以下、前月比0.4%以下、コア前月比0.4%以下、米10年金利4.60%未満',
    caution: '総合前年比3.9〜4.0%、前月比0.5%、米10年金利4.60〜4.70%',
    stop: '総合前年比4.0%超、コア前月比0.5%以上、米10年金利4.70%以上',
    action: '悪化時は高PER・半導体・グロース寄りを購入検討へ進めない。',
  },
  {
    date: '2026-06-15〜2026-06-16',
    event: '日銀金融政策決定会合',
    source: '日本銀行 2026年会合予定',
    source_url: 'https://www.boj.or.jp/en/about/calendar/index.htm',
    check: 'USD/JPY、日経平均、銀行株、輸出株',
    proceed: '会合後2営業日で円高3%未満、日経平均-3%以内、銀行株がTOPIX比で大きく崩れない',
    caution: '円高2〜3%、日経平均-2〜-3%、銀行株の反応が鈍い',
    stop: '円高3%以上、日経平均-3%以上、銀行株がTOPIX比-3%以上',
    action: '円高ショック時は輸出・半導体・海外売上比率が高い銘柄を待機にする。',
  },
  {
    date: '2026-06-16〜2026-06-17',
    event: 'FOMC',
    source: 'Federal Reserve FOMC calendar',
    source_url: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
    check: '米10年金利、NASDAQ、SOX指数、ドル円、FOMC声明',
    proceed: '米10年金利4.60%未満、NASDAQ/SOXが2営業日で-3%以内、ドル円急変なし',
    caution: '米10年金利4.60〜4.70%、NASDAQ/SOX -3〜-5%',
    stop: '米10年金利4.70%以上、NASDAQ/SOX -5%以上、ドル円±3%以上の急変',
    action: '金利急騰時はPER高め、AI・半導体テーマの候補を購入検討へ進めない。',
  },
  {
    date: '2026-06-18〜2026-06-24',
    event: '6月一次判定週',
    source: '本システム運用ルール',
    source_url: 'candidate_june_rulebook.html',
    check: 'CPI、日銀、FOMC後の市場反応、各銘柄の20営業日決算反応、日経75日線',
    proceed: '共通ゲート通過、日経75日線以上または下抜け-1%以内、候補銘柄に下方修正なし',
    caution: '日経75日線-1〜-2%、候補の20営業日反応が未到達、個別材料が未確認',
    stop: '日経75日線-2%以上、候補の決算後反応35点未満、下方修正または会計リスク',
    action: '通過銘柄だけを購入検討へ進め、未到達・未確認銘柄は候補維持または待機にする。',
  },
];

const TICKER_RULES = {
  '4385.T': {
    type: 'グロース/ネット',
    main_risk: '金利上昇と市場リスクオフで高成長株が売られやすい。PER未取得のため割高評価の完全確認が未了。',
    proceed: '20営業日超過リターンが0%以上、PBRが急拡大していない、米10年金利4.60%未満、NASDAQが崩れていない',
    caution: '20営業日未到達、または超過リターン-5%以内、米金利4.60〜4.70%',
    stop: '20営業日超過-5%以下、米金利4.70%以上、決算後反応35点未満、PER/PBR確認不能が続く',
    next_action: '6月判定では小口検討または候補維持。PER相当の割高確認が取れるまで比率を上げない。',
  },
  '2802.T': {
    type: '食品/ヘルスケア',
    main_risk: '予想PER43.73倍、PBR6.81倍で割安余地は小さい。決算反応と次期成長確認が必要。',
    proceed: '20営業日超過リターン0%以上、PER45倍未満、PBR7倍未満、会社見通しに下方修正なし',
    caution: '20営業日未到達、PER45倍接近、日経より強いが出来高確認不足',
    stop: 'PER45倍以上かつPBR7倍以上、20営業日超過-5%以下、営業利益見通し悪化',
    next_action: '価格を追わず、割高ゲートを通った場合のみ小口検討。割高継続なら待機。',
  },
  '8316.T': {
    type: '銀行',
    main_risk: '金利上昇は追い風だが、急な金利変動・信用コスト・政策ショックは逆風。',
    proceed: '日銀後に銀行株がTOPIX比で崩れず、円高ショックなし、20営業日反応が0%以上',
    caution: '銀行株は強いが日経全体が75日線を割る、または信用コスト情報が未確認',
    stop: '銀行株がTOPIX比-3%以上、日経-3%以上、信用コスト悪化、日銀ショック',
    next_action: '金利テーマ枠として候補維持。日銀後の銀行セクター反応を見て判断。',
  },
  '5020.T': {
    type: 'エネルギー',
    main_risk: '利益前年比は大きいが売上は-4.5%。原油・精製マージン・為替の影響が大きい。',
    proceed: '20営業日反応0%以上、原油価格が急落せず、円高ショックなし、精製マージン悪化なし',
    caution: '原油が短期で±10%動く、売上減少の理由確認が未了',
    stop: '原油急落、精製マージン悪化、20営業日超過-5%以下、地政学材料の反転',
    next_action: 'テーマ連動が強いため、原油・為替・決算反応がそろうまで小口以上は不可。',
  },
  '8306.T': {
    type: '銀行',
    main_risk: '金利上昇メリットはあるが、日銀イベントで市場全体が崩れると銀行も巻き込まれる。',
    proceed: '日銀後に銀行株がTOPIX比で優位、米金利急騰なし、日経75日線を維持',
    caution: '銀行株は強いが日経が75日線付近、または信用コスト確認不足',
    stop: '銀行株がTOPIX比-3%以上、日経75日線-2%以上、信用コスト悪化',
    next_action: '三井住友FGと重複するため、銀行枠の中でどちらを残すかを6月に比較。',
  },
  '6146.T': {
    type: '半導体装置',
    main_risk: 'AI/半導体需要に強い一方、米金利上昇・SOX下落・円高に弱い。',
    proceed: 'FOMC後に米10年金利4.60%未満、SOXが2営業日で-3%以内、決算後反応50点以上維持',
    caution: 'SOX -3〜-5%、米金利4.60〜4.70%、円高2〜3%',
    stop: 'SOX -5%以上、米金利4.70%以上、円高3%以上、60日最大下落-25%超',
    next_action: '半導体枠の本命候補。マクロゲートを通らない限り購入検討へ進めない。',
  },
  '6762.T': {
    type: '電子部品',
    main_risk: '電池・電子部品テーマは強いが、1年上昇率が高く、円高と電子部品サイクルに注意。',
    proceed: 'FOMC後にSOX/NASDAQが崩れず、円高3%未満、20営業日反応が50点以上',
    caution: '1年上昇率がさらに拡大、出来高急増で上髭、円高2〜3%',
    stop: '円高3%以上、SOX -5%以上、20営業日超過-5%以下、PBR上昇が続く',
    next_action: '半導体・電子部品枠として候補維持。ディスコと同時に過大配分しない。',
  },
  '6503.T': {
    type: '総合電機/FA',
    main_risk: '電力制御・FAテーマはあるが、業績/質スコアが低め。決算反応の確定が必要。',
    proceed: '20営業日反応50点以上、日経75日線維持、円高ショックなし、FA/電力制御の業績説明が確認できる',
    caution: '20営業日未到達、業績伸びが弱いまま、セグメント確認不足',
    stop: '20営業日反応35点未満、業績/質スコア改善なし、円高3%以上',
    next_action: '8社中では確認項目が多い。6月は候補維持寄りで扱う。',
  },
  '8766.T': {
    type: '保険/金利',
    main_risk: '予備枠。経常利益前年比-7.6%、決算後1日反応は日経比-4.68%。還元方針と20営業日反応待ち。',
    proceed: '20営業日反応50点以上、5日/20日超過リターンが改善、還元方針に悪化なし、自然災害損失懸念が拡大しない',
    caution: '反応点35〜50点、20営業日未到達、利益減の一過性確認が未了',
    stop: '反応点35点未満、20営業日超過-5%以下、経常利益減少の継続懸念、保険セクターが弱い',
    next_action: '現時点は予備。6月一次判定で昇格しなければ待機。',
  },
  '6367.T': {
    type: '空調/冷却',
    main_risk: '予備枠。AI冷却テーマはあるが全社営業利益+3.3%で伸びは強くない。',
    proceed: '20営業日反応50点以上、データセンター冷却・北米/アジア需要の説明確認、日経75日線維持',
    caution: 'テーマは強いが業績寄与が確認不足、20営業日未到達',
    stop: '20営業日反応35点未満、営業利益成長が鈍いまま、出来高弱く株価が日経に負ける',
    next_action: '現時点は予備。テーマが業績に入る証拠を確認できるまで購入候補にしない。',
  },
};

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
  const headers = rows.shift() ?? [];
  return rows
    .filter((items) => items.some((item) => String(item).trim() !== ''))
    .map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] ?? ''])));
}

function readCsv(file) {
  return parseCsv(fs.readFileSync(path.join(ROOT, file), 'utf8'));
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
  for (const dir of [ROOT, REPORT_DIR]) {
    try {
      fs.writeFileSync(path.join(dir, name), `\uFEFF${body}\n`, 'utf8');
    } catch (error) {
      console.warn(`skip write ${path.join(dir, name)}: ${error.message}`);
    }
  }
}

function writeHtml(name, html) {
  for (const dir of [ROOT, REPORT_DIR]) {
    try {
      fs.writeFileSync(path.join(dir, name), html, 'utf8');
    } catch (error) {
      console.warn(`skip write ${path.join(dir, name)}: ${error.message}`);
    }
  }
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function num(value) {
  const n = Number(String(value ?? '').replaceAll(',', ''));
  return Number.isFinite(n) ? n : null;
}

function actionBand(row) {
  const score = num(row.nisa_score) ?? 0;
  const reaction = num(row.earnings_reaction_score);
  if (row.category === '予備') return '予備維持';
  if (row.category !== '残す') return '購入検討不可';
  if (reaction !== null && reaction < 35) return '購入検討不可';
  if (score >= 65) return '購入検討へ進む条件あり';
  if (score >= 58) return '小口検討または候補維持';
  return '候補維持';
}

const candidateRows = readCsv('280_nisa_test_10_candidate_plan_reaction_updated.csv');

const tickerRuleRows = candidateRows.map((row) => {
  const rule = TICKER_RULES[row.ticker] ?? {};
  return {
    updated_at: generatedAt,
    rank: row.nisa_rank,
    ticker: row.ticker,
    company: row.company,
    category: row.category,
    action_band: actionBand(row),
    type: rule.type ?? row.sector,
    nisa_score: row.nisa_score,
    earnings_reaction_score: row.earnings_reaction_score || '未到達',
    data_confidence: row.data_confidence,
    per: row.per || '未取得',
    pbr: row.pbr || '未取得',
    roe_pct: row.roe_pct || '未取得',
    main_risk: rule.main_risk ?? '',
    proceed_condition: rule.proceed ?? '',
    caution_condition: rule.caution ?? '',
    stop_condition: rule.stop ?? '',
    next_action: rule.next_action ?? '',
  };
});

const actionMatrixRows = tickerRuleRows.map((row) => ({
  updated_at: generatedAt,
  ticker: row.ticker,
  company: row.company,
  current_status: row.category,
  june_best_case: row.category === '予備' ? '予備から検証候補へ昇格可能' : row.action_band,
  june_base_case: row.category === '予備' ? '予備維持' : '候補維持または小口検討',
  june_bad_case: '購入検討不可または除外',
  first_action: row.category === '予備'
    ? '20営業日反応と公式説明資料の要因確認を優先'
    : '共通市場ゲート通過後に個別ゲートを確認',
  allocation_note: row.category === '予備'
    ? '初回資金配分には入れない'
    : '購入検討へ進む場合でも、指数比較と+1%目標を満たせない場合は個別株比率を下げる',
}));

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '対象候補',
    value: `${candidateRows.length}社`,
    note: '残す8社、予備2社。全て購入確定ではなく6月判定対象。',
  },
  {
    updated_at: generatedAt,
    item: '共通イベント',
    value: '4本',
    note: '米CPI、日銀、FOMC、6月一次判定週を公式カレンダー確認ベースで設定。',
  },
  {
    updated_at: generatedAt,
    item: '+1%目標との接続',
    value: '判定条件化',
    note: '日経平均/TOPIX/S&P500投信より1%ポイント上回る見込みが薄い場合、個別株比率を下げる。',
  },
];

writeCsv('283_june_candidate_rulebook_summary.csv', summaryRows, ['updated_at', 'item', 'value', 'note']);
writeCsv('284_june_market_event_gates.csv', VERIFIED_EVENTS, [
  'date',
  'event',
  'source',
  'source_url',
  'check',
  'proceed',
  'caution',
  'stop',
  'action',
]);
writeCsv('285_june_ticker_rulebook.csv', tickerRuleRows, [
  'updated_at',
  'rank',
  'ticker',
  'company',
  'category',
  'action_band',
  'type',
  'nisa_score',
  'earnings_reaction_score',
  'data_confidence',
  'per',
  'pbr',
  'roe_pct',
  'main_risk',
  'proceed_condition',
  'caution_condition',
  'stop_condition',
  'next_action',
]);
writeCsv('286_june_candidate_action_matrix.csv', actionMatrixRows, [
  'updated_at',
  'ticker',
  'company',
  'current_status',
  'june_best_case',
  'june_base_case',
  'june_bad_case',
  'first_action',
  'allocation_note',
]);

const badgeClass = (value) => {
  if (value === '残す') return 'ok';
  if (value === '予備') return 'reserve';
  return 'watch';
};

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>6月イベント後 銘柄別判定ルール</title>
  <style>
    body { font-family: "Yu Gothic", Meiryo, sans-serif; color:#111; margin:0; background:#f4f8fb; line-height:1.65; }
    main { max-width:1220px; margin:0 auto; padding:28px 18px 48px; }
    h1 { font-size:28px; color:#073a5a; margin:0 0 10px; }
    h2 { border-left:8px solid #0b6f9f; padding-left:10px; color:#073a5a; margin-top:30px; }
    .lead, .card { background:#fff; border:1px solid #cbddeb; border-radius:10px; padding:16px 18px; box-shadow:0 2px 8px rgba(0,40,80,.06); }
    .grid { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px; margin:16px 0; }
    .kpi { background:#fff; border:1px solid #cbddeb; border-radius:10px; padding:14px; }
    .kpi b { display:block; font-size:26px; color:#073a5a; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; background:#fff; margin-top:12px; }
    th, td { border:1px solid #cbddeb; padding:8px 9px; font-size:12.5px; vertical-align:top; overflow-wrap:anywhere; }
    th { background:#e4f1fa; color:#073a5a; }
    .ok { color:#007a3d; font-weight:800; }
    .reserve { color:#b45f00; font-weight:800; }
    .watch { color:#7a2c00; font-weight:800; }
    .formula { font-family:Consolas, monospace; background:#f7fbff; border:1px solid #cbddeb; border-radius:8px; padding:12px; }
    .note { color:#333; font-size:13px; }
    @media print {
      body { background:#fff; }
      table, tr, td, th, .lead, .card, .kpi { break-inside:avoid; page-break-inside:avoid; box-shadow:none; }
    }
  </style>
</head>
<body>
<main>
  <h1>6月イベント後 銘柄別判定ルール</h1>
  <div class="lead">
    <b>目的:</b> 10社候補を、6月の米CPI・日銀・FOMC後に「購入検討へ進む」「小口検討/候補維持」「待機」「除外」に分けるための判定表です。<br>
    <b>注意:</b> これは売買指示ではありません。NISA 1年保有テストの候補を選ぶための判断補助で、実行前には証券会社画面・公式IR・最新決算を再確認します。
  </div>
  <div class="grid">
    ${summaryRows.map((row) => `<div class="kpi"><span>${esc(row.item)}</span><b>${esc(row.value)}</b><p>${esc(row.note)}</p></div>`).join('')}
  </div>

  <h2>共通イベントゲート</h2>
  <table>
    <thead><tr><th style="width:10%">日付</th><th style="width:12%">イベント</th><th>見る数字</th><th>進める条件</th><th>注意条件</th><th>止める条件</th><th>行動</th></tr></thead>
    <tbody>
      ${VERIFIED_EVENTS.map((row) => `<tr>
        <td>${esc(row.date)}</td>
        <td><b>${esc(row.event)}</b><br><a href="${esc(row.source_url)}">${esc(row.source)}</a></td>
        <td>${esc(row.check)}</td>
        <td>${esc(row.proceed)}</td>
        <td>${esc(row.caution)}</td>
        <td>${esc(row.stop)}</td>
        <td>${esc(row.action)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <h2>銘柄別ルール</h2>
  <table>
    <thead>
      <tr>
        <th style="width:5%">順位</th>
        <th style="width:13%">銘柄</th>
        <th style="width:7%">分類</th>
        <th style="width:8%">判定帯</th>
        <th style="width:11%">現状数値</th>
        <th style="width:13%">主なリスク</th>
        <th style="width:15%">進める条件</th>
        <th style="width:14%">注意条件</th>
        <th style="width:14%">止める条件</th>
      </tr>
    </thead>
    <tbody>
      ${tickerRuleRows.map((row) => `<tr>
        <td>${esc(row.rank)}</td>
        <td>${esc(row.ticker)}<br><b>${esc(row.company)}</b><br>${esc(row.type)}</td>
        <td class="${badgeClass(row.category)}">${esc(row.category)}</td>
        <td>${esc(row.action_band)}</td>
        <td>NISA ${esc(row.nisa_score)}<br>反応 ${esc(row.earnings_reaction_score)}<br>信頼度 ${esc(row.data_confidence)}<br>PER ${esc(row.per)}</td>
        <td>${esc(row.main_risk)}</td>
        <td>${esc(row.proceed_condition)}</td>
        <td>${esc(row.caution_condition)}</td>
        <td>${esc(row.stop_condition)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <h2>行動マトリクス</h2>
  <table>
    <thead><tr><th>銘柄</th><th>現状</th><th>良い場合</th><th>通常の場合</th><th>悪い場合</th><th>最初にすること</th><th>資金配分メモ</th></tr></thead>
    <tbody>
      ${actionMatrixRows.map((row) => `<tr>
        <td>${esc(row.ticker)}<br>${esc(row.company)}</td>
        <td class="${badgeClass(row.current_status)}">${esc(row.current_status)}</td>
        <td>${esc(row.june_best_case)}</td>
        <td>${esc(row.june_base_case)}</td>
        <td>${esc(row.june_bad_case)}</td>
        <td>${esc(row.first_action)}</td>
        <td>${esc(row.allocation_note)}</td>
      </tr>`).join('')}
    </tbody>
  </table>

  <h2>+1%目標との接続</h2>
  <div class="card">
    <p>この運用の目的は、単に個別株を持つことではなく、日経平均/TOPIX/S&P500連動投信などの無難な選択肢を最低1%ポイント上回る可能性がある候補を探すことです。</p>
    <div class="formula">
      1年後評価 = 個別株ポートフォリオ実績 - max(日経平均, TOPIX, S&P500円換算投信) の同期間リターン<br>
      合格 = +1.0%ポイント以上<br>
      未達見込み = 個別株比率を下げる、または指数連動/現金比率を上げる
    </div>
    <p class="note">したがって、6月イベント後の条件を通っても、期待値が指数+1%を上回る説明ができない銘柄は、購入検討ではなく候補維持または除外にします。</p>
  </div>
</main>
</body>
</html>`;

writeHtml('candidate_june_rulebook.html', html);

console.log(`generated june rulebook for ${tickerRuleRows.length} tickers`);
