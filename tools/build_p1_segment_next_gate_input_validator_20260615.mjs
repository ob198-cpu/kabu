import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/15 06:20";
const sourceCsv = "p1_segment_next_gate_input_queue_20260615.csv";
const htmlFile = "p1_segment_next_gate_input_validator_20260615.html";
const detailCsv = "p1_segment_next_gate_input_validator_20260615.csv";
const summaryCsv = "p1_segment_next_gate_input_validator_summary_20260615.csv";

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

function writeCsv(file, rows, headers = Object.keys(rows[0] ?? { empty: "" })) {
  const body = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ].join("\n");
  fs.writeFileSync(p(file), `\uFEFF${body}\n`, "utf8");
}

function isFilled(value) {
  return String(value ?? "").trim() !== "";
}

function confirmationOk(row) {
  const value = String(row.公式確認 ?? "").trim();
  if (row.ゲート === "価格ゲート") return value === "計算確認済";
  if (row.ゲート === "説明可能性ゲート") return value === "運用確認済";
  if (row.ゲート === "イベント後ゲート") return value === "イベント確認済" || value === "済";
  if (row.ゲート === "財務ゲート") return value === "済";
  return value === "済";
}

function expectedConfirmation(row) {
  if (row.ゲート === "価格ゲート") return "計算確認済";
  if (row.ゲート === "説明可能性ゲート") return "運用確認済";
  if (row.ゲート === "イベント後ゲート") return "イベント確認済または済";
  if (row.ゲート === "財務ゲート") return "済";
  return "済";
}

function validateRow(row) {
  const missing = [];
  if (!isFilled(row.入力値)) missing.push("入力値");
  if (!isFilled(row.出所URLまたは資料名)) missing.push("出所URLまたは資料名");
  if (!isFilled(row.ページまたは取得日時)) missing.push("ページまたは取得日時");
  if (!confirmationOk(row)) missing.push(`公式確認(${expectedConfirmation(row)})`);

  const pass = missing.length === 0;
  return {
    ticker: row.ticker,
    銘柄: row.銘柄,
    ゲート: row.ゲート,
    入力ID: row.入力ID,
    入力項目: row.入力項目,
    入力値: row.入力値,
    出所URLまたは資料名: row.出所URLまたは資料名,
    ページまたは取得日時: row.ページまたは取得日時,
    公式確認: row.公式確認,
    判定: pass ? "通過" : "未通過",
    不足: missing.join(" / "),
    スコア反映: pass ? "候補" : "禁止",
    P1復帰: "0社",
    買付上限: "0円",
    理由: pass
      ? "入力値、出所、取得位置、確認区分がそろった。ただし全ゲート通過まではP1復帰しない。"
      : "必要項目が不足しているため、次ゲートへ進めない。",
  };
}

function groupBy(rows, makeKey) {
  const map = new Map();
  for (const row of rows) {
    const key = makeKey(row);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(row);
  }
  return map;
}

function buildGateSummary(rows) {
  const grouped = groupBy(rows, (row) => `${row.ticker}__${row.ゲート}`);
  return [...grouped.values()].map((gateRows) => {
    const passed = gateRows.filter((row) => row.判定 === "通過").length;
    const total = gateRows.length;
    const pass = passed === total;
    return {
      ticker: gateRows[0]?.ticker ?? "",
      銘柄: gateRows[0]?.銘柄 ?? "",
      ゲート: gateRows[0]?.ゲート ?? "",
      入力通過: `${passed}/${total}`,
      ゲート判定: pass ? "通過" : "未通過",
      P1復帰: "0社",
      買付上限: "0円",
      次の作業: pass ? "他ゲートの通過を確認する。" : "不足項目を入力し、出所と確認区分をそろえる。",
    };
  });
}

function buildSummary(rows, gateRows) {
  const passedRows = rows.filter((row) => row.判定 === "通過").length;
  const passedGates = gateRows.filter((row) => row.ゲート判定 === "通過").length;
  return [
    {
      項目: "入力項目通過",
      値: `${passedRows}/${rows.length}項目`,
      判定: passedRows === rows.length ? "通過" : "未通過",
      説明: "入力値、出所、ページまたは取得日時、確認区分の4条件で判定。",
    },
    {
      項目: "ゲート通過",
      値: `${passedGates}/${gateRows.length}ゲート`,
      判定: passedGates === gateRows.length ? "通過" : "未通過",
      説明: "銘柄ごとに財務・価格・イベント後・説明可能性がそろったかを見る。",
    },
    {
      項目: "スコア反映",
      値: "0項目",
      判定: "禁止",
      説明: "全ゲートが通過していないため、スコアと候補順位は変更しない。",
    },
    {
      項目: "P1復帰/買付",
      値: "0社 / 0円",
      判定: "不可",
      説明: "購入判断に使える段階ではない。",
    },
  ];
}

