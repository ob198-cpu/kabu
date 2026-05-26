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

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function num(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function statusMark(status) {
  if (status === '接続済み') return '済';
  if (status === '一部接続') return '一部';
  if (!status || status === '未取得') return '未';
  return status;
}

function gapItems(text) {
  if (!text || text === 'なし') return [];
  return text.split(/\s+\/\s+/).map((item) => item.trim()).filter(Boolean);
}

function gapResolvableScore(text) {
  const items = gapItems(text);
  if (!items.length) return 100;
  let score = 100 - items.length * 10;
  if (items.some((item) => item.includes('20営業日'))) score -= 8;
  if (items.some((item) => item.includes('イベント後リターン'))) score -= 10;
  if (items.some((item) => item.includes('財務指標'))) score -= 6;
  if (items.some((item) => item.includes('業種別補正'))) score -= 4;
  return Math.max(45, Math.round(score));
}

function lane(row, priorityScore) {
  const completion = num(row.completion_score);
  const confidence = num(row.data_confidence);
  if (completion >= 90 && confidence >= 95) return '一次テスト候補';
  if (completion >= 82 && priorityScore >= 70) return '補完後テスト候補';
  if (completion >= 75) return '補完優先';
  return '補欠・保留';
}

function taskFor(row) {
  const gaps = gapItems(row.remaining_gaps);
  if (!gaps.length) return '6月イベント後の実数入力待ち。';
  const tasks = [];
  if (gaps.some((item) => item.includes('財務指標'))) tasks.push('PER/PBR/ROE、売上成長、利益成長の欠けを公式決算または既存CSVで補完');
  if (gaps.some((item) => item.includes('決算後20営業日反応'))) tasks.push('20営業日が未到達なら未到達として固定し、1日/5日反応だけ別枠で記録');
  if (gaps.some((item) => item.includes('業種別補正'))) tasks.push('同業比較を最低2社以上に増やしてPER/PBR/ROEの相対位置を確認');
  if (gaps.some((item) => item.includes('イベント後リターン'))) tasks.push('イベント日と株価時系列を結合し、1日/5日/20日超過リターン欄へ接続');
  return tasks.join('。') + '。';
}

const universeRows = readCsv('276_candidate_supplement_screening.csv');
const top20Rows = readCsv('274_top20_completion_recalculated_candidates.csv');
const completionRows = readCsv('339_candidate_data_completion_matrix.csv');
const gapRows = readCsv('340_candidate_data_gap_queue.csv');

const top20ByTicker = new Map(top20Rows.map((row) => [row.ticker, row]));
const universeByTicker = new Map(universeRows.map((row) => [row.ticker, row]));
const gapByTicker = new Map();
for (const row of gapRows) {
  if (!gapByTicker.has(row.ticker)) gapByTicker.set(row.ticker, []);
  gapByTicker.get(row.ticker).push(row);
}

const matrixRows = completionRows.map((row) => {
  const top = top20ByTicker.get(row.ticker) || universeByTicker.get(row.ticker) || {};
  const resolvability = gapResolvableScore(row.remaining_gaps);
  const priorityScore = Math.round(
    num(row.completion_score) * 0.40
      + num(row.data_confidence) * 0.25
      + num(row.nisa_score) * 0.20
      + resolvability * 0.15,
  );
  const testLane = lane(row, priorityScore);
  const gapCount = gapItems(row.remaining_gaps).length;
  const financialReady = statusMark(row.financial_status);
  const reactionReady = statusMark(row.earnings_reaction_status);
  const sectorReady = statusMark(row.sector_adjustment_status);
  const plus1Ready = statusMark(row.plus1_status);
  const eventReady = statusMark(row.event_causality_status);
  const purchaseAllowed = '不可';
  const purchaseReason = '6月イベント前のため購入判断には使わない。候補抽出と不足補完に限定。';
  return {
    updated_at: generatedAt,
    priority_rank: row.rank,
    ticker: row.ticker,
    company: row.company,
    sector: row.sector,
    category: row.category,
    nisa_score: row.nisa_score,
    data_confidence: row.data_confidence,
    completion_score: row.completion_score,
    gap_resolvability_score: resolvability,
    priority_score: priorityScore,
    test_lane: testLane,
    purchase_allowed: purchaseAllowed,
    purchase_reason: purchaseReason,
    financial_ready: financialReady,
    reaction_ready: reactionReady,
    sector_adjustment_ready: sectorReady,
    plus1_ready: plus1Ready,
    event_causality_ready: eventReady,
    gap_count: gapCount,
    remaining_gaps: row.remaining_gaps,
    per: top.per || '',
    pbr: top.pbr || '',
    roe_pct: top.roe_pct || '',
    revenue_yoy_pct: top.revenue_yoy_pct || '',
    profit_yoy_pct: top.profit_yoy_pct || '',
    earnings_reaction_score: top.earnings_reaction_score || '',
    next_48h_task: taskFor(row),
  };
}).sort((a, b) => num(b.priority_score) - num(a.priority_score));

const strictReady = matrixRows.filter((row) => row.test_lane === '一次テスト候補').length;
const afterCompletion = matrixRows.filter((row) => row.test_lane === '一次テスト候補' || row.test_lane === '補完後テスト候補').length;
const financeDone = matrixRows.filter((row) => row.financial_ready === '済').length;
const reactionDone = matrixRows.filter((row) => row.reaction_ready === '済').length;
const eventDone = matrixRows.filter((row) => row.event_causality_ready === '済').length;

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '母集団',
    value: `${universeRows.length}社`,
    interpretation: 'きっちり100社ではなく、現時点で意味のある一次母集団として80社を使用。上位20社を補完し、10社ワークボードへ落としている。',
  },
  {
    updated_at: generatedAt,
    item: '作業対象',
    value: `${matrixRows.length}社`,
    interpretation: '6月テストに向け、現在は10社を不足補完対象として管理。',
  },
  {
    updated_at: generatedAt,
    item: '厳格にほぼ完成',
    value: `${strictReady}社`,
    interpretation: '現時点でデータ完成度が高く、次工程に進みやすい銘柄数。購入候補ではない。',
  },
  {
    updated_at: generatedAt,
    item: '2日補完後に候補化し得る範囲',
    value: `${afterCompletion}社`,
    interpretation: '不足データを埋めるとテスト候補へ進められる可能性がある範囲。20営業日未到達データは無理に埋めず、未到達として記録する。',
  },
  {
    updated_at: generatedAt,
    item: '購入判断',
    value: '0社',
    interpretation: '6月CPI、日銀、FOMC、指数ゲート前のため、現段階では購入判断には使わない。',
  },
];

