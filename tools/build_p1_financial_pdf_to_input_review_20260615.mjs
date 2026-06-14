import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/15 00:35";

const metricCsv = "p1_financial_pdf_metric_candidates_20260614.csv";
const inputCsv = "p1_financial_input_form_20260614.csv";
const reviewCsv = "p1_financial_pdf_to_input_review_20260615.csv";
const summaryCsv = "p1_financial_pdf_to_input_summary_20260615.csv";
const htmlFile = "p1_financial_pdf_to_input_review_20260615.html";

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

function normalize(value) {
  return String(value ?? "").replace(/,/g, "").trim();
}

function metricMap(rows) {
  const map = new Map();
  for (const row of rows) {
    map.set(`${row.ticker}::${row.抽出項目}`, row);
  }
  return map;
}

function getMetric(map, ticker, item) {
  return map.get(`${ticker}::${item}`);
}

function metricValue(map, ticker, item, fallback = "") {
  const row = getMetric(map, ticker, item);
  return normalize(row?.抽出値) || fallback;
}

const documents = {
  "6503.T": {
    name: "三菱電機",
    totalFields: 9,
    sourceName: "2026年3月期 決算短信〔IFRS〕一部訂正版",
    sourceUrl: "https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co1.pdf",
    sourceDate: "2026/06/11（訂正開示日。原開示2026/04/28）",
    forecastText: "売上高 +5.2%、営業利益 +17.7%、税引前当期純利益 +21.7%、親会社株主帰属当期純利益 +16.5%、予想EPS 231.01円",
  },
  "8035.T": {
    name: "東京エレクトロン",
    totalFields: 10,
    sourceName: "2026年3月期 決算短信〔日本基準〕",
    sourceUrl: "https://www.tel.co.jp/ir/library/report/jngpc500000000l6-att/fy26q4tanshin-j.pdf",
    sourceDate: "2026/04/30",
    forecastText: "第2四半期累計予想: 売上高 +33.1%、営業利益 +42.2%、経常利益 +42.4%、親会社株主帰属四半期純利益 +35.7%、予想EPS 721.12円（通期予想ではない）",
  },
};

function makeRow({ ticker, item, candidate, unit = "", action, reason, nextAction, sourceKind = "PDF抽出候補" }) {
  const doc = documents[ticker];
  return {
    ticker,
    銘柄: doc.name,
    入力項目: item,
    PDF抽出候補値: candidate,
    単位: unit,
    転記レビュー: action,
    公式確認扱い: "公式確認済みにしない",
    反映可否: "反映しない",
    出所区分: sourceKind,
    参照資料: doc.sourceName,
    参照URL: doc.sourceUrl,
    資料日付: doc.sourceDate,
    未反映理由: reason,
    次作業: nextAction,
  };
}

