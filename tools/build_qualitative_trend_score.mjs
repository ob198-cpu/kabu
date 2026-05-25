import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const files = {
  events: "252_qualitative_event_sample_queue.csv",
  matches: "253_qualitative_candidate_match.csv",
  rules: "251_qualitative_theme_rules.csv",
  chain: "255_qualitative_theme_chain_scores.csv",
  output: "254_qualitative_trend_exploration_score.csv",
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

const number = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const events = parseCsv(read(files.events));
const matches = parseCsv(read(files.matches));
const rules = parseCsv(read(files.rules));
const chains = parseCsv(read(files.chain));

const eventByTheme = new Map();
for (const event of events) {
  const current = eventByTheme.get(event.theme_id);
  if (!current || event.observed_date >= current.observed_date) {
    eventByTheme.set(event.theme_id, event);
  }
}

const chainByTheme = new Map(chains.map((row) => [row.theme_id, row]));
const ruleByTheme = new Map(rules.map((row) => [row.theme_id, row]));

const rows = matches.map((match) => {
  const event = eventByTheme.get(match.theme_id) || {};
  const chain = chainByTheme.get(match.theme_id) || {};
  const rule = ruleByTheme.get(match.theme_id) || {};
  const material = number(event.material_strength);
  const capitalChain = number(chain.capital_chain_score);
  const fit = number(match.qualitative_fit);
  const reliability = number(event.source_reliability);
  const score = (material * 0.30) + (capitalChain * 0.30) + (fit * 0.25) + (reliability * 0.15);
  return {
    theme_id: match.theme_id,
    ticker: match.ticker,
    company: match.company,
    theme_name: rule.theme_name || match.theme_id,
    material_strength: material,
    capital_chain_score: capitalChain,
    company_fit: fit,
    source_reliability: reliability,
    qualitative_score: Math.round(score * 10) / 10,
    score_formula: "材料強度30%+資金流入連鎖30%+企業適合25%+証拠信頼度15%",
    purchase_score_status: "購入スコアではない",
    next_gate: match.numeric_needed,
  };
}).sort((a, b) => b.qualitative_score - a.qualitative_score);

const headers = [
  "rank",
  "theme_id",
  "ticker",
  "company",
  "theme_name",
  "material_strength",
  "capital_chain_score",
  "company_fit",
  "source_reliability",
  "qualitative_score",
  "score_formula",
  "purchase_score_status",
  "next_gate",
];

const output = [
  headers.join(","),
  ...rows.map((row, index) => headers.map((header) => csvEscape(header === "rank" ? index + 1 : row[header])).join(",")),
].join("\n") + "\n";

fs.writeFileSync(path.join(root, files.output), output, "utf8");
console.log(`wrote ${files.output}: ${rows.length} rows`);
