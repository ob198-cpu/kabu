import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/15 11:45";
const htmlFile = "p1_segment_pdf_official_check_result_20260615.html";
const detailCsv = "p1_segment_pdf_official_check_result_20260615.csv";
const summaryCsv = "p1_segment_pdf_official_check_result_summary_20260615.csv";

const rows = [
  {
    ticker: "6503.T",
    銘柄: "三菱電機",
    確認項目: "実績EPS",
    PDF原文値: "198.31円",
    PDF確認: "確認済み",
    計算候補: "",
    計算式: "",
    反映可否: "財務値のみ確認済み",
    スコア反映: "禁止",
    P1復帰: "0社",
    買付上限: "0円",
    根拠: "三菱電機 2026年3月期 決算短信〔IFRS〕 一部訂正版 P1 L63-L78",
    参照URL: "https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co1.pdf",
    注意: "PER計算の分母として使えるが、株価基準日は別途確認が必要。",
  },
  {
    ticker: "6503.T",
    銘柄: "三菱電機",
    確認項目: "BPS",
    PDF原文値: "2,191.26円",
    PDF確認: "確認済み",
    計算候補: "",
    計算式: "",
    反映可否: "財務値のみ確認済み",
    スコア反映: "禁止",
    P1復帰: "0社",
    買付上限: "0円",
    根拠: "三菱電機 2026年3月期 決算短信〔IFRS〕 一部訂正版 P1 L80-L90",
    参照URL: "https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co1.pdf",
    注意: "PBR計算の分母として使えるが、株価基準日は別途確認が必要。",
  },
  {
    ticker: "6503.T",
    銘柄: "三菱電機",
    確認項目: "ROE",
    PDF原文値: "9.7%",
    PDF確認: "確認済み",
    計算候補: "",
    計算式: "",
    反映可否: "公式財務値として入力候補",
    スコア反映: "禁止",
    P1復帰: "0社",
    買付上限: "0円",
    根拠: "三菱電機 2026年3月期 決算短信〔IFRS〕 一部訂正版 P1 L69-L78",
    参照URL: "https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co1.pdf",
    注意: "Yahoo参照値9.67%は使わず、PDF原文値9.7%へ置換する候補。",
  },
  {
    ticker: "6503.T",
    銘柄: "三菱電機",
    確認項目: "営業利益率",
    PDF原文値: "7.3%",
    PDF確認: "確認済み",
    計算候補: "",
    計算式: "",
    反映可否: "公式財務値として入力候補",
    スコア反映: "禁止",
    P1復帰: "0社",
    買付上限: "0円",
    根拠: "三菱電機 2026年3月期 決算短信〔IFRS〕 一部訂正版 P1 L74-L78",
    参照URL: "https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co1.pdf",
    注意: "収益性の公式確認値。スコア反映は入力キュー転記後のバリデーション後。",
  },
  {
    ticker: "6503.T",
    銘柄: "三菱電機",
    確認項目: "PER候補",
    PDF原文値: "EPS 198.31円",
    PDF確認: "PDF側確認済み",
    計算候補: "27.96倍",
    計算式: "株価5,545円 ÷ EPS198.31円",
    反映可否: "株価基準日確認後に可",
    スコア反映: "禁止",
    P1復帰: "0社",
    買付上限: "0円",
    根拠: "EPSは公式PDF確認済み。株価5,545円は既存JSON基準。",
    参照URL: "https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co1.pdf",
    注意: "株価が公式PDF値ではないため、まだ公式確認済みPERにはしない。",
  },
  {
    ticker: "6503.T",
    銘柄: "三菱電機",
    確認項目: "PBR候補",
    PDF原文値: "BPS 2,191.26円",
    PDF確認: "PDF側確認済み",
    計算候補: "2.53倍",
    計算式: "株価5,545円 ÷ BPS2,191.26円",
    反映可否: "株価基準日確認後に可",
    スコア反映: "禁止",
    P1復帰: "0社",
    買付上限: "0円",
    根拠: "BPSは公式PDF確認済み。株価5,545円は既存JSON基準。",
    参照URL: "https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co1.pdf",
    注意: "株価が公式PDF値ではないため、まだ公式確認済みPBRにはしない。",
  },
  {
    ticker: "8035.T",
    銘柄: "東京エレクトロン",
    確認項目: "実績EPS",
    PDF原文値: "1,254.57円",
    PDF確認: "確認済み",
    計算候補: "",
    計算式: "",
    反映可否: "財務値のみ確認済み",
    スコア反映: "禁止",
    P1復帰: "0社",
    買付上限: "0円",
    根拠: "東京エレクトロン 2026年3月期 決算短信〔日本基準〕 P0 L19-L25",
    参照URL: "https://www.tel.co.jp/ir/library/report/jngpc500000000l6-att/fy26q4tanshin-j.pdf",
    注意: "PER計算の分母として使えるが、株価基準日は別途確認が必要。",
  },
  {
    ticker: "8035.T",
    銘柄: "東京エレクトロン",
    確認項目: "BPS",
    PDF原文値: "4,498.85円",
    PDF確認: "確認済み",
    計算候補: "",
    計算式: "",
    反映可否: "財務値のみ確認済み",
    スコア反映: "禁止",
    P1復帰: "0社",
    買付上限: "0円",
    根拠: "東京エレクトロン 2026年3月期 決算短信〔日本基準〕 P0 L27-L31",
    参照URL: "https://www.tel.co.jp/ir/library/report/jngpc500000000l6-att/fy26q4tanshin-j.pdf",
    注意: "PBR計算の分母として使えるが、株価基準日は別途確認が必要。",
  },
  {
    ticker: "8035.T",
    銘柄: "東京エレクトロン",
    確認項目: "ROE",
    PDF原文値: "29.6%",
    PDF確認: "確認済み",
    計算候補: "",
    計算式: "",
    反映可否: "公式財務値として入力候補",
    スコア反映: "禁止",
    P1復帰: "0社",
    買付上限: "0円",
    根拠: "東京エレクトロン 2026年3月期 決算短信〔日本基準〕 P0 L19-L25",
    参照URL: "https://www.tel.co.jp/ir/library/report/jngpc500000000l6-att/fy26q4tanshin-j.pdf",
    注意: "公式PDFで確認できたROE。入力キュー転記後にバリデーションする。",
  },
  {
    ticker: "8035.T",
    銘柄: "東京エレクトロン",
    確認項目: "営業利益率",
    PDF原文値: "25.6%",
    PDF確認: "確認済み",
    計算候補: "",
    計算式: "",
    反映可否: "公式財務値として入力候補",
    スコア反映: "禁止",
    P1復帰: "0社",
    買付上限: "0円",
    根拠: "東京エレクトロン 2026年3月期 決算短信〔日本基準〕 P0 L21-L25",
    参照URL: "https://www.tel.co.jp/ir/library/report/jngpc500000000l6-att/fy26q4tanshin-j.pdf",
    注意: "収益性の公式確認値。スコア反映は入力キュー転記後のバリデーション後。",
  },
  {
    ticker: "8035.T",
    銘柄: "東京エレクトロン",
    確認項目: "PER候補",
    PDF原文値: "EPS 1,254.57円",
    PDF確認: "PDF側確認済み",
    計算候補: "54.20倍",
    計算式: "株価68,000円 ÷ EPS1,254.57円",
    反映可否: "株価基準日確認後に可",
    スコア反映: "禁止",
    P1復帰: "0社",
    買付上限: "0円",
    根拠: "EPSは公式PDF確認済み。株価68,000円は既存JSON基準。",
    参照URL: "https://www.tel.co.jp/ir/library/report/jngpc500000000l6-att/fy26q4tanshin-j.pdf",
    注意: "株価が公式PDF値ではないため、まだ公式確認済みPERにはしない。",
  },
  {
    ticker: "8035.T",
    銘柄: "東京エレクトロン",
    確認項目: "PBR候補",
    PDF原文値: "BPS 4,498.85円",
    PDF確認: "PDF側確認済み",
    計算候補: "15.11倍",
    計算式: "株価68,000円 ÷ BPS4,498.85円",
    反映可否: "株価基準日確認後に可",
    スコア反映: "禁止",
    P1復帰: "0社",
    買付上限: "0円",
    根拠: "BPSは公式PDF確認済み。株価68,000円は既存JSON基準。",
    参照URL: "https://www.tel.co.jp/ir/library/report/jngpc500000000l6-att/fy26q4tanshin-j.pdf",
    注意: "株価が公式PDF値ではないため、まだ公式確認済みPBRにはしない。",
  },
];

