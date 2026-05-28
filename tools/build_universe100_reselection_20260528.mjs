import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LONG_FILE = '728_universe100_long_term_stability_score.csv';
const CURRENT_FILE = '779_current10_reset_to_provisional_20260528.csv';
const METRIC_FILE = '780_universe100_reselection_metrics_20260528.csv';
const LEADER_FILE = '781_universe100_metric_leaders_20260528.csv';
const FINAL_FILE = '782_reselected_10_candidates_20260528.csv';
const SUMMARY_FILE = '783_reselection_summary_20260528.csv';
const HTML_FILE = 'universe100_reselected_10_candidates_20260528.html';

const CURRENT_TICKERS = [
  '5803.T',
  '8002.T',
  '6857.T',
  '8058.T',
  '8053.T',
  '8031.T',
  '8306.T',
  '1605.T',
  '5802.T',
  '6501.T'
];

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
  fs.writeFileSync(path.join(ROOT, name), `\ufeff${body}\n`, 'utf8');
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function num(value) {
  const text = String(value ?? '').replaceAll(',', '').replaceAll('%', '').trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function round(value, digits = 1) {
  if (!Number.isFinite(value)) return '';
  return Number(value.toFixed(digits));
}

function pct(value, digits = 1) {
  if (!Number.isFinite(value)) return '';
  return `${round(value, digits)}%`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchYahooDaily(ticker, range = '1y') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=1d&includePrePost=false&events=div%2Csplits`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 stock-analysis-mvp' }
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  const result = json.chart?.result?.[0];
  if (!result?.timestamp?.length) throw new Error('empty price series');
  const quote = result.indicators?.quote?.[0] || {};
  const adj = result.indicators?.adjclose?.[0]?.adjclose || [];
  return result.timestamp.map((time, index) => ({
    date: new Date(time * 1000).toISOString().slice(0, 10),
    close: Number(adj[index] ?? quote.close?.[index]),
    volume: Number(quote.volume?.[index])
  })).filter((row) => Number.isFinite(row.close) && row.close > 0);
}

function maxDrawdown(points) {
  let peak = -Infinity;
  let worst = 0;
  for (const point of points) {
    if (point.close > peak) peak = point.close;
    if (peak > 0) worst = Math.min(worst, (point.close / peak - 1) * 100);
  }
  return worst;
}

function returnFromBack(points, days) {
  if (points.length < 2) return null;
  const end = points.at(-1);
  const start = points[Math.max(0, points.length - 1 - days)];
  if (!start?.close || !end?.close) return null;
  return (end.close / start.close - 1) * 100;
}

function oneYearMetrics(points) {
  if (!points.length) {
    return {
      status: '取得失敗',
      startDate: '',
      endDate: '',
      dataCount: 0,
      ret1y: null,
      ret60: null,
      maxDrawdown1y: null
    };
  }
  const start = points[0];
  const end = points.at(-1);
  return {
    status: '取得済み',
    startDate: start.date,
    endDate: end.date,
    dataCount: points.length,
    ret1y: (end.close / start.close - 1) * 100,
    ret60: returnFromBack(points, 60),
    maxDrawdown1y: maxDrawdown(points)
  };
}

function percentileScores(rows, key, higherBetter = true) {
  const valid = rows
    .map((row) => ({ row, value: num(row[key]) }))
    .filter((item) => item.value !== null)
    .sort((a, b) => higherBetter ? b.value - a.value : a.value - b.value);
  const denom = Math.max(valid.length - 1, 1);
  valid.forEach((item, index) => {
    item.row[`${key}順位点`] = round(100 - (index / denom) * 100, 1);
    item.row[`${key}順位`] = index + 1;
  });
  rows.forEach((row) => {
    if (row[`${key}順位点`] === undefined) {
      row[`${key}順位点`] = '';
      row[`${key}順位`] = '';
    }
  });
}

function average(values) {
  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function weakReason(row) {
  const reasons = [];
  const ret1y = num(row['直近1年騰落率']);
  const ret60 = num(row['60日騰落率']);
  const sp1y = num(row['直近1年S&P差']);
  const sp5y = num(row['5年S&P差']);
  const mdd1y = num(row['直近1年最大下落率']);
  const mdd5y = num(row['5年最大下落率']);
  const coverage = num(row['取得項目数']);
  if (coverage !== null && coverage < 6) reasons.push('主要指標の不足');
  if (sp1y !== null && sp1y < 0) reasons.push('直近1年でS&P500に劣後');
  if (sp5y !== null && sp5y < 0) reasons.push('5年でS&P500に劣後');
  if (ret60 !== null && ret60 <= -15) reasons.push('直近60日が弱い');
  if (mdd1y !== null && mdd1y <= -35) reasons.push('直近1年の下落率が大きい');
  if (mdd5y !== null && mdd5y <= -55) reasons.push('5年最大下落率が大きい');
  if (ret1y !== null && ret1y >= 250) reasons.push('急騰後の反動確認が必要');
  return reasons;
}

function finalStatus(row) {
  const reasons = weakReason(row);
  const hardReasons = reasons.filter((reason) => [
    '主要指標の不足',
    '直近1年でS&P500に劣後',
    '5年でS&P500に劣後',
    '直近60日が弱い',
    '直近1年の下落率が大きい'
  ].includes(reason));
  if (hardReasons.length) return ['除外', reasons.join(' / ')];
  if (reasons.length) return ['監視', reasons.join(' / ')];
  return ['再選定候補', '主要指標で通過'];
}

function rankLeaderRows(rows, key, label, higherBetter = true, count = 10) {
  return rows
    .filter((row) => num(row[key]) !== null)
    .sort((a, b) => higherBetter ? num(b[key]) - num(a[key]) : num(a[key]) - num(b[key]))
    .slice(0, count)
    .map((row, index) => ({
      指標: label,
      指標順位: index + 1,
      コード: row.コード,
      銘柄: row.銘柄,
      値: row[key],
      最終扱い: row.最終扱い,
      補足: row.除外理由 || row.確認事項
    }));
}

function htmlTable(headers, rows, className = '') {
  return `<div class="table-wrap"><table class="${className}"><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((h) => `<td>${esc(row[h])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

async function main() {
  const longRows = readCsv(LONG_FILE);
  const tickerRows = longRows.map((row) => ({
    code: row.コード,
    name: row.銘柄,
    longScore: num(row.長期安定性スコア),
    cagr5: num(row['5年CAGR']),
    cagr10: num(row['10年CAGR']),
    spDiff5: num(row['5年S&P差']),
    nikkeiDiff5: num(row['5年日経差']),
    vol5: num(row['5年年率ボラ']),
    maxDrawdown5: num(row['5年最大下落率']),
    winRate: num(row.月次勝率)
  })).filter((row) => row.code);

  const fetched = new Map();
  const fetchRows = [];
  for (const target of [{ code: '^GSPC', name: 'S&P500' }, ...tickerRows]) {
    try {
      const points = await fetchYahooDaily(target.code, '1y');
      const metrics = oneYearMetrics(points);
      fetched.set(target.code, metrics);
      fetchRows.push({ code: target.code, ok: true, count: points.length });
      await sleep(60);
    } catch (error) {
      fetched.set(target.code, { status: `取得失敗: ${error.message}`, dataCount: 0 });
      fetchRows.push({ code: target.code, ok: false, error: error.message });
      await sleep(120);
    }
  }

  const sp = fetched.get('^GSPC') || {};
  const spRet1y = sp.ret1y ?? null;

  const currentResetRows = CURRENT_TICKERS.map((ticker, index) => {
    const long = tickerRows.find((row) => row.code === ticker);
    return {
      記録時刻: generatedAt,
      旧順位: index + 1,
      コード: ticker,
      銘柄: long?.name || '',
      旧扱い: '候補10社',
      新扱い: '仮候補',
      理由: '100社母集団を同一指標で再計算し直すため。購入候補として固定しない。'
    };
  });

  const metricRows = tickerRows.map((base) => {
    const one = fetched.get(base.code) || {};
    const ret1y = one.ret1y ?? null;
    const ret60 = one.ret60 ?? null;
    const mdd1 = one.maxDrawdown1y ?? null;
    const spDiff1 = ret1y !== null && spRet1y !== null ? ret1y - spRet1y : null;
    return {
      記録時刻: generatedAt,
      コード: base.code,
      銘柄: base.name,
      旧10社: CURRENT_TICKERS.includes(base.code) ? '仮候補' : '',
      データ取得: one.status || '取得失敗',
      取得開始日: one.startDate || '',
      取得終了日: one.endDate || '',
      データ件数: one.dataCount || 0,
      長期安定性スコア: base.longScore ?? '',
      '5年CAGR': base.cagr5 ?? '',
      '10年CAGR': base.cagr10 ?? '',
      直近1年騰落率: ret1y ?? '',
      '60日騰落率': ret60 ?? '',
      '5年S&P差': base.spDiff5 ?? '',
      '直近1年S&P差': spDiff1 ?? '',
      '5年日経差': base.nikkeiDiff5 ?? '',
      '5年最大下落率': base.maxDrawdown5 ?? '',
      直近1年最大下落率: mdd1 ?? '',
      月次勝率: base.winRate ?? ''
    };
  });

  const rankMetrics = [
    ['5年CAGR', true],
    ['10年CAGR', true],
    ['直近1年騰落率', true],
    ['5年S&P差', true],
    ['直近1年S&P差', true],
    ['5年最大下落率', true],
    ['直近1年最大下落率', true],
    ['月次勝率', true]
  ];
  rankMetrics.forEach(([key, higher]) => percentileScores(metricRows, key, higher));

  metricRows.forEach((row) => {
    const scores = rankMetrics.map(([key]) => num(row[`${key}順位点`]));
    const available = scores.filter((value) => Number.isFinite(value)).length;
    row.取得項目数 = available;
    row.再選定点 = round(average(scores) ?? 0, 1);
    const [status, reason] = finalStatus(row);
    row.最終扱い = status;
    row.除外理由 = status === '除外' ? reason : '';
    row.確認事項 = status === '除外' ? '' : reason;
  });

  const numericOutputKeys = [
    '長期安定性スコア',
    '5年CAGR',
    '10年CAGR',
    '直近1年騰落率',
    '60日騰落率',
    '5年S&P差',
    '直近1年S&P差',
    '5年日経差',
    '5年最大下落率',
    '直近1年最大下落率',
    '月次勝率',
    '再選定点'
  ];
  metricRows.forEach((row) => {
    numericOutputKeys.forEach((key) => {
      const value = num(row[key]);
      if (value !== null) row[key] = round(value, 1);
    });
  });

  metricRows.sort((a, b) => num(b.再選定点) - num(a.再選定点));
  metricRows.forEach((row, index) => {
    row.再計算順位 = index + 1;
  });

  const finalRows = metricRows
    .filter((row) => row.最終扱い === '再選定候補')
    .slice(0, 10)
    .map((row, index) => ({
      再選定順位: index + 1,
      コード: row.コード,
      銘柄: row.銘柄,
      再選定点: row.再選定点,
      旧10社: row.旧10社,
      '5年CAGR': row['5年CAGR'],
      '10年CAGR': row['10年CAGR'],
      直近1年騰落率: row.直近1年騰落率,
      '60日騰落率': row['60日騰落率'],
      '5年S&P差': row['5年S&P差'],
      '直近1年S&P差': row['直近1年S&P差'],
      '5年最大下落率': row['5年最大下落率'],
      直近1年最大下落率: row.直近1年最大下落率,
      月次勝率: row.月次勝率,
      確認事項: row.確認事項
    }));

  const leaderRows = [
    ...rankLeaderRows(metricRows, '5年CAGR', '過去5年CAGR', true),
    ...rankLeaderRows(metricRows, '10年CAGR', '過去10年CAGR', true),
    ...rankLeaderRows(metricRows, '直近1年騰落率', '直近1年騰落率', true),
    ...rankLeaderRows(metricRows, '5年S&P差', '5年S&P500比較', true),
    ...rankLeaderRows(metricRows, '直近1年S&P差', '直近1年S&P500比較', true),
    ...rankLeaderRows(metricRows, '5年最大下落率', '5年最大下落率の小ささ', true),
    ...rankLeaderRows(metricRows, '直近1年最大下落率', '直近1年最大下落率の小ささ', true)
  ];

  const summaryRows = [
    {
      項目: '現在の10社',
      件数: CURRENT_TICKERS.length,
      内容: 'すべて仮候補に戻した。固定候補として扱わない。'
    },
    {
      項目: '100社母集団',
      件数: metricRows.length,
      内容: '5年・10年・直近1年・最大下落率・S&P差を同一表で再計算。'
    },
    {
      項目: '直近データ取得',
      件数: fetchRows.filter((row) => row.ok).length,
      内容: `Yahoo Finance chart APIで1年日次データを取得。S&P500の直近1年騰落率は${pct(spRet1y)}。`
    },
    {
      項目: '直近弱い銘柄',
      件数: metricRows.filter((row) => row.最終扱い === '除外').length,
      内容: '直近1年S&P劣後、5年S&P劣後、60日下落、最大下落率、データ不足で除外。'
    },
    {
      項目: '再選定10社',
      件数: finalRows.length,
      内容: '除外条件を通過した銘柄から順位点の高い10社を抽出。'
    }
  ];

  const metricHeaders = [
    '再計算順位',
    'コード',
    '銘柄',
    '旧10社',
    '再選定点',
    '最終扱い',
    '5年CAGR',
    '10年CAGR',
    '直近1年騰落率',
    '60日騰落率',
    '5年S&P差',
    '直近1年S&P差',
    '5年最大下落率',
    '直近1年最大下落率',
    '月次勝率',
    '取得項目数',
    '除外理由',
    '確認事項'
  ];
  writeCsv(CURRENT_FILE, currentResetRows, ['記録時刻', '旧順位', 'コード', '銘柄', '旧扱い', '新扱い', '理由']);
  writeCsv(METRIC_FILE, metricRows, metricHeaders);
  writeCsv(LEADER_FILE, leaderRows, ['指標', '指標順位', 'コード', '銘柄', '値', '最終扱い', '補足']);
  writeCsv(FINAL_FILE, finalRows, [
    '再選定順位',
    'コード',
    '銘柄',
    '再選定点',
    '旧10社',
    '5年CAGR',
    '10年CAGR',
    '直近1年騰落率',
    '60日騰落率',
    '5年S&P差',
    '直近1年S&P差',
    '5年最大下落率',
    '直近1年最大下落率',
    '月次勝率',
    '確認事項'
  ]);
  writeCsv(SUMMARY_FILE, summaryRows, ['項目', '件数', '内容']);

  const finalDisplay = finalRows.map((row) => ({
    ...row,
    '5年CAGR': pct(num(row['5年CAGR'])),
    '10年CAGR': pct(num(row['10年CAGR'])),
    直近1年騰落率: pct(num(row.直近1年騰落率)),
    '60日騰落率': pct(num(row['60日騰落率'])),
    '5年S&P差': pct(num(row['5年S&P差'])),
    '直近1年S&P差': pct(num(row['直近1年S&P差'])),
    '5年最大下落率': pct(num(row['5年最大下落率'])),
    直近1年最大下落率: pct(num(row.直近1年最大下落率)),
    月次勝率: pct(num(row.月次勝率))
  }));

  const metricDisplay = metricRows.slice(0, 30).map((row) => ({
    再計算順位: row.再計算順位,
    コード: row.コード,
    銘柄: row.銘柄,
    旧10社: row.旧10社,
    再選定点: row.再選定点,
    最終扱い: row.最終扱い,
    '5年CAGR': pct(num(row['5年CAGR'])),
    '10年CAGR': pct(num(row['10年CAGR'])),
    直近1年騰落率: pct(num(row.直近1年騰落率)),
    '60日騰落率': pct(num(row['60日騰落率'])),
    '5年S&P差': pct(num(row['5年S&P差'])),
    '直近1年S&P差': pct(num(row['直近1年S&P差'])),
    除外理由: row.除外理由 || row.確認事項
  }));

  const leaderDisplay = leaderRows.slice(0, 70).map((row) => ({
    ...row,
    値: pct(num(row.値))
  }));

  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>100社母集団 再選定結果 2026年5月28日</title>
  <style>
    :root { --ink:#050b14; --navy:#123d63; --blue:#0b5f96; --line:#cbd8e6; --bg:#eef4fa; --green:#087f5b; --amber:#a85b00; --red:#b42318; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif; color:var(--ink); background:var(--bg); line-height:1.75; }
    main { max-width:1320px; margin:0 auto; padding:24px 18px 56px; }
    header { background:var(--navy); color:#fff; border-radius:10px; padding:28px; margin-bottom:18px; }
    h1 { margin:0 0 8px; font-size:30px; line-height:1.25; }
    h2 { margin:24px 0 12px; padding-left:12px; border-left:7px solid var(--blue); color:var(--navy); }
    section { background:#fff; border:1px solid var(--line); border-radius:9px; padding:16px; margin:16px 0; }
    .grid { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:12px; }
    .card { background:#f8fbff; border:1px solid var(--line); border-radius:8px; padding:14px; }
    .card b { display:block; color:var(--navy); }
    .value { font-size:28px; font-weight:900; color:var(--blue); }
    .note { background:#fff8ec; border-left:6px solid var(--amber); border-radius:8px; padding:12px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:8px; background:#fff; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; }
    th,td { border:1px solid var(--line); padding:8px; vertical-align:top; font-size:12px; overflow-wrap:break-word; color:#050b14; }
    th { background:#e6f1fb; color:var(--navy); text-align:left; }
    .final th:nth-child(1), .final td:nth-child(1) { width:6%; text-align:center; }
    .final th:nth-child(2), .final td:nth-child(2) { width:8%; }
    .final th:nth-child(3), .final td:nth-child(3) { width:13%; font-weight:800; }
    .badge { display:inline-block; border-radius:8px; padding:3px 8px; color:#fff; font-weight:900; }
    .ok { background:var(--green); }
    .watch { background:var(--amber); }
    .stop { background:var(--red); }
    .actions { display:flex; gap:10px; flex-wrap:wrap; }
    .button { display:inline-block; padding:9px 12px; border-radius:8px; border:1px solid var(--blue); background:var(--blue); color:#fff; font-weight:800; text-decoration:none; }
    .button.secondary { background:#fff; color:var(--blue); }
    @media (max-width:980px) { .grid { grid-template-columns:1fr 1fr; } table { table-layout:auto; } }
  </style>
</head>
<body>
<main>
  <header>
    <h1>100社母集団 再選定結果</h1>
    <p>現在の10社を仮候補へ戻し、100社母集団を同じ指標で再計算しました。使った指標は、過去5年、過去10年、直近1年、最大下落率、S&P500との差です。</p>
    <p>作成時刻: ${esc(generatedAt)} / この表は検証候補の再選定であり、購入確定ではありません。</p>
  </header>

  <section>
    <h2>処理結果</h2>
    <div class="grid">
      ${summaryRows.map((row) => `<div class="card"><b>${esc(row.項目)}</b><div class="value">${esc(row.件数)}</div><p>${esc(row.内容)}</p></div>`).join('')}
    </div>
  </section>

  <section>
    <h2>計算の考え方</h2>
    <p class="note">再選定点は、各指標を100社内の順位点に変換し、その平均で出しています。予測利回りを作るのではなく、同じ土俵で「過去5年・10年で強いか」「直近1年でもS&P500に負けていないか」「最大下落率が許容できるか」を確認する方式です。</p>
    ${htmlTable(['項目', '内容'], [
      { 項目: '現在の10社', 内容: '仮候補へ戻す。固定候補として扱わない。' },
      { 項目: '順位点', 内容: '各指標を100社内順位で0〜100点化。上位ほど高い。' },
      { 項目: '除外条件', 内容: '主要指標不足、直近1年S&P劣後、5年S&P劣後、60日下落、最大下落率が大きい銘柄を最終10社から外す。' },
      { 項目: 'S&P比較', 内容: '5年S&P差と直近1年S&P差を別々に見る。片方だけ強い銘柄は確認対象に留める。' }
    ])}
  </section>

  <section>
    <h2>再選定10社</h2>
    ${htmlTable(['再選定順位', 'コード', '銘柄', '再選定点', '旧10社', '5年CAGR', '10年CAGR', '直近1年騰落率', '60日騰落率', '5年S&P差', '直近1年S&P差', '5年最大下落率', '直近1年最大下落率', '月次勝率', '確認事項'], finalDisplay, 'final')}
  </section>

  <section>
    <h2>上位30社と除外理由</h2>
    ${htmlTable(['再計算順位', 'コード', '銘柄', '旧10社', '再選定点', '最終扱い', '5年CAGR', '10年CAGR', '直近1年騰落率', '60日騰落率', '5年S&P差', '直近1年S&P差', '除外理由'], metricDisplay)}
  </section>

  <section>
    <h2>指標別上位</h2>
    ${htmlTable(['指標', '指標順位', 'コード', '銘柄', '値', '最終扱い', '補足'], leaderDisplay)}
  </section>

  <section>
    <h2>CSV</h2>
    <div class="actions">
      <a class="button" href="${esc(FINAL_FILE)}">再選定10社CSV</a>
      <a class="button secondary" href="${esc(METRIC_FILE)}">100社再計算CSV</a>
      <a class="button secondary" href="${esc(LEADER_FILE)}">指標別上位CSV</a>
      <a class="button secondary" href="${esc(CURRENT_FILE)}">仮候補戻しログCSV</a>
    </div>
  </section>
</main>
</body>
</html>`;

  fs.writeFileSync(path.join(ROOT, HTML_FILE), html, 'utf8');

  console.log(JSON.stringify({
    generatedAt,
    html: HTML_FILE,
    universe: metricRows.length,
    fetched: fetchRows.filter((row) => row.ok).length,
    final10: finalRows.map((row) => `${row.コード} ${row.銘柄}`),
    spRet1y: round(spRet1y)
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
