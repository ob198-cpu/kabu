import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const REPORT_DIR = path.join(ROOT, 'reports');
const PUBLISH_DIR = path.join(ROOT, 'kabu_publish');
fs.mkdirSync(REPORT_DIR, { recursive: true });
fs.mkdirSync(PUBLISH_DIR, { recursive: true });

const generatedAt = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date());

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 top20-completion-update';

const EVENT_INPUT = {
  '4385.T': {
    event_date: '2026-05-11',
    event_type: '2026年6月期3Q決算',
    event_source: 'TDnet/Yahoo開示PDF',
    event_url: 'https://finance-frontend-pc-dist.west.edge.storage-yahoo.jp/disclosure/20260511/20260508520767.pdf',
    event_usable: '通常決算反応として使用',
  },
  '4063.T': {
    event_date: '2026-04-28',
    event_type: '2026年3月期通期決算',
    event_source: 'IRBANK/TDnet',
    event_url: 'https://irbank.net/4063',
    event_usable: '通常決算反応として使用',
  },
  '2802.T': {
    event_date: '2026-05-07',
    event_type: '2026年3月期通期決算',
    event_source: '味の素公式PDF',
    event_url: 'https://news.ajinomoto.co.jp/2026/05/2026_05_07_03.pdf',
    event_usable: '通常決算反応として使用',
  },
  '8316.T': {
    event_date: '2026-05-13',
    event_type: '2026年3月期通期決算',
    event_source: 'SMFG公式/TDnet',
    event_url: 'https://www.smfg.co.jp/investor/financial/latest_statement/',
    event_usable: '通常決算反応として使用',
  },
  '8002.T': {
    event_date: '2026-05-01',
    event_type: '2026年3月期通期決算',
    event_source: '丸紅公式PDF',
    event_url: 'https://www.marubeni.com/jp/news/2026/release/data/202605012-1J.pdf',
    event_usable: '通常決算反応として使用',
  },
  '9983.T': {
    event_date: '2026-04-09',
    event_type: '2026年8月期2Q決算',
    event_source: 'ファーストリテイリング公式',
    event_url: 'https://www.fastretailing.com/jp/ir/news/2604091800.html',
    event_usable: '通常決算反応として使用',
  },
  '5020.T': {
    event_date: '2026-05-14',
    event_type: '2026年3月期通期決算',
    event_source: 'IRBANK/TDnet',
    event_url: 'https://irbank.net/5020',
    event_usable: '通常決算反応として使用',
  },
  '6501.T': {
    event_date: '2026-04-27',
    event_type: '2026年3月期通期決算',
    event_source: '日立公式PDF',
    event_url: 'https://www.hitachi.com/content/dam/hitachi/global/ja_jp/press/files/2026/04/0427/2025_An.pdf',
    event_usable: '通常決算反応として使用',
  },
  '6503.T': {
    event_date: '2026-04-28',
    event_type: '2026年3月期通期決算',
    event_source: '三菱電機公式PDF',
    event_url: 'https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co1.pdf',
    event_usable: '通常決算反応として使用',
  },
  '6594.T': {
    event_date: '2026-05-22',
    event_type: '決算発表延期/会計関連開示',
    event_source: 'IRBANK/TDnet',
    event_url: 'https://irbank.net/6594',
    event_usable: '通常決算反応としては使用不可',
  },
};

