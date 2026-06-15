import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/15 12:05";
const inputQueueCsv = "p1_segment_next_gate_input_queue_20260615.csv";
const pdfCheckCsv = "p1_segment_pdf_official_check_result_20260615.csv";
const draftCsv = "p1_segment_official_input_queue_draft_20260615.csv";
const summaryCsv = "p1_segment_official_input_queue_draft_summary_20260615.csv";
const htmlFile = "p1_segment_official_input_queue_draft_20260615.html";

const transferMap = new Map([
  ["6503_roe_official", {
    value: "9.7%",
    source: "三菱電機 2026年3月期 決算短信〔IFRS〕 一部訂正版",
    page: "P1 L69-L78 / 2026-06-15確認",
    reason: "PDF原文でROEを確認。Yahoo参照値9.67%は使わない。",
  }],
  ["6503_operating_margin", {
    value: "7.3%",
    source: "三菱電機 2026年3月期 決算短信〔IFRS〕 一部訂正版",
    page: "P1 L74-L78 / 2026-06-15確認",
    reason: "PDF原文で売上高営業利益率を確認。",
  }],
  ["8035_roe_official", {
    value: "29.6%",
    source: "東京エレクトロン 2026年3月期 決算短信〔日本基準〕",
    page: "P0 L19-L25 / 2026-06-15確認",
    reason: "PDF原文でROEを確認。",
  }],
  ["8035_operating_margin", {
    value: "25.6%",
    source: "東京エレクトロン 2026年3月期 決算短信〔日本基準〕",
    page: "P0 L21-L25 / 2026-06-15確認",
    reason: "PDF原文で売上高営業利益率を確認。",
  }],
]);

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

