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

function n(value) {
  const text = String(value ?? '').replace(/,/g, '').trim();
  if (text === '') return null;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

function fmt(value, suffix = '') {
  if (value === null || value === undefined || value === '') return '未取得';
  return `${value}${suffix}`;
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

function byTicker(rows) {
  return new Map(rows.map((row) => [row.ticker, row]));
}

function quantGrade(row) {
  const priority = n(row.priority_score) ?? 0;
  const confidence = n(row.data_confidence) ?? 0;
  const blocking = row.blocking_items || '';
  if (priority >= 84 && confidence >= 95 && !blocking.includes('財務指標未完了') && !blocking.includes('業種別補正未完了')) return 'A';
  if (priority >= 80 && confidence >= 92) return 'B';
  if (priority >= 74 && confidence >= 90) return 'C';
  return '保留';
}

function readiness(row) {
  const lane = row.lane || '';
  if (lane.startsWith('A')) return '最初に確認';
  if (lane.startsWith('B')) return '補完後に確認';
  if (lane.startsWith('C')) return '補完優先';
  return '補欠比較';
}

function qualitativeRole(row, eventSummary) {
  const evidenceCompleted = n(eventSummary?.evidence_completed) ?? 0;
  const eventCount = n(eventSummary?.event_hypotheses) ?? 0;
  if (evidenceCompleted > 0) return `実績確認あり ${evidenceCompleted}/${eventCount}`;
  return `仮説のみ ${eventCount}件・未加点`;
}

const selectionRows = readCsv('419_june_test_10_selection_board.csv');
const nisaRows = readCsv('245_nisa_1year_hold_score_top20.csv');
const universeRows = readCsv('199_universe100_screening.csv');
const sectorRows = readCsv('300_candidate_sector_adjustment.csv');
const eventSummaryRows = readCsv('427_candidate_10_event_evidence_summary.csv');
const eventInputRows = readCsv('428_candidate_10_event_evidence_input_template.csv');
const gateRows = readCsv('450_immediate_score_connection_gate.csv');
const metricDecisionRows = readCsv('459_existing_metric_reuse_decision.csv');
const routeRows = fs.existsSync(path.join(ROOT, '462_ticker_metric_fetch_route.csv'))
  ? readCsv('462_ticker_metric_fetch_route.csv')
  : [];

const nisaByTicker = byTicker(nisaRows);
const universeByTicker = byTicker(universeRows);
const sectorByTicker = byTicker(sectorRows);
const eventSummaryByTicker = byTicker(eventSummaryRows);

const gateByTicker = new Map();
for (const row of gateRows) {
  if (!gateByTicker.has(row.ticker)) gateByTicker.set(row.ticker, []);
  gateByTicker.get(row.ticker).push(row);
}

const metricDecisionByTicker = byTicker(metricDecisionRows);
const routesByTicker = new Map();
for (const row of routeRows) {
  if (!routesByTicker.has(row.ticker)) routesByTicker.set(row.ticker, []);
  routesByTicker.get(row.ticker).push(row);
}

const eventThemesByTicker = new Map();
for (const row of eventInputRows) {
  if (!eventThemesByTicker.has(row.ticker)) eventThemesByTicker.set(row.ticker, []);
  eventThemesByTicker.get(row.ticker).push(row.event_theme);
}

const quantitativeRows = selectionRows.map((row) => {
  const nisa = nisaByTicker.get(row.ticker) || {};
  const universe = universeByTicker.get(row.ticker) || {};
  const sector = sectorByTicker.get(row.ticker) || {};
  const gates = gateByTicker.get(row.ticker) || [];
  const metricDecision = metricDecisionByTicker.get(row.ticker);
  const missing = [
    row.blocking_items,
    gates.map((gate) => `${gate.task_category}:${gate.score_connection}`).join(' / '),
    metricDecision ? `${metricDecision.missing_item}:${metricDecision.current_decision}` : '',
  ]
    .filter(Boolean)
    .join(' / ');

  return {
    updated_at: generatedAt,
    selection_rank: row.selection_rank,
    ticker: row.ticker,
    company: row.company,
    sector: row.sector,
    quantitative_grade: quantGrade(row),
    priority_score: row.priority_score,
    nisa_score: row.nisa_score,
    completion_score: row.completion_score,
    data_confidence: row.data_confidence,
    per: fmt(nisa.per || universe.per_forecast),
    pbr: fmt(nisa.pbr || universe.pbr_actual),
    roe_pct: fmt(nisa.roe_pct || universe.roe_actual_pct, '%'),
    revenue_yoy_pct: fmt(nisa.revenue_yoy_pct || universe.revenue_yoy_pct, '%'),
    profit_yoy_pct: fmt(nisa.profit_yoy_pct || universe.profit_yoy_pct, '%'),
    ret1y_pct: fmt(nisa.ret1y_pct || universe.ret1y_pct, '%'),
    max_drawdown60_pct: fmt(nisa.max_drawdown60_pct || universe.max_drawdown60_pct, '%'),
    sector_per_median: fmt(sector.sector_per_median),
    data_gap: missing || '主な不足なし',
    score_policy: '未取得値は点数へ混ぜない',
  };
});

const qualitativeRows = selectionRows.map((row) => {
  const eventSummary = eventSummaryByTicker.get(row.ticker);
  const themes = eventThemesByTicker.get(row.ticker) || [];
  return {
    updated_at: generatedAt,
    selection_rank: row.selection_rank,
    ticker: row.ticker,
    company: row.company,
    sector: row.sector,
    qualitative_status: qualitativeRole(row, eventSummary),
    event_theme_count: eventSummary?.event_hypotheses || themes.length || '0',
    evidence_completed: eventSummary?.evidence_completed || '0',
    evidence_pending: eventSummary?.evidence_pending || themes.length || '0',
    qualitative_themes: themes.join(' / '),
    qualitative_use: '調査理由として使用。実績確認前は加点しない',
  };
});

const selectionDecisionRows = selectionRows.map((row) => {
  const quant = quantitativeRows.find((item) => item.ticker === row.ticker);
  const qual = qualitativeRows.find((item) => item.ticker === row.ticker);
  const routes = routesByTicker.get(row.ticker) || [];
  const routeText = routes.map((route) => `${route.missing_metric}:${route.preferred_route}`).join(' / ');
  return {
    updated_at: generatedAt,
    selection_rank: row.selection_rank,
    ticker: row.ticker,
    company: row.company,
    current_role: readiness(row),
    quantitative_grade: quant.quantitative_grade,
    qualitative_status: qual.qualitative_status,
    action_status: row.action_status,
    selection_reason: `${row.role_explanation} 数値: ${row.metrics}`,
    remaining_check: row.blocking_items || '6月イベント実数',
    next_action: row.next_action,
    external_route: routeText || '現時点では追加ルート不要',
    purchase_status: '購入判断ではない',
  };
});

const tomorrowRows = [
  {
    updated_at: generatedAt,
    priority: 1,
    task: '候補10社の量的根拠を確定',
    detail: 'PER/PBR/ROE、売上成長、利益成長、下落率、出来高、決算後反応を候補別に確認する。',
    output: '量的評価表の更新',
  },
  {
    updated_at: generatedAt,
    priority: 2,
    task: '質的仮説の扱いを固定',
    detail: 'AI、半導体、金利、食品値上げ、原油、データセンター等を調査理由として整理し、実績確認前は加点しない。',
    output: '質的評価表の更新',
  },
  {
    updated_at: generatedAt,
    priority: 3,
    task: '不足値の採用可否を決める',
    detail: 'PER不足3件、同業中央値不足3件を公式IR/EDINET/J-Quantsルートで確認し、取れない値は未接続として残す。',
    output: '不足データ処理表',
  },
  {
    updated_at: generatedAt,
    priority: 4,
    task: 'テスト候補10社の説明を作成',
    detail: '各銘柄について、選定理由、確認すべきリスク、6月イベント後の再判定条件を記載する。',
    output: '候補10社説明表',
  },
  {
    updated_at: generatedAt,
    priority: 5,
    task: '6月再判定に接続',
    detail: 'CPI、FOMC、日銀、指数下落、金利急騰、個別決算の結果を入れて残す/保留/除外を判定する。',
    output: '6月確認リスト',
  },
];

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '候補数',
    value: `${selectionRows.length}社`,
    interpretation: '明日根拠付きで選出する対象。購入確定ではない。',
  },
  {
    updated_at: generatedAt,
    item: '質的仮説',
    value: `${eventInputRows.length}件`,
    interpretation: '各銘柄3件。実績確認前のため加点しない。',
  },
  {
    updated_at: generatedAt,
    item: '量的評価',
    value: '接続済みデータのみ使用',
    interpretation: '未取得値は点数に混ぜない。',
  },
  {
    updated_at: generatedAt,
    item: '購入判断',
    value: '0社',
    interpretation: '6月イベント実数入力後に再判定する。',
  },
];

