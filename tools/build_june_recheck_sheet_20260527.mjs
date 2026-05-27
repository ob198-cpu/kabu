import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const generatedAt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date());

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function write(file, text) {
  fs.writeFileSync(path.join(root, file), text, "utf8");
}

function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    const n = text[i + 1];
    if (quoted) {
      if (c === '"' && n === '"') {
        cell += '"';
        i += 1;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  const header = rows.shift() ?? [];
  return rows
    .filter((r) => r.some((v) => String(v).trim() !== ""))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows) {
  const header = Object.keys(rows[0] ?? {});
  return `${header.join(",")}\n${rows.map((r) => header.map((h) => csvEscape(r[h])).join(",")).join("\n")}\n`;
}

function number(value) {
  const m = String(value ?? "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function defaultHandling(priority) {
  if (priority.startsWith("A ")) return "中心確認";
  if (priority.startsWith("A-")) return "追加確認";
  if (priority.startsWith("B ")) return "不足補完";
  return "監視";
}

const detailRows = parseCsv(read("663_june_test_candidate_plan_detail.csv"));
const templateRows = detailRows.map((row) => ({
  generated_at: generatedAt,
  ticker: row.ticker,
  company: row.company,
  current_priority: row.june_test_priority,
  current_handling: defaultHandling(row.june_test_priority),
  base_score: row.final_selection_score,
  data_completion: row.data_completion,
  key_numbers: row.key_numbers,
  caution_items: row.caution_items,
  quantitative_check: "未入力",
  macro_check: "未入力",
  market_check: "未入力",
  sector_check: "未入力",
  individual_check: "未入力",
  qualitative_event_check: "未入力",
  hard_stop_count: 0,
  recheck_score: row.final_selection_score,
  recheck_result: "6月イベント後に入力",
  memo: "",
}));

const ruleRows = [
  {
    generated_at: generatedAt,
    rule: "再判定点",
    formula: "clamp(0,100, 現在点 + 定量 + マクロ + 市場 + 業種 + 個別 + 質的イベント - 重大停止)",
    note: "質的イベントは補助点に限定し、定量・マクロ・市場条件の失敗を単独で上書きしない。",
  },
  {
    generated_at: generatedAt,
    rule: "定量再確認",
    formula: "良好 +8 / 中立 0 / 不十分 -12",
    note: "PER/PBR/ROE、決算成長率、決算後反応、下落率を確認する。",
  },
  {
    generated_at: generatedAt,
    rule: "マクロ確認",
    formula: "良好 +5 / 中立 0 / 悪化 -15",
    note: "米CPI、FOMC後の米金利、日銀後の為替を確認する。",
  },
  {
    generated_at: generatedAt,
    rule: "市場確認",
    formula: "良好 +5 / 中立 0 / 悪化 -15",
    note: "日経平均/TOPIX、75日線、VIX、米国株の急変を確認する。",
  },
  {
    generated_at: generatedAt,
    rule: "業種確認",
    formula: "良好 +5 / 中立 0 / 悪化 -12",
    note: "銀行、半導体、商社、食品など業種ごとの追い風・逆風を見る。",
  },
  {
    generated_at: generatedAt,
    rule: "個別確認",
    formula: "良好 +5 / 中立 0 / 悪化 -12",
    note: "下方修正、悪材料、急落、過熱、流動性を確認する。",
  },
  {
    generated_at: generatedAt,
    rule: "質的イベント",
    formula: "追い風 +3 / 中立 0 / 逆風 -8",
    note: "新製品、提携、TOB、政策、地政学など。単純な期待ではなく株価に結びつく経路を記録する。",
  },
  {
    generated_at: generatedAt,
    rule: "重大停止",
    formula: "1件 -25 / 2件以上は原則外す",
    note: "下方修正、75日線の明確な下回り、金利急騰、円高ショック、決算後の大幅指数劣後など。",
  },
  {
    generated_at: generatedAt,
    rule: "判定",
    formula: "70点以上: 残す / 60-69点: 保留 / 59点以下: 外す。重大停止2件以上は外す。",
    note: "これはNISA 1年保有テストの候補判定であり、購入の確定ではない。",
  },
];

write("666_june_recheck_template.csv", toCsv(templateRows));
write("667_june_recheck_scoring_rules.csv", toCsv(ruleRows));

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (m) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[m]));

