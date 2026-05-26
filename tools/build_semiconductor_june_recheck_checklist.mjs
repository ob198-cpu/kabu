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
  const headers = rows.shift() ?? [];
  return rows
    .filter((items) => items.some((item) => String(item).trim() !== ''))
    .map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] ?? ''])));
}

function readCsv(name) {
  const file = path.join(ROOT, name);
  if (!fs.existsSync(file)) return [];
  return parseCsv(fs.readFileSync(file, 'utf8'));
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

function num(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).replaceAll(',', '').replace('%', '').trim();
  if (!text || text === '-' || text === '未取得') return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function fmt(value, unit = '') {
  const parsed = num(value);
  if (parsed === null) return '未取得';
  return `${Math.round(parsed * 100) / 100}${unit}`;
}

function byTicker(rows) {
  return new Map(rows.map((row) => [row.ticker, row]));
}

function statusClass(text) {
  if (/除外|停止|不可|未達|下落|悪化|不足|待機/.test(text)) return 'bad';
  if (/保留|注意|確認|条件|一部|再判定/.test(text)) return 'warn';
  if (/通過|候補|完了|残す|可能/.test(text)) return 'good';
  return '';
}

const eventRows = readCsv('284_june_market_event_gates.csv');
const completionRows = readCsv('378_semiconductor_fundamental_completion_matrix.csv');
const bridgeRows = byTicker(readCsv('379_semiconductor_fundamental_score_bridge.csv'));

const commonGateRows = [
  {
    updated_at: generatedAt,
    gate: '米CPIゲート',
    check_date: '2026-06-10',
    pass_condition: '総合CPI前年比3.8%以下、前月比0.4%以下、コア前月比0.4%以下、発表後の米10年金利が4.60%未満',
    caution_condition: '総合CPI前年比3.9〜4.0%、前月比0.5%、米10年金利4.60〜4.70%',
    stop_condition: '総合CPI前年比4.0%超、コア前月比0.5%以上、米10年金利4.70%以上',
    action: '停止条件なら半導体候補は6月一次判定へ進めない。',
  },
  {
    updated_at: generatedAt,
    gate: '日銀・円高ゲート',
    check_date: '2026-06-15〜2026-06-16',
    pass_condition: '会合後2営業日でドル円の円高が3%未満、日経平均が75日線を大きく下回らない',
    caution_condition: '円高2〜3%、日経平均が75日線を-1〜-2%下回る',
    stop_condition: '円高3%以上、日経平均が75日線を-2%以上下回る',
    action: '停止条件なら輸出・半導体・海外比率が高い候補を待機にする。',
  },
  {
    updated_at: generatedAt,
    gate: 'FOMC・金利ゲート',
    check_date: '2026-06-16〜2026-06-17',
    pass_condition: 'FOMC後2営業日で米10年金利4.60%未満、NASDAQ/SOXが-3%以内',
    caution_condition: '米10年金利4.60〜4.70%、NASDAQ/SOXが-3〜-5%',
    stop_condition: '米10年金利4.70%以上、NASDAQ/SOXが-5%以上、ドル円±3%以上の急変',
    action: '停止条件なら高PER・AI・半導体関連の新規検討を止める。',
  },
  {
    updated_at: generatedAt,
    gate: '指数トレンドゲート',
    check_date: '2026-06-18〜2026-06-24',
    pass_condition: '日経平均が75日線以上、または下抜けが-1%以内',
    caution_condition: '日経平均が75日線を-1〜-2%下回る',
    stop_condition: '日経平均が75日線を-2%以上下回る、または高値から-10%以上',
    action: '停止条件なら個別銘柄の良否に関係なく候補を進めない。',
  },
];

function currentIssue(row) {
  const issues = [];
  if (String(row.valuation_gate).includes('未取得')) issues.push('割高度の未取得');
  if (String(row.valuation_gate).includes('PBR高') || String(row.valuation_gate).includes('割高')) issues.push('割高注意');
  if (String(row.earnings_gate).includes('減')) issues.push('直近決算の弱さ');
  if ((num(row.downside_resilience_score) ?? 100) < 55) issues.push('下落耐性不足');
  if (String(row.completion_status).includes('除外')) issues.push('既存除外');
  return issues.join('、') || '主要な停止理由なし';
}

function promotionCondition(row) {
  if (row.ticker === '8035.T') {
    return 'PERを取得し、利益前年比が0%以上または次期ガイダンスが改善、PBR10倍台をROE/利益成長で説明できること。下落耐性55点以上、6月イベント後の5営業日対日経平均が0%以上。';
  }
  if (row.ticker === '7735.T') {
    return 'PER25倍未満を維持し、売上前年比または利益前年比が0%以上へ改善。下落耐性55点以上、6月イベント後のSOX比悪化が-3%以内。';
  }
  if (row.ticker === '6146.T') {
    return 'PERを取得し、PBR高を利益成長で説明できること。下落耐性55点以上、最大下落率が-25%以内へ改善。';
  }
  if (row.ticker === '6762.T') {
    return '円高ショックなし、売上・利益成長が維持、下落耐性55点以上。半導体中核ではなく電子部品枠として小さく扱う。';
  }
  return '既存除外銘柄のため、6月候補へは戻さない。観察対象に限定。';
}

function holdCondition(row) {
  if (String(row.completion_status).includes('除外')) return 'イベント反応DBの観察対象に限定し、通常候補には戻さない。';
  return '共通ゲートは止まらないが、個別条件の一部が未達の場合は候補維持。購入候補へは進めない。';
}

function exclusionCondition(row) {
  const common = '共通ゲートの停止条件に該当、米10年金利4.70%以上、SOX/NASDAQ-5%以上、日経75日線-2%以上、または下方修正。';
  if (row.ticker === '8035.T') return `${common} 加えて、利益前年比マイナス継続かつPBR10倍以上なら除外寄り。`;
  if (row.ticker === '7735.T') return `${common} 加えて、減収減益が続きPERが25倍以上へ上がる場合は除外寄り。`;
  if (row.ticker === '6146.T') return `${common} 加えて、PER未取得のままPBR10倍以上、または最大下落率-30%以下なら除外寄り。`;
  if (row.ticker === '6762.T') return `${common} 加えて、円高3%以上または電子部品需要コメント悪化なら除外寄り。`;
  return '除外継続。割高・過熱・決算後反応が改善するまで候補へ戻さない。';
}

const tickerChecklistRows = completionRows.map((row) => ({
  updated_at: generatedAt,
  ticker: row.ticker,
  company: row.company,
  current_status: row.completion_status,
  current_issue: currentIssue(row),
  current_key_numbers: `PER ${fmt(row.per, '倍')} / PBR ${fmt(row.pbr, '倍')} / ROE ${fmt(row.roe_pct, '%')} / 売上 ${fmt(row.revenue_yoy_pct, '%')} / 利益 ${fmt(row.profit_yoy_pct, '%')} / 下落耐性 ${fmt(row.downside_resilience_score, '点')}`,
  promotion_condition: promotionCondition(row),
  hold_condition: holdCondition(row),
  exclusion_condition: exclusionCondition(row),
  next_action: bridgeRows.get(row.ticker)?.next_action || '6月イベント後に再判定。',
}));

const decisionTreeRows = [
  {
    updated_at: generatedAt,
    step: 1,
    check: '共通マクロゲート',
    pass: 'CPI、日銀、FOMC、指数トレンドに停止条件なし',
    fail: '停止条件が1つでもあれば半導体候補を進めない',
    output: '共通ゲート通過/停止',
  },
  {
    updated_at: generatedAt,
    step: 2,
    check: '銘柄別の穴',
    pass: 'PER/PBR/ROE、売上・利益、下落耐性、決算後反応が取得済み',
    fail: '未取得項目は点数に混ぜず、候補昇格不可',
    output: 'データ接続可否',
  },
  {
    updated_at: generatedAt,
    step: 3,
    check: '割高度と成長の整合性',
    pass: '高PBR・高PERを利益成長、ROE、受注、ガイダンスで説明可能',
    fail: '高い株価評価に対して減益・下方修正・受注悪化がある',
    output: '昇格/保留',
  },
  {
    updated_at: generatedAt,
    step: 4,
    check: '+1%目標との接続',
    pass: '主比較線を上回り、かつ下落耐性・割高度・成長のゲートを満たす',
    fail: '1年騰落率だけ強くても、ゲート未達なら採用しない',
    output: '6月テスト候補',
  },
  {
    updated_at: generatedAt,
    step: 5,
    check: '記録',
    pass: '判定理由、予想、実際の株価反応を記録',
    fail: '記録できない場合はモデル改善に使えない',
    output: '予実差ログ',
  },
];

const inputTemplateRows = tickerChecklistRows.map((row) => ({
  updated_at: generatedAt,
  ticker: row.ticker,
  company: row.company,
  check_date: '2026-06-18〜2026-06-24',
  cpi_gate_result: '',
  boj_gate_result: '',
  fomc_gate_result: '',
  index_gate_result: '',
  per_after_check: '',
  pbr_after_check: '',
  roe_after_check: '',
  revenue_yoy_after_check: '',
  profit_yoy_after_check: '',
  downside_resilience_after_check: '',
  five_day_excess_return_after_event: '',
  final_june_status: '',
  reason_log: '',
}));

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '目的',
    value: '保留銘柄の6月再判定',
    interpretation: '構造材料だけで買わず、CPI・日銀・FOMC後に、数値条件を満たす銘柄だけをテスト候補へ残す。',
  },
  {
    updated_at: generatedAt,
    item: '対象銘柄',
    value: `${tickerChecklistRows.length}社`,
    interpretation: '半導体構造優位6社。購入候補ではなく、昇格/保留/除外の条件を整理する対象。',
  },
  {
    updated_at: generatedAt,
    item: '現時点の即時候補',
    value: '0社',
    interpretation: '東京エレクトロン・SCREENも、6月イベント後と個別条件の確認前は候補に進めない。',
  },
  {
    updated_at: generatedAt,
    item: '最短判定週',
    value: '2026-06-18〜2026-06-24',
    interpretation: '米CPI、日銀、FOMCの反応を見た後、一次判定する。',
  },
  {
    updated_at: generatedAt,
    item: '次の出力',
    value: '入力結果つき判定表',
    interpretation: 'イベント後の数値を入力し、昇格/保留/除外のログを残す。',
  },
];

