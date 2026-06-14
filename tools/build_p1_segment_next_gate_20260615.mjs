import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/15 05:05";
const sourceCsv = "p1_segment_reflection_preview_20260615.csv";
const htmlFile = "p1_segment_next_gate_requirements_20260615.html";
const detailCsv = "p1_segment_next_gate_requirements_20260615.csv";
const summaryCsv = "p1_segment_next_gate_requirements_summary_20260615.csv";

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

const nextGateItems = [
  {
    gate: "財務ゲート",
    check: "PER/PBR/ROE、営業利益率、受注・事業寄与の入力値が公式資料ベースでそろっているか",
    required: "公式決算短信・決算説明資料・有価証券報告書等のページ、年度、単位、数値、注記",
    status: "未完了",
    action: "公式確認済みの入力CSVに転記する。未確認値は点数に混ぜない。",
  },
  {
    gate: "価格ゲート",
    check: "直近価格、60日騰落、1年騰落、5年CAGR、10年CAGR、最大下落、S&P500差が更新済みか",
    required: "株価時系列、指数比較、計算日、計算式、欠損の有無",
    status: "未完了",
    action: "同じ計算日で再計算し、過熱・急落・指数劣後を分けて表示する。",
  },
  {
    gate: "イベント後ゲート",
    check: "6月CPI、日銀、FOMC後の金利・為替・指数・候補銘柄反応を入力したか",
    required: "イベント日、発表結果、米10年金利、ドル円、日経平均/TOPIX/S&P500/SOX、個別株反応",
    status: "未到来/未入力",
    action: "イベント後の実データを入れるまで、P1復帰・買付上限を出さない。",
  },
  {
    gate: "説明可能性ゲート",
    check: "なぜこの銘柄を残すのかを、事業寄与・財務・価格・イベント後反応に分けて説明できるか",
    required: "1行理由、残す条件、落とす条件、未確認事項",
    status: "未完了",
    action: "説明不能な銘柄は保留に戻す。テーマ名だけでは通さない。",
  },
];

function buildRows(sourceRows) {
  const candidates = sourceRows.filter((row) => String(row.仮反映判定 ?? "").includes("次ゲート候補"));
  const rows = [];
  for (const candidate of candidates) {
    for (const item of nextGateItems) {
      rows.push({
        ticker: candidate.ticker,
        銘柄: candidate.銘柄,
        次ゲート候補理由: candidate.反映してよい内容,
        ゲート: item.gate,
        確認すること: item.check,
        必要データ: item.required,
        状態: item.status,
        次の作業: item.action,
        P1復帰: "0社",
        買付上限: "0円",
        判定: "保留",
      });
    }
  }
  return rows;
}

function buildSummary(rows) {
  const tickers = new Set(rows.map((row) => row.ticker));
  const incomplete = rows.filter((row) => row.状態 !== "完了").length;
  return [
    {
      項目: "次ゲート対象",
      値: `${tickers.size}銘柄`,
      判定: tickers.size > 0 ? "候補あり" : "候補なし",
      説明: "事業寄与の仮反映プレビューで次ゲート候補になった銘柄だけを対象にする。",
    },
    {
      項目: "未完了ゲート",
      値: `${incomplete}/${rows.length}件`,
      判定: incomplete > 0 ? "保留" : "完了",
      説明: "財務・価格・イベント後・説明可能性の各ゲートが未完了のため、購入判断へ進めない。",
    },
    {
      項目: "P1復帰",
      値: "0社",
      判定: "不可",
      説明: "公式確認後も、次ゲートをすべて通るまではP1へ戻さない。",
    },
    {
      項目: "買付上限",
      値: "0円",
      判定: "維持",
      説明: "購入金額を出す前段階。候補整理と不足データの可視化が目的。",
    },
  ];
}