const FUNDAMENTAL_FALLBACK = {
  // 2026/05/25 18:32の同日取得成功値。Yahoo側が短時間の再取得でHTTP 500を返す場合の再計算保護用。
  '5020.T': {
    yahoo_per: '8.36',
    yahoo_pbr: '1.03',
    yahoo_roe_pct: '8.00',
    yahoo_dividend_yield_pct: '2.64',
    perf_latest_period: '2026年3月期',
    perf_sales_yoy_pct: '-4.5',
    perf_profit_metric: '営業利益',
    perf_profit_yoy_pct: '339.8',
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

function readCsvFrom(...parts) {
  return parseCsv(fs.readFileSync(path.join(ROOT, ...parts), 'utf8'));
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
  for (const dir of [REPORT_DIR, PUBLISH_DIR]) {
    fs.writeFileSync(path.join(dir, name), `\uFEFF${body}\n`, 'utf8');
  }
}

function writeHtml(name, html) {
  for (const dir of [REPORT_DIR, PUBLISH_DIR]) {
    fs.writeFileSync(path.join(dir, name), html, 'utf8');
  }
}

function stripHtml(html) {
  return String(html)
    .replaceAll('<!-- -->', '')
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function num(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '---' || raw === '-' || raw === '未取得') return null;
  const n = Number(raw.replaceAll(',', '').replaceAll('%', ''));
  return Number.isFinite(n) ? n : null;
}

function round(value, digits = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return Number(n.toFixed(digits));
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function scale(value, min, max) {
  const n = num(value);
  if (n === null) return null;
  return clamp(((n - min) / (max - min)) * 100);
}

function inverseScale(value, good, bad) {
  const n = num(value);
  if (n === null) return null;
  return clamp(((bad - n) / (bad - good)) * 100);
}

function averageWeighted(parts) {
  let total = 0;
  let weight = 0;
  for (const [value, w] of parts) {
    if (value !== null && value !== undefined && value !== '') {
      total += Number(value) * w;
      weight += w;
    }
  }
  return weight ? total / weight : null;
}

function pct(current, previous) {
  const c = num(current);
  const p = num(previous);
  if (c === null || p === null || p === 0) return null;
  return ((c / p) - 1) * 100;
}

function healthyTrendScore(ret) {
  const r = num(ret);
  if (r === null) return null;
  if (r < -20) return 15;
  if (r < 0) return 30 + ((r + 20) / 20) * 20;
  if (r <= 80) return 55 + (r / 80) * 30;
  if (r <= 150) return 80 - ((r - 80) / 70) * 15;
  if (r <= 250) return 55 - ((r - 150) / 100) * 25;
  return 15;
}

async function fetchText(url) {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.text();
}

function firstValue(block) {
  const match = block.match(/StyledNumber__value[^>]*>([^<]+)</);
  return match ? match[1].trim() : '';
}

function parseQuoteMetrics(html) {
  const blocks = [...html.matchAll(/<dl class="[^"]*DataListItem[\s\S]*?<\/dl>/g)].map((m) => m[0]);
  const metrics = [];
  for (const block of blocks) {
    const name = block.match(/DataListItem__name[^>]*>([^<]+)</)?.[1]?.trim() ?? '';
    const sub = block.match(/DataListItem__sub[^>]*>([^<]+)</)?.[1]?.trim() ?? '';
    if (!name) continue;
    metrics.push({ name, sub, value: firstValue(block) });
  }
  const pick = (name, subIncludes = '') => {
    const item = metrics.find((m) => m.name === name && (!subIncludes || m.sub.includes(subIncludes)))
      ?? metrics.find((m) => m.name === name)
      ?? {};
    return item.value ?? '';
  };
  return {
    yahoo_per: pick('PER', '会社予想'),
    yahoo_pbr: pick('PBR', '実績'),
    yahoo_roe_pct: pick('ROE', '実績'),
    yahoo_dividend_yield_pct: pick('配当利回り', '会社予想'),
    yahoo_market_cap_million_yen: pick('時価総額'),
    quote_metric_count: metrics.length,
  };
}

function cellValue(cellHtml) {
  const value = firstValue(cellHtml);
  if (value) return value;
  const text = stripHtml(cellHtml);
  return text === '---' ? '' : text;
}

function parsePerformanceRows(html) {
  const tableMatch = html.match(/<table class="[^"]*StocksPerformanceContainer__table[\s\S]*?<\/table>/);
  if (!tableMatch) return [];
  const rows = [...tableMatch[0].matchAll(/<tr[\s\S]*?<\/tr>/g)].map((m) => m[0]);
  return rows.slice(1).map((rowHtml) => {
    const th = rowHtml.match(/<th[\s\S]*?<\/th>/)?.[0] ?? '';
    const cells = [...rowHtml.matchAll(/<td[\s\S]*?<\/td>/g)].map((m) => m[0]);
    const period = stripHtml(th);
    return {
      period,
      is_forecast: period.includes('会社予想'),
      sales_million_yen: cellValue(cells[0] ?? ''),
      gross_profit_million_yen: cellValue(cells[1] ?? ''),
      operating_profit_million_yen: cellValue(cells[3] ?? ''),
      ordinary_profit_million_yen: cellValue(cells[5] ?? ''),
      net_profit_million_yen: cellValue(cells[7] ?? ''),
      accounting: stripHtml(cells[8] ?? ''),
      updated_date: cellValue(cells[9] ?? ''),
    };
  }).filter((row) => row.period);
}

function latestComparablePerformance(rows) {
  const actualRows = rows.filter((row) => !row.is_forecast);
  const latest = actualRows[0] ?? rows[0] ?? {};
  const previous = actualRows[1] ?? rows[1] ?? {};
  const profitNow = num(latest.operating_profit_million_yen) ?? num(latest.ordinary_profit_million_yen) ?? num(latest.net_profit_million_yen);
  const profitPrev = num(previous.operating_profit_million_yen) ?? num(previous.ordinary_profit_million_yen) ?? num(previous.net_profit_million_yen);
  const profitMetric = num(latest.operating_profit_million_yen) !== null
    ? '営業利益'
    : (num(latest.ordinary_profit_million_yen) !== null ? '経常利益' : (num(latest.net_profit_million_yen) !== null ? '純利益' : ''));
  return {
    perf_latest_period: latest.period ?? '',
    perf_previous_period: previous.period ?? '',
    perf_sales_million_yen: latest.sales_million_yen ?? '',
    perf_sales_yoy_pct: round(pct(latest.sales_million_yen, previous.sales_million_yen)),
    perf_profit_metric: profitMetric,
    perf_profit_million_yen: profitNow ?? '',
    perf_profit_yoy_pct: round(pct(profitNow, profitPrev)),
    perf_updated_date: latest.updated_date ?? '',
  };
}

async function fetchYahooFundamentals(ticker) {
  const quoteUrl = `https://finance.yahoo.co.jp/quote/${encodeURIComponent(ticker)}`;
  const performanceUrl = `${quoteUrl}/performance`;
  const [quoteHtml, performanceHtml] = await Promise.all([
    fetchText(quoteUrl),
    fetchText(performanceUrl),
  ]);
  return {
    ...parseQuoteMetrics(quoteHtml),
    ...latestComparablePerformance(parsePerformanceRows(performanceHtml)),
    yahoo_quote_url: quoteUrl,
    yahoo_performance_url: performanceUrl,
    yahoo_status: '取得',
  };
}

async function fetchChart(symbol, range = '1y') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d&includePrePost=false`;
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const json = await response.json();
  const result = json.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  if (!result || !quote) throw new Error('chart result missing');
  return (result.timestamp ?? []).map((timestamp, index) => ({
    date: new Date(timestamp * 1000).toISOString().slice(0, 10),
    close: quote.close?.[index],
  })).filter((row) => Number.isFinite(row.close));
}

function locateRows(rows, eventDate) {
  const before = rows.filter((row) => row.date <= eventDate);
  const after = rows.filter((row) => row.date > eventDate);
  return { base: before.at(-1) ?? null, after };
}

function reactionFor(priceRows, benchmarkRows, eventDate) {
  const p = locateRows(priceRows, eventDate);
  const b = locateRows(benchmarkRows, eventDate);
  const out = {
    base_date: p.base?.date ?? '',
    base_close: p.base?.close ?? '',
    benchmark_base_date: b.base?.date ?? '',
  };
  for (const n of [1, 5, 20]) {
    const pr = p.after[n - 1] ?? null;
    const br = b.after[n - 1] ?? null;
    const ret = pr && p.base ? pct(pr.close, p.base.close) : null;
    const bench = br && b.base ? pct(br.close, b.base.close) : null;
    out[`after_${n}d_date`] = pr?.date ?? '';
    out[`return_${n}d_pct`] = round(ret, 2);
    out[`nikkei_${n}d_pct`] = round(bench, 2);
    out[`excess_${n}d_pct`] = ret === null || bench === null ? '' : round(ret - bench, 2);
  }
  return out;
}

function reactionScore(row, eventUsable) {
  if (eventUsable !== '通常決算反応として使用') return { score: '', status: '通常決算ではないため未採点' };
  const e1 = num(row.excess_1d_pct);
  const e5 = num(row.excess_5d_pct);
  const e20 = num(row.excess_20d_pct);
  if (e1 === null && e5 === null && e20 === null) return { score: '', status: '未計算' };
  const parts = e20 === null
    ? [[e1, 0.40], [e5, 0.60]]
    : [[e1, 0.34], [e5, 0.51], [e20, 0.15]];
  const weighted = averageWeighted(parts);
  return {
    score: round(clamp(50 + 2 * weighted), 1),
    status: e20 === null ? '暫定: 20営業日未到達' : '確定: 20営業日到達',
  };
}

function choose(...values) {
  for (const value of values) {
    const text = String(value ?? '').trim();
    if (text && text !== '---' && text !== '未取得' && text !== '-') return value;
  }
  return '';
}

function dataConfidence(fields, reaction) {
  let score = 100;
  if (num(fields.revenue_yoy_pct) === null) score -= 15;
  if (num(fields.profit_yoy_pct) === null) score -= 15;
  if (num(fields.per) === null) score -= 8;
  if (num(fields.pbr) === null) score -= 6;
  if (num(fields.roe_pct) === null) score -= 6;
  if (num(reaction.earnings_reaction_score) === null) score -= 15;
  if (reaction.reaction_status === '暫定: 20営業日未到達') score -= 5;
  return clamp(score);
}

function scoreRow(row, screening, yahoo, reaction) {
  const fields = {
    revenue_yoy_pct: choose(row.revenue_yoy_pct, screening.revenue_yoy_pct, yahoo.perf_sales_yoy_pct),
    profit_yoy_pct: choose(row.profit_yoy_pct, screening.profit_yoy_pct, yahoo.perf_profit_yoy_pct),
    per: choose(row.per, screening.per_forecast, yahoo.yahoo_per),
    pbr: choose(row.pbr, screening.pbr_actual, yahoo.yahoo_pbr),
    roe_pct: choose(row.roe_pct, screening.roe_actual_pct, yahoo.yahoo_roe_pct),
    dividend_yield_pct: choose(screening.dividend_yield_pct, yahoo.yahoo_dividend_yield_pct),
    ret60_pct: screening.ret60_pct,
    ret1y_pct: choose(row.ret1y_pct, screening.ret1y_pct),
    above_ma200_pct: screening.above_ma200_pct,
    max_drawdown60_pct: choose(row.max_drawdown60_pct, screening.max_drawdown60_pct),
  };

  const revenueScore = scale(fields.revenue_yoy_pct, -10, 30);
  const profitScore = scale(fields.profit_yoy_pct, -20, 60);
  const roeScore = scale(fields.roe_pct, 5, 25);
  const growthQuality = averageWeighted([
    [revenueScore, 0.35],
    [profitScore, 0.45],
    [roeScore, 0.20],
  ]);

  const drawdown = scale(fields.max_drawdown60_pct, -45, -8);
  const overheatSafety = (() => {
    const r = num(fields.ret1y_pct);
    if (r === null) return null;
    if (r <= 80) return 85;
    if (r <= 150) return 65;
    if (r <= 250) return 35;
    return 10;
  })();
  const confidence = dataConfidence(fields, reaction);
  const downsideSafety = averageWeighted([
    [drawdown, 0.55],
    [overheatSafety, 0.30],
    [confidence, 0.15],
  ]);

  const valuation = averageWeighted([
    [inverseScale(fields.per, 10, 55), 0.40],
    [inverseScale(fields.pbr, 1, 15), 0.25],
    [roeScore, 0.25],
    [scale(fields.dividend_yield_pct, 0, 4), 0.10],
  ]);

  const trend = averageWeighted([
    [healthyTrendScore(fields.ret1y_pct), 0.45],
    [scale(fields.above_ma200_pct, -10, 40), 0.35],
    [healthyTrendScore(fields.ret60_pct), 0.20],
  ]);

  const nisaScore = averageWeighted([
    [growthQuality, 0.35],
    [downsideSafety, 0.25],
    [valuation, 0.20],
    [trend, 0.10],
    [reaction.earnings_reaction_score, 0.10],
  ]);

  const gates = [];
  const per = num(fields.per);
  const pbr = num(fields.pbr);
  const ret1y = num(fields.ret1y_pct);
  const maxDrawdown = num(fields.max_drawdown60_pct);
  const reactionScoreValue = num(reaction.earnings_reaction_score);
  if (confidence < 70) gates.push('データ信頼度70未満');
  if (reaction.reaction_status === '暫定: 20営業日未到達') gates.push('決算後20営業日未到達');
  if (row.ticker === '6594.T') gates.push('決算遅延/会計関連リスク');
  if (ret1y !== null && ret1y >= 250) gates.push(`1年上昇率${round(ret1y, 1)}%で過熱`);
  if (maxDrawdown !== null && maxDrawdown <= -30) gates.push(`60日最大下落率${round(maxDrawdown, 1)}%`);
  if (per !== null && pbr !== null && per >= 45 && pbr >= 8) gates.push(`PER${round(per, 2)}倍/PBR${round(pbr, 2)}倍`);
  if (reactionScoreValue !== null && reactionScoreValue < 35) gates.push(`決算後反応${round(reactionScoreValue, 1)}点`);

  const fatal = gates.some((gate) => gate.includes('会計関連') || gate.includes('最大下落率') || gate.includes('PER') || gate.includes('1年上昇率'));
  const blocking = gates.some((gate) => gate.includes('データ信頼度') || gate.includes('決算後反応'));
  const candidateStatus = fatal
    ? '除外'
    : (!blocking && nisaScore !== null && nisaScore >= 55 && confidence >= 70 ? '検証候補' : '要確認');
  const purchaseStatus = candidateStatus === '検証候補'
    ? '6月イベント後に再判定'
    : '購入候補ではない';

  return {
    ...fields,
    growth_quality_score: round(growthQuality),
    downside_safety_score: round(downsideSafety),
    valuation_score: round(valuation),
    trend_score: round(trend),
    data_confidence_after: round(confidence, 0),
    nisa_1y_score_after: round(nisaScore),
    hard_gates_after: gates.join(' / ') || 'なし',
    candidate_status: candidateStatus,
    purchase_status: purchaseStatus,
  };
}

function table(headers, rows) {
  return `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${
    rows.map((row) => `<tr>${headers.map((h) => `<td>${esc(row[h])}</td>`).join('')}</tr>`).join('')
  }</tbody></table>`;
}

const top20 = readCsvFrom('reports', '245_nisa_1year_hold_score_top20.csv');
const screeningRows = readCsvFrom('reports', '199_universe100_screening.csv');
const screeningByTicker = new Map(screeningRows.map((row) => [row.ticker, row]));

const tickers = top20.map((row) => row.ticker);
const yahooMap = new Map();
const fetchRows = [];
for (const ticker of tickers) {
  try {
    const data = await fetchYahooFundamentals(ticker);
    yahooMap.set(ticker, data);
    fetchRows.push({ updated_at: generatedAt, ticker, status: '取得', message: '' });
  } catch (error) {
    const fallback = FUNDAMENTAL_FALLBACK[ticker];
    if (fallback) {
      yahooMap.set(ticker, { ...fallback, yahoo_status: '取得済みキャッシュ使用' });
      fetchRows.push({ updated_at: generatedAt, ticker, status: '取得済みキャッシュ使用', message: error.message });
    } else {
      yahooMap.set(ticker, { yahoo_status: '再取得失敗・既存CSV使用' });
      fetchRows.push({ updated_at: generatedAt, ticker, status: '再取得失敗・既存CSV使用', message: error.message });
    }
  }
}

const chartMap = new Map();
const reactionRows = [];
const chartErrors = [];
for (const symbol of ['^N225', ...tickers]) {
  try {
    chartMap.set(symbol, await fetchChart(symbol));
  } catch (error) {
    chartErrors.push({ updated_at: generatedAt, symbol, status: '失敗', message: error.message });
  }
}

const nikkei = chartMap.get('^N225') ?? [];
for (const row of top20) {
  const event = EVENT_INPUT[row.ticker] ?? {};
  const priceRows = chartMap.get(row.ticker) ?? [];
  const reaction = event.event_date
    ? reactionFor(priceRows, nikkei, event.event_date)
    : {};
  const score = reactionScore(reaction, event.event_usable);
  reactionRows.push({
    updated_at: generatedAt,
    ticker: row.ticker,
    company: row.company,
    event_date: event.event_date ?? '',
    event_type: event.event_type ?? '',
    event_source: event.event_source ?? '',
    event_url: event.event_url ?? '',
    event_usable: event.event_usable ?? '既存反応を使用',
    base_date: reaction.base_date ?? '',
    after_1d_date: reaction.after_1d_date ?? '',
    excess_1d_pct: reaction.excess_1d_pct ?? '',
    after_5d_date: reaction.after_5d_date ?? '',
    excess_5d_pct: reaction.excess_5d_pct ?? '',
    after_20d_date: reaction.after_20d_date ?? '',
    excess_20d_pct: reaction.excess_20d_pct ?? '',
    earnings_reaction_score: score.score || row.earnings_reaction_score || row.reaction_score,
    reaction_status: score.score ? score.status : (row.earnings_reaction_score ? '既存値' : '未取得'),
  });
}

const reactionByTicker = new Map(reactionRows.map((row) => [row.ticker, row]));
const completionRows = top20.map((row) => {
  const yahoo = yahooMap.get(row.ticker) ?? {};
  const screening = screeningByTicker.get(row.ticker) ?? {};
  const reaction = reactionByTicker.get(row.ticker) ?? {};
  const score = scoreRow(row, screening, yahoo, reaction);
  return {
    updated_at: generatedAt,
    rank_before: row.nisa_rank,
    ticker: row.ticker,
    company: row.company,
    sector: row.sector,
    theme: row.theme,
    prior_category: row.category,
    candidate_status: score.candidate_status,
    purchase_status: score.purchase_status,
    nisa_1y_score_after: score.nisa_1y_score_after,
    growth_quality_score: score.growth_quality_score,
    downside_safety_score: score.downside_safety_score,
    valuation_score: score.valuation_score,
    trend_score: score.trend_score,
    earnings_reaction_score: reaction.earnings_reaction_score,
    reaction_status: reaction.reaction_status,
    data_confidence_before: row.data_confidence,
    data_confidence_after: score.data_confidence_after,
    per: score.per,
    pbr: score.pbr,
    roe_pct: score.roe_pct,
    dividend_yield_pct: score.dividend_yield_pct,
    revenue_yoy_pct: score.revenue_yoy_pct,
    profit_yoy_pct: score.profit_yoy_pct,
    profit_metric: yahoo.perf_profit_metric ?? '',
    latest_period: yahoo.perf_latest_period ?? '',
    ret1y_pct: score.ret1y_pct,
    max_drawdown60_pct: score.max_drawdown60_pct,
    hard_gates_after: score.hard_gates_after,
    yahoo_status: yahoo.yahoo_status ?? '',
    yahoo_quote_url: yahoo.yahoo_quote_url ?? '',
    yahoo_performance_url: yahoo.yahoo_performance_url ?? '',
  };
}).sort((a, b) => {
  const order = { 検証候補: 0, 要確認: 1, 除外: 2 };
  return (order[a.candidate_status] - order[b.candidate_status])
    || ((num(b.nisa_1y_score_after) ?? -999) - (num(a.nisa_1y_score_after) ?? -999));
}).map((row, index) => ({ rank_after: index + 1, ...row }));

const summaryRows = [
  {
    updated_at: generatedAt,
    item: '対象',
    value: `${completionRows.length}社`,
    note: '上位20社を対象に、Yahoo株価API、Yahoo!ファイナンス業績表、既存100社表を突合。',
  },
  {
    updated_at: generatedAt,
    item: '検証候補',
    value: `${completionRows.filter((row) => row.candidate_status === '検証候補').length}社`,
    note: '6月イベント後に購入可否を再判定する候補。購入確定ではない。',
  },
  {
    updated_at: generatedAt,
    item: '要確認',
    value: `${completionRows.filter((row) => row.candidate_status === '要確認').length}社`,
    note: '不足データ、20営業日未到達、反応弱さなどが残る。',
  },
  {
    updated_at: generatedAt,
    item: '除外',
    value: `${completionRows.filter((row) => row.candidate_status === '除外').length}社`,
    note: '過熱、割高、急落、会計関連など初回NISAテストに重い理由あり。',
  },
];

const categoryMap = {
  検証候補: '残す',
  要確認: '保留',
  除外: '落とす',
};

const systemRows = completionRows.map((row) => ({
  nisa_rank: row.rank_after,
  updated_at: row.updated_at,
  ticker: row.ticker,
  company: row.company,
  sector: row.sector,
  theme: row.theme,
  category: categoryMap[row.candidate_status] ?? '保留',
  expanded_rank: row.rank_before,
  prior_category: row.prior_category,
  nisa_score: row.nisa_1y_score_after,
  raw_nisa_score: row.nisa_1y_score_after,
  growth_quality_score: row.growth_quality_score,
  downside_safety_score: row.downside_safety_score,
  valuation_score: row.valuation_score,
  medium_trend_score: row.trend_score,
  earnings_reaction_score: row.earnings_reaction_score,
  data_confidence: row.data_confidence_after,
  score_basis: '追加取得データ反映',
  hard_gate: row.hard_gates_after,
  per: row.per,
  pbr: row.pbr,
  roe_pct: row.roe_pct,
  revenue_yoy_pct: row.revenue_yoy_pct,
  profit_yoy_pct: row.profit_yoy_pct,
  ret1y_pct: row.ret1y_pct,
  max_drawdown60_pct: row.max_drawdown60_pct,
  adjusted_score: row.nisa_1y_score_after,
  base_score: row.nisa_1y_score_after,
  reaction_score: row.earnings_reaction_score,
  hold_reason: `${row.candidate_status}。NISA1年点${row.nisa_1y_score_after}、信頼度${row.data_confidence_after}、業績/質${row.growth_quality_score}、下落耐性${row.downside_safety_score}、割安${row.valuation_score}、決算反応${row.earnings_reaction_score || '未取得'}。ゲート: ${row.hard_gates_after}`,
  next_check: row.purchase_status === '6月イベント後に再判定'
    ? '6月CPI、FOMC、日銀、日経75日線、米10年金利、為替、20営業日反応を確認して購入可否を再判定。'
    : '購入候補ではない。改善データまたは不足データ解消後に再判定。',
}));

writeCsv('272_top20_yahoo_fundamental_fetch_status.csv', fetchRows, ['updated_at', 'ticker', 'status', 'message']);
writeCsv('273_top20_earnings_reaction_completed.csv', reactionRows, [
  'updated_at',
  'ticker',
  'company',
  'event_date',
  'event_type',
  'event_source',
  'event_url',
  'event_usable',
  'base_date',
  'after_1d_date',
  'excess_1d_pct',
  'after_5d_date',
  'excess_5d_pct',
  'after_20d_date',
  'excess_20d_pct',
  'earnings_reaction_score',
  'reaction_status',
]);
writeCsv('274_top20_completion_recalculated_candidates.csv', completionRows, [
  'rank_after',
  'updated_at',
  'rank_before',
  'ticker',
  'company',
  'sector',
  'theme',
  'prior_category',
  'candidate_status',
  'purchase_status',
  'nisa_1y_score_after',
  'growth_quality_score',
  'downside_safety_score',
  'valuation_score',
  'trend_score',
  'earnings_reaction_score',
  'reaction_status',
  'data_confidence_before',
  'data_confidence_after',
  'per',
  'pbr',
  'roe_pct',
  'dividend_yield_pct',
  'revenue_yoy_pct',
  'profit_yoy_pct',
  'profit_metric',
  'latest_period',
  'ret1y_pct',
  'max_drawdown60_pct',
  'hard_gates_after',
  'yahoo_status',
  'yahoo_quote_url',
  'yahoo_performance_url',
]);
writeCsv('275_top20_completion_summary.csv', summaryRows, ['updated_at', 'item', 'value', 'note']);
writeCsv('245_nisa_1year_hold_score_top20.csv', systemRows, [
  'nisa_rank',
  'updated_at',
  'ticker',
  'company',
  'sector',
  'theme',
  'category',
  'expanded_rank',
  'prior_category',
  'nisa_score',
  'raw_nisa_score',
  'growth_quality_score',
  'downside_safety_score',
  'valuation_score',
  'medium_trend_score',
  'earnings_reaction_score',
  'data_confidence',
  'score_basis',
  'hard_gate',
  'per',
  'pbr',
  'roe_pct',
  'revenue_yoy_pct',
  'profit_yoy_pct',
  'ret1y_pct',
  'max_drawdown60_pct',
  'adjusted_score',
  'base_score',
  'reaction_score',
  'hold_reason',
  'next_check',
]);

const visibleRows = completionRows.map((row) => ({
  順位: row.rank_after,
  銘柄: `${row.ticker} ${row.company}`,
  状態: row.candidate_status,
  '1年NISA点': row.nisa_1y_score_after,
  信頼度: row.data_confidence_after,
  PER: row.per ? `${row.per}倍` : '',
  PBR: row.pbr ? `${row.pbr}倍` : '',
  ROE: row.roe_pct ? `${row.roe_pct}%` : '',
  売上成長: row.revenue_yoy_pct ? `${row.revenue_yoy_pct}%` : '',
  利益成長: row.profit_yoy_pct ? `${row.profit_yoy_pct}%` : '',
  決算反応: `${row.earnings_reaction_score || ''} ${row.reaction_status || ''}`.trim(),
  ゲート: row.hard_gates_after,
}));

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>上位20社 データ補完・再計算結果</title>
  <style>
    body { font-family: "Yu Gothic", Meiryo, sans-serif; color:#111; margin: 28px; line-height: 1.65; }
    h1 { font-size: 26px; margin: 0 0 12px; }
    h2 { border-left: 8px solid #0b5f8a; padding-left: 10px; margin-top: 28px; }
    .lead { border:1px solid #b8d4e8; background:#f7fbff; padding:14px 16px; border-radius:8px; }
    table { border-collapse: collapse; width:100%; margin-top:12px; table-layout: fixed; }
    th, td { border:1px solid #cbd7e2; padding:7px 8px; font-size:12px; vertical-align: top; overflow-wrap:anywhere; word-break:normal; }
    th { background:#e7f2fb; color:#052f4d; }
    .note { font-size: 13px; }
  </style>
</head>
<body>
  <h1>上位20社 データ補完・再計算結果</h1>
  <div class="lead">
    目的は、従来「決算後反応未取得」「データ信頼度70未満」で止まっていた銘柄について、
    追加取得できる公開データを入れ、6月NISAテスト候補を広げられるか確認することです。
    ここでの「検証候補」は購入確定ではなく、6月イベント後に再判定する候補です。
  </div>
  <h2>集計</h2>
  ${table(['updated_at', 'item', 'value', 'note'], summaryRows)}
  <h2>再計算ランキング</h2>
  ${table(['順位', '銘柄', '状態', '1年NISA点', '信頼度', 'PER', 'PBR', 'ROE', '売上成長', '利益成長', '決算反応', 'ゲート'], visibleRows)}
  <h2>注意</h2>
  <p class="note">質的イベントやテーマはこの点数に直接足していません。時流テーマは発見・優先順位付けに使い、購入候補化は量的データと決算後反応で確認します。</p>
</body>
</html>`;

writeHtml('top20_completion_recalculated_candidates.html', html);

console.log(JSON.stringify({
  generatedAt,
  candidates: completionRows.filter((row) => row.candidate_status === '検証候補').length,
  review: completionRows.filter((row) => row.candidate_status === '要確認').length,
  excluded: completionRows.filter((row) => row.candidate_status === '除外').length,
  chartErrors,
}, null, 2));
