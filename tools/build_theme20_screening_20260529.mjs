import fs from "fs";
import https from "https";
import path from "path";

const ROOT = process.cwd();

const CANDIDATES = [
  { ticker: "8035.T", company: "東京エレクトロン", group: "半導体製造装置・材料", role: "前工程装置", qual: "A", note: "前工程装置の中核。AI半導体投資の恩恵を受けやすいが、半導体サイクルと高PER確認が必要。" },
  { ticker: "6857.T", company: "アドバンテスト", group: "半導体製造装置・材料", role: "半導体テスター", qual: "A", note: "AI/HPC向け検査需要と接続。高ボラティリティと決算期待の反動を確認。" },
  { ticker: "7735.T", company: "SCREEN HD", group: "半導体製造装置・材料", role: "洗浄装置", qual: "A", note: "微細化で洗浄工程の重要性が高い。受注と半導体市況を確認。" },
  { ticker: "6146.T", company: "ディスコ", group: "半導体製造装置・材料", role: "切断・研削", qual: "A", note: "薄化、ダイシング、先端パッケージで構造需要。ただし値動きが大きい。" },
  { ticker: "6525.T", company: "KOKUSAI ELECTRIC", group: "半導体製造装置・材料", role: "成膜・熱処理", qual: "A", note: "前工程の成膜・熱処理。上場期間が短いため長期検証は不足。" },
  { ticker: "6920.T", company: "レーザーテック", group: "半導体製造装置・材料", role: "EUV検査", qual: "A", note: "EUV検査の構造優位。高PER・急落耐性を強く確認。" },
  { ticker: "4063.T", company: "信越化学工業", group: "半導体製造装置・材料", role: "ウェハ・材料", qual: "A", note: "シリコンウェハ・半導体材料の安定枠。化学市況も併せて確認。" },
  { ticker: "3436.T", company: "SUMCO", group: "半導体製造装置・材料", role: "シリコンウェハ", qual: "B", note: "ウェハ市況回復の候補。景気循環と利益回復確認が必要。" },
  { ticker: "4186.T", company: "東京応化工業", group: "半導体製造装置・材料", role: "フォトレジスト", qual: "A", note: "露光材料。先端半導体との接続は強いが、材料寄与度の確認が必要。" },
  { ticker: "4369.T", company: "トリケミカル研究所", group: "半導体製造装置・材料", role: "高純度化学品", qual: "B", note: "成膜材料の成長候補。小型寄りで変動リスクが大きい。" },
  { ticker: "5803.T", company: "フジクラ", group: "データセンター・電力・冷却・電線", role: "光配線・高速ケーブル", qual: "A", note: "AIデータセンター向け光接続の中心候補。直近急騰の反動確認が必須。" },
  { ticker: "5802.T", company: "住友電工", group: "データセンター・電力・冷却・電線", role: "光ファイバー・電力ケーブル", qual: "A", note: "光通信と電力ケーブルの両面。急騰後の押し目確認が必要。" },
  { ticker: "5801.T", company: "古河電工", group: "データセンター・電力・冷却・電線", role: "光ファイバー・電力・放熱", qual: "A", note: "データ通信・電力・放熱のテーマ接続が強い。過熱確認が最重要。" },
  { ticker: "6501.T", company: "日立製作所", group: "データセンター・電力・冷却・電線", role: "送配電・電力制御", qual: "A", note: "電力網・変圧器・デジタル基盤。大型でテーマの持続性を確認しやすい。" },
  { ticker: "7011.T", company: "三菱重工業", group: "データセンター・電力・冷却・電線", role: "電力・冷却・インフラ", qual: "B", note: "電力・冷却・インフラ接点はあるが、防衛・航空など他要因も大きい。" },
  { ticker: "6503.T", company: "三菱電機", group: "データセンター・電力・冷却・電線", role: "電力機器・冷却・FA", qual: "A", note: "電力機器、FA、光デバイス、冷却で複数接点。直近調整後の確認価値あり。" },
  { ticker: "6504.T", company: "富士電機", group: "データセンター・電力・冷却・電線", role: "UPS・電源設備", qual: "A", note: "UPS・電源安定化。データセンター電源の直接テーマ。" },
  { ticker: "6367.T", company: "ダイキン工業", group: "データセンター・電力・冷却・電線", role: "空調・冷却", qual: "B", note: "冷却テーマに接続。ただし住宅・商業空調も大きく、データセンター比率確認が必要。" },
  { ticker: "1969.T", company: "高砂熱学工業", group: "データセンター・電力・冷却・電線", role: "空調設備工事", qual: "A", note: "データセンター空調・設備工事。受注と利益率の確認が必要。" },
  { ticker: "1942.T", company: "関電工", group: "データセンター・電力・冷却・電線", role: "電気設備工事", qual: "B", note: "受変電・電気設備工事。データセンター案件比率の確認が必要。" },
];

