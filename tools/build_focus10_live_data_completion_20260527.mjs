import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) focus10-live-data-completion";
const generatedAt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date());

const manualEventFallback = {
  "2802.T": { event_date: "2026-05-07", event_title: "2026年3月期決算", source_url: "https://news.ajinomoto.co.jp/2026/05/2026_05_07_03.pdf" },
  "6762.T": { event_date: "2026-04-28", event_title: "2026年3月期決算", source_url: "https://www.tdk.com/ja/ir/ir_events/conference/2026/4q_1.html" },
  "6146.T": { event_date: "2026-04-24", event_title: "2026年3月期決算", source_url: "https://www.disco.co.jp/jp/ir/" },
  "7011.T": { event_date: "2026-05-12", event_title: "2026年3月期決算", source_url: "https://finance.yahoo.co.jp/quote/7011.T/disclosure" },
  "8053.T": { event_date: "2026-05-01", event_title: "2026年3月期決算", source_url: "https://finance.yahoo.co.jp/quote/8053.T/disclosure" },
  "9984.T": { event_date: "2026-05-11", event_title: "2026年3月期決算", source_url: "https://group.softbank/ir" },
  "8316.T": { event_date: "2026-05-13", event_title: "2026年3月期決算", source_url: "https://www.smfg.co.jp/investor/" },
  "8306.T": { event_date: "2026-05-15", event_title: "2026年3月期決算", source_url: "https://www.mufg.jp/ir/" },
  "7735.T": { event_date: "2026-05-13", event_title: "2026年3月期決算", source_url: "https://finance.yahoo.co.jp/quote/7735.T/disclosure" },
  "7173.T": { event_date: "2026-05-08", event_title: "2026年3月期決算", source_url: "https://finance.yahoo.co.jp/quote/7173.T/disclosure" },
};

const fundamentalFallback = {
  // 2026/05/27の同日取得済み値。Yahoo側の一時的なfetch失敗で空欄上書きしないための保護。
  "2802.T": {
    per: "42.38",
    pbr: "6.60",
    roe_pct: "17.75",
    dividend_yield_pct: "0.94",
    market_cap: "5,194,709",
    latest_period: "2026年3月期",
    previous_period: "2025年3月期",
    sales_million_yen: "1,583,719",
    sales_yoy_pct: "3.5",
    profit_metric: "営業利益",
    profit_million_yen: "199,412",
    profit_yoy_pct: "75",
    performance_updated_date: "2026/5/7",
  },
  "6762.T": {
    per: "31.22", pbr: "3.21", roe_pct: "9.81", dividend_yield_pct: "1.08",
    latest_period: "2026年3月期", previous_period: "2025年3月期",
    sales_million_yen: "2,504,820", sales_yoy_pct: "13.6", profit_metric: "営業利益",
    profit_million_yen: "272,415", profit_yoy_pct: "21.5", performance_updated_date: "2026/4/28",
  },
  "6146.T": {
    per: "", pbr: "12.74", roe_pct: "25.15", dividend_yield_pct: "",
    latest_period: "2026年3月期", previous_period: "2025年3月期",
    sales_yoy_pct: "11.1", profit_metric: "営業利益", profit_yoy_pct: "10.9",
  },
  "7011.T": {
    per: "34.29", pbr: "4.22", roe_pct: "12.22", dividend_yield_pct: "",
    latest_period: "2026年3月期", previous_period: "2025年3月期",
    sales_yoy_pct: "-1.1", profit_metric: "営業利益", profit_yoy_pct: "26.7",
  },
  "8053.T": {
    per: "13.73", pbr: "1.87", roe_pct: "12.94", dividend_yield_pct: "",
    latest_period: "2026年3月期", previous_period: "2025年3月期",
    sales_yoy_pct: "0.6", profit_metric: "利益", profit_yoy_pct: "0.9",
  },
  "9984.T": {
    per: "", pbr: "2.45", roe_pct: "34.28", dividend_yield_pct: "",
    latest_period: "2026年3月期", previous_period: "2025年3月期",
    sales_yoy_pct: "7.7", profit_metric: "利益", profit_yoy_pct: "259.9",
  },
  "8316.T": {
    per: "13.40", pbr: "1.44", roe_pct: "10.38", dividend_yield_pct: "",
    latest_period: "2026年3月期", previous_period: "2025年3月期",
    sales_yoy_pct: "6.1", profit_metric: "利益", profit_yoy_pct: "34",
  },
  "8306.T": {
    per: "", pbr: "1.54", roe_pct: "11.34", dividend_yield_pct: "",
    latest_period: "2026年3月期", previous_period: "2025年3月期",
    sales_yoy_pct: "7.3", profit_metric: "利益", profit_yoy_pct: "27.7",
  },
  "7735.T": {
    per: "19.65", pbr: "4.44", roe_pct: "20.28", dividend_yield_pct: "",
    latest_period: "2026年3月期", previous_period: "2025年3月期",
    sales_yoy_pct: "-3.1", profit_metric: "営業利益", profit_yoy_pct: "-9.7",
  },
  "7173.T": {
    per: "8.83", pbr: "0.96", roe_pct: "10.66", dividend_yield_pct: "",
    latest_period: "2026年3月期", previous_period: "2025年3月期",
    sales_yoy_pct: "23.9", profit_metric: "利益", profit_yoy_pct: "45.2",
  },
};

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function write(file, text) {
  fs.writeFileSync(path.join(root, file), text, "utf8");
}

