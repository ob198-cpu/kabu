import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const inputFile = "nisa_1year_score_preview.csv";
const outputFile = "261_event_score_repair_plan.csv";

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

const rows = parseCsv(read(inputFile)).map((row) => ({
  checked_at: "2026/05/25",
  ticker: row.ticker,
  company: row.name,
  old_preliminary_score: row.nisa_1y_score_preliminary,
  base_score_before_event: row.base_score_before_event,
  old_event_adjustment: row.event_theme_adjustment,
  event_theme_score_100: row.event_theme_score_100,
  event_theme_name: row.event_theme_name,
  old_event_decision: row.event_theme_decision,
  repaired_base_score: row.base_score_before_event,
  event_handling_after_repair: "本体点へ加算しない。イベント成立時/失敗時シナリオで別枠検証。",
  scenario_required_inputs: "発生確度、売上/利益変化率、会社感応度、継続期間、織り込み済みリスク、失敗時下落リスク",
  score_reflection_rule: "公式IR・販売数・受注・会社予想修正などで実績値になった場合のみ、通常の業績/財務/株価データとして再計算",
  status: "旧式は使用停止",
}));

const headers = [
  "checked_at",
  "ticker",
  "company",
  "old_preliminary_score",
  "base_score_before_event",
  "old_event_adjustment",
  "event_theme_score_100",
  "event_theme_name",
  "old_event_decision",
  "repaired_base_score",
  "event_handling_after_repair",
  "scenario_required_inputs",
  "score_reflection_rule",
  "status",
];

const output = [
  headers.join(","),
  ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
].join("\n") + "\n";

fs.writeFileSync(path.join(root, outputFile), output, "utf8");
console.log(`wrote ${outputFile}: ${rows.length} rows`);
