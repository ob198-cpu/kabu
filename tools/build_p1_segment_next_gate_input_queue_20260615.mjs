import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/15 06:25";
const sourceCsv = "p1_segment_next_gate_requirements_20260615.csv";
const htmlFile = "p1_segment_next_gate_input_queue_20260615.html";
const detailCsv = "p1_segment_next_gate_input_queue_20260615.csv";
const summaryCsv = "p1_segment_next_gate_input_queue_summary_20260615.csv";

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

const fieldSets = {
  "財務ゲート": [
    ["per_official", "PER", "決算資料・株価基準日・計算式", "倍率", "公式または計算根拠つき"],
    ["pbr_official", "PBR", "決算資料・BPS・株価基準日・計算式", "倍率", "公式または計算根拠つき"],
    ["roe_official", "ROE", "決算資料・自己資本利益率", "%", "公式資料の数値"],
    ["operating_margin", "営業利益率", "売上高と営業利益、または会社公表の利益率", "%", "年度と単位を明記"],
    ["order_or_segment_growth", "受注・事業別売上/利益の伸び", "事業セグメント表、受注表、見通し資料", "%または金額", "対象事業と全社寄与を分ける"],
  ],
  "価格ゲート": [
    ["price_date", "株価計算日", "株価取得ログ", "日付", "全銘柄で同じ基準日"],
    ["current_price", "直近株価", "株価時系列", "円", "取得元と日時を記録"],
    ["return_60d", "60日騰落率", "株価時系列", "%", "短期過熱・反落確認"],
    ["return_1y", "1年騰落率", "株価時系列", "%", "直近勢いの確認"],
    ["cagr_5y", "5年CAGR", "株価時系列", "%", "長期継続性の確認"],
    ["cagr_10y", "10年CAGR", "株価時系列", "%", "長期生存力の確認"],
    ["max_drawdown_1y", "1年最大下落率", "株価時系列", "%", "下値耐性の確認"],
    ["sp500_gap_1y", "S&P500との差", "株価時系列と指数時系列", "%pt", "+1%以上目標との接続"],
  ],
  "イベント後ゲート": [
    ["event_cpi_result", "6月CPI結果", "公式発表値・市場反応", "数値/文章", "インフレ再加速なら買付停止寄り"],
    ["event_boj_result", "日銀会合結果", "日銀公表資料・為替反応", "文章/数値", "円高ショック有無を確認"],
    ["event_fomc_result", "FOMC結果", "FRB公表・米10年金利反応", "文章/数値", "金利急騰なら高PERを保留"],
    ["post_event_index_reaction", "イベント後指数反応", "日経平均/TOPIX/S&P500/SOX", "%", "地合い確認"],
    ["post_event_ticker_reaction", "イベント後個別株反応", "対象銘柄の1日/5日反応", "%", "指数比で強いか確認"],
  ],
  "説明可能性ゲート": [
    ["one_line_reason", "1行の残す理由", "財務・価格・事業寄与をつないだ説明", "文章", "テーマ名だけは禁止"],
    ["keep_condition", "残す条件", "数値条件とイベント条件", "文章", "何が起きれば残すか"],
    ["drop_condition", "落とす条件", "数値条件とイベント条件", "文章", "何が起きれば落とすか"],
    ["unconfirmed_items", "未確認事項", "残っている確認不足", "文章", "不明点を隠さない"],
  ],
};

const tickerNotes = {
  "6503.T": {
    focus: "エネルギー、FA、会社見通しが全社売上・利益へつながるか",
    risk: "データセンター・半導体設備投資が鈍る場合、FAや電力テーマの説明力が弱くなる。",
  },
  "8035.T": {
    focus: "WFE見通し、製品シェア、AIサーバー需要が売上・利益見通しへつながるか",
    risk: "高PER、半導体投資サイクル、地政学リスクで反落幅が大きくなる可能性がある。",
  },
};

