import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/14 23:55";
const csvFile = "p1_financial_source_navigator_20260614.csv";
const htmlFile = "p1_financial_source_navigator_20260614.html";

function p(file) {
  return path.join(ROOT, file);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, rows) {
  const headers = Object.keys(rows[0]);
  const body = [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
  fs.writeFileSync(p(file), `\uFEFF${body}\n`, "utf8");
}

function h(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusClass(value) {
  const text = String(value ?? "");
  if (/(未確認|未完了|不可|0円|接続不安定|反映しない)/.test(text)) return "bad";
  if (/(要確認|一部|P1|P2|トップのみ|手入力)/.test(text)) return "warn";
  if (/(取得済み|公式IR|200|確認済み)/.test(text)) return "ok";
  return "";
}

function table(rows, columns) {
  return `<div class="table-wrap"><table><thead><tr>${columns.map((column) => `<th>${h(column.label)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${columns.map((column) => {
      const value = row[column.key];
      if (column.link && value) {
        return `<td class="${statusClass(value)}"><a href="${h(value)}" target="_blank" rel="noopener">${h(value)}</a></td>`;
      }
      return `<td class="${statusClass(value)}">${h(value)}</td>`;
    }).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

function card(title, value, note, className = "") {
  return `<div class="card ${className}"><b>${h(title)}</b><strong>${h(value)}</strong><span>${h(note)}</span></div>`;
}

function readText(file) {
  return fs.existsSync(p(file)) ? fs.readFileSync(p(file), "utf8") : "";
}

function ensureLink(file, href, label, note) {
  if (!fs.existsSync(p(file))) return;
  const text = readText(file);
  if (text.includes(href)) return;
  const cardHtml = `<a class="card" href="${href}">
          <b>${label}</b>
          <span>${note}</span>
        </a>
`;
  const updated = text.replace(/<a class="card" href="p1_financial_input_validator_20260614\.html">[\s\S]*?<\/a>\s*/u, (match) => `${match}${cardHtml}`);
  fs.writeFileSync(p(file), updated, "utf8");
}

function ensureStepLink(file, href, label, note) {
  if (!fs.existsSync(p(file))) return;
  const text = readText(file);
  if (text.includes(href)) return;
  const stepHtml = `<a class="step" href="${href}">
        <b>${label}</b>
        <span>${note}</span>
        <em>資料台帳</em>
      </a>
`;
  const updated = text.replace(/<a class="step" href="p1_financial_input_validator_20260614\.html">[\s\S]*?<\/a>\s*/u, (match) => `${match}${stepHtml}`);
  fs.writeFileSync(p(file), updated, "utf8");
}

function ensureCompactLink(file, href, label) {
  if (!fs.existsSync(p(file))) return;
  const text = readText(file);
  if (text.includes(href)) return;
  const updated = text.replace(
    /<a href="p1_financial_input_validator_20260614\.html">P1 財務入力バリデーター<\/a>/u,
    `<a href="p1_financial_input_validator_20260614.html">P1 財務入力バリデーター</a>\n<a href="${href}">${label}</a>`,
  );
  fs.writeFileSync(p(file), updated, "utf8");
}

const rows = [
  {
    優先区分: "P1",
    ticker: "6503.T",
    銘柄: "三菱電機",
    現在扱い: "財務補完後に確認",
    公式IR入口: "https://www.mitsubishielectric.co.jp/ir/library/",
    疎通状態: "取得済み 200",
    直接資料状態: "決算短信・説明資料のPDF特定は未完了",
    入力する主項目: "PER/PBR/ROE/営業利益率/会社予想/受注またはセグメント寄与",
    作業方法: "IRライブラリから最新決算短信・決算説明資料を開き、入力CSVへ転記する",
    買付反映: "反映しない",
  },
  {
    優先区分: "P1",
    ticker: "6762.T",
    銘柄: "TDK",
    現在扱い: "財務補完後に確認",
    公式IR入口: "https://www.tdk.com/ja/ir/",
    疎通状態: "IRトップ取得済み 200",
    直接資料状態: "決算専用URLは接続不安定。IRトップから手動確認",
    入力する主項目: "PER/PBR/ROE/営業利益率/会社予想/受注またはセグメント寄与",
    作業方法: "IRトップから決算説明会・業績情報へ進み、資料名と日付を残して入力する",
    買付反映: "反映しない",
  },
  {
    優先区分: "P2",
    ticker: "5803.T",
    銘柄: "フジクラ",
    現在扱い: "除外継続",
    公式IR入口: "https://www.fujikura.co.jp/ir/",
    疎通状態: "取得済み 200",
    直接資料状態: "決算短信・説明資料のPDF特定は未完了",
    入力する主項目: "PER/PBR/ROE/営業利益率/会社予想/受注またはセグメント寄与/高PER説明",
    作業方法: "決算情報から会社予想とデータセンター・電線需要の利益寄与を確認する",
    買付反映: "反映しない",
  },
  {
    優先区分: "P2",
    ticker: "6146.T",
    銘柄: "ディスコ",
    現在扱い: "除外継続",
    公式IR入口: "https://www.disco.co.jp/ir/",
    疎通状態: "取得済み 200",
    直接資料状態: "決算説明資料のPDF特定は未完了",
    入力する主項目: "PER/PBR/ROE/営業利益率/会社予想/受注またはセグメント寄与/高PER説明",
    作業方法: "決算説明資料から精密加工装置・消耗品の需要と高PER説明を確認する",
    買付反映: "反映しない",
  },
  {
    優先区分: "P2",
    ticker: "6857.T",
    銘柄: "アドバンテスト",
    現在扱い: "監視継続",
    公式IR入口: "https://www.advantest.com/ja/investors/",
    疎通状態: "取得済み 200",
    直接資料状態: "決算資料のPDF特定は未完了",
    入力する主項目: "PER/PBR/ROE/営業利益率/会社予想/受注またはセグメント寄与/高PER説明",
    作業方法: "半導体試験装置の受注・生成AI向け需要・会社予想を確認する",
    買付反映: "反映しない",
  },
  {
    優先区分: "P2",
    ticker: "7011.T",
    銘柄: "三菱重工業",
    現在扱い: "除外継続",
    公式IR入口: "https://www.mhi.com/jp/finance/",
    疎通状態: "取得済み 200",
    直接資料状態: "決算資料のPDF特定は未完了",
    入力する主項目: "PER/PBR/ROE/営業利益率/会社予想/受注またはセグメント寄与",
    作業方法: "決算資料から受注残、防衛・エネルギー・航空宇宙の利益寄与を確認する",
    買付反映: "反映しない",
  },
  {
    優先区分: "P2",
    ticker: "8035.T",
    銘柄: "東京エレクトロン",
    現在扱い: "監視継続",
    公式IR入口: "https://www.tel.co.jp/ir/",
    疎通状態: "取得済み 200",
    直接資料状態: "決算短信・説明資料のPDF特定は未完了",
    入力する主項目: "PER/PBR/ROE/営業利益率/会社予想/受注またはセグメント寄与/高PER説明",
    作業方法: "半導体製造装置の需要、会社予想、地域別・装置別の説明を確認する",
    買付反映: "反映しない",
  },
];

writeCsv(csvFile, rows);

const verified = rows.filter((row) => row.疎通状態.includes("200")).length;
const directMissing = rows.filter((row) => row.直接資料状態.includes("未完了") || row.直接資料状態.includes("不安定")).length;

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>P1 財務公式資料ナビ</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--warn:#9d5b00;--red:#a01818;--green:#116b4f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.75}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:white;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);line-height:1.2;letter-spacing:0}
    header p{margin:0;max-width:1100px;font-size:19px}
    main{max-width:1280px;margin:auto;padding:24px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:14px;margin:18px 0;padding:22px;break-inside:avoid;page-break-inside:avoid}
    h2{font-size:26px;margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;line-height:1.35}
    .lead{font-size:19px;margin:0 0 14px}
    .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:14px 0}
    .card{border:1px solid var(--line);border-radius:12px;padding:16px;background:#f9fcff;min-height:124px}
    .card b{display:block;font-size:17px}
    .card strong{display:block;font-size:31px;line-height:1.2;margin:8px 0;color:var(--navy)}
    .card span{display:block;font-size:15px}
    .bad strong,.bad{color:var(--red);font-weight:700}
    .warn strong,.warn{color:var(--warn);font-weight:700}
    .ok strong,.ok{color:var(--green);font-weight:700}
    .table-wrap{overflow:auto;border:1px solid var(--line);border-radius:10px;margin-top:10px}
    table{width:100%;border-collapse:collapse;background:white}
    th,td{border-bottom:1px solid var(--line);border-right:1px solid var(--line);padding:9px 10px;vertical-align:top;text-align:left;overflow-wrap:anywhere}
    th{background:#e7f2fb;color:#07395f;font-weight:800;white-space:nowrap}
    tr:last-child td{border-bottom:0}
    a{color:#064f86;font-weight:800}
    .note{border-left:6px solid var(--warn);background:#fff7e8;padding:14px;margin-top:12px;border-radius:10px}
    .links{display:flex;flex-wrap:wrap;gap:10px}
    .links a{display:inline-block;padding:10px 14px;border:1px solid #87bce0;border-radius:999px;background:#eef8ff;color:#07395f;text-decoration:none;font-weight:800}
    @media print{body{background:white;font-size:15px}header{padding:18px 24px}main{padding:0 18px;max-width:none}section{break-inside:avoid;page-break-inside:avoid;border-radius:0}.table-wrap{overflow:visible}th,td{font-size:12px;padding:5px 6px}.links{display:none}}
  </style>
</head>
<body>
  <header>
    <h1>P1 財務公式資料ナビ</h1>
    <p>財務partialの7銘柄について、どの公式IR入口から決算資料を確認し、どの項目を入力するかを整理した台帳です。公式IR入口の疎通と、決算PDFの特定状況は分けて表示します。</p>
  </header>
  <main>
    <section>
      <h2>現在の結論</h2>
      <div class="cards">
        ${card("対象銘柄", `${rows.length}銘柄`, "財務partialが残っている候補", "warn")}
        ${card("公式IR入口", `${verified}/${rows.length}`, "取得済み200またはトップ取得済み", "ok")}
        ${card("直接資料特定", `${rows.length - directMissing}/${rows.length}`, "決算PDF・資料単位で特定済みの件数", "bad")}
        ${card("買付反映", "0件", "資料特定・入力・検算前は反映しない", "bad")}
      </div>
      <p class="note">この台帳は、公式資料を探すための入口です。IRトップに到達できても、決算短信・決算説明資料の該当PDFと数値を確認するまでは、財務確認済みにはしません。</p>
      <div class="links">
        <a href="${csvFile}">CSV</a>
        <a href="p1_financial_input_form_20260614.csv">入力CSV</a>
        <a href="p1_financial_input_validator_20260614.html">入力バリデーター</a>
      </div>
    </section>

    <section>
      <h2>公式資料ナビ</h2>
      ${table(rows, [
        { key: "優先区分", label: "優先" },
        { key: "ticker", label: "ticker" },
        { key: "銘柄", label: "銘柄" },
        { key: "現在扱い", label: "現在扱い" },
        { key: "公式IR入口", label: "公式IR入口", link: true },
        { key: "疎通状態", label: "疎通状態" },
        { key: "直接資料状態", label: "直接資料状態" },
        { key: "入力する主項目", label: "入力する主項目" },
        { key: "作業方法", label: "作業方法" },
        { key: "買付反映", label: "買付反映" },
      ])}
    </section>

    <section>
      <h2>次の手順</h2>
      <div class="table-wrap"><table><thead><tr><th>順番</th><th>作業</th><th>反映条件</th></tr></thead><tbody>
        <tr><td>1</td><td>公式IR入口から最新の決算短信・決算説明資料を開く</td><td class="warn">資料名と資料日付を入力CSVへ残す</td></tr>
        <tr><td>2</td><td>PER/PBRは、会社資料のEPS/BPSと株価基準日、または外部参考値を分ける</td><td class="warn">外部値は参考値として出所を明記。公式値扱いにしない</td></tr>
        <tr><td>3</td><td>ROE、営業利益率、会社予想、受注・セグメント寄与を入力</td><td class="ok">入力値・出所・資料日付・公式確認済みがそろえば項目完了</td></tr>
        <tr><td>4</td><td>入力バリデーターで銘柄別に全項目完了を確認</td><td class="bad">全項目完了までは買付判断に使わない</td></tr>
      </tbody></table></div>
    </section>
  </main>
</body>
</html>`;

fs.writeFileSync(p(htmlFile), html, "utf8");

ensureLink("index.html", htmlFile, "P1 財務公式資料ナビ", "財務partial銘柄の公式IR入口、直接資料の特定状況、入力項目を確認する。");
ensureStepLink("latest_practical_start_20260614.html", htmlFile, "6-12d. P1 財務公式資料ナビ", "公式IR入口と決算資料特定状況を確認し、入力CSVへつなぐ。");
ensureCompactLink("daily_practical_compact_board_20260614.html", htmlFile, "P1 財務公式資料ナビ");

console.log(`built ${htmlFile}`);
console.log(`official IR verified: ${verified}/${rows.length}, direct documents identified: ${rows.length - directMissing}/${rows.length}`);
