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
  const cleanText = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < cleanText.length; i += 1) {
    const char = cleanText[i];
    const next = cleanText[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
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

function table(headers, rows, options = {}) {
  const widths = options.widths ?? {};
  return `<div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th style="${widths[header] ? `width:${widths[header]}` : ""}">${esc(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((header) => `<td>${esc(row[header])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

const events = readCsv("102_june_event_result_input.csv");
const engine = readCsv("106_june_event_engine_output.csv");
const allocation = readCsv("108_capital_allocation_by_ticker.csv");
const scenario = readCsv("109_capital_scenario_plan.csv");
const market = JSON.parse(fs.readFileSync(path.join(ROOT, "data", "market_update.json"), "utf8"));

const pendingEvents = events.filter((row) => row.current_status === "未入力");
const attentionEvents = events.filter((row) => row.current_status === "注意");
const holdRows = engine.filter((row) => row.engine_status_now === "保留");
const confirmRows = engine.filter((row) => row.market_signal === "確認");
const greenScenario = scenario.find((row) => row.scenario.startsWith("緑")) ?? {};
const yellowScenario = scenario.find((row) => row.scenario.startsWith("黄")) ?? {};
const redScenario = scenario.find((row) => row.scenario.startsWith("赤")) ?? {};

const boardStatus = pendingEvents.length > 0
  ? "購入判断前"
  : attentionEvents.length > 0
    ? "保守判定"
    : "購入前確認へ";

const boardMessage = pendingEvents.length > 0
  ? `未入力イベントが${pendingEvents.length}件あります。現時点では注文金額を確定しません。`
  : attentionEvents.length > 0
    ? "注意イベントがあります。半導体・高PER・高ボラ候補は小比率または保留で確認します。"
    : "市場イベントは入力済みです。本人操作、NISA口座区分、証券会社画面確認へ進みます。";

const todayTasks = [
  {
    step: "1",
    timing: "朝",
    task: "市場データ更新",
    check_item: "日経平均/TOPIX、S&P500、NASDAQ、SOX、米10年金利、ドル円、VIX",
    pass: "指数が大崩れせず、金利・為替が急変していない",
    stop: "指数急落、米金利急騰、急な円高、VIX急騰",
    output: "市場ゲートを緑・黄・赤で仮判定",
  },
  {
    step: "2",
    timing: "イベント後",
    task: "E02/E03/E04の入力",
    check_item: "日銀会合、FOMC、最終購入前確認を102 CSVへ入力",
    pass: "未入力が0件になる",
    stop: "イベント結果が未入力、または赤条件が残る",
    output: "6月ゲート運用表と資金配分を再生成",
  },
  {
    step: "3",
    timing: "候補確認",
    task: "候補10社の扱いを確認",
    check_item: "保留、確認、買い可、急騰、下落、停止条件",
    pass: "候補ごとの理由と止める条件が説明できる",
    stop: "未確認値を点数に混ぜている、または説明できない急騰がある",
    output: "中心候補、条件付き候補、保留に分類",
  },
  {
    step: "4",
    timing: "購入前",
    task: "NISA・本人操作確認",
    check_item: "本人名義口座、本人ログイン、NISA口座区分、残枠、注文金額",
    pass: "本人が証券会社画面で最終確認できる",
    stop: "本人操作、NISA区分、残枠、入金のいずれかが未確認",
    output: "本人別注文票に進む",
  },
  {
    step: "5",
    timing: "発注後",
    task: "記録",
    check_item: "購入価格、数量、理由、買わない条件、比較指数、次回確認日",
    pass: "運用記録に残る",
    stop: "記録できない",
    output: "1週、1か月、3か月、12か月で検証",
  },
];

const requiredInputs = events.map((row) => ({
  event: `${row.event_id} ${row.event}`,
  date: row.planned_date,
  status: row.current_status,
  needed: row.input_required,
  pass_condition: row.pass_condition,
  action: row.current_status === "未入力" ? "入力後に再判定" : row.action_if_fail,
}));

const watchRows = engine.map((row) => ({
  ticker: row.ticker,
  name: row.name,
  role: row.role,
  market_signal: row.market_signal,
  one_day_change_pct: row.one_day_change_pct,
  current_status: row.engine_status_now,
  risk_tags: row.risk_tags,
  current_allocation_yen: row.current_allocation_yen,
  stop_condition: row.stop_condition,
}));

const allocationRows = allocation.map((row) => ({
  ticker: row.ticker,
  name: row.name,
  role: row.role,
  green_yen: row.all_pass_allocation_yen,
  yellow_yen: row.attention_allocation_yen,
  red_yen: row.bad_event_allocation_yen,
  condition: row.condition_to_use,
}));

const csvRows = [
  {
    section: "summary",
    item: "status",
    value: boardStatus,
    note: boardMessage,
  },
  {
    section: "summary",
    item: "current_allocation_yen",
    value: "0",
    note: "E02/E03/E04が未入力の間は注文金額を確定しない",
  },
  {
    section: "summary",
    item: "green_initial_yen",
    value: greenScenario.stock_investment_yen ?? "",
    note: greenScenario.action ?? "",
  },
  {
    section: "summary",
    item: "yellow_initial_yen",
    value: yellowScenario.stock_investment_yen ?? "",
    note: yellowScenario.action ?? "",
  },
  {
    section: "summary",
    item: "red_initial_yen",
    value: redScenario.stock_investment_yen ?? "",
    note: redScenario.action ?? "",
  },
  ...todayTasks.map((row) => ({
    section: "daily_task",
    item: `${row.step}. ${row.task}`,
    value: row.timing,
    note: `${row.check_item} / 停止: ${row.stop}`,
  })),
];

writeCsv("post_0618_operation_board_20260613.csv", ["section", "item", "value", "note"], csvRows);

const marketCards = (market.markets ?? []).slice(0, 8).map((row) => {
  const change = Number.isFinite(row.changePct) ? `${row.changePct >= 0 ? "+" : ""}${row.changePct.toFixed(2)}%` : "";
  const value = Number.isFinite(row.value) ? row.value.toLocaleString("ja-JP") : "";
  return `<div class="metric"><b>${esc(row.name)}</b><strong>${esc(value)}</strong><span>${esc(change)}</span></div>`;
}).join("");

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>6月18日以降 当日運用ボード</title>
<style>
:root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--amber:#a85b00;--red:#a01818;--green:#116b4f}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;line-height:1.7;font-size:17px}
header{background:linear-gradient(135deg,#103b60,#0b67a3);color:white;padding:30px}
header h1{margin:0 0 8px;font-size:clamp(30px,4vw,44px);letter-spacing:0;line-height:1.2}
header p{margin:0;color:white;font-weight:900}
main{max-width:1440px;margin:0 auto;padding:22px}
section{background:white;border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:25px}
.notice{border-left:8px solid var(--amber);background:#fff7e7;padding:14px 16px;border-radius:10px;font-weight:900;color:#111}
.stopbox{border-left:8px solid var(--red);background:#fff1f1}
.okbox{border-left:8px solid var(--green);background:#effaf5}
.cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.card,.metric{background:#fbfdff;border:1px solid var(--line);border-radius:10px;padding:14px}
.card b,.metric b{display:block;color:var(--navy);font-size:15px}
.card strong,.metric strong{display:block;font-size:28px;color:var(--blue);line-height:1.2;margin-top:4px}
.metric span{font-weight:900}
.links a{display:inline-block;margin:6px 8px 0 0;background:var(--blue);color:white;text-decoration:none;border-radius:8px;padding:10px 13px;font-weight:900}
.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:12px;background:white}
table{width:100%;border-collapse:collapse;min-width:1180px;table-layout:fixed}
th,td{border:1px solid var(--line);padding:10px;text-align:left;vertical-align:top;overflow-wrap:anywhere;word-break:break-word}
th{background:#e5f1fa;color:#073b62;font-weight:900}
.flow{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
.flow .card{position:relative}
.flow .card strong{font-size:20px}
.small{font-size:14px;color:#38516a;font-weight:800}
@media(max-width:1000px){main{padding:12px}.cards,.flow{grid-template-columns:1fr}table{min-width:980px}body{font-size:16px}}
</style>
</head>
<body>
<header>
  <h1>6月18日以降 当日運用ボード</h1>
  <p>作成: ${esc(generatedAt)} / 実際に買う前に、今日見る項目、止める条件、使える上限額を一画面で確認します。</p>
</header>
<main>
  <section class="notice">
    <h2>現在の結論</h2>
    <p>${esc(boardMessage)}</p>
    <div class="links">
      <a href="896_practical_entry_hub_20260606.html">実用パート入口</a>
      <a href="912_june_event_actual_input_sheet_20260606.html">6月イベント実数入力</a>
      <a href="june_gate_operation.html">6月ゲート運用表</a>
      <a href="capital_allocation_plan.html">資金配分ゲート</a>
      <a href="june_event_gate_engine.html">銘柄別イベント判定</a>
      <a href="post_0618_operation_board_20260613.csv">CSV</a>
    </div>
  </section>

  <section>
    <h2>1. 今日の状態</h2>
    <div class="cards">
      <div class="card"><b>状態</b><strong>${esc(boardStatus)}</strong><span>${esc(pendingEvents.length)}件のイベントが未入力</span></div>
      <div class="card"><b>現時点の注文上限</b><strong>0円</strong><span>E02/E03/E04未入力中</span></div>
      <div class="card"><b>緑判定の初回上限</b><strong>${Number(greenScenario.stock_investment_yen ?? 0).toLocaleString("ja-JP")}円</strong><span>全イベント確認後</span></div>
      <div class="card"><b>黄判定の初回上限</b><strong>${Number(yellowScenario.stock_investment_yen ?? 0).toLocaleString("ja-JP")}円</strong><span>注意が残る場合</span></div>
    </div>
  </section>

  <section>
    <h2>2. 18日以降の作業順</h2>
    <div class="flow">
      ${todayTasks.map((row) => `<div class="card"><b>${esc(row.timing)}</b><strong>${esc(row.step)}. ${esc(row.task)}</strong><span>${esc(row.output)}</span></div>`).join("")}
    </div>
  </section>

  <section>
    <h2>3. 入力が必要なイベント</h2>
    ${table(["event", "date", "status", "needed", "pass_condition", "action"], requiredInputs, { widths: { event: "160px", date: "150px", status: "90px" } })}
  </section>

  <section>
    <h2>4. 候補10社の現時点扱い</h2>
    ${table(["ticker", "name", "role", "market_signal", "one_day_change_pct", "current_status", "risk_tags", "current_allocation_yen", "stop_condition"], watchRows, { widths: { ticker: "95px", name: "140px", role: "110px", market_signal: "90px", one_day_change_pct: "90px", current_status: "90px" } })}
  </section>

  <section>
    <h2>5. 判定別の注文上限</h2>
    ${table(["ticker", "name", "role", "green_yen", "yellow_yen", "red_yen", "condition"], allocationRows, { widths: { ticker: "95px", name: "140px", role: "120px", green_yen: "100px", yellow_yen: "100px", red_yen: "90px" } })}
  </section>

  <section>
    <h2>6. 最新市場データ</h2>
    <p class="small">更新: ${esc(market.updatedAt)} / ${esc(market.summary)}</p>
    <div class="cards">${marketCards}</div>
  </section>

  <section class="notice stopbox">
    <h2>買わない条件</h2>
    <p>赤判定、イベント未入力、本人操作未確認、NISA口座区分未確認、証券会社画面未確認、説明できない急騰、候補別停止条件の該当がある場合は、注文金額を確定しません。</p>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "post_0618_operation_board_20260613.html"), html, "utf8");

const linkTitle = "6月18日以降 当日運用ボード";
const linkHref = "post_0618_operation_board_20260613.html";
for (const file of ["index.html", "896_practical_entry_hub_20260606.html", "914_daily_operation_flow_20260606.html"]) {
  const filePath = path.join(ROOT, file);
  let text = fs.readFileSync(filePath, "utf8");
  if (text.includes(linkHref)) continue;
  const card = `
        <a class="link-card" href="${linkHref}">
          <b>${linkTitle}</b>
          <span>18日以降に、今日見る項目、止める条件、注文上限を確認する実務画面。</span>
        </a>`;
  if (file === "index.html") {
    const indexCard = `
        <a class="card" href="${linkHref}">
          <b>${linkTitle}</b>
          <span>18日以降に、今日見る項目、止める条件、注文上限を確認する実務画面。</span>
        </a>`;
    text = text.replace(/(<a class="card" href="914_daily_operation_flow_20260606\.html">[\s\S]*?<\/a>)/, `$1${indexCard}`);
  } else {
    text = text.replace(/(<div class="link-grid">)/, `$1${card}`);
  }
  fs.writeFileSync(filePath, text, "utf8");
}

console.log("wrote post_0618_operation_board_20260613.html");
console.log("wrote post_0618_operation_board_20260613.csv");
