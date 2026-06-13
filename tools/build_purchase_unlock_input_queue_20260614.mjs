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
  if (/未入力|未確認|購入不可|0円|partial|必須|停止|不可/.test(s)) return "bad";
  if (/注意|確認中|補完|保留|監視|優先/.test(s)) return "warn";
  if (/入力済み|pass|完了|確認済み|通過/.test(s)) return "ok";
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

const events = parseCsv(readText("102_june_event_result_input.csv"));
const accounts = parseCsv(readText("nisa_account_execution_gate_20260614.csv"));
const financials = parseCsv(readText("candidate10_financial_confirmation_gate_20260614.csv"));

const eventQueue = events
  .filter((row) => row.current_status !== "入力済み")
  .map((row) => ({
    区分: "6月イベント",
    対象: `${row.event_id} ${row.event}`,
    優先度: row.current_status === "未入力" ? "最重要" : "高",
    入力ファイル: "102_june_event_result_input.csv",
    入力項目: "actual_value / market_reaction / current_status",
    合格条件: row.pass_condition,
    反映先: "june_event_input_decision_board / integrated_purchase_decision_engine",
    現状: row.current_status || "未入力",
    次アクション: row.current_status === "注意" ? "実数と市場反応を再確認し、黄または赤の扱いを決める" : "イベント結果と市場反応を入力する",
  }));

const accountQueue = accounts.map((row) => ({
  区分: "本人別NISA口座",
  対象: row.account_id,
  優先度: "最重要",
  入力ファイル: "nisa_account_execution_gate_20260614.csv",
  入力項目: "owner_name / broker / nisa_status / phone_status / bank_status / two_factor / nisa_remaining_yen",
  合格条件: "本人名義スマホ・本人ログイン・NISA口座区分・NISA残枠・二段階認証が確認済み",
  反映先: "nisa_account_execution_gate / integrated_purchase_decision_engine / 注文票",
  現状: row.account_ready,
  次アクション: row.next_action,
}));

const financialQueue = financials
  .filter((row) => row.financial_status !== "pass")
  .map((row) => ({
    区分: "公式財務補完",
    対象: `${row.ticker} ${row.name}`,
    優先度: /再選定候補/.test(row.universe_status) ? "最重要" : /監視/.test(row.universe_status) ? "高" : "中",
    入力ファイル: "candidate10_financial_confirmation_gate_20260614.csv",
    入力項目: row.required_items,
    合格条件: "公式IR・決算短信・決算説明資料で数値確認。未確認値はスコアに混ぜない",
    反映先: "candidate10_financial_confirmation_gate / remaining_gap / integrated_purchase_decision_engine",
    現状: row.financial_status,
    次アクション: `${row.source_to_check} を確認。${row.action}`,
  }));

const allRows = [...eventQueue, ...accountQueue, ...financialQueue];
const summaryRows = [
  { 項目: "イベント入力", 件数: `${eventQueue.length}件`, 状態: "E02/E03/E04未入力、E01注意", 目的: "6/18以降の買付上限を0円から再判定する" },
  { 項目: "本人別NISA口座", 件数: `${accountQueue.length}口座`, 状態: "すべて未確認", 目的: "本人操作・NISA区分・残枠がない口座を注文対象にしない" },
  { 項目: "公式財務補完", 件数: `${financialQueue.length}銘柄`, 状態: "partial", 目的: "未確認値を使った見せかけの高スコアを防ぐ" },
  { 項目: "現在の買付上限", 件数: "0円", 状態: "購入不可", 目的: "入力がそろうまで注文票へ金額を出さない" },
];

