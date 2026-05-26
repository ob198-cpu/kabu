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

function cleanLines(text) {
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+$/g, ''))
    .join('\n');
}

function numberValue(value) {
  const text = String(value ?? '').replaceAll(',', '').trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

function hasNumber(value) {
  return numberValue(value) !== null;
}

function byTicker(rows) {
  return new Map(rows.filter((row) => row.ticker).map((row) => [row.ticker, row]));
}

function statusCell(connected, partial, missing, note) {
  if (connected) return { status: '接続済み', score: 1, note };
  if (partial) return { status: '一部接続', score: 0.5, note };
  return { status: '未接続', score: 0, note: missing };
}

const baseRows = readCsv('280_nisa_test_10_candidate_plan_reaction_updated.csv');
const reactionRows = [
  ...readCsv('273_top20_earnings_reaction_completed.csv'),
  ...readCsv('279_supplement_earnings_reaction_check.csv'),
];
const sectorRows = readCsv('300_candidate_sector_adjustment.csv');
const backtestRows = readCsv('305_candidate_backtest_connection.csv');
const plus1Rows = readCsv('310_candidate_plus1_gate.csv');
const causalityRows = readCsv('315_candidate_causality_gate.csv');

const reactionByTicker = byTicker(reactionRows);
const sectorByTicker = byTicker(sectorRows);
const backtestByTicker = byTicker(backtestRows);
const plus1ByTicker = byTicker(plus1Rows);
const causalityByTicker = byTicker(causalityRows);

const sourceRows = [
  {
    data_area: '候補10社本体',
    source_file: '280_nisa_test_10_candidate_plan_reaction_updated.csv',
    purpose: 'NISA 1年保有スコア、カテゴリ、PER/PBR/ROE、成長率、信頼度の基礎。',
    status: baseRows.length ? '接続済み' : '未接続',
  },
  {
    data_area: '決算後反応',
    source_file: '273_top20_earnings_reaction_completed.csv / 279_supplement_earnings_reaction_check.csv',
    purpose: '決算後1日、5日、20営業日反応。20営業日未到達は一部接続扱い。',
    status: reactionRows.length ? '一部接続' : '未接続',
  },
  {
    data_area: '業種別補正',
    source_file: '300_candidate_sector_adjustment.csv',
    purpose: 'PER/PBR/ROEを業種内で比較できるか確認。',
    status: sectorRows.length ? '一部接続' : '未接続',
  },
  {
    data_area: '+1%比較',
    source_file: '310_candidate_plus1_gate.csv',
    purpose: '日経平均など比較対象を+1%上回る線と接続。',
    status: plus1Rows.length ? '接続済み' : '未接続',
  },
  {
    data_area: 'イベント後リターン',
    source_file: '305_candidate_backtest_connection.csv / 315_candidate_causality_gate.csv',
    purpose: 'イベント後リターン、複合条件、因果ゲートへの接続。',
    status: backtestRows.length && causalityRows.length ? '一部接続' : '未接続',
  },
];

const ruleRows = [
  {
    rule: '未取得は加点しない',
    check: 'PER/PBR/ROE、決算後反応、イベント後リターンが空欄なら、点数ではなく未接続として表示。',
    reason: '計算したふりを防ぐため。',
  },
  {
    rule: '20営業日未到達は一部接続',
    check: '決算後1日/5日は見えても20営業日が未到達なら、購入検討用スコアの根拠としては未完成。',
    reason: '短期反応だけで1年保有判断をしないため。',
  },
  {
    rule: '同業比較は参考条件つき',
    check: '同業3社以上かつ候補側指標2項目以上を原則とし、基準未満は未反映。',
    reason: '業種差を補正するが、比較数不足の過信を避けるため。',
  },
  {
    rule: '+1%比較は後ろ向き確認',
    check: '1年騰落率で比較対象+1%を超えても、将来の保証ではなく追加検証条件として扱う。',
    reason: '目的との接続は必要だが、過去成績だけで買わないため。',
  },
  {
    rule: 'イベント因果は本体点に直足ししない',
    check: 'イベント後リターンや複合条件は確認優先度・ゲートに使い、未検証の仮説点は本体点に混ぜない。',
    reason: '質的材料の単純加点ミスを避けるため。',
  },
];

function makeMatrixRow(row) {
  const reaction = reactionByTicker.get(row.ticker) ?? {};
  const sector = sectorByTicker.get(row.ticker) ?? {};
  const backtest = backtestByTicker.get(row.ticker) ?? {};
  const plus1 = plus1ByTicker.get(row.ticker) ?? {};
  const causality = causalityByTicker.get(row.ticker) ?? {};

  const financialCount = [
    row.revenue_yoy_pct,
    row.profit_yoy_pct,
    row.per,
    row.pbr,
    row.roe_pct,
  ].filter(hasNumber).length;
  const financialStatus = financialCount >= 5
    ? statusCell(true, false, '', '売上成長、利益成長、PER/PBR/ROEを接続。')
    : statusCell(false, financialCount >= 3, '重要財務指標が不足。', `${financialCount}/5項目接続。`);

  const priceRiskCount = [
    row.ret1y_pct,
    row.max_drawdown60_pct,
    row.data_confidence,
    row.downside_safety_score,
  ].filter(hasNumber).length;
  const priceRiskStatus = statusCell(
    priceRiskCount >= 4,
    priceRiskCount >= 2,
    '株価・下落耐性データが不足。',
    `${priceRiskCount}/4項目接続。`,
  );

  const reactionStatusText = reaction.reaction_status || row.score_basis || row.hard_gate || '';
  const reactionScore = numberValue(reaction.earnings_reaction_score ?? row.earnings_reaction_score);
  const reactionStatus = statusCell(
    reactionScore !== null && !/未到達/.test(reactionStatusText),
    reactionScore !== null && /未到達/.test(reactionStatusText),
    '決算後反応が未接続。',
    reactionStatusText || '決算後反応スコアあり。',
  );

  const sectorComparable = String(sector.per_vs_sector ?? '').trim() && sector.per_vs_sector !== '未算出';
  const sectorStatus = statusCell(
    sectorComparable,
    numberValue(sector.candidate_metric_count) >= 2,
    '同業比較が未反映。',
    sectorComparable ? `PER比較: ${sector.per_vs_sector}` : `候補側指標${sector.candidate_metric_count || '-'}項目、同業${sector.peer_count || '-'}社。`,
  );

  const plus1Status = statusCell(
    Boolean(plus1.plus1_status),
    false,
    '+1%比較が未接続。',
    plus1.plus1_status || '',
  );

  const eventCount = numberValue(backtest.event_count_calculated ?? causality.event_return_records) ?? 0;
  const causalityConnected = causality.causality_status && causality.causality_status !== '未接続';
  const eventStatus = statusCell(
    eventCount > 0 && causalityConnected,
    eventCount > 0 || causalityConnected,
    'イベント後リターンまたは複合条件が未接続。',
    eventCount > 0 ? `${eventCount}件のイベント後リターン接続。` : (causality.causality_status || '未接続'),
  );

  const completionScore = Math.round(
    financialStatus.score * 25
    + priceRiskStatus.score * 20
    + reactionStatus.score * 20
    + plus1Status.score * 15
    + sectorStatus.score * 10
    + eventStatus.score * 10,
  );

  const gapList = [
    financialStatus.status !== '接続済み' ? '財務指標' : '',
    reactionStatus.status !== '接続済み' ? '決算後20営業日反応' : '',
    sectorStatus.status !== '接続済み' ? '業種別補正' : '',
    eventStatus.status !== '接続済み' ? 'イベント後リターン/因果' : '',
  ].filter(Boolean);

  const readiness = completionScore >= 85 && !gapList.length
    ? '検証候補として継続'
    : completionScore >= 70
      ? '追加確認対象'
      : '保留';

  return {
    updated_at: generatedAt,
    rank: row.nisa_rank,
    ticker: row.ticker,
    company: row.company,
    sector: row.sector,
    category: row.category,
    nisa_score: row.nisa_score,
    data_confidence: row.data_confidence,
    completion_score: completionScore,
    readiness,
    financial_status: financialStatus.status,
    financial_note: financialStatus.note,
    price_risk_status: priceRiskStatus.status,
    price_risk_note: priceRiskStatus.note,
    earnings_reaction_status: reactionStatus.status,
    earnings_reaction_note: reactionStatus.note,
    sector_adjustment_status: sectorStatus.status,
    sector_adjustment_note: sectorStatus.note,
    plus1_status: plus1Status.status,
    plus1_note: plus1Status.note,
    event_causality_status: eventStatus.status,
    event_causality_note: eventStatus.note,
    remaining_gaps: gapList.join(' / ') || 'なし',
    next_action: gapList.length
      ? `${gapList.join('、')}を補完してから6月判定へ進める。`
      : '6月イベント後の判定入力へ進める。',
  };
}

const matrixRows = baseRows.map(makeMatrixRow);

const gapRows = matrixRows.flatMap((row) => {
  const items = [];
  const push = (area, status, priority, action) => {
    if (status === '接続済み') return;
    items.push({
      updated_at: generatedAt,
      ticker: row.ticker,
      company: row.company,
      data_area: area,
      current_status: status,
      priority,
      action,
    });
  };
  push('財務指標', row.financial_status, row.financial_status === '未接続' ? '高' : '中', 'PER/PBR/ROE・売上成長・利益成長の欠けを公式決算または既存CSVで確認。');
  push('決算後反応', row.earnings_reaction_status, '高', '20営業日到達後に対日経平均の1日/5日/20日超過リターンを再計算。');
  push('業種別補正', row.sector_adjustment_status, '中', '同業数と候補側指標数を増やせる場合のみ補正値へ反映。');
  push('イベント後リターン/因果', row.event_causality_status, '高', 'イベント日と株価時系列を結合し、類似イベントの超過リターンを確認。');
  return items;
});

const connectedCount = matrixRows.filter((row) => row.completion_score >= 85).length;
const partialCount = matrixRows.filter((row) => row.completion_score >= 70 && row.completion_score < 85).length;
const holdCount = matrixRows.filter((row) => row.completion_score < 70).length;
const avgCompletion = matrixRows.length
  ? Math.round(matrixRows.reduce((sum, row) => sum + Number(row.completion_score), 0) / matrixRows.length)
  : 0;

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '対象銘柄',
    value: `${matrixRows.length}社`,
    interpretation: '280_nisa_test_10_candidate_plan_reaction_updated.csvのNISA検証候補10社。',
  },
  {
    updated_at: generatedAt,
    item: '平均接続率',
    value: `${avgCompletion}点`,
    interpretation: '財務、株価/下落耐性、決算後反応、+1%比較、業種補正、イベント因果の接続度。',
  },
  {
    updated_at: generatedAt,
    item: '85点以上',
    value: `${connectedCount}社`,
    interpretation: '接続率上位。ただし未接続が残る場合は追加確認対象で、購入確定ではない。',
  },
  {
    updated_at: generatedAt,
    item: '70〜84点',
    value: `${partialCount}社`,
    interpretation: '追加確認対象。20営業日反応やイベント接続を補う。',
  },
  {
    updated_at: generatedAt,
    item: '70点未満',
    value: `${holdCount}社`,
    interpretation: '保留。重要データの補完が必要。',
  },
  {
    updated_at: generatedAt,
    item: '未接続タスク',
    value: `${gapRows.length}件`,
    interpretation: '銘柄別に補完すべきデータ領域の数。',
  },
];

