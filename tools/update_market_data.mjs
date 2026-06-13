import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const marketItems = [
  { symbol: "^N225", name: "日経平均", digits: 0 },
  { symbol: "1306.T", name: "TOPIX ETF", digits: 0 },
  { symbol: "^GSPC", name: "S&P500", digits: 2 },
  { symbol: "^IXIC", name: "NASDAQ", digits: 2 },
  { symbol: "JPY=X", name: "ドル円", digits: 2 },
  { symbol: "^TNX", name: "米10年金利", digits: 2 },
  { symbol: "DX-Y.NYB", name: "ドル指数DXY", digits: 2 },
  { symbol: "GC=F", name: "金先物", digits: 1 },
  // VIXは1日±30%超の変動が正常に起こる指数のため、分割検出(系列切り詰め)の対象外。
  { symbol: "^VIX", name: "VIX", digits: 2, volatile: true }
];

// 現行のNISA候補10社(複利シミュレーション・購入計画と同一リスト)。
// PERはローカルに信頼できる値がないため null とし、判定では PER が数値の場合のみ高PERゲートを適用する。
const stockItems = [
  { code: "8053", symbol: "8053.T", name: "住友商事", per: null, theme: "value" },
  { code: "8316", symbol: "8316.T", name: "三井住友FG", per: null, theme: "rate" },
  { code: "6501", symbol: "6501.T", name: "日立製作所", per: null, theme: "infra" },
  { code: "6503", symbol: "6503.T", name: "三菱電機", per: null, theme: "infra" },
  { code: "6857", symbol: "6857.T", name: "アドバンテスト", per: null, theme: "semiconductor" },
  { code: "8035", symbol: "8035.T", name: "東京エレクトロン", per: null, theme: "semiconductor" },
  { code: "7011", symbol: "7011.T", name: "三菱重工業", per: null, theme: "infra" },
  { code: "6762", symbol: "6762.T", name: "TDK", per: null, theme: "physical_ai" },
  { code: "6146", symbol: "6146.T", name: "ディスコ", per: null, theme: "semiconductor" },
  { code: "5803", symbol: "5803.T", name: "フジクラ", per: null, theme: "infra" }
];

const endpoint = (symbol, range = "6mo") =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;

const toTokyoTime = () =>
  new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date()).replaceAll("/", "-");

// Yahooのチャート系列は株式分割が未調整のことがある(例: 1306.Tの約1:10分割)。
// 前日比±30%超の不連続を分割とみなし、不連続より後の系列だけを統計に使う。
function trailingContiguous(closes, maxDailyJump = 0.30) {
  let start = 0;
  for (let i = 1; i < closes.length; i += 1) {
    const prev = closes[i - 1];
    if (!Number.isFinite(prev) || prev === 0) continue;
    if (Math.abs(closes[i] / prev - 1) > maxDailyJump) start = i;
  }
  return { series: closes.slice(start), truncated: start > 0 };
}

async function fetchHigh52w(item) {
  const response = await fetch(endpoint(item.symbol, "1y"), {
    headers: { "user-agent": "kabu-report-updater/1.0" }
  });
  if (!response.ok) throw new Error(`${item.symbol}: HTTP ${response.status}`);
  const json = await response.json();
  const quote = json.chart?.result?.[0]?.indicators?.quote?.[0];
  const closes = (quote?.close || []).filter((value) => Number.isFinite(value));
  const { series, truncated } = item.volatile
    ? { series: closes, truncated: false }
    : trailingContiguous(closes);
  return {
    high: series.length ? Math.max(...series) : null,
    truncated,
    days: series.length,
  };
}

async function fetchQuote(item) {
  const response = await fetch(endpoint(item.symbol), {
    headers: { "user-agent": "kabu-report-updater/1.0" }
  });
  if (!response.ok) throw new Error(`${item.symbol}: HTTP ${response.status}`);
  const json = await response.json();
  const result = json.chart?.result?.[0];
  const meta = result?.meta;
  const quote = result?.indicators?.quote?.[0];
  const closes = (quote?.close || []).filter((value) => Number.isFinite(value));
  const price = Number.isFinite(meta?.regularMarketPrice)
    ? meta.regularMarketPrice
    : closes.at(-1);
  // chartPreviousClose はチャート範囲(3mo)開始直前の終値であり前日終値ではない。
  // 前日比には regularMarketPreviousClose を優先し、無ければ日足の直近2本目を使う。
  const prev = Number.isFinite(meta?.regularMarketPreviousClose)
    ? meta.regularMarketPreviousClose
    : Number.isFinite(meta?.previousClose)
      ? meta.previousClose
      : closes.length >= 2 ? closes.at(-2) : null;
  const changePct = Number.isFinite(price) && Number.isFinite(prev) && prev !== 0
    ? ((price - prev) / prev) * 100
    : null;
  const { series: contiguous, truncated: seriesTruncated } = item.volatile
    ? { series: closes, truncated: false }
    : trailingContiguous(closes);
  const closeFromEnd = (daysBack) => contiguous.length > daysBack ? contiguous.at(-(daysBack + 1)) : null;
  const fiveDayBase = closeFromEnd(5);
  const twentyDayBase = closeFromEnd(20);
  const change5dPct = Number.isFinite(price) && Number.isFinite(fiveDayBase) && fiveDayBase !== 0
    ? ((price - fiveDayBase) / fiveDayBase) * 100
    : null;
  const change20dPct = Number.isFinite(price) && Number.isFinite(twentyDayBase) && twentyDayBase !== 0
    ? ((price - twentyDayBase) / twentyDayBase) * 100
    : null;

  return {
    ...item,
    value: price ?? null,
    price: price ?? null,
    prevClose: Number.isFinite(prev) ? prev : null,
    changePct,
    change5dPct,
    change20dPct,
    sma75: contiguous.length >= 75 ? contiguous.slice(-75).reduce((sum, v) => sum + v, 0) / 75 : null,
    seriesTruncated,
  };
}

