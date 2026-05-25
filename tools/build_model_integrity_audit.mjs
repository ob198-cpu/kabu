import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const patterns = [
  {
    id: "EVENT_ADDITIVE_SCORE",
    severity: "critical",
    regex: /event_theme_adjustment|event_adjustment_total|score_after_event|score_before_event|score_adjustment/i,
    safeRegex: /使用停止|本体点へ加算しない|旧イベント加点|old_|修正後|repaired_|監査|検出|regex/i,
    issue: "イベントを本体点へ加減算している可能性",
    action: "イベントは本体点に足さず、成立時/失敗時シナリオとして別枠に分離する",
  },
  {
    id: "EVENT_POINT_LANGUAGE",
    severity: "high",
    regex: /加点|減点|補正後スコア|イベント補正|テーマ.*加点|材料・イベント/i,
    safeRegex: /加点しない|本体点へ加算しない|点数に混ぜない|旧処理|旧式|使用停止|監査|検出|修正/i,
    issue: "イベントやテーマを点数加算に見せる表現",
    action: "検証トリガー、シナリオ、反映前確認に表現を変更する",
  },
  {
    id: "PURCHASE_OVERCLAIM",
    severity: "high",
    regex: /購入候補スコア|購入可否|購入候補|買い候補|買う/i,
    safeRegex: /購入候補ではなく|購入候補にしない|購入確定ではなく|購入判断ではなく|買い推奨ではなく|買い候補ではない|買い候補とは言わない|正式な買い候補ではない|買付判断を出さない|買うためではなく|価格データのみ.*未反映|実売買前|検証候補|監査|検出/i,
    issue: "検証候補を購入判断に近く見せる表現",
    action: "購入確定ではなく検証候補、購入検討前チェックへ修正する",
  },
  {
    id: "PASS_OVERCLAIM",
    severity: "medium",
    regex: /数値ゲート通過候補|通過候補|合格/i,
    safeRegex: /監査|検出|通過候補ではなく|旧/i,
    issue: "検証段階なのに通過・合格と強く見える表現",
    action: "追加検証に進める候補、照合待ち候補など弱い表現へ変更する",
  },
];

const includeExtensions = new Set([".csv", ".html", ".md", ".mjs"]);
const skipDirs = new Set([".git", "node_modules"]);
const skipFiles = new Set([
  "260_model_integrity_audit.csv",
  "261_event_score_repair_plan.csv",
  "262_event_scenario_model.csv",
  "model_integrity_audit.html",
  "130_delivery_link_check.csv",
  "delivery_check_report.html",
  "tools/build_model_integrity_audit.mjs",
  "tools/build_event_score_repair.mjs",
]);

const walk = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (skipDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full));
    else if (includeExtensions.has(path.extname(entry.name).toLowerCase())) files.push(full);
  }
  return files;
};

const csvEscape = (value) => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
};

const rows = [];
for (const file of walk(root)) {
  const rel = path.relative(root, file).replaceAll("\\", "/");
  if (skipFiles.has(rel)) continue;
  const text = fs.readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const pattern of patterns) {
      if (pattern.regex.test(line)) {
        if (pattern.safeRegex && pattern.safeRegex.test(line)) continue;
        rows.push({
          checked_at: "2026/05/25",
          severity: pattern.severity,
          rule_id: pattern.id,
          file: rel,
          line: index + 1,
          issue: pattern.issue,
          matched_text: line.trim().slice(0, 240),
          required_action: pattern.action,
          status: "要修正/要確認",
        });
      }
    }
  });
}

rows.sort((a, b) => {
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  return (order[a.severity] ?? 9) - (order[b.severity] ?? 9)
    || a.file.localeCompare(b.file)
    || a.line - b.line;
});

const headers = [
  "checked_at",
  "severity",
  "rule_id",
  "file",
  "line",
  "issue",
  "matched_text",
  "required_action",
  "status",
];

const output = [
  headers.join(","),
  ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
].join("\n") + "\n";

fs.writeFileSync(path.join(root, "260_model_integrity_audit.csv"), output, "utf8");
console.log(`wrote 260_model_integrity_audit.csv: ${rows.length} findings`);
