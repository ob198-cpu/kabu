import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/15 11:28";
const sourceCsv = "p1_segment_existing_data_prefill_candidates_20260615.csv";
const htmlFile = "p1_segment_official_transfer_workbench_20260615.html";
const detailCsv = "p1_segment_official_transfer_workbench_20260615.csv";
const summaryCsv = "p1_segment_official_transfer_workbench_summary_20260615.csv";

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
    if (char === '"') quote = true;
    else if (char === ",") {
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

function writeCsv(file, rows) {
  const headers = Object.keys(rows[0] ?? { empty: "" });
  const body = [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
  fs.writeFileSync(p(file), `\uFEFF${body}\n`, "utf8");
}

function classify(row) {
  const hasValue = row["候補値あり"] === "あり";
  const inputId = row["入力ID"];
  const gate = row["ゲート"];
  const source = row["取得元"];
  const note = row["注意"];

  if (!hasValue) {
    return {
      status: "未補完",
      action: "取得作業",
      canTransfer: "不可",
      check: "候補値がないため、公式IR、株価再取得、またはイベント後入力を行う。",
      risk: "空欄のまま転記しない。",
    };
  }
  if (/max_drawdown_1y/.test(inputId) && /20日最大下落率/.test(note)) {
    return {
      status: "転記禁止",
      action: "1年最大下落率を再計算",
      canTransfer: "不可",
      check: "候補値は20日最大下落率で、入力項目の1年最大下落率と期間が違う。",
      risk: "このまま使うと下落リスクを過小評価する。",
    };
  }
  if (/Yahoo!ファイナンス/.test(note)) {
    return {
      status: "参考のみ",
      action: "公式IRで置換",
      canTransfer: "保留",
      check: "Yahoo参照値は比較用。ROE等は決算短信、有報、会社資料で確認してから入力する。",
      risk: "出所が公式IRではないため、そのまま公式確認済みにしない。",
    };
  }
  if (/100社再計算ファイル/.test(note)) {
    return {
      status: "再計算待ち",
      action: "株価時系列から再現",
      canTransfer: "保留",
      check: "既存計算値は候補として採用。基準日、指数、計算式を再現できたら転記する。",
      risk: "列ズレ・基準日ズレがあると説明不能になる。",
    };
  }
  if (/決算短信|PDF|株価が既存JSON基準/.test(note) || /決算短信/.test(source)) {
    return {
      status: "公式確認候補",
      action: "PDF目視確認",
      canTransfer: "確認後可",
      check: "PDF原文のEPS/BPSと株価基準日、計算式を照合する。合えば入力キューへ転記する。",
      risk: "株価基準日と分母が合わない場合は転記しない。",
    };
  }
  if (gate === "説明可能性ゲート") {
    return {
      status: "文章候補",
      action: "数値接続後に採用",
      canTransfer: "保留",
      check: "財務・価格・イベント後反応の数値が埋まったあと、説明文として矛盾がないか確認する。",
      risk: "テーマ名だけの説明に戻さない。",
    };
  }
  return {
    status: "確認候補",
    action: "出所確認",
    canTransfer: "保留",
    check: "出所、基準日、単位、計算式を確認してから転記する。",
    risk: "未確認値はスコアへ反映しない。",
  };
}

function buildRows(rows) {
  return rows.map((row, index) => {
    const c = classify(row);
    return {
      No: index + 1,
      ticker: row.ticker,
      銘柄: row["銘柄"],
      ゲート: row["ゲート"],
      入力ID: row["入力ID"],
      入力項目: row["入力項目"],
      候補値: row["候補値"],
      現在の扱い: c.status,
      次アクション: c.action,
      転記可否: c.canTransfer,
      確認内容: c.check,
      リスク: c.risk,
      取得元: row["取得元"],
      参照URL: row["参照URL"],
      公式確認: "未",
      スコア反映: "禁止",
      P1復帰: "0社",
      買付上限: "0円",
    };
  });
}

function count(rows, key, value) {
  return rows.filter((row) => row[key] === value).length;
}

function buildSummary(rows) {
  const total = rows.length;
  return [
    { 項目: "総項目", 件数: `${total}項目`, 判定: "確認対象", 説明: "P1事業寄与候補2社の次ゲート入力項目。" },
    { 項目: "公式確認候補", 件数: `${count(rows, "現在の扱い", "公式確認候補")}項目`, 判定: "PDF確認へ", 説明: "PDF原文と計算式が合えば、入力キューへ転記できる候補。" },
    { 項目: "再計算待ち", 件数: `${count(rows, "現在の扱い", "再計算待ち")}項目`, 判定: "再現計算へ", 説明: "既存値はあるが、基準日・式を再現してから使う。" },
    { 項目: "参考のみ", 件数: `${count(rows, "現在の扱い", "参考のみ")}項目`, 判定: "公式IRで置換", 説明: "Yahoo等の参照値。公式確認済みとして扱わない。" },
    { 項目: "転記禁止", 件数: `${count(rows, "現在の扱い", "転記禁止")}項目`, 判定: "使わない", 説明: "入力項目と候補値の期間・意味が合っていない。" },
    { 項目: "未補完", 件数: `${count(rows, "現在の扱い", "未補完")}項目`, 判定: "取得作業", 説明: "候補値がまだない。イベント後入力、公式IR確認、株価再取得が必要。" },
    { 項目: "公式確認済み", 件数: "0項目", 判定: "未", 説明: "この作業台は転記前の検査用。まだスコアには混ぜない。" },
    { 項目: "P1復帰/買付", 件数: "0社 / 0円", 判定: "不可", 説明: "確認・転記・バリデーションが終わるまで変更しない。" },
  ];
}

function statusClass(value) {
  const text = String(value ?? "");
  if (/不可|禁止|未補完|転記禁止|0円|0社|未/.test(text)) return "bad";
  if (/保留|参考|再計算|文章|確認候補|確認後可|PDF確認/.test(text)) return "warn";
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
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>P1 事業寄与 公式確認・転記作業台</title>
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
  <h1>P1 事業寄与 公式確認・転記作業台</h1>
  <p>既存データ候補値を、公式確認して入力キューへ移せるもの、参考止まりのもの、転記禁止のものに分ける作業台です。ここでもスコア・P1復帰・買付上限は変更しません。</p>
</header>
<main>
  <section>
    <h2>結論</h2>
    <p class="notice">この作業台は、候補値をそのまま採用しないための検査表です。公式確認済み0項目、スコア反映禁止、P1復帰0社、買付上限0円を維持します。</p>
    <div class="cards">
      ${card("公式確認候補", `${count(rows, "現在の扱い", "公式確認候補")}項目`, "PDF目視確認へ", "warn")}
      ${card("再計算待ち", `${count(rows, "現在の扱い", "再計算待ち")}項目`, "株価時系列で再現", "warn")}
      ${card("転記禁止", `${count(rows, "現在の扱い", "転記禁止")}項目`, "意味が違う候補値", "bad")}
      ${card("買付上限", "0円", "まだ購入判断に使わない", "bad")}
    </div>
  </section>

  <section>
    <h2>関連ページ</h2>
    <div class="links">
      <a href="index.html">ホーム</a>
      <a href="latest_practical_start_20260614.html">実用パート入口</a>
      <a href="p1_segment_existing_data_prefill_candidates_20260615.html">既存データ補完候補</a>
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
    <h2>確認・転記作業一覧</h2>
    ${table(rows, [
      { key: "No", label: "No" },
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "ゲート", label: "ゲート" },
      { key: "入力項目", label: "入力項目" },
      { key: "候補値", label: "候補値" },
      { key: "現在の扱い", label: "現在の扱い" },
      { key: "次アクション", label: "次アクション" },
      { key: "転記可否", label: "転記可否" },
      { key: "確認内容", label: "確認内容" },
      { key: "リスク", label: "リスク" },
      { key: "参照URL", label: "参照URL" },
      { key: "公式確認", label: "公式確認" },
      { key: "スコア反映", label: "スコア反映" },
      { key: "P1復帰", label: "P1復帰" },
      { key: "買付上限", label: "買付上限" },
    ])}
  </section>

  <footer>generated: ${h(generatedAt)} / source: ${h(sourceCsv)} / 本ページは確認・転記作業用であり、投資助言・自動売買・購入指示ではありません。</footer>
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
          <b>P1 事業寄与 公式確認・転記作業台</b>
          <span>候補値を、公式確認後に転記できるもの、参考止まり、転記禁止、未補完に分ける。</span>
        </a>`;
  const latestStep = `<a class="step" href="${htmlFile}">
        <b>6-12y. P1 事業寄与 公式確認・転記作業台</b>
        <span>既存データ候補値を採用前に検査し、転記可否と次アクションを固定する。</span>
        <em>転記検査</em>
      </a>`;
  const boardLink = `<a href="${htmlFile}">P1 事業寄与 公式確認・転記作業台</a>`;

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

const prefillRows = readCsv(sourceCsv);
const rows = buildRows(prefillRows);
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
  officialCandidates: count(rows, "現在の扱い", "公式確認候補"),
  recalcWaiting: count(rows, "現在の扱い", "再計算待ち"),
  transferBlocked: count(rows, "現在の扱い", "転記禁止"),
  officialConfirmed: 0,
  p1Return: 0,
  buyLimit: "0円",
}, null, 2));
