import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE_FILE = process.env.LONG_TERM_SOURCE || '720_client_send_pack_10_candidates.csv';
const SCORE_FILE = process.env.LONG_TERM_SCORE_FILE || '725_long_term_stability_score.csv';
const FETCH_LOG_FILE = process.env.LONG_TERM_FETCH_LOG_FILE || '726_long_term_stability_fetch_log.csv';
const BENCHMARK_FILE = process.env.LONG_TERM_BENCHMARK_FILE || '727_long_term_benchmark_summary.csv';
const HTML_FILE = process.env.LONG_TERM_HTML_FILE || 'long_term_stability_score_20260528.html';
const REPORT_TITLE = process.env.LONG_TERM_TITLE || '候補10社 長期安定性スコア';
const GENERATED_AT = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
}).format(new Date());

const BENCHMARKS = [
  { ticker: '^GSPC', name: 'S&P500' },
  { ticker: '^N225', name: '日経平均' }
];

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

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function writeCsv(name, rows, headers) {
  const body = [headers.map(csvEscape).join(',')]
    .concat(rows.map((row) => headers.map((header) => csvEscape(row[header])).join(',')))
    .join('\n');
  fs.writeFileSync(path.join(ROOT, name), `${body}\n`, 'utf8');
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function pct(value) {
  return value === '' || value === null || value === undefined ? '' : `${value}%`;
}

function tickerOf(text) {
  return String(text || '').split(/\s+/)[0].trim();
}

function nameOf(text) {
  return String(text || '').replace(/^\S+\s*/, '').trim();
}

function targetFromRow(row) {
  const ticker = row.ticker || tickerOf(row['銘柄']);
  const name = row.company || nameOf(row['銘柄']);
  return { ticker, name };
}

function round(value, digits = 1) {
  if (!Number.isFinite(value)) return '';
  return Number(value.toFixed(digits));
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdev(values) {
  if (values.length < 2) return null;
  const avg = mean(values);
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function covarianceValues(a, b) {
  if (a.length !== b.length || a.length < 2) return null;
  const am = mean(a);
  const bm = mean(b);
  return a.reduce((sum, value, index) => sum + (value - am) * (b[index] - bm), 0) / (a.length - 1);
}

function correlation(a, b) {
  const pairs = paired(a, b);
  if (pairs.length < 3) return null;
  const av = pairs.map((item) => item.a);
  const bv = pairs.map((item) => item.b);
  const denom = stdev(av) * stdev(bv);
  if (!denom) return null;
  return covarianceValues(av, bv) / denom;
}

function beta(a, b) {
  const pairs = paired(a, b);
  if (pairs.length < 3) return null;
  const bv = pairs.map((item) => item.b);
  const variance = stdev(bv) ** 2;
  if (!variance) return null;
  return covarianceValues(pairs.map((item) => item.a), bv) / variance;
}

function paired(a, b) {
  const byMonth = new Map(b.map((item) => [item.month, item.returnPct]));
  return a
    .filter((item) => byMonth.has(item.month))
    .map((item) => ({ a: item.returnPct, b: byMonth.get(item.month), month: item.month }));
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

function cagr(points) {
  if (points.length < 2) return null;
  const start = points[0];
  const end = points.at(-1);
  const years = (new Date(end.date) - new Date(start.date)) / (365.25 * 24 * 60 * 60 * 1000);
  if (years <= 0 || start.close <= 0 || end.close <= 0) return null;
  return ((end.close / start.close) ** (1 / years) - 1) * 100;
}

function monthlyReturns(points) {
  const months = new Map();
  for (const point of points) {
    months.set(point.date.slice(0, 7), point);
  }
  const ordered = [...months.values()].sort((a, b) => a.date.localeCompare(b.date));
  const rows = [];
  for (let i = 1; i < ordered.length; i += 1) {
    const prev = ordered[i - 1];
    const current = ordered[i];
    if (prev.close > 0) {
      rows.push({
        month: current.date.slice(0, 7),
        returnPct: (current.close / prev.close - 1) * 100
      });
    }
  }
  return rows;
}

function sliceYears(points, years) {
  if (!points.length) return [];
  const end = new Date(points.at(-1).date);
  const start = new Date(end);
  start.setFullYear(start.getFullYear() - years);
  return points.filter((point) => new Date(point.date) >= start);
}

async function fetchYahooChart(ticker, years = 10, useAdjustedClose = true) {
  const period2 = Math.floor(Date.now() / 1000);
  const period1 = period2 - Math.ceil(years * 366 * 24 * 60 * 60);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?period1=${period1}&period2=${period2}&interval=1d&events=history&includeAdjustedClose=true`;
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 stock-analysis-mvp'
    }
  });
  if (!response.ok) throw new Error(`${ticker}: Yahoo chart API ${response.status}`);
  const json = await response.json();
  const result = json.chart?.result?.[0];
  if (!result?.timestamp?.length) throw new Error(`${ticker}: price data empty`);
  const quote = result.indicators?.quote?.[0] || {};
  const adj = result.indicators?.adjclose?.[0]?.adjclose || [];
  return result.timestamp.map((time, index) => ({
    date: new Date(time * 1000).toISOString().slice(0, 10),
    close: Number(useAdjustedClose ? (adj[index] ?? quote.close?.[index]) : quote.close?.[index])
  })).filter((row) => Number.isFinite(row.close) && row.close > 0);
}

function scoreReturn(cagr5, excessSp5, excessNikkei5) {
  // 5年リターンが高いだけで全社100点にならないよう、指数への超過分を中心に評価する。
  const base = 50 + (cagr5 ?? 0) * 0.3 + (excessSp5 ?? 0) * 0.9 + (excessNikkei5 ?? 0) * 0.5;
  return clamp(base);
}

function scoreStability(vol5, mdd5, winRate5) {
  if (vol5 === null || mdd5 === null || winRate5 === null) return 50;
  return clamp(100 - vol5 * 1.2 - Math.abs(mdd5) * 0.8 + (winRate5 - 50) * 0.8);
}

function scoreConsistency(cagr5, cagr10, vol5, mdd5) {
  const has10 = cagr10 !== null;
  const gapPenalty = has10 ? Math.abs(cagr5 - cagr10) * 0.7 : 8;
  return clamp(50 + (cagr5 ?? 0) * 1.2 + (has10 ? (cagr10 ?? 0) * 0.8 : 0) - gapPenalty - (vol5 ?? 25) * 0.45 - Math.abs(mdd5 ?? -35) * 0.35);
}

function judgement(score, dataYears) {
  if (dataYears < 4.5) return '長期データ不足';
  if (score >= 70) return '長期安定候補';
  if (score >= 58) return '条件付き安定';
  if (score >= 45) return '要確認';
  return '長期安定性は弱い';
}

function noteFor(row) {
  const notes = [];
  if (row['5年S&P差'] !== '' && Number(row['5年S&P差']) < 0) notes.push('S&P500に劣後');
  if (row['5年最大下落率'] !== '' && Number(row['5年最大下落率']) <= -45) notes.push('大きな下落経験あり');
  if (row['5年年率ボラ'] !== '' && Number(row['5年年率ボラ']) >= 35) notes.push('値動きが大きい');
  if (row['月次勝率'] !== '' && Number(row['月次勝率']) < 52) notes.push('上昇月の比率が低い');
  if (row['10年CAGR'] === '') notes.push('10年データは不足');
  return notes.join(' / ') || '長期推移を継続確認';
}

async function main() {
  const candidateRows = parseCsv(fs.readFileSync(path.join(ROOT, SOURCE_FILE), 'utf8'));
  const targets = candidateRows.map(targetFromRow).filter((row) => row.ticker);

  const allTargets = [...targets, ...BENCHMARKS];
  const series = new Map();
  const fetchLog = [];
  for (const target of allTargets) {
    try {
      const points = await fetchYahooChart(target.ticker, 10, target.useAdjustedClose !== false);
      series.set(target.ticker, points);
      fetchLog.push({
        種別: BENCHMARKS.some((item) => item.ticker === target.ticker) ? 'ベンチマーク' : '候補銘柄',
        コード: target.ticker,
        名称: target.name,
        状態: '取得済み',
        件数: points.length,
        開始日: points[0]?.date || '',
        終了日: points.at(-1)?.date || '',
        取得元: 'Yahoo Finance chart API'
      });
    } catch (error) {
      fetchLog.push({
        種別: BENCHMARKS.some((item) => item.ticker === target.ticker) ? 'ベンチマーク' : '候補銘柄',
        コード: target.ticker,
        名称: target.name,
        状態: '取得失敗',
        件数: 0,
        開始日: '',
        終了日: '',
        取得元: `Yahoo Finance chart API / ${error.message}`
      });
    }
  }

  const sp500 = monthlyReturns(sliceYears(series.get('^GSPC') || [], 5));
  const nikkei = monthlyReturns(sliceYears(series.get('^N225') || [], 5));
  const sp5Cagr = cagr(sliceYears(series.get('^GSPC') || [], 5));
  const nikkei5Cagr = cagr(sliceYears(series.get('^N225') || [], 5));

  const rows = targets.map((target) => {
    const points = series.get(target.ticker) || [];
    const five = sliceYears(points, 5);
    const ten = sliceYears(points, 10);
    const monthly = monthlyReturns(five);
    const returns = monthly.map((item) => item.returnPct);
    const vol5 = stdev(returns) === null ? null : stdev(returns) * Math.sqrt(12);
    const mdd5 = maxDrawdown(five);
    const cagr5 = cagr(five);
    const cagr10 = cagr(ten.length >= 2000 ? ten : []);
    const winRate = returns.length ? returns.filter((value) => value > 0).length / returns.length * 100 : null;
    const excessSp = cagr5 !== null && sp5Cagr !== null ? cagr5 - sp5Cagr : null;
    const excessNikkei = cagr5 !== null && nikkei5Cagr !== null ? cagr5 - nikkei5Cagr : null;
    const corrSp = correlation(monthly, sp500);
    const betaSp = beta(monthly, sp500);
    const returnScore = scoreReturn(cagr5, excessSp, excessNikkei);
    const stabilityScore = scoreStability(vol5, mdd5, winRate);
    const consistencyScore = scoreConsistency(cagr5, cagr10, vol5, mdd5);
    const score = clamp(returnScore * 0.40 + stabilityScore * 0.35 + consistencyScore * 0.25);
    const dataYears = points.length ? (new Date(points.at(-1).date) - new Date(points[0].date)) / (365.25 * 24 * 60 * 60 * 1000) : 0;
    const row = {
      順位: '',
      コード: target.ticker,
      銘柄: target.name,
      長期安定性スコア: round(score),
      判定: judgement(score, dataYears),
      データ年数: round(dataYears, 1),
      '5年CAGR': round(cagr5),
      '10年CAGR': round(cagr10),
      '5年S&P差': round(excessSp),
      '5年日経差': round(excessNikkei),
      '5年年率ボラ': round(vol5),
      '5年最大下落率': round(mdd5),
      月次勝率: round(winRate),
      'S&P相関': round(corrSp, 2),
      'S&Pベータ': round(betaSp, 2),
      リターン点: round(returnScore),
      安定性点: round(stabilityScore),
      継続性点: round(consistencyScore),
      確認事項: ''
    };
    row.確認事項 = noteFor(row);
    return row;
  }).sort((a, b) => Number(b.長期安定性スコア) - Number(a.長期安定性スコア))
    .map((row, index) => ({ ...row, 順位: index + 1 }));

  const benchmarkRows = [
    { 名称: 'S&P500', コード: '^GSPC', '5年CAGR': round(sp5Cagr), '5年年率ボラ': round(stdev(sp500.map((item) => item.returnPct)) * Math.sqrt(12)), '5年最大下落率': round(maxDrawdown(sliceYears(series.get('^GSPC') || [], 5))) },
    { 名称: '日経平均', コード: '^N225', '5年CAGR': round(nikkei5Cagr), '5年年率ボラ': round(stdev(nikkei.map((item) => item.returnPct)) * Math.sqrt(12)), '5年最大下落率': round(maxDrawdown(sliceYears(series.get('^N225') || [], 5))) },
    { 名称: 'TOPIX', コード: '未採用', '5年CAGR': '', '5年年率ボラ': '', '5年最大下落率': 'YahooのTOPIX連動ETFは分割等の影響で今回の長期比較には未使用' }
  ];

  const headers = [
    '順位', 'コード', '銘柄', '長期安定性スコア', '判定', 'データ年数',
    '5年CAGR', '10年CAGR', '5年S&P差', '5年日経差',
    '5年年率ボラ', '5年最大下落率', '月次勝率', 'S&P相関', 'S&Pベータ',
    'リターン点', '安定性点', '継続性点', '確認事項'
  ];
  writeCsv(SCORE_FILE, rows, headers);
  writeCsv(FETCH_LOG_FILE, fetchLog, ['種別', 'コード', '名称', '状態', '件数', '開始日', '終了日', '取得元']);
  writeCsv(BENCHMARK_FILE, benchmarkRows, ['名称', 'コード', '5年CAGR', '5年年率ボラ', '5年最大下落率']);

  const avgScore = round(mean(rows.map((row) => Number(row.長期安定性スコア))));
  const stableCount = rows.filter((row) => ['長期安定候補', '条件付き安定'].includes(row.判定)).length;
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(REPORT_TITLE)}</title>
  <style>
    :root { --ink:#050b14; --muted:#45566a; --line:#cbd8e6; --navy:#123d63; --blue:#0b5f96; --soft:#f4f8fc; --green:#087f5b; --amber:#a85b00; --red:#b42318; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif; color:var(--ink); background:#eef4fa; line-height:1.75; }
    main { max-width:1200px; margin:0 auto; padding:28px 18px 56px; }
    header { background:#123d63; color:#fff; border-radius:10px; padding:30px; margin-bottom:18px; }
    h1 { margin:0 0 10px; font-size:30px; line-height:1.25; }
    h2 { margin:24px 0 12px; padding-left:12px; border-left:7px solid var(--blue); color:var(--navy); font-size:22px; }
    p { margin:0 0 10px; }
    .grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin:16px 0; }
    .card, section { background:#fff; border:1px solid var(--line); border-radius:9px; padding:16px; }
    .card b { display:block; color:var(--navy); }
    .value { font-size:28px; font-weight:900; color:var(--blue); }
    table { width:100%; border-collapse:collapse; table-layout:fixed; background:#fff; }
    th,td { border:1px solid var(--line); padding:8px; vertical-align:top; font-size:12px; overflow-wrap:break-word; }
    th { background:#e6f1fb; color:var(--navy); text-align:left; }
    .main-table th:nth-child(1), .main-table td:nth-child(1) { width:5%; text-align:center; }
    .main-table th:nth-child(2), .main-table td:nth-child(2) { width:10%; }
    .main-table th:nth-child(3), .main-table td:nth-child(3) { width:13%; font-weight:800; }
    .main-table th:nth-child(4), .main-table td:nth-child(4) { width:9%; text-align:right; font-weight:900; }
    .badge { display:inline-block; border-radius:8px; padding:4px 8px; color:#fff; font-weight:900; white-space:nowrap; }
    .ok { background:var(--green); }
    .watch { background:var(--amber); }
    .stop { background:var(--red); }
    .formula { background:#f8fbff; border:1px solid var(--line); border-radius:8px; padding:14px; font-family:Consolas,"Noto Sans JP",monospace; font-size:13px; }
    .note { color:var(--muted); font-size:12px; }
    header .note { color:#dbeeff; }
    a { color:#075e91; font-weight:800; }
    @media (max-width:900px) { .grid { grid-template-columns:1fr 1fr; } table { table-layout:auto; } }
  </style>
</head>
<body>
<main>
  <header>
    <h1>${esc(REPORT_TITLE)}</h1>
    <p>過去1年だけの上昇ではなく、5年・10年で継続して上がっているか、S&P500や日経/TOPIXとの差、値動きの大きさ、最大下落率を分けて確認します。</p>
    <p class="note">作成: ${esc(GENERATED_AT)} / 入力: ${esc(SOURCE_FILE)} / 取得元: Yahoo Finance chart API / 本表は購入確定ではなく、長期の安定性を確認するための補助表です。</p>
  </header>

  <div class="grid">
    <div class="card"><b>平均スコア</b><div class="value">${esc(avgScore)}点</div><p>対象${esc(rows.length)}社平均</p></div>
    <div class="card"><b>条件付き以上</b><div class="value">${esc(stableCount)}社</div><p>58点以上</p></div>
    <div class="card"><b>S&P500 5年CAGR</b><div class="value">${esc(round(sp5Cagr))}%</div><p>比較基準</p></div>
    <div class="card"><b>日経平均 5年CAGR</b><div class="value">${esc(round(nikkei5Cagr))}%</div><p>日本株比較</p></div>
  </div>

  <section>
    <h2>計算式</h2>
    <div class="formula">長期安定性スコア = 0.40×リターン点 + 0.35×安定性点 + 0.25×継続性点</div>
    <p class="note">リターン点は5年CAGRとS&P500/日経平均との差、安定性点は年率ボラ・最大下落率・月次勝率、継続性点は5年と10年の差を見ます。去年だけ強い銘柄はここで過大評価されにくくなります。TOPIXは今回の取得経路では長期比較に適した指数データを確認できなかったため、正式計算から外しています。</p>
  </section>

  <section>
    <h2>長期安定性ランキング</h2>
    <table class="main-table">
      <thead><tr><th>順位</th><th>コード</th><th>銘柄</th><th>スコア</th><th>判定</th><th>5年CAGR</th><th>10年CAGR</th><th>S&P差</th><th>年率ボラ</th><th>最大下落</th><th>月次勝率</th><th>確認事項</th></tr></thead>
      <tbody>
        ${rows.map((row) => {
          const cls = row.判定 === '長期安定候補' ? 'ok' : row.判定 === '条件付き安定' ? 'watch' : 'stop';
          return `<tr><td>${esc(row.順位)}</td><td>${esc(row.コード)}</td><td>${esc(row.銘柄)}</td><td>${esc(row.長期安定性スコア)}点</td><td><span class="badge ${cls}">${esc(row.判定)}</span></td><td>${esc(pct(row['5年CAGR']))}</td><td>${esc(pct(row['10年CAGR']))}</td><td>${esc(pct(row['5年S&P差']))}</td><td>${esc(pct(row['5年年率ボラ']))}</td><td>${esc(pct(row['5年最大下落率']))}</td><td>${esc(pct(row.月次勝率))}</td><td>${esc(row.確認事項)}</td></tr>`;
        }).join('')}
      </tbody>
    </table>
  </section>

  <section>
    <h2>ベンチマーク</h2>
    <table>
      <thead><tr><th>名称</th><th>コード</th><th>5年CAGR</th><th>5年年率ボラ</th><th>5年最大下落率</th></tr></thead>
      <tbody>${benchmarkRows.map((row) => `<tr><td>${esc(row.名称)}</td><td>${esc(row.コード)}</td><td>${esc(pct(row['5年CAGR']))}</td><td>${esc(pct(row['5年年率ボラ']))}</td><td>${esc(pct(row['5年最大下落率']))}</td></tr>`).join('')}</tbody>
    </table>
  </section>

  <section>
    <h2>出力CSV</h2>
    <p><a href="${esc(SCORE_FILE)}">長期安定性スコアCSV</a> / <a href="${esc(BENCHMARK_FILE)}">ベンチマークCSV</a> / <a href="${esc(FETCH_LOG_FILE)}">取得ログCSV</a></p>
  </section>
</main>
</body>
</html>`;

  fs.writeFileSync(path.join(ROOT, HTML_FILE), html, 'utf8');

  console.log(JSON.stringify({
    generatedAt: GENERATED_AT,
    output: HTML_FILE,
    rows: rows.length,
    averageScore: avgScore,
    stableCount
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
