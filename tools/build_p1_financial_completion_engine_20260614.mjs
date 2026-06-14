import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/14 21:45";

function p(file) {
  return path.join(ROOT, file);
}

function readText(file) {
  return fs.existsSync(p(file)) ? fs.readFileSync(p(file), "utf8").replace(/^\uFEFF/, "") : "";
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell.replace(/\r$/, ""));
  if (row.some((v) => v !== "")) rows.push(row);
  if (!rows.length) return [];
  const head = rows[0].map((v) => v.trim());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(file, rows) {
  if (!rows.length) {
    fs.writeFileSync(p(file), "", "utf8");
    return;
  }
  const head = Object.keys(rows[0]);
  fs.writeFileSync(p(file), `\uFEFF${[head.join(","), ...rows.map((r) => head.map((h) => csvCell(r[h])).join(","))].join("\n")}\n`, "utf8");
}

function h(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isBlank(value) {
  return String(value ?? "").trim() === "";
}

function statusClass(value) {
  const s = String(value ?? "");
  if (/(不可|禁止|未確認|未完了|不足|0円|NG|除外|反映しない)/.test(s)) return "bad";
  if (/(P1|確認|補完|partial|監視|条件付き|注意)/.test(s)) return "warn";
  if (/(OK|pass|完了|候補復帰|確認済み)/.test(s)) return "ok";
  return "";
}

function table(rows, cols) {
  return `<div class="table-wrap"><table><thead><tr>${cols.map((c) => `<th>${h(c.label)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${cols.map((c) => `<td class="${statusClass(r[c.key])}">${h(r[c.key])}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

function card(title, value, note, className = "") {
  return `<div class="card ${className}"><b>${h(title)}</b><strong>${h(value)}</strong><span>${h(note)}</span></div>`;
}

const financials = parseCsv(readText("redecision_financial_partial_input_template_20260614.csv"));
const unlockRows = parseCsv(readText("ticker_unlock_checklist_20260614.csv"));
const unlockByTicker = Object.fromEntries(unlockRows.map((r) => [r.ticker, r]));

const commonRequired = [
  "PER",
  "PBR",
  "ROE_pct",
  "営業利益率_pct",
  "今期会社予想_前期比",
  "参照URLまたは資料名",
  "資料日付",
  "入力状態",
];

function requiredFields(row) {
  const fields = [...commonRequired];
  if (/受注|セグメント/.test(row.必須項目)) fields.push("受注またはセグメント寄与");
  if (/高PER|高PBR/.test(row.必須項目)) fields.push("高PER説明");
  return fields;
}

function classify(row) {
  const unlock = unlockByTicker[row.ticker] || {};
  const priorityText = unlock.優先度 || "";
  if (priorityText.includes("財務補完後に確認")) return "P1: 候補復帰確認";
  if (priorityText.includes("抑制付き")) return "P1: 抑制理由確認";
  if (priorityText.startsWith("C")) return "P2: 監視・除外補完";
  return "P2: 補足確認";
}

function judge(row) {
  const fields = requiredFields(row);
  const missing = fields.filter((field) => isBlank(row[field]) || row[field] === "未確認");
  const priority = classify(row);
  const unlock = unlockByTicker[row.ticker] || {};
  let result = "未確認: 比率引上げ禁止";
  let next = "公式IR・決算短信・決算説明資料で不足項目を補完";
  let effect = "未確認値を点数に混ぜない。参考上限を買付金額として扱わない。";

  if (missing.length === 0) {
    if (priority.startsWith("P1")) {
      result = "候補復帰の再判定候補";
      next = "P0通過後、統合購入可否エンジンへ反映";
      effect = "財務補完は通過。ただしイベント、口座、指数比較、決算後反応で最終判定。";
    } else {
      result = "補完完了・監視継続";
      next = "解除根拠があるかを別途確認";
      effect = "財務は補完済みでも、監視・除外理由が残れば初回買付へ入れない。";
    }
  }

  return {
    優先区分: priority,
    ticker: row.ticker,
    銘柄: row.銘柄,
    現在扱い: unlock.優先度 || row["100社扱い"] || "",
    入力状態: row.入力状態 || "未確認",
    不足数: `${missing.length}/${fields.length}`,
    不足項目: missing.join(" / ") || "なし",
    確認元: row.確認元,
    判定: result,
    完了後の扱い: effect,
    次アクション: next,
    注文票反映: "反映しない",
  };
}

const rows = financials.map(judge).sort((a, b) => {
  const order = { "P1: 候補復帰確認": 0, "P1: 抑制理由確認": 1, "P2: 監視・除外補完": 2, "P2: 補足確認": 3 };
  return (order[a.優先区分] ?? 9) - (order[b.優先区分] ?? 9) || a.ticker.localeCompare(b.ticker);
});

const p1Rows = rows.filter((r) => r.優先区分.startsWith("P1"));
const p2Rows = rows.filter((r) => r.優先区分.startsWith("P2"));
const completedRows = rows.filter((r) => r.不足項目 === "なし");

const summaryRows = [
  { 項目: "P1候補復帰確認", 件数: `${p1Rows.length}銘柄`, 状態: `${p1Rows.filter((r) => r.不足項目 !== "なし").length}銘柄が未完了`, 意味: "6503・6762など、財務が埋まれば候補復帰を再判定できる層。" },
  { 項目: "P2監視・除外補完", 件数: `${p2Rows.length}銘柄`, 状態: `${p2Rows.filter((r) => r.不足項目 !== "なし").length}銘柄が未完了`, 意味: "初回買付より後順位。解除根拠がない限り注文票へ入れない層。" },
  { 項目: "財務補完完了", 件数: `${completedRows.length}/${rows.length}銘柄`, 状態: completedRows.length ? "一部完了" : "未完了", 意味: "未確認値を点数に混ぜないための確認状況。" },
  { 項目: "現在の注文票反映", 件数: "0件", 状態: "反映しない", 意味: "P0とP1を通過するまで買付金額として扱わない。" },
];

writeCsv("p1_financial_completion_engine_20260614.csv", rows);
writeCsv("p1_financial_completion_summary_20260614.csv", summaryRows);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>P1 財務補完 判定エンジン</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--warn:#a85b00;--red:#a01818;--green:#116b4f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.75}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:white;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);line-height:1.2;letter-spacing:0}
    header p{margin:0;font-weight:800;max-width:1180px}
    main{max-width:1600px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:25px}
    .notice{border-left:8px solid var(--warn);background:#fff7e7;border-radius:10px;padding:14px 16px;font-weight:900;margin:0 0 14px}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:15px}
    .card strong{display:block;font-size:28px;line-height:1.25;color:var(--blue)}
    .card span{display:block;color:#263e55;font-weight:800}
    .card.bad strong{color:var(--red)}
    .card.warn strong{color:var(--warn)}
    .card.ok strong{color:var(--green)}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin-top:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:10px 12px;vertical-align:top;overflow-wrap:anywhere;word-break:normal}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    td.ok{color:var(--green);font-weight:900}
    td.warn{color:var(--warn);font-weight:900}
    td.bad{color:var(--red);font-weight:900}
    .links{display:flex;flex-wrap:wrap;gap:10px}
    .links a{display:inline-block;text-decoration:none;border:1px solid #7bb6dd;border-radius:999px;padding:8px 13px;background:#f7fbff;color:#06395f}
    footer{font-size:13px;color:#526b82;margin:20px 0}
    @media(max-width:900px){main{padding:12px}.cards{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:#fff}header,section{box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:12px;padding:6px 7px}}
  </style>
</head>
<body>
<header>
  <h1>P1 財務補完 判定エンジン</h1>
  <p>公式IR・決算短信・決算説明資料で確認した数値だけを使い、候補復帰に近い銘柄と監視・除外継続銘柄を分ける画面です。</p>
</header>
<main>
  <section>
    <h2>現在の結論</h2>
    <p class="notice">現時点では財務補完が未完了です。未確認のPER/PBR/ROE・利益率・受注などは点数に混ぜず、注文票にも反映しません。</p>
    <div class="cards">
      ${card("P1候補復帰確認", `${p1Rows.length}銘柄`, "6503・6762など", "warn")}
      ${card("P2監視補完", `${p2Rows.length}銘柄`, "監視・除外継続", "bad")}
      ${card("完了", `${completedRows.length}/${rows.length}`, "公式資料で確認済み", completedRows.length ? "ok" : "bad")}
      ${card("注文反映", "0件", "P0/P1通過まで反映しない", "bad")}
    </div>
  </section>

  <section>
    <h2>P1候補復帰確認</h2>
    ${table(p1Rows, [
      { key: "優先区分", label: "優先区分" },
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "不足数", label: "不足数" },
      { key: "不足項目", label: "不足項目" },
      { key: "確認元", label: "確認元" },
      { key: "判定", label: "判定" },
      { key: "完了後の扱い", label: "完了後の扱い" },
    ])}
  </section>

  <section>
    <h2>P2監視・除外補完</h2>
    ${table(p2Rows, [
      { key: "優先区分", label: "優先区分" },
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "現在扱い", label: "現在扱い" },
      { key: "不足数", label: "不足数" },
      { key: "不足項目", label: "不足項目" },
      { key: "判定", label: "判定" },
      { key: "完了後の扱い", label: "完了後の扱い" },
    ])}
  </section>

  <section>
    <h2>全体サマリー</h2>
    ${table(summaryRows, [
      { key: "項目", label: "項目" },
      { key: "件数", label: "件数" },
      { key: "状態", label: "状態" },
      { key: "意味", label: "意味" },
    ])}
  </section>

  <section>
    <h2>関連画面</h2>
    <div class="links">
      <a href="p0_unlock_judgement_engine_20260614.html">P0 判定エンジン</a>
      <a href="p0_unlock_required_sheet_20260614.html">P0 必須入力シート</a>
      <a href="ticker_unlock_checklist_20260614.html">銘柄別ロック解除チェックリスト</a>
      <a href="candidate10_financial_confirmation_gate_20260614.html">候補10社 財務確認ゲート</a>
      <a href="redecision_input_workbench_20260614.html">再判定入力作業台</a>
      <a href="daily_practical_compact_board_20260614.html">実用日次ボード</a>
    </div>
  </section>

  <footer>作成: ${h(generatedAt)} / 本画面は買付指示ではなく、未確認財務を点数に混ぜないための判定画面です。</footer>
</main>
</body>
</html>`;

fs.writeFileSync(p("p1_financial_completion_engine_20260614.html"), html, "utf8");

function insertLink(file, marker, htmlToInsert) {
  const full = p(file);
  if (!fs.existsSync(full)) return;
  let text = fs.readFileSync(full, "utf8");
  if (text.includes("p1_financial_completion_engine_20260614.html")) return;
  const idx = text.indexOf(marker);
  if (idx === -1) return;
  text = text.slice(0, idx) + htmlToInsert + text.slice(idx);
  fs.writeFileSync(full, text, "utf8");
}

insertLink(
  "daily_practical_compact_board_20260614.html",
  '<a href="p0_unlock_judgement_engine_20260614.html">',
  '<a href="p1_financial_completion_engine_20260614.html">P1 財務補完 判定エンジン</a>',
);

insertLink(
  "latest_practical_start_20260614.html",
  '<a class="step" href="integrated_purchase_decision_engine_20260614.html">',
  `<a class="step" href="p1_financial_completion_engine_20260614.html">
        <b>6-12. P1 財務補完 判定エンジン</b>
        <span>候補復帰に近い銘柄と監視・除外継続銘柄を、公式財務入力で分ける。</span>
        <em>P1財務</em>
      </a>
`,
);

insertLink(
  "index.html",
  '<a class="card" href="p0_unlock_judgement_engine_20260614.html">',
  `<a class="card" href="p1_financial_completion_engine_20260614.html">
          <b>P1 財務補完 判定エンジン</b>
          <span>公式PER/PBR/ROE、利益率、受注などの不足を判定する。</span>
        </a>

      `,
);

console.log("generated p1_financial_completion_engine_20260614.html");
