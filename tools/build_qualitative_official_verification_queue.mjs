import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const inputFile = "258_qualitative_nisa_connection_trial.csv";
const outputFile = "259_qualitative_official_verification_queue.csv";

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
  return Number.isFinite(parsed) ? parsed : null;
};

const officialSourceHint = (ticker) => ({
  "8035.T": "東京エレクトロン IR 決算短信・決算説明資料",
  "7011.T": "三菱重工 IR 決算短信・決算説明資料",
  "6146.T": "ディスコ IR 決算短信・決算説明資料",
  "8306.T": "三菱UFJ FG IR 決算短信・決算説明資料",
  "8316.T": "三井住友FG IR 決算短信・決算説明資料",
  "6501.T": "日立製作所 IR 決算短信・決算説明資料",
  "6503.T": "三菱電機 IR 決算短信・決算説明資料",
  "4063.T": "信越化学工業 IR 決算短信・決算説明資料",
  "2802.T": "味の素 IR 決算短信・決算説明資料",
  "5020.T": "ENEOS IR 決算短信・決算説明資料",
}[ticker] || "企業IR 決算短信・決算説明資料");

const requiredMetrics = [
  {
    metric_group: "業績",
    metric_name: "売上成長率",
    field: "revenue_yoy_pct",
    source_type: "公式IR",
    reason: "成長スコアの入力値。売上だけでなく数量・価格転嫁・セグメント要因も確認する。",
  },
  {
    metric_group: "業績",
    metric_name: "利益成長率",
    field: "profit_yoy_pct",
    source_type: "公式IR",
    reason: "成長スコアの重要入力値。営業利益または経常利益のどちらを使ったかを明記する。",
  },
  {
    metric_group: "企業の質",
    metric_name: "ROE",
    field: "roe_pct",
    source_type: "公式IR/有報",
    reason: "企業の質・資本効率確認。金融業は一般事業会社と比較しない。",
  },
  {
    metric_group: "割安/過熱",
    metric_name: "PER",
    field: "per",
    source_type: "株価データ/予想EPS",
    reason: "割安・過熱ゲート。予想EPSの出所を確認する。",
  },
  {
    metric_group: "割安/過熱",
    metric_name: "PBR",
    field: "pbr",
    source_type: "株価データ/BPS",
    reason: "高評価リスク確認。半導体・成長株では高PBRでも理由を確認する。",
  },
  {
    metric_group: "下落耐性",
    metric_name: "1年騰落率",
    field: "ret1y_pct",
    source_type: "株価時系列",
    reason: "過熱ゲート。上がりすぎている場合は押し目確認へ回す。",
  },
  {
    metric_group: "下落耐性",
    metric_name: "60日最大下落率",
    field: "max_drawdown60_pct",
    source_type: "株価時系列",
    reason: "急落耐性の確認。-30%以下は原則保留。",
  },
  {
    metric_group: "テーマ妥当性",
    metric_name: "テーマが売上・受注に効く証拠",
    field: "theme_evidence",
    source_type: "公式IR/決算説明資料",
    reason: "ニュース連想だけでなく、会社の売上・受注・利益にどう効くか確認する。",
  },
];

const trialRows = parseCsv(read(inputFile));
const outputRows = [];

for (const row of trialRows) {
  const score = number(row.trial_nisa_score);
  const category = row.category || "";
  const hardGate = row.hard_gate || "";
  const basePriority = category.includes("残す") ? "S" : score !== null && score >= 60 ? "A" : "B";

  for (const metric of requiredMetrics) {
    const currentValue = row[metric.field] || "";
    let status = currentValue ? "要照合" : "未入力";
    if (metric.field === "theme_evidence") status = "要確認";
    const priority = hardGate === "なし" && metric.field !== "theme_evidence" ? basePriority : basePriority;
    outputRows.push({
      priority,
      ticker: row.ticker,
      company: row.company,
      theme_name: row.theme_name,
      trial_nisa_score: row.trial_nisa_score,
      current_category: category,
      metric_group: metric.metric_group,
      metric_name: metric.metric_name,
      field: metric.field,
      current_value: currentValue,
      source_type: metric.source_type,
      source_hint: officialSourceHint(row.ticker),
      verification_status: status,
      reflect_status: "未反映",
      stop_reason: "公式IR・決算短信との照合前",
      reason: metric.reason,
      hard_gate: hardGate,
    });
  }
}

const order = { S: 0, A: 1, B: 2, C: 3 };
outputRows.sort((a, b) => (order[a.priority] ?? 9) - (order[b.priority] ?? 9)
  || (number(b.trial_nisa_score) ?? -1) - (number(a.trial_nisa_score) ?? -1));

const headers = [
  "queue_rank",
  "priority",
  "ticker",
  "company",
  "theme_name",
  "trial_nisa_score",
  "current_category",
  "metric_group",
  "metric_name",
  "field",
  "current_value",
  "source_type",
  "source_hint",
  "verification_status",
  "reflect_status",
  "stop_reason",
  "reason",
  "hard_gate",
];

const output = [
  headers.join(","),
  ...outputRows.map((row, index) => headers.map((header) => csvEscape(header === "queue_rank" ? index + 1 : row[header])).join(",")),
].join("\n") + "\n";

fs.writeFileSync(path.join(root, outputFile), output, "utf8");
console.log(`wrote ${outputFile}: ${outputRows.length} rows`);