function marketValue(markets, symbol, key = "value") {
  const item = markets.find((market) => market.symbol === symbol);
  const value = item?.[key];
  return Number.isFinite(value) ? value : null;
}

function addRisk(signals, condition, points, label, severity = "watch") {
  if (!condition) return 0;
  signals.push({ label, severity });
  return points;
}

function buildDollarRisk(markets) {
  const signals = [];
  let score = 0;
  const dxy = marketValue(markets, "DX-Y.NYB");
  const dxy1d = marketValue(markets, "DX-Y.NYB", "changePct");
  const dxy5d = marketValue(markets, "DX-Y.NYB", "change5dPct");
  const dxy20d = marketValue(markets, "DX-Y.NYB", "change20dPct");
  const usdjpy5d = marketValue(markets, "JPY=X", "change5dPct");
  const us10y5d = marketValue(markets, "^TNX", "change5dPct");
  const gold5d = marketValue(markets, "GC=F", "change5dPct");
  const vix = marketValue(markets, "^VIX");
  const sp5005d = marketValue(markets, "^GSPC", "change5dPct");

  score += addRisk(signals, dxy !== null && dxy < 100, 1, `DXYが100割れ: ${dxy?.toFixed(2)}。ドルの基調が弱い可能性。`, "watch");
  score += addRisk(signals, dxy1d !== null && dxy1d <= -1.0, 2, `DXYが1日で${dxy1d.toFixed(2)}%。単日で急落。`, "danger");
  score += addRisk(signals, dxy5d !== null && dxy5d <= -2.5, 2, `DXYが5営業日で${dxy5d.toFixed(2)}%。ドル売りが連続。`, "danger");
  score += addRisk(signals, dxy20d !== null && dxy20d <= -5.0, 2, `DXYが20営業日で${dxy20d.toFixed(2)}%。中期のドル安トレンド。`, "danger");
  score += addRisk(signals, usdjpy5d !== null && usdjpy5d <= -3.0, 1, `ドル円が5営業日で${usdjpy5d.toFixed(2)}%。急な円高で日本株に逆風。`, "watch");
  score += addRisk(signals, us10y5d !== null && us10y5d <= -8.0, 1, `米10年金利が5営業日で${us10y5d.toFixed(2)}%。景気不安型の金利低下に注意。`, "watch");
  score += addRisk(signals, gold5d !== null && gold5d >= 3.0, 1, `金が5営業日で+${gold5d.toFixed(2)}%。ドル不信・安全資産買いの可能性。`, "watch");
  score += addRisk(signals, vix !== null && vix >= 25, 2, `VIXが${vix.toFixed(2)}。市場ストレスが高い。`, "danger");
  score += addRisk(signals, vix !== null && vix >= 20 && vix < 25, 1, `VIXが${vix.toFixed(2)}。警戒水準。`, "watch");
  score += addRisk(signals, sp5005d !== null && sp5005d <= -4.0 && dxy5d !== null && dxy5d <= -2.0, 1, `S&P500とドルが同時下落。リスクオフ型のドル売りに注意。`, "danger");

  if (signals.length === 0) {
    signals.push({ label: "主要なドル急落シグナルは出ていません。通常監視です。", severity: "normal" });
  }

  const level = score >= 6 ? "危険" : score >= 3 ? "警戒" : "通常";
  const action = score >= 6
    ? "新規買いを停止。半導体など高PER・海外比率の高い銘柄は追加せず、現金待機72万円(1口座240万円の30%)を維持します。"
    : score >= 3
      ? "予定買いを半分に縮小。6月18日以降の初回投入(1口座84万円=元本の35%)は、DXY反発とVIX低下を確認してから実行します。"
      : "予定通り監視継続。ドル急落シグナルが弱ければ、他の条件と合わせて段階投資を検討します。";

  return { score: Math.min(score, 10), level, action, signals };
}

