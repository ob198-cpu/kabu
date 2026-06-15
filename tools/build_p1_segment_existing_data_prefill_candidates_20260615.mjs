import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/15 06:25";
const inputQueueCsv = "p1_segment_next_gate_input_queue_20260615.csv";
const perPbrCsv = "p1_financial_per_pbr_basis_20260615.csv";
const longTermCsv = "784_integrated_recalculation_scores_20260528.csv";
const priceCsv = "150_trend_candidate_price_metrics.csv";
const yahooJpCsv = "154_trend_candidate_yahoojp_metrics.csv";
const htmlFile = "p1_segment_existing_data_prefill_candidates_20260615.html";
const detailCsv = "p1_segment_existing_data_prefill_candidates_20260615.csv";
const summaryCsv = "p1_segment_existing_data_prefill_summary_20260615.csv";

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

function readRows(file) {
  return parseRows(fs.readFileSync(p(file), "utf8"));
}

function writeCsv(file, rows) {
  const headers = Object.keys(rows[0] ?? { empty: "" });
  const body = [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
  fs.writeFileSync(p(file), `\uFEFF${body}\n`, "utf8");
}

function toNumber(value) {
  const n = Number(String(value ?? "").replace(/,/g, "").replace(/%/g, "").replace(/倍/g, "").replace(/円/g, ""));
  return Number.isFinite(n) ? n : null;
}

function fmtPct(value) {
  const n = toNumber(value);
  return n === null ? "" : `${n}%`;
}

function fmtYen(value) {
  const n = toNumber(value);
  return n === null ? "" : `${n.toLocaleString("ja-JP")}円`;
}

function indexBy(rows, key) {
  const map = new Map();
  for (const row of rows) map.set(row[key], row);
  return map;
}

function addCandidate(map, key, value, source, point, note, url = "") {
  if (value === undefined || value === null || String(value).trim() === "") return;
  map.set(key, { value, source, point, note, url });
}

function idPrefix(ticker) {
  return String(ticker ?? "").replace(/\.T$/, "");
}

function buildPerPbrCandidates(rows) {
  const result = new Map();
  for (const row of rows) {
    const ticker = row.ticker;
    if (!["6503.T", "8035.T"].includes(ticker)) continue;
    const code = idPrefix(ticker);
    const metric = row["計算項目"];
    const value = row["計算候補値"];
    const source = row["参照資料"] || perPbrCsv;
    const url = row["参照URL"] || "";
    const note = `${row["注意"] || "既存PDF抽出値と株価基準日の候補。"} スコアには反映しない。`;
    if (metric === "実績PER") addCandidate(result, `${code}_per_official`, value, source, row["計算式"], note, url);
    if (metric === "PBR") addCandidate(result, `${code}_pbr_official`, value, source, row["計算式"], note, url);
    if (metric === "予想PER" && value !== "参考外") {
      addCandidate(result, `${code}_per_forecast_reference`, value, source, row["計算式"], note, url);
    }
  }
  return result;
}

function buildLongTermCandidates(rows) {
  const result = new Map();
  for (const values of rows.slice(1)) {
    const ticker = values[2];
    if (!["6503.T", "8035.T"].includes(ticker)) continue;
    const code = idPrefix(ticker);
    const note = "100社再計算ファイルから拾った既存値。公式確認済み扱いにはせず、入力候補としてだけ使う。";
    addCandidate(result, `${code}_cagr_5y`, fmtPct(values[12]), longTermCsv, "5年CAGR", note);
    addCandidate(result, `${code}_cagr_10y`, fmtPct(values[13]), longTermCsv, "10年CAGR", note);
    addCandidate(result, `${code}_return_1y`, fmtPct(values[14]), longTermCsv, "直近1年騰落率", note);
    addCandidate(result, `${code}_return_60d`, fmtPct(values[15]), longTermCsv, "60日騰落率", note);
    addCandidate(result, `${code}_sp500_gap_1y`, fmtPct(values[17]), longTermCsv, "直近1年S&P500との差", note);
    addCandidate(result, `${code}_max_drawdown_1y`, fmtPct(values[19]), longTermCsv, "直近1年最大下落率", note);
  }
  return result;
}

function buildShortPriceCandidates(priceRows, yahooRows) {
  const result = new Map();
  const priceByTicker = indexBy(priceRows, "ticker");
  for (const ticker of ["6503.T", "8035.T"]) {
    const row = priceByTicker.get(ticker);
    if (!row) continue;
    const code = idPrefix(ticker);
    const note = "Yahoo Finance chart APIの既存取得値。基準日と計算範囲を再確認するまでスコアには反映しない。";
    addCandidate(result, `${code}_price_date`, row.latest_date, priceCsv, "latest_date", note);
    addCandidate(result, `${code}_current_price`, fmtYen(row.close), priceCsv, "close", note);
    addCandidate(result, `${code}_return_60d`, fmtPct(row.ret60_pct), priceCsv, "ret60_pct", note);
    addCandidate(result, `${code}_return_1y`, fmtPct(row.ret1y_pct), priceCsv, "ret1y_pct", note);
    if (row.max_drawdown20_pct) {
      addCandidate(
        result,
        `${code}_max_drawdown_1y`,
        fmtPct(row.max_drawdown20_pct),
        priceCsv,
        "max_drawdown20_pct",
        "20日最大下落率であり、1年最大下落率ではない。参考値としてのみ表示し、正式入力には転記しない。",
      );
    }
  }

  const yahooByTicker = indexBy(yahooRows, "ticker");
  for (const ticker of ["6503.T", "8035.T"]) {
    const row = yahooByTicker.get(ticker);
    if (!row) continue;
    const code = idPrefix(ticker);
    const note = "Yahoo!ファイナンス日本版の既存参照値。公式IR確認前は参考値としてだけ扱う。";
    addCandidate(result, `${code}_roe_official`, row.roe_actual_pct ? `${row.roe_actual_pct}%` : "", yahooJpCsv, "roe_actual_pct", note, row.source_url);
    if (!result.has(`${code}_per_official`)) addCandidate(result, `${code}_per_official`, row.per_forecast ? `${row.per_forecast}倍` : "", yahooJpCsv, "per_forecast", note, row.source_url);
    if (!result.has(`${code}_pbr_official`)) addCandidate(result, `${code}_pbr_official`, row.pbr_actual ? `${row.pbr_actual}倍` : "", yahooJpCsv, "pbr_actual", note, row.source_url);
  }
  return result;
}

function buildManualExplanationCandidates() {
  const result = new Map();
  addCandidate(result, "6503_one_line_reason", "電力制御・FA・データセンター周辺需要を確認対象にする。ただし全社利益への寄与を公式資料で確認するまでP1復帰しない。", "入力キューから作成した説明候補", "説明候補", "テーマ名だけで残さないための仮文章。公式数値と接続してから採用する。");
  addCandidate(result, "6503_keep_condition", "PER/PBR/ROE、営業利益率、事業別成長、6月イベント後の指数比反応がそろい、過熱・急落条件に抵触しない場合のみ残す。", "入力キューから作成した説明候補", "条件候補", "最終判断ではなく、未確認項目を埋めるための文章候補。");
  addCandidate(result, "6503_drop_condition", "6月イベント後に指数比で弱い、FA・電力関連の全社寄与が確認できない、または高値圏からの急落リスクが強い場合は落とす。", "入力キューから作成した説明候補", "条件候補", "最終判断ではなく、未確認項目を埋めるための文章候補。");
  addCandidate(result, "6503_unconfirmed_items", "公式PER/PBR/ROE、営業利益率、事業別成長、イベント後反応、銘柄別上値・下値ルール。", "入力キューから作成した説明候補", "未確認事項", "人間が確認すべき未完了項目。");
  addCandidate(result, "8035_one_line_reason", "WFE見通し、製品シェア、AIサーバー需要との接続を確認対象にする。ただし高PERと半導体投資サイクルの下落リスクを同時に見る。", "入力キューから作成した説明候補", "説明候補", "テーマ名だけで残さないための仮文章。公式数値と接続してから採用する。");
  addCandidate(result, "8035_keep_condition", "WFE見通し、利益率、PER/PBR、イベント後のSOX・日経平均比反応がそろい、高PERを説明できる場合のみ残す。", "入力キューから作成した説明候補", "条件候補", "最終判断ではなく、未確認項目を埋めるための文章候補。");
  addCandidate(result, "8035_drop_condition", "FOMC後の金利上昇、SOX反落、会社見通し悪化、高PERを支える利益成長不足が確認された場合は落とす。", "入力キューから作成した説明候補", "条件候補", "最終判断ではなく、未確認項目を埋めるための文章候補。");
  addCandidate(result, "8035_unconfirmed_items", "公式PER/PBR/ROE、営業利益率、WFE見通し、イベント後反応、半導体サイクル悪化時の停止条件。", "入力キューから作成した説明候補", "未確認事項", "人間が確認すべき未完了項目。");
  return result;
}

function mergeMaps(...maps) {
  const result = new Map();
  for (const map of maps) {
    for (const [key, value] of map.entries()) result.set(key, value);
  }
  return result;
}

function buildRows(queueRows, candidates) {
  return queueRows.map((row) => {
    const c = candidates.get(row["入力ID"]);
    const has = c && String(c.value ?? "").trim() !== "";
    return {
      ticker: row.ticker,
      銘柄: row["銘柄"],
      ゲート: row["ゲート"],
      入力ID: row["入力ID"],
      入力項目: row["入力項目"],
      候補値: has ? c.value : "",
      候補値あり: has ? "あり" : "なし",
      取得元: has ? c.source : "",
      参照URL: has ? c.url ?? "" : "",
      参照項目または計算式: has ? c.point ?? "" : "",
      公式確認: "未",
      スコア反映: "禁止",
      P1復帰: "0社",
      買付上限: "0円",
      注意: has ? c.note : "既存データから候補値を取得できていない。手動確認または再取得が必要。",
    };
  });
}

function buildSummary(rows) {
  const withValue = rows.filter((row) => row["候補値あり"] === "あり").length;
  const noValue = rows.length - withValue;
  const byGate = [...new Set(rows.map((row) => row["ゲート"]))].map((gate) => {
    const gateRows = rows.filter((row) => row["ゲート"] === gate);
    const found = gateRows.filter((row) => row["候補値あり"] === "あり").length;
    return {
      項目: gate,
      値: `${found}/${gateRows.length}項目`,
      判定: found === gateRows.length ? "候補値あり" : found > 0 ? "一部候補あり" : "未補完",
      説明: "候補値は公式確認前の下書きであり、スコア・P1復帰・買付上限には反映しない。",
    };
  });
  return [
    {
      項目: "既存データ候補値",
      値: `${withValue}/${rows.length}項目`,
      判定: withValue > 0 ? "候補あり" : "候補なし",
      説明: "既存CSVから候補値を拾えた数。公式確認済みではない。",
    },
    {
      項目: "未補完",
      値: `${noValue}/${rows.length}項目`,
      判定: noValue > 0 ? "残あり" : "なし",
      説明: "候補値がない項目は、公式IR確認、株価再計算、イベント後入力が必要。",
    },
    {
      項目: "公式確認",
      値: "0項目",
      判定: "未",
      説明: "このページは既存データ照合であり、人間の公式確認後に入力キューへ転記する。",
    },
    {
      項目: "P1復帰/買付",
      値: "0社 / 0円",
      判定: "不可",
      説明: "候補値は購入判断に使わない。",
    },
    ...byGate,
  ];
}

function statusClass(value) {
  const text = String(value ?? "");
  if (/0円|0社|不可|禁止|未|なし|未補完|残あり/.test(text)) return "bad";
  if (/候補|一部/.test(text)) return "warn";
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

function writeHtml(rows, summaryRows) {
  const withValue = rows.filter((row) => row["候補値あり"] === "あり").length;
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>P1 事業寄与 既存データ補完候補</title>
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
    a{color:#064f86;font-weight:900}
    footer{font-size:13px;color:#526b82;margin:20px 0}
    @media(max-width:900px){main{padding:12px}.cards{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:11px;padding:5px 6px}}
  </style>
</head>
<body>
<header>
  <h1>P1 事業寄与 既存データ補完候補</h1>
  <p>次ゲート入力キューに対して、既存CSVから拾えるPER/PBR・株価・CAGRなどの候補値を並べた確認ページです。候補値は公式確認前の下書きであり、スコア・P1復帰・買付上限には反映しません。</p>
</header>
<main>
  <section>
    <h2>結論</h2>
    <p class="notice">既存データから ${h(withValue)}/${h(rows.length)} 項目の候補値を拾いました。ただし、公式確認は0項目、スコア反映は禁止、P1復帰0社、買付上限0円を維持します。</p>
    <div class="cards">
      ${card("候補値あり", `${withValue}項目`, "既存CSVから取得", "warn")}
      ${card("公式確認", "0項目", "人間確認前", "bad")}
      ${card("P1復帰", "0社", "まだ戻さない", "bad")}
      ${card("買付上限", "0円", "購入判断に使わない", "bad")}
    </div>
  </section>

  <section>
    <h2>関連ページ</h2>
    <div class="links">
      <a href="index.html">ホーム</a>
      <a href="latest_practical_start_20260614.html">実用パート入口</a>
      <a href="p1_segment_next_gate_work_order_20260615.html">次ゲート作業票</a>
      <a href="p1_segment_next_gate_input_validator_20260615.html">入力バリデーター</a>
      <a href="p1_segment_next_gate_input_queue_20260615.html">入力キュー</a>
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
    <h2>補完候補一覧</h2>
    ${table(rows, [
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "ゲート", label: "ゲート" },
      { key: "入力ID", label: "入力ID" },
      { key: "入力項目", label: "入力項目" },
      { key: "候補値", label: "候補値" },
      { key: "候補値あり", label: "候補値あり" },
      { key: "取得元", label: "取得元" },
      { key: "参照URL", label: "参照URL" },
      { key: "参照項目または計算式", label: "参照項目/計算式" },
      { key: "公式確認", label: "公式確認" },
      { key: "スコア反映", label: "スコア反映" },
      { key: "P1復帰", label: "P1復帰" },
      { key: "買付上限", label: "買付上限" },
      { key: "注意", label: "注意" },
    ])}
  </section>

  <footer>generated: ${h(generatedAt)} / source: ${h(inputQueueCsv)} / 本ページは既存データ照合用であり、投資助言・自動売買・購入指示ではありません。</footer>
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
          <b>P1 事業寄与 既存データ補完候補</b>
          <span>既存CSVから拾えるPER/PBR・株価・CAGR等の候補値を一覧化。公式確認前はスコア反映禁止で止める。</span>
        </a>`;
  const latestStep = `<a class="step" href="${htmlFile}">
        <b>6-12x. P1 事業寄与 既存データ補完候補</b>
        <span>次ゲート入力キューに対し、既存CSVから拾える候補値を照合する。公式確認前は反映しない。</span>
        <em>候補値照合</em>
      </a>`;
  const boardLink = `<a href="${htmlFile}">P1 事業寄与 既存データ補完候補</a>`;

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
const candidates = mergeMaps(
  buildLongTermCandidates(readRows(longTermCsv)),
  buildShortPriceCandidates(readCsv(priceCsv), readCsv(yahooJpCsv)),
  buildPerPbrCandidates(readCsv(perPbrCsv)),
  buildManualExplanationCandidates(),
);
const rows = buildRows(queueRows, candidates);
const summaryRows = buildSummary(rows);

writeCsv(detailCsv, rows);
writeCsv(summaryCsv, summaryRows);
writeHtml(rows, summaryRows);
updateNav();

console.log(JSON.stringify({
  htmlFile,
  detailCsv,
  summaryCsv,
  rows: rows.length,
  candidates: rows.filter((row) => row["候補値あり"] === "あり").length,
  officialConfirmed: 0,
  p1Return: 0,
  buyLimit: "0円",
}, null, 2));
