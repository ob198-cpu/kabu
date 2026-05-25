import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();

const FILES = {
  universe: '199_universe100_screening.csv',
  candidates: '280_nisa_test_10_candidate_plan_reaction_updated.csv',
  eventDetail: '37_event_return_detail.csv',
  eventSummary: '38_event_return_summary.csv',
  stockMonthly: '83_stock_monthly_returns.csv',
  marketMonthly: '89_market_monthly_returns.csv',
};

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

function readCsv(file) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return [];
  return parseCsv(fs.readFileSync(full, 'utf8'));
}

function numericValue(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const n = Number(String(value).replaceAll(',', ''));
  return Number.isFinite(n) ? n : null;
}

function mean(values) {
  const nums = values.filter((value) => value !== null && Number.isFinite(value));
  if (!nums.length) return null;
  return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}

function pearson(pairs) {
  const valid = pairs.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
  if (valid.length < 3) return null;
  const xMean = mean(valid.map(([x]) => x));
  const yMean = mean(valid.map(([, y]) => y));
  let numerator = 0;
  let xDenom = 0;
  let yDenom = 0;
  for (const [x, y] of valid) {
    const dx = x - xMean;
    const dy = y - yMean;
    numerator += dx * dy;
    xDenom += dx * dx;
    yDenom += dy * dy;
  }
  if (!xDenom || !yDenom) return null;
  return numerator / Math.sqrt(xDenom * yDenom);
}

function round(value, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '';
  return Number(value).toFixed(digits).replace(/\.?0+$/, '');
}

function pct(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-';
  return `${value >= 0 ? '+' : ''}${round(value, 2)}%`;
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

function rowsByKey(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const value = row[key];
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(row);
  }
  return map;
}

function sortedMonthly(rows) {
  return [...rows]
    .filter((row) => numericValue(row.month_close) !== null)
    .sort((a, b) => String(a.month || '').localeCompare(String(b.month || '')));
}

function trailingReturn(rows, monthsBack = 12) {
  const valid = sortedMonthly(rows);
  if (valid.length <= monthsBack) return null;
  const latest = valid[valid.length - 1];
  const base = valid[valid.length - 1 - monthsBack];
  const latestClose = numericValue(latest.month_close);
  const baseClose = numericValue(base.month_close);
  if (latestClose === null || baseClose === null || baseClose === 0) return null;
  return {
    start_month: base.month,
    end_month: latest.month,
    return_pct: (latestClose / baseClose - 1) * 100,
    month_count: valid.length,
  };
}

function scoreStatus(value) {
  if (value === null) return '未算出';
  if (Math.abs(value) >= 0.4) return '強め';
  if (Math.abs(value) >= 0.2) return '弱め';
  return 'ほぼなし';
}

const universeRows = readCsv(FILES.universe);
const candidateRows = readCsv(FILES.candidates).slice(0, 10);
const eventDetailRows = readCsv(FILES.eventDetail);
const eventSummaryRows = readCsv(FILES.eventSummary);
const stockMonthlyRows = readCsv(FILES.stockMonthly);
const marketMonthlyRows = readCsv(FILES.marketMonthly);

const universeForSanity = universeRows
  .map((row) => ({
    ...row,
    score: numericValue(row.universe_score_100),
    ret1y: numericValue(row.ret1y_pct),
    growth: numericValue(row.growth_score_25),
    quality: numericValue(row.quality_valuation_score_25),
    momentum: numericValue(row.momentum_score_20),
    maxDrawdown60: numericValue(row.max_drawdown60_pct),
  }))
  .filter((row) => row.score !== null && row.ret1y !== null);

const top10ByScore = [...universeForSanity].sort((a, b) => b.score - a.score).slice(0, 10);
const restByScore = universeForSanity.filter((row) => !top10ByScore.includes(row));

