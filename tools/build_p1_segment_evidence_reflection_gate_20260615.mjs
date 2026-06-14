import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/15 02:40";
const inputCsv = "p1_segment_evidence_input_queue_20260615.csv";
const htmlFile = "p1_segment_evidence_reflection_gate_20260615.html";
const detailCsv = "p1_segment_evidence_reflection_gate_20260615.csv";
const summaryCsv = "p1_segment_evidence_reflection_gate_summary_20260615.csv";

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

function groupBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const value = row[key] ?? "";
    if (!map.has(value)) map.set(value, []);
    map.get(value).push(row);
  }
  return map;
}

function buildRows(inputRows) {
  const byTicker = groupBy(inputRows, "ticker");
  const rows = [];
  for (const [ticker, items] of byTicker.entries()) {
    const confirmed = items.filter((row) => row.official_confirmed === "true");
    const reflectReady = items.filter((row) => row.score_reflect === "true");
    const uniqueFields = [...new Set(items.map((row) => row.入力欄))].join(" / ");
    const uniqueEvidence = [...new Set(items.map((row) => row.evidence_id))].join(" / ");
    const missingCount = items.length - confirmed.length;
    const canReflect = missingCount === 0 && items.length > 0;
    rows.push({
      ticker,
      銘柄: items[0]?.銘柄 ?? "",
      入力候補行数: String(items.length),
      公式確認済み: String(confirmed.length),
      未確認行数: String(missingCount),
      スコア反映済み: String(reflectReady.length),
      対象入力欄: uniqueFields,
      根拠ID: uniqueEvidence,
      反映判定: canReflect ? "反映候補" : "反映不可",
      P1復帰判定: canReflect ? "次ゲートへ" : "不可",
      買付上限: "0円",
      止めている理由: canReflect ? "この画面だけでは買付不可。財務・価格・イベント後判定・口座確認が別途必要。" : "official_confirmed=false の入力候補が残っているため、点数にも候補復帰にも使わない。",
      次作業: canReflect ? "財務入力バリデーターと6月イベント後判定へ送る。" : "該当ページ、資料日付、対象年度、単位、前年比を目視確認して official_confirmed を true にする。",
    });
  }
  return rows;
}

function buildSummary(inputRows, gateRows) {
  const confirmed = inputRows.filter((row) => row.official_confirmed === "true").length;
  const reflected = inputRows.filter((row) => row.score_reflect === "true").length;
  const reflectableTickers = gateRows.filter((row) => row.反映判定 === "反映候補").length;
  return [
    { 項目: "入力候補行", 値: `${inputRows.length}行`, 判定: "確認対象", 説明: "公式資料からの候補入力文を入力欄単位に分解済み。" },
    { 項目: "公式確認済み", 値: `${confirmed}行`, 判定: confirmed === inputRows.length ? "完了" : "未完了", 説明: "該当ページ、対象年度、単位、前年比の目視確認が終わった行数。" },
    { 項目: "スコア反映済み", 値: `${reflected}行`, 判定: reflected > 0 ? "要確認" : "未反映", 説明: "現段階では0行が正しい。候補値を点数へ混ぜない。" },
    { 項目: "反映候補銘柄", 値: `${reflectableTickers}社`, 判定: reflectableTickers > 0 ? "次ゲートへ" : "なし", 説明: "公式確認済みがそろった銘柄だけが次ゲートへ進む。" },
    { 項目: "P1復帰", 値: "0社", 判定: "不可", 説明: "事業寄与だけでは復帰不可。財務・価格・イベント後判定・口座確認が必要。" },
    { 項目: "買付上限", 値: "0円", 判定: "維持", 説明: "購入判断に使える段階ではない。" },
  ];
}