const orderRows = [
  { 順番: "1", 作業: "6月イベントを入力", 完了条件: "E02、E03、E04のactual_value、market_reaction、current_statusを入力", 完了後: "Green/Yellow/Redの上限を再計算" },
  { 順番: "2", 作業: "本人別NISA口座を入力", 完了条件: "本人名、証券会社、NISA状態、本人スマホ、本人銀行、二段階認証、残枠を確認", 完了後: "口座別の買付上限を再計算" },
  { 順番: "3", 作業: "公式財務partialを補完", 完了条件: "PER/PBR/ROE、利益率、受注、セグメント寄与等を公式資料で確認", 完了後: "銘柄別の比率引上げ可否を再判定" },
  { 順番: "4", 作業: "統合購入可否エンジンを再生成", 完了条件: "上記3種の入力後にエンジンを再生成", 完了後: "0円解除可否、上限、注文票反映の可否が出る" },
];

writeCsv("purchase_unlock_input_queue_20260614.csv", allRows);
writeCsv("purchase_unlock_input_summary_20260614.csv", summaryRows);
writeCsv("purchase_unlock_input_order_20260614.csv", orderRows);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>購入ロック解除 入力キュー</title>
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
  <h1>購入ロック解除 入力キュー</h1>
  <p>現在0円になっている理由を、どのCSVのどの項目を埋めれば再判定できるかまで分解した作業表です。</p>
</header>
<main>
  <section>
    <h2>現在の結論</h2>
    <p class="notice">現在は買付上限0円です。解除には、6月イベント、本人別NISA口座、公式財務partialの補完が必要です。入力がそろうまで注文票へ金額を出しません。</p>
    <div class="cards">
      <div class="card"><b>イベント</b><strong>${eventQueue.length}</strong><span>入力・確認対象</span></div>
      <div class="card"><b>口座</b><strong>${accountQueue.length}</strong><span>本人別確認対象</span></div>
      <div class="card"><b>財務partial</b><strong>${financialQueue.length}</strong><span>公式資料で補完</span></div>
      <div class="card"><b>現上限</b><strong>0円</strong><span>入力完了まで維持</span></div>
    </div>
  </section>

  <section>
    <h2>入力サマリー</h2>
    ${table(["項目", "件数", "状態", "目的"], summaryRows, { 項目: "180px", 件数: "120px", 状態: "280px", 目的: "620px" })}
  </section>

  <section>
    <h2>入力キュー</h2>
    <p class="notice sub">この順に埋めます。未確認のまま点数や買付比率へ混ぜないことを優先します。</p>
    ${table(["区分", "対象", "優先度", "入力ファイル", "入力項目", "合格条件", "反映先", "現状", "次アクション"], allRows, {
      区分: "150px",
      対象: "220px",
      優先度: "90px",
      入力ファイル: "250px",
      入力項目: "350px",
      合格条件: "420px",
      反映先: "330px",
      現状: "120px",
      次アクション: "360px",
    })}
  </section>

  <section>
    <h2>作業順序</h2>
    ${table(["順番", "作業", "完了条件", "完了後"], orderRows, { 順番: "60px", 作業: "230px", 完了条件: "560px", 完了後: "360px" })}
  </section>

  <section>
    <h2>関連画面</h2>
    <div class="links">
      <a href="integrated_purchase_decision_engine_20260614.html">統合購入可否エンジン</a>
      <a href="remaining_gap_hardening_board_20260614.html">未完了改善・購入ロック一覧</a>
      <a href="june_event_input_decision_board_20260614.html">6月イベント入力・判定ボード</a>
      <a href="nisa_account_execution_gate_20260614.html">NISA口座・本人操作 実行ゲート</a>
      <a href="candidate10_financial_confirmation_gate_20260614.html">候補10社 財務確認ゲート</a>
      <a href="latest_practical_start_20260614.html">最新 実用パート入口</a>
    </div>
  </section>
  <footer>作成: ${esc(generatedAt)} / 本画面は購入推奨ではありません。購入不可を解除するために必要な入力項目を整理する画面です。</footer>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "purchase_unlock_input_queue_20260614.html"), html, "utf8");

