import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TOTAL_CAPITAL = 2_400_000;
const LIMITS = {
  allPass: 840_000,
  attention: 360_000,
  stopped: 0,
};

const generatedAt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date());

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const clean = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    const next = clean[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
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
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  const [headers, ...body] = rows.filter((line) => line.some((value) => value !== ""));
  return body.map((line) => Object.fromEntries(headers.map((header, index) => [header, line[index] ?? ""])));
}

function readCsv(file) {
  return parseCsv(fs.readFileSync(path.join(ROOT, file), "utf8"));
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, headers, rows) {
  const text = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ].join("\n");
  fs.writeFileSync(path.join(ROOT, file), `\uFEFF${text}\n`, "utf8");
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function table(headers, rows, options = {}) {
  const widths = options.widths ?? {};
  return `<div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th style="${widths[header] ? `width:${widths[header]}` : ""}">${esc(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${esc(row[header])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

const events = readCsv("102_june_event_result_input.csv");
const candidates = readCsv("105_june_event_candidate_matrix.csv");
const allowed = new Set(["未入力", "通過", "注意", "悪化"]);
const invalid = events.filter((row) => !allowed.has(row.current_status));
const counts = {
  pending: events.filter((row) => row.current_status === "未入力").length,
  attention: events.filter((row) => row.current_status === "注意").length,
  bad: events.filter((row) => row.current_status === "悪化").length,
  pass: events.filter((row) => row.current_status === "通過").length,
};

const scenario = (() => {
  if (invalid.length > 0) {
    return {
      key: "CSV不備",
      budget: 0,
      signal: "停止",
      action: "ステータス値を修正してから再計算する。",
      reason: "未入力・通過・注意・悪化以外の値があります。",
    };
  }
  if (counts.bad > 0) {
    return {
      key: "赤: 悪化",
      budget: LIMITS.stopped,
      signal: "停止",
      action: "新規購入停止。監視と記録のみ。",
      reason: "悪化イベントがあります。",
    };
  }
  if (counts.pending > 0) {
    return {
      key: "未入力あり",
      budget: LIMITS.stopped,
      signal: "停止",
      action: "未入力イベントが埋まるまで購入金額を確定しない。",
      reason: "日銀、FOMC、最終確認などの未入力が残っています。",
    };
  }
  if (counts.attention > 0) {
    return {
      key: "黄: 注意あり",
      budget: LIMITS.attention,
      signal: "注意",
      action: "初回15%上限。高PER・高ボラ・半導体候補は小比率または保留。",
      reason: "注意イベントがあります。",
    };
  }
  return {
    key: "緑: 全イベント確認後",
    budget: LIMITS.allPass,
    signal: "通過",
    action: "初回35%上限。中心候補を厚め、条件付き候補を小比率。",
    reason: "E01からE04が通過です。",
  };
})();

function currentSignal(row) {
  const tags = row.tags ?? "";
  if (scenario.signal === "停止") return "保留";
  if (scenario.signal === "注意") {
    if (tags.includes("高PER") || tags.includes("高ボラ") || tags.includes("半導体")) return "保留";
    return row.role === "中心候補" ? "確認" : "確認";
  }
  return row.role === "中心候補" ? "買い可" : "確認";
}

function engineStatus(signal) {
  if (scenario.signal === "停止") return scenario.key === "CSV不備" ? "CSV修正待ち" : "購入判断前";
  if (signal === "保留") return "保留";
  if (signal === "買い可") return "買い可";
  return "確認";
}

function reasonFor(row, signal) {
  if (scenario.signal === "停止") return `${scenario.reason} ${row.name}は候補として維持するが、現時点の注文金額は0円。`;
  if (signal === "保留") return `${scenario.reason} ${row.tags} の感応度が高いため、イベント後反応を追加確認。`;
  if (signal === "確認") return `${scenario.reason} ${row.reason} ただし証券会社画面、本人操作、NISA口座区分を確認。`;
  return `${row.reason} 市場イベントが通過した場合のみ、初回上限内で検討。`;
}

const engineRows = candidates.map((row) => {
  const weight = Number(row.target_weight_pct || 0);
  const allocation = Math.round(scenario.budget * weight / 100);
  const signal = currentSignal(row);
  return {
    updated_at: generatedAt,
    ticker: row.ticker,
    name: row.name,
    channel: row.channel,
    role: row.role,
    market_signal: signal,
    one_day_change_pct: "",
    event_status: scenario.key,
    engine_status_now: engineStatus(signal),
    prebuy_gate: scenario.action,
    reference_score: row.score,
    data_coverage_points: "イベント結果CSV反映",
    risk_tags: row.tags,
    current_allocation_yen: allocation,
    reason: reasonFor(row, signal),
    stop_condition: row.stop_condition,
  };
});

const allocationRows = candidates.map((row) => {
  const weight = Number(row.target_weight_pct || 0);
  return {
    updated_at: generatedAt,
    ticker: row.ticker,
    name: row.name,
    role: row.role,
    target_weight_pct: row.target_weight_pct,
    market_signal: currentSignal(row),
    current_allocation_yen: Math.round(scenario.budget * weight / 100),
    current_cash_yen: TOTAL_CAPITAL - scenario.budget,
    all_pass_allocation_yen: Math.round(LIMITS.allPass * weight / 100),
    attention_allocation_yen: Math.round(LIMITS.attention * weight / 100),
    bad_event_allocation_yen: 0,
    max_position_note: "全イベント確認後のみ初回35%上限。注意時は15%上限。赤判定または未入力時は0円。",
    condition_to_use: "E01からE04、本人操作、NISA口座区分、証券会社画面確認",
  };
});

const scenarioRows = [
  { updated_at: generatedAt, scenario: "現在", stock_investment_yen: scenario.budget, cash_yen: TOTAL_CAPITAL - scenario.budget, action: scenario.action },
  { updated_at: generatedAt, scenario: "緑: 全イベント確認後", stock_investment_yen: LIMITS.allPass, cash_yen: TOTAL_CAPITAL - LIMITS.allPass, action: "初回35%上限。中心候補を厚め、条件付き候補を小比率。" },
  { updated_at: generatedAt, scenario: "黄: 注意あり", stock_investment_yen: LIMITS.attention, cash_yen: TOTAL_CAPITAL - LIMITS.attention, action: "初回15%上限。半導体・高PER・高ボラは保留または小比率。" },
  { updated_at: generatedAt, scenario: "赤: 悪化", stock_investment_yen: 0, cash_yen: TOTAL_CAPITAL, action: "新規購入停止。監視と記録のみ。" },
  { updated_at: generatedAt, scenario: "第2回", stock_investment_yen: 480000, cash_yen: "", action: "初回後の実績、指数比較、決算後反応を確認して追加上限20%。" },
  { updated_at: generatedAt, scenario: "第3回", stock_investment_yen: 360000, cash_yen: "", action: "さらに確認後の追加上限15%。最低30%は現金待機。" },
];

writeCsv(
  "106_june_event_engine_output.csv",
  ["updated_at", "ticker", "name", "channel", "role", "market_signal", "one_day_change_pct", "event_status", "engine_status_now", "prebuy_gate", "reference_score", "data_coverage_points", "risk_tags", "current_allocation_yen", "reason", "stop_condition"],
  engineRows,
);
writeCsv(
  "108_capital_allocation_by_ticker.csv",
  ["updated_at", "ticker", "name", "role", "target_weight_pct", "market_signal", "current_allocation_yen", "current_cash_yen", "all_pass_allocation_yen", "attention_allocation_yen", "bad_event_allocation_yen", "max_position_note", "condition_to_use"],
  allocationRows,
);
writeCsv(
  "109_capital_scenario_plan.csv",
  ["updated_at", "scenario", "stock_investment_yen", "cash_yen", "action"],
  scenarioRows,
);

const allocationView = allocationRows.map((row) => ({
  "銘柄": `${row.ticker} ${row.name}`,
  "役割": row.role,
  "目標比率": `${row.target_weight_pct}%`,
  "現時点扱い": row.market_signal,
  "現在の投入上限": `${Number(row.current_allocation_yen).toLocaleString("ja-JP")}円`,
  "通過時上限": `${Number(row.all_pass_allocation_yen).toLocaleString("ja-JP")}円`,
  "注意時上限": `${Number(row.attention_allocation_yen).toLocaleString("ja-JP")}円`,
  "使用条件": row.condition_to_use,
}));

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>240万円 資金配分ゲート</title>
  <style>
    :root { --ink:#061a2f; --blue:#0b4b78; --line:#c7d9ea; --soft:#f4f8fc; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:"Yu Gothic","Meiryo",Arial,sans-serif; color:var(--ink); background:#edf4fa; font-size:18px; line-height:1.75; }
    header { background:#0d3f66; color:#fff; padding:30px 42px; }
    h1 { margin:0 0 8px; font-size:34px; }
    main { max-width:1220px; margin:0 auto; padding:28px 24px 56px; }
    section { background:#fff; border:1px solid var(--line); border-radius:10px; padding:24px; margin:0 0 22px; }
    h2 { margin:0 0 14px; font-size:25px; border-left:8px solid var(--blue); padding-left:12px; }
    .summary { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .card { border:1px solid var(--line); border-radius:10px; background:var(--soft); padding:15px; }
    .card b { display:block; font-size:16px; }
    .card strong { display:block; font-size:26px; }
    .links { display:flex; flex-wrap:wrap; gap:10px; margin-top:16px; }
    .links a { color:#06436d; text-decoration:none; font-weight:700; border:1px solid #78acd2; border-radius:9px; padding:9px 14px; background:#fff; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { border-collapse:collapse; width:100%; min-width:980px; background:#fff; }
    th,td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:11px 12px; text-align:left; vertical-align:top; overflow-wrap:anywhere; }
    th { background:#e2f0fb; font-weight:800; }
    tr:last-child td { border-bottom:0; }
    th:last-child,td:last-child { border-right:0; }
    @media (max-width:860px){ body{font-size:16px;} header{padding:24px 20px;} main{padding:18px 12px 40px;} .summary{grid-template-columns:1fr;} }
  </style>
</head>
<body>
<header>
  <h1>240万円 資金配分ゲート</h1>
  <p>102_june_event_result_input.csv の状態をもとに、現時点の初回投入上限と銘柄別上限を再計算したページです。</p>
</header>
<main>
  <section>
    <h2>現在の結論</h2>
    <div class="summary">
      <div class="card"><b>イベント判定</b><strong>${esc(scenario.key)}</strong></div>
      <div class="card"><b>初回投入上限</b><strong>${Number(scenario.budget).toLocaleString("ja-JP")}円</strong></div>
      <div class="card"><b>現金待機</b><strong>${Number(TOTAL_CAPITAL - scenario.budget).toLocaleString("ja-JP")}円</strong></div>
      <div class="card"><b>更新時刻</b><strong>${esc(generatedAt)}</strong></div>
    </div>
    <p>${esc(scenario.action)}</p>
    <div class="links">
      <a href="post_0618_operation_board_20260613.html">当日運用ボード</a>
      <a href="post_0618_event_update_runbook_20260613.html">CSV反映ランブック</a>
      <a href="post_0618_event_reflection_workflow_20260613.html">反映ワークフロー</a>
      <a href="108_capital_allocation_by_ticker.csv">銘柄別CSV</a>
      <a href="109_capital_scenario_plan.csv">シナリオCSV</a>
    </div>
  </section>
  <section>
    <h2>銘柄別の投入上限</h2>
    ${table(["銘柄", "役割", "目標比率", "現時点扱い", "現在の投入上限", "通過時上限", "注意時上限", "使用条件"], allocationView, { widths: { "銘柄": "18%", "現在の投入上限": "13%" } })}
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "capital_allocation_plan.html"), html, "utf8");

console.log("updated 106_june_event_engine_output.csv");
console.log("updated 108_capital_allocation_by_ticker.csv");
console.log("updated 109_capital_scenario_plan.csv");
console.log("updated capital_allocation_plan.html");
