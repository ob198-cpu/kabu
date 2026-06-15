import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/15 06:05";
const sourceCsv = "p1_segment_next_gate_input_validator_20260615.csv";
const htmlFile = "p1_segment_next_gate_work_order_20260615.html";
const detailCsv = "p1_segment_next_gate_work_order_20260615.csv";
const summaryCsv = "p1_segment_next_gate_work_order_summary_20260615.csv";

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

function writeCsv(file, rows) {
  const headers = Object.keys(rows[0] ?? { empty: "" });
  const body = [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
  fs.writeFileSync(p(file), `\uFEFF${body}\n`, "utf8");
}

function classify(row) {
  const gate = row.ゲート ?? "";
  const item = row.入力項目 ?? "";
  if (gate === "財務ゲート") {
    return {
      区分: "公式IR・財務確認",
      優先: "1",
      取得ルート: "決算短信、決算説明資料、有価証券報告書、会社IRの数値を確認する。",
      作業内容: "年度、単位、ページ、計算式をそろえ、公式確認を済にする。",
      通過条件: "入力値、出所、ページ、公式確認がそろう。",
    };
  }
  if (gate === "価格ゲート") {
    return {
      区分: "株価時系列・指数比較",
      優先: "2",
      取得ルート: "既存の株価取得ログ、株価時系列、S&P500/TOPIX/SOX等の指数時系列を使う。",
      作業内容: "全銘柄で同じ計算日を使い、CAGR、最大下落、指数差を再計算する。",
      通過条件: "計算日、計算式、出所、欠損有無がそろう。",
    };
  }
  if (gate === "イベント後ゲート") {
    return {
      区分: "6月イベント後入力",
      優先: "3",
      取得ルート: "CPI、日銀、FOMC後の金利、為替、指数、個別株反応を入力する。",
      作業内容: "イベント結果が出た後に、1日/5日反応と指数比を記録する。",
      通過条件: "イベント結果と市場反応が確認済みになる。",
    };
  }
  if (gate === "説明可能性ゲート") {
    return {
      区分: "説明文・分岐条件",
      優先: "4",
      取得ルート: "財務・価格・イベント後データをもとに、残す理由と落とす条件を文章化する。",
      作業内容: "テーマ名だけでなく、数値と条件分岐に基づく説明を作る。",
      通過条件: "残す条件、落とす条件、未確認事項が分かれている。",
    };
  }
  return {
    区分: "未分類",
    優先: "9",
    取得ルート: "確認が必要。",
    作業内容: `${item} の取得方法を確認する。`,
    通過条件: "入力値、出所、ページ、公式確認がそろう。",
  };
}

function buildRows(sourceRows) {
  return sourceRows
    .filter((row) => row.判定 !== "通過")
    .map((row) => {
      const info = classify(row);
      return {
        優先: info.優先,
        区分: info.区分,
        ticker: row.ticker,
        銘柄: row.銘柄,
        ゲート: row.ゲート,
        入力ID: row.入力ID,
        入力項目: row.入力項目,
        不足: row.不足,
        取得ルート: info.取得ルート,
        作業内容: info.作業内容,
        通過条件: info.通過条件,
        現在状態: "未完了",
        スコア反映: "禁止",
        P1復帰: "0社",
        買付上限: "0円",
      };
    })
    .sort((a, b) => Number(a.優先) - Number(b.優先) || String(a.ticker).localeCompare(String(b.ticker)) || String(a.入力ID).localeCompare(String(b.入力ID)));
}

function countBy(rows, key) {
  const map = new Map();
  for (const row of rows) {
    const value = row[key] ?? "";
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return [...map.entries()].map(([name, count]) => ({ name, count }));
}

function buildSummary(rows) {
  const buckets = countBy(rows, "区分");
  const bucketText = buckets.map((row) => `${row.name}:${row.count}`).join(" / ");
  const nowPossible = rows.filter((row) => row.区分 === "公式IR・財務確認" || row.区分 === "株価時系列・指数比較").length;
  const eventWait = rows.filter((row) => row.区分 === "6月イベント後入力").length;
  return [
    {
      項目: "未完了作業",
      値: `${rows.length}項目`,
      判定: "作業中",
      説明: bucketText,
    },
    {
      項目: "今すぐ進める項目",
      値: `${nowPossible}項目`,
      判定: nowPossible > 0 ? "あり" : "なし",
      説明: "公式IR・財務確認と株価時系列の再計算は、イベント前でも進められる。",
    },
    {
      項目: "イベント後に入力する項目",
      値: `${eventWait}項目`,
      判定: eventWait > 0 ? "待機" : "なし",
      説明: "CPI、日銀、FOMC後の実データが必要。",
    },
    {
      項目: "P1復帰/買付",
      値: "0社 / 0円",
      判定: "不可",
      説明: "作業票は入力準備用。購入判断には使わない。",
    },
  ];
}

function statusClass(value) {
  const text = String(value ?? "");
  if (/0円|0社|不可|禁止|未完了/.test(text)) return "bad";
  if (/作業中|あり|待機/.test(text)) return "warn";
  if (/完了|通過/.test(text)) return "ok";
  return "";
}

function table(data, columns) {
  return `<div class="table-wrap"><table><thead><tr>${columns.map((column) => `<th>${h(column.label)}</th>`).join("")}</tr></thead><tbody>${data.map((row) => `<tr>${columns.map((column) => {
    const value = row[column.key];
    const cls = statusClass(value);
    return `<td class="${cls}">${h(value)}</td>`;
  }).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function card(title, value, note, className = "") {
  return `<div class="card ${className}"><b>${h(title)}</b><strong>${h(value)}</strong><span>${h(note)}</span></div>`;
}

function writeHtml(rows, summaryRows) {
  const nowPossible = rows.filter((row) => row.区分 === "公式IR・財務確認" || row.区分 === "株価時系列・指数比較").length;
  const eventWait = rows.filter((row) => row.区分 === "6月イベント後入力").length;
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>P1 事業寄与 次ゲート作業票</title>
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
    .flow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
    .flow div{border:1px solid var(--line);border-radius:10px;padding:12px;background:#fbfdff}
    .flow b{display:block;color:var(--blue)}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin-top:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:10px 12px;vertical-align:top;overflow-wrap:anywhere;word-break:normal}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    footer{font-size:13px;color:#526b82;margin:20px 0}
    @media(max-width:900px){main{padding:12px}.cards,.flow{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:11px;padding:5px 6px}}
  </style>
</head>
<body>
<header>
  <h1>P1 事業寄与 次ゲート作業票</h1>
  <p>バリデーターで未通過になった項目を、取得ルートと作業順に並べ替えたページです。何をどこから埋めるかを明確にし、未確認値がスコアへ混ざることを防ぎます。</p>
</header>
<main>
  <section>
    <h2>結論</h2>
    <p class="notice">未完了作業は ${h(rows.length)} 項目です。今すぐ進める項目は ${h(nowPossible)} 項目、6月イベント後に入力する項目は ${h(eventWait)} 項目です。P1復帰0社、買付上限0円を維持します。</p>
    <div class="cards">
      ${card("未完了作業", `${rows.length}項目`, "入力不足の総数", "bad")}
      ${card("今すぐ進める", `${nowPossible}項目`, "IR・株価再計算", "warn")}
      ${card("イベント後入力", `${eventWait}項目`, "6月イベント後", "warn")}
      ${card("買付上限", "0円", "購入判断に使わない", "bad")}
    </div>
  </section>

  <section>
    <h2>作業順</h2>
    <div class="flow">
      <div><b>1. 公式IR・財務確認</b><span>PER/PBR/ROE、利益率、受注・事業寄与を公式資料で埋める。</span></div>
      <div><b>2. 株価時系列・指数比較</b><span>同じ計算日でCAGR、最大下落、S&P500差を再計算する。</span></div>
      <div><b>3. 6月イベント後入力</b><span>CPI、日銀、FOMC後の市場反応を入れる。</span></div>
      <div><b>4. 説明文・分岐条件</b><span>残す理由、落とす条件、未確認事項を分ける。</span></div>
    </div>
  </section>

  <section>
    <h2>関連ページ</h2>
    <div class="links">
      <a href="index.html">ホーム</a>
      <a href="latest_practical_start_20260614.html">実用パート入口</a>
      <a href="p1_segment_next_gate_input_validator_20260615.html">入力バリデーター</a>
      <a href="p1_segment_next_gate_input_queue_20260615.html">入力キュー</a>
      <a href="p1_segment_next_gate_requirements_20260615.html">必要データ</a>
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
    <h2>作業票</h2>
    ${table(rows, [
      { key: "優先", label: "優先" },
      { key: "区分", label: "区分" },
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "ゲート", label: "ゲート" },
      { key: "入力項目", label: "入力項目" },
      { key: "不足", label: "不足" },
      { key: "取得ルート", label: "取得ルート" },
      { key: "作業内容", label: "作業内容" },
      { key: "通過条件", label: "通過条件" },
      { key: "現在状態", label: "現在状態" },
      { key: "スコア反映", label: "スコア反映" },
      { key: "P1復帰", label: "P1復帰" },
      { key: "買付上限", label: "買付上限" },
    ])}
  </section>

  <footer>generated: ${h(generatedAt)} / source: ${h(sourceCsv)} / 本ページは作業管理用であり、投資助言・自動売買・購入指示ではありません。</footer>
</main>
</body>
</html>`;
  fs.writeFileSync(p(htmlFile), html, "utf8");
}

function insertAfter(content, marker, addition) {
  if (content.includes(addition.trim())) return content;
  const index = content.indexOf(marker);
  if (index === -1) return content;
  const end = index + marker.length;
  return `${content.slice(0, end)}\n${addition}\n${content.slice(end)}`;
}

function updateNav() {
  const homeCard = `<a class="card" href="${htmlFile}">
          <b>P1 事業寄与 次ゲート作業票</b>
          <span>未通過項目を取得ルートと作業順に整理し、今すぐ進める項目とイベント後入力を分ける。</span>
        </a>`;
  const latestStep = `<a class="step" href="${htmlFile}">
        <b>6-12w. P1 事業寄与 次ゲート作業票</b>
        <span>未通過項目をIR確認・株価再計算・イベント後入力・説明文作成に分け、作業順を固定する。</span>
        <em>作業票</em>
      </a>`;
  const boardLink = `<a href="${htmlFile}">P1 事業寄与 次ゲート作業票</a>`;

  const indexPath = p("index.html");
  let index = fs.readFileSync(indexPath, "utf8");
  index = insertAfter(index, `<a class="card" href="p1_segment_next_gate_input_validator_20260615.html">
          <b>P1 事業寄与 次ゲート入力バリデーター</b>
          <span>入力値・出所・取得位置・公式確認がそろっているかを検査し、未通過なら反映禁止で止める。</span>
        </a>`, homeCard);
  fs.writeFileSync(indexPath, index, "utf8");

  const latestPath = p("latest_practical_start_20260614.html");
  let latest = fs.readFileSync(latestPath, "utf8");
  latest = insertAfter(latest, `<a class="step" href="p1_segment_next_gate_input_validator_20260615.html">
        <b>6-12v. P1 事業寄与 次ゲート入力バリデーター</b>
        <span>次ゲート入力キューの不足を検査し、未完了ならP1復帰0社・買付上限0円を維持する。</span>
        <em>入力検査</em>
      </a>`, latestStep);
  fs.writeFileSync(latestPath, latest, "utf8");

  const boardPath = p("daily_practical_compact_board_20260614.html");
  let board = fs.readFileSync(boardPath, "utf8");
  board = insertAfter(board, `<a href="p1_segment_next_gate_input_validator_20260615.html">P1 事業寄与 次ゲート入力バリデーター</a>`, boardLink);
  fs.writeFileSync(boardPath, board, "utf8");
}

const sourceRows = readCsv(sourceCsv);
const rows = buildRows(sourceRows);
const summaryRows = buildSummary(rows);

writeCsv(detailCsv, rows);
writeCsv(summaryCsv, summaryRows);
writeHtml(rows, summaryRows);
updateNav();

console.log(JSON.stringify({ htmlFile, detailCsv, summaryCsv, rows: rows.length, buyLimit: "0円" }, null, 2));