const missingRows = matrixRows.flatMap((row) => {
  const gaps = gapByTicker.get(row.ticker) || [];
  if (!gaps.length) {
    return [{
      updated_at: generatedAt,
      ticker: row.ticker,
      company: row.company,
      missing_area: 'なし',
      current_status: '接続済み',
      priority: '低',
      can_resolve_in_48h: '実数待ちを除き大きな不足なし',
      action: '6月イベント後の実数入力へ進める。',
    }];
  }
  return gaps.map((gap) => ({
    updated_at: generatedAt,
    ticker: row.ticker,
    company: row.company,
    missing_area: gap.data_area,
    current_status: gap.current_status,
    priority: gap.priority,
    can_resolve_in_48h: gap.data_area.includes('決算後反応') && gap.action.includes('20営業日到達後')
      ? '20営業日未到達なら完全解消は不可。未到達として別扱いにする。'
      : '既存CSV・公式資料・株価時系列の結合で初期対応可能。',
    action: gap.action,
  }));
});

const formulaRows = [
  {
    updated_at: generatedAt,
    formula_name: '候補補完優先スコア',
    formula: 'completion_score×40% + data_confidence×25% + nisa_score×20% + gap_resolvability_score×15%',
    purpose: '購入可否ではなく、どの銘柄から不足補完して10社候補化するかを決める。',
    warning: '未取得データを高得点扱いしない。未到達の決算後20営業日反応は、未到達として記録する。',
  },
  {
    updated_at: generatedAt,
    formula_name: '購入判断との切り分け',
    formula: '購入判断 = 6月イベント実数ゲート通過 + 候補別ゲート通過 + 予実差記録開始後に再判定',
    purpose: '候補抽出スコアをそのまま購入判断へ使わないため。',
    warning: '現段階はテスト候補抽出であり、購入候補確定ではない。',
  },
  {
    updated_at: generatedAt,
    formula_name: '+1%目標との接続',
    formula: '候補の1/5/20営業日後リターン - 日経平均/TOPIX/S&P500同期間リターン',
    purpose: '証券会社や指数連動投信より+1%上回る目的に接続する。',
    warning: '実績比較は購入前ではなく、前向きテストの記録として蓄積する。',
  },
];

