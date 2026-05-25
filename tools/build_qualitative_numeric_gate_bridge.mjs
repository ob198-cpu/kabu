import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const files = {
  qualitative: "254_qualitative_trend_exploration_score.csv",
  nisa: "245_nisa_1year_hold_score_top20.csv",
  universe: "209_meaningful_universe_v2.csv",
  output: "256_qualitative_numeric_gate_bridge.csv",
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

const num = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const qualitativeRows = parseCsv(read(files.qualitative));
const nisaRows = parseCsv(read(files.nisa));
const universeRows = parseCsv(read(files.universe));

const nisaByTicker = new Map(nisaRows.map((row) => [row.ticker, row]));
const universeByTicker = new Map(universeRows.map((row) => [row.ticker, row]));

const judge = (q, nisa, universe) => {
  if (nisa) {
    const confidence = num(nisa.data_confidence) ?? 0;
    const hardGate = nisa.hard_gate || "";
    if (nisa.category === "残す" && confidence >= 70 && hardGate === "なし") {
      return {
        status: "数値ゲート通過候補",
        reason: "時流探索スコアに加え、NISA 1年保有スコアでも残す判定。購入確定ではなく6月イベント後に再判定。",
        nextAction: nisa.next_check || "6月イベント後に購入可否を再判定",
      };
    }
    return {
      status: "数値確認中",
      reason: `NISA 1年保有スコアは接続済み。ただし分類=${nisa.category || "-"}、ゲート=${hardGate || "-"}。`,
      nextAction: nisa.next_check || "不足データ、過熱、決算後反応、下落耐性を確認",
    };
  }
  if (universe) {
    return {
      status: "母集団内・NISA点未計算",
      reason: `100社母集団には存在。現在の位置づけ=${universe.usefulness_level || "-"}、株価=${universe.quote_status || "-"}、業績=${universe.performance_status || "-"}。`,
      nextAction: "NISA 1年保有スコアへ接続し、PER/PBR/ROE・決算反応・下落耐性を計算",
    };
  }
  return {
    status: "母集団外・追加登録候補",
    reason: "時流テーマには合うが、現在の100社母集団またはNISA点計算表に未接続。",
    nextAction: "母集団へ追加するかを判断し、株価・財務・決算反応の取得から開始",
  };
};

const outputRows = qualitativeRows.map((q, index) => {
  const nisa = nisaByTicker.get(q.ticker);
  const universe = universeByTicker.get(q.ticker);
  const decision = judge(q, nisa, universe);
  return {
    rank: index + 1,
    ticker: q.ticker,
    company: q.company,
    theme_id: q.theme_id,
    theme_name: q.theme_name,
    qualitative_score: q.qualitative_score,
    nisa_connected: nisa ? "接続済み" : "未接続",
    nisa_score: nisa?.nisa_score || "",
    nisa_category: nisa?.category || "",
    data_confidence: nisa?.data_confidence || "",
    hard_gate: nisa?.hard_gate || "",
    universe_level: universe?.usefulness_level || "",
    quote_status: universe?.quote_status || "",
    performance_status: universe?.performance_status || "",
    chart_status: universe?.chart_status || "",
    bridge_status: decision.status,
    bridge_reason: decision.reason,
    next_action: decision.nextAction,
  };
});

const headers = [
  "rank",
  "ticker",
  "company",
  "theme_id",
  "theme_name",
  "qualitative_score",
  "nisa_connected",
  "nisa_score",
  "nisa_category",
  "data_confidence",
  "hard_gate",
  "universe_level",
  "quote_status",
  "performance_status",
  "chart_status",
  "bridge_status",
  "bridge_reason",
  "next_action",
];

const output = [
  headers.join(","),
  ...outputRows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
].join("\n") + "\n";

fs.writeFileSync(path.join(root, files.output), output, "utf8");
console.log(`wrote ${files.output}: ${outputRows.length} rows`);