function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let cell = "";
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
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  const header = rows.shift() ?? [];
  return rows
    .filter((r) => r.some((v) => String(v).trim() !== ""))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows) {
  const header = Object.keys(rows[0] ?? {});
  return `${header.join(",")}\n${rows.map((r) => header.map((h) => csvEscape(r[h])).join(",")).join("\n")}\n`;
}

function stripHtml(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function textNum(value) {
  const s = String(value ?? "")
    .replace(/,/g, "")
    .replace(/%/g, "")
    .replace(/倍/g, "")
    .replace(/円/g, "")
    .replace(/百万円/g, "")
    .trim();
  if (!s || s === "---" || s === "-" || s === "未取得" || s === "未採点") return null;
  const match = s.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

function round(value, digits = 1) {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(digits)) : "";
}

function pct(now, prev) {
  const n = textNum(now);
  const p = textNum(prev);
  if (n === null || p === null || p === 0) return "";
  return round(((n / p) - 1) * 100, 1);
}

function clamp(value, min = 0, max = 100) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(min, Math.min(max, n));
}

function scale(value, min, max) {
  const n = textNum(value);
  if (n === null) return null;
  return clamp(((n - min) / (max - min)) * 100);
}

function inverseScale(value, good, bad) {
  const n = textNum(value);
  if (n === null) return null;
  return clamp(((bad - n) / (bad - good)) * 100);
}

function weighted(parts) {
  let sum = 0;
  let wsum = 0;
  for (const [value, weight] of parts) {
    if (value !== null && value !== undefined && value !== "") {
      sum += Number(value) * weight;
      wsum += weight;
    }
  }
  return wsum ? sum / wsum : null;
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": userAgent } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function firstStyledNumber(block) {
  const value = block.match(/StyledNumber__value[^>]*>([^<]+)/)?.[1]
    ?? block.match(/DataListItem__value[^>]*>([^<]+)/)?.[1]
    ?? "";
  return stripHtml(value);
}

function parseQuoteMetrics(html) {
  const blocks = [...html.matchAll(/<dl class="[^"]*DataListItem[\s\S]*?<\/dl>/g)].map((m) => m[0]);
  const out = {};
  for (const block of blocks) {
    const name = stripHtml(block.match(/DataListItem__name[^>]*>([^<]+)/)?.[1] ?? "");
    const text = stripHtml(block);
    const value = firstStyledNumber(block);
    if (!value) continue;
    if (name === "PER" && (text.includes("会社予想") || !out.per)) out.per = value;
    else if (name === "PBR" && (text.includes("実績") || !out.pbr)) out.pbr = value;
    else if (name === "ROE" && (text.includes("実績") || !out.roe_pct)) out.roe_pct = value;
    else if (name === "配当利回り" && (text.includes("会社予想") || !out.dividend_yield_pct)) out.dividend_yield_pct = value;
    else if (name === "時価総額" && !out.market_cap) out.market_cap = value;
  }
  return out;
}