writeCsv('465_candidate_10_selection_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'interpretation',
]);

writeCsv('466_candidate_10_quantitative_evidence.csv', quantitativeRows, [
  'updated_at',
  'selection_rank',
  'ticker',
  'company',
  'sector',
  'quantitative_grade',
  'priority_score',
  'nisa_score',
  'completion_score',
  'data_confidence',
  'per',
  'pbr',
  'roe_pct',
  'revenue_yoy_pct',
  'profit_yoy_pct',
  'ret1y_pct',
  'max_drawdown60_pct',
  'sector_per_median',
  'data_gap',
  'score_policy',
]);

writeCsv('467_candidate_10_qualitative_evidence.csv', qualitativeRows, [
  'updated_at',
  'selection_rank',
  'ticker',
  'company',
  'sector',
  'qualitative_status',
  'event_theme_count',
  'evidence_completed',
  'evidence_pending',
  'qualitative_themes',
  'qualitative_use',
]);

writeCsv('468_candidate_10_selection_decision.csv', selectionDecisionRows, [
  'updated_at',
  'selection_rank',
  'ticker',
  'company',
  'current_role',
  'quantitative_grade',
  'qualitative_status',
  'action_status',
  'selection_reason',
  'remaining_check',
  'next_action',
  'external_route',
  'purchase_status',
]);

