import { mkdir, readFile, writeFile } from "node:fs/promises";

const marketItems = [
  { symbol: "^N225", name: "日経平均", digits: 0 },
  { symbol: "1306.T", name: "TOPIX ETF", digits: 0 },
  { symbol: "^GSPC", name: "S&P500", digits: 2 },
  { symbol: "^IXIC", name: "NASDAQ", digits: 2 },
  { symbol: "JPY=X", name: "ドル円", digits: 2 },
  { symbol: "^TNX", name: "米10年金利", digits: 2 }
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
  `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d`;

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

  return { ...item, value: price ?? null, price: price ?? null, changePct };
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
  markets: markets.map(({ symbol, name, value, changePct, digits }) => ({ symbol, name, value, changePct, digits })),
  stocks
};

await mkdir("data", { recursive: true });
await writeFile("data/market_update.json", `${JSON.stringify(output, null, 2)}\n`, "utf8");