const scheduleRows = [
  {
    updated_at: generatedAt,
    phase: '本日',
    action: '10社ワークボードを固定し、不足データと補完順を一覧化',
    output: '候補10社補完ページ、優先補完CSV、未取得データCSV',
  },
  {
    updated_at: generatedAt,
    phase: '24時間以内',
    action: 'PER/PBR/ROE、売上成長、利益成長の欠けを公式決算・既存CSVから補完',
    output: '財務補完済み候補表',
  },
  {
    updated_at: generatedAt,
    phase: '48時間以内',
    action: '決算後1日/5日反応、同業比較、イベント後リターンの接続可否を判定',
    output: '6月テスト候補10社の暫定版。20営業日未到達は未到達として明記。',
  },
  {
    updated_at: generatedAt,
    phase: '6月イベント後',
    action: 'CPI、日銀、FOMC、指数ゲートの実数を入れて再判定',
    output: '購入可否ではなく、NISAテスト開始可否の判断材料。',
  },
];

writeCsv('412_candidate_10_priority_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'interpretation',
]);

writeCsv('413_candidate_10_priority_matrix.csv', matrixRows, [
  'updated_at',
  'priority_rank',
  'ticker',
  'company',
  'sector',
  'category',
  'nisa_score',
  'data_confidence',
  'completion_score',
  'gap_resolvability_score',
  'priority_score',
  'test_lane',
  'purchase_allowed',
  'purchase_reason',
  'financial_ready',
  'reaction_ready',
  'sector_adjustment_ready',
  'plus1_ready',
  'event_causality_ready',
  'gap_count',
  'remaining_gaps',
  'per',
  'pbr',
  'roe_pct',
  'revenue_yoy_pct',
  'profit_yoy_pct',
  'earnings_reaction_score',
  'next_48h_task',
]);

writeCsv('414_candidate_10_missing_data_resolution.csv', missingRows, [
  'updated_at',
  'ticker',
  'company',
  'missing_area',
  'current_status',
  'priority',
  'can_resolve_in_48h',
  'action',
]);

writeCsv('415_candidate_10_selection_formula.csv', formulaRows, [
  'updated_at',
  'formula_name',
  'formula',
  'purpose',
  'warning',
]);

writeCsv('416_candidate_10_schedule.csv', scheduleRows, [
  'updated_at',
  'phase',
  'action',
  'output',
]);

function table(headers, rows, cells) {
  return `<table><thead><tr>${headers.map((header) => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${
    rows.map((row) => `<tr>${cells.map((cell) => `<td>${cell(row)}</td>`).join('')}</tr>`).join('')
  }</tbody></table>`;
}