const sourceRows = [
  {
    updated_at: generatedAt,
    source: 'BLS CPI release schedule',
    url: 'https://www.bls.gov/schedule/news_release/cpi.htm',
    confirmed_detail: 'May 2026 CPI is scheduled for release on June 10, 2026 at 8:30 AM ET.',
  },
  {
    updated_at: generatedAt,
    source: 'Federal Reserve FOMC calendar',
    url: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm',
    confirmed_detail: 'June 2026 FOMC meeting is June 16-17, with Summary of Economic Projections.',
  },
  {
    updated_at: generatedAt,
    source: 'Bank of Japan calendar',
    url: 'https://www.boj.or.jp/en/index.htm',
    confirmed_detail: 'Next Monetary Policy Meeting date is June 15 and 16, 2026.',
  },
  {
    updated_at: generatedAt,
    source: '378_semiconductor_fundamental_completion_matrix.csv',
    url: '378_semiconductor_fundamental_completion_matrix.csv',
    confirmed_detail: '半導体6社のPER/PBR/ROE、成長率、下落耐性、保留理由。',
  },
  {
    updated_at: generatedAt,
    source: '284_june_market_event_gates.csv',
    url: '284_june_market_event_gates.csv',
    confirmed_detail: '6月イベントの既存ゲート条件。',
  },
];