const rowsJson = JSON.stringify(templateRows);
const rulesJson = JSON.stringify(ruleRows);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月イベント後 再判定シート</title>
  <style>
    :root {
      --ink:#061d33;
      --muted:#425a70;
      --blue:#0b6fa4;
      --green:#087a55;
      --orange:#b45f06;
      --red:#b42318;
      --line:#c9dced;
      --bg:#f6f9fc;
      --soft:#eef6fc;
    }
    * { box-sizing:border-box; }
    body { margin:0; font-family:"Yu Gothic","Meiryo",Arial,sans-serif; color:var(--ink); background:var(--bg); line-height:1.65; }
    header { background:#123f63; color:#fff; padding:28px 32px; }
    h1 { margin:0 0 8px; font-size:28px; }
    header p { margin:0; color:#eef7ff; }
    main { max-width:1320px; margin:0 auto; padding:22px; }
    section { background:#fff; border:1px solid var(--line); border-radius:10px; padding:20px; margin:0 0 18px; break-inside:avoid; }
    h2 { margin:0 0 12px; padding-left:12px; border-left:8px solid var(--blue); font-size:22px; }
    .grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .card { border:1px solid var(--line); border-radius:8px; padding:14px; background:#fbfdff; min-height:120px; }
    .card b { display:block; margin-bottom:6px; color:#06395b; }
    .formula { background:#fff8ec; border:1px solid #efc98e; border-radius:8px; padding:12px; color:#111; }
    .toolbar { display:flex; flex-wrap:wrap; gap:10px; align-items:center; margin:12px 0; }
    button, .linkbtn { border:1px solid #8bb9d6; border-radius:8px; background:#fff; color:#064f79; font-weight:700; padding:9px 12px; cursor:pointer; text-decoration:none; }
    button.primary { background:#0b6fa4; color:#fff; border-color:#0b6fa4; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:12px; }
    th, td { border:1px solid var(--line); padding:7px; vertical-align:top; overflow-wrap:anywhere; word-break:break-word; }
    th { background:#e7f1fa; color:#06395b; text-align:left; }
    select, input, textarea { width:100%; border:1px solid #a9bfd3; border-radius:6px; padding:6px; font:inherit; background:#fff; color:#111; }
    textarea { min-height:52px; resize:vertical; }
    .score { font-weight:800; font-size:16px; }
    .keep { color:var(--green); font-weight:800; }
    .hold { color:var(--orange); font-weight:800; }
    .drop { color:var(--red); font-weight:800; }
    .small { color:var(--muted); font-size:12px; }
    .wide { overflow-x:auto; padding-bottom:4px; }
    .wide table { min-width:1780px; }
    .status { display:inline-block; padding:3px 8px; border-radius:999px; background:#eef6fc; border:1px solid var(--line); font-weight:700; }
    .status.keep { background:#eaf8f1; border-color:#acd9c4; }
    .status.hold { background:#fff6e8; border-color:#efc98e; }
    .status.drop { background:#fff0ef; border-color:#efaaa3; }
    @media (max-width:820px) {
      main { padding:12px; }
      .grid { grid-template-columns:1fr; }
      header { padding:22px 18px; }
      h1 { font-size:24px; }
    }
  </style>
</head>
<body>
  <header>
    <h1>6月イベント後 再判定シート</h1>
    <p>作成: ${esc(generatedAt)} / 10社を「残す・保留・外す」に再判定するための入力画面</p>
  </header>
  <main>
    <section>
      <h2>1. この画面で行うこと</h2>
      <div class="grid">
        <div class="card"><b>目的</b>6月のCPI・日銀・FOMC・市場反応を入れて、テスト候補を根拠付きで再判定します。</div>
        <div class="card"><b>前提</b>現在の点数は候補抽出用です。ここで市場条件と個別条件を通して、候補に残せるかを確認します。</div>
        <div class="card"><b>質的情報の扱い</b>時流・ニュース・イベントは補助点に限定し、定量条件の失敗を単独では上書きしません。</div>
        <div class="card"><b>出力</b>各銘柄の再判定点、残す/保留/外す、理由メモをCSVで出力できます。</div>
      </div>
    </section>

    <section>
      <h2>2. 再判定ルール</h2>
      <div class="formula">
        再判定点 = clamp(0,100, 現在点 + 定量 + マクロ + 市場 + 業種 + 個別 + 質的イベント - 重大停止)<br>
        判定: 70点以上は「残す」、60-69点は「保留」、59点以下は「外す」。重大停止が2件以上ある場合は原則「外す」。
      </div>
      <div class="wide" style="margin-top:12px">
        <table id="rulesTable"></table>
      </div>
    </section>

    <section>
      <h2>3. 10社 再判定入力</h2>
      <div class="toolbar">
        <button class="primary" id="recalcBtn" type="button">再計算</button>
        <button id="saveBtn" type="button">入力を保存</button>
        <button id="resetBtn" type="button">入力をリセット</button>
        <button id="exportBtn" type="button">判定CSVを出力</button>
        <a class="linkbtn" href="666_june_recheck_template.csv">入力テンプレートCSV</a>
        <a class="linkbtn" href="667_june_recheck_scoring_rules.csv">ルールCSV</a>
        <a class="linkbtn" href="june_recheck_input_criteria_20260527.html">入力基準表</a>
      </div>
      <div class="wide">
        <table id="recheckTable"></table>
      </div>
      <p class="small">入力値はこのブラウザ内に保存できます。別端末で使う場合はCSV出力で記録してください。</p>
    </section>
  </main>

  <script>
    const initialRows = ${rowsJson};
    const rules = ${rulesJson};
    const storageKey = "june-recheck-sheet-20260527";
    const pointMap = {
      quantitative_check: { "良好": 8, "中立": 0, "不十分": -12, "未入力": 0 },
      macro_check: { "良好": 5, "中立": 0, "悪化": -15, "未入力": 0 },
      market_check: { "良好": 5, "中立": 0, "悪化": -15, "未入力": 0 },
      sector_check: { "良好": 5, "中立": 0, "悪化": -12, "未入力": 0 },
      individual_check: { "良好": 5, "中立": 0, "悪化": -12, "未入力": 0 },
      qualitative_event_check: { "追い風": 3, "中立": 0, "逆風": -8, "未入力": 0 }
    };
    const labels = {
      quantitative_check: "定量",
      macro_check: "マクロ",
      market_check: "市場",
      sector_check: "業種",
      individual_check: "個別",
      qualitative_event_check: "質的"
    };
    const options = {
      quantitative_check: ["未入力", "良好", "中立", "不十分"],
      macro_check: ["未入力", "良好", "中立", "悪化"],
      market_check: ["未入力", "良好", "中立", "悪化"],
      sector_check: ["未入力", "良好", "中立", "悪化"],
      individual_check: ["未入力", "良好", "中立", "悪化"],
      qualitative_event_check: ["未入力", "追い風", "中立", "逆風"]
    };

    let rows = loadRows();

    function clamp(n) { return Math.max(0, Math.min(100, n)); }
    function baseScore(row) { return Number(row.base_score || 0); }
    function scoreRow(row) {
      const hardStop = Number(row.hard_stop_count || 0);
      let score = baseScore(row);
      for (const key of Object.keys(pointMap)) score += pointMap[key][row[key] || "未入力"] || 0;
      score -= hardStop * 25;
      score = Math.round(clamp(score) * 10) / 10;
      const failCount = ["quantitative_check", "macro_check", "market_check", "sector_check", "individual_check"]
        .filter((key) => ["不十分", "悪化"].includes(row[key])).length;
      let result = "保留";
      if (hardStop >= 2 || score < 60 || row.quantitative_check === "不十分") result = "外す";
      else if (score >= 70 && failCount === 0) result = "残す";
      return { score, result };
    }
    function loadRows() {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
        if (Array.isArray(saved) && saved.length) return saved;
      } catch (_) {}
      return structuredClone(initialRows);
    }
    function saveRows() {
      localStorage.setItem(storageKey, JSON.stringify(rows));
    }
    function escapeHtml(value) {
      return String(value ?? "").replace(/[&<>"']/g, (m) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[m]));
    }
    function selectCell(rowIndex, key) {
      const value = rows[rowIndex][key] || "未入力";
      return '<select data-row="' + rowIndex + '" data-key="' + key + '">' +
        options[key].map((opt) => '<option value="' + escapeHtml(opt) + '"' + (opt === value ? " selected" : "") + '>' + escapeHtml(opt) + '</option>').join("") +
        '</select>';
    }
    function renderRules() {
      const headers = ["rule", "formula", "note"];
      document.getElementById("rulesTable").innerHTML =
        "<thead><tr>" + headers.map((h) => "<th>" + escapeHtml(h) + "</th>").join("") + "</tr></thead><tbody>" +
        rules.map((r) => "<tr>" + headers.map((h) => "<td>" + escapeHtml(r[h]) + "</td>").join("") + "</tr>").join("") +
        "</tbody>";
    }
    function renderTable() {
      const headers = ["順位", "銘柄", "現分類", "現在点", "注意点", "定量", "マクロ", "市場", "業種", "個別", "質的", "重大停止", "再判定", "メモ"];
      const body = rows.map((row, i) => {
        const scored = scoreRow(row);
        row.recheck_score = scored.score;
        row.recheck_result = scored.result;
        const cls = scored.result === "残す" ? "keep" : scored.result === "外す" ? "drop" : "hold";
        return '<tr>' +
          '<td>' + (i + 1) + '</td>' +
          '<td><b>' + escapeHtml(row.ticker) + '</b><br>' + escapeHtml(row.company) + '<br><span class="small">' + escapeHtml(row.sector_role || "") + '</span></td>' +
          '<td>' + escapeHtml(row.current_priority) + '<br><span class="small">' + escapeHtml(row.current_handling) + '</span></td>' +
          '<td><span class="score">' + escapeHtml(row.base_score) + '</span><br><span class="small">' + escapeHtml(row.data_completion) + '</span></td>' +
          '<td>' + escapeHtml(row.caution_items) + '<br><span class="small">' + escapeHtml(row.key_numbers) + '</span></td>' +
          '<td>' + selectCell(i, "quantitative_check") + '</td>' +
          '<td>' + selectCell(i, "macro_check") + '</td>' +
          '<td>' + selectCell(i, "market_check") + '</td>' +
          '<td>' + selectCell(i, "sector_check") + '</td>' +
          '<td>' + selectCell(i, "individual_check") + '</td>' +
          '<td>' + selectCell(i, "qualitative_event_check") + '</td>' +
          '<td><input data-row="' + i + '" data-key="hard_stop_count" type="number" min="0" max="5" value="' + escapeHtml(row.hard_stop_count || 0) + '"></td>' +
          '<td><span class="status ' + cls + '">' + escapeHtml(scored.result) + '</span><br><span class="score">' + scored.score + '点</span></td>' +
          '<td><textarea data-row="' + i + '" data-key="memo">' + escapeHtml(row.memo || "") + '</textarea></td>' +
        '</tr>';
      }).join("");
      document.getElementById("recheckTable").innerHTML =
        "<thead><tr>" + headers.map((h) => "<th>" + escapeHtml(h) + "</th>").join("") + "</tr></thead><tbody>" + body + "</tbody>";
      bindInputs();
    }
    function bindInputs() {
      document.querySelectorAll("[data-row][data-key]").forEach((el) => {
        el.addEventListener("change", updateFromInput);
        el.addEventListener("input", updateFromInput);
      });
    }
    function updateFromInput(event) {
      const rowIndex = Number(event.target.dataset.row);
      const key = event.target.dataset.key;
      rows[rowIndex][key] = event.target.value;
      if (event.type === "change") renderTable();
    }
    function toCsvValue(value) {
      const s = String(value ?? "");
      return /[",\\n\\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }
    function exportCsv() {
      rows = rows.map((row) => ({ ...row, ...scoreRow(row) }));
      const headers = ["ticker","company","current_priority","base_score","data_completion","quantitative_check","macro_check","market_check","sector_check","individual_check","qualitative_event_check","hard_stop_count","score","result","memo","caution_items"];
      const csv = "\\uFEFF" + headers.join(",") + "\\n" + rows.map((row) => headers.map((h) => toCsvValue(row[h] ?? row.recheck_score ?? "")).join(",")).join("\\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "june_recheck_result_20260527.csv";
      a.click();
      URL.revokeObjectURL(url);
    }
    document.getElementById("recalcBtn").addEventListener("click", renderTable);
    document.getElementById("saveBtn").addEventListener("click", () => { saveRows(); renderTable(); });
    document.getElementById("resetBtn").addEventListener("click", () => {
      localStorage.removeItem(storageKey);
      rows = structuredClone(initialRows);
      renderTable();
    });
    document.getElementById("exportBtn").addEventListener("click", exportCsv);
    renderRules();
    renderTable();
  </script>
</body>
</html>`;

write("june_event_recheck_sheet_20260527.html", html);

console.log(JSON.stringify({
  generatedAt,
  rows: templateRows.length,
  outputs: [
    "666_june_recheck_template.csv",
    "667_june_recheck_scoring_rules.csv",
    "june_event_recheck_sheet_20260527.html",
  ],
}, null, 2));