writeCsv('338_candidate_data_completion_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'interpretation',
]);

writeCsv('339_candidate_data_completion_matrix.csv', matrixRows, [
  'updated_at',
  'rank',
  'ticker',
  'company',
  'sector',
  'category',
  'nisa_score',
  'data_confidence',
  'completion_score',
  'readiness',
  'financial_status',
  'financial_note',
  'price_risk_status',
  'price_risk_note',
  'earnings_reaction_status',
  'earnings_reaction_note',
  'sector_adjustment_status',
  'sector_adjustment_note',
  'plus1_status',
  'plus1_note',
  'event_causality_status',
  'event_causality_note',
  'remaining_gaps',
  'next_action',
]);

writeCsv('340_candidate_data_gap_queue.csv', gapRows, [
  'updated_at',
  'ticker',
  'company',
  'data_area',
  'current_status',
  'priority',
  'action',
]);

writeCsv('341_candidate_data_completion_sources.csv', sourceRows.map((row) => ({ updated_at: generatedAt, ...row })), [
  'updated_at',
  'data_area',
  'source_file',
  'purpose',
  'status',
]);

writeCsv('342_candidate_data_completion_rules.csv', ruleRows.map((row) => ({ updated_at: generatedAt, ...row })), [
  'updated_at',
  'rule',
  'check',
  'reason',
]);

