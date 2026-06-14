import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/15 04:15";
const sourceCsv = "p1_segment_ai_confirmation_draft_20260615.csv";
const htmlFile = "p1_segment_human_apply_template_20260615.html";
const detailCsv = "p1_segment_human_apply_template_20260615.csv";
const summaryCsv = "p1_segment_human_apply_template_summary_20260615.csv";

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

function buildRows(sourceRows) {
  return sourceRows.map((row) => ({
    evidence_id: row.evidence_id,
    ticker: row.ticker,
    銘柄: row.銘柄,
    転記先: "p1_segment_official_confirmation_sheet_20260615.csv",
    確認ページまたは箇所_候補: row.確認箇所,
    対象年度確認_候補: "済",
    単位確認_候補: "済",
    前年比確認_候補: "済",
    数値一致確認_候補: "済",
    注意点併記確認_候補: "済",
    公式確認済み_候補: "人間確認後に true",
    スコア反映可否_候補: "不可",
    買付上限: "0円",
    人間が見る内容: `${row.確認した数値} / ${row.確認した文章}`,
    注意して残す内容: row.注意点,
    自動反映しない理由: "AI確認下書きのため。資料該当箇所を人間が開いて確認するまで official_confirmed=true にしない。",
    次作業: "資料URLを開き、候補内容と一致すればチェックシート側を更新する。",
  }));
}

function buildSummary(rows) {
  return [
    { 項目: "転記候補", 値: `${rows.length}件`, 判定: "作成済み", 説明: "AI確認下書きを、人間がチェックシートへ転記しやすい形にした。" },
    { 項目: "自動反映", 値: "0件", 判定: "しない", 説明: "人間確認前に公式確認済みへ変更しない。" },
    { 項目: "公式確認済み", 値: "0件", 判定: "false維持", 説明: "true にできるのは人間が公式資料を開いて確認した後だけ。" },
    { 項目: "スコア反映", 値: "0件", 判定: "不可", 説明: "このテンプレートの段階では点数へ混ぜない。" },
    { 項目: "P1復帰", 値: "0社", 判定: "不可", 説明: "反映後も別ゲートが必要。" },
    { 項目: "買付上限", 値: "0円", 判定: "維持", 説明: "購入判断に使える段階ではない。" },
  ];
}

function statusClass(value) {
  const text = String(value ?? "");
  if (/0円|0件|0社|不可|しない|false|人間確認後/.test(text)) return "bad";
  if (/候補|確認|作成済み|必要|開いて/.test(text)) return "warn";
  if (/済|true/.test(text)) return "ok";
  return "";
}

function table(data, columns) {
  return `<div class="table-wrap"><table><thead><tr>${columns.map((column) => `<th>${h(column.label)}</th>`).join("")}</tr></thead><tbody>${data.map((row) => `<tr>${columns.map((column) => {
    const value = row[column.key];
    const cls = statusClass(value);
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
  <title>P1 事業寄与 人間確認用 反映テンプレート</title>
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
    footer{font-size:13px;color:#526b82;margin:20px 0}
    @media(max-width:900px){main{padding:12px}.cards{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:12px;padding:6px 7px}}
  </style>
</head>
<body>
<header>
  <h1>P1 事業寄与 人間確認用 反映テンプレート</h1>
  <p>AI確認下書きを、人間が公式資料を開いて確認した後にチェックシートへ転記するためのテンプレートです。</p>
</header>
<main>
  <section>
    <h2>結論</h2>
    <p class="notice">転記候補は作成済みです。ただし自動反映はしません。公式確認済み0件、スコア反映0件、P1復帰0社、買付上限0円を維持します。</p>
    <div class="cards">
      ${card("転記候補", `${rows.length}件`, "人間確認用", "warn")}
      ${card("自動反映", "0件", "しない", "bad")}
      ${card("スコア反映", "0件", "不可", "bad")}
      ${card("買付上限", "0円", "継続", "bad")}
    </div>
  </section>

  <section>
    <h2>確認導線</h2>
    <div class="links">
      <a href="index.html">ホーム</a>
      <a href="latest_practical_start_20260614.html">実用パート入口</a>
      <a href="p1_segment_ai_confirmation_draft_20260615.html">AI確認下書き</a>
      <a href="p1_segment_official_confirmation_sheet_20260615.html">公式確認チェックシート</a>
      <a href="p1_segment_confirmation_validator_20260615.html">公式確認バリデーター</a>
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
    <h2>反映テンプレート</h2>
    ${table(rows, [
      { key: "evidence_id", label: "evidence_id" },
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "転記先", label: "転記先" },
      { key: "確認ページまたは箇所_候補", label: "確認ページまたは箇所_候補" },
      { key: "対象年度確認_候補", label: "対象年度確認_候補" },
      { key: "単位確認_候補", label: "単位確認_候補" },
      { key: "前年比確認_候補", label: "前年比確認_候補" },
      { key: "数値一致確認_候補", label: "数値一致確認_候補" },
      { key: "注意点併記確認_候補", label: "注意点併記確認_候補" },
      { key: "公式確認済み_候補", label: "公式確認済み_候補" },
      { key: "スコア反映可否_候補", label: "スコア反映可否_候補" },
      { key: "買付上限", label: "買付上限" },
      { key: "人間が見る内容", label: "人間が見る内容" },
      { key: "注意して残す内容", label: "注意して残す内容" },
      { key: "自動反映しない理由", label: "自動反映しない理由" },
      { key: "次作業", label: "次作業" },
    ])}
  </section>

  <section>
    <h2>反映の流れ</h2>
    <ul>
      <li>公式資料を開き、AI確認下書きの内容と一致するか確認する。</li>
      <li>一致した場合だけ、チェックシートの対象年度・単位・前年比・数値一致・注意点併記を「済」にする。</li>
      <li>official_confirmed を true にするのは、人間確認後だけにする。</li>
      <li>score_reflect はこの段階では不可のままにする。</li>
    </ul>
  </section>

  <footer>generated: ${h(generatedAt)} / source: ${h(sourceCsv)}</footer>
</main>
</body>
</html>`;
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
  insertOnce("index.html", "p1_segment_ai_confirmation_draft_20260615.html", `<a class="card" href="${htmlFile}">
          <b>P1 事業寄与 人間確認用 反映テンプレート</b>
          <span>AI確認下書きを、人間が公式資料確認後にチェックシートへ転記する形に整える。</span>
        </a>`);

  insertOnce("latest_practical_start_20260614.html", "p1_segment_ai_confirmation_draft_20260615.html", `<a class="step" href="${htmlFile}">
        <b>6-12r. P1 事業寄与 人間確認用 反映テンプレート</b>
        <span>人間確認後にチェックシートへ転記する候補値を確認する。自動反映はしない。</span>
        <em>転記候補</em>
      </a>`);

  insertOnce("daily_practical_compact_board_20260614.html", "p1_segment_ai_confirmation_draft_20260615.html", `<a href="${htmlFile}">P1 事業寄与 人間確認用 反映テンプレート</a>`);
}

function main() {
  const sourceRows = readCsv(sourceCsv);
  const rows = buildRows(sourceRows);
  const summaryRows = buildSummary(rows);
  writeCsv(detailCsv, rows);
  writeCsv(summaryCsv, summaryRows);
  writeHtml(rows, summaryRows);
  updateNavigation();
  console.log(JSON.stringify({ htmlFile, detailCsv, summaryCsv, rows: rows.length, buyLimit: "0円" }, null, 2));
}

main();