function parseRows(text) {
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
    if (char === '"') quote = true;
    else if (char === ",") {
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
  return rows.filter((values) => values.some((value) => String(value ?? "").trim() !== ""));
}

function parseCsv(text) {
  const rows = parseRows(text);
  const headers = rows.shift() ?? [];
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function readCsv(file) {
  return parseCsv(fs.readFileSync(p(file), "utf8"));
}

function writeCsv(file, rows) {
  const headers = Object.keys(rows[0] ?? { empty: "" });
  const body = [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
  fs.writeFileSync(p(file), `\uFEFF${body}\n`, "utf8");
}

function buildDraftRows(queueRows) {
  return queueRows.map((row) => {
    const transfer = transferMap.get(row["入力ID"]);
    const next = { ...row };
    if (transfer) {
      next["入力値"] = transfer.value;
      next["出所URLまたは資料名"] = transfer.source;
      next["ページまたは取得日時"] = transfer.page;
      next["公式確認"] = "済";
      next["スコア反映"] = "禁止";
      next["P1復帰"] = "0社";
      next["買付上限"] = "0円";
      next["転記ステータス"] = "転記案";
      next["転記理由"] = transfer.reason;
      next["残作業"] = "入力バリデーター通過後までスコア反映しない。";
    } else {
      next["転記ステータス"] = row["入力値"] ? "既存入力あり" : "未転記";
      next["転記理由"] = "";
      next["残作業"] = next["ゲート"] === "イベント後ゲート"
        ? "6月イベント後の実データ入力が必要。"
        : "公式確認、株価再計算、または説明条件の確認が必要。";
    }
    return next;
  });
}

function buildTransferRows(draftRows) {
  return draftRows.filter((row) => row["転記ステータス"] === "転記案").map((row) => ({
    ticker: row.ticker,
    銘柄: row["銘柄"],
    入力ID: row["入力ID"],
    入力項目: row["入力項目"],
    入力値: row["入力値"],
    出所: row["出所URLまたは資料名"],
    確認位置: row["ページまたは取得日時"],
    公式確認: row["公式確認"],
    スコア反映: row["スコア反映"],
    P1復帰: row["P1復帰"],
    買付上限: row["買付上限"],
    転記理由: row["転記理由"],
  }));
}

function buildSummaryRows(draftRows) {
  const transferred = draftRows.filter((row) => row["転記ステータス"] === "転記案").length;
  const officialDone = draftRows.filter((row) => row["公式確認"] === "済").length;
  const notTransferred = draftRows.filter((row) => row["転記ステータス"] === "未転記").length;
  const eventMissing = draftRows.filter((row) => row["ゲート"] === "イベント後ゲート" && row["転記ステータス"] === "未転記").length;
  return [
    { 項目: "公式値転記案", 件数: `${transferred}項目`, 判定: "下書き作成", 説明: "ROEと営業利益率のみ。PER/PBRは株価基準日未確認のため除外。" },
    { 項目: "公式確認済み扱い", 件数: `${officialDone}項目`, 判定: "入力案内", 説明: "PDF原文値を確認した項目。まだ原本キューは上書きしていない。" },
    { 項目: "未転記", 件数: `${notTransferred}項目`, 判定: "残あり", 説明: "株価再計算、PER/PBR基準日確認、イベント後入力、説明文確認が残る。" },
    { 項目: "イベント後未入力", 件数: `${eventMissing}項目`, 判定: "6月イベント後", 説明: "CPI、日銀、FOMC、指数・個別反応の入力待ち。" },
    { 項目: "スコア反映", 件数: "0項目", 判定: "禁止", 説明: "転記案だけでは点数に混ぜない。バリデーションが必要。" },
    { 項目: "P1復帰/買付", 件数: "0社 / 0円", 判定: "不可", 説明: "購入判断には使わない。" },
  ];
}

function statusClass(value) {
  const text = String(value ?? "");
  if (/不可|禁止|未転記|残あり|0円|0社/.test(text)) return "bad";
  if (/転記案|済|下書き|確認|6月イベント後/.test(text)) return "warn";
  if (/完了|通過/.test(text)) return "ok";
  return "";
}

function table(data, columns) {
  return `<div class="table-wrap"><table><thead><tr>${columns.map((column) => `<th>${h(column.label)}</th>`).join("")}</tr></thead><tbody>${data.map((row) => `<tr>${columns.map((column) => {
    const value = row[column.key];
    return `<td class="${statusClass(value)}">${h(value)}</td>`;
  }).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function card(title, value, note, className = "") {
  return `<div class="card ${className}"><b>${h(title)}</b><strong>${h(value)}</strong><span>${h(note)}</span></div>`;
}

function writeHtml(draftRows, transferRows, summaryRows) {
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>P1 事業寄与 公式値入力キュー転記案</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--warn:#9a5b00;--red:#b42318;--green:#116b4f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.75}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);line-height:1.2;letter-spacing:0}
    header p{margin:0;font-weight:850;max-width:1180px}
    main{max-width:1560px;margin:0 auto;padding:22px}
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
    a{color:#064f86;font-weight:900}
    footer{font-size:13px;color:#526b82;margin:20px 0}
    @media(max-width:900px){main{padding:12px}.cards{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:10px;padding:5px 6px}}
  </style>
</head>
<body>
<header>
  <h1>P1 事業寄与 公式値入力キュー転記案</h1>
  <p>公式PDFで確認できた値のうち、ROEと営業利益率だけを入力キューへ移す下書きです。原本キューはまだ上書きせず、スコア・P1復帰・買付上限も変更しません。</p>
</header>
<main>
  <section>
    <h2>結論</h2>
    <p class="notice">転記案は4項目です。PER/PBRは株価基準日が未確認のため除外。スコア反映は禁止、P1復帰0社、買付上限0円を維持します。</p>
    <div class="cards">
      ${card("転記案", `${transferRows.length}項目`, "ROE・営業利益率", "warn")}
      ${card("PER/PBR", "除外", "株価基準日待ち", "bad")}
      ${card("スコア反映", "0項目", "まだ混ぜない", "bad")}
      ${card("買付上限", "0円", "購入判断に使わない", "bad")}
    </div>
  </section>

  <section>
    <h2>関連ページ</h2>
    <div class="links">
      <a href="index.html">ホーム</a>
      <a href="latest_practical_start_20260614.html">実用パート入口</a>
      <a href="p1_segment_pdf_official_check_result_20260615.html">PDF原文確認結果</a>
      <a href="p1_segment_next_gate_input_queue_20260615.html">原本入力キュー</a>
      <a href="p1_segment_next_gate_input_validator_20260615.html">入力バリデーター</a>
    </div>
  </section>

  <section>
    <h2>サマリー</h2>
    ${table(summaryRows, [
      { key: "項目", label: "項目" },
      { key: "件数", label: "件数" },
      { key: "判定", label: "判定" },
      { key: "説明", label: "説明" },
    ])}
  </section>

  <section>
    <h2>転記案4項目</h2>
    ${table(transferRows, [
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "入力ID", label: "入力ID" },
      { key: "入力項目", label: "入力項目" },
      { key: "入力値", label: "入力値" },
      { key: "出所", label: "出所" },
      { key: "確認位置", label: "確認位置" },
      { key: "公式確認", label: "公式確認" },
      { key: "スコア反映", label: "スコア反映" },
      { key: "P1復帰", label: "P1復帰" },
      { key: "買付上限", label: "買付上限" },
      { key: "転記理由", label: "転記理由" },
    ])}
  </section>

  <section>
    <h2>転記案込みキュー全体</h2>
    ${table(draftRows, [
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "ゲート", label: "ゲート" },
      { key: "入力ID", label: "入力ID" },
      { key: "入力項目", label: "入力項目" },
      { key: "入力値", label: "入力値" },
      { key: "公式確認", label: "公式確認" },
      { key: "スコア反映", label: "スコア反映" },
      { key: "P1復帰", label: "P1復帰" },
      { key: "買付上限", label: "買付上限" },
      { key: "転記ステータス", label: "転記ステータス" },
      { key: "残作業", label: "残作業" },
    ])}
  </section>

  <footer>generated: ${h(generatedAt)} / source: ${h(inputQueueCsv)}, ${h(pdfCheckCsv)} / 本ページは転記案であり、投資助言・自動売買・購入指示ではありません。</footer>
</main>
</body>
</html>`;
  fs.writeFileSync(p(htmlFile), html, "utf8");
}

function replaceOrInsert(content, href, replacement, fallbackMarker) {
  const cardPattern = new RegExp(`<a class="card" href="${href}">[\\s\\S]*?<\\/a>`);
  const stepPattern = new RegExp(`<a class="step" href="${href}">[\\s\\S]*?<\\/a>`);
  const simplePattern = new RegExp(`<a href="${href}">[\\s\\S]*?<\\/a>`);
  if (cardPattern.test(content)) return content.replace(cardPattern, replacement);
  if (stepPattern.test(content)) return content.replace(stepPattern, replacement);
  if (simplePattern.test(content)) return content.replace(simplePattern, replacement);
  const index = content.indexOf(fallbackMarker);
  if (index === -1) return `${content}\n${replacement}\n`;
  return `${content.slice(0, index + fallbackMarker.length)}\n${replacement}\n${content.slice(index + fallbackMarker.length)}`;
}

function updateNav() {
  const homeCard = `<a class="card" href="${htmlFile}">
          <b>P1 事業寄与 公式値入力キュー転記案</b>
          <span>公式PDFで確認したROE・営業利益率4項目だけを入力キューへ移す下書き。PER/PBRはまだ除外。</span>
        </a>`;
  const latestStep = `<a class="step" href="${htmlFile}">
        <b>6-13. P1 事業寄与 公式値入力キュー転記案</b>
        <span>ROEと営業利益率だけを転記案にし、PER/PBRと買付判断は止めたままにする。</span>
        <em>転記案</em>
      </a>`;
  const boardLink = `<a href="${htmlFile}">P1 事業寄与 公式値入力キュー転記案</a>`;

  const indexPath = p("index.html");
  let index = fs.readFileSync(indexPath, "utf8");
  index = replaceOrInsert(index, htmlFile, homeCard, "</div>");
  fs.writeFileSync(indexPath, index, "utf8");

  const latestPath = p("latest_practical_start_20260614.html");
  let latest = fs.readFileSync(latestPath, "utf8");
  latest = replaceOrInsert(latest, htmlFile, latestStep, "</div>");
  fs.writeFileSync(latestPath, latest, "utf8");

  const boardPath = p("daily_practical_compact_board_20260614.html");
  let board = fs.readFileSync(boardPath, "utf8");
  board = replaceOrInsert(board, htmlFile, boardLink, "</div>");
  fs.writeFileSync(boardPath, board, "utf8");
}

const queueRows = readCsv(inputQueueCsv);
const draftRows = buildDraftRows(queueRows);
const transferRows = buildTransferRows(draftRows);
const summaryRows = buildSummaryRows(draftRows);

writeCsv(draftCsv, draftRows);
writeCsv(summaryCsv, summaryRows);
writeHtml(draftRows, transferRows, summaryRows);
updateNav();

console.log(JSON.stringify({
  htmlFile,
  draftCsv,
  summaryCsv,
  transferDraftItems: transferRows.length,
  scoreReflected: 0,
  p1Return: 0,
  buyLimit: "0円",
}, null, 2));
