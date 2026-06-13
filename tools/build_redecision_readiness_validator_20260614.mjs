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

function cls(value) {
  const s = String(value ?? "");
  if (/再判定不可|不可|未入力|未確認|NG|0円|停止|除外|空欄|未完了/.test(s)) return "bad";
  if (/注意|条件付き|確認中|partial|監視|保留|黄/.test(s)) return "warn";
  if (/OK|確認済み|入力済み|通過|再判定可能|緑/.test(s)) return "ok";
  return "";
}

function table(headers, rows, widths = {}) {
  return `<div class="table-wrap"><table><thead><tr>${headers
    .map((h) => `<th${widths[h] ? ` style="width:${widths[h]}"` : ""}>${esc(h)}</th>`)
    .join("")}</tr></thead><tbody>${rows
    .map(
      (row) =>
        `<tr>${headers
          .map((h) => `<td class="${cls(row[h])}">${esc(row[h])}</td>`)
          .join("")}</tr>`,
    )
    .join("")}</tbody></table></div>`;
}

function blank(value) {
  return String(value ?? "").trim() === "";
}

function numericPositive(value) {
  const n = Number(String(value ?? "").replace(/[円,]/g, ""));
  return Number.isFinite(n) && n > 0;
}

const events = parseCsv(readText("redecision_event_input_template_20260614.csv"));
const accounts = parseCsv(readText("redecision_account_input_template_20260614.csv"));
const financials = parseCsv(readText("redecision_financial_partial_input_template_20260614.csv"));

const eventDetails = events.map((row) => {
  const missing = [];
  if (blank(row.入力する実数) || /確認中/.test(row.入力する実数)) missing.push("入力する実数");
  if (blank(row.市場反応)) missing.push("市場反応");
  if (blank(row.判定入力) || row.判定入力 === "未入力") missing.push("判定入力");
  if (/赤/.test(row.判定入力)) missing.push("赤判定のため停止");
  const status = missing.length ? "NG" : /注意|黄/.test(row.判定入力) ? "条件付き" : "OK";
  return {
    区分: "6月イベント",
    対象: `${row.event_id} ${row.イベント}`,
    検査結果: status,
    不足項目: missing.join(" / ") || "なし",
    再判定への影響: status === "OK" ? "イベントゲート通過候補" : status === "条件付き" ? "黄判定候補。半導体・高PER・高ボラは抑制" : "全銘柄0円継続",
    次アクション: missing.length ? "実数、反応、判定を入力" : "統合エンジンへ反映",
  };
});

const accountFields = ["本人名", "証券会社", "NISA口座", "本人スマホ", "本人銀行口座", "二段階認証", "NISA残枠円"];
const accountDetails = accounts.map((row) => {
  const missing = accountFields.filter((field) => blank(row[field]) || row[field] === "未確認");
  if (!blank(row.NISA残枠円) && !numericPositive(row.NISA残枠円)) missing.push("NISA残枠円が0または数値でない");
  return {
    区分: "本人別NISA口座",
    対象: row.account_id,
    検査結果: missing.length ? "NG" : "OK",
    不足項目: missing.join(" / ") || "なし",
    再判定への影響: missing.length ? "該当口座0円継続" : "本人別注文票の作成候補",
    次アクション: missing.length ? "本人別の口座状態と残枠を入力" : "注文票へ反映",
  };
});

const baseFinancialFields = ["PER", "PBR", "ROE_pct", "営業利益率_pct", "今期会社予想_前期比", "参照URLまたは資料名", "資料日付", "入力状態"];
const financialDetails = financials.map((row) => {
  const required = [...baseFinancialFields];
  if (/受注またはセグメント寄与/.test(row.必須項目)) required.push("受注またはセグメント寄与");
  if (/高PER・高PBR/.test(row.必須項目)) required.push("高PER説明");
  const missing = required.filter((field) => blank(row[field]) || row[field] === "未確認");
  const status = missing.length ? "NG" : /除外/.test(row["100社扱い"]) ? "条件付き" : "OK";
  return {
    区分: "公式財務partial",
    対象: `${row.ticker} ${row.銘柄}`,
    検査結果: status,
    不足項目: missing.join(" / ") || (/除外/.test(row["100社扱い"]) ? "財務入力後も除外理由の再確認が必要" : "なし"),
    再判定への影響: missing.length ? "比率引上げ禁止" : /除外|監視/.test(row["100社扱い"]) ? "財務確認後も監視・保留" : "財務ロック解除候補",
    次アクション: missing.length ? "公式IRで不足項目を補完" : "統合エンジンへ反映",
  };
});

