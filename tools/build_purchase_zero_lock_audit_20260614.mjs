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
  const text = String(value ?? "");
  if (/0 NG/.test(text)) return "ok";
  if (/NG|不整合|危険|要修正|購入可の疑い|現在値に非ゼロ|不可/.test(text)) return "bad";
  if (/注意|参考値|要確認|条件付き|試算/.test(text)) return "warn";
  if (/OK|整合|0円維持|安全側|確認済み/.test(text)) return "ok";
  return "";
}

function table(headers, rows, widths = {}) {
  return `<div class="table-wrap"><table><thead><tr>${headers
    .map((h) => `<th${widths[h] ? ` style="width:${widths[h]}"` : ""}>${esc(h)}</th>`)
    .join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${headers.map((h) => `<td class="${cls(row[h])}">${esc(row[h])}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

function yenNumber(value) {
  const n = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function status(ok) {
  return ok ? "OK" : "NG";
}

const integrated = parseCsv(readText("integrated_purchase_decision_engine_20260614.csv"));
const outputPreview = parseCsv(readText("redecision_output_preview_by_ticker_20260614.csv"));
const accounts = parseCsv(readText("nisa_account_execution_gate_20260614.csv"));
const allocationByTicker = parseCsv(readText("108_capital_allocation_by_ticker.csv"));
const benchmarkSwitch = parseCsv(readText("benchmark_allocation_switchboard_20260614.csv"));

const checks = [];

const integratedBad = integrated.filter((row) => yenNumber(row.現上限) > 0 || row.注文票反映 !== "反映しない");
checks.push({
  監査項目: "統合購入可否エンジン",
  判定: status(integratedBad.length === 0),
  現在値: integratedBad.length === 0 ? "10銘柄すべて0円維持" : `${integratedBad.length}銘柄に非ゼロまたは反映あり`,
  参考値の扱い: "緑時参考上限・黄時参考上限は試算。現在の注文金額ではない",
  修正が必要な場合: integratedBad.map((row) => row.ticker).join(" / ") || "なし",
});

const outputBad = outputPreview.filter((row) => yenNumber(row.出力金額) > 0 || row.注文票反映 !== "反映しない");
checks.push({
  監査項目: "再判定出力プレビュー",
  判定: status(outputBad.length === 0),
  現在値: outputBad.length === 0 ? "10銘柄すべて0円維持" : `${outputBad.length}銘柄に出力金額あり`,
  参考値の扱い: "入力後の仮計算画面。未入力が残る場合は0円",
  修正が必要な場合: outputBad.map((row) => row.ticker).join(" / ") || "なし",
});

const accountBad = accounts.filter((row) => yenNumber(row.account_buy_upper_yen) > 0 || row.account_ready !== "購入不可");
checks.push({
  監査項目: "本人別NISA口座ゲート",
  判定: status(accountBad.length === 0),
  現在値: accountBad.length === 0 ? "10口座すべて0円維持" : `${accountBad.length}口座に非ゼロまたは購入可の疑い`,
  参考値の扱い: "本人名義スマホ・本人ログイン・本人操作・残枠確認まで0円",
  修正が必要な場合: accountBad.map((row) => row.account_id).join(" / ") || "なし",
});

const allocBad = allocationByTicker.filter((row) => yenNumber(row.current_allocation_yen) > 0);
checks.push({
  監査項目: "資金配分CSV",
  判定: status(allocBad.length === 0),
  現在値: allocBad.length === 0 ? "current_allocation_yen は全銘柄0円" : `${allocBad.length}銘柄に現在配分あり`,
  参考値の扱い: "all_pass_allocation_yen と attention_allocation_yen は将来条件用の参考値",
  修正が必要な場合: allocBad.map((row) => row.ticker).join(" / ") || "なし",
});

const currentSwitch = benchmarkSwitch.find((row) => row.判定 === "現在") ?? {};
const switchOk = String(currentSwitch.個別株比率 ?? "") === "0%" && yenNumber(currentSwitch.個別株上限) === 0;
checks.push({
  監査項目: "S&P500/TOPIX比率スイッチ",
  判定: status(switchOk),
  現在値: switchOk ? "現在判定は個別株0%・0円" : `現在判定が ${currentSwitch.個別株比率 ?? "未取得"} / ${currentSwitch.個別株上限 ?? "未取得"}`,
  参考値の扱い: "緑・黄・橙・赤は6月イベント後に使う条件分岐",
  修正が必要な場合: switchOk ? "なし" : "現在行を0%・0円へ修正",
});

const totalNg = checks.filter((row) => row.判定 === "NG").length;
const summaryRows = [
  {
    項目: "総合監査",
    内容: totalNg === 0 ? "0円ロック整合" : "不整合あり",
    数値: `${checks.length - totalNg} OK / ${totalNg} NG`,
    扱い: totalNg === 0 ? "現在の画面・CSVは注文票へ金額を出さない状態で整合" : "NG項目を修正するまで注文票へ進めない",
  },
  {
    項目: "現在の実務判断",
    内容: "購入不可",
    数値: "買付上限0円",
    扱い: "6月イベント、本人別口座、公式財務partialがそろうまで維持",
  },
  {
    項目: "参考値の位置づけ",
    内容: "試算値",
    数値: "緑時・黄時・全確認後など",
    扱い: "現在の注文金額ではなく、条件成立後の上限候補として表示",
  },
];

writeCsv("purchase_zero_lock_audit_summary_20260614.csv", summaryRows);
writeCsv("purchase_zero_lock_audit_detail_20260614.csv", checks);

const css = `
  :root{--ink:#071927;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--red:#b42318;--warn:#9a5b00;--green:#116b4f}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.7}
  header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:30px}
  header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);letter-spacing:0;line-height:1.2}
  header p{margin:0;font-weight:800;max-width:1180px}
  main{max-width:1460px;margin:0 auto;padding:22px}
  section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08)}
  h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:25px}
  .notice{border-left:8px solid var(--red);background:#fff1f1;border-radius:10px;padding:14px 16px;font-weight:900;margin:0 0 14px}
  .cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
  .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
  .card b{display:block;color:var(--navy);font-size:15px}
  .card strong{display:block;font-size:28px;line-height:1.25;color:var(--blue)}
  .card span{font-weight:800;color:#263e55}
  .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px}
  table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
  th,td{border:1px solid var(--line);padding:10px 12px;vertical-align:top;overflow-wrap:anywhere;word-break:normal}
  th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
  td.ok{color:var(--green);font-weight:900}
  td.warn{color:var(--warn);font-weight:900}
  td.bad{color:var(--red);font-weight:900}
  .links{display:flex;flex-wrap:wrap;gap:10px}
  .links a{display:inline-block;text-decoration:none;background:#0b67a3;color:#fff;border-radius:9px;padding:10px 13px;font-weight:900}
  footer{font-size:13px;color:#526b82;margin:20px 0}
  @media(max-width:900px){main{padding:12px}.cards{grid-template-columns:1fr}body{font-size:16px}}
  @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:11px;padding:6px 7px}}
`;

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>0円ロック整合性監査</title>
  <style>${css}</style>
</head>
<body>
<header>
  <h1>0円ロック整合性監査</h1>
  <p>購入不可の状態なのに、別画面やCSVへ買付金額が残っていないかを確認します。参考値と現在の注文金額を分けて監査します。</p>
</header>
<main>
  <section>
    <h2>現在の結論</h2>
    <p class="notice">現時点では購入不可・買付上限0円です。参考上限は条件成立後の試算であり、現在の注文金額ではありません。</p>
    <div class="cards">
      <div class="card"><b>総合監査</b><strong>${esc(summaryRows[0].内容)}</strong><span>${esc(summaryRows[0].数値)}</span></div>
      <div class="card"><b>現在の実務判断</b><strong>購入不可</strong><span>買付上限0円</span></div>
      <div class="card"><b>NG項目</b><strong>${totalNg}</strong><span>0なら整合</span></div>
    </div>
  </section>

  <section>
    <h2>監査サマリー</h2>
    ${table(["項目", "内容", "数値", "扱い"], summaryRows, { "扱い": "620px" })}
  </section>

  <section>
    <h2>詳細監査</h2>
    ${table(["監査項目", "判定", "現在値", "参考値の扱い", "修正が必要な場合"], checks, { "参考値の扱い": "460px", "修正が必要な場合": "360px" })}
  </section>

  <section>
    <h2>関連画面</h2>
    <div class="links">
      <a href="redecision_output_preview_20260614.html">再判定出力プレビュー</a>
      <a href="redecision_readiness_validator_20260614.html">再判定準備バリデーター</a>
      <a href="integrated_purchase_decision_engine_20260614.html">統合購入可否エンジン</a>
      <a href="benchmark_allocation_switchboard_20260614.html">S&P500/TOPIX比率スイッチ</a>
      <a href="latest_practical_start_20260614.html">最新 実用パート入口</a>
    </div>
  </section>

  <footer>作成: ${esc(generatedAt)} / 監査は入力不足時の誤反映を防ぐための安全確認です。</footer>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "purchase_zero_lock_audit_20260614.html"), html, "utf8");

