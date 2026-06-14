import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/15 00:55";

const marketJson = "data/market_update.json";
const metricCsv = "p1_financial_pdf_metric_candidates_20260614.csv";
const outputCsv = "p1_financial_per_pbr_basis_20260615.csv";
const summaryCsv = "p1_financial_per_pbr_basis_summary_20260615.csv";
const htmlFile = "p1_financial_per_pbr_basis_20260615.html";

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

function writeCsv(file, rows) {
  const headers = Object.keys(rows[0] ?? { empty: "" });
  const body = [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
  fs.writeFileSync(p(file), `\uFEFF${body}\n`, "utf8");
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

function num(value) {
  const text = String(value ?? "").replace(/,/g, "").replace(/倍|円|%/g, "").trim();
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return "";
  return Number(value.toFixed(digits));
}

function findMetric(metrics, ticker, item) {
  const row = metrics.find((candidate) => candidate.ticker === ticker && candidate.抽出項目 === item);
  return num(row?.抽出値);
}

function findStock(market, symbol) {
  return (market.stocks ?? []).find((stock) => stock.symbol === symbol);
}

const tickers = [
  {
    ticker: "6503.T",
    name: "三菱電機",
    sourceName: "2026年3月期 決算短信〔IFRS〕一部訂正版",
    sourceUrl: "https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co1.pdf",
    guidanceKind: "通期会社予想",
    note: "会社予想EPSが通期のため、実績PERと予想PERを分けて候補化できる。",
  },
  {
    ticker: "8035.T",
    name: "東京エレクトロン",
    sourceName: "2026年3月期 決算短信〔日本基準〕",
    sourceUrl: "https://www.tel.co.jp/ir/library/report/jngpc500000000l6-att/fy26q4tanshin-j.pdf",
    guidanceKind: "第2四半期累計予想",
    note: "会社予想EPSは第2四半期累計であり、通期PERとして使わない。実績PERとPBRだけ候補化する。",
  },
];

function buildRows() {
  const market = JSON.parse(fs.readFileSync(p(marketJson), "utf8"));
  const metrics = readCsv(metricCsv);
  const rows = [];

  for (const item of tickers) {
    const stock = findStock(market, item.ticker);
    const price = num(stock?.price);
    const actualEps = findMetric(metrics, item.ticker, "EPS");
    const guidanceEps = findMetric(metrics, item.ticker, "会社予想 EPS");
    const bps = findMetric(metrics, item.ticker, "BPS");
    const actualPer = price && actualEps ? price / actualEps : null;
    const guidancePer = price && guidanceEps ? price / guidanceEps : null;
    const pbr = price && bps ? price / bps : null;

    rows.push({
      ticker: item.ticker,
      銘柄: item.name,
      計算項目: "実績PER",
      計算候補値: actualPer ? `${round(actualPer)}倍` : "未計算",
      株価: price ? `${price}円` : "未取得",
      株価基準: `${market.updatedAt} / ${market.source}`,
      分母: actualEps ? `実績EPS ${actualEps}円` : "未取得",
      計算式: actualPer ? `${price} ÷ ${actualEps}` : "未計算",
      反映可否: "反映しない",
      公式確認扱い: "公式確認済みにしない",
      注意: "株価が既存JSON基準。PDF値と株価基準日の目視確認後に入力候補。",
      参照資料: item.sourceName,
      参照URL: item.sourceUrl,
    });

    rows.push({
      ticker: item.ticker,
      銘柄: item.name,
      計算項目: "予想PER",
      計算候補値: item.guidanceKind === "通期会社予想" && guidancePer ? `${round(guidancePer)}倍` : "参考外",
      株価: price ? `${price}円` : "未取得",
      株価基準: `${market.updatedAt} / ${market.source}`,
      分母: guidanceEps ? `${item.guidanceKind} EPS ${guidanceEps}円` : "未取得",
      計算式: item.guidanceKind === "通期会社予想" && guidancePer ? `${price} ÷ ${guidanceEps}` : "通期予想ではないため計算値を採用しない",
      反映可否: "反映しない",
      公式確認扱い: "公式確認済みにしない",
      注意: item.note,
      参照資料: item.sourceName,
      参照URL: item.sourceUrl,
    });

    rows.push({
      ticker: item.ticker,
      銘柄: item.name,
      計算項目: "PBR",
      計算候補値: pbr ? `${round(pbr)}倍` : "未計算",
      株価: price ? `${price}円` : "未取得",
      株価基準: `${market.updatedAt} / ${market.source}`,
      分母: bps ? `BPS ${bps}円` : "未取得",
      計算式: pbr ? `${price} ÷ ${bps}` : "未計算",
      反映可否: "反映しない",
      公式確認扱い: "公式確認済みにしない",
      注意: "BPSはPDF抽出候補。株価基準日とBPSの原文確認後に入力候補。",
      参照資料: item.sourceName,
      参照URL: item.sourceUrl,
    });
  }
  return rows;
}

function buildSummary(rows) {
  return [
    { 項目: "対象銘柄", 値: "2社", 判定: "計算候補作成", メモ: "6503 三菱電機、8035 東京エレクトロン" },
    { 項目: "計算候補", 値: `${rows.length}行`, 判定: "候補値", メモ: "実績PER、予想PER、PBRを分離。" },
    { 項目: "公式確認済み", 値: "0項目", 判定: "未完了", メモ: "株価基準日とPDF原文の目視確認前。" },
    { 項目: "入力CSV反映", 値: "0件", 判定: "反映しない", メモ: "入力フォームにはまだ書き込まない。" },
    { 項目: "P1復帰可能", 値: "0社", 判定: "不可", メモ: "PER/PBR候補だけでは復帰不可。受注・セグメント寄与も必要。" },
    { 項目: "買付上限", 値: "0円", 判定: "維持", メモ: "イベント、口座、公式財務のゲートがそろうまで0円。" },
  ];
}

function statusClass(value) {
  const text = String(value ?? "");
  if (/0円|不可|未完了|反映しない|公式確認済みにしない|参考外/.test(text)) return "bad";
  if (/候補|未取得|未計算|目視|注意|通期予想ではない/.test(text)) return "warn";
  if (/作成|取得|計算/.test(text)) return "ok";
  return "";
}

function table(rows, columns) {
  return `<div class="table-wrap"><table><thead><tr>${columns.map((column) => `<th>${h(column.label)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((column) => {
    const value = row[column.key];
    const cls = statusClass(value);
    if (column.link && value) return `<td class="${cls}"><a href="${h(value)}" target="_blank" rel="noopener">${h(value)}</a></td>`;
    return `<td class="${cls}">${h(value)}</td>`;
  }).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function card(title, value, note, className = "") {
  return `<div class="card ${className}"><b>${h(title)}</b><strong>${h(value)}</strong><span>${h(note)}</span></div>`;
}

function writeHtml(rows, summary) {
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>P1 財務 PER/PBR計算候補</title>
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
  <h1>P1 財務 PER/PBR計算候補</h1>
  <p>PDF抽出値と記録済み株価を使い、PER/PBRを基準日つきで試算します。入力CSVへはまだ反映しません。</p>
</header>
<main>
  <section>
    <h2>結論</h2>
    <p class="notice">PER/PBRの計算候補は作成しましたが、公式確認済みにはしていません。株価基準日とPDF原文の確認が終わるまで、P1復帰可能0社・買付上限0円です。</p>
    <div class="cards">
      ${card("対象", "2社", "6503/8035", "ok")}
      ${card("計算候補", `${rows.length}行`, "実績PER・予想PER・PBR", "warn")}
      ${card("公式確認済み", "0項目", "入力反映前", "bad")}
      ${card("買付上限", "0円", "維持", "bad")}
    </div>
  </section>

  <section>
    <h2>確認導線</h2>
    <div class="links">
      <a href="index.html">ホーム</a>
      <a href="latest_practical_start_20260614.html">最新 実用パート入口</a>
      <a href="daily_practical_compact_board_20260614.html">実用日次ボード</a>
      <a href="p1_financial_pdf_to_input_review_20260615.html">PDF→入力レビュー</a>
      <a href="p1_financial_input_validator_20260614.html">入力バリデーター</a>
    </div>
  </section>

  <section>
    <h2>全体サマリー</h2>
    ${table(summary, [
      { key: "項目", label: "項目" },
      { key: "値", label: "値" },
      { key: "判定", label: "判定" },
      { key: "メモ", label: "メモ" },
    ])}
  </section>

  <section>
    <h2>PER/PBR計算候補</h2>
    ${table(rows, [
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "計算項目", label: "計算項目" },
      { key: "計算候補値", label: "計算候補値" },
      { key: "株価", label: "株価" },
      { key: "株価基準", label: "株価基準" },
      { key: "分母", label: "分母" },
      { key: "計算式", label: "計算式" },
      { key: "反映可否", label: "反映可否" },
      { key: "公式確認扱い", label: "公式確認扱い" },
      { key: "注意", label: "注意" },
      { key: "参照資料", label: "参照資料" },
      { key: "参照URL", label: "参照URL", link: true },
    ])}
  </section>

  <section>
    <h2>次に必要な確認</h2>
    <ul>
      <li>株価基準日を、6月再判定に使う日付へ統一する。</li>
      <li>PDFから抽出したEPS/BPSが原文と一致するか目視確認する。</li>
      <li>東京エレクトロンの第2四半期累計予想を、通期PERとして使わない。</li>
      <li>PER/PBRだけで候補復帰させず、受注・セグメント寄与・高PER説明とセットで確認する。</li>
    </ul>
  </section>

  <footer>generated: ${h(generatedAt)} / source: ${h(marketJson)}, ${h(metricCsv)}</footer>
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
  insertOnce("index.html", "p1_financial_pdf_to_input_review_20260615.html", `<a class="card" href="${htmlFile}">
          <b>P1 財務 PER/PBR計算候補</b>
          <span>PDFのEPS/BPSと記録済み株価からPER/PBRを基準日つきで試算し、入力前に確認する。</span>
        </a>`);

  insertOnce("latest_practical_start_20260614.html", "p1_financial_pdf_to_input_review_20260615.html", `<a class="step" href="${htmlFile}">
        <b>6-12h. P1 財務 PER/PBR計算候補</b>
        <span>株価基準日、EPS/BPS基準、通期予想かどうかを分けてPER/PBRを確認する。</span>
        <em>PER/PBR候補</em>
      </a>`);

  insertOnce("daily_practical_compact_board_20260614.html", "p1_financial_pdf_to_input_review_20260615.html", `<a href="${htmlFile}">P1 財務 PER/PBR計算候補</a>`);
}

function main() {
  const rows = buildRows();
  const summary = buildSummary(rows);
  writeCsv(outputCsv, rows);
  writeCsv(summaryCsv, summary);
  writeHtml(rows, summary);
  updateNavigation();
  console.log(JSON.stringify({ htmlFile, outputCsv, summaryCsv, rows: rows.length, buyLimit: "0円" }, null, 2));
}

main();