const detailRows = [...eventDetails, ...accountDetails, ...financialDetails];
const ngCount = detailRows.filter((row) => row.検査結果 === "NG").length;
const warnCount = detailRows.filter((row) => row.検査結果 === "条件付き").length;
const okCount = detailRows.filter((row) => row.検査結果 === "OK").length;
const total = detailRows.length;

const categoryRows = [
  {
    検査区分: "6月イベント",
    対象数: `${eventDetails.length}件`,
    OK: `${eventDetails.filter((row) => row.検査結果 === "OK").length}件`,
    条件付き: `${eventDetails.filter((row) => row.検査結果 === "条件付き").length}件`,
    NG: `${eventDetails.filter((row) => row.検査結果 === "NG").length}件`,
    判定: eventDetails.some((row) => row.検査結果 === "NG") ? "再判定不可" : "条件付き再判定",
  },
  {
    検査区分: "本人別NISA口座",
    対象数: `${accountDetails.length}口座`,
    OK: `${accountDetails.filter((row) => row.検査結果 === "OK").length}口座`,
    条件付き: `${accountDetails.filter((row) => row.検査結果 === "条件付き").length}口座`,
    NG: `${accountDetails.filter((row) => row.検査結果 === "NG").length}口座`,
    判定: accountDetails.some((row) => row.検査結果 === "NG") ? "再判定不可" : "再判定可能",
  },
  {
    検査区分: "公式財務partial",
    対象数: `${financialDetails.length}銘柄`,
    OK: `${financialDetails.filter((row) => row.検査結果 === "OK").length}銘柄`,
    条件付き: `${financialDetails.filter((row) => row.検査結果 === "条件付き").length}銘柄`,
    NG: `${financialDetails.filter((row) => row.検査結果 === "NG").length}銘柄`,
    判定: financialDetails.some((row) => row.検査結果 === "NG") ? "再判定不可" : "条件付き再判定",
  },
];

const summaryRows = [
  { 項目: "総合判定", 内容: ngCount > 0 ? "再判定不可" : warnCount > 0 ? "条件付き再判定" : "再判定可能", 数値: `${okCount} OK / ${warnCount} 条件付き / ${ngCount} NG / ${total}件`, 影響: ngCount > 0 ? "統合購入可否エンジンを再生成しても購入上限0円が残る" : "統合購入可否エンジンへ反映可能" },
  { 項目: "次の最優先", 内容: "NG項目を埋める", 数値: `${ngCount}件`, 影響: "イベント、口座、財務の順に入力する" },
  { 項目: "現在の注文票", 内容: "反映不可", 数値: "0円", 影響: "再判定可能になるまで注文票へ金額を出さない" },
];