const sanityRows = [
  ['総合スコア', 'universe_score_100', '同時点の総合点と1年騰落率の関係を見る。'],
  ['成長スコア', 'growth', '業績成長の点数と1年騰落率の関係を見る。'],
  ['質/割安スコア', 'quality', 'PER/PBR/ROE等の点数と1年騰落率の関係を見る。'],
  ['モメンタムスコア', 'momentum', '株価トレンド点と1年騰落率の関係を見る。'],
  ['60日最大下落率', 'maxDrawdown60', '下落の大きさと1年騰落率の関係を見る。'],
].map(([factor, field, purpose]) => {
  const pairs = universeForSanity
    .map((row) => [field === 'universe_score_100' ? row.score : row[field], row.ret1y])
    .filter(([x, y]) => x !== null && y !== null);
  const correlation = pearson(pairs);
  return {
    updated_at: generatedAt,
    factor,
    field,
    available_count: pairs.length,
    correlation_with_1y_return: round(correlation, 3),
    strength: scoreStatus(correlation),
    top10_avg_ret1y_pct: round(mean(top10ByScore.map((row) => row.ret1y)), 2),
    rest_avg_ret1y_pct: round(mean(restByScore.map((row) => row.ret1y)), 2),
    warning: '同時点の確認であり、未来を当てたバックテストではない。過去時点の財務スナップショットが必要。',
    purpose,
  };
});

const stockMonthlyByTicker = rowsByKey(stockMonthlyRows, 'ticker');
const eventSummaryByTicker = new Map(eventSummaryRows.map((row) => [row.ticker, row]));
const n225Rows = marketMonthlyRows.filter((row) => row.market_symbol === '^N225');
const n225Trailing = trailingReturn(n225Rows, 12);

const candidateConnectionRows = candidateRows.map((row) => {
  const monthlyRows = stockMonthlyByTicker.get(row.ticker) || [];
  const monthly = trailingReturn(monthlyRows, 12);
  const event = eventSummaryByTicker.get(row.ticker);
  const eventCount = numericValue(event?.event_count_calculated) ?? 0;
  const monthlyExcess = monthly && n225Trailing
    ? monthly.return_pct - n225Trailing.return_pct
    : null;
  const hasEventHistory = eventCount >= 4;
  const hasMonthlyHistory = monthly !== null;
  let status = '未接続';
  if (hasEventHistory && hasMonthlyHistory) status = '暫定検証可';
  else if (hasEventHistory || hasMonthlyHistory) status = '一部検証可';
  return {
    updated_at: generatedAt,
    rank: row.nisa_rank,
    ticker: row.ticker,
    company: row.company,
    sector: row.sector,
    nisa_score: row.nisa_score,
    data_confidence: row.data_confidence,
    event_count_calculated: event?.event_count_calculated || 0,
    avg_excess_5d_pct: event?.avg_excess_5d_pct || '',
    avg_excess_20d_pct: event?.avg_excess_20d_pct || '',
    monthly_data_months: monthlyRows.length,
    monthly_start: monthly?.start_month || '',
    monthly_end: monthly?.end_month || '',
    trailing_12m_return_pct: round(monthly?.return_pct, 2),
    nikkei_12m_return_pct: monthly ? round(n225Trailing?.return_pct, 2) : '',
    trailing_12m_excess_vs_nikkei_pct: round(monthlyExcess, 2),
    validation_status: status,
    treatment: status === '暫定検証可'
      ? '参考検証に使用可能。ただし売買判断には6月以降の前向き記録が必要。'
      : status === '一部検証可'
        ? '片方の履歴だけ確認可能。購入検討用スコアの根拠にはしない。'
        : '過去検証データが未接続。購入検討用スコアの根拠にはしない。',
  };
});

const eventValidationRows = eventSummaryRows.map((row) => ({
  updated_at: generatedAt,
  ticker: row.ticker,
  company: row.company_name,
  event_count_calculated: row.event_count_calculated,
  avg_excess_5d_pct: row.avg_excess_5d_pct,
  avg_excess_20d_pct: row.avg_excess_20d_pct,
  strong_event_count: row.strong_event_count,
  weak_event_count: row.weak_event_count,
  validation_level: numericValue(row.event_count_calculated) >= 4 ? '暫定参考' : '不足',
  note: '市場イベント後の対日経平均超過リターン。因果証明ではなく、反応の履歴確認。',
}));