const summaryRows = [
  { 項目: "PDF原文確認済み財務値", 件数: "8項目", 判定: "入力候補", 説明: "EPS、BPS、ROE、営業利益率を公式PDF原文で確認。" },
  { 項目: "PER/PBR計算候補", 件数: "4項目", 判定: "株価基準日確認待ち", 説明: "分母は公式PDF確認済み。株価は既存JSON基準のため、まだ公式確認済み扱いにしない。" },
  { 項目: "スコア反映", 件数: "0項目", 判定: "禁止", 説明: "入力キュー転記とバリデーション前のため、点数には混ぜない。" },
  { 項目: "P1復帰/買付", 件数: "0社 / 0円", 判定: "不可", 説明: "財務値だけでは購入判断に進めない。株価再計算、イベント後入力、説明条件確認が必要。" },
];

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

function writeCsv(file, data) {
  const headers = Object.keys(data[0] ?? { empty: "" });
  const body = [headers.join(","), ...data.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
  fs.writeFileSync(p(file), `\uFEFF${body}\n`, "utf8");
}

function statusClass(value) {
  const text = String(value ?? "");
  if (/禁止|不可|0円|0社|待ち/.test(text)) return "bad";
  if (/候補|確認済み|確認後|入力候補/.test(text)) return "warn";
  if (/完了|通過/.test(text)) return "ok";
  return "";
}

function table(data, columns) {
  return `<div class="table-wrap"><table><thead><tr>${columns.map((column) => `<th>${h(column.label)}</th>`).join("")}</tr></thead><tbody>${data.map((row) => `<tr>${columns.map((column) => {
    const value = row[column.key];
    const cls = statusClass(value);
    if (column.key === "参照URL" && value) return `<td class="${cls}"><a href="${h(value)}">参照</a></td>`;
    return `<td class="${cls}">${h(value)}</td>`;
  }).join("")}</tr>`).join("")}</tbody></table></div>`;
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
  <title>P1 事業寄与 PDF原文確認結果</title>
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
  <h1>P1 事業寄与 PDF原文確認結果</h1>
  <p>三菱電機と東京エレクトロンについて、公式決算短信PDFのEPS・BPS・ROE・営業利益率を確認した結果です。株価を使うPER/PBRは、株価基準日を再確認するまでスコアに反映しません。</p>
</header>
<main>
  <section>
    <h2>結論</h2>
    <p class="notice">公式PDFで財務値8項目を確認しました。ただし、PER/PBRは株価基準日の照合が残るため、スコア反映は禁止、P1復帰0社、買付上限0円を維持します。</p>
    <div class="cards">
      ${card("PDF原文確認", "8項目", "EPS/BPS/ROE/営業利益率", "warn")}
      ${card("PER/PBR候補", "4項目", "株価基準日確認待ち", "warn")}
      ${card("スコア反映", "0項目", "まだ混ぜない", "bad")}
      ${card("買付上限", "0円", "購入判断に使わない", "bad")}
    </div>
  </section>

  <section>
    <h2>関連ページ</h2>
    <div class="links">
      <a href="index.html">ホーム</a>
      <a href="latest_practical_start_20260614.html">実用パート入口</a>
      <a href="p1_segment_official_transfer_workbench_20260615.html">公式確認・転記作業台</a>
      <a href="p1_segment_next_gate_input_queue_20260615.html">入力キュー</a>
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
    <h2>PDF確認結果</h2>
    ${table(rows, [
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "確認項目", label: "確認項目" },
      { key: "PDF原文値", label: "PDF原文値" },
      { key: "PDF確認", label: "PDF確認" },
      { key: "計算候補", label: "計算候補" },
      { key: "計算式", label: "計算式" },
      { key: "反映可否", label: "反映可否" },
      { key: "スコア反映", label: "スコア反映" },
      { key: "P1復帰", label: "P1復帰" },
      { key: "買付上限", label: "買付上限" },
      { key: "根拠", label: "根拠" },
      { key: "参照URL", label: "参照URL" },
      { key: "注意", label: "注意" },
    ])}
  </section>

  <footer>generated: ${h(generatedAt)} / 本ページは公式PDFの原文確認結果であり、投資助言・自動売買・購入指示ではありません。</footer>
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
          <b>P1 事業寄与 PDF原文確認結果</b>
          <span>三菱電機・東京エレクトロンのEPS/BPS/ROE/営業利益率を公式PDFで確認。株価基準日は別途確認。</span>
        </a>`;
  const latestStep = `<a class="step" href="${htmlFile}">
        <b>6-12z. P1 事業寄与 PDF原文確認結果</b>
        <span>公式決算短信PDFで財務値を確認し、PER/PBR候補と株価基準日未確認を分ける。</span>
        <em>PDF確認</em>
      </a>`;
  const boardLink = `<a href="${htmlFile}">P1 事業寄与 PDF原文確認結果</a>`;

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

writeCsv(detailCsv, rows);
writeCsv(summaryCsv, summaryRows);
writeHtml();
updateNav();

console.log(JSON.stringify({
  htmlFile,
  detailCsv,
  summaryCsv,
  pdfConfirmedFinancialValues: 8,
  perPbrCandidates: 4,
  scoreReflected: 0,
  p1Return: 0,
  buyLimit: "0円",
}, null, 2));
