import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date());

const TOTAL_CAPITAL = 2_400_000;

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

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

const eventRows = readCsv("102_june_event_result_input.csv");
const engineRows = readCsv("106_june_event_engine_output.csv");
const allocationRows = readCsv("108_capital_allocation_by_ticker.csv");
const scenarioRows = readCsv("109_capital_scenario_plan.csv");

const counts = {
  pending: eventRows.filter((row) => row.current_status === "未入力").length,
  attention: eventRows.filter((row) => row.current_status === "注意").length,
  bad: eventRows.filter((row) => row.current_status === "悪化").length,
  pass: eventRows.filter((row) => row.current_status === "通過").length,
};

const scenario = counts.bad > 0
  ? {
      name: "赤: 悪化イベントあり",
      action: "新規購入停止。監視と記録のみ。",
      initialYen: 0,
      className: "bad",
      short: "停止",
    }
  : counts.pending > 0
    ? {
        name: "未入力あり",
        action: "イベント実数が不足しているため、注文金額を確定しない。",
        initialYen: 0,
        className: "pending",
        short: "未確定",
      }
    : counts.attention > 0
      ? {
          name: "黄: 注意あり",
          action: "初回15%上限。高PER・高ボラ・半導体偏重は小さくする。",
          initialYen: 360_000,
          className: "warn",
          short: "慎重",
        }
      : {
          name: "緑: 全イベント確認後",
          action: "初回35%上限。中心候補を厚め、条件付き候補を小比率。",
          initialYen: 840_000,
          className: "ok",
          short: "候補比較へ",
        };

const flowRows = [
  {
    step: "1",
    name: "イベント実数を入力",
    file: "912_june_event_actual_input_sheet_20260606.html",
    output: "判定用CSV",
    purpose: "CPI、日銀、FOMC、最終購入前確認を、未入力・通過・注意・悪化に分ける。",
  },
  {
    step: "2",
    name: "正本CSVへ反映",
    file: "102_june_event_result_input.csv",
    output: "イベント結果の正本",
    purpose: "以後の画面と判定は、このCSVを根拠にする。未入力や仮説を点数に混ぜない。",
  },
  {
    step: "3",
    name: "銘柄別判定へ反映",
    file: "106_june_event_engine_output.csv / june_event_gate_engine.html",
    output: "保留・確認・買い可・停止",
    purpose: "各銘柄がイベント悪化の影響を受けるかを確認する。",
  },
  {
    step: "4",
    name: "資金配分へ反映",
    file: "108_capital_allocation_by_ticker.csv / 109_capital_scenario_plan.csv",
    output: "初回投入上限",
    purpose: "緑なら84万円上限、黄なら36万円上限、赤または未入力なら0円にする。",
  },
  {
    step: "5",
    name: "当日運用ボードで確認",
    file: "post_0618_operation_board_20260613.html",
    output: "今日の結論",
    purpose: "買う前に、止める条件、候補10社、NISA本人操作、証券会社画面をまとめて確認する。",
  },
];

const currentEventRows = eventRows.map((row) => ({
  id: row.event_id,
  date: row.planned_date,
  event: row.event,
  status: row.current_status,
  actual: row.actual_value || "未入力",
  reaction: row.market_reaction || "未入力",
  action: row.action_if_fail,
}));

const currentAllocationRows = allocationRows.map((row) => ({
  ticker: row.ticker,
  name: row.name,
  role: row.role,
  signal: row.market_signal,
  current: Number(row.current_allocation_yen || 0).toLocaleString("ja-JP") + "円",
  green: Number(row.all_pass_allocation_yen || 0).toLocaleString("ja-JP") + "円",
  yellow: Number(row.attention_allocation_yen || 0).toLocaleString("ja-JP") + "円",
  red: Number(row.bad_event_allocation_yen || 0).toLocaleString("ja-JP") + "円",
  condition: row.condition_to_use,
}));

const mappingRows = [
  {
    source: "102_june_event_result_input.csv",
    target: "106_june_event_engine_output.csv",
    rule: "イベント状態が未入力なら全銘柄の購入判断を保留。悪化なら新規購入停止。",
    result: "候補10社の現時点扱いを作る。",
  },
  {
    source: "106_june_event_engine_output.csv",
    target: "june_event_gate_engine.html",
    rule: "銘柄ごとのリスクタグ、イベント感応度、停止条件を表示。",
    result: "なぜ買い可・確認・保留なのかを画面で確認する。",
  },
  {
    source: "102_june_event_result_input.csv",
    target: "108_capital_allocation_by_ticker.csv",
    rule: "緑・黄・赤・未入力に応じて初回投入額を切り替える。",
    result: "銘柄ごとの投入上限を作る。",
  },
  {
    source: "108/109 CSV",
    target: "capital_allocation_plan.html",
    rule: "全体上限と銘柄別上限を表示。",
    result: "240万円のうち、いくらまで入れるかを確認する。",
  },
  {
    source: "102/106/108/109 CSV",
    target: "post_0618_operation_board_20260613.html",
    rule: "イベント・候補・資金配分を1画面へ集約。",
    result: "18日以降に見る最終実務画面にする。",
  },
];