writeCsv('383_semiconductor_june_recheck_summary.csv', summaryRows, ['updated_at', 'item', 'value', 'interpretation']);
writeCsv('384_semiconductor_june_event_calendar.csv', eventRows, ['date', 'event', 'source', 'source_url', 'check', 'proceed', 'caution', 'stop', 'action']);
writeCsv('385_semiconductor_common_gate_rules.csv', commonGateRows, ['updated_at', 'gate', 'check_date', 'pass_condition', 'caution_condition', 'stop_condition', 'action']);
writeCsv('386_semiconductor_ticker_recheck_conditions.csv', tickerChecklistRows, ['updated_at', 'ticker', 'company', 'current_status', 'current_issue', 'current_key_numbers', 'promotion_condition', 'hold_condition', 'exclusion_condition', 'next_action']);
writeCsv('387_semiconductor_recheck_input_template.csv', inputTemplateRows, ['updated_at', 'ticker', 'company', 'check_date', 'cpi_gate_result', 'boj_gate_result', 'fomc_gate_result', 'index_gate_result', 'per_after_check', 'pbr_after_check', 'roe_after_check', 'revenue_yoy_after_check', 'profit_yoy_after_check', 'downside_resilience_after_check', 'five_day_excess_return_after_event', 'final_june_status', 'reason_log']);
writeCsv('388_semiconductor_june_decision_tree.csv', decisionTreeRows, ['updated_at', 'step', 'check', 'pass', 'fail', 'output']);
writeCsv('389_semiconductor_june_recheck_sources.csv', sourceRows, ['updated_at', 'source', 'url', 'confirmed_detail']);