const SP_SYMBOL = "^GSPC";
const ONE_DAY = 24 * 60 * 60 * 1000;

function parseCsv(text) {
  text = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let quote = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quote) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quote = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quote = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell.length || row.length) row.push(cell.replace(/\r$/, ""));
  const headers = rows.shift() || [];
  return rows
    .filter((items) => items.some((item) => String(item).trim() !== ""))
    .map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] || ""])));
}

function readCsv(file) {
  const full = path.join(ROOT, file);
  return fs.existsSync(full) ? parseCsv(fs.readFileSync(full, "utf8")) : [];
}

const num = (value) => {
  const text = String(value ?? "").replace(/,/g, "").replace(/%/g, "").trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
};

const round1 = (value) => value == null || Number.isNaN(value) ? "" : Math.round(value * 10) / 10;
const pct = (value) => value == null || Number.isNaN(value) ? "未取得" : `${round1(value)}%`;
const point = (value) => value == null || Number.isNaN(value) ? "未取得" : `${round1(value)}点`;
const yen = (value) => value == null || Number.isNaN(value) ? "未取得" : `${Math.round(value).toLocaleString("ja-JP")}円`;
const escapeHtml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const existingRows = readCsv("199_universe100_screening.csv");
const existingByTicker = new Map(existingRows.map((row) => [row.ticker, row]));