function insertCard(file, marker, card) {
  const full = path.join(ROOT, file);
  let text = fs.readFileSync(full, "utf8");
  if (text.includes("purchase_unlock_input_queue_20260614.html")) return false;
  const index = text.indexOf(marker);
  if (index === -1) return false;
  text = `${text.slice(0, index + marker.length)}\n${card}\n${text.slice(index + marker.length)}`;
  fs.writeFileSync(full, text, "utf8");
  return true;
}

function insertBefore(file, marker, card) {
  const full = path.join(ROOT, file);
  let text = fs.readFileSync(full, "utf8");
  if (text.includes("purchase_unlock_input_queue_20260614.html")) return false;
  const index = text.indexOf(marker);
  if (index === -1) return false;
  text = `${text.slice(0, index)}${card}\n${text.slice(index)}`.replace(/日々見る画面を10個/g, "日々見る画面を11個");
  fs.writeFileSync(full, text, "utf8");
  return true;
}

insertCard(
  "index.html",
  `<span>イベント、口座、財務、100社扱い、期待仮説をまとめて、各銘柄の0円理由と解除条件を表示。</span>
        </a>`,
  `
        <a class="card" href="purchase_unlock_input_queue_20260614.html">
          <b>購入ロック解除 入力キュー</b>
          <span>現在0円の理由を、どのCSV・どの項目を埋めれば再判定できるかまで整理。</span>
        </a>`,
);

insertCard(
  "896_practical_entry_hub_20260606.html",
  `<span>イベント、口座、財務、100社扱い、期待仮説をまとめて、各銘柄の0円理由と解除条件を表示。</span>
        </a>`,
  `
        <a class="link-card" href="purchase_unlock_input_queue_20260614.html">
          <b>購入ロック解除 入力キュー</b>
          <span>現在0円の理由を、どのCSV・どの項目を埋めれば再判定できるかまで整理。</span>
        </a>`,
);

insertCard(
  "practical_action_cockpit_20260614.html",
  `<li><a href="integrated_purchase_decision_engine_20260614.html">統合購入可否エンジン</a></li>`,
  `
    <li><a href="purchase_unlock_input_queue_20260614.html">購入ロック解除 入力キュー</a></li>`,
);

insertBefore(
  "latest_practical_start_20260614.html",
  `<a class="step" href="integrated_purchase_decision_engine_20260614.html">`,
  `<a class="step" href="purchase_unlock_input_queue_20260614.html">
        <b>6. 購入ロック解除 入力キュー</b>
        <span>0円解除に必要なイベント、口座、公式財務の入力場所を確認する。</span>
        <em>入力作業</em>
      </a>`,
);

{
  const latestFile = path.join(ROOT, "latest_practical_start_20260614.html");
  let latest = fs.readFileSync(latestFile, "utf8");
  latest = latest
    .replace(/日々見る画面を10個/g, "日々見る画面を11個")
    .replace("<b>6. 統合購入可否エンジン</b>", "<b>7. 統合購入可否エンジン</b>")
    .replace("<b>7. 未完了改善・購入ロック一覧</b>", "<b>8. 未完了改善・購入ロック一覧</b>")
    .replace("<b>8. 候補10社 上値・下値・途中決済ルール</b>", "<b>9. 候補10社 上値・下値・途中決済ルール</b>")
    .replace("<b>9. ストップ安・急落対策プロトコル</b>", "<b>10. ストップ安・急落対策プロトコル</b>")
    .replace("<b>10. 購入後 運用記録・予実管理ボード</b>", "<b>11. 購入後 運用記録・予実管理ボード</b>");
  fs.writeFileSync(latestFile, latest, "utf8");
}

for (const file of ["index.html", "896_practical_entry_hub_20260606.html"]) {
  const full = path.join(ROOT, file);
  let text = fs.readFileSync(full, "utf8");
  text = text.replace(/日々見る画面を10個/g, "日々見る画面を11個");
  fs.writeFileSync(full, text, "utf8");
}

console.log("generated purchase_unlock_input_queue_20260614.html");
