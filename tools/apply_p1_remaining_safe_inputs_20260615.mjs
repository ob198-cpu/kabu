import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/15 06:45";
const queueCsv = "p1_segment_next_gate_input_queue_20260615.csv";
const integratedCsv = "784_integrated_recalculation_scores_20260528.csv";
const eventCsv = "102_june_event_result_input.csv";
const auditCsv = "p1_remaining_safe_input_apply_audit_20260615.csv";
const auditHtml = "p1_remaining_safe_input_apply_audit_20260615.html";
const blsCpiUrl = "https://www.bls.gov/news.release/cpi.nr0.htm";
const cpiValue =
  "BLS公式: 2026年5月CPI-Uは前月比+0.5%(季調済)、前年比+4.2%。コアCPIは前月比+0.2%、前年比+2.9%。エネルギー指数は前年比+23.5%。市場反応は別途確認中。";
const cpiPosition = "BLS Consumer Price Index Summary, 2026/06/10, lines 207-226";

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

function updateQueueRow(rows, inputId, patch) {
  const row = rows.find((item) => item.入力ID === inputId);
  if (!row) throw new Error(`missing input row: ${inputId}`);
  Object.assign(row, patch, {
    スコア反映: "禁止",
    P1復帰: "0社",
    買付上限: "0円",
  });
  return row;
}

function getIntegratedValue(ticker, column) {
  const rows = readCsv(integratedCsv);
  const row = rows.find((item) => item.コード === ticker);
  if (!row) throw new Error(`missing integrated row: ${ticker}`);
  const value = row[column];
  if (!value) throw new Error(`missing integrated value: ${ticker} ${column}`);
  return value;
}

function updateEventFile() {
  const rows = readCsv(eventCsv);
  const row = rows.find((item) => item.event_id === "E01");
  if (!row) throw new Error("missing E01 in event file");
  row.actual_value = cpiValue;
  row.market_reaction = "注意/確認中";
  row.current_status = "部分確認: CPI公式値入力済み。米10年金利、NASDAQ、SOX、VIX、ドル円の反応確認待ち。";
  writeCsv(eventCsv, rows);
}