function buildRows(requirementRows) {
  const rows = [];
  for (const requirement of requirementRows) {
    const fields = fieldSets[requirement.ゲート] ?? [];
    for (const [fieldId, fieldName, source, unit, accepted] of fields) {
      const note = tickerNotes[requirement.ticker] ?? { focus: "", risk: "" };
      rows.push({
        ticker: requirement.ticker,
        銘柄: requirement.銘柄,
        ゲート: requirement.ゲート,
        入力ID: `${requirement.ticker.replace(".T", "")}_${fieldId}`,
        入力項目: fieldName,
        必要な取得元: source,
        単位: unit,
        採用条件: accepted,
        入力値: "",
        出所URLまたは資料名: "",
        ページまたは取得日時: "",
        公式確認: "未",
        スコア反映: "禁止",
        P1復帰: "0社",
        買付上限: "0円",
        銘柄別確認焦点: note.focus,
        注意点: note.risk,
      });
    }
  }
  return rows;
}

function buildSummary(rows) {
  const tickers = new Set(rows.map((row) => row.ticker));
  const gates = new Set(rows.map((row) => row.ゲート));
  const unfilled = rows.filter((row) => !row.入力値).length;
  const filled = rows.length - unfilled;
  return [
    {
      項目: "入力キュー",
      値: `${rows.length}項目`,
      判定: filled > 0 ? "一部入力済み" : "未入力",
      説明: `${tickers.size}銘柄、${gates.size}ゲートの必要入力を分解した。現在は${filled}項目を入力済み。`,
    },
    {
      項目: "未入力",
      値: `${unfilled}/${rows.length}項目`,
      判定: "保留",
      説明: "入力値、出所、ページまたは取得日時がそろうまで反映しない。",
    },
    {
      項目: "スコア反映",
      値: "0項目",
      判定: "禁止",
      説明: "このキューは入力準備であり、スコアや候補順位を変更しない。",
    },
    {
      項目: "買付上限",
      値: "0円",
      判定: "維持",
      説明: "全ゲート完了前なので、購入金額は出さない。",
    },
  ];
}