const badgeClass = (status) => {
  if (status === '接続済み') return 'ok';
  if (status === '一部接続' || status === '追加確認対象') return 'warn';
  return 'stop';
};

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 未接続データ補完 2026年5月26日</title>
  <style>
    :root {
      --ink: #111;
      --blue: #073a5a;
      --line: #bed3e5;
      --bg: #f5f8fb;
      --card: #fff;
      --ok: #eaf7ef;
      --warn: #fff5df;
      --stop: #fdecec;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Yu Gothic", Meiryo, sans-serif;
      color: var(--ink);
      background: var(--bg);
      line-height: 1.65;
    }
    main { max-width: 1240px; margin: 0 auto; padding: 28px 18px 56px; }
    h1 { margin: 0 0 8px; color: var(--blue); font-size: 30px; }
    h2 { margin: 30px 0 12px; padding-left: 10px; border-left: 8px solid #0b6f9f; color: var(--blue); }
    .lead, .card, .kpi {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 16px 18px;
      box-shadow: 0 2px 9px rgba(0,40,80,.06);
    }
    .toolbar { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
    .button {
      display: inline-block;
      padding: 8px 12px;
      border: 1px solid #9fc1db;
      border-radius: 8px;
      background: #fff;
      color: var(--blue);
      text-decoration: none;
      font-weight: 700;
    }
    .kpis { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 12px; margin: 18px 0; }
    .kpi small { display: block; color: #38536b; font-weight: 700; }
    .kpi b { display: block; color: var(--blue); font-size: 24px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; background: #fff; }
    th, td {
      border: 1px solid var(--line);
      padding: 9px 10px;
      vertical-align: top;
      font-size: 13px;
      color: #111;
      overflow-wrap: anywhere;
    }
    th { background: #e4f1fa; color: var(--blue); }
    .badge {
      display: inline-block;
      min-width: 78px;
      text-align: center;
      padding: 2px 8px;
      border-radius: 999px;
      font-weight: 800;
      font-size: 12px;
    }
    .ok { background: var(--ok); color: #007a3d; }
    .warn { background: var(--warn); color: #8a5200; }
    .stop { background: var(--stop); color: #b00020; }
    .note { color: #333; font-size: 13px; }
    @media (max-width: 1000px) { .kpis { grid-template-columns: 1fr; } }
    @media print {
      body { background: #fff; }
      .lead, .card, .kpi { break-inside: avoid; page-break-inside: avoid; box-shadow: none; }
    }
  </style>
</head>
<body>
<main>
  <h1>候補10社 未接続データ補完</h1>
  <div class="lead">
    <p><b>目的:</b> NISA 1年保有テストの検証候補10社について、どのデータが接続済みで、どこが未接続かを銘柄別に見える化します。</p>
    <p><b>結論:</b> 10社すべてにNISAスコアと+1%比較は接続済みです。一方、決算後20営業日反応、業種補正、イベント後リターン/因果は銘柄ごとに補完が必要です。</p>
    <div class="toolbar">
      <a class="button" href="338_candidate_data_completion_summary.csv">338 要約CSV</a>
      <a class="button" href="339_candidate_data_completion_matrix.csv">339 接続マトリクスCSV</a>
      <a class="button" href="340_candidate_data_gap_queue.csv">340 補完キューCSV</a>
      <a class="button" href="341_candidate_data_completion_sources.csv">341 取得元CSV</a>
      <a class="button" href="342_candidate_data_completion_rules.csv">342 ルールCSV</a>
      <a class="button" href="issue_resolution_flowchart_20260525.html">課題解決フローへ</a>
      <a class="button" href="index.html">メインページへ</a>
    </div>
  </div>

  <div class="kpis">
    ${summaryRows.map((row) => `
      <div class="kpi">
        <small>${esc(row.item)}</small>
        <b>${esc(row.value)}</b>
        <span>${esc(row.interpretation)}</span>
      </div>
    `).join('')}
  </div>

  <h2>1. 銘柄別 接続状況</h2>
  <div class="card">
    <table>
      <thead><tr><th style="width:6%">順位</th><th style="width:14%">銘柄</th><th style="width:8%">接続点</th><th style="width:12%">扱い</th><th>財務</th><th>決算後反応</th><th>+1%比較</th><th>イベント/因果</th><th>残る不足</th></tr></thead>
      <tbody>
        ${matrixRows.map((row) => `
          <tr>
            <td>${esc(row.rank)}</td>
            <td>${esc(row.ticker)}<br>${esc(row.company)}</td>
            <td>${esc(row.completion_score)}点</td>
            <td><span class="badge ${badgeClass(row.readiness)}">${esc(row.readiness)}</span></td>
            <td><span class="badge ${badgeClass(row.financial_status)}">${esc(row.financial_status)}</span><br>${esc(row.financial_note)}</td>
            <td><span class="badge ${badgeClass(row.earnings_reaction_status)}">${esc(row.earnings_reaction_status)}</span><br>${esc(row.earnings_reaction_note)}</td>
            <td><span class="badge ${badgeClass(row.plus1_status)}">${esc(row.plus1_status)}</span><br>${esc(row.plus1_note)}</td>
            <td><span class="badge ${badgeClass(row.event_causality_status)}">${esc(row.event_causality_status)}</span><br>${esc(row.event_causality_note)}</td>
            <td>${esc(row.remaining_gaps)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <h2>2. 補完キュー</h2>
  <div class="card">
    <p class="note">下表は、6月判定前に埋めたい未接続領域です。未取得を仮点で埋めるのではなく、取得・確認できたものだけ次の判定に使います。</p>
    <table>
      <thead><tr><th style="width:14%">銘柄</th><th style="width:16%">領域</th><th style="width:10%">状態</th><th style="width:8%">優先</th><th>作業</th></tr></thead>
      <tbody>
        ${gapRows.map((row) => `
          <tr>
            <td>${esc(row.ticker)}<br>${esc(row.company)}</td>
            <td>${esc(row.data_area)}</td>
            <td><span class="badge ${badgeClass(row.current_status)}">${esc(row.current_status)}</span></td>
            <td>${esc(row.priority)}</td>
            <td>${esc(row.action)}</td>
          </tr>
        `).join('') || '<tr><td colspan="5">未接続タスクなし</td></tr>'}
      </tbody>
    </table>
  </div>

  <h2>3. 使用データとルール</h2>
  <div class="card">
    <table>
      <thead><tr><th style="width:18%">データ領域</th><th style="width:30%">取得元</th><th>目的</th><th style="width:12%">状態</th></tr></thead>
      <tbody>
        ${sourceRows.map((row) => `
          <tr>
            <td>${esc(row.data_area)}</td>
            <td>${esc(row.source_file)}</td>
            <td>${esc(row.purpose)}</td>
            <td><span class="badge ${badgeClass(row.status)}">${esc(row.status)}</span></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <table style="margin-top:14px">
      <thead><tr><th style="width:22%">ルール</th><th>チェック内容</th><th style="width:28%">理由</th></tr></thead>
      <tbody>
        ${ruleRows.map((row) => `
          <tr>
            <td><b>${esc(row.rule)}</b></td>
            <td>${esc(row.check)}</td>
            <td>${esc(row.reason)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <p class="note">作成日時: ${esc(generatedAt)}</p>
  </div>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, 'candidate_data_completion_20260526.html'), cleanLines(html), 'utf8');

console.log(`generated candidate data completion: ${matrixRows.length} candidates, ${gapRows.length} gaps, average ${avgCompletion}`);
