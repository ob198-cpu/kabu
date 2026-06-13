import fs from "node:fs";
import path from "node:path";
import {
  ROOT,
  esc,
  generatedAt,
  insertCardAfter,
  readCsv,
  table,
  writeCsv,
} from "./lib/report_utils_20260613.mjs";

const CSV_FILE = "candidate10_reaction_backfill_20260613.csv";
const HTML_FILE = "candidate10_reaction_backfill_20260613.html";
const BENCHMARK = "^N225";
const USER_AGENT = "Mozilla/5.0 candidate10-reaction-backfill/20260613";

const currentCandidates = readCsv("108_capital_allocation_by_ticker.csv");
const officialInputs = readCsv("231_top10_official_two_earnings_input.csv")
  .filter((row) => row.period_type === "最新");
const officialByTicker = new Map(officialInputs.map((row) => [row.ticker, row]));
const reactionRebuild = readCsv("869_candidate10_earnings_reaction_rebuild_20260604.csv");
const reactionByTicker = new Map(reactionRebuild.map((row) => [row.ticker, row]));
const focusReaction = readCsv("656_focus10_reaction_metrics.csv");
const focusByTicker = new Map(focusReaction.map((row) => [row.ticker, row]));

const verifiedOverrides = {
  "6501.T": {
    event_date: "2026-04-27",
    source_kind: "公式IRページ",
    source_url: "https://www.hitachi.com/ja-jp/ir/library/fr/",
    source_note: "日立公式IRページで、2026年3月期連結決算説明会が2026年4月27日と確認できる。",
  },
  "8035.T": {
    event_date: "2026-04-30",
    source_kind: "公式決算短信PDF",
    source_url: "https://www.tel.co.jp/ir/library/report/jngpc500000000l6-att/fy26q4tanshin-j.pdf",
    source_note: "東京エレクトロン公式決算短信PDFの表紙に2026年4月30日と記載。",
  },
};

function eventSource(row) {
  const override = verifiedOverrides[row.ticker];
  if (override) return override;

  const official = officialByTicker.get(row.ticker);
  if (official?.release_date) {
    return {
      event_date: official.release_date,
      source_kind: official.source_kind || "公式入力CSV",
      source_url: official.source_url,
      source_note: official.note || "231_top10_official_two_earnings_input.csvの公式確認済み日付を使用。",
    };
  }

  const rebuilt = reactionByTicker.get(row.ticker);
  if (rebuilt?.event_date) {
    return {
      event_date: rebuilt.event_date,
      source_kind: "既存反応CSV",
      source_url: rebuilt.source_url,
      source_note: "869_candidate10_earnings_reaction_rebuild_20260604.csvの既存接続日付を使用。",
    };
  }

  const focus = focusByTicker.get(row.ticker);
  if (focus?.event_date) {
    return {
      event_date: focus.event_date,
      source_kind: "既存短期反応CSV",
      source_url: focus.source_url,
      source_note: "656_focus10_reaction_metrics.csvの既存接続日付を使用。",
    };
  }

  return {
    event_date: "",
    source_kind: "未確認",
    source_url: "",
    source_note: "公式決算日を確認してから計算する。",
  };
}

