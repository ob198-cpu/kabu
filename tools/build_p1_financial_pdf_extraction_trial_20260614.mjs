import fs from "node:fs";
import path from "node:path";
import https from "node:https";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PDFParse } = require("../../node_modules/pdf-parse");

const ROOT = process.cwd();
const generatedAt = "2026/06/15 00:15";
const cacheDir = "data/official_pdf_candidates_20260614";
const metricCsv = "p1_financial_pdf_metric_candidates_20260614.csv";
const docCsv = "p1_financial_pdf_document_status_20260614.csv";
const summaryCsv = "p1_financial_pdf_extraction_summary_20260614.csv";
const htmlFile = "p1_financial_pdf_extraction_trial_20260614.html";

function p(file) {
  return path.join(ROOT, file);
}

function ensureDir(dir) {
  fs.mkdirSync(p(dir), { recursive: true });
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
  const headers = Object.keys(rows[0]);
  const body = [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
  fs.writeFileSync(p(file), `\uFEFF${body}\n`, "utf8");
}

function readText(file) {
  return fs.existsSync(p(file)) ? fs.readFileSync(p(file), "utf8") : "";
}

function download(url, output) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, (response) => {
      if ([301, 302, 303, 307, 308].includes(response.statusCode ?? 0) && response.headers.location) {
        download(new URL(response.headers.location, url).toString(), output).then(resolve, reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode} ${url}`));
        return;
      }
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        fs.writeFileSync(output, Buffer.concat(chunks));
        resolve();
      });
    });
    request.setTimeout(60000, () => request.destroy(new Error(`timeout ${url}`)));
    request.on("error", reject);
  });
}

function compact(text) {
  return String(text ?? "").replace(/\s+/g, " ").trim();
}

function findSnippet(text, pattern, size = 420) {
  const idx = text.search(pattern);
  if (idx < 0) return "";
  return compact(text.slice(Math.max(0, idx - 90), idx + size));
}

function addMetric(rows, base, item, value, unit, status, snippet, note) {
  rows.push({
    ticker: base.ticker,
    銘柄: base.name,
    資料名: base.documentName,
    資料URL: base.url,
    抽出項目: item,
    抽出値: value,
    単位: unit,
    抽出状態: status,
    根拠スニペット: snippet,
    入力CSV反映: "反映しない",
    次確認: note,
  });
}

function statusClass(value) {
  const text = String(value ?? "");
  if (/(未抽出|未計算|未確認|反映しない|0円|不可)/.test(text)) return "bad";
  if (/(候補|要目視|部分|注意)/.test(text)) return "warn";
  if (/(抽出候補|PDF抽出済み|取得済み)/.test(text)) return "ok";
  return "";
}

function table(rows, columns) {
  return `<div class="table-wrap"><table><thead><tr>${columns.map((column) => `<th>${h(column.label)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${columns.map((column) => {
      const value = row[column.key];
      if (column.link && value) return `<td class="${statusClass(value)}"><a href="${h(value)}" target="_blank" rel="noopener">${h(value)}</a></td>`;
      return `<td class="${statusClass(value)}">${h(value)}</td>`;
    }).join("")}</tr>`)
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
  const updated = text.replace(/<a class="card" href="p1_financial_direct_document_candidates_20260614\.html">[\s\S]*?<\/a>\s*/u, (match) => `${match}${cardHtml}`);
  fs.writeFileSync(p(file), updated, "utf8");
}

function ensureStepLink(file, href, label, note) {
  if (!fs.existsSync(p(file))) return;
  const text = readText(file);
  if (text.includes(href)) return;
  const stepHtml = `<a class="step" href="${href}">
        <b>${label}</b>
        <span>${note}</span>
        <em>PDF抽出</em>
      </a>
`;
  const updated = text.replace(/<a class="step" href="p1_financial_direct_document_candidates_20260614\.html">[\s\S]*?<\/a>\s*/u, (match) => `${match}${stepHtml}`);
  fs.writeFileSync(p(file), updated, "utf8");
}

function ensureCompactLink(file, href, label) {
  if (!fs.existsSync(p(file))) return;
  const text = readText(file);
  if (text.includes(href)) return;
  const updated = text.replace(
    /<a href="p1_financial_direct_document_candidates_20260614\.html">P1 財務 直接\s*資料候補<\/a>/u,
    `<a href="p1_financial_direct_document_candidates_20260614.html">P1 財務 直接資料候補</a>\n<a href="${href}">${label}</a>`,
  );
  fs.writeFileSync(p(file), updated, "utf8");
}

const docs = [
  {
    ticker: "6503.T",
    name: "三菱電機",
    url: "https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co1.pdf",
    file: "6503_mitsubishi_electric_0428_co1.pdf",
    documentName: "2026年3月期 決算短信〔IFRS〕一部訂正版",
  },
  {
    ticker: "8035.T",
    name: "東京エレクトロン",
    url: "https://www.tel.co.jp/ir/library/report/jngpc500000000l6-att/fy26q4tanshin-j.pdf",
    file: "8035_tel_fy26q4tanshin_j.pdf",
    documentName: "2026年3月期 決算短信〔日本基準〕",
  },
];

ensureDir(cacheDir);

const docRows = [];
const metricRows = [];

for (const doc of docs) {
  const local = p(path.join(cacheDir, doc.file));
  if (!fs.existsSync(local)) {
    await download(doc.url, local);
  }
  const parser = new PDFParse({ data: fs.readFileSync(local) });
  const result = await parser.getText();
  await parser.destroy();
  const text = result.text;

  docRows.push({
    ticker: doc.ticker,
    銘柄: doc.name,
    資料名: doc.documentName,
    資料URL: doc.url,
    ローカル確認: path.join(cacheDir, doc.file).replace(/\\/g, "/"),
    ページ数: result.total,
    文字数: text.length,
    抽出状態: "PDF抽出済み",
    入力CSV反映: "反映しない",
    注意: "PDFテキスト抽出済み。ただし対象期・ページ位置・数値の目視確認前。",
  });

  if (doc.ticker === "6503.T") {
    const sales = /2026年3月期\s+5,894,747\s+6\.8\s+433,095\s+10\.5\s+526,077\s+20\.3\s+407,758\s+25\.8/.exec(text);
    const roe = /2026年3月期\s+198\.31\s+198\.31\s+9\.7\s+7\.7\s+7\.3/.exec(text);
    const bps = /2026年3月期\s+7,357,512\s+4,629,993\s+4,484,266\s+60\.9\s+2,191\.26/.exec(text);
    const forecast = /通期\s+6,200,000\s+5\.2\s+590,000\s+17\.7\s+640,000\s+21\.7\s+475,000\s+16\.5\s+231\.01/.exec(text);
    addMetric(metricRows, doc, "売上高", sales ? "5,894,747" : "", "百万円", sales ? "抽出候補" : "未抽出", findSnippet(text, /2026年3月期\s+5,894,747/), "目視確認後に入力候補。");
    addMetric(metricRows, doc, "売上高 前期比", sales ? "+6.8" : "", "%", sales ? "抽出候補" : "未抽出", findSnippet(text, /2026年3月期\s+5,894,747/), "目視確認後に入力候補。");
    addMetric(metricRows, doc, "営業利益", sales ? "433,095" : "", "百万円", sales ? "抽出候補" : "未抽出", findSnippet(text, /営業利益[\s\S]{0,240}2026年3月期/), "IFRS。目視確認後に入力候補。");
    addMetric(metricRows, doc, "営業利益 前期比", sales ? "+10.5" : "", "%", sales ? "抽出候補" : "未抽出", findSnippet(text, /営業利益[\s\S]{0,240}2026年3月期/), "目視確認後に入力候補。");
    addMetric(metricRows, doc, "EPS", roe ? "198.31" : "", "円", roe ? "抽出候補" : "未抽出", findSnippet(text, /1株当たり[\s\S]{0,260}2026年3月期\s+198\.31/), "実績EPS。PER計算には株価基準日が別途必要。");
    addMetric(metricRows, doc, "ROE", roe ? "9.7" : "", "%", roe ? "抽出候補" : "未抽出", findSnippet(text, /親会社株主[\s\S]{0,260}2026年3月期\s+198\.31/), "会社資料上の親会社株主帰属持分当期純利益率。");
    addMetric(metricRows, doc, "営業利益率", roe ? "7.3" : "", "%", roe ? "抽出候補" : "未抽出", findSnippet(text, /売上高\s+営業利益率[\s\S]{0,180}2026年3月期/), "実績営業利益率。");
    addMetric(metricRows, doc, "BPS", bps ? "2,191.26" : "", "円", bps ? "抽出候補" : "未抽出", findSnippet(text, /1株当たり親会社[\s\S]{0,260}2026年3月期/), "PBR計算には株価基準日が別途必要。");
    addMetric(metricRows, doc, "会社予想 売上高", forecast ? "6,200,000" : "", "百万円", forecast ? "抽出候補" : "未抽出", findSnippet(text, /3．2027年3月期の連結業績予想|通期\s+6,200,000/), "2027年3月期通期予想。");
    addMetric(metricRows, doc, "会社予想 EPS", forecast ? "231.01" : "", "円", forecast ? "抽出候補" : "未抽出", findSnippet(text, /通期\s+6,200,000/), "2027年3月期通期予想EPS。");
  }

  if (doc.ticker === "8035.T") {
    const sales = /2026年3月期\s+2,443,533\s+0\.5\s+624,936\s+△10\.4\s+630,338\s+△10\.9\s+574,454\s+5\.6/.exec(text);
    const roe = /2026年3月期\s+1,254\.57\s+1,250\.88\s+29\.6\s+23\.0\s+25\.6/.exec(text);
    const bps = /2026年3月期\s+2,860,997\s+2,069,996\s+71\.5\s+4,498\.85/.exec(text);
    const forecast = /第2四半期\(累計\)\s+1,570,000\s+33\.1\s+431,000\s+42\.2\s+437,000\s+42\.4\s+328,000\s+35\.7\s+721\.12/.exec(text);
    addMetric(metricRows, doc, "売上高", sales ? "2,443,533" : "", "百万円", sales ? "抽出候補" : "未抽出", findSnippet(text, /2026年3月期\s+2,443,533/), "目視確認後に入力候補。");
    addMetric(metricRows, doc, "売上高 前期比", sales ? "+0.5" : "", "%", sales ? "抽出候補" : "未抽出", findSnippet(text, /2026年3月期\s+2,443,533/), "目視確認後に入力候補。");
    addMetric(metricRows, doc, "営業利益", sales ? "624,936" : "", "百万円", sales ? "抽出候補" : "未抽出", findSnippet(text, /営業利益[\s\S]{0,240}2026年3月期/), "目視確認後に入力候補。");
    addMetric(metricRows, doc, "営業利益 前期比", sales ? "-10.4" : "", "%", sales ? "抽出候補" : "未抽出", findSnippet(text, /営業利益[\s\S]{0,240}2026年3月期/), "決算短信の△10.4を-10.4として候補化。");
    addMetric(metricRows, doc, "EPS", roe ? "1,254.57" : "", "円", roe ? "抽出候補" : "未抽出", findSnippet(text, /1株当たり当期純利益[\s\S]{0,260}2026年3月期/), "実績EPS。PER計算には株価基準日が別途必要。");
    addMetric(metricRows, doc, "ROE", roe ? "29.6" : "", "%", roe ? "抽出候補" : "未抽出", findSnippet(text, /自己資本[\s\S]{0,260}2026年3月期\s+1,254\.57/), "会社資料上の自己資本当期純利益率。");
    addMetric(metricRows, doc, "営業利益率", roe ? "25.6" : "", "%", roe ? "抽出候補" : "未抽出", findSnippet(text, /売上高営業利益率[\s\S]{0,220}2026年3月期/), "実績営業利益率。");
    addMetric(metricRows, doc, "BPS", bps ? "4,498.85" : "", "円", bps ? "抽出候補" : "未抽出", findSnippet(text, /1株当たり純資産[\s\S]{0,220}2026年3月期/), "PBR計算には株価基準日が別途必要。");
    addMetric(metricRows, doc, "会社予想 売上高", forecast ? "1,570,000" : "", "百万円", forecast ? "抽出候補" : "未抽出", findSnippet(text, /第2四半期\(累計\)\s+1,570,000/), "2027年3月期第2四半期累計予想。通期予想ではない点に注意。");
    addMetric(metricRows, doc, "会社予想 EPS", forecast ? "721.12" : "", "円", forecast ? "抽出候補" : "未抽出", findSnippet(text, /第2四半期\(累計\)\s+1,570,000/), "第2四半期累計予想EPS。通期予想ではない点に注意。");
  }
}

addMetric(metricRows, { ticker: "6503.T", name: "三菱電機", documentName: "株価基準日未設定", url: "" }, "PER", "", "倍", "未計算", "", "PDFだけでは計算不可。株価基準日とEPS基準を指定する。");
addMetric(metricRows, { ticker: "6503.T", name: "三菱電機", documentName: "株価基準日未設定", url: "" }, "PBR", "", "倍", "未計算", "", "PDFだけでは計算不可。株価基準日とBPS基準を指定する。");
addMetric(metricRows, { ticker: "8035.T", name: "東京エレクトロン", documentName: "株価基準日未設定", url: "" }, "PER", "", "倍", "未計算", "", "PDFだけでは計算不可。株価基準日とEPS基準を指定する。");
addMetric(metricRows, { ticker: "8035.T", name: "東京エレクトロン", documentName: "株価基準日未設定", url: "" }, "PBR", "", "倍", "未計算", "", "PDFだけでは計算不可。株価基準日とBPS基準を指定する。");

writeCsv(docCsv, docRows);
writeCsv(metricCsv, metricRows);

const extractedMetrics = metricRows.filter((row) => row.抽出状態 === "抽出候補").length;
const notCalculated = metricRows.filter((row) => row.抽出状態 === "未計算").length;
const summaryRows = [
  { 項目: "PDF抽出対象", 件数: `${docRows.length}資料`, 状態: "PDF抽出済み", 意味: "直接PDF候補2件をローカルでテキスト化した。" },
  { 項目: "抽出候補値", 件数: `${extractedMetrics}項目`, 状態: "候補", 意味: "売上高、営業利益、EPS、ROE、営業利益率、BPS、会社予想などの候補値。" },
  { 項目: "PER/PBR", 件数: `${notCalculated}項目`, 状態: "未計算", 意味: "PDF内のEPS/BPSだけでは不可。株価基準日が必要。" },
  { 項目: "入力CSV反映", 件数: "0件", 状態: "反映しない", 意味: "目視確認と株価基準日の指定前は公式入力済みにしない。" },
  { 項目: "買付上限", 件数: "0円", 状態: "購入不可", 意味: "PDF抽出候補は買付判断に使わない。" },
];
writeCsv(summaryCsv, summaryRows);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>P1 財務 PDF抽出テスト</title>
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
    .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:14px 0}
    .card{border:1px solid var(--line);border-radius:12px;padding:16px;background:#f9fcff;min-height:124px}
    .card b{display:block;font-size:17px}
    .card strong{display:block;font-size:31px;line-height:1.2;margin:8px 0;color:var(--navy)}
    .card span{display:block;font-size:15px}
    .bad strong,.bad{color:var(--red);font-weight:700}
    .warn strong,.warn{color:var(--warn);font-weight:700}
    .ok strong,.ok{color:var(--green);font-weight:700}
    .table-wrap{overflow:auto;border:1px solid var(--line);border-radius:10px;margin-top:10px}
    table{width:100%;border-collapse:collapse;background:white}
    th,td{border-bottom:1px solid var(--line);border-right:1px solid var(--line);padding:9px 10px;vertical-align:top;text-align:left;overflow-wrap:anywhere}
    th{background:#e7f2fb;color:#07395f;font-weight:800;white-space:nowrap}
    tr:last-child td{border-bottom:0}
    a{color:#064f86;font-weight:800}
    .note{border-left:6px solid var(--warn);background:#fff7e8;padding:14px;margin-top:12px;border-radius:10px}
    .links{display:flex;flex-wrap:wrap;gap:10px}
    .links a{display:inline-block;padding:10px 14px;border:1px solid #87bce0;border-radius:999px;background:#eef8ff;color:#07395f;text-decoration:none;font-weight:800}
  </style>
</head>
<body>
  <header>
    <h1>P1 財務 PDF抽出テスト</h1>
    <p>直接PDF候補2件からテキスト抽出し、財務入力に使えそうな数値を候補化しました。目視確認前なので、入力済み・購入可にはしません。</p>
  </header>
  <main>
    <section>
      <h2>現在の結論</h2>
      <div class="cards">
        ${card("PDF抽出対象", `${docRows.length}資料`, "三菱電機・東京エレクトロン", "ok")}
        ${card("抽出候補値", `${extractedMetrics}項目`, "売上高、営業利益、EPS、ROEなど", "warn")}
        ${card("PER/PBR", "未計算", "株価基準日が必要", "bad")}
        ${card("買付上限", "0円", "抽出候補は買付判断に使わない", "bad")}
      </div>
      <p class="note">このページの数値はPDFテキスト抽出候補です。資料名、対象期、ページ位置、株価基準日を確認した後で、入力CSVへ転記します。</p>
      <div class="links">
        <a href="${docCsv}">資料ステータスCSV</a>
        <a href="${metricCsv}">抽出候補CSV</a>
        <a href="${summaryCsv}">サマリーCSV</a>
        <a href="p1_financial_input_validator_20260614.html">入力バリデーター</a>
      </div>
    </section>

    <section>
      <h2>資料ステータス</h2>
      ${table(docRows, [
        { key: "ticker", label: "ticker" },
        { key: "銘柄", label: "銘柄" },
        { key: "資料名", label: "資料名" },
        { key: "資料URL", label: "資料URL", link: true },
        { key: "ページ数", label: "ページ数" },
        { key: "文字数", label: "文字数" },
        { key: "抽出状態", label: "抽出状態" },
        { key: "入力CSV反映", label: "入力CSV反映" },
        { key: "注意", label: "注意" },
      ])}
    </section>

    <section>
      <h2>抽出候補値</h2>
      ${table(metricRows, [
        { key: "ticker", label: "ticker" },
        { key: "銘柄", label: "銘柄" },
        { key: "抽出項目", label: "抽出項目" },
        { key: "抽出値", label: "抽出値" },
        { key: "単位", label: "単位" },
        { key: "抽出状態", label: "抽出状態" },
        { key: "入力CSV反映", label: "入力CSV反映" },
        { key: "次確認", label: "次確認" },
        { key: "根拠スニペット", label: "根拠スニペット" },
      ])}
    </section>
  </main>
</body>
</html>`;

fs.writeFileSync(p(htmlFile), html, "utf8");

ensureLink("index.html", htmlFile, "P1 財務 PDF抽出テスト", "直接PDF候補から売上高、営業利益、EPS、ROEなどを抽出候補化する。");
ensureStepLink("latest_practical_start_20260614.html", htmlFile, "6-12f. P1 財務 PDF抽出テスト", "PDF候補の中身から財務数値候補を抽出し、入力可否を検査する。");
ensureCompactLink("daily_practical_compact_board_20260614.html", htmlFile, "P1 財務 PDF抽出テスト");

console.log(`built ${htmlFile}`);
console.log(`documents: ${docRows.length}, extracted metric candidates: ${extractedMetrics}, not calculated: ${notCalculated}`);