function statusClass(value) {
  const text = String(value ?? "");
  if (/0円|0社|不可|保留|未完了|未到来|未入力/.test(text)) return "bad";
  if (/候補あり|次ゲート/.test(text)) return "warn";
  if (/完了/.test(text)) return "ok";
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
  const tickers = new Set(rows.map((row) => row.ticker));
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>P1 事業寄与 次ゲート必要データ</title>
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
    .steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
    .step{border:1px solid var(--line);border-radius:10px;padding:13px;background:#fbfdff}
    .step b{display:block;color:var(--blue)}
    footer{font-size:13px;color:#526b82;margin:20px 0}
    @media(max-width:900px){main{padding:12px}.cards,.steps{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:12px;padding:6px 7px}}
  </style>
</head>
<body>
<header>
  <h1>P1 事業寄与 次ゲート必要データ</h1>
  <p>事業寄与の根拠候補を、財務・価格・イベント後反応へ進める前の確認表です。ここを通過するまでP1復帰、購入金額、買付日は出しません。</p>
</header>
<main>
  <section>
    <h2>結論</h2>
    <p class="notice">次ゲート候補は ${h(tickers.size)} 銘柄あります。ただし、財務・価格・イベント後反応・説明可能性が未完了のため、本反映0件、P1復帰0社、買付上限0円を維持します。</p>
    <div class="cards">
      ${card("次ゲート対象", `${tickers.size}銘柄`, "仮反映後に確認する候補", "warn")}
      ${card("本反映", "0件", "入力CSV・スコアは変えない", "bad")}
      ${card("P1復帰", "0社", "まだ戻さない", "bad")}
      ${card("買付上限", "0円", "購入判断に使わない", "bad")}
    </div>
  </section>

  <section>
    <h2>確認順序</h2>
    <div class="steps">
      <div class="step"><b>1. 財務</b><span>公式資料のPER/PBR/ROE、利益率、受注、事業寄与を確認する。</span></div>
      <div class="step"><b>2. 価格</b><span>直近価格、CAGR、最大下落、指数差を同じ計算日で確認する。</span></div>
      <div class="step"><b>3. イベント後</b><span>CPI、日銀、FOMC後の金利・為替・指数・個別反応を入れる。</span></div>
      <div class="step"><b>4. 説明可能性</b><span>残す理由と落とす条件を文章で説明できる銘柄だけ次へ進める。</span></div>
    </div>
  </section>

  <section>
    <h2>関連ページ</h2>
    <div class="links">
      <a href="index.html">ホーム</a>
      <a href="latest_practical_start_20260614.html">実用パート入口</a>
      <a href="p1_segment_reflection_preview_20260615.html">仮反映プレビュー</a>
      <a href="p1_financial_input_validator_20260614.html">財務入力バリデーター</a>
      <a href="practical_action_cockpit_20260614.html">実用判断コックピット</a>
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
    <h2>銘柄別 次ゲート必要データ</h2>
    ${table(rows, [
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "ゲート", label: "ゲート" },
      { key: "確認すること", label: "確認すること" },
      { key: "必要データ", label: "必要データ" },
      { key: "状態", label: "状態" },
      { key: "次の作業", label: "次の作業" },
      { key: "判定", label: "判定" },
      { key: "P1復帰", label: "P1復帰" },
      { key: "買付上限", label: "買付上限" },
    ])}
  </section>

  <footer>generated: ${h(generatedAt)} / source: ${h(sourceCsv)} / 本ページは不足データの管理用であり、投資助言・自動売買・購入指示ではありません。</footer>
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
          <b>P1 事業寄与 次ゲート必要データ</b>
          <span>事業寄与候補をP1へ戻す前に必要な、財務・価格・イベント後反応・説明可能性の不足を確認する。</span>
        </a>`;
  const latestStep = `<a class="step" href="${htmlFile}">
        <b>6-12t. P1 事業寄与 次ゲート必要データ</b>
        <span>仮反映後に必要な財務・価格・イベント後確認を整理し、未完了なら買付上限0円のまま止める。</span>
        <em>次ゲート</em>
      </a>`;
  const boardLink = `<a href="${htmlFile}">P1 事業寄与 次ゲート必要データ</a>`;

  const indexPath = p("index.html");
  let index = fs.readFileSync(indexPath, "utf8");
  index = insertAfter(index, `</a>\n\n`, "");
  index = insertAfter(index, `<a class="card" href="p1_segment_reflection_preview_20260615.html">
          <b>P1 事業寄与 仮反映プレビュー</b>
          <span>人間確認後に公式確認済みへ進めた場合、どの銘柄が次ゲート候補になるかだけ確認する。</span>
        </a>`, homeCard);
  fs.writeFileSync(indexPath, index, "utf8");

  const latestPath = p("latest_practical_start_20260614.html");
  let latest = fs.readFileSync(latestPath, "utf8");
  latest = insertAfter(latest, `<a class="step" href="p1_segment_reflection_preview_20260615.html">
        <b>6-12s. P1 事業寄与 仮反映プレビュー</b>
        <span>公式確認後の見え方を確認する。本反映・買付金額出力はしない。</span>
        <em>仮反映</em>
      </a>`, latestStep);
  fs.writeFileSync(latestPath, latest, "utf8");

  const boardPath = p("daily_practical_compact_board_20260614.html");
  let board = fs.readFileSync(boardPath, "utf8");
  board = insertAfter(board, `<a href="p1_segment_reflection_preview_20260615.html">P1 事業寄与 仮反映プレビュー</a>`, boardLink);
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