function formatDate(seconds) {
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

function round(value, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : "";
}

function pct(after, before) {
  if (!Number.isFinite(after) || !Number.isFinite(before) || before === 0) return null;
  return ((after / before) - 1) * 100;
}

async function fetchChart(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=6mo&interval=1d&includePrePost=false&events=div%2Csplits`;
  const response = await fetch(url, { headers: { "User-Agent": USER_AGENT, Accept: "application/json" } });
  if (!response.ok) throw new Error(`${symbol}: HTTP ${response.status}`);
  const json = await response.json();
  const result = json.chart?.result?.[0];
  const quote = result?.indicators?.quote?.[0];
  const timestamps = result?.timestamp || [];
  if (!result || !quote || timestamps.length === 0) throw new Error(`${symbol}: chart result missing`);
  return timestamps
    .map((timestamp, index) => ({
      date: formatDate(timestamp),
      close: Number(quote.close?.[index]),
      volume: Number(quote.volume?.[index]),
    }))
    .filter((row) => Number.isFinite(row.close));
}

function findOnOrAfter(rows, dateText) {
  return rows.find((row) => row.date >= dateText) || null;
}

function nthTradingDayAfter(rows, baseIndex, days) {
  const index = baseIndex + days;
  return rows[index] || null;
}

function reaction(stockRows, benchmarkRows, eventDate, days) {
  const base = findOnOrAfter(stockRows, eventDate);
  const benchmarkBase = findOnOrAfter(benchmarkRows, eventDate);
  if (!base || !benchmarkBase) return { date: "", stock_return_pct: "", benchmark_return_pct: "", excess_pct: "" };

  const stockBaseIndex = stockRows.findIndex((row) => row.date === base.date);
  const benchmarkBaseIndex = benchmarkRows.findIndex((row) => row.date === benchmarkBase.date);
  const after = nthTradingDayAfter(stockRows, stockBaseIndex, days);
  const benchmarkAfter = nthTradingDayAfter(benchmarkRows, benchmarkBaseIndex, days);
  if (!after || !benchmarkAfter) return { date: "", stock_return_pct: "", benchmark_return_pct: "", excess_pct: "" };

  const stockReturn = pct(after.close, base.close);
  const benchmarkReturn = pct(benchmarkAfter.close, benchmarkBase.close);
  return {
    date: after.date,
    stock_return_pct: round(stockReturn),
    benchmark_return_pct: round(benchmarkReturn),
    excess_pct: round(stockReturn - benchmarkReturn),
  };
}

function scoreFromExcess(row) {
  const values = [row.excess_1d_pct, row.excess_5d_pct, row.excess_20d_pct]
    .map(Number)
    .filter(Number.isFinite);
  if (values.length === 0) return "";
  const weighted =
    (Number(row.excess_1d_pct) || 0) * 0.25 +
    (Number(row.excess_5d_pct) || 0) * 0.35 +
    (Number(row.excess_20d_pct) || 0) * 0.40;
  return round(Math.max(0, Math.min(100, 50 + weighted * 2)), 1);
}

const charts = new Map();
const tickers = [...new Set([...currentCandidates.map((row) => row.ticker), BENCHMARK])];
const fetchLog = [];
for (const ticker of tickers) {
  try {
    charts.set(ticker, await fetchChart(ticker));
    fetchLog.push({ ticker, status: "OK", detail: `${charts.get(ticker).length}日分` });
  } catch (error) {
    fetchLog.push({ ticker, status: "NG", detail: error.message });
  }
}

const benchmarkRows = charts.get(BENCHMARK) || [];
const rows = currentCandidates.map((candidate) => {
  const source = eventSource(candidate);
  const stockRows = charts.get(candidate.ticker) || [];
  const base = source.event_date ? findOnOrAfter(stockRows, source.event_date) : null;
  const r1 = source.event_date ? reaction(stockRows, benchmarkRows, source.event_date, 1) : {};
  const r5 = source.event_date ? reaction(stockRows, benchmarkRows, source.event_date, 5) : {};
  const r20 = source.event_date ? reaction(stockRows, benchmarkRows, source.event_date, 20) : {};
  const row = {
    updated_at: generatedAt,
    ticker: candidate.ticker,
    name: candidate.name,
    role: candidate.role,
    event_date: source.event_date,
    source_kind: source.source_kind,
    source_url: source.source_url,
    base_date: base?.date || "",
    base_close: base ? round(base.close) : "",
    after_1d_date: r1.date || "",
    excess_1d_pct: r1.excess_pct ?? "",
    after_5d_date: r5.date || "",
    excess_5d_pct: r5.excess_pct ?? "",
    after_20d_date: r20.date || "",
    excess_20d_pct: r20.excess_pct ?? "",
    source_note: source.source_note,
  };
  const has20 = row.after_20d_date && row.excess_20d_pct !== "";
  row.reaction_status = has20 ? "20営業日到達" : source.event_date ? "20営業日未到達または価格未取得" : "公式日付未確認";
  row.score_connection = has20 ? "採点接続候補" : "購入判断には未使用";
  row.reaction_score = scoreFromExcess(row);
  return row;
});

writeCsv(CSV_FILE, [
  "updated_at",
  "ticker",
  "name",
  "role",
  "event_date",
  "source_kind",
  "base_date",
  "base_close",
  "after_1d_date",
  "excess_1d_pct",
  "after_5d_date",
  "excess_5d_pct",
  "after_20d_date",
  "excess_20d_pct",
  "reaction_score",
  "reaction_status",
  "score_connection",
  "source_url",
  "source_note",
], rows);

const summary = [
  { item: "対象", value: `${rows.length}社`, note: "現行候補10社を対象に決算後反応を再計算。" },
  { item: "20営業日到達", value: `${rows.filter((row) => row.reaction_status === "20営業日到達").length}社`, note: "採点接続候補。過信せず、価格・指数と併用。" },
  { item: "未到達/未取得", value: `${rows.filter((row) => row.reaction_status !== "20営業日到達").length}社`, note: "購入判断では補完待ちとして扱う。" },
  { item: "現在の使い方", value: "補助", note: "決算後反応だけで買いを決めない。" },
];

function statusClass(value) {
  if (String(value).includes("20営業日到達")) return "ok";
  if (String(value).includes("未確認")) return "bad";
  return "warn";
}

const htmlRows = rows.map((row) => ({
  銘柄: `${row.ticker} ${row.name}`,
  役割: row.role,
  決算日: row.event_date,
  出所: row.source_kind,
  "1日超過": row.excess_1d_pct === "" ? "" : `${row.excess_1d_pct}%`,
  "5日超過": row.excess_5d_pct === "" ? "" : `${row.excess_5d_pct}%`,
  "20日超過": row.excess_20d_pct === "" ? "" : `${row.excess_20d_pct}%`,
  反応点: row.reaction_score,
  状態: `<span class="${statusClass(row.reaction_status)}">${esc(row.reaction_status)}</span>`,
  扱い: row.score_connection,
  根拠: row.source_url ? `<a href="${esc(row.source_url)}">出所</a>` : "",
}));

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 決算後反応 再計算</title>
  <style>
    :root { --ink:#061a33; --line:#cbdceb; --soft:#eef6ff; --blue:#0b66a0; --ok:#087f5b; --warn:#a15c00; --bad:#b42318; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:"Yu Gothic","Meiryo",system-ui,sans-serif; color:var(--ink); background:#f6f9fc; line-height:1.7; }
    header { background:#123d63; color:#fff; padding:28px max(24px, calc((100vw - 1180px)/2)); }
    main { width:min(1180px, calc(100% - 32px)); margin:0 auto; padding:22px 0 48px; }
    h1 { margin:0 0 8px; font-size:32px; }
    h2 { border-left:8px solid var(--blue); padding-left:12px; margin:0 0 14px; }
    section { background:#fff; border:1px solid var(--line); border-radius:14px; padding:18px; margin:16px 0; page-break-inside:avoid; break-inside:avoid; }
    .summary { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .card { background:var(--soft); border:1px solid var(--line); border-radius:12px; padding:14px; }
    .card strong { display:block; font-size:28px; color:var(--blue); }
    .table-wrap { overflow-x:auto; }
    table { width:100%; border-collapse:collapse; min-width:1040px; table-layout:fixed; }
    th,td { border:1px solid var(--line); padding:9px 10px; vertical-align:top; overflow-wrap:anywhere; }
    th { background:#e5f1fb; }
    .ok { color:var(--ok); font-weight:900; }
    .warn { color:var(--warn); font-weight:900; }
    .bad { color:var(--bad); font-weight:900; }
    .note { border-left:6px solid var(--warn); background:#fff8ec; padding:12px; border-radius:10px; }
    .links { display:flex; flex-wrap:wrap; gap:10px; }
    .links a { color:#fff; background:var(--blue); border-radius:10px; padding:9px 12px; text-decoration:none; font-weight:900; }
  </style>
</head>
<body>
<header>
  <h1>候補10社 決算後反応 再計算</h1>
  <p>作成: ${esc(generatedAt)} / 公式決算日が確認できる範囲で、決算後1日・5日・20営業日の対日経平均超過リターンを再計算した画面です。</p>
</header>
<main>
  <section>
    <div class="links">
      <a href="index.html">ホーム</a>
      <a href="candidate_selection_health_check_20260613.html">候補10社 選定ロジック検査</a>
      <a href="${CSV_FILE}">CSV</a>
    </div>
  </section>
  <section>
    <h2>概要</h2>
    <div class="summary">
      ${summary.map((row) => `<div class="card"><b>${esc(row.item)}</b><strong>${esc(row.value)}</strong><span>${esc(row.note)}</span></div>`).join("")}
    </div>
    <p class="note">この表は「決算後に実際に買われたか」を見る補助材料です。1日・5日だけでは過信せず、20営業日反応がそろったものだけを採点接続候補にします。</p>
  </section>
  <section>
    <h2>10社の決算後反応</h2>
    ${table(["銘柄", "役割", "決算日", "出所", "1日超過", "5日超過", "20日超過", "反応点", "状態", "扱い", "根拠"], htmlRows, { htmlColumns: ["状態", "根拠"], widths: { 銘柄: "16%", 根拠: "8%" } })}
  </section>
  <section>
    <h2>取得ログ</h2>
    ${table(["ticker", "status", "detail"], fetchLog)}
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, HTML_FILE), html, "utf8");

insertCardAfter("index.html", "candidate_selection_health_check_20260613.html", `
      <a class="card" href="${HTML_FILE}">
          <b>候補10社 決算後反応 再計算</b>
          <span>公式決算日を確認できる範囲で、決算後1日・5日・20営業日の対日経平均超過リターンを再計算する画面。</span>
        </a>
      `, { hrefClass: "card" });

insertCardAfter("896_practical_entry_hub_20260606.html", "candidate_selection_health_check_20260613.html", `
      <a class="link-card" href="${HTML_FILE}">
          <b>候補10社 決算後反応 再計算</b>
          <span>公式決算日を確認できる範囲で、決算後1日・5日・20営業日の対日経平均超過リターンを再計算する画面。</span>
        </a>
      `, { hrefClass: "link-card" });

console.log(`generated ${HTML_FILE}`);
console.log(`generated ${CSV_FILE}`);
