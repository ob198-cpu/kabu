import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const files = {
  actionQueue: "257_qualitative_action_queue.csv",
  universe: "199_universe100_screening.csv",
  existingNisa: "245_nisa_1year_hold_score_top20.csv",
  output: "258_qualitative_nisa_connection_trial.csv",
};

const read = (name) => fs.readFileSync(path.join(root, name), "utf8");

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === "\"" && quoted && next === "\"") {
      cell += "\"";
      i += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const [headers, ...body] = rows;
  return body.map((items) => Object.fromEntries(headers.map((key, index) => [key, items[index] ?? ""])));
};

const csvEscape = (value) => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
};

const num = (value, fallback = null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (min, max, value) => Math.max(min, Math.min(max, value));
const round1 = (value) => Math.round(value * 10) / 10;

const downsideSafety = (ret1y, maxDrawdown60) => {
  const drawdown = num(maxDrawdown60, -35);
  const ret = num(ret1y, 0);
  const drawdownScore = clamp(0, 100, 100 + drawdown * 2.4);
  let heatScore = 100;
  if (ret > 250) heatScore = 10;
  else if (ret > 150) heatScore = 30;
  else if (ret > 100) heatScore = 50;
  else if (ret < -20) heatScore = 45;
  return round1(drawdownScore * 0.65 + heatScore * 0.35);
};

const gate = (row, score, confidence, safety) => {
  const issues = [];
  const ret = num(row.ret1y_pct, 0);
  const maxDd = num(row.max_drawdown60_pct, 0);
  const per = num(row.per_forecast, null);
  const pbr = num(row.pbr_actual, null);

  if (confidence < 70) issues.push("データ信頼度70未満");
  if (ret > 250) issues.push(`1年上昇率${ret}%で過熱`);
  if (maxDd <= -30) issues.push(`60日最大下落率${maxDd}%で急落確認`);
  if (per !== null && per > 45) issues.push(`PER${per}倍で割高注意`);
  if (pbr !== null && pbr > 8) issues.push(`PBR${pbr}倍で高評価注意`);
  if (safety < 45) issues.push("下落耐性45点未満");

  if (issues.length) return { category: "保留", hard_gate: issues.join(" / ") };
  if (score >= 62) return { category: "残す候補", hard_gate: "なし" };
  if (score >= 55) return { category: "保留", hard_gate: "点数55〜62で追加確認" };
  return { category: "見送り", hard_gate: "点数55未満" };
};

const actionRows = parseCsv(read(files.actionQueue));
const universeRows = parseCsv(read(files.universe));
const existingNisaRows = parseCsv(read(files.existingNisa));

const universeByTicker = new Map(universeRows.map((row) => [row.ticker, row]));
const existingByTicker = new Map(existingNisaRows.map((row) => [row.ticker, row]));

const priorityRows = actionRows
  .filter((row) => ["S", "A"].includes(row.priority))
  .filter((row, index, self) => self.findIndex((item) => item.ticker === row.ticker) === index);

const outputRows = priorityRows.map((action) => {
  const universe = universeByTicker.get(action.ticker);
  const existing = existingByTicker.get(action.ticker);
  if (existing) {
    return {
      updated_at: "2026/05/25",
      ticker: action.ticker,
      company: action.company,
      theme_name: action.theme_name,
      source_status: "既存NISAスコア接続済み",
      trial_nisa_score: existing.nisa_score,
      category: existing.category,
      growth_quality_score: existing.growth_quality_score,
      downside_safety_score: existing.downside_safety_score,
      valuation_score: existing.valuation_score,
      medium_trend_score: existing.medium_trend_score,
      data_confidence: existing.data_confidence,
      hard_gate: existing.hard_gate,
      per: existing.per,
      pbr: existing.pbr,
      roe_pct: existing.roe_pct,
      revenue_yoy_pct: existing.revenue_yoy_pct,
      profit_yoy_pct: existing.profit_yoy_pct,
      ret1y_pct: existing.ret1y_pct,
      max_drawdown60_pct: existing.max_drawdown60_pct,
      calculation_basis: "245_nisa_1year_hold_score_top20.csv",
      next_action: action.task_detail,
    };
  }

  if (!universe) {
    return {
      updated_at: "2026/05/25",
      ticker: action.ticker,
      company: action.company,
      theme_name: action.theme_name,
      source_status: "母集団未接続",
      trial_nisa_score: "",
      category: "未計算",
      growth_quality_score: "",
      downside_safety_score: "",
      valuation_score: "",
      medium_trend_score: "",
      data_confidence: "",
      hard_gate: "199_universe100_screening.csvに該当なし",
      per: "",
      pbr: "",
      roe_pct: "",
      revenue_yoy_pct: "",
      profit_yoy_pct: "",
      ret1y_pct: "",
      max_drawdown60_pct: "",
      calculation_basis: "未接続",
      next_action: "母集団へ追加して株価・財務データ取得から開始",
    };
  }

  const growthQuality = round1((num(universe.growth_score_25, 0) / 25) * 100);
  const valuation = round1((num(universe.quality_valuation_score_25, 0) / 25) * 100);
  const mediumTrend = round1((num(universe.momentum_score_20, 0) / 20) * 100);
  const confidence = round1((num(universe.data_score_10, 0) / 10) * 100);
  const safety = downsideSafety(universe.ret1y_pct, universe.max_drawdown60_pct);
  const score = round1(
    growthQuality * 0.35
    + safety * 0.25
    + valuation * 0.20
    + mediumTrend * 0.15
    + confidence * 0.05
  );
  const decision = gate(universe, score, confidence, safety);

  return {
    updated_at: "2026/05/25",
    ticker: action.ticker,
    company: action.company,
    theme_name: action.theme_name,
    source_status: "100社母集団から試算",
    trial_nisa_score: score,
    category: decision.category,
    growth_quality_score: growthQuality,
    downside_safety_score: safety,
    valuation_score: valuation,
    medium_trend_score: mediumTrend,
    data_confidence: confidence,
    hard_gate: decision.hard_gate,
    per: universe.per_forecast,
    pbr: universe.pbr_actual,
    roe_pct: universe.roe_actual_pct,
    revenue_yoy_pct: universe.revenue_yoy_pct,
    profit_yoy_pct: universe.profit_yoy_pct,
    ret1y_pct: universe.ret1y_pct,
    max_drawdown60_pct: universe.max_drawdown60_pct,
    calculation_basis: "199_universe100_screening.csv",
    next_action: decision.hard_gate === "なし"
      ? "公式IRで数値再照合し、6月イベント後の購入可否判定へ進める"
      : "公式IRで数値再照合し、ゲート要因を解消できるか確認する",
  };
}).sort((a, b) => num(b.trial_nisa_score, -1) - num(a.trial_nisa_score, -1));

const headers = [
  "updated_at",
  "ticker",
  "company",
  "theme_name",
  "source_status",
  "trial_nisa_score",
  "category",
  "growth_quality_score",
  "downside_safety_score",
  "valuation_score",
  "medium_trend_score",
  "data_confidence",
  "hard_gate",
  "per",
  "pbr",
  "roe_pct",
  "revenue_yoy_pct",
  "profit_yoy_pct",
  "ret1y_pct",
  "max_drawdown60_pct",
  "calculation_basis",
  "next_action",
];

const output = [
  headers.join(","),
  ...outputRows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
].join("\n") + "\n";

fs.writeFileSync(path.join(root, files.output), output, "utf8");
console.log(`wrote ${files.output}: ${outputRows.length} rows`);