function badge(text) {
  const cls = text.includes('候補') ? 'good' : text.includes('保留') || text.includes('補完') ? 'warn' : 'muted';
  return `<span class="badge ${cls}">${esc(text)}</span>`;
}

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 優先補完ダッシュボード</title>
  <style>
    :root {
      --ink: #071b33;
      --muted: #506070;
      --line: #d6e3f1;
      --bg: #f5f8fc;
      --panel: #ffffff;
      --blue: #126392;
      --green: #087b53;
      --amber: #a85f00;
      --red: #b3261e;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Yu Gothic", "Meiryo", Arial, sans-serif;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.7;
    }
    header {
      background: #103a5c;
      color: #fff;
      padding: 28px;
    }
    main {
      max-width: 1180px;
      margin: 0 auto;
      padding: 24px;
    }
    h1 { margin: 0 0 8px; font-size: 30px; }
    h2 {
      margin: 28px 0 12px;
      padding-left: 12px;
      border-left: 8px solid var(--blue);
      font-size: 22px;
    }
    a { color: inherit; }
    .toolbar {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 18px;
    }
    .toolbar a, .button {
      display: inline-flex;
      align-items: center;
      min-height: 38px;
      padding: 8px 12px;
      border-radius: 8px;
      background: #fff;
      color: #103a5c;
      text-decoration: none;
      font-weight: 800;
      border: 1px solid #b9d3eb;
    }
    .notice {
      background: #fff8e8;
      border: 1px solid #f0c46d;
      color: #3f2b00;
      border-radius: 10px;
      padding: 12px;
      margin-top: 12px;
      font-weight: 800;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 12px;
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 14px;
      box-shadow: 0 8px 18px rgba(8, 42, 73, .06);
      break-inside: avoid;
    }
    .card h3 { margin: 0 0 8px; color: #103a5c; }
    .kpi { font-size: 28px; font-weight: 900; color: var(--blue); }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      background: #fff;
    }
    th, td {
      border: 1px solid var(--line);
      padding: 9px;
      vertical-align: top;
      word-break: break-word;
      overflow-wrap: anywhere;
      color: #071b33;
    }
    th { background: #e6f2fb; text-align: left; font-weight: 900; }
    tbody tr:nth-child(even) { background: #fbfdff; }
    .badge {
      display: inline-flex;
      padding: 3px 8px;
      border-radius: 999px;
      font-weight: 900;
      border: 1px solid var(--line);
      background: #f7fbff;
    }
    .good { color: var(--green); }
    .warn { color: var(--amber); }
    .bad { color: var(--red); }
    .muted { color: var(--muted); }
    .small { font-size: 13px; color: var(--muted); }
    @media (max-width: 900px) {
      .grid { grid-template-columns: 1fr; }
      table { font-size: 13px; }
    }
    @media print {
      body { background: #fff; color: #000; }
      header { background: #fff; color: #000; border-bottom: 3px solid #000; }
      .toolbar { display: none; }
      .card { box-shadow: none; }
      tr { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <header>
    <h1>候補10社 優先補完ダッシュボード</h1>
    <p>80社前後の母集団から、上位20社を経て、6月テスト候補10社へ絞るための不足データ補完表です。</p>
    <div class="notice">このページは候補抽出・補完作業用です。6月イベント前のため、購入判断には使いません。</div>
    <div class="toolbar">
      <a href="index.html">トップ</a>
      <a href="candidate_data_completion_20260526.html">候補データ補完</a>
      <a href="top20_completion_recalculated_candidates.html">上位20社補完表</a>
      <a href="semiconductor_forward_log_bridge_20260526.html">CSV読込確認</a>
      <a href="semiconductor_june_result_input_cockpit_20260526.html">6月実績入力</a>
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

    <h2>1. 10社ワークボード</h2>
    <p class="small">候補補完優先スコアは、購入判断ではなく「どの銘柄の不足データを先に埋めるか」の順番です。</p>
    <section>
      ${table(
        ['順位', '銘柄', 'レーン', '優先点', 'NISA点', '完成度', '信頼度', 'PER/PBR/ROE', '売上/利益', '残課題', '48時間内の作業'],
        matrixRows,
        [
          (row) => esc(row.priority_rank),
          (row) => `<strong>${esc(row.ticker)} ${esc(row.company)}</strong><br>${esc(row.sector)}`,
          (row) => badge(row.test_lane),
          (row) => `${esc(row.priority_score)}点`,
          (row) => `${esc(row.nisa_score)}点`,
          (row) => `${esc(row.completion_score)}点`,
          (row) => `${esc(row.data_confidence)}点`,
          (row) => `PER ${esc(row.per || '未取得')}<br>PBR ${esc(row.pbr || '未取得')}<br>ROE ${esc(row.roe_pct || '未取得')}%`,
          (row) => `売上 ${esc(row.revenue_yoy_pct || '未取得')}%<br>利益 ${esc(row.profit_yoy_pct || '未取得')}%`,
          (row) => esc(row.remaining_gaps || 'なし'),
          (row) => esc(row.next_48h_task),
        ],
      )}
    </section>

    <h2>2. 不足データの解消可否</h2>
    <section>
      ${table(
        ['銘柄', '不足領域', '現状', '優先', '48時間内の扱い', '作業'],
        missingRows,
        [
          (row) => `<strong>${esc(row.ticker)} ${esc(row.company)}</strong>`,
          (row) => esc(row.missing_area),
          (row) => esc(row.current_status),
          (row) => esc(row.priority),
          (row) => esc(row.can_resolve_in_48h),
          (row) => esc(row.action),
        ],
      )}
    </section>

    <h2>3. 計算式と使い方</h2>
    <section>
      ${table(
        ['式', '内容', '目的', '注意'],
        formulaRows,
        [
          (row) => `<strong>${esc(row.formula_name)}</strong>`,
          (row) => esc(row.formula),
          (row) => esc(row.purpose),
          (row) => esc(row.warning),
        ],
      )}
    </section>

    <h2>4. 優先スケジュール</h2>
    <section>
      ${table(
        ['時期', '作業', '成果物'],
        scheduleRows,
        [
          (row) => esc(row.phase),
          (row) => esc(row.action),
          (row) => esc(row.output),
        ],
      )}
    </section>

    <h2>5. CSV</h2>
    <section>
      ${table(
        ['ファイル', '内容'],
        [
          ['412_candidate_10_priority_summary.csv', '要約'],
          ['413_candidate_10_priority_matrix.csv', '10社優先補完表'],
          ['414_candidate_10_missing_data_resolution.csv', '不足データ解消表'],
          ['415_candidate_10_selection_formula.csv', '計算式'],
          ['416_candidate_10_schedule.csv', '優先スケジュール'],
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

fs.writeFileSync(path.join(ROOT, 'candidate_10_priority_completion_20260526.html'), html, 'utf8');