writeCsv(
  "post_0618_event_reflection_workflow_20260613.csv",
  ["section", "item", "source", "target", "rule", "result"],
  [
    {
      section: "summary",
      item: "current_scenario",
      source: "102_june_event_result_input.csv",
      target: "post_0618_operation_board_20260613.html",
      rule: `${counts.pending}件未入力 / ${counts.attention}件注意 / ${counts.bad}件悪化 / ${counts.pass}件通過`,
      result: `${scenario.name}: ${scenario.action}`,
    },
    ...mappingRows.map((row, index) => ({
      section: "mapping",
      item: `M${index + 1}`,
      ...row,
    })),
  ],
);

const table = (headers, rows, widths = {}) => `
  <div class="table-wrap">
    <table>
      <thead><tr>${headers.map((header) => `<th style="${widths[header] ? `width:${widths[header]}` : ""}">${esc(header)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${esc(row[header])}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
  </div>`;

const scenarioTextRows = scenarioRows.map((row) => ({
  scenario: row.scenario,
  stock_investment_yen: Number(row.stock_investment_yen || 0).toLocaleString("ja-JP") + "円",
  cash_yen: row.cash_yen === "" ? "-" : Number(row.cash_yen || 0).toLocaleString("ja-JP") + "円",
  action: row.action,
}));

const flowCards = flowRows.map((row) => `
  <article class="flow-card">
    <b>${esc(row.step)}</b>
    <h3>${esc(row.name)}</h3>
    <p>${esc(row.purpose)}</p>
    <span>${esc(row.file)}</span>
  </article>`).join("");

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月イベント実数 反映ワークフロー</title>
  <style>
    :root {
      --ink: #001f3f;
      --muted: #34495e;
      --line: #c9d9ea;
      --soft: #eef6ff;
      --brand: #005f99;
      --warn: #b46a00;
      --bad: #b42318;
      --ok: #147a3d;
      --pending: #4b5563;
      --paper: #ffffff;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: #f4f8fc;
      color: var(--ink);
      font-family: "Yu Gothic", "Meiryo", system-ui, sans-serif;
      font-size: 17px;
      line-height: 1.75;
    }
    header {
      background: linear-gradient(135deg, #073763, #005f99);
      color: #fff;
      padding: 28px clamp(18px, 4vw, 54px);
    }
    header h1 { margin: 0 0 10px; font-size: clamp(28px, 4vw, 42px); letter-spacing: 0; }
    header p { margin: 0; max-width: 1180px; }
    main { max-width: 1500px; margin: 0 auto; padding: 24px; }
    .nav {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
      gap: 10px;
      margin: 0 0 18px;
    }
    .nav a {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 48px;
      padding: 10px 16px;
      border: 1px solid #78aad0;
      border-radius: 8px;
      background: #fff;
      color: #004b7a;
      font-weight: 700;
      text-decoration: none;
    }
    section {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 18px;
      margin-bottom: 18px;
      box-shadow: 0 8px 24px rgba(0, 31, 63, 0.06);
      break-inside: avoid;
    }
    h2 { margin: 0 0 12px; border-left: 8px solid var(--brand); padding-left: 12px; color: var(--ink); font-size: 25px; }
    .decision {
      border-left: 9px solid var(--pending);
      background: #f8fafc;
      border-radius: 10px;
      padding: 16px;
      font-weight: 800;
      font-size: 19px;
    }
    .decision.ok { border-color: var(--ok); background: #effaf5; }
    .decision.warn { border-color: var(--warn); background: #fff7e7; }
    .decision.bad { border-color: var(--bad); background: #fff1f1; }
    .decision.pending { border-color: var(--pending); background: #f3f4f6; }
    .metrics {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 12px;
      margin-top: 14px;
    }
    .metric {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: var(--soft);
      padding: 14px;
    }
    .metric b { display: block; font-size: 28px; line-height: 1.2; }
    .metric span { display: block; color: var(--muted); font-weight: 700; }
    .flow {
      display: grid;
      grid-template-columns: repeat(5, minmax(0, 1fr));
      gap: 12px;
    }
    .flow-card {
      border: 1px solid var(--line);
      border-radius: 10px;
      background: #fbfdff;
      padding: 14px;
    }
    .flow-card b {
      display: inline-flex;
      width: 34px;
      height: 34px;
      border-radius: 50%;
      align-items: center;
      justify-content: center;
      background: var(--brand);
      color: #fff;
      margin-bottom: 8px;
    }
    .flow-card h3 { margin: 0 0 8px; font-size: 18px; color: var(--ink); }
    .flow-card p { margin: 0 0 8px; font-size: 15px; }
    .flow-card span { display: block; color: var(--muted); font-size: 13px; font-weight: 700; }
    .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; min-width: 1000px; }
    th, td { border: 1px solid var(--line); padding: 10px; vertical-align: top; word-break: break-word; }
    th { background: #e5f1fb; text-align: left; font-size: 15px; }
    .note {
      border-left: 7px solid var(--warn);
      background: #fff7e7;
      border-radius: 10px;
      padding: 12px 14px;
      font-weight: 800;
    }
    @media (max-width: 1000px) {
      main { padding: 14px; }
      .flow { grid-template-columns: 1fr; }
      table { min-width: 900px; }
    }
    @media print {
      body { background: #fff; font-size: 13px; }
      header { padding: 16px 22px; }
      main { max-width: none; padding: 12px; }
      .nav { display: none; }
      section { box-shadow: none; break-inside: avoid; }
      tr { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <header>
    <h1>6月イベント実数 反映ワークフロー</h1>
    <p>イベント実数を入れた後、候補10社の扱い・初回投入上限・当日運用ボードへどう反映されるかを確認する実務ページです。</p>
  </header>
  <main>
    <nav class="nav" aria-label="関連ページ">
      <a href="896_practical_entry_hub_20260606.html">実用パート入口</a>
      <a href="912_june_event_actual_input_sheet_20260606.html">6月イベント実数入力</a>
      <a href="june_event_gate_engine.html">銘柄別イベント判定</a>
      <a href="capital_allocation_plan.html">資金配分プラン</a>
      <a href="post_0618_operation_board_20260613.html">当日運用ボード</a>
    </nav>

    <section>
      <h2>現在の反映結果</h2>
      <div class="decision ${esc(scenario.className)}">
        ${esc(scenario.name)}。${esc(scenario.action)}
      </div>
      <div class="metrics">
        <div class="metric"><b>${counts.pending}</b><span>未入力イベント</span></div>
        <div class="metric"><b>${counts.attention}</b><span>注意イベント</span></div>
        <div class="metric"><b>${counts.bad}</b><span>悪化イベント</span></div>
        <div class="metric"><b>${scenario.initialYen.toLocaleString("ja-JP")}円</b><span>現時点の初回投入上限</span></div>
      </div>
    </section>

    <section>
      <h2>反映の流れ</h2>
      <div class="flow">${flowCards}</div>
    </section>

    <section>
      <h2>イベント入力の状態</h2>
      ${table(["id", "date", "event", "status", "actual", "reaction", "action"], currentEventRows, { id: "80px", date: "145px", status: "90px" })}
    </section>

    <section>
      <h2>資金配分への反映</h2>
      ${table(["scenario", "stock_investment_yen", "cash_yen", "action"], scenarioTextRows, { scenario: "190px", stock_investment_yen: "150px", cash_yen: "150px" })}
    </section>

    <section>
      <h2>銘柄別の投入上限</h2>
      ${table(["ticker", "name", "role", "signal", "current", "green", "yellow", "red", "condition"], currentAllocationRows, { ticker: "95px", role: "120px", current: "95px", green: "95px", yellow: "95px", red: "80px" })}
    </section>

    <section>
      <h2>CSVと画面の対応</h2>
      ${table(["source", "target", "rule", "result"], mappingRows, { source: "210px", target: "240px" })}
      <p class="note">ブラウザ上の入力だけでは、GitHub上のCSVは自動保存されません。判定用CSVを出力し、正本CSVへ反映してから再生成する運用にします。</p>
    </section>

    <section>
      <h2>18日以降の操作順</h2>
      <ol>
        <li>日銀・FOMC・最終購入前確認の実数を入力する。</li>
        <li>状態を「通過」「注意」「悪化」のいずれかにする。未入力のまま買付金額を確定しない。</li>
        <li>判定用CSVを作成し、102の正本CSVへ反映する。</li>
        <li>銘柄別判定、資金配分、当日運用ボードを再確認する。</li>
        <li>本人操作、NISA口座区分、証券会社画面、買わない条件を確認する。</li>
        <li>条件がそろった場合のみ、本人別注文票へ進む。</li>
      </ol>
    </section>
  </main>
  <!-- generated: ${esc(generatedAt)} / total capital: ${TOTAL_CAPITAL} -->
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "post_0618_event_reflection_workflow_20260613.html"), html, "utf8");

console.log("generated post_0618_event_reflection_workflow_20260613.html");
console.log("generated post_0618_event_reflection_workflow_20260613.csv");