async function fetchChart(symbol, range = "10y") {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d&events=history%7Cdiv%7Csplit`;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const { status, body } = await getText(url);
    if (status === 429 && attempt < 3) {
      await sleep(1000 * attempt);
      continue;
    }
    if (status < 200 || status >= 300) throw new Error(`${symbol} ${status}`);
    const json = JSON.parse(body);
    const result = json.chart?.result?.[0];
    if (!result) throw new Error(`${symbol} no chart result`);
    const timestamps = result.timestamp || [];
    const closes = result.indicators?.adjclose?.[0]?.adjclose || result.indicators?.quote?.[0]?.close || [];
    const rows = timestamps
      .map((ts, index) => ({ date: new Date(ts * 1000), close: closes[index] }))
      .filter((row) => Number.isFinite(row.close) && row.close > 0);
    return { symbol, rows, currency: result.meta?.currency || "", exchange: result.meta?.exchangeName || "" };
  }
  throw new Error(`${symbol} fetch failed`);
}

function getText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { family: 4, headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json,text/plain,*/*" } }, (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          resolve({ status: res.statusCode || 0, body });
        });
      })
      .on("error", reject);
  });
}

function atOrAfter(rows, target) {
  return rows.find((row) => row.date >= target) || rows[0] || null;
}

function tailFrom(rows, target) {
  return rows.filter((row) => row.date >= target);
}

function ret(from, to) {
  if (!from || !to || !from.close || !to.close) return null;
  return (to.close / from.close - 1) * 100;
}

function cagr(from, to) {
  if (!from || !to || !from.close || !to.close) return null;
  const years = (to.date - from.date) / (365.25 * ONE_DAY);
  if (years <= 0.5) return null;
  return (Math.pow(to.close / from.close, 1 / years) - 1) * 100;
}

function maxDrawdown(rows) {
  let peak = -Infinity;
  let dd = 0;
  for (const row of rows) {
    if (row.close > peak) peak = row.close;
    if (peak > 0) dd = Math.min(dd, (row.close / peak - 1) * 100);
  }
  return dd;
}

function annualVol(rows) {
  const returns = [];
  for (let i = 1; i < rows.length; i += 1) {
    returns.push(Math.log(rows[i].close / rows[i - 1].close));
  }
  if (returns.length < 20) return null;
  const avg = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - avg) ** 2, 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

function monthlyWinRate(rows) {
  const monthly = new Map();
  for (const row of rows) {
    const key = `${row.date.getUTCFullYear()}-${String(row.date.getUTCMonth() + 1).padStart(2, "0")}`;
    if (!monthly.has(key)) monthly.set(key, []);
    monthly.get(key).push(row);
  }
  let wins = 0;
  let total = 0;
  for (const list of monthly.values()) {
    if (list.length < 2) continue;
    total += 1;
    if (list[list.length - 1].close > list[0].close) wins += 1;
  }
  return total ? (wins / total) * 100 : null;
}

function percentileScores(items, higherBetter = true) {
  const valid = items.filter((item) => item.value != null && Number.isFinite(item.value));
  const sorted = valid.slice().sort((a, b) => higherBetter ? b.value - a.value : a.value - b.value);
  const n = sorted.length;
  const scores = new Map();
  sorted.forEach((item, index) => {
    scores.set(item.ticker, n <= 1 ? 100 : 100 - (index / (n - 1)) * 100);
  });
  return scores;
}

const avg = (...values) => {
  const valid = values.filter((value) => value != null && Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
};

const now = new Date();
const charts = new Map();
const fetchErrors = [];
for (const symbol of [SP_SYMBOL, ...CANDIDATES.map((item) => item.ticker)]) {
  try {
    charts.set(symbol, await fetchChart(symbol));
    await sleep(250);
  } catch (error) {
    fetchErrors.push({ symbol, error: error?.message || String(error), stack: error?.stack || "" });
  }
}

const spRows = charts.get(SP_SYMBOL)?.rows || [];
const spLatest = spRows[spRows.length - 1] || null;
const spOneYear = atOrAfter(spRows, new Date((spLatest?.date || now).getTime() - 365 * ONE_DAY));
const spFiveYear = atOrAfter(spRows, new Date((spLatest?.date || now).getTime() - 365.25 * 5 * ONE_DAY));
const spTenYear = atOrAfter(spRows, new Date((spLatest?.date || now).getTime() - 365.25 * 10 * ONE_DAY));
const spRet1y = ret(spOneYear, spLatest);
const spCagr5 = cagr(spFiveYear, spLatest);
const spCagr10 = cagr(spTenYear, spLatest);

const metricRows = CANDIDATES.map((candidate) => {
  const chart = charts.get(candidate.ticker);
  const rows = chart?.rows || [];
  const latest = rows[rows.length - 1] || null;
  const oneYear = atOrAfter(rows, new Date((latest?.date || now).getTime() - 365 * ONE_DAY));
  const fiveYear = atOrAfter(rows, new Date((latest?.date || now).getTime() - 365.25 * 5 * ONE_DAY));
  const tenYear = atOrAfter(rows, new Date((latest?.date || now).getTime() - 365.25 * 10 * ONE_DAY));
  const rows1y = tailFrom(rows, new Date((latest?.date || now).getTime() - 365 * ONE_DAY));
  const rows5y = tailFrom(rows, new Date((latest?.date || now).getTime() - 365.25 * 5 * ONE_DAY));
  const rows60 = rows.slice(-60);
  const existing = existingByTicker.get(candidate.ticker) || {};
  const cagr5 = cagr(fiveYear, latest);
  const cagr10 = cagr(tenYear, latest);
  const ret1y = ret(oneYear, latest);
  const ret60d = rows60.length > 1 ? ret(rows60[0], latest) : null;
  const dd5 = rows5y.length ? maxDrawdown(rows5y) : null;
  const dd1y = rows1y.length ? maxDrawdown(rows1y) : null;
  const vol1y = annualVol(rows1y);
  const monthlyWin = monthlyWinRate(rows5y);
  const sp5Diff = cagr5 != null && spCagr5 != null ? cagr5 - spCagr5 : null;
  const sp1yDiff = ret1y != null && spRet1y != null ? ret1y - spRet1y : null;
  const dataYears = latest && rows[0] ? (latest.date - rows[0].date) / (365.25 * ONE_DAY) : null;
  return {
    ...candidate,
    date: latest ? latest.date.toISOString().slice(0, 10) : "",
    close: latest?.close ?? null,
    existingScore: num(existing.universe_score_100),
    per: num(existing.per_forecast),
    pbr: num(existing.pbr_actual),
    roe: num(existing.roe_actual_pct),
    revenueYoy: num(existing.revenue_yoy_pct),
    profitYoy: num(existing.profit_yoy_pct),
    dataYears,
    cagr5,
    cagr10,
    ret1y,
    ret60d,
    sp5Diff,
    sp1yDiff,
    dd5,
    dd1y,
    vol1y,
    monthlyWin,
    sourceStatus: chart ? "Yahoo chart取得" : "価格取得失敗",
  };
});

const longScore5 = percentileScores(metricRows.map((row) => ({ ticker: row.ticker, value: row.cagr5 })), true);
const longScore10 = percentileScores(metricRows.map((row) => ({ ticker: row.ticker, value: row.cagr10 })), true);
const winScore = percentileScores(metricRows.map((row) => ({ ticker: row.ticker, value: row.monthlyWin })), true);
const sp5Score = percentileScores(metricRows.map((row) => ({ ticker: row.ticker, value: row.sp5Diff })), true);
const sp1Score = percentileScores(metricRows.map((row) => ({ ticker: row.ticker, value: row.sp1yDiff })), true);
const dd5Score = percentileScores(metricRows.map((row) => ({ ticker: row.ticker, value: row.dd5 })), true);
const dd1Score = percentileScores(metricRows.map((row) => ({ ticker: row.ticker, value: row.dd1y })), true);
const volScore = percentileScores(metricRows.map((row) => ({ ticker: row.ticker, value: row.vol1y })), false);

const scored = metricRows.map((row) => {
  const longTermScore = avg(longScore5.get(row.ticker), longScore10.get(row.ticker), winScore.get(row.ticker));
  const spScore = avg(sp5Score.get(row.ticker), sp1Score.get(row.ticker));
  const downsideScore = avg(dd5Score.get(row.ticker), dd1Score.get(row.ticker), volScore.get(row.ticker));
  const components = [row.existingScore, longTermScore, spScore, downsideScore];
  const available = components.filter((value) => value != null && Number.isFinite(value)).length;
  const grossScore = avg(...components);
  const confidence = Math.round((available / 4) * 70 + (row.per != null ? 8 : 0) + (row.pbr != null ? 8 : 0) + (row.roe != null ? 8 : 0) + (row.profitYoy != null || row.revenueYoy != null ? 6 : 0));
  const practicalScore = grossScore == null ? null : grossScore * (0.8 + 0.2 * (confidence / 100));
  const warnings = [];
  if (row.dataYears != null && row.dataYears < 3) warnings.push("上場/取得期間が短い");
  if (row.ret1y != null && row.ret1y > 150) warnings.push("1年急騰");
  if (row.ret60d != null && row.ret60d > 30) warnings.push("60日急騰");
  if (row.dd5 != null && row.dd5 < -50) warnings.push("5年最大下落が深い");
  if (row.dd1y != null && row.dd1y < -25) warnings.push("1年最大下落が深い");
  if (row.per == null || row.pbr == null || row.roe == null) warnings.push("PER/PBR/ROE補完必要");
  let status = "データ補完";
  if (practicalScore != null && confidence >= 78 && warnings.filter((w) => !w.includes("PER")).length === 0 && practicalScore >= 58) status = "一次候補";
  else if (practicalScore != null && practicalScore >= 62) status = "監視";
  else if (practicalScore != null && practicalScore < 48) status = "保留";
  return {
    ...row,
    longTermScore,
    spScore,
    downsideScore,
    available,
    confidence,
    grossScore,
    practicalScore,
    warnings,
    status,
  };
}).sort((a, b) => (b.practicalScore ?? -1) - (a.practicalScore ?? -1));

scored.forEach((row, index) => row.rank = index + 1);
const byGroup = [...scored].sort((a, b) => a.group.localeCompare(b.group, "ja") || a.rank - b.rank);

const headers = [
  "順位","コード","銘柄","テーマ群","役割","質的仮説","扱い","実用スコア","4項目平均","信頼度","充足項目","既存選定","長期安定","S&P比較","下落耐性","価格日","終値","5年CAGR","10年CAGR","1年騰落","60日騰落","5年S&P差","1年S&P差","5年最大下落","1年最大下落","1年ボラ","月次勝率","PER","PBR","ROE","売上前年比","利益前年比","注意点","メモ","データ元"
];

const toCsvCell = (value) => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const csvRows = scored.map((row) => ({
  "順位": row.rank,
  "コード": row.ticker,
  "銘柄": row.company,
  "テーマ群": row.group,
  "役割": row.role,
  "質的仮説": row.qual,
  "扱い": row.status,
  "実用スコア": round1(row.practicalScore),
  "4項目平均": round1(row.grossScore),
  "信頼度": row.confidence,
  "充足項目": `${row.available}/4`,
  "既存選定": round1(row.existingScore),
  "長期安定": round1(row.longTermScore),
  "S&P比較": round1(row.spScore),
  "下落耐性": round1(row.downsideScore),
  "価格日": row.date,
  "終値": round1(row.close),
  "5年CAGR": round1(row.cagr5),
  "10年CAGR": round1(row.cagr10),
  "1年騰落": round1(row.ret1y),
  "60日騰落": round1(row.ret60d),
  "5年S&P差": round1(row.sp5Diff),
  "1年S&P差": round1(row.sp1yDiff),
  "5年最大下落": round1(row.dd5),
  "1年最大下落": round1(row.dd1y),
  "1年ボラ": round1(row.vol1y),
  "月次勝率": round1(row.monthlyWin),
  "PER": round1(row.per),
  "PBR": round1(row.pbr),
  "ROE": round1(row.roe),
  "売上前年比": round1(row.revenueYoy),
  "利益前年比": round1(row.profitYoy),
  "注意点": row.warnings.join(" / "),
  "メモ": row.note,
  "データ元": `${row.sourceStatus}; 199_universe100_screening.csv`,
}));

fs.writeFileSync(path.join(ROOT, "786_theme20_ai_infra_screening_20260529.csv"), [headers.join(","), ...csvRows.map((row) => headers.map((header) => toCsvCell(row[header])).join(","))].join("\n"), "utf8");

const tableRows = (rows) => rows.map((row) => `
  <tr class="${row.status === "一次候補" ? "ok" : row.status === "監視" ? "watch" : row.status === "保留" ? "drop" : ""}">
    <td>${row.rank}</td>
    <td>${escapeHtml(row.ticker)} ${escapeHtml(row.company)}</td>
    <td>${escapeHtml(row.group)}</td>
    <td>${escapeHtml(row.role)}</td>
    <td>${escapeHtml(row.qual)}</td>
    <td>${escapeHtml(row.status)}</td>
    <td>${point(row.practicalScore)}</td>
    <td>${point(row.grossScore)}</td>
    <td>${row.confidence}</td>
    <td>${point(row.existingScore)}</td>
    <td>${point(row.longTermScore)}</td>
    <td>${point(row.spScore)}</td>
    <td>${point(row.downsideScore)}</td>
    <td>${pct(row.cagr5)}</td>
    <td>${pct(row.cagr10)}</td>
    <td>${pct(row.ret1y)}</td>
    <td>${pct(row.ret60d)}</td>
    <td>${pct(row.dd5)}</td>
    <td>${escapeHtml(row.warnings.join(" / ") || "主要警戒なし")}</td>
  </tr>
`).join("");

const topByGroup = (group) => scored.filter((row) => row.group === group).slice(0, 5);
const sourceNote = `価格時系列: Yahoo Finance chart API。S&P比較: ${SP_SYMBOL}、1年騰落 ${pct(spRet1y)}、5年CAGR ${pct(spCagr5)}、10年CAGR ${pct(spCagr10)}。財務・既存スコア: 199_universe100_screening.csv。`;

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AIインフラ関連20社 スクリーニング 2026年5月29日</title>
  <style>
    body{margin:0;background:#f4f7fb;color:#061624;font-family:"Yu Gothic","Meiryo",Arial,sans-serif;line-height:1.62}
    main{max-width:1380px;margin:0 auto;padding:28px}
    h1{margin:0;color:#123d63;font-size:31px}
    h2{margin:24px 0 10px;color:#123d63;border-left:8px solid #0b5f96;padding-left:12px}
    .lead{background:#123d63;color:#fff;border-radius:14px;padding:20px;margin-bottom:16px}
    .lead p{color:#e7f1fb;margin:8px 0 0}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:14px 0}
    .card{background:#fff;border:1px solid #d5e2ee;border-radius:12px;padding:14px}
    .card b{display:block;color:#456}.card span{display:block;font-size:28px;font-weight:900;color:#0b5f96}
    .note{background:#fff8eb;border-left:7px solid #c06b00;padding:12px;margin:12px 0}
    .table-wrap{overflow-x:auto;background:#fff;border:1px solid #d5e2ee;border-radius:12px}
    table{width:100%;border-collapse:collapse;min-width:1480px}
    th,td{border:1px solid #d5e2ee;padding:7px;vertical-align:top;font-size:12px}
    th{background:#e6f1fb;color:#123d63;text-align:left;position:sticky;top:0}
    tr.ok td{background:#f3fff6} tr.watch td{background:#fffaf1} tr.drop td{background:#fff5f5}
    .links{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}
    .button{display:inline-block;background:#0b5f96;color:#fff;text-decoration:none;border-radius:9px;padding:9px 12px;font-weight:800}
    .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}.small{font-size:13px;color:#34465b}
    @media(max-width:900px){main{padding:16px}.cards,.grid2{grid-template-columns:1fr}}
  </style>
</head>
<body>
<main>
  <section class="lead">
    <h1>AIインフラ関連20社 スクリーニング</h1>
    <p>半導体製造装置・材料10社、データセンター・電力・冷却・電線10社を、既存システムの数値とYahoo Financeの価格時系列で一次比較しました。</p>
  </section>
  <div class="cards">
    <div class="card"><b>対象</b><span>20社</span><p>2テーマ各10社</p></div>
    <div class="card"><b>一次候補</b><span>${scored.filter((row) => row.status === "一次候補").length}</span><p>信頼度と警戒条件を確認</p></div>
    <div class="card"><b>監視</b><span>${scored.filter((row) => row.status === "監視").length}</span><p>点数は高いが過熱・下落確認</p></div>
    <div class="card"><b>データ補完</b><span>${scored.filter((row) => row.status === "データ補完").length}</span><p>財務・既存スコア不足</p></div>
  </div>
  <p class="note">総合判定では、質的仮説を点数に直接足していません。順位は、既存選定スコア、長期安定、S&P比較、下落耐性を中心に算出し、質的仮説は「なぜ調べる価値があるか」の補助欄として分けています。</p>
  <p class="small">${escapeHtml(sourceNote)}</p>
  <div class="links">
    <a class="button" href="786_theme20_ai_infra_screening_20260529.csv">CSVを開く</a>
    <a class="button" href="integrated_recalculated_10_20260528.html">既存10社の統合再計算</a>
  </div>

  <h2>1. 上位候補</h2>
  <div class="grid2">
    <div class="card">
      <h3>半導体製造装置・材料 上位5</h3>
      <ol>${topByGroup("半導体製造装置・材料").map((row) => `<li><b>${escapeHtml(row.ticker)} ${escapeHtml(row.company)}</b> ${point(row.practicalScore)} / ${escapeHtml(row.status)} / ${escapeHtml(row.warnings.join("、") || "主要警戒なし")}</li>`).join("")}</ol>
    </div>
    <div class="card">
      <h3>データセンター・電力・冷却・電線 上位5</h3>
      <ol>${topByGroup("データセンター・電力・冷却・電線").map((row) => `<li><b>${escapeHtml(row.ticker)} ${escapeHtml(row.company)}</b> ${point(row.practicalScore)} / ${escapeHtml(row.status)} / ${escapeHtml(row.warnings.join("、") || "主要警戒なし")}</li>`).join("")}</ol>
    </div>
  </div>

  <h2>2. 20社スクリーニング表</h2>
  <div class="table-wrap"><table>
    <thead><tr><th>順位</th><th>銘柄</th><th>テーマ群</th><th>役割</th><th>質的仮説</th><th>扱い</th><th>実用</th><th>4項目平均</th><th>信頼度</th><th>既存</th><th>長期</th><th>S&P</th><th>下落耐性</th><th>5年CAGR</th><th>10年CAGR</th><th>1年</th><th>60日</th><th>5年最大下落</th><th>注意点</th></tr></thead>
    <tbody>${tableRows(scored)}</tbody>
  </table></div>

  <h2>3. 使い方</h2>
  <p>この画面では、まず「一次候補」を次の詳細調査へ進めます。「監視」は点数が高くても急騰・急落・高ボラティリティを確認します。「データ補完」はPER/PBR/ROE、決算成長率、受注残、事業別売上比率を入れるまで購入検討候補にはしません。</p>
  <p>次の作業は、一次候補と監視上位について、公式決算資料からPER/PBR/ROE、売上・利益成長率、受注残、データセンター/半導体関連売上の確認を追加することです。</p>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "theme20_ai_infra_screening_20260529.html"), html, "utf8");

if (fetchErrors.length) {
  fs.writeFileSync(path.join(ROOT, "787_theme20_fetch_errors_20260529.csv"), ["symbol,error", ...fetchErrors.map((row) => `${row.symbol},${toCsvCell(row.error)}`)].join("\n"), "utf8");
} else {
  const staleErrorFile = path.join(ROOT, "787_theme20_fetch_errors_20260529.csv");
  if (fs.existsSync(staleErrorFile)) fs.unlinkSync(staleErrorFile);
}

console.log("wrote 786_theme20_ai_infra_screening_20260529.csv");
console.log("wrote theme20_ai_infra_screening_20260529.html");
console.log(scored.slice(0, 10).map((row) => `${row.rank}. ${row.ticker} ${row.company} ${round1(row.practicalScore)} ${row.status}`).join("\n"));
