import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const inputFile = "256_qualitative_numeric_gate_bridge.csv";
const outputFile = "257_qualitative_action_queue.csv";

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

const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const classify = (row) => {
  const status = row.bridge_status || "";
  const gate = row.hard_gate || "";
  const confidence = number(row.data_confidence);
  const qualitative = number(row.qualitative_score);

  if (status === "数値ゲート通過候補") {
    return {
      priority: "S",
      priority_score: 100 + qualitative,
      task_type: "6月イベント前監視",
      task_detail: "購入確定ではなく、6月イベント後の再判定対象として日経75日線、米金利、為替、最新決算コメントを確認する。",
      blocker: "市場イベント未確認",
    };
  }

  if (status === "母集団内・NISA点未計算") {
    return {
      priority: qualitative >= 80 ? "A" : "B",
      priority_score: 80 + qualitative,
      task_type: "NISAスコア接続",
      task_detail: "既に100社母集団にあり株価・業績取得ルートもあるため、PER/PBR/ROE、決算後反応、下落耐性をNISA 1年保有スコアへ接続する。",
      blocker: "NISAスコア未計算",
    };
  }

  if (gate.includes("過熱")) {
    return {
      priority: "B",
      priority_score: 55 + qualitative,
      task_type: "過熱監視",
      task_detail: "時流には合うが短期上昇が大きい。押し目、出来高鈍化、決算後反応の改善を待ち、今すぐ購入候補にはしない。",
      blocker: gate,
    };
  }

  if (confidence > 0 && confidence < 70) {
    return {
      priority: "A",
      priority_score: 70 + qualitative,
      task_type: "信頼度補完",
      task_detail: "NISA点は接続済みだがデータ信頼度が不足。決算後反応、PER/PBR/ROE、公式IR確認を補完して再計算する。",
      blocker: gate || "データ信頼度70未満",
    };
  }

  if (status.includes("未接続")) {
    return {
      priority: "C",
      priority_score: 35 + qualitative,
      task_type: "母集団追加判断",
      task_detail: "時流テーマには合うが母集団またはスコア計算に未接続。100社母集団へ加える価値があるかを確認する。",
      blocker: "母集団または計算表に未接続",
    };
  }

  return {
    priority: "B",
    priority_score: 50 + qualitative,
    task_type: "追加確認",
    task_detail: row.next_action || "不足データとゲート条件を確認する。",
    blocker: gate || "確認事項あり",
  };
};

const rows = parseCsv(read(inputFile)).map((row) => {
  const task = classify(row);
  return {
    ...row,
    ...task,
  };
}).sort((a, b) => {
  const order = { S: 0, A: 1, B: 2, C: 3 };
  return (order[a.priority] ?? 9) - (order[b.priority] ?? 9)
    || number(b.priority_score) - number(a.priority_score);
});

const headers = [
  "queue_rank",
  "priority",
  "task_type",
  "ticker",
  "company",
  "theme_name",
  "qualitative_score",
  "nisa_score",
  "bridge_status",
  "blocker",
  "task_detail",
  "next_action",
];

const output = [
  headers.join(","),
  ...rows.map((row, index) => headers.map((header) => csvEscape(header === "queue_rank" ? index + 1 : row[header])).join(",")),
].join("\n") + "\n";

fs.writeFileSync(path.join(root, outputFile), output, "utf8");
console.log(`wrote ${outputFile}: ${rows.length} rows`);
