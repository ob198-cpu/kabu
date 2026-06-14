import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/15 03:00";
const sourceCsv = "p1_segment_evidence_input_queue_20260615.csv";
const htmlFile = "p1_segment_official_confirmation_sheet_20260615.html";
const detailCsv = "p1_segment_official_confirmation_sheet_20260615.csv";
const summaryCsv = "p1_segment_official_confirmation_summary_20260615.csv";

function p(file) {
  return path.join(ROOT, file);
}

function h(value) {
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

function parseCsv(text) {
  const clean = String(text ?? "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let quote = false;
  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];
    const next = clean[i + 1];
    if (quote) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quote = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quote = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  const headers = rows.shift() ?? [];
  return rows
    .filter((values) => values.some((value) => String(value ?? "").trim() !== ""))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function readCsv(file) {
  return parseCsv(fs.readFileSync(p(file), "utf8"));
}

function writeCsv(file, rows) {
  const headers = Object.keys(rows[0] ?? { empty: "" });
  const body = [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
  fs.writeFileSync(p(file), `\uFEFF${body}\n`, "utf8");
}

function uniqBy(rows, key) {
  const seen = new Set();
  return rows.filter((row) => {
    const value = row[key];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function buildConfirmationRows(inputRows) {
  const evidenceRows = uniqBy(inputRows, "evidence_id");
  return evidenceRows.map((row) => ({
    evidence_id: row.evidence_id,
    ticker: row.ticker,
    銘柄: row.銘柄,
    根拠分類: row.根拠分類,
    確認する候補文: row.候補入力文,
    対になる注意点: row.対になる注意点,
    公式資料: row.公式資料,
    資料日付: row.資料日付,
    URL: row.URL,
    確認ページまたは箇所: "",
    対象年度確認: "未",
    単位確認: "未",
    前年比確認: "未",
    数値一致確認: "未",
    注意点併記確認: "未",
    公式確認済み: "false",
    スコア反映可否: "不可",
    買付上限: "0円",
    次作業: "公式資料を開き、該当ページ・対象年度・単位・前年比・注意点を確認してから入力キューへ反映する。",
  }));
}

function buildSummary(rows) {
  const confirmed = rows.filter((row) => row.公式確認済み === "true").length;
  return [
    { 項目: "確認対象", 値: `${rows.length}件`, 判定: "作成済み", 説明: "入力キュー18行を、根拠ID単位の6確認項目にまとめた。" },
    { 項目: "公式確認済み", 値: `${confirmed}件`, 判定: confirmed === rows.length ? "完了" : "未完了", 説明: "ページ・対象年度・単位・前年比・注意点併記の確認が終わった件数。" },
    { 項目: "スコア反映可", 値: "0件", 判定: "不可", 説明: "このチェックシートは確認作業用。点数への反映は別ゲートで行う。" },
    { 項目: "P1復帰", 値: "0社", 判定: "不可", 説明: "公式確認済み0件のため、候補復帰には使わない。" },
    { 項目: "買付上限", 値: "0円", 判定: "維持", 説明: "購入判断に使える段階ではない。" },
  ];
}

function statusClass(value) {
  const text = String(value ?? "");
  if (/false|不可|0円|0件|0社|未完了|未$/.test(text)) return "bad";
  if (/確認|作成済み|候補|必要|別ゲート/.test(text)) return "warn";
  if (/true|完了/.test(text)) return "ok";
  return "";
}

function table(data, columns) {
  return `<div class="table-wrap"><table><thead><tr>${columns.map((column) => `<th>${h(column.label)}</th>`).join("")}</tr></thead><tbody>${data.map((row) => `<tr>${columns.map((column) => {
    const value = row[column.key];
    const cls = statusClass(value);
    if (column.link && value) return `<td class="${cls}"><a href="${h(value)}" target="_blank" rel="noopener">${h(value)}</a></td>`;
    return `<td class="${cls}">${h(value)}</td>`;
  }).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function card(title, value, note, className = "") {
  return `<div class="card ${className}"><b>${h(title)}</b><strong>${h(value)}</strong><span>${h(note)}</span></div>`;
}

function writeHtml(rows, summaryRows) {
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>P1 事業寄与 公式確認チェックシート</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--warn:#9a5b00;--red:#b42318;--green:#116b4f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.75}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);line-height:1.2;letter-spacing:0}
    header p{margin:0;font-weight:850;max-width:1180px}
    main{max-width:1440px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08)}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:25px}
    .notice{border-left:8px solid var(--red);background:#fff1f1;border-radius:10px;padding:14px 16px;font-weight:900;margin:0 0 14px}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:15px}
    .card strong{display:block;font-size:28px;line-height:1.25;color:var(--blue)}
    .card span{display:block;font-weight:800;color:#263e55;margin-top:4px}
    .bad strong,.bad{color:var(--red)!important;font-weight:900}
    .warn strong,.warn{color:var(--warn)!important;font-weight:900}
    .ok strong,.ok{color:var(--green)!important;font-weight:900}
    .links{display:flex;flex-wrap:wrap;gap:10px}
    .links a{display:inline-block;text-decoration:none;color:#fff;background:var(--blue);border-radius:999px;padding:8px 13px;font-weight:900}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin-top:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:10px 12px;vertical-align:top;overflow-wrap:anywhere;word-break:normal}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    a{color:#005f99;font-weight:900}
    footer{font-size:13px;color:#526b82;margin:20px 0}
    @media(max-width:900px){main{padding:12px}.cards{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:12px;padding:6px 7px}}
  </style>
</head>
<body>
<header>
  <h1>P1 事業寄与 公式確認チェックシート</h1>
  <p>候補入力文を公式確認済みにする前に、ページ・対象年度・単位・前年比・注意点併記を確認するためのシートです。</p>
</header>
<main>
  <section>
    <h2>結論</h2>
    <p class="notice">まだ公式確認済みではありません。この画面では6件の確認対象を作成しただけで、スコア反映0件、P1復帰0社、買付上限0円を維持します。</p>
    <div class="cards">
      ${card("確認対象", `${rows.length}件`, "根拠ID単位", "warn")}
      ${card("公式確認済み", "0件", "未完了", "bad")}
      ${card("スコア反映", "0件", "不可", "bad")}
      ${card("買付上限", "0円", "継続", "bad")}
    </div>
  </section>

  <section>
    <h2>確認導線</h2>
    <div class="links">
      <a href="index.html">ホーム</a>
      <a href="latest_practical_start_20260614.html">実用パート入口</a>
      <a href="p1_segment_evidence_input_queue_20260615.html">入力キュー</a>
      <a href="p1_segment_evidence_reflection_gate_20260615.html">反映ゲート</a>
      <a href="p1_financial_input_validator_20260614.html">財務入力バリデーター</a>
    </div>
  </section>

  <section>
    <h2>サマリー</h2>
    ${table(summaryRows, [
      { key: "項目", label: "項目" },
      { key: "値", label: "値" },
      { key: "判定", label: "判定" },
      { key: "説明", label: "説明" },
    ])}
  </section>

  <section>
    <h2>公式確認チェック</h2>
    ${table(rows, [
      { key: "evidence_id", label: "evidence_id" },
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "根拠分類", label: "根拠分類" },
      { key: "確認する候補文", label: "確認する候補文" },
      { key: "対になる注意点", label: "対になる注意点" },
      { key: "公式資料", label: "公式資料" },
      { key: "資料日付", label: "資料日付" },
      { key: "URL", label: "URL", link: true },
      { key: "確認ページまたは箇所", label: "確認ページまたは箇所" },
      { key: "対象年度確認", label: "対象年度確認" },
      { key: "単位確認", label: "単位確認" },
      { key: "前年比確認", label: "前年比確認" },
      { key: "数値一致確認", label: "数値一致確認" },
      { key: "注意点併記確認", label: "注意点併記確認" },
      { key: "公式確認済み", label: "公式確認済み" },
      { key: "スコア反映可否", label: "スコア反映可否" },
      { key: "買付上限", label: "買付上限" },
      { key: "次作業", label: "次作業" },
    ])}
  </section>

  <section>
    <h2>確認の基準</h2>
    <ul>
      <li>候補文の数値が資料内で確認できる。</li>
      <li>対象年度、単位、前年比の読み違いがない。</li>
      <li>強い材料だけでなく、同じ行に注意点を残している。</li>
      <li>すべて確認できた場合のみ、入力キューの official_confirmed を true にする。</li>
    </ul>
  </section>

  <footer>generated: ${h(generatedAt)} / source: ${h(sourceCsv)}</footer>
</main>
</body>
</html>
`;
  fs.writeFileSync(p(htmlFile), html, "utf8");
}

function insertOnce(file, markerHref, insertion) {
  const target = p(file);
  if (!fs.existsSync(target)) return;
  let text = fs.readFileSync(target, "utf8");
  if (text.includes(htmlFile)) return;
  const marker = `href="${markerHref}"`;
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) return;
  const closeIndex = text.indexOf("</a>", markerIndex);
  if (closeIndex < 0) return;
  const insertAt = closeIndex + "</a>".length;
  text = `${text.slice(0, insertAt)}\n${insertion}\n${text.slice(insertAt)}`;
  fs.writeFileSync(target, text, "utf8");
}

function updateNavigation() {
  insertOnce("index.html", "p1_segment_evidence_reflection_gate_20260615.html", `<a class="card" href="${htmlFile}">
          <b>P1 事業寄与 公式確認チェックシート</b>
          <span>候補入力文を公式確認済みにする前に、ページ・年度・単位・前年比・注意点を確認する。</span>
        </a>`);

  insertOnce("latest_practical_start_20260614.html", "p1_segment_evidence_reflection_gate_20260615.html", `<a class="step" href="${htmlFile}">
        <b>6-12n. P1 事業寄与 公式確認チェックシート</b>
        <span>根拠IDごとに、公式確認済みにしてよいかを確認する。</span>
        <em>公式確認</em>
      </a>`);

  insertOnce("daily_practical_compact_board_20260614.html", "p1_segment_evidence_reflection_gate_20260615.html", `<a href="${htmlFile}">P1 事業寄与 公式確認チェックシート</a>`);
}

function main() {
  const inputRows = readCsv(sourceCsv);
  const rows = buildConfirmationRows(inputRows);
  const summaryRows = buildSummary(rows);
  writeCsv(detailCsv, rows);
  writeCsv(summaryCsv, summaryRows);
  writeHtml(rows, summaryRows);
  updateNavigation();
  console.log(JSON.stringify({ htmlFile, detailCsv, summaryCsv, rows: rows.length, buyLimit: "0円" }, null, 2));
}

main();
