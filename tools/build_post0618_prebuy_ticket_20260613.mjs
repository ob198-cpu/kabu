import fs from "node:fs";
import {
  esc,
  generatedAt,
  insertCardAfter,
  readCsv,
  table,
  writeCsv,
} from "./lib/report_utils_20260613.mjs";

const HTML_FILE = "post0618_prebuy_ticket_20260613.html";
const CSV_FILE = "post0618_prebuy_ticket_20260613.csv";

const events = readCsv("102_june_event_result_input.csv");
const allocation = readCsv("108_capital_allocation_by_ticker.csv");
const engineRows = readCsv("106_june_event_engine_output.csv");
const partialRows = readCsv("candidate10_partial_resolution_20260613.csv");

const engineByTicker = new Map(engineRows.map((row) => [row.ticker, row]));
const partialByTicker = new Map();
for (const row of partialRows) {
  if (!partialByTicker.has(row.ticker)) partialByTicker.set(row.ticker, []);
  partialByTicker.get(row.ticker).push(row);
}

function yen(value) {
  const number = Number(String(value ?? "0").replace(/,/g, "")) || 0;
  return `${number.toLocaleString("ja-JP")}円`;
}

function eventStatusCounts() {
  return events.reduce((acc, row) => {
    const status = row.current_status || "未入力";
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});
}

function currentBranch() {
  const counts = eventStatusCounts();
  if ((counts["悪化"] ?? 0) > 0) return "赤: 悪化";
  if ((counts["未入力"] ?? 0) > 0) return "未入力あり";
  if ((counts["注意"] ?? 0) > 0) return "黄: 注意あり";
  return "緑: 全イベント確認後";
}

function currentAction() {
  const branch = currentBranch();
  if (branch === "未入力あり") return "購入しない";
  if (branch === "赤: 悪化") return "購入しない";
  if (branch === "黄: 注意あり") return "小口のみ検討";
  return "初回上限内で検討";
}

function branchAmount(row) {
  const branch = currentBranch();
  if (branch === "緑: 全イベント確認後") return Number(row.all_pass_allocation_yen || 0);
  if (branch === "黄: 注意あり") return Number(row.attention_allocation_yen || 0);
  return 0;
}

function mustChecks(row) {
  const partials = partialByTicker.get(row.ticker) || [];
  const labels = partials.map((item) => item.remaining_item);
  const unique = [...new Set(labels)];
  return unique.join(" / ") || "追加なし";
}

function finalActionText(row) {
  if (currentAction() === "購入しない") return "待機。注文画面へ進まない。";
  if (currentAction() === "小口のみ検討") return `${yen(row.attention_allocation_yen)}を上限に、条件付きで本人が最終確認。`;
  return `${yen(row.all_pass_allocation_yen)}を上限に、本人が最終確認。`;
}

const ticketRows = allocation.map((row) => {
  const engine = engineByTicker.get(row.ticker) || {};
  return {
    updated_at: generatedAt,
    ticker: row.ticker,
    name: row.name,
    role: row.role,
    target_weight_pct: row.target_weight_pct,
    current_branch: currentBranch(),
    current_action: currentAction(),
    current_amount_yen: String(branchAmount(row)),
    green_reference_yen: row.all_pass_allocation_yen,
    yellow_reference_yen: row.attention_allocation_yen,
    red_reference_yen: row.bad_event_allocation_yen,
    required_checks: mustChecks(row),
    final_action_text: finalActionText(row),
    stop_condition: engine.stop_condition || row.max_position_note,
  };
});

writeCsv(CSV_FILE, [
  "updated_at",
  "ticker",
  "name",
  "role",
  "target_weight_pct",
  "current_branch",
  "current_action",
  "current_amount_yen",
  "green_reference_yen",
  "yellow_reference_yen",
  "red_reference_yen",
  "required_checks",
  "final_action_text",
  "stop_condition",
], ticketRows);

const eventRows = events.map((row) => ({
  日付: row.planned_date,
  イベント: row.event,
  状態: row.current_status,
  入力する実数: row.input_required,
  通過条件: row.pass_condition,
  失敗時: row.action_if_fail,
}));

const htmlRows = ticketRows.map((row) => ({
  銘柄: `${row.ticker} ${row.name}`,
  役割: row.role,
  比率: `${row.target_weight_pct}%`,
  現在: `${row.current_action} / ${yen(row.current_amount_yen)}`,
  緑上限: yen(row.green_reference_yen),
  黄上限: yen(row.yellow_reference_yen),
  確認項目: row.required_checks,
  最終操作: row.final_action_text,
  停止条件: row.stop_condition,
}));

const counts = eventStatusCounts();
const currentTotal = ticketRows.reduce((sum, row) => sum + Number(row.current_amount_yen || 0), 0);
const greenTotal = ticketRows.reduce((sum, row) => sum + Number(row.green_reference_yen || 0), 0);
const yellowTotal = ticketRows.reduce((sum, row) => sum + Number(row.yellow_reference_yen || 0), 0);