const eventTypeRows = [...rowsByKey(eventDetailRows, 'event_type').entries()]
  .map(([eventType, rows]) => ({
    updated_at: generatedAt,
    event_type: eventType || '未分類',
    record_count: rows.length,
    avg_excess_1d_pct: round(mean(rows.map((row) => numericValue(row.excess_1d_pct))), 2),
    avg_excess_5d_pct: round(mean(rows.map((row) => numericValue(row.excess_5d_pct))), 2),
    avg_excess_20d_pct: round(mean(rows.map((row) => numericValue(row.excess_20d_pct))), 2),
    usable_treatment: rows.length >= 20 ? '統計参考' : '件数不足',
  }));

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '現候補10社',
    value: `${candidateRows.length}社`,
    status: '対象',
    interpretation: '現在の検証候補を対象に、過去データ接続状況を確認。',
  },
  {
    updated_at: generatedAt,
    item: '候補10社のイベント集計接続',
    value: `${candidateConnectionRows.filter((row) => Number(row.event_count_calculated) > 0).length}社`,
    status: '一部接続',
    interpretation: '現時点では2802、8306など一部に限られる。全10社の検証には追加取得が必要。',
  },
  {
    updated_at: generatedAt,
    item: '候補10社の月次株価接続',
    value: `${candidateConnectionRows.filter((row) => Number(row.monthly_data_months) > 0).length}社`,
    status: '一部接続',
    interpretation: '既存月次データと一致する銘柄だけ、12か月リターンを確認可能。',
  },
  {
    updated_at: generatedAt,
    item: '100社母集団の同時点検算',
    value: `${universeForSanity.length}社`,
    status: '実施',
    interpretation: 'スコアと1年騰落率の関係を確認。ただし、未来予測のバックテストではない。',
  },
  {
    updated_at: generatedAt,
    item: '真のバックテストに必要なもの',
    value: '過去時点の財務・株価・イベント履歴',
    status: '未到達',
    interpretation: '2018年時点の財務で2019年を予測、という形のウォークフォワード検証が必要。',
  },
];

const nextActionRows = [
  {
    priority: 1,
    action: '過去時点の財務スナップショットを作る',
    reason: '現行の財務データは現在値中心なので、未来を知った後の情報が混ざる危険がある。',
    output: '年度別PER/PBR/ROE/売上成長/利益成長テーブル',
  },
  {
    priority: 2,
    action: '候補10社すべての月次・週次株価を取得する',
    reason: '銘柄ごとの12か月リターン、最大下落率、指数超過を同じ条件で比較するため。',
    output: '候補10社の月次リターン、日経/TOPIX比較',
  },
  {
    priority: 3,
    action: '決算日・上方修正・自社株買い・新商品等のイベント履歴を結合する',
    reason: 'イベント仮説を単純加点せず、過去反応で確認するため。',
    output: 'イベント種類別1/5/20/60日超過リターン',
  },
  {
    priority: 4,
    action: '6月テストは前向き記録として分離する',
    reason: '過去データ検証と実運用テストを混ぜると、成績評価が不明になるため。',
    output: '予測値、実績値、誤差、修正理由の記録表',
  },
];

writeCsv('303_backtest_validation_summary.csv', summaryRows, [
  'updated_at',
  'item',
  'value',
  'status',
  'interpretation',
]);

writeCsv('304_universe_score_sanity_check.csv', sanityRows, [
  'updated_at',
  'factor',
  'field',
  'available_count',
  'correlation_with_1y_return',
  'strength',
  'top10_avg_ret1y_pct',
  'rest_avg_ret1y_pct',
  'warning',
  'purpose',
]);

writeCsv('305_candidate_backtest_connection.csv', candidateConnectionRows, [
  'updated_at',
  'rank',
  'ticker',
  'company',
  'sector',
  'nisa_score',
  'data_confidence',
  'event_count_calculated',
  'avg_excess_5d_pct',
  'avg_excess_20d_pct',
  'monthly_data_months',
  'monthly_start',
  'monthly_end',
  'trailing_12m_return_pct',
  'nikkei_12m_return_pct',
  'trailing_12m_excess_vs_nikkei_pct',
  'validation_status',
  'treatment',
]);