function buildReviewRows(metrics) {
  const map = metricMap(metrics);
  return [
    makeRow({
      ticker: "6503.T",
      item: "PER",
      candidate: "未計算",
      unit: "倍",
      action: "反映不可",
      reason: "PDFだけでは計算不可。株価基準日とEPS基準を指定する必要がある。",
      nextAction: "株価基準日を決め、EPS基準を実績か会社予想かに分けて計算する。",
    }),
    makeRow({
      ticker: "6503.T",
      item: "PBR",
      candidate: "未計算",
      unit: "倍",
      action: "反映不可",
      reason: "PDFだけでは計算不可。株価基準日とBPS基準を指定する必要がある。",
      nextAction: "株価基準日を決め、BPS 2191.26円を使うかを目視確認する。",
    }),
    makeRow({
      ticker: "6503.T",
      item: "ROE_pct",
      candidate: metricValue(map, "6503.T", "ROE"),
      unit: "%",
      action: "転記候補",
      reason: "PDF抽出候補。入力には目視確認と資料欄の記録が必要。",
      nextAction: "決算短信の該当表を目視確認し、正しければ入力状態を公式確認済みに変更する。",
    }),
    makeRow({
      ticker: "6503.T",
      item: "営業利益率_pct",
      candidate: metricValue(map, "6503.T", "営業利益率"),
      unit: "%",
      action: "転記候補",
      reason: "PDF抽出候補。入力には目視確認と資料欄の記録が必要。",
      nextAction: "決算短信の連結経営成績欄で営業利益率を確認する。",
    }),
    makeRow({
      ticker: "6503.T",
      item: "今期会社予想_前期比",
      candidate: documents["6503.T"].forecastText,
      action: "転記候補",
      reason: "PDFの通期予想欄から整理した候補。文章として入力する前に表の年度を確認する。",
      nextAction: "通期予想の対象期間と前期比を確認し、入力欄へ要約する。",
    }),
    makeRow({
      ticker: "6503.T",
      item: "参照URLまたは資料名",
      candidate: `${documents["6503.T"].sourceName} / ${documents["6503.T"].sourceUrl}`,
      action: "転記候補",
      reason: "公式PDF候補のURL。資料自体は取得済みだが、値の目視照合前。",
      nextAction: "入力フォームの出所欄に転記し、該当値を確認する。",
      sourceKind: "公式PDF候補",
    }),
    makeRow({
      ticker: "6503.T",
      item: "資料日付",
      candidate: documents["6503.T"].sourceDate,
      action: "転記候補",
      reason: "資料日付候補。訂正開示日と原開示日を区別して記録する。",
      nextAction: "資料表紙または会社IRページで日付を確認する。",
      sourceKind: "公式PDF候補",
    }),
    makeRow({
      ticker: "6503.T",
      item: "入力状態",
      candidate: "候補値・要目視確認",
      action: "確認状態指定",
      reason: "公式確認済みではないため、検算上は未完了に残す。",
      nextAction: "目視確認が終わるまでは公式確認済みに変更しない。",
      sourceKind: "運用状態",
    }),
    makeRow({
      ticker: "6503.T",
      item: "受注またはセグメント寄与",
      candidate: "未抽出",
      action: "反映不可",
      reason: "決算短信の自動抽出だけでは、候補選定に必要なセグメント寄与の説明が不足。",
      nextAction: "決算説明資料またはセグメント情報ページから、成長事業・利益寄与を別途確認する。",
    }),

    makeRow({
      ticker: "8035.T",
      item: "PER",
      candidate: "未計算",
      unit: "倍",
      action: "反映不可",
      reason: "PDFだけでは計算不可。株価基準日とEPS基準を指定する必要がある。",
      nextAction: "株価基準日を決め、実績EPSまたは予想EPSを分けて計算する。",
    }),
    makeRow({
      ticker: "8035.T",
      item: "PBR",
      candidate: "未計算",
      unit: "倍",
      action: "反映不可",
      reason: "PDFだけでは計算不可。株価基準日とBPS基準を指定する必要がある。",
      nextAction: "株価基準日を決め、BPS 4498.85円を使うかを目視確認する。",
    }),
    makeRow({
      ticker: "8035.T",
      item: "ROE_pct",
      candidate: metricValue(map, "8035.T", "ROE"),
      unit: "%",
      action: "転記候補",
      reason: "PDF抽出候補。入力には目視確認と資料欄の記録が必要。",
      nextAction: "決算短信の該当表を目視確認し、正しければ入力状態を公式確認済みに変更する。",
    }),
    makeRow({
      ticker: "8035.T",
      item: "営業利益率_pct",
      candidate: metricValue(map, "8035.T", "営業利益率"),
      unit: "%",
      action: "転記候補",
      reason: "PDF抽出候補。入力には目視確認と資料欄の記録が必要。",
      nextAction: "決算短信の連結経営成績欄で営業利益率を確認する。",
    }),
    makeRow({
      ticker: "8035.T",
      item: "今期会社予想_前期比",
      candidate: documents["8035.T"].forecastText,
      action: "転記候補",
      reason: "第2四半期累計予想であり、通期予想ではない。誤って通期扱いにしない。",
      nextAction: "入力時は第2四半期累計予想と明記し、通期予想は追加開示待ちにする。",
    }),
    makeRow({
      ticker: "8035.T",
      item: "参照URLまたは資料名",
      candidate: `${documents["8035.T"].sourceName} / ${documents["8035.T"].sourceUrl}`,
      action: "転記候補",
      reason: "公式PDF候補のURL。資料自体は取得済みだが、値の目視照合前。",
      nextAction: "入力フォームの出所欄に転記し、該当値を確認する。",
      sourceKind: "公式PDF候補",
    }),
    makeRow({
      ticker: "8035.T",
      item: "資料日付",
      candidate: documents["8035.T"].sourceDate,
      action: "転記候補",
      reason: "資料日付候補。入力前にPDF表紙の日付と一致するか確認する。",
      nextAction: "資料表紙または会社IRページで日付を確認する。",
      sourceKind: "公式PDF候補",
    }),
    makeRow({
      ticker: "8035.T",
      item: "入力状態",
      candidate: "候補値・要目視確認",
      action: "確認状態指定",
      reason: "公式確認済みではないため、検算上は未完了に残す。",
      nextAction: "目視確認が終わるまでは公式確認済みに変更しない。",
      sourceKind: "運用状態",
    }),
    makeRow({
      ticker: "8035.T",
      item: "受注またはセグメント寄与",
      candidate: "未抽出",
      action: "反映不可",
      reason: "決算短信の自動抽出だけでは、候補選定に必要な受注・セグメント寄与の説明が不足。",
      nextAction: "決算説明資料で半導体製造装置需要、地域別・装置別の寄与を確認する。",
    }),
    makeRow({
      ticker: "8035.T",
      item: "高PER説明",
      candidate: "未抽出",
      action: "反映不可",
      reason: "PERが高い場合に説明できる受注・利益率・市場見通しの根拠が未整理。",
      nextAction: "PER計算後に、利益成長・受注・粗利率・市場サイクルで説明可能か確認する。",
    }),
  ];
}