function table(rows, columns) {
  return `<div class="table-wrap"><table><thead><tr>${columns.map((column) => `<th>${h(column.label)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((column) => {
    const value = row[column.key];
    const cls = /反映/.test(String(value ?? "")) ? "ok" : /部分|維持|0円|0社|禁止/.test(String(value ?? "")) ? "warn" : "";
    return `<td class="${cls}">${h(value)}</td>`;
  }).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function writeAuditHtml(rows, summaryRows) {
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>P1 残項目 安全補完監査</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--red:#b42318;--green:#116b4f;--warn:#9a5b00}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.75}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);line-height:1.2}
    header p{margin:0;font-weight:850;max-width:1180px}
    main{max-width:1480px;margin:0 auto;padding:22px}
    section{background:#fff;border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08)}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:25px}
    .notice{border-left:8px solid var(--red);background:#fff1f1;border-radius:10px;padding:14px 16px;font-weight:900;margin:0 0 14px}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin-top:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:10px 12px;vertical-align:top;overflow-wrap:anywhere}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    .ok{color:var(--green);font-weight:900}.warn{color:var(--warn);font-weight:900}.links{display:flex;gap:10px;flex-wrap:wrap}.links a{background:var(--blue);color:#fff;text-decoration:none;border-radius:999px;padding:8px 13px;font-weight:900}
  </style>
</head>
<body>
<header>
  <h1>P1 残項目 安全補完監査</h1>
  <p>残項目のうち、期間違いのない価格データと公式CPIだけを補完しました。CPIは市場反応が未完了のため部分確認に留め、イベントゲートは通しません。</p>
</header>
<main>
  <section>
    <h2>結論</h2>
    <p class="notice">今回もスコア反映0項目、P1復帰0社、買付上限0円を維持します。数字を入れたことと購入判断は分けています。</p>
    ${table(summaryRows, [
      { key: "項目", label: "項目" },
      { key: "値", label: "値" },
      { key: "説明", label: "説明" },
    ])}
  </section>
  <section>
    <h2>関連ページ</h2>
    <div class="links">
      <a href="index.html">ホーム</a>
      <a href="latest_practical_start_20260614.html">実用パート入口</a>
      <a href="p1_segment_next_gate_input_validator_20260615.html">次ゲート入力バリデーター</a>
      <a href="p1_segment_next_gate_input_queue_20260615.html">次ゲート入力キュー</a>
    </div>
  </section>
  <section>
    <h2>反映明細</h2>
    ${table(rows, [
      { key: "対象", label: "対象" },
      { key: "処理", label: "処理" },
      { key: "値", label: "値" },
      { key: "確認区分", label: "確認区分" },
      { key: "理由", label: "理由" },
      { key: "出所", label: "出所" },
    ])}
  </section>
</main>
</body>
</html>`;
  fs.writeFileSync(p(auditHtml), html, "utf8");
}

function insertBefore(content, marker, addition) {
  if (content.includes(addition.trim())) return content;
  const index = content.indexOf(marker);
  if (index < 0) return content;
  return `${content.slice(0, index)}${addition}\n${content.slice(index)}`;
}

function updateNav() {
  const homeCard = `<a class="card" href="${auditHtml}">
          <b>P1 残項目 安全補完監査</b>
          <span>6503の1年最大下落率と米5月CPI公式値を補完。ただしイベントゲートと買付は止める。</span>
        </a>`;
  const latestStep = `<a class="step" href="${auditHtml}">
        <b>6-12ab. P1 残項目 安全補完監査</b>
        <span>期間違いのない価格指標とCPI公式値だけを補完し、イベント反応未完了は部分確認として止める。</span>
        <em>安全補完</em>
      </a>`;
  const boardLink = `<a href="${auditHtml}">P1 残項目 安全補完監査</a>`;

  const indexPath = p("index.html");
  if (fs.existsSync(indexPath)) {
    let html = fs.readFileSync(indexPath, "utf8");
    html = insertBefore(html, `<a class="card" href="p1_segment_next_gate_work_order_20260615.html">`, homeCard);
    fs.writeFileSync(indexPath, html, "utf8");
  }

  const latestPath = p("latest_practical_start_20260614.html");
  if (fs.existsSync(latestPath)) {
    let html = fs.readFileSync(latestPath, "utf8");
    html = insertBefore(html, `</div>\n  </section>`, latestStep);
    fs.writeFileSync(latestPath, html, "utf8");
  }

  const boardPath = p("daily_practical_compact_board_20260614.html");
  if (fs.existsSync(boardPath)) {
    let html = fs.readFileSync(boardPath, "utf8");
    html = insertBefore(html, `<a href="p1_segment_next_gate_work_order_20260615.html">`, boardLink);
    fs.writeFileSync(boardPath, html, "utf8");
  }
}

const queueRows = readCsv(queueCsv);
const auditRows = [];

const drawdown6503 = getIntegratedValue("6503.T", "直近1年最大下落");
updateQueueRow(queueRows, "6503_max_drawdown_1y", {
  入力値: `${drawdown6503}%`,
  出所URLまたは資料名: integratedCsv,
  ページまたは取得日時: "直近1年最大下落 / 統合再計算ファイルの明示列。20日最大下落率ではない。",
  公式確認: "計算確認済",
});
auditRows.push({
  対象: "6503.T 1年最大下落率",
  処理: "反映",
  値: `${drawdown6503}%`,
  確認区分: "計算確認済",
  理由: "100社再計算ファイルの直近1年最大下落列から取得。以前見送った20日最大下落率とは別列。",
  出所: integratedCsv,
});

for (const inputId of ["6503_event_cpi_result", "8035_event_cpi_result"]) {
  updateQueueRow(queueRows, inputId, {
    入力値: cpiValue,
    出所URLまたは資料名: blsCpiUrl,
    ページまたは取得日時: cpiPosition,
    公式確認: "部分確認",
  });
  auditRows.push({
    対象: inputId,
    処理: "部分反映",
    値: cpiValue,
    確認区分: "部分確認",
    理由: "CPI公式値のみ確認。米10年金利、NASDAQ、SOX、VIX、ドル円の市場反応が未完了なのでイベントゲートは通さない。",
    出所: blsCpiUrl,
  });
}

const queueHeaders = [
  "ticker",
  "銘柄",
  "ゲート",
  "入力ID",
  "入力項目",
  "必要な取得元",
  "単位",
  "採用条件",
  "入力値",
  "出所URLまたは資料名",
  "ページまたは取得日時",
  "公式確認",
  "スコア反映",
  "P1復帰",
  "買付上限",
  "銘柄別確認焦点",
  "注意点",
];
writeCsv(queueCsv, queueRows, queueHeaders);
updateEventFile();

const auditHeaders = ["対象", "処理", "値", "確認区分", "理由", "出所"];
writeCsv(auditCsv, auditRows, auditHeaders);
const summaryRows = [
  {
    項目: "追加価格補完",
    値: "1項目",
    説明: "6503の1年最大下落率を、期間違いのない列から補完。",
  },
  {
    項目: "CPI公式値",
    値: "2銘柄へ部分入力",
    説明: "BLS公式値をイベント行へ入れたが、市場反応未完了のため通過扱いにしない。",
  },
  {
    項目: "スコア/P1/買付",
    値: "0項目 / 0社 / 0円",
    説明: "イベント後反応、財務未確認が残るため解除しない。",
  },
];
writeAuditHtml(auditRows, summaryRows);
updateNav();

console.log(JSON.stringify({ auditHtml, auditCsv, applied: auditRows.length, buyLimit: "0円" }, null, 2));
