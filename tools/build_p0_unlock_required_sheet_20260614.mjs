import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/14 21:05";

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

function statusClass(value) {
  const s = String(value ?? "");
  if (/(未入力|未確認|購入不可|0円|停止|赤|NG)/.test(s)) return "bad";
  if (/(注意|確認|黄|入力済み\/確認中|要確認)/.test(s)) return "warn";
  if (/(確認済み|緑|OK|完了|反映可)/.test(s)) return "ok";
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

function isBlank(value) {
  return String(value ?? "").trim() === "";
}

const eventRows = parseCsv(readText("redecision_event_input_template_20260614.csv"));
const accountRows = parseCsv(readText("redecision_account_input_template_20260614.csv"));

const eventSheet = eventRows.map((r, i) => {
  const missing = [];
  if (isBlank(r.入力する実数) || /確認中/.test(r.入力する実数)) missing.push("実数確定");
  if (isBlank(r.市場反応)) missing.push("市場反応");
  if (isBlank(r.判定入力) || r.判定入力 === "未入力") missing.push("判定入力");
  const status = missing.length === 0 && !/赤/.test(r.判定入力) ? "確認済み" : r.判定入力 || r.市場反応 || "未入力";
  return {
    優先: `P0-${String(i + 1).padStart(2, "0")}`,
    区分: "6月イベント",
    対象: `${r.event_id} ${r.日付} ${r.イベント}`,
    入力先: "redecision_event_input_template_20260614.csv",
    必須入力: "実数 / 市場反応 / 判定入力 / 入力メモ",
    現在: status,
    不足: missing.join(" / ") || "なし",
    合格条件: r.合格条件,
    赤なら何をするか: r.失敗時対応 || "買付延期または比率引下げ",
    完了後: "全体ゲートを再判定。赤・未入力が残れば全銘柄0円。",
  };
});

const accountSheet = accountRows.map((r, i) => {
  const fields = ["本人名", "証券会社", "NISA口座", "本人スマホ", "本人銀行口座", "二段階認証", "NISA残枠円"];
  const missing = fields.filter((field) => isBlank(r[field]));
  return {
    優先: `P0-${String(i + 5).padStart(2, "0")}`,
    区分: "本人別NISA口座",
    対象: r.account_id,
    入力先: "redecision_account_input_template_20260614.csv",
    必須入力: fields.join(" / "),
    現在: missing.length ? "未確認" : "確認済み",
    不足: missing.join(" / ") || "なし",
    合格条件: "本人名義、本人スマホ、本人ログイン、NISA口座区分、二段階認証、NISA残枠を確認",
    赤なら何をするか: "該当本人分は買付不可。注文票へ反映しない。",
    完了後: "本人別注文票の作成可否を再判定。",
  };
});

const allRows = [...eventSheet, ...accountSheet];
writeCsv("p0_unlock_required_sheet_20260614.csv", allRows);

const summaryRows = [
  {
    項目: "P0合計",
    件数: `${allRows.length}件`,
    現状: `${allRows.filter((r) => r.現在 !== "確認済み").length}件が未完了`,
    意味: "P0が残る限り、候補銘柄の評価に関係なく買付上限0円。",
  },
  {
    項目: "6月イベント",
    件数: `${eventSheet.length}件`,
    現状: `${eventSheet.filter((r) => r.現在 !== "確認済み").length}件が未完了`,
    意味: "市場全体の買付可否、半導体・高PERの抑制条件を決める。",
  },
  {
    項目: "本人別口座",
    件数: `${accountSheet.length}口座`,
    現状: `${accountSheet.filter((r) => r.現在 !== "確認済み").length}口座が未確認`,
    意味: "本人別に注文票へ反映できるかを決める。",
  },
  {
    項目: "現在の買付上限",
    件数: "0円",
    現状: "購入不可",
    意味: "P0完了後に再判定するまで、金額は出さない。",
  },
];
writeCsv("p0_unlock_required_summary_20260614.csv", summaryRows);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>P0 買付ロック解除 必須入力シート</title>
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
  <h1>P0 買付ロック解除 必須入力シート</h1>
  <p>最初に埋めるべき全体停止条件だけを切り出した画面です。ここでは銘柄評価ではなく、買付判断に進める前提条件を確認します。</p>
</header>
<main>
  <section>
    <h2>現在の結論</h2>
    <p class="notice">P0が残っているため、現在は購入不可・買付上限0円です。銘柄のスコアが高くても、イベントと本人別口座が未確認なら注文票へ進めません。</p>
    <div class="cards">
      ${card("P0合計", `${allRows.length}件`, "イベント4件 + 口座10件", "bad")}
      ${card("未完了", `${allRows.filter((r) => r.現在 !== "確認済み").length}件`, "確認済みになるまで0円維持", "bad")}
      ${card("イベント", `${eventSheet.length}件`, "日銀・FOMC・最終確認を含む", "warn")}
      ${card("本人別口座", `${accountSheet.length}口座`, "本人操作・NISA残枠確認", "bad")}
    </div>
  </section>

  <section>
    <h2>使い方</h2>
    <p class="notice sub">この画面の入力対象を埋めたあと、再判定準備バリデーターと統合購入可否エンジンを確認します。P0完了は買付決定ではなく、ようやく再判定へ進める状態です。</p>
  </section>

  <section>
    <h2>6月イベント入力</h2>
    ${table(eventSheet, [
      { key: "優先", label: "優先" },
      { key: "対象", label: "対象" },
      { key: "入力先", label: "入力先" },
      { key: "必須入力", label: "必須入力" },
      { key: "現在", label: "現在" },
      { key: "不足", label: "不足" },
      { key: "合格条件", label: "合格条件" },
      { key: "赤なら何をするか", label: "赤なら何をするか" },
    ])}
  </section>

  <section>
    <h2>本人別NISA口座入力</h2>
    ${table(accountSheet, [
      { key: "優先", label: "優先" },
      { key: "対象", label: "対象" },
      { key: "入力先", label: "入力先" },
      { key: "必須入力", label: "必須入力" },
      { key: "現在", label: "現在" },
      { key: "不足", label: "不足" },
      { key: "合格条件", label: "合格条件" },
      { key: "赤なら何をするか", label: "未完了なら何をするか" },
    ])}
  </section>

  <section>
    <h2>サマリー</h2>
    ${table(summaryRows, [
      { key: "項目", label: "項目" },
      { key: "件数", label: "件数" },
      { key: "現状", label: "現状" },
      { key: "意味", label: "意味" },
    ])}
  </section>

  <section>
    <h2>関連画面</h2>
    <div class="links">
      <a href="daily_practical_compact_board_20260614.html">実用日次ボード</a>
      <a href="unlock_next_action_tickets_20260614.html">買付ロック解除 次アクションチケット</a>
      <a href="unlock_input_workflow_20260614.html">買付ロック解除 入力ワークフロー</a>
      <a href="redecision_readiness_validator_20260614.html">再判定準備バリデーター</a>
      <a href="june_event_input_decision_board_20260614.html">6月イベント入力判断</a>
      <a href="nisa_account_execution_gate_20260614.html">NISA口座実行ゲート</a>
    </div>
  </section>

  <footer>作成: ${h(generatedAt)} / 本画面は買付指示ではなく、買付判断前の必須前提を確認するための作業表です。</footer>
</main>
</body>
</html>`;

fs.writeFileSync(p("p0_unlock_required_sheet_20260614.html"), html, "utf8");

function insertLink(file, marker, htmlToInsert) {
  const full = p(file);
  if (!fs.existsSync(full)) return;
  let text = fs.readFileSync(full, "utf8");
  if (text.includes("p0_unlock_required_sheet_20260614.html")) return;
  const idx = text.indexOf(marker);
  if (idx === -1) return;
  text = text.slice(0, idx) + htmlToInsert + text.slice(idx);
  fs.writeFileSync(full, text, "utf8");
}

insertLink(
  "daily_practical_compact_board_20260614.html",
  '<a href="unlock_next_action_tickets_20260614.html">',
  '<a href="p0_unlock_required_sheet_20260614.html">P0 買付ロック解除 必須入力シート</a>',
);

insertLink(
  "unlock_next_action_tickets_20260614.html",
  '<a href="daily_practical_compact_board_20260614.html">',
  '<a href="p0_unlock_required_sheet_20260614.html">P0 買付ロック解除 必須入力シート</a>',
);

insertLink(
  "latest_practical_start_20260614.html",
  '<a class="step" href="integrated_purchase_decision_engine_20260614.html">',
  `<a class="step" href="p0_unlock_required_sheet_20260614.html">
        <b>6-10. P0 買付ロック解除 必須入力シート</b>
        <span>イベント4件と本人別口座10件だけを確認する。</span>
        <em>P0限定</em>
      </a>
`,
);

insertLink(
  "index.html",
  '<a class="card" href="unlock_next_action_tickets_20260614.html">',
  `<a class="card" href="p0_unlock_required_sheet_20260614.html">
          <b>P0 買付ロック解除 必須入力シート</b>
          <span>最初に埋めるイベント4件と本人別口座10件だけを確認する。</span>
        </a>

      `,
);

console.log("generated p0_unlock_required_sheet_20260614.html");