function decideSignal(stock, markets) {
  const us10y = markets.find((item) => item.symbol === "^TNX")?.value;
  const nasdaq = markets.find((item) => item.symbol === "^IXIC")?.changePct;
  if (stock.changePct !== null && stock.changePct <= -5) return "停止";
  if (stock.theme === "semiconductor" && Number.isFinite(us10y) && us10y >= 4.70) return "確認";
  if (stock.theme === "semiconductor" && Number.isFinite(nasdaq) && nasdaq <= -3) return "確認";
  if (Number.isFinite(stock.per) && stock.per >= 45) return "確認";
  if (stock.changePct !== null && Math.abs(stock.changePct) >= 3) return "確認";
  return "買い可";
}

async function loadPrevious() {
  try {
    return JSON.parse(await readFile("data/market_update.json", "utf8"));
  } catch {
    return { markets: [], stocks: [] };
  }
}

const previous = await loadPrevious();
const errors = [];

async function safeFetch(item) {
  try {
    const quote = await fetchQuote(item);
    let high = { high: null, truncated: false, days: 0 };
    try {
      high = await fetchHigh52w(item);
    } catch (highError) {
      errors.push(String(highError.message || highError));
      const old = [...(previous.markets || []), ...(previous.stocks || [])].find((x) => x.symbol === item.symbol);
      high = { high: old?.high52w ?? null, truncated: false, days: 0 };
    }
    return {
      ...quote,
      high52w: high.high ?? quote.value ?? null,
      high52wTruncated: high.truncated,
      high52wDays: high.days,
    };
  } catch (error) {
    errors.push(String(error.message || error));
    const old = [...(previous.markets || []), ...(previous.stocks || [])].find((x) => x.symbol === item.symbol);
    return { ...item, value: old?.value ?? null, price: old?.price ?? null, changePct: old?.changePct ?? null, high52w: old?.high52w ?? null };
  }
}

const markets = await Promise.all(marketItems.map(safeFetch));
const stocksRaw = await Promise.all(stockItems.map(safeFetch));
const stocks = stocksRaw.map((stock) => ({
  code: stock.code,
  symbol: stock.symbol,
  name: stock.name,
  price: stock.price,
  prevClose: stock.prevClose ?? null,
  changePct: stock.changePct,
  per: stock.per,
  signal: decideSignal(stock, markets)
}));

// 検算: 系列の不連続(分割未調整)と、現在値・75日線の異常乖離を記録する。
const dataChecks = [];
for (const item of [...markets, ...stocksRaw]) {
  if (item.seriesTruncated || item.high52wTruncated) {
    dataChecks.push(`${item.symbol}: 前日比±30%超の不連続(分割未調整の疑い)を検出。75日線・52週高値は不連続以降の系列(直近${item.high52wDays ?? "?"}営業日)のみで計算`);
  }
  if (Number.isFinite(item.value) && Number.isFinite(item.sma75) && Math.abs(item.value / item.sma75 - 1) > 0.5) {
    dataChecks.push(`${item.symbol}: 現在値(${item.value})と75日線(${Math.round(item.sma75)})の乖離が50%超。価格系列の確認が必要`);
  }
}

const stopCount = stocks.filter((stock) => stock.signal === "停止").length;
const watchCount = stocks.filter((stock) => stock.signal === "確認").length;
const summary = stopCount > 0
  ? `停止判定が${stopCount}銘柄あります。予定買いを止め、理由を確認します。`
  : watchCount > 0
    ? `確認判定が${watchCount}銘柄あります。高PER・金利・急変動の条件を確認してから買います。`
    : "主要な停止条件は出ていません。予定通りの分割投資を検討できます。";

const output = {
  updatedAt: `${toTokyoTime()} JST`,
  source: "Yahoo Finance chart API via GitHub Actions",
  summary,
  errors,
  dataChecks,
  dollarRisk: buildDollarRisk(markets),
  markets: markets.map(({ symbol, name, value, prevClose, changePct, change5dPct, change20dPct, sma75, high52w, high52wDays, digits }) => ({
    symbol, name, value, prevClose: prevClose ?? null, changePct, change5dPct, change20dPct, sma75, high52w, high52wDays: high52wDays ?? null, digits,
  })),
  stocks
};

await mkdir("data", { recursive: true });
await writeFile("data/market_update.json", `${JSON.stringify(output, null, 2)}\n`, "utf8");

// stock_analyzer 用 market_context.csv を同期(サンプル値のまま使わない)。
const n225 = markets.find((market) => market.symbol === "^N225");
if (n225?.value != null) {
  const drawdown = n225.high52w ? Math.round(((n225.value - n225.high52w) / n225.high52w) * 1000) / 10 : "";
  const contextCsv = [
    "metric,value,sma75,drawdown_from_high_pct,notes",
    `nikkei225,${Math.round(n225.value * 100) / 100},${n225.sma75 != null ? Math.round(n225.sma75 * 100) / 100 : ""},${drawdown},52週高値(1y chart)ベース / synced from market_update.json ${output.updatedAt}`,
  ].join("\n");
  await writeFile(path.join(process.cwd(), "..", "data", "market_context.csv"), `${contextCsv}\n`, "utf8");
}
