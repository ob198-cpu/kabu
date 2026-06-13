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

const esc = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const gates = [
  {
    id: "market",
    name: "市場イベント",
    defaultStatus: "未確認",
    required: "CPI、日銀、FOMC後の市場ゲートが緑または黄であること。",
    ok: "緑なら通常検討、黄なら保守配分。",
    stop: "赤なら購入停止。",
  },
  {
    id: "candidate",
    name: "候補10社",
    defaultStatus: "一部確認",
    required: "中心候補に必要な公式決算・PER/PBR/ROE・テーマ根拠が確認されていること。",
    ok: "中心候補、条件付き、補欠が分かれている。",
    stop: "未確認データを点数に混ぜている銘柄は購入候補にしない。",
  },
  {
    id: "allocation",
    name: "配分",
    defaultStatus: "暫定",
    required: "市場ゲートに応じた個別株比率、現金待機率、銘柄別上限が決まっていること。",
    ok: "緑・黄で配分上限を切り替える。",
    stop: "比率未定なら注文金額を確定しない。",
  },
  {
    id: "nisa",
    name: "NISA口座",
    defaultStatus: "未確認",
    required: "本人名義、本人ログイン、本人操作、NISA口座区分、NISA残枠が確認済みであること。",
    ok: "本人が証券会社画面で確認して発注する。",
    stop: "本人操作・口座区分・残枠が未確認なら購入停止。",
  },
  {
    id: "tax",
    name: "税制確認",
    defaultStatus: "一部確認",
    required: "NISA損失は損益通算不可、配当・外国税・課税口座との違いを確認していること。",
    ok: "税制レイヤーは補助表示として扱う。",
    stop: "税務判断が必要なものを買い推奨に混ぜない。",
  },
  {
    id: "record",
    name: "記録",
    defaultStatus: "未確認",
    required: "購入理由、買わない条件、期待値、比較指数、撤退条件を記録できること。",
    ok: "CSVまたは運用記録に残す。",
    stop: "記録できない場合はテストとしての検証価値が下がる。",
  },
  {
    id: "benchmark",
    name: "指数比較",
    defaultStatus: "暫定",
    required: "S&P500、TOPIX、日経平均との12か月比較と、劣後時の比率引き下げルール(915)があること。",
    ok: "12か月で指数+1%以上を説明できる根拠がある。",
    stop: "12か月で+1%の説明が成立しないなら個別株比率を上げない。",
  },
];

const gateRows = gates.map((gate) => `
  <tr data-gate="${esc(gate.id)}">
    <td><b>${esc(gate.name)}</b></td>
    <td>${esc(gate.required)}</td>
    <td>${esc(gate.ok)}</td>
    <td>${esc(gate.stop)}</td>
    <td>
      <select data-status>
        <option value="未確認"${gate.defaultStatus === "未確認" ? " selected" : ""}>未確認</option>
        <option value="暫定"${gate.defaultStatus === "暫定" ? " selected" : ""}>暫定</option>
        <option value="一部確認"${gate.defaultStatus === "一部確認" ? " selected" : ""}>一部確認</option>
        <option value="確認済み"${gate.defaultStatus === "確認済み" ? " selected" : ""}>確認済み</option>
        <option value="停止">停止</option>
      </select>
    </td>
  </tr>
`).join("");