function cellText(cell) {
  const value = firstStyledNumber(cell);
  return value || stripHtml(cell);
}

function parsePerformance(html) {
  const table = html.match(/<table[\s\S]*?<\/table>/)?.[0] ?? "";
  const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/g)].map((m) => m[0]);
  const parsed = rows.slice(1).map((rowHtml) => {
    const period = stripHtml(rowHtml.match(/<th[\s\S]*?<\/th>/)?.[0] ?? "");
    const cells = [...rowHtml.matchAll(/<td[\s\S]*?<\/td>/g)].map((m) => cellText(m[0]));
    return {
      period,
      is_forecast: period.includes("会社予想"),
      sales_million_yen: cells[0] ?? "",
      gross_profit_million_yen: cells[1] ?? "",
      operating_profit_million_yen: cells[3] ?? "",
      ordinary_profit_million_yen: cells[5] ?? "",
      net_profit_million_yen: cells[7] ?? "",
      accounting: cells[8] ?? "",
      updated_date: cells[9] ?? "",
    };
  }).filter((r) => r.period);
  const actual = parsed.filter((r) => !r.is_forecast);
  const latest = actual[0] ?? {};
  const prev = actual[1] ?? {};
  const profitNow = textNum(latest.operating_profit_million_yen) !== null ? latest.operating_profit_million_yen
    : (textNum(latest.ordinary_profit_million_yen) !== null ? latest.ordinary_profit_million_yen : latest.net_profit_million_yen);
  const profitPrev = textNum(latest.operating_profit_million_yen) !== null ? prev.operating_profit_million_yen
    : (textNum(latest.ordinary_profit_million_yen) !== null ? prev.ordinary_profit_million_yen : prev.net_profit_million_yen);
  const profitMetric = textNum(latest.operating_profit_million_yen) !== null ? "営業利益"
    : (textNum(latest.ordinary_profit_million_yen) !== null ? "経常利益" : "純利益");
  return {
    latest_period: latest.period ?? "",
    previous_period: prev.period ?? "",
    sales_million_yen: latest.sales_million_yen ?? "",
    sales_yoy_pct: pct(latest.sales_million_yen, prev.sales_million_yen),
    profit_metric: profitMetric,
    profit_million_yen: profitNow ?? "",
    profit_yoy_pct: pct(profitNow, profitPrev),
    performance_updated_date: latest.updated_date ?? "",
  };
}