function statusClass(value) {
  const text = String(value ?? "");
  if (/^(0円|0社|禁止|未|保留)$/.test(text)) return "bad";
  if (/未入力|入力キュー/.test(text)) return "warn";
  if (/完了|済/.test(text)) return "ok";
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
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>P1 事業寄与 次ゲート入力キュー</title>
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
    .small{font-size:15px;color:#263e55;font-weight:800;margin:0}
    footer{font-size:13px;color:#526b82;margin:20px 0}
    @media(max-width:900px){main{padding:12px}.cards{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:11px;padding:5px 6px}}
  </style>
</head>
<body>
<header>
  <h1>P1 事業寄与 次ゲート入力キュー</h1>
  <p>三菱電機・東京エレクトロンをP1へ戻す前に、財務・価格・イベント後反応・説明可能性で実際に埋める入力欄を一覧化したページです。</p>
</header>
<main>
  <section>
    <h2>結論</h2>
    <p class="notice">入力キューは作成済みですが、入力値・出所・確認日時は未入力です。スコア反映は禁止、P1復帰0社、買付上限0円を維持します。</p>
    <div class="cards">
      ${card("入力項目", `${rows.length}項目`, "次ゲートに必要な入力欄")}
      ${card("スコア反映", "0項目", "まだ禁止", "bad")}
      ${card("P1復帰", "0社", "まだ戻さない", "bad")}
      ${card("買付上限", "0円", "購入判断に使わない", "bad")}
    </div>
  </section>

  <section>
    <h2>関連ページ</h2>
    <div class="links">
      <a href="index.html">ホーム</a>
      <a href="latest_practical_start_20260614.html">実用パート入口</a>
      <a href="p1_segment_next_gate_requirements_20260615.html">次ゲート必要データ</a>
      <a href="p1_segment_reflection_preview_20260615.html">仮反映プレビュー</a>
      <a href="p1_financial_input_validator_20260614.html">財務入力バリデーター</a>
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
    <h2>入力キュー</h2>
    <p class="small">入力値、出所URLまたは資料名、ページまたは取得日時、公式確認がそろうまで、スコア反映は「禁止」のままにします。</p>
    ${table(rows, [
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "ゲート", label: "ゲート" },
      { key: "入力ID", label: "入力ID" },
      { key: "入力項目", label: "入力項目" },
      { key: "必要な取得元", label: "必要な取得元" },
      { key: "単位", label: "単位" },
      { key: "採用条件", label: "採用条件" },
      { key: "入力値", label: "入力値" },
      { key: "公式確認", label: "公式確認" },
      { key: "スコア反映", label: "スコア反映" },
      { key: "P1復帰", label: "P1復帰" },
      { key: "買付上限", label: "買付上限" },
      { key: "銘柄別確認焦点", label: "銘柄別確認焦点" },
      { key: "注意点", label: "注意点" },
    ])}
  </section>

  <footer>generated: ${h(generatedAt)} / source: ${h(sourceCsv)} / 本ページは入力準備用であり、投資助言・自動売買・購入指示ではありません。</footer>
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
          <b>P1 事業寄与 次ゲート入力キュー</b>
          <span>次ゲートを通すために、実際に埋める財務・価格・イベント後反応・説明欄を一覧化する。</span>
        </a>`;
  const latestStep = `<a class="step" href="${htmlFile}">
        <b>6-12u. P1 事業寄与 次ゲート入力キュー</b>
        <span>財務・価格・イベント後反応・説明可能性の入力欄を分解し、未入力なら反映禁止のまま止める。</span>
        <em>入力キュー</em>
      </a>`;
  const boardLink = `<a href="${htmlFile}">P1 事業寄与 次ゲート入力キュー</a>`;

  const indexPath = p("index.html");
  let index = fs.readFileSync(indexPath, "utf8");
  index = insertAfter(index, `<a class="card" href="p1_segment_next_gate_requirements_20260615.html">
          <b>P1 事業寄与 次ゲート必要データ</b>
          <span>事業寄与候補をP1へ戻す前に必要な、財務・価格・イベント後反応・説明可能性の不足を確認する。</span>
        </a>`, homeCard);
  fs.writeFileSync(indexPath, index, "utf8");

  const latestPath = p("latest_practical_start_20260614.html");
  let latest = fs.readFileSync(latestPath, "utf8");
  latest = insertAfter(latest, `<a class="step" href="p1_segment_next_gate_requirements_20260615.html">
        <b>6-12t. P1 事業寄与 次ゲート必要データ</b>
        <span>仮反映後に必要な財務・価格・イベント後確認を整理し、未完了なら買付上限0円のまま止める。</span>
        <em>次ゲート</em>
      </a>`, latestStep);
  fs.writeFileSync(latestPath, latest, "utf8");

  const boardPath = p("daily_practical_compact_board_20260614.html");
  let board = fs.readFileSync(boardPath, "utf8");
  board = insertAfter(board, `<a href="p1_segment_next_gate_requirements_20260615.html">P1 事業寄与 次ゲート必要データ</a>`, boardLink);
  fs.writeFileSync(boardPath, board, "utf8");
}

function loadCurrentRows() {
  if (fs.existsSync(p(detailCsv))) {
    const currentRows = readCsv(detailCsv);
    if (currentRows.length && currentRows.every((row) => row.入力ID)) {
      return currentRows;
    }
  }
  return buildRows(readCsv(sourceCsv));
}

const rows = loadCurrentRows();
const summaryRows = buildSummary(rows);

writeCsv(detailCsv, rows);
writeCsv(summaryCsv, summaryRows);
writeHtml(rows, summaryRows);
updateNav();

console.log(JSON.stringify({ htmlFile, detailCsv, summaryCsv, rows: rows.length, buyLimit: "0円" }, null, 2));