function statusClass(value) {
  const text = String(value ?? "");
  if (/0円|不可|反映不可|未完了|未反映|なし|false|止めている/.test(text)) return "bad";
  if (/確認|候補|次ゲート|要確認|必要/.test(text)) return "warn";
  if (/完了|true/.test(text)) return "ok";
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

function writeHtml(inputRows, gateRows, summaryRows) {
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>P1 事業寄与証拠 反映ゲート</title>
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
  <h1>P1 事業寄与証拠 反映ゲート</h1>
  <p>入力キューの候補値が、点数・候補復帰・買付金額へ誤って混ざらないように止める画面です。</p>
</header>
<main>
  <section>
    <h2>結論</h2>
    <p class="notice">現段階では反映不可です。公式確認済み0行、スコア反映0行、P1復帰0社、買付上限0円を維持します。</p>
    <div class="cards">
      ${card("入力候補", `${inputRows.length}行`, "候補値のみ", "warn")}
      ${card("公式確認済み", "0行", "未完了", "bad")}
      ${card("P1復帰", "0社", "不可", "bad")}
      ${card("買付上限", "0円", "継続", "bad")}
    </div>
  </section>

  <section>
    <h2>確認導線</h2>
    <div class="links">
      <a href="index.html">ホーム</a>
      <a href="latest_practical_start_20260614.html">実用パート入口</a>
      <a href="p1_segment_evidence_input_queue_20260615.html">事業寄与 入力キュー</a>
      <a href="p1_segment_evidence_input_mapping_20260615.html">入力反映マップ</a>
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
    <h2>銘柄別ゲート</h2>
    ${table(gateRows, [
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "入力候補行数", label: "入力候補行数" },
      { key: "公式確認済み", label: "公式確認済み" },
      { key: "未確認行数", label: "未確認行数" },
      { key: "スコア反映済み", label: "スコア反映済み" },
      { key: "対象入力欄", label: "対象入力欄" },
      { key: "反映判定", label: "反映判定" },
      { key: "P1復帰判定", label: "P1復帰判定" },
      { key: "買付上限", label: "買付上限" },
      { key: "止めている理由", label: "止めている理由" },
      { key: "次作業", label: "次作業" },
    ])}
  </section>

  <section>
    <h2>ゲート規則</h2>
    <ul>
      <li>official_confirmed が全行 true になるまで、該当銘柄の事業寄与スコアは反映しない。</li>
      <li>score_reflect は、公式確認・財務入力・イベント後判定の全てがそろうまで true にしない。</li>
      <li>このゲートを通っても、買付金額は別の購入前ゲートで判定する。</li>
      <li>入力候補は説明材料であり、購入判断そのものではない。</li>
    </ul>
  </section>

  <footer>generated: ${h(generatedAt)} / source: ${h(inputCsv)}</footer>
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
  insertOnce("index.html", "p1_segment_evidence_input_queue_20260615.html", `<a class="card" href="${htmlFile}">
          <b>P1 事業寄与証拠 反映ゲート</b>
          <span>候補値が点数・候補復帰・買付金額へ誤って混ざらないように、公式確認済み行数で止める。</span>
        </a>`);

  insertOnce("latest_practical_start_20260614.html", "p1_segment_evidence_input_queue_20260615.html", `<a class="step" href="${htmlFile}">
        <b>6-12m. P1 事業寄与証拠 反映ゲート</b>
        <span>official_confirmed と score_reflect を見て、事業寄与候補を点数へ入れてよいか止める。</span>
        <em>反映ゲート</em>
      </a>`);

  insertOnce("daily_practical_compact_board_20260614.html", "p1_segment_evidence_input_queue_20260615.html", `<a href="${htmlFile}">P1 事業寄与証拠 反映ゲート</a>`);
}

function main() {
  const inputRows = readCsv(inputCsv);
  const gateRows = buildRows(inputRows);
  const summaryRows = buildSummary(inputRows, gateRows);
  writeCsv(detailCsv, gateRows);
  writeCsv(summaryCsv, summaryRows);
  writeHtml(inputRows, gateRows, summaryRows);
  updateNavigation();
  console.log(JSON.stringify({ htmlFile, detailCsv, summaryCsv, inputRows: inputRows.length, gateRows: gateRows.length, buyLimit: "0円" }, null, 2));
}

main();