function table(headers, rows, cells) {
  return `<table>
    <thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr></thead>
    <tbody>
      ${rows.map((row) => `<tr>${cells.map((cell) => `<td>${cell(row)}</td>`).join('')}</tr>`).join('')}
    </tbody>
  </table>`;
}

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>半導体 6月再判定チェックリスト</title>
  <style>
    :root {
      --ink: #061d35;
      --muted: #334155;
      --blue: #0b5f92;
      --green: #047857;
      --amber: #b45309;
      --red: #b91c1c;
      --line: #cfe0f3;
      --soft: #f4f9ff;
      --panel: #ffffff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Yu Gothic", "Meiryo", system-ui, sans-serif;
      color: var(--ink);
      background: #f6fbff;
      line-height: 1.75;
    }
    header {
      background: linear-gradient(135deg, #082f49, #0b5f92);
      color: #fff;
      padding: 34px 26px 30px;
    }
    main {
      width: min(1180px, calc(100% - 28px));
      margin: 22px auto 60px;
    }
    h1, h2, h3 { margin: 0; line-height: 1.35; }
    h1 { font-size: clamp(26px, 4vw, 42px); }
    h2 {
      margin-top: 34px;
      padding-left: 12px;
      border-left: 7px solid var(--blue);
      font-size: 24px;
    }
    p { margin: 8px 0; color: var(--muted); }
    a { color: #075985; font-weight: 700; }
    .toolbar {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 18px;
    }
    .toolbar a, .button {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      border-radius: 8px;
      background: #fff;
      color: #07385b;
      text-decoration: none;
      border: 1px solid #b8d4ee;
      box-shadow: 0 2px 6px rgba(0,0,0,.08);
    }
    .notice {
      margin-top: 16px;
      background: rgba(255,255,255,.12);
      border: 1px solid rgba(255,255,255,.35);
      padding: 14px 16px;
      border-radius: 10px;
      color: #fff;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 12px;
      margin-top: 16px;
    }
    .card, .section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 18px;
      box-shadow: 0 6px 20px rgba(8, 42, 73, .06);
      break-inside: avoid;
    }
    .section { margin-top: 14px; }
    .kpi {
      font-size: 26px;
      font-weight: 900;
      color: var(--blue);
      margin-top: 4px;
    }
    .flow {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
      margin-top: 14px;
    }
    .step {
      position: relative;
      min-height: 112px;
      border: 2px solid #b7d7ef;
      border-radius: 10px;
      padding: 12px;
      background: #f8fcff;
      font-weight: 900;
    }
    .step small {
      display: block;
      margin-top: 6px;
      color: var(--muted);
      font-weight: 500;
    }
    .step:not(:last-child)::after {
      content: "→";
      position: absolute;
      right: -17px;
      top: 40px;
      color: var(--blue);
      font-size: 26px;
      font-weight: 900;
      z-index: 2;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 12px;
      background: #fff;
      table-layout: fixed;
    }
    th, td {
      border: 1px solid #d5e4f4;
      padding: 10px;
      vertical-align: top;
      overflow-wrap: anywhere;
      word-break: break-word;
      color: #061d35;
    }
    th {
      background: #e7f2fb;
      text-align: left;
      font-weight: 900;
    }
    tbody tr:nth-child(even) { background: #fbfdff; }
    .good { color: var(--green); font-weight: 900; }
    .warn { color: var(--amber); font-weight: 900; }
    .bad { color: var(--red); font-weight: 900; }
    .badge {
      display: inline-block;
      padding: 3px 9px;
      border-radius: 999px;
      background: #e0f2fe;
      color: #075985;
      font-weight: 900;
      white-space: nowrap;
    }
    .calendar {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 12px;
      margin-top: 14px;
    }
    .event {
      border-left: 6px solid var(--blue);
      background: #fff;
      border-radius: 10px;
      padding: 14px;
      border-top: 1px solid var(--line);
      border-right: 1px solid var(--line);
      border-bottom: 1px solid var(--line);
    }
    .event b { display: block; font-size: 18px; }
    .event small { color: var(--muted); }
    @media (max-width: 860px) {
      .flow { grid-template-columns: 1fr; }
      .step:not(:last-child)::after { display: none; }
      table { font-size: 14px; }
    }
    @media print {
      body { background: #fff; color: #000; }
      header { background: #fff; color: #000; border-bottom: 3px solid #000; }
      .toolbar { display: none; }
      .card, .section { box-shadow: none; page-break-inside: avoid; }
      h2 { page-break-after: avoid; }
      tr { page-break-inside: avoid; }
      th, td { color: #000; }
    }
  </style>
</head>
<body>
  <header>
    <h1>半導体 6月再判定チェックリスト</h1>
    <p style="color:#e6f3ff">東京エレクトロン、SCREEN、ディスコ、TDKなどを、6月イベント後に候補へ進めるか、保留するか、除外するかを決めるための条件表です。</p>
    <div class="notice">結論: 6月イベント前に半導体構造本命を購入候補へ昇格しません。CPI、日銀、FOMC後に、共通ゲートと銘柄別条件を満たした場合だけテスト候補へ残します。</div>
    <div class="toolbar">
      <a href="index.html">トップ</a>
      <a href="semiconductor_fundamental_completion_20260526.html">決算・割高補完</a>
      <a href="semiconductor_quant_gate_connection_20260526.html">量的ゲート接続</a>
      <a href="semiconductor_june_result_input_cockpit_20260526.html">実績入力</a>
      <a href="june_forward_test_record_20260526.html">6月前向きテスト記録</a>
      <a href="current_vs_history_materials_20260525.html">資料一覧</a>
    </div>
  </header>

  <main>
    <section class="grid">
      ${summaryRows.map((row) => `
        <div class="card">
          <h3>${esc(row.item)}</h3>
          <div class="kpi">${esc(row.value)}</div>
          <p>${esc(row.interpretation)}</p>
        </div>
      `).join('')}
    </section>

    <h2>1. 判定の流れ</h2>
    <section class="section">
      <div class="flow">
        ${decisionTreeRows.map((row) => `
          <div class="step">${esc(row.step)}. ${esc(row.check)}<small>通過: ${esc(row.pass)}<br>停止: ${esc(row.fail)}</small></div>
        `).join('')}
      </div>
      <p>この順番を崩しません。1年騰落率が強くても、共通ゲート、未取得データ、割高度、減益、下落耐性で止まる場合はテスト候補へ進めません。</p>
    </section>

    <h2>2. 6月イベントカレンダー</h2>
    <section class="section">
      <div class="calendar">
        ${eventRows.map((row) => `
          <div class="event">
            <small>${esc(row.date)}</small>
            <b>${esc(row.event)}</b>
            <p>${esc(row.check)}</p>
          </div>
        `).join('')}
      </div>
    </section>

    <h2>3. 共通ゲート</h2>
    <section class="section">
      ${table(
        ['ゲート', '確認日', '通過', '注意', '停止', '行動'],
        commonGateRows,
        [
          (row) => `<strong>${esc(row.gate)}</strong>`,
          (row) => esc(row.check_date),
          (row) => `<span class="good">${esc(row.pass_condition)}</span>`,
          (row) => `<span class="warn">${esc(row.caution_condition)}</span>`,
          (row) => `<span class="bad">${esc(row.stop_condition)}</span>`,
          (row) => esc(row.action),
        ],
      )}
    </section>

    <h2>4. 銘柄別の昇格・保留・除外条件</h2>
    <section class="section">
      ${table(
        ['銘柄', '現在の停止理由', '現在値', '昇格条件', '保留条件', '除外条件'],
        tickerChecklistRows,
        [
          (row) => `<strong>${esc(row.ticker)} ${esc(row.company)}</strong><br><span class="badge">${esc(row.current_status)}</span>`,
          (row) => `<span class="${statusClass(row.current_issue)}">${esc(row.current_issue)}</span>`,
          (row) => esc(row.current_key_numbers),
          (row) => `<span class="good">${esc(row.promotion_condition)}</span>`,
          (row) => `<span class="warn">${esc(row.hold_condition)}</span>`,
          (row) => `<span class="bad">${esc(row.exclusion_condition)}</span>`,
        ],
      )}
    </section>

    <h2>5. イベント後に入力する表</h2>
    <section class="section">
      <p>6月18日以降に、以下の欄へ実際の結果を入れます。空欄のまま判断しません。</p>
      ${table(
        ['銘柄', '確認日', 'CPI', '日銀', 'FOMC', '指数', '最終判定', '理由ログ'],
        inputTemplateRows,
        [
          (row) => `${esc(row.ticker)} ${esc(row.company)}`,
          (row) => esc(row.check_date),
          (row) => esc(row.cpi_gate_result || '入力待ち'),
          (row) => esc(row.boj_gate_result || '入力待ち'),
          (row) => esc(row.fomc_gate_result || '入力待ち'),
          (row) => esc(row.index_gate_result || '入力待ち'),
          (row) => esc(row.final_june_status || '未判定'),
          (row) => esc(row.reason_log || '未記録'),
        ],
      )}
    </section>

    <h2>6. 公式確認元</h2>
    <section class="section">
      ${table(
        ['確認元', 'URL', '確認内容'],
        sourceRows,
        [
          (row) => esc(row.source),
          (row) => `<a href="${esc(row.url)}">${esc(row.url)}</a>`,
          (row) => esc(row.confirmed_detail),
        ],
      )}
    </section>

    <h2>7. 出力ファイル</h2>
    <section class="section">
      ${table(
        ['ファイル', '内容'],
        [
          ['383_semiconductor_june_recheck_summary.csv', '要約'],
          ['384_semiconductor_june_event_calendar.csv', '6月イベントカレンダー'],
          ['385_semiconductor_common_gate_rules.csv', '共通ゲート'],
          ['386_semiconductor_ticker_recheck_conditions.csv', '銘柄別条件'],
          ['387_semiconductor_recheck_input_template.csv', 'イベント後入力表'],
          ['388_semiconductor_june_decision_tree.csv', '判定フロー'],
          ['389_semiconductor_june_recheck_sources.csv', '確認元'],
        ].map(([file, contents]) => ({ file, contents })),
        [
          (row) => `<a href="${esc(row.file)}">${esc(row.file)}</a>`,
          (row) => esc(row.contents),
        ],
      )}
    </section>
  </main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'semiconductor_june_recheck_checklist_20260526.html'), html, 'utf8');