writeCsv("redecision_readiness_summary_20260614.csv", summaryRows);
writeCsv("redecision_readiness_category_20260614.csv", categoryRows);
writeCsv("redecision_readiness_detail_20260614.csv", detailRows);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>再判定準備バリデーター</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--warn:#9a5b00;--red:#b42318;--green:#116b4f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.7}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);line-height:1.2;letter-spacing:0}
    header p{margin:0;font-weight:800;max-width:1180px}
    main{max-width:1600px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08)}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:25px}
    .notice{border-left:8px solid var(--red);background:#fff1f1;border-radius:10px;padding:14px 16px;font-weight:900;margin:0 0 14px}
    .sub{border-left-color:var(--blue);background:#eef7ff}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:15px}
    .card strong{display:block;font-size:28px;line-height:1.25;color:var(--blue)}
    .card span{display:block;font-weight:800;color:#263e55}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin-top:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:10px 12px;vertical-align:top;overflow-wrap:anywhere;word-break:normal}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    td.ok{color:var(--green);font-weight:900}
    td.warn{color:var(--warn);font-weight:900}
    td.bad{color:var(--red);font-weight:900}
    .links{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .links a{display:block;text-decoration:none;color:var(--ink);border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:12px;font-weight:900}
    footer{font-size:13px;color:#526b82;margin:20px 0}
    @media(max-width:900px){main{padding:12px}.cards,.links{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:12px;padding:6px 7px}}
  </style>
</head>
<body>
<header>
  <h1>再判定準備バリデーター</h1>
  <p>6/18再判定入力作業台に入れた内容が、統合購入可否エンジンへ反映できる状態かを検査します。</p>
</header>
<main>
  <section>
    <h2>現在の結論</h2>
    <p class="notice">現在は再判定不可です。NG項目が残っているため、統合購入可否エンジンを再生成しても買付上限0円が残ります。</p>
    <div class="cards">
      <div class="card"><b>総合</b><strong>${ngCount > 0 ? "不可" : warnCount > 0 ? "条件付き" : "可能"}</strong><span>再判定準備</span></div>
      <div class="card"><b>OK</b><strong>${okCount}</strong><span>入力済み</span></div>
      <div class="card"><b>条件付き</b><strong>${warnCount}</strong><span>注意・監視</span></div>
      <div class="card"><b>NG</b><strong>${ngCount}</strong><span>入力不足</span></div>
    </div>
  </section>

  <section>
    <h2>総合サマリー</h2>
    ${table(["項目", "内容", "数値", "影響"], summaryRows, { 項目: "160px", 内容: "220px", 数値: "260px", 影響: "650px" })}
  </section>

  <section>
    <h2>区分別検査</h2>
    ${table(["検査区分", "対象数", "OK", "条件付き", "NG", "判定"], categoryRows, { 検査区分: "200px", 対象数: "130px", 判定: "180px" })}
  </section>

  <section>
    <h2>詳細検査</h2>
    <p class="notice sub">ここでNGになっている項目を埋めると、再判定の準備が進みます。</p>
    ${table(["区分", "対象", "検査結果", "不足項目", "再判定への影響", "次アクション"], detailRows, {
      区分: "160px",
      対象: "220px",
      検査結果: "100px",
      不足項目: "360px",
      再判定への影響: "320px",
      次アクション: "320px",
    })}
  </section>

  <section>
    <h2>関連画面</h2>
    <div class="links">
      <a href="redecision_input_workbench_20260614.html">6/18再判定 入力作業台</a>
      <a href="purchase_unlock_input_queue_20260614.html">購入ロック解除 入力キュー</a>
      <a href="integrated_purchase_decision_engine_20260614.html">統合購入可否エンジン</a>
      <a href="redecision_event_input_template_20260614.csv">イベント入力CSV</a>
      <a href="redecision_account_input_template_20260614.csv">本人別口座入力CSV</a>
      <a href="redecision_financial_partial_input_template_20260614.csv">財務partial補完CSV</a>
    </div>
  </section>
  <footer>作成: ${esc(generatedAt)} / 本画面は購入推奨ではありません。再判定前の入力漏れを検査する画面です。</footer>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "redecision_readiness_validator_20260614.html"), html, "utf8");

function insertCard(file, marker, card) {
  const full = path.join(ROOT, file);
  let text = fs.readFileSync(full, "utf8");
  if (text.includes("redecision_readiness_validator_20260614.html")) return false;
  const index = text.indexOf(marker);
  if (index === -1) return false;
  text = `${text.slice(0, index + marker.length)}\n${card}\n${text.slice(index + marker.length)}`;
  fs.writeFileSync(full, text, "utf8");
  return true;
}

insertCard(
  "redecision_input_workbench_20260614.html",
  `<a href="purchase_unlock_input_queue_20260614.html">購入ロック解除 入力キュー</a>`,
  `
      <a href="redecision_readiness_validator_20260614.html">再判定準備バリデーター</a>`,
);

insertCard(
  "purchase_unlock_input_queue_20260614.html",
  `<a href="redecision_input_workbench_20260614.html">6/18再判定 入力作業台</a>`,
  `
      <a href="redecision_readiness_validator_20260614.html">再判定準備バリデーター</a>`,
);

console.log("generated redecision_readiness_validator_20260614.html");
