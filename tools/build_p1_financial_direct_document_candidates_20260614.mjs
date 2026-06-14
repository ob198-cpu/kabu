import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/14 23:59";
const csvFile = "p1_financial_direct_document_candidates_20260614.csv";
const htmlFile = "p1_financial_direct_document_candidates_20260614.html";

function p(file) {
  return path.join(ROOT, file);
}

function readText(file) {
  return fs.existsSync(p(file)) ? fs.readFileSync(p(file), "utf8") : "";
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
  if (/(未特定|未完了|未入力|不可|0円|反映しない|PDF未特定)/.test(text)) return "bad";
  if (/(候補|HTML|要確認|P1|P2|ページ候補)/.test(text)) return "warn";
  if (/(PDF候補|200|取得済み|確認済み)/.test(text)) return "ok";
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

function ensureLink(file, href, label, note) {
  if (!fs.existsSync(p(file))) return;
  const text = readText(file);
  if (text.includes(href)) return;
  const cardHtml = `<a class="card" href="${href}">
          <b>${label}</b>
          <span>${note}</span>
        </a>
`;
  const updated = text.replace(/<a class="card" href="p1_financial_source_navigator_20260614\.html">[\s\S]*?<\/a>\s*/u, (match) => `${match}${cardHtml}`);
  fs.writeFileSync(p(file), updated, "utf8");
}

function ensureStepLink(file, href, label, note) {
  if (!fs.existsSync(p(file))) return;
  const text = readText(file);
  if (text.includes(href)) return;
  const stepHtml = `<a class="step" href="${href}">
        <b>${label}</b>
        <span>${note}</span>
        <em>資料候補</em>
      </a>
`;
  const updated = text.replace(/<a class="step" href="p1_financial_source_navigator_20260614\.html">[\s\S]*?<\/a>\s*/u, (match) => `${match}${stepHtml}`);
  fs.writeFileSync(p(file), updated, "utf8");
}

function ensureCompactLink(file, href, label) {
  if (!fs.existsSync(p(file))) return;
  const text = readText(file);
  if (text.includes(href)) return;
  const updated = text.replace(
    /<a href="p1_financial_source_navigator_20260614\.html">P1 財務公式資料ナビ<\/a>/u,
    `<a href="p1_financial_source_navigator_20260614.html">P1 財務公式資料ナビ</a>\n<a href="${href}">${label}</a>`,
  );
  fs.writeFileSync(p(file), updated, "utf8");
}

const rows = [
  {
    優先区分: "P1",
    ticker: "6503.T",
    銘柄: "三菱電機",
    候補区分: "PDF候補",
    URL: "https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co1.pdf",
    HTTP確認: "200 application/pdf",
    資料扱い: "直接資料候補。表紙・対象期・数値位置は未確認",
    入力へ使う条件: "資料名、資料日付、対象期、該当数値を確認してから入力",
    買付反映: "反映しない",
  },
  {
    優先区分: "P1",
    ticker: "6503.T",
    銘柄: "三菱電機",
    候補区分: "HTMLページ候補",
    URL: "https://www.mitsubishielectric.co.jp/investors/data/financial-result/",
    HTTP確認: "200 text/html",
    資料扱い: "決算資料ページ候補",
    入力へ使う条件: "ページ内で最新決算短信・説明資料PDFを特定する",
    買付反映: "反映しない",
  },
  {
    優先区分: "P1",
    ticker: "6762.T",
    銘柄: "TDK",
    候補区分: "HTMLページ候補",
    URL: "https://www.tdk.com/en/ir/ir_library/financial/index.html",
    HTTP確認: "200 text/html",
    資料扱い: "決算資料ページ候補",
    入力へ使う条件: "ページ内で最新決算短信・説明会資料PDFを特定する",
    買付反映: "反映しない",
  },
  {
    優先区分: "P2",
    ticker: "5803.T",
    銘柄: "フジクラ",
    候補区分: "HTMLページ候補",
    URL: "https://www.fujikura.co.jp/ir/",
    HTTP確認: "200 text/html",
    資料扱い: "IR入口候補。決算PDF未特定",
    入力へ使う条件: "決算情報ページへ進み、PDFを特定する",
    買付反映: "反映しない",
  },
  {
    優先区分: "P2",
    ticker: "6146.T",
    銘柄: "ディスコ",
    候補区分: "HTMLページ候補",
    URL: "https://www.disco.co.jp/jp/ir/library/fr.html",
    HTTP確認: "200 text/html",
    資料扱い: "決算関連ページ候補。PDF未特定",
    入力へ使う条件: "最新決算短信・説明資料をページ内で特定する",
    買付反映: "反映しない",
  },
  {
    優先区分: "P2",
    ticker: "6857.T",
    銘柄: "アドバンテスト",
    候補区分: "HTMLページ候補",
    URL: "https://www.advantest.com/ja/investors/",
    HTTP確認: "200 text/html",
    資料扱い: "IR入口候補。決算PDF未特定",
    入力へ使う条件: "決算資料ページへ進み、受注・会社予想・利益率の資料を特定する",
    買付反映: "反映しない",
  },
  {
    優先区分: "P2",
    ticker: "7011.T",
    銘柄: "三菱重工業",
    候補区分: "HTMLページ候補",
    URL: "https://www.mhi.com/jp/finance/",
    HTTP確認: "200 text/html",
    資料扱い: "決算・財務情報ページ候補。PDF未特定",
    入力へ使う条件: "決算説明資料・決算短信を特定し、受注残とセグメント寄与を確認する",
    買付反映: "反映しない",
  },
  {
    優先区分: "P2",
    ticker: "8035.T",
    銘柄: "東京エレクトロン",
    候補区分: "PDF候補",
    URL: "https://www.tel.co.jp/ir/library/report/jngpc500000000l6-att/fy26q4tanshin-j.pdf",
    HTTP確認: "200 application/pdf",
    資料扱い: "直接資料候補。表紙・対象期・数値位置は未確認",
    入力へ使う条件: "資料名、資料日付、対象期、該当数値を確認してから入力",
    買付反映: "反映しない",
  },
];

writeCsv(csvFile, rows);

const pdfCandidates = rows.filter((row) => row.候補区分 === "PDF候補").length;
const htmlCandidates = rows.filter((row) => row.候補区分 === "HTMLページ候補").length;
const tickersWithPdf = new Set(rows.filter((row) => row.候補区分 === "PDF候補").map((row) => row.ticker)).size;

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>P1 財務 直接資料候補</title>
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
  </style>
</head>
<body>
  <header>
    <h1>P1 財務 直接資料候補</h1>
    <p>公式IR入口から一段進み、決算短信・決算説明資料として使えそうなPDF候補とHTMLページ候補を分けた画面です。PDF候補はまだ中身の数値確認前なので、買付判断には反映しません。</p>
  </header>
  <main>
    <section>
      <h2>現在の結論</h2>
      <div class="cards">
        ${card("PDF候補", `${pdfCandidates}件`, "三菱電機・東京エレクトロンでPDF候補を確認", "ok")}
        ${card("PDF候補の銘柄", `${tickersWithPdf}/7`, "直接PDF候補がある銘柄数", "warn")}
        ${card("HTML候補", `${htmlCandidates}件`, "IR/決算資料ページとして取得済み", "warn")}
        ${card("買付反映", "0件", "PDF候補の中身確認前は反映しない", "bad")}
      </div>
      <p class="note">PDFが取得できたことと、必要な財務数値が確認できたことは別です。表紙・対象期・数値位置・資料日付を確認してから入力CSVへ転記します。</p>
      <div class="links">
        <a href="${csvFile}">CSV</a>
        <a href="p1_financial_source_navigator_20260614.html">公式資料ナビ</a>
        <a href="p1_financial_input_validator_20260614.html">入力バリデーター</a>
      </div>
    </section>

    <section>
      <h2>直接資料候補一覧</h2>
      ${table(rows, [
        { key: "優先区分", label: "優先" },
        { key: "ticker", label: "ticker" },
        { key: "銘柄", label: "銘柄" },
        { key: "候補区分", label: "候補区分" },
        { key: "URL", label: "URL", link: true },
        { key: "HTTP確認", label: "HTTP確認" },
        { key: "資料扱い", label: "資料扱い" },
        { key: "入力へ使う条件", label: "入力へ使う条件" },
        { key: "買付反映", label: "買付反映" },
      ])}
    </section>

    <section>
      <h2>次の手順</h2>
      <div class="table-wrap"><table><thead><tr><th>順番</th><th>作業</th><th>合格条件</th></tr></thead><tbody>
        <tr><td>1</td><td>PDF候補を開き、表紙・対象期・資料日付を確認</td><td class="warn">資料名と資料日付を入力CSVに残す</td></tr>
        <tr><td>2</td><td>PER/PBR/ROE、営業利益率、会社予想、受注・セグメント寄与の場所を確認</td><td class="warn">該当ページまたは計算根拠をメモに残す</td></tr>
        <tr><td>3</td><td>入力バリデーターで項目完了を確認</td><td class="ok">入力値・出所・資料日付・公式確認済みがそろう</td></tr>
        <tr><td>4</td><td>P1のみ候補復帰の再判定へ進める</td><td class="bad">P2は資料確認後も監視・除外理由の解除が必要</td></tr>
      </tbody></table></div>
    </section>
  </main>
</body>
</html>`;

fs.writeFileSync(p(htmlFile), html, "utf8");

ensureLink("index.html", htmlFile, "P1 財務 直接資料候補", "公式IRから一段進めたPDF候補・HTML候補を分け、数値入力前の状態を確認する。");
ensureStepLink("latest_practical_start_20260614.html", htmlFile, "6-12e. P1 財務 直接資料候補", "決算短信・決算説明資料のPDF候補とHTMLページ候補を確認する。");
ensureCompactLink("daily_practical_compact_board_20260614.html", htmlFile, "P1 財務 直接資料候補");

console.log(`built ${htmlFile}`);
console.log(`pdf candidates: ${pdfCandidates}, html candidates: ${htmlCandidates}, tickers with pdf: ${tickersWithPdf}/7`);