const csvRows = [
  ["gate", "default_status", "required", "ok_handling", "stop_condition"],
  ...gates.map((gate) => [gate.name, gate.defaultStatus, gate.required, gate.ok, gate.stop]),
];

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>購入準備 判定ボード</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--amber:#a85b00;--red:#a01818;--green:#0b6b4f;--gray:#516173}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;line-height:1.65}
    header{background:var(--navy);color:white;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);letter-spacing:0;line-height:1.2}
    header p{margin:0;color:white;font-weight:800}
    main{max-width:1500px;margin:0 auto;padding:22px}
    section{background:white;border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:24px}
    .notice{border-left:7px solid var(--amber);background:#fff7e7;color:#111;padding:12px 14px;margin:0 0 14px;font-weight:900;border-radius:8px}
    .links a,.btn{display:inline-block;margin:6px 8px 0 0;background:var(--blue);color:white;text-decoration:none;border:0;border-radius:8px;padding:9px 12px;font-weight:900;cursor:pointer}
    .statusPanel{display:grid;grid-template-columns:240px 1fr;gap:14px;align-items:stretch}
    .decision{border-radius:12px;padding:18px;color:white;background:var(--gray);display:grid;align-content:center;min-height:150px}
    .decision b{font-size:34px;line-height:1.15}
    .decision span{font-weight:900}
    .decision.ok{background:var(--green)}.decision.hold{background:var(--amber)}.decision.stop{background:var(--red)}
    .message{border:1px solid var(--line);border-radius:12px;background:#fbfdff;padding:16px;font-weight:900}
    table{width:100%;border-collapse:collapse;table-layout:fixed}
    th,td{border:1px solid var(--line);padding:9px;vertical-align:top;overflow-wrap:anywhere;color:#111}
    th{background:#e5f1fb;color:var(--navy);text-align:left;font-weight:900}
    tr{break-inside:avoid}
    select{width:100%;border:1px solid var(--line);border-radius:8px;padding:8px;font-weight:900;background:white}
    pre{white-space:pre-wrap;background:#061827;color:white;border-radius:10px;padding:12px;max-height:240px;overflow:auto}
    @media(max-width:980px){main{padding:12px}.statusPanel{grid-template-columns:1fr}table{font-size:14px}}
  </style>
</head>
<body>
<header>
  <h1>購入準備 判定ボード</h1>
  <p>作成: ${esc(generatedAt)} / 市場、候補、口座、税制、記録がそろっているかを一画面で確認します。</p>
</header>
<main>
  <section>
    <h2>1. 位置づけ</h2>
    <p class="notice">このページは購入指示ではありません。購入前に必要なゲートを確認し、「進める」「保留」「停止」のどれかを表示するための実務ボードです。</p>
    <div class="links">
      <a href="914_daily_operation_flow_20260606.html">実用パート 運用フロー</a>
      <a href="910_prebuy_final_gate_checklist_20260606.html">購入前 最終ゲート</a>
      <a href="912_june_event_actual_input_sheet_20260606.html">6月イベント 実数入力</a>
      <a href="916_purchase_readiness_board_20260606.csv">CSV</a>
      <button class="btn" type="button" id="copy">判定結果をCSV化</button>
    </div>
  </section>

  <section>
    <h2>2. 現在判定</h2>
    <div class="statusPanel">
      <div id="decision" class="decision hold"><b>保留</b><span>未確認項目があります</span></div>
      <div id="message" class="message">市場イベント、NISA口座、記録条件が未確認です。購入判断に進む前に確認してください。</div>
    </div>
  </section>

  <section>
    <h2>3. ゲート確認</h2>
    <table>
      <thead><tr><th style="width:140px">ゲート</th><th>必要条件</th><th>通過時の扱い</th><th>停止条件</th><th style="width:110px">状態</th></tr></thead>
      <tbody>${gateRows}</tbody>
    </table>
  </section>

  <section>
    <h2>4. CSV出力</h2>
    <pre id="csvOutput">未出力</pre>
  </section>
</main>
<script>
const gateNames = ${JSON.stringify(gates.map((gate) => gate.name))};
function evaluate(){
  const statuses = [...document.querySelectorAll("[data-status]")].map((el) => el.value);
  const stop = statuses.includes("停止");
  const unchecked = statuses.filter((status) => status === "未確認").length;
  const temporary = statuses.filter((status) => status === "暫定" || status === "一部確認").length;
  const decision = document.getElementById("decision");
  const message = document.getElementById("message");
  decision.className = "decision";
  if (stop) {
    decision.classList.add("stop");
    decision.innerHTML = "<b>停止</b><span>停止条件があります</span>";
    message.textContent = "停止になっているゲートがあります。購入判断には進めません。";
    return;
  }
  if (unchecked > 0) {
    decision.classList.add("hold");
    decision.innerHTML = "<b>保留</b><span>未確認 " + unchecked + " 件</span>";
    message.textContent = "未確認項目があります。特に市場イベント、NISA口座、記録条件は購入前に必須です。";
    return;
  }
  if (temporary > 0) {
    decision.classList.add("hold");
    decision.innerHTML = "<b>保守判定</b><span>暫定/一部確認 " + temporary + " 件</span>";
    message.textContent = "購入判断に進む場合でも、個別株比率を抑え、条件付き候補として扱います。";
    return;
  }
  decision.classList.add("ok");
  decision.innerHTML = "<b>確認済み</b><span>最終確認へ進めます</span>";
  message.textContent = "全ゲートが確認済みです。ただし最終判断は証券会社画面、公式決算、本人確認後に行います。";
}
function csvCell(value){
  const text = String(value ?? "");
  return /[",\\n\\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}
function outputCsv(){
  const rows = [["gate","status"]];
  document.querySelectorAll("tbody tr").forEach((tr, index) => {
    rows.push([gateNames[index], tr.querySelector("[data-status]").value]);
  });
  const text = rows.map((row) => row.map(csvCell).join(",")).join("\\n");
  document.getElementById("csvOutput").textContent = text;
  navigator.clipboard?.writeText(text).catch(() => {});
}
document.addEventListener("change", evaluate);
document.getElementById("copy").addEventListener("click", outputCsv);
evaluate();
</script>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "916_purchase_readiness_board_20260606.csv"), `\uFEFF${csvRows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`, "utf8");
fs.writeFileSync(path.join(ROOT, "916_purchase_readiness_board_20260606.html"), html, "utf8");

console.log("wrote 916_purchase_readiness_board_20260606.html");
console.log("wrote 916_purchase_readiness_board_20260606.csv");
