import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/15 06:15";
const queueCsv = "p1_segment_next_gate_input_queue_20260615.csv";
const candidateCsv = "p1_segment_existing_data_prefill_candidates_20260615.csv";
const auditCsv = "p1_price_explanation_prefill_apply_audit_20260615.csv";
const auditHtml = "p1_price_explanation_prefill_apply_audit_20260615.html";

const safePriceIds = new Set([
  "6503_price_date",
  "6503_current_price",
  "6503_return_60d",
  "6503_return_1y",
  "6503_cagr_5y",
  "6503_cagr_10y",
  "6503_sp500_gap_1y",
  "8035_return_60d",
  "8035_return_1y",
  "8035_cagr_5y",
  "8035_cagr_10y",
  "8035_max_drawdown_1y",
  "8035_sp500_gap_1y",
]);

const safeExplanationSuffixes = [
  "_one_line_reason",
  "_keep_condition",
  "_drop_condition",
  "_unconfirmed_items",
];

const explicitSkipIds = new Set([
  "6503_max_drawdown_1y",
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

function isExplanationId(inputId) {
  return safeExplanationSuffixes.some((suffix) => inputId.endsWith(suffix));
}

function candidateById(candidates) {
  return new Map(candidates.map((row) => [row.入力ID, row]));
}

function canApplyPrice(candidate) {
  if (!candidate || candidate.候補値あり !== "あり") return false;
  if (!safePriceIds.has(candidate.入力ID)) return false;
  if (explicitSkipIds.has(candidate.入力ID)) return false;
  const ref = `${candidate.参照項目または計算式 ?? ""} ${candidate.注意 ?? ""}`;
  if (candidate.入力ID.includes("max_drawdown_1y") && /20日|max_drawdown20/i.test(ref)) return false;
  return true;
}

function canApplyExplanation(candidate) {
  return Boolean(candidate && candidate.候補値あり === "あり" && isExplanationId(candidate.入力ID));
}

function buildPositionText(candidate) {
  const ref = String(candidate.参照項目または計算式 ?? "").trim();
  const note = String(candidate.注意 ?? "").trim();
  if (ref && note) return `${ref} / ${note}`;
  return ref || note || generatedAt;
}

function updateNav() {
  const homePath = p("index.html");
  const latestPath = p("latest_practical_start_20260614.html");
  const boardPath = p("daily_practical_compact_board_20260614.html");

  const homeCard = `<a class="card" href="${auditHtml}">
          <b>P1 価格・説明ゲート反映監査</b>
          <span>株価計算値と説明ルールだけを別確認として入力し、財務・イベント未確認は止めたままにする。</span>
        </a>`;
  const latestStep = `<a class="step" href="${auditHtml}">
        <b>6-12w. P1 価格・説明ゲート反映監査</b>
        <span>価格系は計算確認済、説明欄は運用確認済として分け、P1復帰と買付は引き続き止める。</span>
        <em>反映監査</em>
      </a>`;
  const boardLink = `<a href="${auditHtml}">P1 価格・説明ゲート反映監査</a>`;

  if (fs.existsSync(homePath)) {
    let html = fs.readFileSync(homePath, "utf8");
    if (!html.includes(auditHtml)) {
      const marker = `</div>\n      </section>`;
      const index = html.indexOf(marker);
      if (index >= 0) {
        html = `${html.slice(0, index)}${homeCard}\n        ${html.slice(index)}`;
      }
      fs.writeFileSync(homePath, html, "utf8");
    }
  }

  if (fs.existsSync(latestPath)) {
    let html = fs.readFileSync(latestPath, "utf8");
    if (!html.includes(auditHtml)) {
      const marker = `</div>\n  </section>`;
      const index = html.indexOf(marker);
      if (index >= 0) {
        html = `${html.slice(0, index)}${latestStep}\n      ${html.slice(index)}`;
      }
      fs.writeFileSync(latestPath, html, "utf8");
    }
  }

  if (fs.existsSync(boardPath)) {
    let html = fs.readFileSync(boardPath, "utf8");
    if (!html.includes(auditHtml)) {
      const marker = `</div>\n  </section>`;
      const index = html.indexOf(marker);
      if (index >= 0) {
        html = `${html.slice(0, index)}${boardLink}\n        ${html.slice(index)}`;
      }
      fs.writeFileSync(boardPath, html, "utf8");
    }
  }
}

function table(rows, columns) {
  return `<div class="table-wrap"><table><thead><tr>${columns.map((column) => `<th>${h(column.label)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((column) => `<td class="${/反映|通過/.test(String(row[column.key] ?? "")) ? "ok" : /見送り|禁止|0円|0社/.test(String(row[column.key] ?? "")) ? "bad" : ""}">${h(row[column.key])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function writeAuditHtml(auditRows, summaryRows) {
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>P1 価格・説明ゲート反映監査</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--red:#b42318;--green:#116b4f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.75}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);line-height:1.2}
    header p{margin:0;font-weight:850;max-width:1180px}
    main{max-width:1480px;margin:0 auto;padding:22px}
    section{background:#fff;border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08)}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:25px}
    .notice{border-left:8px solid var(--red);background:#fff1f1;border-radius:10px;padding:14px 16px;font-weight:900;margin:0 0 14px}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:15px}
    .card strong{display:block;font-size:28px;line-height:1.25;color:var(--blue)}
    .card span{display:block;font-weight:800;color:#263e55;margin-top:4px}
    .bad{color:var(--red)!important;font-weight:900}
    .ok{color:var(--green)!important;font-weight:900}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin-top:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:10px 12px;vertical-align:top;overflow-wrap:anywhere}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    .links{display:flex;flex-wrap:wrap;gap:10px}.links a{display:inline-block;text-decoration:none;color:#fff;background:var(--blue);border-radius:999px;padding:8px 13px;font-weight:900}
    @media(max-width:900px){main{padding:12px}.cards{grid-template-columns:1fr}body{font-size:16px}}
  </style>
</head>
<body>
<header>
  <h1>P1 価格・説明ゲート反映監査</h1>
  <p>価格系は株価時系列の計算確認、説明欄は運用ルール確認として分けて入力します。財務未確認、イベント未入力が残るため、スコア反映・P1復帰・買付は止めます。</p>
</header>
<main>
  <section>
    <h2>結論</h2>
    <p class="notice">今回の反映は入力整備です。購入候補への復帰、スコア順位変更、買付上限の設定は行っていません。</p>
    <div class="cards">
      <div class="card"><b>価格系反映</b><strong>${h(summaryRows.find((row) => row.項目 === "価格系反映")?.値 ?? "")}</strong><span>計算確認済として区別</span></div>
      <div class="card"><b>説明欄反映</b><strong>${h(summaryRows.find((row) => row.項目 === "説明欄反映")?.値 ?? "")}</strong><span>運用確認済として区別</span></div>
      <div class="card"><b>P1復帰</b><strong class="bad">0社</strong><span>全ゲート未通過</span></div>
      <div class="card"><b>買付上限</b><strong class="bad">0円</strong><span>購入判断に使わない</span></div>
    </div>
  </section>
  <section>
    <h2>関連ページ</h2>
    <div class="links">
      <a href="index.html">ホーム</a>
      <a href="latest_practical_start_20260614.html">実用パート入口</a>
      <a href="p1_segment_next_gate_input_validator_20260615.html">次ゲート入力バリデーター</a>
      <a href="p1_price_basis_official_promotion_workbench_20260615.html">PER/PBR基準日作業台</a>
    </div>
  </section>
  <section>
    <h2>反映サマリー</h2>
    ${table(summaryRows, [
      { key: "項目", label: "項目" },
      { key: "値", label: "値" },
      { key: "説明", label: "説明" },
    ])}
  </section>
  <section>
    <h2>反映・見送り明細</h2>
    ${table(auditRows, [
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "ゲート", label: "ゲート" },
      { key: "入力項目", label: "入力項目" },
      { key: "候補値", label: "候補値" },
      { key: "処理", label: "処理" },
      { key: "確認区分", label: "確認区分" },
      { key: "理由", label: "理由" },
    ])}
  </section>
</main>
</body>
</html>`;
  fs.writeFileSync(p(auditHtml), html, "utf8");
}

const queue = readCsv(queueCsv);
const candidates = readCsv(candidateCsv);
const candidatesById = candidateById(candidates);
const auditRows = [];

for (const row of queue) {
  const candidate = candidatesById.get(row.入力ID);
  if (!candidate) continue;

  if (canApplyPrice(candidate)) {
    row.入力値 = candidate.候補値;
    row.出所URLまたは資料名 = candidate.参照URL || candidate.取得元;
    row.ページまたは取得日時 = buildPositionText(candidate);
    row.公式確認 = "計算確認済";
    row.スコア反映 = "禁止";
    row.P1復帰 = "0社";
    row.買付上限 = "0円";
    auditRows.push({
      ticker: row.ticker,
      銘柄: row.銘柄,
      ゲート: row.ゲート,
      入力ID: row.入力ID,
      入力項目: row.入力項目,
      候補値: candidate.候補値,
      処理: "反映",
      確認区分: "計算確認済",
      理由: "株価時系列または100社再計算ファイルの計算値として入力。公式決算値とは区別し、スコアには反映しない。",
      出所: candidate.取得元,
    });
    continue;
  }

  if (canApplyExplanation(candidate)) {
    row.入力値 = candidate.候補値;
    row.出所URLまたは資料名 = candidate.取得元;
    row.ページまたは取得日時 = buildPositionText(candidate);
    row.公式確認 = "運用確認済";
    row.スコア反映 = "禁止";
    row.P1復帰 = "0社";
    row.買付上限 = "0円";
    auditRows.push({
      ticker: row.ticker,
      銘柄: row.銘柄,
      ゲート: row.ゲート,
      入力ID: row.入力ID,
      入力項目: row.入力項目,
      候補値: candidate.候補値,
      処理: "反映",
      確認区分: "運用確認済",
      理由: "買う理由ではなく、残す条件・落とす条件・未確認事項を明示するための運用ルールとして入力。",
      出所: candidate.取得元,
    });
    continue;
  }

  if (candidate.候補値あり === "あり" && (safePriceIds.has(candidate.入力ID) || explicitSkipIds.has(candidate.入力ID) || isExplanationId(candidate.入力ID))) {
    auditRows.push({
      ticker: row.ticker,
      銘柄: row.銘柄,
      ゲート: row.ゲート,
      入力ID: row.入力ID,
      入力項目: row.入力項目,
      候補値: candidate.候補値,
      処理: "見送り",
      確認区分: "未",
      理由: explicitSkipIds.has(candidate.入力ID)
        ? "候補値が20日最大下落率であり、1年最大下落率として転記できない。"
        : "安全反映対象外。財務・PER/PBR・イベント結果は別確認が必要。",
      出所: candidate.取得元,
    });
  }
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
writeCsv(queueCsv, queue, queueHeaders);

const auditHeaders = [
  "ticker",
  "銘柄",
  "ゲート",
  "入力ID",
  "入力項目",
  "候補値",
  "処理",
  "確認区分",
  "理由",
  "出所",
];
writeCsv(auditCsv, auditRows, auditHeaders);

const priceApplied = auditRows.filter((row) => row.処理 === "反映" && row.確認区分 === "計算確認済").length;
const explanationApplied = auditRows.filter((row) => row.処理 === "反映" && row.確認区分 === "運用確認済").length;
const skipped = auditRows.filter((row) => row.処理 === "見送り").length;
const summaryRows = [
  {
    項目: "価格系反映",
    値: `${priceApplied}項目`,
    説明: "PER/PBRではなく、株価時系列・指数比較・CAGR等の計算値だけを計算確認済として入力。",
  },
  {
    項目: "説明欄反映",
    値: `${explanationApplied}項目`,
    説明: "残す条件・落とす条件・未確認事項を運用確認済として入力。投資判断そのものではない。",
  },
  {
    項目: "見送り",
    値: `${skipped}項目`,
    説明: "6503の1年最大下落率候補は20日最大下落率だったため転記しない。",
  },
  {
    項目: "P1復帰/買付",
    値: "0社 / 0円",
    説明: "財務未確認とイベント未入力が残るため、購入候補には戻さない。",
  },
];

writeAuditHtml(auditRows, summaryRows);
updateNav();

console.log(JSON.stringify({ auditHtml, auditCsv, priceApplied, explanationApplied, skipped, buyLimit: "0円" }, null, 2));
