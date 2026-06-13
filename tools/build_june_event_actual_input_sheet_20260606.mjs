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

const events = [
  {
    event_id: "E01",
    date: "2026-06-10",
    event: "米5月CPI",
    current_status: "注意",
    actual_value: "入力済み/確認中",
    market_reaction: "注意",
    needed: "CPI前年比・前月比、米10年金利、NASDAQ、SOX、VIX、ドル円",
    pass_condition: "インフレ再加速と米金利急騰が同時に起きず、NASDAQ/SOXが大崩れしない",
    bad_condition: "米10年金利+15bp以上、またはNASDAQ/SOX日次-3%以上",
    attention_condition: "米10年金利+8bp以上、またはNASDAQ/SOX日次-1.5%以上",
    affected: "半導体、高PER、高ボラ、AIインフラ",
    action_if_fail: "半導体・高PER・高ボラ候補の買付前ゲートを厳格化",
  },
  {
    event_id: "E02",
    date: "2026-06-15〜2026-06-16",
    event: "日銀会合",
    current_status: "未入力",
    actual_value: "",
    market_reaction: "",
    needed: "政策変更、ドル円、日経平均/TOPIX、銀行・商社・輸出株反応",
    pass_condition: "急な円高ショックと日本株指数の大幅下落が同時に出ない",
    bad_condition: "急な円高と日経平均/TOPIX急落が同時発生",
    attention_condition: "円高方向だが指数下落は限定的",
    affected: "日本株、銀行、商社、輸出、内需",
    action_if_fail: "日本株の予定買付を延期、または比率を下げる",
  },
  {
    event_id: "E03",
    date: "2026-06-16〜2026-06-17",
    event: "FOMC",
    current_status: "未入力",
    actual_value: "",
    market_reaction: "",
    needed: "政策金利見通し、米10年金利、NASDAQ、SOX、ドル円",
    pass_condition: "米長期金利が急騰せず、ハイテク株のリスク許容度が崩れない",
    bad_condition: "米10年金利+15bp以上、またはNASDAQ/SOX日次-3%以上",
    attention_condition: "米10年金利+8bp以上、またはNASDAQ/SOX日次-1.5%以上",
    affected: "半導体、高PER、高ボラ、輸出、AIインフラ",
    action_if_fail: "半導体・高PER・高ボラ候補を延期",
  },
  {
    event_id: "E04",
    date: "2026-06-18以降",
    event: "最終購入前確認",
    current_status: "未入力",
    actual_value: "",
    market_reaction: "",
    needed: "候補別株価、PER/PBR/ROE、直近下落率、未確認データ、証券会社画面",
    pass_condition: "停止条件なし。未確認データを点数に混ぜない。本人操作とNISA口座区分を確認",
    bad_condition: "停止条件1件以上、または未確認データが重要項目に残る",
    attention_condition: "中重要度の未確認項目が残る",
    affected: "候補10社全体、NISA口座、本人操作、資金配分",
    action_if_fail: "監視継続、または初回金額を縮小",
  },
];

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

const resultHeaders = [
  "event_id",
  "planned_date",
  "event",
  "input_required",
  "actual_value",
  "market_reaction",
  "pass_condition",
  "current_status",
  "action_if_fail",
];

const resultRows = events.map((row) => ({
  event_id: row.event_id,
  planned_date: row.date,
  event: row.event,
  input_required: row.needed,
  actual_value: row.actual_value,
  market_reaction: row.market_reaction,
  pass_condition: row.pass_condition,
  current_status: row.current_status,
  action_if_fail: row.action_if_fail,
}));

writeCsv("912_june_event_actual_input_sheet_20260606.csv", resultHeaders, resultRows);

const statusOptions = ["未入力", "通過", "注意", "悪化"];

const rowsHtml = events
  .map((row, index) => `
    <tr data-index="${index}">
      <td class="id"><b>${esc(row.event_id)}</b><span>${esc(row.date)}</span></td>
      <td><b>${esc(row.event)}</b><span>${esc(row.affected)}</span></td>
      <td>${esc(row.needed)}</td>
      <td>
        <textarea data-field="actual_value" rows="3" placeholder="例: 米10年金利 +6bp、SOX -0.8%、ドル円横ばい">${esc(row.actual_value)}</textarea>
      </td>
      <td>
        <textarea data-field="market_reaction" rows="3" placeholder="指数・為替・候補銘柄の反応を記録">${esc(row.market_reaction)}</textarea>
      </td>
      <td>
        <select data-field="current_status">
          ${statusOptions
            .map((status) => `<option value="${esc(status)}" ${status === row.current_status ? "selected" : ""}>${esc(status)}</option>`)
            .join("")}
        </select>
      </td>
      <td>
        <b>通過:</b> ${esc(row.pass_condition)}<br>
        <b>注意:</b> ${esc(row.attention_condition)}<br>
        <b>悪化:</b> ${esc(row.bad_condition)}
      </td>
      <td>${esc(row.action_if_fail)}</td>
    </tr>
  `)
  .join("");