function countBy(rows, predicate) {
  return rows.filter(predicate).length;
}

function buildTickerSummary(reviewRows) {
  return Object.entries(documents).map(([ticker, doc]) => {
    const rows = reviewRows.filter((row) => row.ticker === ticker);
    const candidateCount = countBy(rows, (row) => row.転記レビュー === "転記候補");
    const blockedCount = countBy(rows, (row) => row.転記レビュー === "反映不可");
    return {
      ticker,
      銘柄: doc.name,
      入力対象項目数: doc.totalFields,
      PDF転記候補: candidateCount,
      反映不可または追加確認: blockedCount,
      公式確認済み: 0,
      入力完了判定: `0/${doc.totalFields}`,
      P1復帰判定: "不可",
      買付反映: "0円",
      主な未解決: ticker === "6503.T"
        ? "PER/PBRの株価基準日、セグメント寄与の確認"
        : "PER/PBRの株価基準日、通期予想、受注・高PER説明の確認",
    };
  });
}

function buildSummaryRows(reviewRows, tickerSummary, inputRows) {
  return [
    { 項目: "PDF抽出資料", 値: "2資料", 判定: "抽出候補あり", メモ: "6503 三菱電機、8035 東京エレクトロン" },
    { 項目: "PDF抽出候補値", 値: "20項目", 判定: "候補値", メモ: "抽出CSVから確認。入力CSVへは未反映。" },
    { 項目: "入力レビュー行", 値: `${reviewRows.length}行`, 判定: "作成済み", メモ: "候補値、未反映理由、次作業を分離。" },
    { 項目: "転記候補項目", 値: `${countBy(reviewRows, (row) => row.転記レビュー === "転記候補")}項目`, 判定: "要目視確認", メモ: "公式確認済みにしない。" },
    { 項目: "公式確認済み項目", 値: "0項目", 判定: "未完了", メモ: "入力値、出所、資料日付、公式確認済みの4条件が未充足。" },
    { 項目: "入力フォーム全体", 値: `${inputRows.length}項目`, 判定: "未完了", メモ: "現行バリデーターでは完了銘柄0。" },
    { 項目: "P1復帰可能銘柄", 値: "0社", 判定: "不可", メモ: "PDF候補値だけでは復帰不可。" },
    { 項目: "買付上限", 値: "0円", 判定: "維持", メモ: "公式確認・イベント・口座確認がそろうまで0円。" },
  ];
}

function statusClass(value) {
  const text = String(value ?? "");
  if (/不可|0円|未完了|反映しない|公式確認済みにしない/.test(text)) return "bad";
  if (/候補|要|未抽出|未計算|追加確認|確認状態/.test(text)) return "warn";
  if (/作成済み|取得済み|完了/.test(text)) return "ok";
  return "";
}

