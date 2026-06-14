import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/14 21:25";

function p(file) {
  return path.join(ROOT, file);
}

function readText(file) {
  return fs.existsSync(p(file)) ? fs.readFileSync(p(file), "utf8").replace(/^\uFEFF/, "") : "";
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
  const head = rows[0].map((v) => v.trim());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(file, rows) {
  if (!rows.length) {
    fs.writeFileSync(p(file), "", "utf8");
    return;
  }
  const head = Object.keys(rows[0]);
  fs.writeFileSync(p(file), `\uFEFF${[head.join(","), ...rows.map((r) => head.map((h) => csvCell(r[h])).join(","))].join("\n")}\n`, "utf8");
}

function h(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isBlank(value) {
  return String(value ?? "").trim() === "";
}

function toNumber(value) {
  const n = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function statusClass(value) {
  const s = String(value ?? "");
  if (/(全体停止|購入不可|0円|赤|未入力|未確認|NG|停止)/.test(s)) return "bad";
  if (/(条件付き|注意|黄|抑制|確認中|要確認)/.test(s)) return "warn";
  if (/(解除候補|確認済み|緑|OK|完了|反映可)/.test(s)) return "ok";
  return "";
}

function table(rows, cols) {
  return `<div class="table-wrap"><table><thead><tr>${cols.map((c) => `<th>${h(c.label)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${cols.map((c) => `<td class="${statusClass(r[c.key])}">${h(r[c.key])}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

function card(title, value, note, className = "") {
  return `<div class="card ${className}"><b>${h(title)}</b><strong>${h(value)}</strong><span>${h(note)}</span></div>`;
}

const events = parseCsv(readText("redecision_event_input_template_20260614.csv"));
const accounts = parseCsv(readText("redecision_account_input_template_20260614.csv"));

function judgeEvent(row) {
  const missing = [];
  if (isBlank(row.入力する実数) || /確認中/.test(row.入力する実数)) missing.push("実数未確定");
  if (isBlank(row.市場反応)) missing.push("市場反応未入力");
  if (isBlank(row.判定入力) || row.判定入力 === "未入力") missing.push("判定未入力");

  const signal = `${row.市場反応} ${row.判定入力}`;
  const isRed = /赤|停止|悪化|急騰|急落/.test(signal);
  const isYellow = /黄|注意|確認/.test(signal);

  let 判定 = "未入力";
  let 買付影響 = "全銘柄0円";
  let 次処理 = "実数、市場反応、判定入力を埋める";

  if (isRed) {
    判定 = "赤: 全体停止";
    買付影響 = "全銘柄0円、購入延期";
    次処理 = row.失敗時対応 || "買付延期";
  } else if (missing.length > 0) {
    判定 = "未入力: 全体停止";
    買付影響 = "全銘柄0円";
  } else if (isYellow) {
    判定 = "黄/注意: 条件付き";
    買付影響 = "再判定は可能だが比率抑制";
    次処理 = "高PER・高ボラ銘柄の上限を下げて再判定";
  } else if (/緑|OK|確認済み/.test(signal)) {
    判定 = "緑: 解除候補";
    買付影響 = "イベント側は再判定へ進める";
    次処理 = "本人別口座と財務ゲートを確認";
  }

  return {
    種別: "イベント",
    対象: `${row.event_id} ${row.日付} ${row.イベント}`,
    現在入力: `実数=${row.入力する実数 || "空欄"} / 反応=${row.市場反応 || "空欄"} / 判定=${row.判定入力 || "空欄"}`,
    不足: missing.join(" / ") || "なし",
    判定,
    買付影響,
    次処理,
  };
}

const accountFields = ["本人名", "証券会社", "NISA口座", "本人スマホ", "本人銀行口座", "二段階認証", "NISA残枠円"];

function judgeAccount(row) {
  const missing = accountFields.filter((field) => isBlank(row[field]));
  const remaining = toNumber(row.NISA残枠円);
  if (!isBlank(row.NISA残枠円) && remaining <= 0) missing.push("NISA残枠不足");

  let 判定 = "未確認: 本人別0円";
  let 買付影響 = "該当本人分は注文票へ反映しない";
  let 次処理 = "本人名義スマホ、本人ログイン、NISA区分、残枠を確認する";

  if (missing.length === 0) {
    判定 = "確認済み: 本人別解除候補";
    買付影響 = "本人別注文票の作成候補";
    次処理 = "イベントと銘柄別ゲート通過後に金額を再計算";
  }

  return {
    種別: "本人別口座",
    対象: row.account_id,
    現在入力: `本人=${row.本人名 || "空欄"} / 証券=${row.証券会社 || "空欄"} / NISA=${row.NISA口座 || "空欄"} / 残枠=${row.NISA残枠円 || "空欄"}`,
    不足: missing.join(" / ") || "なし",
    判定,
    買付影響,
    次処理,
  };
}

const eventJudgements = events.map(judgeEvent);
const accountJudgements = accounts.map(judgeAccount);
const allRows = [...eventJudgements, ...accountJudgements];

const redEvents = eventJudgements.filter((r) => /赤/.test(r.判定)).length;
const missingEvents = eventJudgements.filter((r) => /未入力/.test(r.判定)).length;
const yellowEvents = events.filter((r) => /黄|注意|確認/.test(`${r.市場反応} ${r.判定入力}`)).length;
const greenEvents = eventJudgements.filter((r) => /緑/.test(r.判定)).length;
const readyAccounts = accountJudgements.filter((r) => /確認済み/.test(r.判定)).length;
const lockedAccounts = accountJudgements.length - readyAccounts;

let overall = "購入不可・買付上限0円";
let reason = "P0が未完了。イベントまたは本人別口座が未確認。";
let next = "P0入力を完了し、再判定準備バリデーターを再確認する。";

if (redEvents > 0) {
  overall = "購入不可・全体停止";
  reason = "赤イベントがあるため、銘柄評価に関係なく買付延期。";
  next = "赤イベントの影響が落ち着くまで購入判断を延期する。";
} else if (missingEvents > 0 || lockedAccounts > 0) {
  overall = "購入不可・買付上限0円";
  reason = "未入力イベントまたは未確認口座が残っている。";
} else if (yellowEvents > 0 && readyAccounts > 0) {
  overall = "条件付き再判定候補";
  reason = "P0は埋まったが、注意/黄イベントがあるため比率抑制が必要。";
  next = "銘柄別ゲートと比率抑制をかけて再判定する。";
} else if (greenEvents === eventJudgements.length && readyAccounts > 0) {
  overall = "P0解除候補";
  reason = "イベントと本人別口座は再判定へ進める状態。";
  next = "P1財務補完と統合購入可否エンジンへ進む。";
}

const summaryRows = [
  { 項目: "総合判定", 数値: overall, 内容: reason },
  { 項目: "イベント赤", 数値: `${redEvents}件`, 内容: redEvents ? "1件でもあれば全体停止。" : "赤停止はなし。" },
  { 項目: "イベント未入力", 数値: `${missingEvents}件`, 内容: missingEvents ? "未入力が残る間は全銘柄0円。" : "イベント未入力なし。" },
  { 項目: "イベント注意/黄", 数値: `${yellowEvents}件`, 内容: yellowEvents ? "未入力と重なっていても、再判定時は比率抑制候補。" : "注意/黄なし。" },
  { 項目: "本人別確認済み口座", 数値: `${readyAccounts}/${accountJudgements.length}口座`, 内容: readyAccounts ? "確認済み口座だけ注文票候補。" : "確認済み口座なし。" },
  { 項目: "次処理", 数値: "継続", 内容: next },
];

writeCsv("p0_unlock_judgement_engine_20260614.csv", allRows);
writeCsv("p0_unlock_judgement_summary_20260614.csv", summaryRows);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>P0 買付ロック解除 判定エンジン</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--warn:#a85b00;--red:#a01818;--green:#116b4f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.75}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:white;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);line-height:1.2;letter-spacing:0}
    header p{margin:0;font-weight:800;max-width:1180px}
    main{max-width:1600px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:25px}
    .notice{border-left:8px solid var(--red);background:#fff1f1;border-radius:10px;padding:14px 16px;font-weight:900;margin:0 0 14px}
    .sub{border-left-color:var(--blue);background:#eef7ff}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:15px}
    .card strong{display:block;font-size:28px;line-height:1.25;color:var(--blue)}
    .card span{display:block;color:#263e55;font-weight:800}
    .card.bad strong{color:var(--red)}
    .card.warn strong{color:var(--warn)}
    .card.ok strong{color:var(--green)}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin-top:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:10px 12px;vertical-align:top;overflow-wrap:anywhere;word-break:normal}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    td.ok{color:var(--green);font-weight:900}
    td.warn{color:var(--warn);font-weight:900}
    td.bad{color:var(--red);font-weight:900}
    .links{display:flex;flex-wrap:wrap;gap:10px}
    .links a{display:inline-block;text-decoration:none;border:1px solid #7bb6dd;border-radius:999px;padding:8px 13px;background:#f7fbff;color:#06395f}
    footer{font-size:13px;color:#526b82;margin:20px 0}
    @media(max-width:900px){main{padding:12px}.cards{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:#fff}header,section{box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:12px;padding:6px 7px}}
  </style>
</head>
<body>
<header>
  <h1>P0 買付ロック解除 判定エンジン</h1>
  <p>イベントと本人別口座の入力結果から、全体停止・条件付き・P0解除候補・本人別0円を判定する画面です。</p>
</header>
<main>
  <section>
    <h2>現在の結論</h2>
    <p class="notice">${h(overall)}。${h(reason)} ここを通過しても買付決定ではなく、P1財務補完と統合購入可否エンジンの再判定が必要です。</p>
    <div class="cards">
      ${card("総合判定", overall, reason, /解除候補/.test(overall) ? "ok" : /条件付き/.test(overall) ? "warn" : "bad")}
      ${card("赤イベント", `${redEvents}件`, "1件でも全体停止", redEvents ? "bad" : "ok")}
      ${card("未入力イベント", `${missingEvents}件`, "残る間は全銘柄0円", missingEvents ? "bad" : "ok")}
      ${card("本人確認済み", `${readyAccounts}/${accountJudgements.length}口座`, "確認済み口座だけ注文票候補", readyAccounts ? "ok" : "bad")}
    </div>
  </section>

  <section>
    <h2>判定ルール</h2>
    <p class="notice sub">赤イベントがあれば全体停止。未入力イベントがあれば全銘柄0円。注意/黄は再判定可能でも比率抑制。本人別口座が未確認なら、その本人分は注文票へ反映しません。</p>
  </section>

  <section>
    <h2>イベント判定</h2>
    ${table(eventJudgements, [
      { key: "対象", label: "対象" },
      { key: "現在入力", label: "現在入力" },
      { key: "不足", label: "不足" },
      { key: "判定", label: "判定" },
      { key: "買付影響", label: "買付影響" },
      { key: "次処理", label: "次処理" },
    ])}
  </section>

  <section>
    <h2>本人別口座判定</h2>
    ${table(accountJudgements, [
      { key: "対象", label: "対象" },
      { key: "現在入力", label: "現在入力" },
      { key: "不足", label: "不足" },
      { key: "判定", label: "判定" },
      { key: "買付影響", label: "買付影響" },
      { key: "次処理", label: "次処理" },
    ])}
  </section>

  <section>
    <h2>サマリー</h2>
    ${table(summaryRows, [
      { key: "項目", label: "項目" },
      { key: "数値", label: "数値" },
      { key: "内容", label: "内容" },
    ])}
  </section>

  <section>
    <h2>関連画面</h2>
    <div class="links">
      <a href="p0_unlock_required_sheet_20260614.html">P0 必須入力シート</a>
      <a href="unlock_next_action_tickets_20260614.html">買付ロック解除 次アクションチケット</a>
      <a href="unlock_input_workflow_20260614.html">買付ロック解除 入力ワークフロー</a>
      <a href="redecision_readiness_validator_20260614.html">再判定準備バリデーター</a>
      <a href="integrated_purchase_decision_engine_20260614.html">統合購入可否エンジン</a>
      <a href="daily_practical_compact_board_20260614.html">実用日次ボード</a>
    </div>
  </section>

  <footer>作成: ${h(generatedAt)} / 本画面は買付指示ではなく、P0解除可否を機械的に確認するための判定画面です。</footer>
</main>
</body>
</html>`;

fs.writeFileSync(p("p0_unlock_judgement_engine_20260614.html"), html, "utf8");

function insertLink(file, marker, htmlToInsert) {
  const full = p(file);
  if (!fs.existsSync(full)) return;
  let text = fs.readFileSync(full, "utf8");
  if (text.includes("p0_unlock_judgement_engine_20260614.html")) return;
  const idx = text.indexOf(marker);
  if (idx === -1) return;
  text = text.slice(0, idx) + htmlToInsert + text.slice(idx);
  fs.writeFileSync(full, text, "utf8");
}

insertLink(
  "daily_practical_compact_board_20260614.html",
  '<a href="p0_unlock_required_sheet_20260614.html">',
  '<a href="p0_unlock_judgement_engine_20260614.html">P0 買付ロック解除 判定エンジン</a>',
);

insertLink(
  "p0_unlock_required_sheet_20260614.html",
  '<a href="daily_practical_compact_board_20260614.html">',
  '<a href="p0_unlock_judgement_engine_20260614.html">P0 買付ロック解除 判定エンジン</a>',
);

insertLink(
  "latest_practical_start_20260614.html",
  '<a class="step" href="integrated_purchase_decision_engine_20260614.html">',
  `<a class="step" href="p0_unlock_judgement_engine_20260614.html">
        <b>6-11. P0 買付ロック解除 判定エンジン</b>
        <span>イベントと本人別口座の入力結果から、全体停止・条件付き・解除候補を判定する。</span>
        <em>P0判定</em>
      </a>
`,
);

insertLink(
  "index.html",
  '<a class="card" href="p0_unlock_required_sheet_20260614.html">',
  `<a class="card" href="p0_unlock_judgement_engine_20260614.html">
          <b>P0 買付ロック解除 判定エンジン</b>
          <span>イベントと本人別口座の入力結果から、0円継続か再判定候補か確認する。</span>
        </a>

      `,
);

console.log("generated p0_unlock_judgement_engine_20260614.html");