writeCsv('306_event_reaction_validation.csv', eventValidationRows, [
  'updated_at',
  'ticker',
  'company',
  'event_count_calculated',
  'avg_excess_5d_pct',
  'avg_excess_20d_pct',
  'strong_event_count',
  'weak_event_count',
  'validation_level',
  'note',
]);

writeCsv('307_event_type_backtest_summary.csv', eventTypeRows, [
  'updated_at',
  'event_type',
  'record_count',
  'avg_excess_1d_pct',
  'avg_excess_5d_pct',
  'avg_excess_20d_pct',
  'usable_treatment',
]);

writeCsv('308_backtest_next_actions.csv', nextActionRows, [
  'priority',
  'action',
  'reason',
  'output',
]);

const summaryCards = [
  ['現候補10社', `${candidateRows.length}社`, '現在の検証対象。'],
  ['イベント接続', `${candidateConnectionRows.filter((row) => Number(row.event_count_calculated) > 0).length}社`, '市場イベント反応と接続できた候補。'],
  ['月次株価接続', `${candidateConnectionRows.filter((row) => Number(row.monthly_data_months) > 0).length}社`, '12か月リターンを確認できる候補。'],
  ['結論', '準備段階', '売買判断の根拠としては未到達。'],
];

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>過去検証・バックテスト確認 2026年5月25日</title>
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
      background: var(--bg);
      color: var(--ink);
      line-height: 1.65;
    }
    main { max-width: 1240px; margin: 0 auto; padding: 28px 18px 56px; }
    h1 { margin: 0 0 8px; color: var(--blue); font-size: 30px; }
    h2 { margin: 30px 0 12px; padding-left: 10px; border-left: 8px solid #0b6f9f; color: var(--blue); }
    .lead, .card {
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
    .kpis {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin: 18px 0;
    }
    .kpi {
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 14px;
    }
    .kpi small { display: block; color: #38536b; font-weight: 700; }
    .kpi b { display: block; font-size: 26px; color: var(--blue); }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; background: #fff; }
    th, td {
      border: 1px solid var(--line);
      padding: 9px 10px;
      vertical-align: top;
      font-size: 13px;
      overflow-wrap: anywhere;
      color: #111;
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
    .split { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    @media (max-width: 900px) {
      .kpis, .split { grid-template-columns: 1fr; }
    }
    @media print {
      body { background: #fff; }
      .lead, .card, .kpi { break-inside: avoid; page-break-inside: avoid; box-shadow: none; }
    }
  </style>
</head>
<body>
<main>
  <h1>過去検証・バックテスト確認</h1>
  <div class="lead">
    <p><b>目的:</b> 現在のスコアがどこまで実データで検証できるかを確認します。ここでは「有効性が証明済み」とは言いません。使える過去検証、まだ不足している過去検証、6月以降に前向き記録すべき検証を分けます。</p>
    <p><b>重要:</b> 100社母集団の1年騰落率は、現在時点の説明変数と同時点の株価結果を見た確認です。未来を当てたバックテストではないため、売買判断の根拠にはまだできません。</p>
    <div class="toolbar">
      <a class="button" href="303_backtest_validation_summary.csv">303 要約CSV</a>
      <a class="button" href="304_universe_score_sanity_check.csv">304 スコア検算CSV</a>
      <a class="button" href="305_candidate_backtest_connection.csv">305 候補接続CSV</a>
      <a class="button" href="306_event_reaction_validation.csv">306 イベント検証CSV</a>
      <a class="button" href="issue_resolution_flowchart_20260525.html">課題解決フローへ</a>
      <a class="button" href="index.html">メインページへ</a>
    </div>
  </div>

  <div class="kpis">
    ${summaryCards.map(([label, value, note]) => `
      <div class="kpi">
        <small>${esc(label)}</small>
        <b>${esc(value)}</b>
        <span>${esc(note)}</span>
      </div>
    `).join('')}
  </div>

  <h2>1. 結論</h2>
  <div class="card">
    <table>
      <thead><tr><th style="width:22%">項目</th><th style="width:15%">値</th><th style="width:16%">状態</th><th>解釈</th></tr></thead>
      <tbody>
        ${summaryRows.map((row) => `
          <tr>
            <td>${esc(row.item)}</td>
            <td>${esc(row.value)}</td>
            <td><span class="badge ${row.status === '未到達' ? 'stop' : row.status.includes('一部') ? 'warn' : 'ok'}">${esc(row.status)}</span></td>
            <td>${esc(row.interpretation)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <h2>2. 100社母集団の同時点検算</h2>
  <div class="card">
    <p class="note">これは「今のスコアが、同時点で強かった銘柄をどの程度拾っているか」の確認です。未来予測ではないため、過信禁止です。</p>
    <table>
      <thead><tr><th>確認軸</th><th>件数</th><th>1年騰落率との相関</th><th>強さ</th><th>上位10平均</th><th>その他平均</th><th>注意</th></tr></thead>
      <tbody>
        ${sanityRows.map((row) => `
          <tr>
            <td>${esc(row.factor)}</td>
            <td>${esc(row.available_count)}</td>
            <td>${esc(row.correlation_with_1y_return || '-')}</td>
            <td>${esc(row.strength)}</td>
            <td>${pct(numericValue(row.top10_avg_ret1y_pct))}</td>
            <td>${pct(numericValue(row.rest_avg_ret1y_pct))}</td>
            <td>${esc(row.warning)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <h2>3. 現候補10社の過去データ接続</h2>
  <div class="card">
    <p class="note">イベント反応と月次株価が両方つながった銘柄だけ、最低限の参考検証に進めます。つながらない銘柄は点数に混ぜません。</p>
    <table>
      <thead>
        <tr>
          <th>順位</th><th>銘柄</th><th>イベント数</th><th>平均5日超過</th><th>平均20日超過</th><th>月次</th><th>12か月超過</th><th>状態</th><th>扱い</th>
        </tr>
      </thead>
      <tbody>
        ${candidateConnectionRows.map((row) => `
          <tr>
            <td>${esc(row.rank)}</td>
            <td>${esc(row.ticker)} ${esc(row.company)}</td>
            <td>${esc(row.event_count_calculated)}件</td>
            <td>${pct(numericValue(row.avg_excess_5d_pct))}</td>
            <td>${pct(numericValue(row.avg_excess_20d_pct))}</td>
            <td>${esc(row.monthly_data_months)}か月</td>
            <td>${pct(numericValue(row.trailing_12m_excess_vs_nikkei_pct))}</td>
            <td><span class="badge ${row.validation_status === '暫定検証可' ? 'ok' : row.validation_status === '一部検証可' ? 'warn' : 'stop'}">${esc(row.validation_status)}</span></td>
            <td>${esc(row.treatment)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <h2>4. イベント反応の暫定検証</h2>
  <div class="card">
    <table>
      <thead><tr><th>銘柄</th><th>イベント数</th><th>平均5日超過</th><th>平均20日超過</th><th>強/弱</th><th>扱い</th></tr></thead>
      <tbody>
        ${eventValidationRows.map((row) => `
          <tr>
            <td>${esc(row.ticker)} ${esc(row.company)}</td>
            <td>${esc(row.event_count_calculated)}件</td>
            <td>${pct(numericValue(row.avg_excess_5d_pct))}</td>
            <td>${pct(numericValue(row.avg_excess_20d_pct))}</td>
            <td>${esc(row.strong_event_count)} / ${esc(row.weak_event_count)}</td>
            <td>${esc(row.validation_level)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <h2>5. 次の作業</h2>
  <div class="card">
    <table>
      <thead><tr><th style="width:8%">優先</th><th style="width:27%">作業</th><th>理由</th><th style="width:24%">成果物</th></tr></thead>
      <tbody>
        ${nextActionRows.map((row) => `
          <tr>
            <td>${esc(row.priority)}</td>
            <td>${esc(row.action)}</td>
            <td>${esc(row.reason)}</td>
            <td>${esc(row.output)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    <p class="note">作成日: ${esc(generatedAt)}</p>
  </div>
</main>
</body>
</html>
`;

fs.writeFileSync(path.join(ROOT, 'backtest_validation_20260525.html'), html, 'utf8');

console.log('generated backtest_validation_20260525.html');