function table(rows, columns) {
  return `<div class="table-wrap"><table><thead><tr>${columns.map((column) => `<th>${h(column.label)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((column) => {
    const value = row[column.key];
    const cls = statusClass(value);
    if (column.link && value) {
      return `<td class="${cls}"><a href="${h(value)}" target="_blank" rel="noopener">${h(value)}</a></td>`;
    }
    return `<td class="${cls}">${h(value)}</td>`;
  }).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function card(title, value, note, className = "") {
  return `<div class="card ${className}"><b>${h(title)}</b><strong>${h(value)}</strong><span>${h(note)}</span></div>`;
}

function writeHtml(reviewRows, tickerSummary, summaryRows) {
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>P1 財務 PDF→入力レビュー</title>
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
  <h1>P1 財務 PDF→入力レビュー</h1>
  <p>PDF抽出候補を入力CSVへ転記する前に、候補値、未反映理由、次作業を分けて確認する画面です。</p>
</header>
<main>
  <section>
    <h2>結論</h2>
    <p class="notice">PDFから数値候補は取れていますが、公式確認済みにはしていません。現時点ではP1復帰可能銘柄0社、買付上限0円です。</p>
    <div class="cards">
      ${card("入力レビュー行", `${reviewRows.length}行`, "候補値と未反映理由を分離", "ok")}
      ${card("転記候補", `${countBy(reviewRows, (row) => row.転記レビュー === "転記候補")}項目`, "6503/8035の一部項目", "warn")}
      ${card("公式確認済み", "0項目", "目視確認前のため未完了", "bad")}
      ${card("買付上限", "0円", "入力だけでは購入判断に進めない", "bad")}
    </div>
  </section>

  <section>
    <h2>確認導線</h2>
    <div class="links">
      <a href="index.html">ホーム</a>
      <a href="latest_practical_start_20260614.html">最新 実用パート入口</a>
      <a href="daily_practical_compact_board_20260614.html">実用日次ボード</a>
      <a href="p1_financial_pdf_extraction_trial_20260614.html">PDF抽出テスト</a>
      <a href="p1_financial_input_validator_20260614.html">入力バリデーター</a>
    </div>
  </section>

  <section>
    <h2>全体サマリー</h2>
    ${table(summaryRows, [
      { key: "項目", label: "項目" },
      { key: "値", label: "値" },
      { key: "判定", label: "判定" },
      { key: "メモ", label: "メモ" },
    ])}
  </section>

  <section>
    <h2>銘柄別の状態</h2>
    ${table(tickerSummary, [
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "入力対象項目数", label: "入力対象項目数" },
      { key: "PDF転記候補", label: "PDF転記候補" },
      { key: "反映不可または追加確認", label: "反映不可/追加確認" },
      { key: "公式確認済み", label: "公式確認済み" },
      { key: "入力完了判定", label: "入力完了判定" },
      { key: "P1復帰判定", label: "P1復帰判定" },
      { key: "買付反映", label: "買付反映" },
      { key: "主な未解決", label: "主な未解決" },
    ])}
  </section>

  <section>
    <h2>反映候補項目と止める理由</h2>
    ${table(reviewRows, [
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "入力項目", label: "入力項目" },
      { key: "PDF抽出候補値", label: "PDF抽出候補値" },
      { key: "単位", label: "単位" },
      { key: "転記レビュー", label: "転記レビュー" },
      { key: "公式確認扱い", label: "公式確認扱い" },
      { key: "反映可否", label: "反映可否" },
      { key: "未反映理由", label: "未反映理由" },
      { key: "次作業", label: "次作業" },
      { key: "参照資料", label: "参照資料" },
      { key: "参照URL", label: "参照URL", link: true },
      { key: "資料日付", label: "資料日付" },
    ])}
  </section>

  <section>
    <h2>このレビューで守ること</h2>
    <ul>
      <li>PDFから取れた値は、目視確認が終わるまで公式確認済みにしない。</li>
      <li>PER/PBRは、株価基準日が決まるまで未計算のままにする。</li>
      <li>第2四半期累計予想を通期予想として扱わない。</li>
      <li>セグメント寄与、受注、高PER説明が不足する銘柄は、購入判断に進めない。</li>
      <li>入力CSV、再判定、注文票への反映は、公式確認済みになってから行う。</li>
    </ul>
  </section>

  <footer>generated: ${h(generatedAt)} / source: ${h(metricCsv)}, ${h(inputCsv)}</footer>
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
  insertOnce("index.html", "p1_financial_pdf_extraction_trial_20260614.html", `<a class="card" href="${htmlFile}">
          <b>P1 財務 PDF→入力レビュー</b>
          <span>PDF抽出候補を入力CSVへ転記する前に、候補値、未確認理由、反映不可項目を確認する。</span>
        </a>`);

  insertOnce("latest_practical_start_20260614.html", "p1_financial_pdf_extraction_trial_20260614.html", `<a class="step" href="${htmlFile}">
        <b>6-12g. P1 財務 PDF→入力レビュー</b>
        <span>PDF抽出候補を入力CSVへ反映する前に、公式確認済みにしてよいかを止めて確認する。</span>
        <em>入力前レビュー</em>
      </a>`);

  insertOnce("daily_practical_compact_board_20260614.html", "p1_financial_pdf_extraction_trial_20260614.html", `<a href="${htmlFile}">P1 財務 PDF→入力レビュー</a>`);
}

function main() {
  const metrics = readCsv(metricCsv);
  const inputRows = readCsv(inputCsv);
  const reviewRows = buildReviewRows(metrics);
  const tickerSummary = buildTickerSummary(reviewRows);
  const summaryRows = buildSummaryRows(reviewRows, tickerSummary, inputRows);

  writeCsv(reviewCsv, reviewRows);
  writeCsv(summaryCsv, summaryRows);
  writeHtml(reviewRows, tickerSummary, summaryRows);
  updateNavigation();

  console.log(JSON.stringify({
    htmlFile,
    reviewCsv,
    summaryCsv,
    reviewRows: reviewRows.length,
    inputRows: inputRows.length,
    officialConfirmed: 0,
    buyLimit: "0円",
  }, null, 2));
}

main();
