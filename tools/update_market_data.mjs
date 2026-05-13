import { mkdir, readFile, writeFile } from "node:fs/promises";

const marketItems = [
  { symbol: "^N225", name: "日経平均", digits: 0 },
  { symbol: "1306.T", name: "TOPIX ETF", digits: 0 },
  { symbol: "^GSPC", name: "S&P500", digits: 2 },
  { symbol: "^IXIC", name: "NASDAQ", digits: 2 },
  { symbol: "JPY=X", name: "ドル円", digits: 2 },
  { symbol: "^TNX", name: "米10年金利", digits: 2 },
  { symbol: "DX-Y.NYB", name: "ドル指数DXY", digits: 2 },
  { symbol: "GC=F", name: "金先物", digits: 1 },
  { symbol: "^VIX", name: "VIX", digits: 2 }
];

const stockItems = [
  { code: "8035", symbol: "8035.T", name: "東京エレクトロン", per: 34.0, theme: "semiconductor" },
  { code: "6857", symbol: "6857.T", name: "アドバンテスト", per: 58.0, theme: "semiconductor" },
  { code: "4519", symbol: "4519.T", name: "中外製薬", per: 31.0, theme: "growth" },
  { code: "8306", symbol: "8306.T", name: "三菱UFJ", per: 12.0, theme: "rate" },
  { code: "8058", symbol: "8058.T", name: "三菱商事", per: 11.0, theme: "value" },
  { code: "7974", symbol: "7974.T", name: "任天堂", per: 32.0, theme: "cycle" },
  { code: "9433", symbol: "9433.T", name: "KDDI", per: 14.0, theme: "defensive" },
  { code: "2802", symbol: "2802.T", name: "味の素", per: 34.0, theme: "quality" }
];

const endpoint = (symbol) =>
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1d`;

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
  const prev = Number.isFinite(meta?.chartPreviousClose)
    ? meta.chartPreviousClose
    : closes.at(-2);
  const changePct = Number.isFinite(price) && Number.isFinite(prev) && prev !== 0
    ? ((price - prev) / prev) * 100
    : null;
  const closeFromEnd = (daysBack) => closes.length > daysBack ? closes.at(-(daysBack + 1)) : null;
  const fiveDayBase = closeFromEnd(5);
  const twentyDayBase = closeFromEnd(20);
  const change5dPct = Number.isFinite(price) && Number.isFinite(fiveDayBase) && fiveDayBase !== 0
    ? ((price - fiveDayBase) / fiveDayBase) * 100
    : null;
  const change20dPct = Number.isFinite(price) && Number.isFinite(twentyDayBase) && twentyDayBase !== 0
    ? ((price - twentyDayBase) / twentyDayBase) * 100
    : null;

  return { ...item, value: price ?? null, price: price ?? null, changePct, change5dPct, change20dPct };
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
    ? "新規買いを停止。半導体・任天堂・味の素など高PER/海外比率の高い銘柄は追加せず、現金15万円を維持します。"
    : score >= 3
      ? "予定買いを半分に縮小。6月18日以降の35万円追加は、DXY反発とVIX低下を確認してから実行します。"
      : "予定通り監視継続。ドル急落シグナルが弱ければ、他の条件と合わせて段階投資を検討します。";

  return { score: Math.min(score, 10), level, action, signals };
}

function decideSignal(stock, markets) {
  const us10y = markets.find((item) => item.symbol === "^TNX")?.value;
  const nasdaq = markets.find((item) => item.symbol === "^IXIC")?.changePct;
  if (stock.changePct !== null && stock.changePct <= -5) return "停止";
  if (stock.theme === "semiconductor" && Number.isFinite(us10y) && us10y >= 4.70) return "確認";
  if (stock.theme === "semiconductor" && Number.isFinite(nasdaq) && nasdaq <= -3) return "確認";
  if (stock.per >= 45) return "確認";
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
    return await fetchQuote(item);
  } catch (error) {
    errors.push(String(error.message || error));
    const old = [...(previous.markets || []), ...(previous.stocks || [])].find((x) => x.symbol === item.symbol);
    return { ...item, value: old?.value ?? null, price: old?.price ?? null, changePct: old?.changePct ?? null };
  }
}

const markets = await Promise.all(marketItems.map(safeFetch));
const stocksRaw = await Promise.all(stockItems.map(safeFetch));
const stocks = stocksRaw.map((stock) => ({
  code: stock.code,
  symbol: stock.symbol,
  name: stock.name,
  price: stock.price,
  changePct: stock.changePct,
  per: stock.per,
  signal: decideSignal(stock, markets)
}));

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
  dollarRisk: buildDollarRisk(markets),
  markets: markets.map(({ symbol, name, value, changePct, change5dPct, change20dPct, digits }) => ({ symbol, name, value, changePct, change5dPct, change20dPct, digits })),
  stocks
};

await mkdir("data", { recursive: true });
await writeFile("data/market_update.json", `${JSON.stringify(output, null, 2)}\n`, "utf8");
