import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/15 20:15";

const files = {
  html: "p1_price_basis_official_promotion_workbench_20260615.html",
  detail: "p1_price_basis_official_promotion_workbench_20260615.csv",
  summary: "p1_price_basis_official_promotion_summary_20260615.csv",
  promotion: "p1_official_value_promotion_candidates_20260615.csv",
  market: "data/market_update.json",
  perPbrBasis: "p1_financial_per_pbr_basis_20260615.csv",
  pdfCheck: "p1_segment_pdf_official_check_result_20260615.csv",
  queue: "p1_segment_next_gate_input_queue_20260615.csv",
};

function p(file) {
  return path.join(ROOT, file);
}

function readText(file) {
  return fs.readFileSync(p(file), "utf8").replace(/^\uFEFF/, "");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quote = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
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
  if (cell.length || row.length) row.push(cell.replace(/\r$/, ""));
  if (row.length) rows.push(row);
  const cleanRows = rows.filter((values) => values.some((value) => String(value ?? "").trim() !== ""));
  const headers = cleanRows.shift() ?? [];
  return cleanRows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function readCsv(file) {
  return parseCsv(readText(file));
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, rows, headers = null) {
  const cols = headers ?? Object.keys(rows[0] ?? { empty: "" });
  const body = [cols.join(","), ...rows.map((row) => cols.map((col) => csvCell(row[col])).join(","))].join("\n");
  fs.writeFileSync(p(file), `\uFEFF${body}\n`, "utf8");
}

function h(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function numberFromYen(value) {
  const n = Number(String(value ?? "").replace(/[円,]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function round(value, digits = 2) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : "";
}

function byKey(rows, key) {
  const map = new Map();
  for (const row of rows) map.set(row[key], row);
  return map;
}

const market = JSON.parse(readText(files.market));
const stocksBySymbol = byKey(market.stocks ?? [], "symbol");
const perPbrBasis = readCsv(files.perPbrBasis);
const pdfCheck = readCsv(files.pdfCheck);
const queue = readCsv(files.queue);
const queueById = byKey(queue, "入力ID");

const officialFinancialFields = new Set(["ROE", "営業利益率"]);
const officialRows = pdfCheck.filter((row) => officialFinancialFields.has(row["確認項目"]));
const perPbrRows = perPbrBasis.map((row) => {
  const stock = stocksBySymbol.get(row.ticker);
  const basisPrice = numberFromYen(row["株価"]);
  const marketPrice = stock?.price ?? null;
  const priceMatch = Number.isFinite(basisPrice) && Number.isFinite(marketPrice) && Math.abs(basisPrice - marketPrice) < 0.001;
  const calculationName = row["計算項目"];
  const denominatorLabel = row["分母"];
  const denominator = Number(String(denominatorLabel ?? "").match(/[-\d,.]+/)?.[0]?.replace(/,/g, ""));
  const recalculated =
    calculationName === "予想PER" && row["計算候補値"] === "参考外"
      ? "参考外"
      : Number.isFinite(basisPrice) && Number.isFinite(denominator)
        ? `${round(basisPrice / denominator, 2)}倍`
        : "";
  const candidate = row["計算候補値"];
  const recalcMatch = recalculated === "参考外" || String(candidate).replace(/\.00倍$/, "倍") === String(recalculated).replace(/\.00倍$/, "倍");
  const officialReady =
    priceMatch &&
    recalcMatch &&
    row["公式確認扱い"] === "公式確認済みにしない"
      ? "まだ正式値にしない"
      : "要確認";
  return {
    ticker: row.ticker,
    銘柄: row["銘柄"],
    計算項目: calculationName,
    PDF側の根拠: denominatorLabel,
    株価候補: row["株価"],
    株価取得元: market.source,
    株価取得日時: market.updatedAt,
    JSON株価との差: priceMatch ? "一致" : `不一致: JSON ${marketPrice ?? "未取得"}`,
    再計算値: recalculated,
    既存候補値: candidate,
    計算一致: recalcMatch ? "一致" : "要再確認",
    現時点の扱い: officialReady,
    スコア反映: "禁止",
    P1復帰: "0社",
    買付上限: "0円",
    次に必要なこと: "証券会社画面または同一基準日の株価取得ログを確認し、EPS/BPSの公式値と同じ行で再計算する。",
  };
});

const promotionRows = officialRows.map((row) => {
  const id = `${row.ticker.replace(".T", "")}_${row["確認項目"] === "ROE" ? "roe_official" : "operating_margin"}`;
  const originalQueue = queueById.get(id);
  const applied =
    originalQueue?.["公式確認"] === "済" &&
    originalQueue?.["入力値"] === row["PDF原文値"] &&
    originalQueue?.["出所URLまたは資料名"] === row["参照URL"] &&
    originalQueue?.["ページまたは取得日時"] === row["根拠"];
  return {
    ticker: row.ticker,
    銘柄: row["銘柄"],
    入力ID: id,
    入力項目: row["確認項目"],
    公式確認値: row["PDF原文値"],
    参照資料: row["根拠"],
    参照URL: row["参照URL"],
    元キュー状態: applied ? "原本反映済み" : "原本未反映",
    昇格候補判定: applied ? "反映済み" : "候補化可",
    原本上書き: applied ? "完了" : "まだ",
    スコア反映: "禁止",
    P1復帰: "0社",
    買付上限: "0円",
    理由: applied
      ? "公式PDF確認値を原本入力キューへ反映済み。ただし、この反映だけでスコア・P1復帰・買付上限は動かさない。"
      : "公式PDFで確認済みだが、入力キューへ上書きする前に値・出所・年度・単位の検算を残す。",
  };
});

const appliedPromotionCount = promotionRows.filter((row) => row["元キュー状態"] === "原本反映済み").length;

const summaryRows = [
  {
    項目: "PER/PBR計算候補",
    件数: `${perPbrRows.length}件`,
    現在の扱い: "正式スコア反映なし",
    理由: "EPS/BPSは公式PDFで確認済みだが、株価は取得ログ由来のため、基準日確認を分ける。",
  },
  {
    項目: "株価ログ一致",
    件数: `${perPbrRows.filter((row) => row["JSON株価との差"] === "一致").length}/${perPbrRows.length}件`,
    現在の扱い: "取得ログ上は一致",
    理由: "既存PER/PBR候補の株価と、market_update.jsonの株価は一致。ただし公式PER/PBR扱いにはしない。",
  },
  {
    項目: "公式値昇格候補",
    件数: `${promotionRows.length}件`,
    現在の扱い: appliedPromotionCount === promotionRows.length ? "原本反映済み" : "原本上書き前",
    理由: `ROE・営業利益率は公式PDFで確認済み。原本キュー反映は${appliedPromotionCount}/${promotionRows.length}件。`,
  },
  {
    項目: "スコア反映",
    件数: "0項目",
    現在の扱い: "禁止",
    理由: "PER/PBRの正式値化、原本キュー反映、イベント後データ、購入前ゲートが未通過のため。",
  },
  {
    項目: "P1復帰 / 買付上限",
    件数: "0社 / 0円",
    現在の扱い: "維持",
    理由: "検算作業のページであり、購入候補や買付金額を増やすページではない。",
  },
];

writeCsv(files.detail, perPbrRows, [
  "ticker",
  "銘柄",
  "計算項目",
  "PDF側の根拠",
  "株価候補",
  "株価取得元",
  "株価取得日時",
  "JSON株価との差",
  "再計算値",
  "既存候補値",
  "計算一致",
  "現時点の扱い",
  "スコア反映",
  "P1復帰",
  "買付上限",
  "次に必要なこと",
]);
writeCsv(files.promotion, promotionRows, [
  "ticker",
  "銘柄",
  "入力ID",
  "入力項目",
  "公式確認値",
  "参照資料",
  "参照URL",
  "元キュー状態",
  "昇格候補判定",
  "原本上書き",
  "スコア反映",
  "P1復帰",
  "買付上限",
  "理由",
]);
writeCsv(files.summary, summaryRows, ["項目", "件数", "現在の扱い", "理由"]);

function statusClass(value) {
  const text = String(value ?? "");
  if (/禁止|0社|0円|まだ|未反映|正式スコア反映なし|正式値にしない|要確認/.test(text)) return "bad";
  if (/候補|取得ログ上|一致|原本上書き前/.test(text)) return "warn";
  if (/可|済み|反映済み/.test(text)) return "ok";
  return "";
}

function table(rows, columns) {
  return `<div class="table-wrap"><table><thead><tr>${columns.map((column) => `<th>${h(column.label)}</th>`).join("")}</tr></thead><tbody>${rows
    .map(
      (row) =>
        `<tr>${columns
          .map((column) => `<td class="${statusClass(row[column.key])}">${h(row[column.key])}</td>`)
          .join("")}</tr>`,
    )
    .join("")}</tbody></table></div>`;
}

function card(title, value, note, className = "") {
  return `<div class="card ${className}"><b>${h(title)}</b><strong>${h(value)}</strong><span>${h(note)}</span></div>`;
}

function writeHtml() {
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>P1 PER/PBR基準日・公式値昇格 作業台</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--red:#b42318;--warn:#9a5b00;--green:#116b4f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.75}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:white;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);line-height:1.2;letter-spacing:0}
    header p{margin:0;max-width:1180px;font-weight:850}
    main{max-width:1540px;margin:0 auto;padding:22px}
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
  <h1>P1 PER/PBR基準日・公式値昇格 作業台</h1>
  <p>PER/PBRの計算候補と、公式PDFで確認できたROE・営業利益率を分けて検算する画面です。ここではスコア反映、P1復帰、買付金額の解除は行いません。</p>
</header>
<main>
  <section>
    <h2>現在の結論</h2>
    <p class="notice">PER/PBRは再計算できますが、まだ正式スコアには入れません。株価基準日の確認と原本キューへの反映が終わるまで、スコア反映0項目、P1復帰0社、買付上限0円を維持します。</p>
    <div class="cards">
      ${card("PER/PBR候補", `${perPbrRows.length}件`, "計算式と取得ログを検算", "warn")}
      ${card("公式値昇格候補", `${promotionRows.length}件`, "ROE・営業利益率のみ候補化", "warn")}
      ${card("スコア反映", "0項目", "未確認値を混ぜない", "bad")}
      ${card("買付上限", "0円", "購入判断には未接続", "bad")}
    </div>
  </section>

  <section>
    <h2>関連ページ</h2>
    <div class="links">
      <a href="index.html">ホーム</a>
      <a href="latest_practical_start_20260614.html">実用パート入口</a>
      <a href="p1_issue_resolution_board_20260615.html">P1未解決10項目 改善ボード</a>
      <a href="p1_financial_per_pbr_basis_20260615.html">PER/PBR計算候補</a>
      <a href="p1_segment_pdf_official_check_result_20260615.html">PDF原文確認結果</a>
      <a href="p1_segment_next_gate_input_queue_20260615.html">次ゲート入力キュー</a>
      <a href="${files.detail}">検算CSV</a>
      <a href="${files.promotion}">昇格候補CSV</a>
    </div>
  </section>

  <section>
    <h2>要約</h2>
    ${table(summaryRows, [
      { key: "項目", label: "項目" },
      { key: "件数", label: "件数" },
      { key: "現在の扱い", label: "現在の扱い" },
      { key: "理由", label: "理由" },
    ])}
  </section>

  <section>
    <h2>PER/PBR基準日・再計算チェック</h2>
    ${table(perPbrRows, [
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "計算項目", label: "計算項目" },
      { key: "PDF側の根拠", label: "PDF側の根拠" },
      { key: "株価候補", label: "株価候補" },
      { key: "株価取得日時", label: "株価取得日時" },
      { key: "JSON株価との差", label: "JSON株価との差" },
      { key: "再計算値", label: "再計算値" },
      { key: "既存候補値", label: "既存候補値" },
      { key: "現時点の扱い", label: "現時点の扱い" },
      { key: "スコア反映", label: "スコア反映" },
      { key: "次に必要なこと", label: "次に必要なこと" },
    ])}
  </section>

  <section>
    <h2>公式値昇格候補</h2>
    ${table(promotionRows, [
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "入力ID", label: "入力ID" },
      { key: "入力項目", label: "入力項目" },
      { key: "公式確認値", label: "公式確認値" },
      { key: "元キュー状態", label: "元キュー状態" },
      { key: "昇格候補判定", label: "昇格候補判定" },
      { key: "原本上書き", label: "原本上書き" },
      { key: "スコア反映", label: "スコア反映" },
      { key: "P1復帰", label: "P1復帰" },
      { key: "買付上限", label: "買付上限" },
      { key: "理由", label: "理由" },
    ])}
  </section>

  <footer>generated: ${h(generatedAt)} / source: market_update.json, p1_financial_per_pbr_basis_20260615.csv, p1_segment_pdf_official_check_result_20260615.csv. 本ページは検算用であり、投資助言、自動売買、購入指示ではありません。</footer>
</main>
</body>
</html>`;
  fs.writeFileSync(p(files.html), `\uFEFF${html}`, "utf8");
}

function insertAfter(content, marker, addition) {
  if (content.includes(addition.trim()) || content.includes(files.html)) return content;
  const index = content.indexOf(marker);
  if (index === -1) return content;
  const end = index + marker.length;
  return `${content.slice(0, end)}\n${addition}\n${content.slice(end)}`;
}

function updateLinks() {
  const homeCard = `<a class="card" href="${files.html}">
          <b>P1 PER/PBR基準日・公式値昇格 作業台</b>
          <span>PER/PBRの株価基準日、再計算、公式PDF値の昇格候補を同じ画面で検算。スコア反映0項目、P1復帰0社、買付上限0円を維持。</span>
        </a>`;
  const latestStep = `<a class="step" href="${files.html}">
        <b>6-12aa. P1 PER/PBR基準日・公式値昇格 作業台</b>
        <span>PER/PBR候補と公式PDF確認値を分けて検算し、正式反映前に止める。</span>
        <em>検算</em>
      </a>`;
  const boardLink = `<a href="${files.html}">P1 PER/PBR基準日・公式値昇格 作業台</a>`;

  const indexPath = p("index.html");
  let index = fs.readFileSync(indexPath, "utf8");
  index = insertAfter(
    index,
    `<a class="card" href="p1_issue_resolution_board_20260615.html">
          <b>P1未解決10項目 改善ボード</b>
          <span>PER/PBR、公式転記、イベント、事業寄与、質的テーマ、買付比率を分けて検査。スコア反映0項目、P1復帰0社、買付上限0円を維持。</span>
        </a>`,
    homeCard,
  );
  fs.writeFileSync(indexPath, index, "utf8");

  const latestPath = p("latest_practical_start_20260614.html");
  let latest = fs.readFileSync(latestPath, "utf8");
  latest = insertAfter(
    latest,
    `<a class="card" href="p1_issue_resolution_board_20260615.html">
          <b>P1未解決10項目 改善ボード</b>
          <span>未確認値を点数や購入金額に混ぜないための、P1復帰前の改善状況一覧。</span>
        </a>`,
    latestStep,
  );
  fs.writeFileSync(latestPath, latest, "utf8");

  const boardPath = p("daily_practical_compact_board_20260614.html");
  let board = fs.readFileSync(boardPath, "utf8");
  board = insertAfter(board, `<a href="p1_issue_resolution_board_20260615.html">P1未解決10項目 改善ボード</a>`, boardLink);
  fs.writeFileSync(boardPath, board, "utf8");

  const issuePath = p("p1_issue_resolution_board_20260615.html");
  let issue = fs.readFileSync(issuePath, "utf8");
  issue = insertAfter(issue, `<a href="102_june_event_result_input.csv">イベント入力CSV</a>`, `<a href="${files.html}">PER/PBR基準日・公式値昇格 作業台</a>`);
  fs.writeFileSync(issuePath, issue, "utf8");
}

writeHtml();
updateLinks();

console.log(JSON.stringify({
  html: files.html,
  detail: files.detail,
  summary: files.summary,
  promotion: files.promotion,
  perPbrRows: perPbrRows.length,
  promotionRows: promotionRows.length,
  scoreReflected: 0,
  p1Return: 0,
  buyLimit: 0,
}, null, 2));
