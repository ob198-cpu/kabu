import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/14 23:35";

const queueFile = "p1_financial_official_input_queue_20260614.csv";
const formFile = "p1_financial_input_form_20260614.csv";
const validationFile = "p1_financial_input_validation_20260614.csv";
const summaryFile = "p1_financial_input_validation_summary_20260614.csv";
const htmlFile = "p1_financial_input_validator_20260614.html";

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
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell.replace(/\r$/, ""));
  if (row.some((value) => value !== "")) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map((value) => value.trim());
  return rows.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, line[index] ?? ""])));
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, rows) {
  if (!rows.length) {
    fs.writeFileSync(p(file), "", "utf8");
    return;
  }
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

function keyOf(row) {
  return `${row.ticker}__${row["入力項目"]}`;
}

function isFilled(value) {
  return String(value ?? "").trim() !== "";
}

function isOfficial(row) {
  return row["入力状態"] === "公式確認済み";
}

function rowComplete(row) {
  return isFilled(row["入力値"]) && isFilled(row["参照URLまたは資料名"]) && isFilled(row["資料日付"]) && isOfficial(row);
}

function statusClass(value) {
  const text = String(value ?? "");
  if (/(購入不可|買付上限0円|未完了|未入力|不可|NG|反映しない)/.test(text)) return "bad";
  if (/(要確認|部分完了|P1|P2|保留)/.test(text)) return "warn";
  if (/(完了|OK|通過|反映候補)/.test(text)) return "ok";
  return "";
}

function table(rows, columns) {
  return `<div class="table-wrap"><table><thead><tr>${columns.map((column) => `<th>${h(column.label)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${columns.map((column) => `<td class="${statusClass(row[column.key])}">${h(row[column.key])}</td>`).join("")}</tr>`)
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
  const updated = text.replace(/<a class="card" href="p1_financial_official_input_queue_20260614\.html">[\s\S]*?<\/a>\s*/u, (match) => `${match}${cardHtml}`);
  fs.writeFileSync(p(file), updated, "utf8");
}

function ensureCompactLink(file, href, label) {
  if (!fs.existsSync(p(file))) return;
  const text = readText(file);
  if (text.includes(href)) return;
  const updated = text.replace(
    /<a href="p1_financial_official_input_queue_20260614\.html">P1 財務公式入力キュー<\/a>/u,
    `<a href="p1_financial_official_input_queue_20260614.html">P1 財務公式入力キュー</a>\n<a href="${href}">${label}</a>`,
  );
  fs.writeFileSync(p(file), updated, "utf8");
}

const queueRows = parseCsv(readText(queueFile));
if (!queueRows.length) {
  throw new Error(`${queueFile} is empty or missing`);
}

const existingForm = parseCsv(readText(formFile));
const existingByKey = new Map(existingForm.map((row) => [keyOf(row), row]));

const formRows = queueRows.map((row) => {
  const existing = existingByKey.get(keyOf(row)) ?? {};
  const inputValue = existing["入力値"] ?? "";
  const sourceType = existing["出所区分"] ?? "";
  const sourceName = existing["参照URLまたは資料名"] ?? "";
  const sourceDate = existing["資料日付"] ?? "";
  const memo = existing["計算根拠メモ"] ?? "";
  const inputStatus = existing["入力状態"] ?? "未入力";
  const complete = isFilled(inputValue) && isFilled(sourceName) && isFilled(sourceDate) && inputStatus === "公式確認済み";
  return {
    優先区分: row["優先区分"],
    ticker: row.ticker,
    銘柄: row["銘柄"],
    現在扱い: row["現在扱い"],
    入力項目: row["入力項目"],
    入力値: inputValue,
    出所区分: sourceType,
    参照URLまたは資料名: sourceName,
    資料日付: sourceDate,
    計算根拠メモ: memo,
    入力状態: inputStatus,
    検算結果: complete ? "完了" : "未完了",
    反映可否: complete ? "反映候補" : "反映しない",
    注意: complete ? "候補別の全項目完了後に再判定" : "入力値・出所・資料日付・公式確認済みが必要",
  };
});

const byTicker = new Map();
for (const row of formRows) {
  if (!byTicker.has(row.ticker)) byTicker.set(row.ticker, []);
  byTicker.get(row.ticker).push(row);
}

const validationRows = Array.from(byTicker.entries()).map(([ticker, rows]) => {
  const total = rows.length;
  const completeRows = rows.filter(rowComplete).length;
  const missingItems = rows.filter((row) => !rowComplete(row)).map((row) => row["入力項目"]);
  const priority = rows[0]["優先区分"];
  const isP1 = priority.startsWith("P1");
  const allComplete = completeRows === total;
  let result = "未完了: 買付判断に使わない";
  let action = "公式資料から入力値・出所・資料日付を補完する";
  let orderReflection = "反映しない";
  if (allComplete && isP1) {
    result = "P1完了: 候補復帰の再判定へ進める";
    action = "P0・イベント・価格・指数比較と合わせて再判定する";
    orderReflection = "再判定後に判断";
  } else if (allComplete) {
    result = "補完完了: 監視・除外理由の再確認へ進める";
    action = "価格過熱・テーマ根拠・決算後反応を再確認する";
    orderReflection = "反映しない";
  }
  return {
    優先区分: priority,
    ticker,
    銘柄: rows[0]["銘柄"],
    現在扱い: rows[0]["現在扱い"],
    完了項目: `${completeRows}/${total}`,
    未完了項目: missingItems.join(" / ") || "なし",
    判定: result,
    注文票反映: orderReflection,
    次アクション: action,
  };
});

const completedTickers = validationRows.filter((row) => row["完了項目"].split("/")[0] === row["完了項目"].split("/")[1]).length;
const p1Completed = validationRows.filter((row) => row["優先区分"].startsWith("P1") && row["判定"].startsWith("P1完了")).length;
const blockedTickers = validationRows.length - completedTickers;

const summaryRows = [
  { 項目: "対象銘柄", 件数: `${validationRows.length}銘柄`, 状態: "検算対象", 意味: "財務partialが残っている銘柄を、入力完了まで追跡する。" },
  { 項目: "入力項目", 件数: `${formRows.length}項目`, 状態: "公式確認待ち", 意味: "入力値、出所、資料日付、公式確認済みの4点が必要。" },
  { 項目: "完了銘柄", 件数: `${completedTickers}銘柄`, 状態: completedTickers ? "一部完了" : "未完了", 意味: "全入力項目が完了した銘柄数。" },
  { 項目: "P1復帰可能", 件数: `${p1Completed}銘柄`, 状態: p1Completed ? "再判定候補" : "なし", 意味: "財務補完だけで候補復帰の再判定へ進める銘柄数。" },
  { 項目: "買付上限", 件数: "0円", 状態: "購入不可", 意味: "入力完了だけでは買付許可にしない。イベント、価格、指数比較、口座確認を合わせて判定する。" },
];

writeCsv(formFile, formRows);
writeCsv(validationFile, validationRows);
writeCsv(summaryFile, summaryRows);

const incompleteRows = formRows.filter((row) => !rowComplete(row));
const p1Rows = formRows.filter((row) => row["優先区分"].startsWith("P1"));

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>P1 財務入力バリデーター</title>
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
    table{width:100%;border-collapse:collapse;table-layout:auto;background:white}
    th,td{border-bottom:1px solid var(--line);border-right:1px solid var(--line);padding:9px 10px;vertical-align:top;text-align:left;overflow-wrap:anywhere;word-break:normal}
    th{background:#e7f2fb;color:#07395f;font-weight:800;white-space:nowrap}
    tr:last-child td{border-bottom:0}
    .note{border-left:6px solid var(--warn);background:#fff7e8;padding:14px;margin-top:12px;border-radius:10px}
    .links{display:flex;flex-wrap:wrap;gap:10px}
    .links a{display:inline-block;padding:10px 14px;border:1px solid #87bce0;border-radius:999px;background:#eef8ff;color:#07395f;text-decoration:none;font-weight:800}
    @media print{body{background:white;font-size:15px}header{padding:18px 24px}main{padding:0 18px;max-width:none}section{break-inside:avoid;page-break-inside:avoid;border-color:#bcd2e2;border-radius:0}.table-wrap{overflow:visible}th,td{font-size:12px;padding:5px 6px}.links{display:none}}
  </style>
</head>
<body>
  <header>
    <h1>P1 財務入力バリデーター</h1>
    <p>公式決算・IR・決算短信から入力した数値だけを検算し、候補復帰に進めるかを判定する画面です。未入力や出所不明の値は、スコアや注文票に反映しません。</p>
  </header>
  <main>
    <section>
      <h2>現在の結論</h2>
      <div class="cards">
        ${card("入力項目", `${formRows.length}項目`, "値・出所・資料日付・公式確認済みの4点を確認", "warn")}
        ${card("完了銘柄", `${completedTickers}銘柄`, "全項目がそろった銘柄数", completedTickers ? "warn" : "bad")}
        ${card("P1復帰可能", `${p1Completed}銘柄`, "財務補完だけで再判定へ進める銘柄数", p1Completed ? "warn" : "bad")}
        ${card("買付上限", "0円", "財務入力だけで購入可にはしない", "bad")}
      </div>
      <p class="note">この画面は入力検算用です。P1が完了しても、6月イベント、価格過熱、指数比較、口座・税制確認を通すまで購入判断には使いません。</p>
      <div class="links">
        <a href="${formFile}">入力CSV</a>
        <a href="${validationFile}">検算CSV</a>
        <a href="${summaryFile}">サマリーCSV</a>
        <a href="${queueFile}">入力キュー</a>
      </div>
    </section>

    <section>
      <h2>銘柄別 検算結果</h2>
      ${table(validationRows, [
        { key: "優先区分", label: "優先区分" },
        { key: "ticker", label: "ticker" },
        { key: "銘柄", label: "銘柄" },
        { key: "完了項目", label: "完了項目" },
        { key: "判定", label: "判定" },
        { key: "注文票反映", label: "注文票反映" },
        { key: "未完了項目", label: "未完了項目" },
        { key: "次アクション", label: "次アクション" },
      ])}
    </section>

    <section>
      <h2>P1 優先入力欄</h2>
      <p class="lead">候補復帰に関係するP1だけを先に表示します。ここが完了しても、購入ではなく再判定に進むだけです。</p>
      ${table(p1Rows, [
        { key: "ticker", label: "ticker" },
        { key: "銘柄", label: "銘柄" },
        { key: "入力項目", label: "入力項目" },
        { key: "入力値", label: "入力値" },
        { key: "出所区分", label: "出所区分" },
        { key: "参照URLまたは資料名", label: "参照URLまたは資料名" },
        { key: "資料日付", label: "資料日付" },
        { key: "入力状態", label: "入力状態" },
        { key: "検算結果", label: "検算結果" },
      ])}
    </section>

    <section>
      <h2>未完了入力 全件</h2>
      ${table(incompleteRows, [
        { key: "優先区分", label: "優先区分" },
        { key: "ticker", label: "ticker" },
        { key: "銘柄", label: "銘柄" },
        { key: "入力項目", label: "入力項目" },
        { key: "入力値", label: "入力値" },
        { key: "参照URLまたは資料名", label: "参照URLまたは資料名" },
        { key: "資料日付", label: "資料日付" },
        { key: "入力状態", label: "入力状態" },
        { key: "注意", label: "注意" },
      ])}
    </section>

    <section>
      <h2>判定ルール</h2>
      <div class="table-wrap"><table><thead><tr><th>条件</th><th>扱い</th></tr></thead><tbody>
        <tr><td>入力値、参照URLまたは資料名、資料日付、入力状態=公式確認済みがそろう</td><td class="ok">その項目は完了</td></tr>
        <tr><td>銘柄の全項目が完了し、優先区分がP1</td><td class="warn">候補復帰の再判定へ進める</td></tr>
        <tr><td>銘柄の全項目が完了しても、優先区分がP2</td><td class="warn">監視・除外理由の再確認へ進める。注文票には入れない</td></tr>
        <tr><td>1項目でも未入力・出所不明・日付不明・公式確認なし</td><td class="bad">買付判断に使わない</td></tr>
      </tbody></table></div>
    </section>
  </main>
</body>
</html>`;

fs.writeFileSync(p(htmlFile), html, "utf8");

ensureLink("index.html", htmlFile, "P1 財務入力バリデーター", "公式入力値・出所・資料日付がそろったか検算し、候補復帰に進めるか判定する。");
ensureLink("latest_practical_start_20260614.html", htmlFile, "P1 財務入力バリデーター", "財務partialを実入力・検算し、買付判断へ混ぜないためのゲート。");
ensureCompactLink("daily_practical_compact_board_20260614.html", htmlFile, "P1 財務入力バリデーター");

console.log(`built ${htmlFile}`);
console.log(`input rows: ${formRows.length}, completed tickers: ${completedTickers}, p1 completed: ${p1Completed}, blocked tickers: ${blockedTickers}`);