function insertLink(file, anchor, linkHtml) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return;
  const text = fs.readFileSync(full, "utf8");
  if (text.includes("purchase_zero_lock_audit_20260614.html")) return;
  fs.writeFileSync(full, text.replace(anchor, `${anchor}\n      ${linkHtml}`), "utf8");
}

insertLink(
  "redecision_output_preview_20260614.html",
  '<a href="latest_practical_start_20260614.html">最新 実用パート入口</a>',
  '<a href="purchase_zero_lock_audit_20260614.html">0円ロック整合性監査</a>',
);

insertLink(
  "latest_practical_start_20260614.html",
  '<em>出力確認</em>\n      </a>',
  '<a class="step" href="purchase_zero_lock_audit_20260614.html">\n        <b>6-4. 0円ロック整合性監査</b>\n        <span>購入不可の状態で、他画面やCSVに非ゼロ金額が残っていないか確認する。</span>\n        <em>安全監査</em>\n      </a>',
);

insertLink(
  "index.html",
  '<a class="card" href="redecision_output_preview_20260614.html">',
  '<a class="card" href="purchase_zero_lock_audit_20260614.html">\n          <b>0円ロック整合性監査</b>\n          <span>購入不可の状態で、画面やCSVに買付金額が残っていないか確認する。</span>\n        </a>\n\n        <a class="card" href="redecision_output_preview_20260614.html">',
);

console.log("generated purchase_zero_lock_audit_20260614.html");
