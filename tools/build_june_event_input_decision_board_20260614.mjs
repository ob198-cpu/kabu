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

function readText(file) {
  const full = path.join(ROOT, file);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8").replace(/^\uFEFF/, "") : "";
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
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
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell.replace(/\r$/, ""));
  if (row.some((v) => v !== "")) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).map((line) => Object.fromEntries(headers.map((h, i) => [h, line[i] ?? ""])));
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, rows, headers = Object.keys(rows[0] ?? {})) {
  const body = rows.map((row) => headers.map((h) => csvCell(row[h])).join(",")).join("\n");
  fs.writeFileSync(path.join(ROOT, file), `\uFEFF${headers.join(",")}\n${body}\n`, "utf8");
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusClass(value) {
  const text = String(value ?? "");
  if (/赤|停止|不可|0円|未入力|延期/.test(text)) return "bad";
  if (/黄|注意|確認|保守|保留|入力/.test(text)) return "warn";
  if (/緑|可能|完了|確認済み|候補/.test(text)) return "ok";
  return "";
}

function table(headers, rows, widths = {}) {
  return `<div class="table-wrap"><table><thead><tr>${headers
    .map((h) => `<th${widths[h] ? ` style="width:${widths[h]}"` : ""}>${esc(h)}</th>`)
    .join("")}</tr></thead><tbody>${rows
    .map(
      (row) =>
        `<tr>${headers
          .map((h) => `<td class="${statusClass(row[h])}">${esc(row[h])}</td>`)
          .join("")}</tr>`,
    )
    .join("")}</tbody></table></div>`;
}

const events = parseCsv(readText("102_june_event_result_input.csv"));
const rules = parseCsv(readText("104_june_event_gate_rules.csv"));
const ruleByEventId = Object.fromEntries(rules.map((r) => [r.event_id, r]));

const missing = events.filter((e) => e.current_status === "未入力" || !e.current_status);
const attention = events.filter((e) => e.current_status === "注意");
const red = events.filter((e) => e.current_status === "赤");
const currentDecision = missing.length || red.length ? "購入不可" : attention.length ? "小口・保守判定" : "初回買付候補";
const currentUpper = missing.length || red.length ? "0円" : attention.length ? "360,000円" : "840,000円";

const eventRows = events.map((e) => {
  const rule = ruleByEventId[e.event_id] ?? {};
  const result = e.current_status === "未入力" || !e.current_status ? "未入力: 買付0円" : e.current_status === "注意" ? "黄判定: 高リスク候補を抑える" : "入力済み";
  return {
    ID: e.event_id,
    日程: e.planned_date,
    イベント: e.event,
    現在: e.current_status || "未入力",
    入れる数値: e.input_required,
    黄判定の目安: rule.attention_signal || "中重要度の未確認が残る",
    赤判定の目安: rule.bad_signal || "停止条件、または重要項目の未確認",
    影響: rule.affected_tags || "全銘柄",
    判断結果: result,
    次の処理: e.current_status === "未入力" || !e.current_status ? "実数入力後に緑/黄/赤を再判定" : e.action_if_fail || "記録継続",
  };
});

const flowRows = [
  {
    手順: "1",
    作業: "イベント結果を入力",
    内容: "CPI、日銀、FOMC、最終購入前確認の実数を102_june_event_result_input.csvへ入れる",
    出力: "未入力をなくす",
  },
  {
    手順: "2",
    作業: "緑/黄/赤を判定",
    内容: "金利、為替、NASDAQ/SOX、日経平均/TOPIX、候補銘柄反応を基準に分類する",
    出力: "イベント別の市場ゲート",
  },
  {
    手順: "3",
    作業: "資金配分へ接続",
    内容: "緑なら84万円上限、黄なら36万円上限、赤または未入力なら0円にする",
    出力: "買付上限",
  },
  {
    手順: "4",
    作業: "候補10社へ反映",
    内容: "高リスク銘柄、財務未確認銘柄、指数劣後銘柄の比率を下げる",
    出力: "注文票または見送り",
  },
];

const scenarioRows = [
  {
    判定: "現在",
    条件: `${missing.length}件が未入力、${attention.length}件が注意`,
    個別株上限: "0円",
    実務: "買付しない。日銀、FOMC、最終購入前確認を先に入力する",
  },
  {
    判定: "緑",
    条件: "赤判定なし、注意判定なし、本人操作・NISA口座確認済み",
    個別株上限: "840,000円",
    実務: "初回35%上限。中心候補を厚め、条件付き候補は小口",
  },
  {
    判定: "黄",
    条件: "注意判定が残る、または指数優位が0〜+1%未満",
    個別株上限: "360,000円",
    実務: "初回15%上限。半導体・高PER・高ボラをさらに抑える",
  },
  {
    判定: "赤",
    条件: "金利急騰、指数急落、急な円高ショック、重要データ未確認",
    個別株上限: "0円",
    実務: "新規購入停止。監視・記録のみ",
  },
];

writeCsv("june_event_input_decision_board_20260614.csv", eventRows);
writeCsv("june_event_input_flow_20260614.csv", flowRows);
writeCsv("june_event_input_scenarios_20260614.csv", scenarioRows);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月イベント入力・判定ボード</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--warn:#9a5b00;--red:#b42318;--green:#116b4f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.7}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);line-height:1.2;letter-spacing:0}
    header p{margin:0;font-weight:800;max-width:1180px}
    main{max-width:1560px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08)}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:25px}
    .notice{border-left:8px solid var(--warn);background:#fff7e7;border-radius:10px;padding:14px 16px;font-weight:900;margin:0 0 14px}
    .danger{border-left-color:var(--red);background:#fff1f1}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:15px}
    .card strong{display:block;font-size:28px;line-height:1.25;color:var(--blue)}
    .card span{font-weight:800;color:#263e55}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin-top:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:10px 12px;vertical-align:top;overflow-wrap:anywhere;word-break:normal}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    td.ok{color:var(--green);font-weight:900}
    td.warn{color:var(--warn);font-weight:900}
    td.bad{color:var(--red);font-weight:900}
    a{color:#005f99;font-weight:900}
    footer{font-size:13px;color:#526b82;margin:20px 0}
    @media(max-width:900px){main{padding:12px}.cards{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:12px;padding:6px 7px}}
  </style>
</head>
<body>
<header>
  <h1>6月イベント入力・判定ボード</h1>
  <p>6月のCPI、日銀、FOMC、最終購入前確認について、何を入力し、どの条件なら緑・黄・赤にするかを1画面で確認します。</p>
</header>
<main>
  <section>
    <h2>現在の判定</h2>
    <p class="notice danger">現在は ${esc(currentDecision)} です。未入力イベントが ${missing.length}件あるため、個別株買付上限は ${esc(currentUpper)} です。</p>
    <div class="cards">
      <div class="card"><b>現在</b><strong>${esc(currentDecision)}</strong><span>未入力が残る間は買付しない</span></div>
      <div class="card"><b>買付上限</b><strong>${esc(currentUpper)}</strong><span>イベント入力後に再判定</span></div>
      <div class="card"><b>未入力</b><strong>${missing.length}件</strong><span>${esc(missing.map((e) => e.event).join(" / ") || "なし")}</span></div>
      <div class="card"><b>注意</b><strong>${attention.length}件</strong><span>${esc(attention.map((e) => e.event).join(" / ") || "なし")}</span></div>
    </div>
  </section>

  <section>
    <h2>入力・判定の流れ</h2>
    ${table(["手順", "作業", "内容", "出力"], flowRows, { 内容: "520px" })}
  </section>

  <section>
    <h2>イベント別チェック表</h2>
    <p class="notice">赤判定または未入力が残る場合、買付上限は0円です。黄判定では個別株上限を36万円に下げ、高リスク銘柄をさらに抑えます。</p>
    ${table(["ID", "日程", "イベント", "現在", "入れる数値", "黄判定の目安", "赤判定の目安", "影響", "判断結果", "次の処理"], eventRows, {
      入れる数値: "300px",
      黄判定の目安: "230px",
      赤判定の目安: "260px",
      次の処理: "260px",
    })}
  </section>

  <section>
    <h2>資金上限への接続</h2>
    ${table(["判定", "条件", "個別株上限", "実務"], scenarioRows, { 条件: "420px", 実務: "360px" })}
  </section>

  <section>
    <h2>関連画面</h2>
    <ul>
      <li><a href="practical_action_cockpit_20260614.html">実用判断コックピット</a></li>
      <li><a href="benchmark_allocation_switchboard_20260614.html">S&P500/TOPIX +1%目標 資金配分スイッチ</a></li>
      <li><a href="nisa_account_execution_gate_20260614.html">NISA口座・本人操作 実行ゲート</a></li>
      <li><a href="post_0618_event_update_runbook_20260613.html">6月イベントCSV 反映・再生成ランブック</a></li>
    </ul>
  </section>
  <footer>作成: ${esc(generatedAt)} / 本画面は売買指示ではなく、6月イベント結果を購入前ゲートへ接続する確認表です。</footer>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "june_event_input_decision_board_20260614.html"), html, "utf8");

function insertBefore(file, needle, block, marker) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return false;
  let text = fs.readFileSync(full, "utf8");
  if (text.includes(marker)) return false;
  const index = text.indexOf(needle);
  if (index < 0) return false;
  text = `${text.slice(0, index)}${block}\n${text.slice(index)}`;
  fs.writeFileSync(full, text, "utf8");
  return true;
}

const indexCard = `        <a class="card" href="june_event_input_decision_board_20260614.html">
          <b>6月イベント入力・判定ボード</b>
          <span>CPI、日銀、FOMC、最終購入前確認を、緑・黄・赤と買付上限へ接続。</span>
        </a>`;
const hubCard = `        <a class="link-card" href="june_event_input_decision_board_20260614.html">
          <b>6月イベント入力・判定ボード</b>
          <span>CPI、日銀、FOMC、最終購入前確認を、緑・黄・赤と買付上限へ接続。</span>
        </a>`;
const cockpitLink = `    <li><a href="june_event_input_decision_board_20260614.html">6月イベント入力・判定ボード</a></li>`;

insertBefore("index.html", '<a class="secondary" href="june_event_gate_engine.html"', `${indexCard}\n`, "june_event_input_decision_board_20260614.html");
insertBefore("896_practical_entry_hub_20260606.html", '<a class="link-card" href="post_0618_prebuy_final_verification_20260613.html"', `${hubCard}\n`, "june_event_input_decision_board_20260614.html");
insertBefore("practical_action_cockpit_20260614.html", "</ul>", `${cockpitLink}\n`, "june_event_input_decision_board_20260614.html");

console.log("generated june_event_input_decision_board_20260614.html");