function parseDisclosure(html, ticker) {
  const normalized = html
    .replace(/\\"/g, '"')
    .replace(/\\u0026/g, "&")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  const itemRe = /\{"headline":"([\s\S]*?)","link":"([\s\S]*?)"[\s\S]*?"createdDateTime":"([^"]+)"/g;
  const items = [];
  for (const m of normalized.matchAll(itemRe)) {
    const headline = m[1].replace(/\\"/g, '"');
    const link = m[2];
    const created = m[3];
    const isFinancialResult = /決算短信|決算説明資料|Financial Results|Financial Report/.test(headline);
    const isNoise = /訂正|Correction|Occurrence of Losses|Gain on Sale|Non-Consolidated Financial Results due|Dividends of Surplus|Presentation Materials/.test(headline);
    if (isFinancialResult && !isNoise) {
      items.push({ headline, link, created });
    }
  }
  const preferred = items.find((item) => /決算短信|Consolidated Financial Results|Consolidated Financial Report/.test(item.headline)) ?? items[0];
  if (preferred) {
    return {
      event_date: preferred.created.slice(0, 10),
      event_title: preferred.headline,
      event_time: preferred.created,
      source_url: preferred.link,
      source_type: "Yahoo!ファイナンス適時開示",
    };
  }
  return {
    event_date: manualEventFallback[ticker]?.event_date ?? "",
    event_title: manualEventFallback[ticker]?.event_title ?? "",
    event_time: "",
    source_url: manualEventFallback[ticker]?.source_url ?? "",
    source_type: manualEventFallback[ticker] ? "手動フォールバック" : "未取得",
  };
}

async function fetchFundamental(ticker) {
  const quoteUrl = `https://finance.yahoo.co.jp/quote/${encodeURIComponent(ticker)}`;
  const performanceUrl = `${quoteUrl}/performance`;
  const disclosureUrl = `${quoteUrl}/disclosure`;
  const [quoteHtml, performanceHtml, disclosureHtml] = await Promise.all([
    fetchText(quoteUrl),
    fetchText(performanceUrl),
    fetchText(disclosureUrl),
  ]);
  return {
    ...parseQuoteMetrics(quoteHtml),
    ...parsePerformance(performanceHtml),
    ...parseDisclosure(disclosureHtml, ticker),
    quote_url: quoteUrl,
    performance_url: performanceUrl,
    disclosure_url: disclosureUrl,
    fundamental_status: "取得",
  };
}

async function fetchChart(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1d&includePrePost=false`;
  const res = await fetch(url, { headers: { "User-Agent": userAgent } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const result = json.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const ts = result?.timestamp ?? [];
  if (!result || !quote || !ts.length) throw new Error("chart result missing");
  return ts.map((t, i) => ({
    date: new Date(t * 1000).toISOString().slice(0, 10),
    close: quote.close?.[i],
    volume: quote.volume?.[i],
  })).filter((r) => Number.isFinite(r.close));
}

function avg(values) {
  const nums = values.filter((v) => Number.isFinite(v));
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

function maxDrawdown(rows) {
  let peak = -Infinity;
  let worst = 0;
  for (const row of rows) {
    if (!Number.isFinite(row.close)) continue;
    peak = Math.max(peak, row.close);
    if (peak > 0) worst = Math.min(worst, (row.close / peak - 1) * 100);
  }
  return round(worst, 1);
}

function chartMetrics(rows) {
  const latest = rows.at(-1) ?? {};
  const first = rows[0] ?? {};
  const prev = rows.at(-2) ?? {};
  const before60 = rows.at(-61) ?? rows[0] ?? {};
  const last60 = rows.slice(-60);
  const closes200 = rows.slice(-200).map((r) => r.close);
  const volumes20 = rows.slice(-21, -1).map((r) => r.volume);
  const low = Math.min(...rows.map((r) => r.close).filter(Number.isFinite));
  const high = Math.max(...rows.map((r) => r.close).filter(Number.isFinite));
  const ma200 = avg(closes200);
  const vol20 = avg(volumes20);
  return {
    price_date: latest.date ?? "",
    latest_close: round(latest.close, 2),
    return_1d_pct: prev.close ? round((latest.close / prev.close - 1) * 100, 2) : "",
    return_60d_pct: before60.close ? round((latest.close / before60.close - 1) * 100, 1) : "",
    return_1y_pct: first.close ? round((latest.close / first.close - 1) * 100, 1) : "",
    max_drawdown_60d_pct: maxDrawdown(last60),
    ma200_gap_pct: ma200 ? round((latest.close / ma200 - 1) * 100, 1) : "",
    volume_ratio_20d: vol20 ? round(latest.volume / vol20, 2) : "",
    week52_position_pct: high !== low ? round(((latest.close - low) / (high - low)) * 100, 1) : "",
    chart_points: rows.length,
  };
}

function locateRows(rows, eventDate) {
  const before = rows.filter((r) => r.date <= eventDate);
  const after = rows.filter((r) => r.date > eventDate);
  return { base: before.at(-1) ?? null, after };
}

function reactionMetrics(priceRows, benchmarkRows, eventDate) {
  const out = { event_date: eventDate || "", reaction_status: eventDate ? "" : "決算日未取得" };
  if (!eventDate) return out;
  const p = locateRows(priceRows, eventDate);
  const b = locateRows(benchmarkRows, eventDate);
  out.base_date = p.base?.date ?? "";
  out.base_close = round(p.base?.close, 2);
  out.benchmark_base_date = b.base?.date ?? "";
  for (const n of [1, 5, 20]) {
    const pr = p.after[n - 1] ?? null;
    const br = b.after[n - 1] ?? null;
    const ret = pr && p.base ? (pr.close / p.base.close - 1) * 100 : null;
    const bench = br && b.base ? (br.close / b.base.close - 1) * 100 : null;
    out[`after_${n}d_date`] = pr?.date ?? "";
    out[`return_${n}d_pct`] = ret === null ? "" : round(ret, 2);
    out[`nikkei_${n}d_pct`] = bench === null ? "" : round(bench, 2);
    out[`excess_${n}d_pct`] = ret === null || bench === null ? "" : round(ret - bench, 2);
  }
  const e1 = textNum(out.excess_1d_pct);
  const e5 = textNum(out.excess_5d_pct);
  const e20 = textNum(out.excess_20d_pct);
  const scoreBase = e20 === null ? weighted([[e1, 0.4], [e5, 0.6]]) : weighted([[e1, 0.34], [e5, 0.51], [e20, 0.15]]);
  out.reaction_score = scoreBase === null ? "" : round(clamp(50 + 2 * scoreBase), 1);
  out.reaction_status = e20 === null ? "暫定: 20営業日未到達" : "確定: 20営業日到達";
  return out;
}

function dataCompleteness(f, p, r) {
  const fields = [
    f.per, f.pbr, f.roe_pct, f.sales_yoy_pct, f.profit_yoy_pct,
    p.return_1y_pct, p.max_drawdown_60d_pct, p.ma200_gap_pct, p.volume_ratio_20d,
    r.reaction_score,
  ];
  const got = fields.filter((v) => textNum(v) !== null).length;
  return { got, total: fields.length, pct: round((got / fields.length) * 100, 0) };
}

function currentUse(row, f, p, r, completeness) {
  const gaps = [];
  for (const [label, value] of [
    ["PER", f.per],
    ["PBR", f.pbr],
    ["ROE", f.roe_pct],
    ["売上成長", f.sales_yoy_pct],
    ["利益成長", f.profit_yoy_pct],
    ["決算後反応", r.reaction_score],
  ]) {
    if (textNum(value) === null) gaps.push(label);
  }
  const per = textNum(f.per);
  const pbr = textNum(f.pbr);
  const ret1y = textNum(p.return_1y_pct);
  const dd60 = textNum(p.max_drawdown_60d_pct);
  const reaction = textNum(r.reaction_score);
  const warnings = [];
  if (per !== null && per >= 45) warnings.push(`PER${per}倍`);
  if (pbr !== null && pbr >= 8) warnings.push(`PBR${pbr}倍`);
  if (ret1y !== null && ret1y >= 160) warnings.push(`1年上昇${ret1y}%`);
  if (dd60 !== null && dd60 <= -25) warnings.push(`60日最大下落${dd60}%`);
  if (reaction !== null && reaction < 45) warnings.push(`決算後反応${reaction}点`);
  let status = "比較候補";
  if (gaps.length >= 4) status = "補完待ち";
  if (warnings.length >= 2) status = "警戒";
  if (row.score_status === "追加データ未投入" && completeness.pct >= 70 && warnings.length <= 1) status = "追加比較候補";
  if (row.priority_group === "警戒解除待ち" && warnings.length) status = "警戒解除待ち";
  return {
    gap_list: gaps.join(" / ") || "なし",
    warning_list: warnings.join(" / ") || "なし",
    status,
  };
}

function scoreLive(f, p, r, completeness) {
  const growth = weighted([
    [scale(f.sales_yoy_pct, -10, 30), 0.35],
    [scale(f.profit_yoy_pct, -20, 60), 0.45],
    [scale(f.roe_pct, 5, 25), 0.20],
  ]);
  const valuation = weighted([
    [inverseScale(f.per, 10, 55), 0.40],
    [inverseScale(f.pbr, 1, 15), 0.25],
    [scale(f.roe_pct, 5, 25), 0.25],
    [scale(f.dividend_yield_pct, 0, 4), 0.10],
  ]);
  const risk = weighted([
    [scale(p.max_drawdown_60d_pct, -35, -5), 0.45],
    [inverseScale(p.return_1y_pct, 50, 220), 0.25],
    [scale(p.ma200_gap_pct, -10, 30), 0.15],
    [completeness.pct, 0.15],
  ]);
  const trend = weighted([
    [scale(p.return_60d_pct, -20, 40), 0.30],
    [scale(p.return_1y_pct, -20, 120), 0.35],
    [scale(p.ma200_gap_pct, -10, 35), 0.20],
    [scale(p.volume_ratio_20d, 0.5, 2.5), 0.15],
  ]);
  const reaction = textNum(r.reaction_score);
  const total = weighted([
    [growth, 0.30],
    [valuation, 0.20],
    [risk, 0.20],
    [trend, 0.15],
    [reaction, 0.15],
  ]);
  return {
    growth_score: round(growth, 1),
    valuation_score: round(valuation, 1),
    risk_score: round(risk, 1),
    trend_score: round(trend, 1),
    reaction_score_used: reaction === null ? "" : reaction,
    live_selection_score: round(total, 1),
  };
}

const focus = parseCsv(read("651_professional_adjusted_focus10.csv"));
const benchmarkRows = await fetchChart("^N225");

const fetchRows = [];
const priceRows = [];
const fundamentalRows = [];
const reactionRows = [];
const selectionRows = [];
const gapRows = [];

for (const row of focus) {
  let chart = [];
  let chartStatus = "未取得";
  let chartError = "";
  try {
    chart = await fetchChart(row.ticker);
    chartStatus = "取得";
  } catch (error) {
    chartError = error.message;
  }
  let fundamental = {};
  let fundamentalStatus = "未取得";
  let fundamentalError = "";
  try {
    fundamental = await fetchFundamental(row.ticker);
    fundamentalStatus = fundamental.fundamental_status;
  } catch (error) {
    const fallback = fundamentalFallback[row.ticker];
    fundamental = {
      ...(fallback ?? {}),
      event_date: manualEventFallback[row.ticker]?.event_date ?? "",
      event_title: manualEventFallback[row.ticker]?.event_title ?? "",
      source_url: manualEventFallback[row.ticker]?.source_url ?? "",
      source_type: fallback ? "同日取得済み値フォールバック" : (manualEventFallback[row.ticker] ? "手動フォールバック" : "未取得"),
    };
    fundamentalStatus = fallback ? "取得失敗・同日取得値使用" : "未取得";
    fundamentalError = error.message;
  }
  const price = chartMetrics(chart);
  const reaction = reactionMetrics(chart, benchmarkRows, fundamental.event_date);
  const completeness = dataCompleteness(fundamental, price, reaction);
  const use = currentUse(row, fundamental, price, reaction, completeness);
  const score = scoreLive(fundamental, price, reaction, completeness);

  fetchRows.push({
    generated_at: generatedAt,
    ticker: row.ticker,
    company: row.company,
    chart_status: chartStatus,
    chart_error: chartError,
    fundamental_status: fundamentalStatus,
    fundamental_error: fundamentalError,
    quote_url: fundamental.quote_url ?? `https://finance.yahoo.co.jp/quote/${row.ticker}`,
    performance_url: fundamental.performance_url ?? `https://finance.yahoo.co.jp/quote/${row.ticker}/performance`,
    disclosure_url: fundamental.disclosure_url ?? `https://finance.yahoo.co.jp/quote/${row.ticker}/disclosure`,
  });
  priceRows.push({ generated_at: generatedAt, ticker: row.ticker, company: row.company, ...price });
  fundamentalRows.push({
    generated_at: generatedAt,
    ticker: row.ticker,
    company: row.company,
    per: fundamental.per ?? "",
    pbr: fundamental.pbr ?? "",
    roe_pct: fundamental.roe_pct ?? "",
    dividend_yield_pct: fundamental.dividend_yield_pct ?? "",
    market_cap: fundamental.market_cap ?? "",
    latest_period: fundamental.latest_period ?? "",
    previous_period: fundamental.previous_period ?? "",
    sales_million_yen: fundamental.sales_million_yen ?? "",
    sales_yoy_pct: fundamental.sales_yoy_pct ?? "",
    profit_metric: fundamental.profit_metric ?? "",
    profit_million_yen: fundamental.profit_million_yen ?? "",
    profit_yoy_pct: fundamental.profit_yoy_pct ?? "",
    performance_updated_date: fundamental.performance_updated_date ?? "",
  });
  reactionRows.push({
    generated_at: generatedAt,
    ticker: row.ticker,
    company: row.company,
    event_date: fundamental.event_date ?? "",
    event_title: fundamental.event_title ?? "",
    source_type: fundamental.source_type ?? "",
    source_url: fundamental.source_url ?? "",
    ...reaction,
  });
  selectionRows.push({
    generated_at: generatedAt,
    focus_rank: row.focus_rank,
    ticker: row.ticker,
    company: row.company,
    priority_group: row.priority_group,
    source_type: row.source_type,
    score_status_before: row.score_status,
    existing_adjusted_score: row.existing_adjusted_score,
    reference_priority_score: row.reference_priority_score,
    data_completion: `${completeness.got}/${completeness.total}`,
    data_completion_pct: completeness.pct,
    live_selection_score: score.live_selection_score,
    growth_score: score.growth_score,
    valuation_score: score.valuation_score,
    risk_score: score.risk_score,
    trend_score: score.trend_score,
    reaction_score: score.reaction_score_used,
    current_use_status: use.status,
    warning_list: use.warning_list,
    remaining_gap: use.gap_list,
    next_action: use.status === "補完待ち"
      ? "不足項目を補完してから比較表へ戻す"
      : (use.status.includes("警戒") ? "警戒条件が解除されるまで候補確定しない" : "同じ式で比較継続"),
  });
  gapRows.push({
    generated_at: generatedAt,
    ticker: row.ticker,
    company: row.company,
    missing_items: use.gap_list,
    warnings: use.warning_list,
    data_completion: `${completeness.got}/${completeness.total}`,
    handling: "未取得項目は点数に混ぜず、6月再判定までに追加確認する。",
  });
}