writeCsv('469_tomorrow_candidate_selection_tasks.csv', tomorrowRows, [
  'updated_at',
  'priority',
  'task',
  'detail',
  'output',
]);

function table(headers, rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map((header) => `<th>${esc(header.label)}</th>`).join('')}</tr></thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>${headers.map((header) => `<td>${esc(row[header.key])}</td>`).join('')}</tr>
              `,
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

const html = cleanLines(`<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 根拠付き選定作業表</title>
  <style>
    :root {
      --ink: #111827;
      --muted: #4b5563;
      --line: #cfdced;
      --bg: #f5f8fc;
      --panel: #ffffff;
      --navy: #113a5c;
      --blue: #176da3;
      --yellow: #fff7d6;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Yu Gothic", "Meiryo", Arial, sans-serif;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.75;
      letter-spacing: 0;
    }
    main { width: min(1180px, calc(100% - 32px)); margin: 0 auto; padding: 28px 0 56px; }
    .hero {
      background: var(--navy);
      color: white;
      border-radius: 18px;
      padding: 26px;
      margin-bottom: 18px;
    }
    h1 { font-size: clamp(26px, 4vw, 42px); line-height: 1.2; margin: 0 0 10px; letter-spacing: 0; }
    h2 { font-size: 24px; color: var(--navy); margin: 0 0 10px; letter-spacing: 0; }
    p { margin: 0 0 12px; }
    .hero p { color: #e8f4ff; }
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
      font-weight: 800;
      color: #5f3900;
      margin-bottom: 16px;
    }
    .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-top: 16px; }
    .kpi { background: white; color: var(--ink); border: 1px solid #c9def3; border-radius: 12px; padding: 12px; }
    .kpi b { display: block; color: var(--blue); font-size: 28px; line-height: 1; }
    .kpi span { display: block; color: var(--muted); font-size: 12px; margin-top: 5px; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 12px; }
    table { width: 100%; min-width: 1120px; border-collapse: collapse; table-layout: fixed; background: white; }
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
    th { background: #e8f4ff; color: #073b63; font-weight: 800; }
    tr:last-child td { border-bottom: 0; }
    th:last-child, td:last-child { border-right: 0; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 12px; }
    .button {
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
    }
    @media (max-width: 900px) {
      main { width: min(100% - 20px, 1180px); padding-top: 16px; }
      .kpis { grid-template-columns: 1fr 1fr; }
      table { min-width: 920px; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <h1>候補10社 根拠付き選定作業表</h1>
      <p>明日2026年5月27日に候補10社を根拠付きで説明するため、量的評価、質的評価、未完了項目、次の確認作業を分けて整理しました。</p>
      <div class="actions">
        <a class="button" href="june_test_10_selection_board_20260526.html">既存10社表へ戻る</a>
        <a class="button" href="466_candidate_10_quantitative_evidence.csv">量的根拠CSV</a>
        <a class="button" href="467_candidate_10_qualitative_evidence.csv">質的根拠CSV</a>
        <a class="button" href="468_candidate_10_selection_decision.csv">選定作業CSV</a>
      </div>
      <div class="kpis">
        <div class="kpi"><b>${selectionRows.length}</b><span>確認対象銘柄</span></div>
        <div class="kpi"><b>${eventInputRows.length}</b><span>質的仮説</span></div>
        <div class="kpi"><b>未加点</b><span>質的情報の扱い</span></div>
        <div class="kpi"><b>0社</b><span>購入判断</span></div>
      </div>
    </section>

    <div class="notice">
      重要: この表は候補10社を説明するための選定作業表です。購入判断は6月の市場イベント実数を入れた後に再判定します。
    </div>

    <section class="panel">
      <h2>選定作業表</h2>
      ${table(
        [
          { key: 'selection_rank', label: '順位' },
          { key: 'ticker', label: '銘柄' },
          { key: 'company', label: '会社' },
          { key: 'current_role', label: '現在の役割' },
          { key: 'quantitative_grade', label: '量的評価' },
          { key: 'qualitative_status', label: '質的評価' },
          { key: 'selection_reason', label: '選定理由' },
          { key: 'remaining_check', label: '未完了項目' },
          { key: 'purchase_status', label: '購入判断' },
        ],
        selectionDecisionRows,
      )}
    </section>

    <section class="panel">
      <h2>量的根拠</h2>
      ${table(
        [
          { key: 'selection_rank', label: '順位' },
          { key: 'ticker', label: '銘柄' },
          { key: 'company', label: '会社' },
          { key: 'priority_score', label: '優先点' },
          { key: 'nisa_score', label: 'NISA点' },
          { key: 'data_confidence', label: '信頼度' },
          { key: 'per', label: 'PER' },
          { key: 'pbr', label: 'PBR' },
          { key: 'roe_pct', label: 'ROE' },
          { key: 'revenue_yoy_pct', label: '売上成長' },
          { key: 'profit_yoy_pct', label: '利益成長' },
          { key: 'data_gap', label: '不足' },
        ],
        quantitativeRows,
      )}
    </section>

    <section class="panel">
      <h2>質的根拠</h2>
      ${table(
        [
          { key: 'selection_rank', label: '順位' },
          { key: 'ticker', label: '銘柄' },
          { key: 'company', label: '会社' },
          { key: 'qualitative_status', label: '状態' },
          { key: 'qualitative_themes', label: '時流・イベント仮説' },
          { key: 'qualitative_use', label: '扱い' },
        ],
        qualitativeRows,
      )}
    </section>

    <section class="panel">
      <h2>明日の作業</h2>
      ${table(
        [
          { key: 'priority', label: '優先' },
          { key: 'task', label: '作業' },
          { key: 'detail', label: '内容' },
          { key: 'output', label: '成果物' },
        ],
        tomorrowRows,
      )}
    </section>
  </main>
</body>
</html>`);

fs.writeFileSync(path.join(ROOT, 'candidate_10_rational_selection_board_20260526.html'), html, 'utf8');

console.log('created candidate_10_rational_selection_board_20260526.html');
console.log(`candidates=${selectionRows.length}, events=${eventInputRows.length}`);
