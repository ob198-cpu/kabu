import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const queueFile = "p1_segment_next_gate_input_queue_20260615.csv";
const promotionFile = "p1_official_value_promotion_candidates_20260615.csv";
const auditFile = "p1_official_value_promotion_apply_audit_20260615.csv";

function p(file) {
  return path.join(ROOT, file);
}

function parseCsv(text) {
  const clean = String(text ?? "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let quote = false;
  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];
    const next = clean[i + 1];
    if (quote) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quote = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') quote = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  const cleanRows = rows.filter((values) => values.some((value) => String(value ?? "").trim() !== ""));
  const headers = cleanRows.shift() ?? [];
  return {
    headers,
    rows: cleanRows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))),
  };
}

function readCsv(file) {
  return parseCsv(fs.readFileSync(p(file), "utf8"));
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, rows, headers) {
  const cols = headers ?? Object.keys(rows[0] ?? { empty: "" });
  const body = [cols.join(","), ...rows.map((row) => cols.map((col) => csvCell(row[col])).join(","))].join("\n");
  fs.writeFileSync(p(file), `\uFEFF${body}\n`, "utf8");
}

const queue = readCsv(queueFile);
const promotions = readCsv(promotionFile).rows;
const promotionById = new Map(promotions.map((row) => [row["入力ID"], row]));
const auditRows = [];

const allowedItems = new Set(["ROE", "営業利益率"]);

for (const row of queue.rows) {
  const promotion = promotionById.get(row["入力ID"]);
  if (!promotion) continue;

  const item = promotion["入力項目"];
  const canApply =
    allowedItems.has(item) &&
    promotion["昇格候補判定"] === "候補化可" &&
    promotion["公式確認値"] &&
    promotion["参照URL"] &&
    promotion["参照資料"];

  auditRows.push({
    ticker: row.ticker,
    銘柄: row["銘柄"],
    入力ID: row["入力ID"],
    入力項目: row["入力項目"],
    反映可否: canApply ? "反映" : "見送り",
    反映値: canApply ? promotion["公式確認値"] : "",
    出所URL: canApply ? promotion["参照URL"] : "",
    確認位置: canApply ? promotion["参照資料"] : "",
    スコア反映: "禁止",
    P1復帰: "0社",
    買付上限: "0円",
    理由: canApply
      ? "公式PDFで値・出所・確認位置がそろったROE/営業利益率のみ入力キューへ反映。PER/PBRは対象外。"
      : "対象項目または公式確認情報が不足しているため反映しない。",
  });

  if (!canApply) continue;
  row["入力値"] = promotion["公式確認値"];
  row["出所URLまたは資料名"] = promotion["参照URL"];
  row["ページまたは取得日時"] = promotion["参照資料"];
  row["公式確認"] = "済";
  row["スコア反映"] = "禁止";
  row["P1復帰"] = "0社";
  row["買付上限"] = "0円";
}

writeCsv(queueFile, queue.rows, queue.headers);
writeCsv(auditFile, auditRows, [
  "ticker",
  "銘柄",
  "入力ID",
  "入力項目",
  "反映可否",
  "反映値",
  "出所URL",
  "確認位置",
  "スコア反映",
  "P1復帰",
  "買付上限",
  "理由",
]);

console.log(JSON.stringify({
  queueFile,
  auditFile,
  applied: auditRows.filter((row) => row["反映可否"] === "反映").length,
  skipped: auditRows.filter((row) => row["反映可否"] !== "反映").length,
  scoreReflected: 0,
  p1Return: 0,
  buyLimit: 0,
}, null, 2));