selectionRows.sort((a, b) => {
  const statusOrder = { "比較候補": 0, "追加比較候補": 1, "警戒解除待ち": 2, "警戒": 3, "補完待ち": 4 };
  return (statusOrder[a.current_use_status] ?? 9) - (statusOrder[b.current_use_status] ?? 9)
    || (textNum(b.live_selection_score) ?? -999) - (textNum(a.live_selection_score) ?? -999);
});

write("653_focus10_live_metric_fetch_status.csv", toCsv(fetchRows));
write("654_focus10_live_price_metrics.csv", toCsv(priceRows));
write("655_focus10_live_fundamental_metrics.csv", toCsv(fundamentalRows));
write("656_focus10_reaction_metrics.csv", toCsv(reactionRows));
write("657_focus10_recalculated_selection.csv", toCsv(selectionRows.map((r, i) => ({ live_rank: i + 1, ...r }))));
write("658_focus10_data_gap_after_fetch.csv", toCsv(gapRows));

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (m) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[m]));

function table(rows) {
  const header = Object.keys(rows[0] ?? {});
  return `<table><thead><tr>${header.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${header.map((h) => `<td>${esc(r[h])}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

const summaryCards = [
  ["対象", `${focus.length}社`, "プロ参照反映後の優先確認10社"],
  ["価格取得", `${fetchRows.filter((r) => r.chart_status === "取得").length}社`, "1年日次・出来高・下落率を自動計算"],
  ["PER等取得", `${fundamentalRows.filter((r) => r.per || r.pbr || r.roe_pct).length}社`, "直接取得または同日取得済み値で補完"],
  ["決算反応", `${reactionRows.filter((r) => r.reaction_score).length}社`, "日経平均比の1/5/20営業日反応"],
];

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>優先10社 実データ補完 2026年5月27日</title>
  <style>
    :root { --ink:#071f36; --blue:#0b6fa4; --line:#c9daea; --bg:#f7fafc; --warn:#8a4300; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:"Yu Gothic","Meiryo",Arial,sans-serif; color:var(--ink); background:var(--bg); line-height:1.7; }
    header { background:#123f63; color:#fff; padding:28px 32px; }
    h1 { margin:0 0 8px; font-size:28px; }
    main { max-width:1220px; margin:0 auto; padding:24px; }
    section { background:#fff; border:1px solid var(--line); border-radius:10px; padding:22px; margin:0 0 18px; page-break-inside:avoid; }
    h2 { margin:0 0 12px; font-size:22px; border-left:8px solid var(--blue); padding-left:12px; }
    .grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .card { border:1px solid var(--line); border-radius:8px; padding:14px; background:#f9fcff; }
    .num { font-size:26px; font-weight:800; color:#064f79; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:12.5px; }
    th, td { border:1px solid var(--line); padding:7px; vertical-align:top; word-break:break-word; overflow-wrap:anywhere; }
    th { background:#e7f1fa; text-align:left; color:#06395b; }
    .note { border-left:6px solid #d88b1f; background:#fff9ef; padding:12px 14px; margin-top:10px; color:#111; }
    .links a { display:inline-block; margin:4px 8px 4px 0; padding:8px 12px; border:1px solid #8bb9d6; border-radius:8px; color:#064f79; text-decoration:none; background:#fff; font-weight:700; }
    @media (max-width:760px){ .grid{grid-template-columns:1fr;} main{padding:14px;} table{font-size:12px;} }
  </style>
</head>
<body>
  <header>
    <h1>優先10社 実データ補完</h1>
    <div>作成: ${esc(generatedAt)} / 目的: 候補10社を、価格・出来高・PER/PBR/ROE・決算後反応で比較できる状態へ近づける</div>
  </header>
  <main>
    <section>
      <h2>1. 取得結果</h2>
      <div class="grid">${summaryCards.map(([label, value, note]) => `<div class="card"><div class="num">${esc(value)}</div><div><b>${esc(label)}</b></div><div>${esc(note)}</div></div>`).join("")}</div>
      <div class="note">この表は購入対象の確定ではありません。未取得項目は点数に混ぜず、取れた実データだけで暫定比較しています。</div>
    </section>
    <section>
      <h2>2. 再計算後の比較表</h2>
      ${table(selectionRows.map((r, i) => ({ live_rank: i + 1, ...r })))}
    </section>
    <section>
      <h2>3. 価格・出来高</h2>
      ${table(priceRows)}
    </section>
    <section>
      <h2>4. PER/PBR/ROE・業績</h2>
      ${table(fundamentalRows)}
    </section>
    <section>
      <h2>5. 決算後反応</h2>
      ${table(reactionRows)}
    </section>
    <section>
      <h2>6. 残課題</h2>
      ${table(gapRows)}
      <div class="links">
        <a href="653_focus10_live_metric_fetch_status.csv">取得ログCSV</a>
        <a href="654_focus10_live_price_metrics.csv">価格指標CSV</a>
        <a href="655_focus10_live_fundamental_metrics.csv">PER等CSV</a>
        <a href="656_focus10_reaction_metrics.csv">決算反応CSV</a>
        <a href="657_focus10_recalculated_selection.csv">再計算比較CSV</a>
      </div>
    </section>
  </main>
</body>
</html>`;

write("focus10_live_data_completion_20260527.html", html);

console.log(JSON.stringify({
  generatedAt,
  target: focus.length,
  chartOk: fetchRows.filter((r) => r.chart_status === "取得").length,
  fundamentalAny: fundamentalRows.filter((r) => r.per || r.pbr || r.roe_pct).length,
  output: "focus10_live_data_completion_20260527.html",
}, null, 2));