const csvSeed = JSON.stringify(resultRows);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月イベント実数入力シート</title>
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
    header h1 {
      margin: 0 0 10px;
      font-size: clamp(28px, 4vw, 42px);
      letter-spacing: 0;
    }
    header p { margin: 0; max-width: 1100px; }
    main { max-width: 1500px; margin: 0 auto; padding: 24px; }
    .nav {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 10px;
      margin: 0 0 18px;
    }
    .nav a, button {
      display: inline-flex;
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
      cursor: pointer;
    }
    button.primary { background: #005f99; color: #fff; }
    .panel {
      background: var(--paper);
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 18px;
      margin-bottom: 18px;
      box-shadow: 0 8px 24px rgba(0, 31, 63, 0.06);
    }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 12px;
    }
    .metric {
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 14px;
      background: var(--soft);
    }
    .metric b { display: block; font-size: 28px; line-height: 1.2; }
    .metric span { color: var(--muted); }
    .metric.ok b { color: var(--ok); }
    .metric.warn b { color: var(--warn); }
    .metric.bad b { color: var(--bad); }
    .decision {
      border-left: 8px solid #78aad0;
      padding: 12px 14px;
      background: #f7fbff;
      font-size: 19px;
      font-weight: 700;
    }
    .decision.ok { border-color: var(--ok); }
    .decision.warn { border-color: var(--warn); }
    .decision.bad { border-color: var(--bad); }
    table {
      width: 100%;
      border-collapse: collapse;
      background: #fff;
      table-layout: fixed;
    }
    th, td {
      border: 1px solid var(--line);
      padding: 10px;
      vertical-align: top;
      word-break: break-word;
    }
    th {
      background: #e5f1fb;
      text-align: left;
      font-size: 15px;
    }
    td.id b { display: block; font-size: 20px; }
    td.id span, td:nth-child(2) span {
      display: block;
      color: var(--muted);
      font-size: 14px;
      margin-top: 4px;
    }
    textarea, select {
      width: 100%;
      border: 1px solid #9bbad6;
      border-radius: 7px;
      padding: 9px;
      font: inherit;
      background: #fff;
      color: var(--ink);
    }
    textarea { min-height: 96px; resize: vertical; }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      background: #001f3f;
      color: #fff;
      padding: 16px;
      border-radius: 10px;
      overflow: auto;
      font-size: 14px;
      line-height: 1.6;
    }
    .note {
      color: var(--muted);
      font-size: 15px;
    }
    @media (max-width: 900px) {
      main { padding: 14px; }
      table { min-width: 1100px; }
      .table-wrap { overflow-x: auto; }
    }
    @media print {
      body { background: #fff; font-size: 13px; }
      header { padding: 16px 22px; }
      main { max-width: none; padding: 12px; }
      .nav, .actions, pre { display: none; }
      .panel { box-shadow: none; break-inside: avoid; }
      tr { break-inside: avoid; }
      textarea, select { border: 0; padding: 0; }
    }
  </style>
</head>
<body>
  <header>
    <h1>6月イベント実数入力シート</h1>
    <p>6月18日以降の購入判断で使う、CPI・日銀・FOMC・最終購入前確認の実数入力欄です。未入力や悪化を点数に混ぜず、購入前ゲートへ明確につなげます。</p>
  </header>
  <main>
    <nav class="nav" aria-label="関連ページ">
      <a href="post_0618_operation_board_20260613.html">6月18日以降 当日運用ボード</a>
      <a href="post_0618_event_reflection_workflow_20260613.html">イベント反映ワークフロー</a>
      <a href="june_gate_operation.html">6月購入前ゲート</a>
      <a href="june_event_gate_engine.html">6月イベント判定エンジン</a>
      <a href="capital_allocation_plan.html">資金配分プラン</a>
    </nav>

    <section class="panel">
      <h2>現在の判定</h2>
      <div class="summary">
        <div class="metric warn"><b id="countPending">0</b><span>未入力イベント</span></div>
        <div class="metric warn"><b id="countAttention">0</b><span>注意イベント</span></div>
        <div class="metric bad"><b id="countBad">0</b><span>悪化イベント</span></div>
        <div class="metric ok"><b id="countPass">0</b><span>通過イベント</span></div>
      </div>
      <p id="decision" class="decision warn">入力状況を確認中</p>
      <p class="note">この画面は入力補助です。証券会社の注文画面を操作する前に、本人操作、NISA口座区分、購入金額、停止条件を別途確認します。</p>
    </section>

    <section class="panel">
      <h2>実数入力</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width: 9%">ID/日付</th>
              <th style="width: 12%">イベント</th>
              <th style="width: 16%">入力する数値</th>
              <th style="width: 14%">実数</th>
              <th style="width: 14%">市場反応</th>
              <th style="width: 8%">状態</th>
              <th style="width: 18%">判定基準</th>
              <th style="width: 9%">悪化時対応</th>
            </tr>
          </thead>
          <tbody id="eventRows">
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </section>

    <section class="panel actions">
      <h2>判定用CSV</h2>
      <p>下のボタンで、現在の入力内容をCSV形式にします。内容は <b>102_june_event_result_input.csv</b> と同じ列構成です。</p>
      <div class="nav">
        <button class="primary" type="button" id="makeCsv">判定用CSVを作成</button>
        <button type="button" id="copyCsv">CSVをコピー</button>
      </div>
      <pre id="csvOutput"></pre>
    </section>
  </main>

  <script>
    const initialRows = ${csvSeed};
    const headers = ${JSON.stringify(resultHeaders)};

    function csvCell(value) {
      const text = String(value ?? "");
      return /[",\\n\\r]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
    }

    function getRows() {
      return Array.from(document.querySelectorAll("tbody tr")).map((tr, index) => {
        const base = { ...initialRows[index] };
        tr.querySelectorAll("[data-field]").forEach((field) => {
          base[field.dataset.field] = field.value;
        });
        return base;
      });
    }

    function renderSummary() {
      const rows = getRows();
      const pending = rows.filter((row) => row.current_status === "未入力").length;
      const attention = rows.filter((row) => row.current_status === "注意").length;
      const bad = rows.filter((row) => row.current_status === "悪化").length;
      const pass = rows.filter((row) => row.current_status === "通過").length;
      document.getElementById("countPending").textContent = pending;
      document.getElementById("countAttention").textContent = attention;
      document.getElementById("countBad").textContent = bad;
      document.getElementById("countPass").textContent = pass;
      const decision = document.getElementById("decision");
      decision.className = "decision";
      if (bad > 0) {
        decision.classList.add("bad");
        decision.textContent = "新規購入停止: 悪化イベントがあります。初回購入は行わず、再判定します。";
      } else if (pending > 0) {
        decision.classList.add("warn");
        decision.textContent = "金額未確定: 未入力イベントがあります。買付比率は確定しません。";
      } else if (attention > 0) {
        decision.classList.add("warn");
        decision.textContent = "慎重実行: 注意イベントがあります。高PER・高ボラ・半導体偏重は小さくします。";
      } else {
        decision.classList.add("ok");
        decision.textContent = "購入前確認へ進む: 主要イベントは通過扱いです。本人操作と口座区分を確認します。";
      }
    }

    function buildCsv() {
      const rows = getRows();
      return [
        headers.join(","),
        ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
      ].join("\\n");
    }

    function renderCsv() {
      const csv = buildCsv();
      document.getElementById("csvOutput").textContent = csv;
      return csv;
    }

    document.querySelectorAll("textarea, select").forEach((field) => {
      field.addEventListener("input", renderSummary);
      field.addEventListener("change", renderSummary);
    });
    document.getElementById("makeCsv").addEventListener("click", renderCsv);
    document.getElementById("copyCsv").addEventListener("click", async () => {
      const csv = renderCsv();
      await navigator.clipboard.writeText(csv);
      alert("CSVをコピーしました。");
    });
    renderSummary();
    renderCsv();
  </script>
  <!-- generated: ${esc(generatedAt)} -->
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "912_june_event_actual_input_sheet_20260606.html"), html, "utf8");

console.log("generated 912_june_event_actual_input_sheet_20260606.html");
console.log("generated 912_june_event_actual_input_sheet_20260606.csv");