function statusClass(value) {
  const text = String(value ?? "");
  if (/0円|0社|不可|禁止|未通過|不足/.test(text)) return "bad";
  if (/候補/.test(text)) return "warn";
  if (/通過/.test(text)) return "ok";
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

function writeHtml(rows, gateRows, summaryRows) {
  const passedRows = rows.filter((row) => row.判定 === "通過").length;
  const passedGates = gateRows.filter((row) => row.ゲート判定 === "通過").length;
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>P1 事業寄与 次ゲート入力バリデーター</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--warn:#9a5b00;--red:#b42318;--green:#116b4f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.75}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);line-height:1.2;letter-spacing:0}
    header p{margin:0;font-weight:850;max-width:1180px}
    main{max-width:1520px;margin:0 auto;padding:22px}
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
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:11px;padding:5px 6px}}
  </style>
</head>
<body>
<header>
  <h1>P1 事業寄与 次ゲート入力バリデーター</h1>
  <p>財務ゲートは公式確認、価格ゲートは計算確認、説明可能性ゲートは運用確認として分けて検査します。未通過が残る限り、スコア反映・P1復帰・買付は止めます。</p>
</header>
<main>
  <section>
    <h2>結論</h2>
    <p class="notice">入力項目の通過は ${h(passedRows)}/${h(rows.length)} 項目、ゲート通過は ${h(passedGates)}/${h(gateRows.length)} ゲートです。未通過が残るため、スコア反映0項目、P1復帰0社、買付上限0円を維持します。</p>
    <div class="cards">
      ${card("入力項目通過", `${passedRows}/${rows.length}`, "4条件で判定", passedRows === rows.length ? "ok" : "bad")}
      ${card("ゲート通過", `${passedGates}/${gateRows.length}`, "銘柄別4ゲート", passedGates === gateRows.length ? "ok" : "bad")}
      ${card("P1復帰", "0社", "まだ戻さない", "bad")}
      ${card("買付上限", "0円", "購入判断に使わない", "bad")}
    </div>
  </section>

  <section>
    <h2>関連ページ</h2>
    <div class="links">
      <a href="index.html">ホーム</a>
      <a href="latest_practical_start_20260614.html">実用パート入口</a>
      <a href="p1_segment_next_gate_input_queue_20260615.html">次ゲート入力キュー</a>
      <a href="p1_price_explanation_prefill_apply_audit_20260615.html">価格・説明ゲート反映監査</a>
      <a href="p1_price_basis_official_promotion_workbench_20260615.html">PER/PBR基準日作業台</a>
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
    <h2>銘柄別ゲート判定</h2>
    ${table(gateRows, [
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "ゲート", label: "ゲート" },
      { key: "入力通過", label: "入力通過" },
      { key: "ゲート判定", label: "ゲート判定" },
      { key: "P1復帰", label: "P1復帰" },
      { key: "買付上限", label: "買付上限" },
      { key: "次の作業", label: "次の作業" },
    ])}
  </section>

  <section>
    <h2>入力項目別判定</h2>
    ${table(rows, [
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "ゲート", label: "ゲート" },
      { key: "入力ID", label: "入力ID" },
      { key: "入力項目", label: "入力項目" },
      { key: "判定", label: "判定" },
      { key: "不足", label: "不足" },
      { key: "スコア反映", label: "スコア反映" },
      { key: "P1復帰", label: "P1復帰" },
      { key: "買付上限", label: "買付上限" },
      { key: "理由", label: "理由" },
    ])}
  </section>

  <footer>generated: ${h(generatedAt)} / source: ${h(sourceCsv)} / 本ページは入力検査用であり、投資助言・自動売買・購入指示ではありません。</footer>
</main>
</body>
</html>`;
  fs.writeFileSync(p(htmlFile), html, "utf8");
}

const sourceRows = readCsv(sourceCsv);
const rows = sourceRows.map(validateRow);
const gateRows = buildGateSummary(rows);
const summaryRows = buildSummary(rows, gateRows);

writeCsv(detailCsv, rows);
writeCsv(summaryCsv, summaryRows);
writeHtml(rows, gateRows, summaryRows);

console.log(JSON.stringify({
  htmlFile,
  detailCsv,
  summaryCsv,
  rows: rows.length,
  passedRows: rows.filter((row) => row.判定 === "通過").length,
  passedGates: gateRows.filter((row) => row.ゲート判定 === "通過").length,
  totalGates: gateRows.length,
  buyLimit: "0円",
}, null, 2));