const metrics = [
  { label: "現在の分岐", value: currentBranch(), note: `未入力 ${counts["未入力"] ?? 0}件 / 注意 ${counts["注意"] ?? 0}件 / 悪化 ${counts["悪化"] ?? 0}件` },
  { label: "現在の購入上限", value: yen(currentTotal), note: "E02〜E04未入力のため現時点は0円" },
  { label: "緑シナリオ参考", value: yen(greenTotal), note: "全イベント確認後の初回35%上限" },
  { label: "黄シナリオ参考", value: yen(yellowTotal), note: "注意ありの場合の初回15%上限" },
];

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6/18以降 注文前確認票</title>
  <style>
    :root { --ink:#061827; --navy:#103b60; --blue:#0b67a3; --line:#c9dceb; --bg:#f4f8fb; --paper:#fff; --warn:#a85b00; --red:#b42318; --green:#116b4f; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif; font-size:18px; line-height:1.75; }
    header { background:linear-gradient(135deg,#103b60,#0b67a3); color:#fff; padding:30px; }
    header h1 { margin:0 0 8px; font-size:clamp(30px,4vw,42px); line-height:1.2; letter-spacing:0; }
    header p { margin:0; font-weight:800; }
    main { max-width:1540px; margin:0 auto; padding:22px; }
    section { background:var(--paper); border:1px solid var(--line); border-radius:12px; padding:18px; margin:0 0 18px; box-shadow:0 8px 20px rgba(20,60,90,.08); }
    h2 { margin:0 0 12px; border-left:8px solid var(--blue); padding-left:12px; color:var(--navy); font-size:25px; }
    .cards { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .card { border:1px solid var(--line); border-radius:10px; background:#fbfdff; padding:14px; }
    .card b { display:block; color:var(--navy); font-size:15px; }
    .card strong { display:block; font-size:28px; line-height:1.25; color:var(--blue); }
    .notice { border-left:8px solid var(--warn); background:#fff7e7; border-radius:10px; padding:14px 16px; font-weight:900; margin:0 0 14px; }
    .danger { border-left-color:var(--red); background:#fff1f1; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; margin-top:10px; }
    table { width:100%; border-collapse:collapse; table-layout:auto; background:#fff; }
    th,td { border:1px solid var(--line); padding:10px 12px; vertical-align:top; overflow-wrap:anywhere; word-break:normal; }
    th { background:#e7f2fb; color:#06395f; text-align:left; font-weight:900; }
    a { color:#005f99; font-weight:900; }
    @media (max-width:900px){ .cards{grid-template-columns:1fr 1fr;} body{font-size:16px;} }
    @media print{ body{background:#fff;} header,section{break-inside:avoid; box-shadow:none;} .table-wrap{overflow:visible;} }
  </style>
</head>
<body>
<header>
  <h1>6/18以降 注文前確認票</h1>
  <p>作成: ${esc(generatedAt)} / イベント入力、銘柄別上限、本人操作確認、買わない条件を1画面で確認するための実務票です。</p>
</header>
<main>
  <section>
    <div class="cards">${metrics.map((card) => `<div class="card"><b>${esc(card.label)}</b><strong>${esc(card.value)}</strong><span>${esc(card.note)}</span></div>`).join("")}</div>
  </section>

  <section>
    <h2>現在の結論</h2>
    <p class="notice danger">現時点では購入上限は0円です。E02 日銀会合、E03 FOMC、E04 最終購入前確認が未入力のため、注文画面へ進みません。</p>
    <p>この票は売買指示ではなく、本人が証券会社画面で最終確認する前のチェック票です。E01は注意扱いなので、他イベントが悪化しなくても、初回投入は黄シナリオの小口上限を基本に確認します。</p>
  </section>

  <section>
    <h2>イベント入力状況</h2>
    ${table(["日付", "イベント", "状態", "入力する実数", "通過条件", "失敗時"], eventRows, { widths: { 日付: "13%", 状態: "8%", イベント: "14%" } })}
  </section>

  <section>
    <h2>銘柄別 注文前確認票</h2>
    ${table(["銘柄", "役割", "比率", "現在", "緑上限", "黄上限", "確認項目", "最終操作", "停止条件"], htmlRows, { widths: { 銘柄: "14%", 現在: "12%", 確認項目: "18%", 最終操作: "15%", 停止条件: "18%" } })}
  </section>

  <section>
    <h2>使い方</h2>
    <ol>
      <li>6/15〜6/17のイベント結果を入力する。</li>
      <li>6/18以降にE04の最新株価、指数差、未確認データ、NISA口座区分、本人操作を確認する。</li>
      <li>赤判定または未入力が残る場合は0円のままにする。</li>
      <li>注意ありなら黄シナリオ上限を超えない。半導体・高PER・高ボラはさらに厳しく見る。</li>
      <li>本人が証券会社画面で口座区分と注文内容を確認してから操作する。</li>
    </ol>
    <p><a href="${CSV_FILE}">CSVを開く</a></p>
  </section>
</main>
</body>
</html>
`;

fs.writeFileSync(HTML_FILE, html, "utf8");

const card = `<a class="card" href="${HTML_FILE}">
          <b>6/18以降 注文前確認票</b>
          <span>イベント分岐、銘柄別上限、本人操作確認、買わない条件をまとめた実務票。</span>
        </a>`;

insertCardAfter("index.html", "candidate10_partial_resolution_20260613.html", card, HTML_FILE);
insertCardAfter("896_practical_entry_hub_20260606.html", "candidate10_partial_resolution_20260613.html", card.replace('class="card"', 'class="link-card"'), HTML_FILE);

console.log(`generated ${HTML_FILE}`);
console.log(`generated ${CSV_FILE}`);
