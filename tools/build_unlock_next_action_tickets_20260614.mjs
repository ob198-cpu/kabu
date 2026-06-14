import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/14 20:45";

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
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
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

function cls(value) {
  const s = String(value ?? "");
  if (/(P0|購入不可|0円|NG|未入力|未確認|停止|禁止)/.test(s)) return "bad";
  if (/(P1|注意|確認|補完|保留|partial|候補復帰)/.test(s)) return "warn";
  if (/(完了|OK|pass|反映可|低)/.test(s)) return "ok";
  return "";
}

function table(rows, cols) {
  return `<div class="table-wrap"><table><thead><tr>${cols.map((c) => `<th>${h(c.label)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${cols.map((c) => `<td class="${cls(r[c.key])}">${h(r[c.key])}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

function card(title, value, note, className = "") {
  return `<div class="card ${className}"><b>${h(title)}</b><strong>${h(value)}</strong><span>${h(note)}</span></div>`;
}

const readiness = parseCsv(readText("redecision_readiness_detail_20260614.csv"));
const unlock = parseCsv(readText("ticker_unlock_checklist_20260614.csv"));
const unlockByTarget = Object.fromEntries(unlock.map((r) => [`${r.ticker} ${r.銘柄}`, r]));

function ticketFor(row, index) {
  const category = row.区分 || "";
  const target = row.対象 || "";
  const missing = row.不足項目 || "";
  const next = row.次アクション || "";
  let priority = "P2";
  let reason = "補完すると説明力が上がるが、初回買付の直接条件ではない。";
  let inputFile = "redecision_readiness_detail_20260614.csv";
  let complete = "不足項目を埋め、再判定バリデーターでOKまたは条件付きに変わること。";
  let after = "再判定へ反映";
  let due = "6/18以降の最終確認前";

  if (category.includes("6月イベント")) {
    priority = "P0";
    reason = "未入力が残ると全銘柄0円のまま。最初に確認する全体停止条件。";
    inputFile = "redecision_event_input_template_20260614.csv / 102_june_event_result_input.csv";
    complete = "実数、市場反応、判定入力が入り、赤停止でないこと。";
    after = "全体ゲートを緑・黄・赤に分類";
    due = "イベント当日から翌営業日";
  } else if (category.includes("本人別NISA口座")) {
    priority = "P0";
    reason = "本人確認、NISA口座区分、残枠がなければ、その本人分は注文票に進めない。";
    inputFile = "redecision_account_input_template_20260614.csv / nisa_account_execution_gate_20260614.csv";
    complete = "本人名、証券会社、NISA口座、本人スマホ、本人銀行、二段階認証、残枠が確認済み。";
    after = "本人別注文票の作成可否を判定";
    due = "購入検討日の前日まで";
  } else if (category.includes("公式財務partial")) {
    const u = unlockByTarget[target] || {};
    inputFile = "redecision_financial_partial_input_template_20260614.csv / candidate10_financial_confirmation_gate_20260614.csv";
    complete = "公式IR・決算短信・決算説明資料で数値と参照元を入力すること。";
    after = "銘柄別比率引上げ可否を再判定";
    if ((u.優先度 || "").includes("財務補完後に確認")) {
      priority = "P1";
      reason = "財務を埋めると、最短確認候補の次に候補復帰を判断できる。";
      due = "6/18再判定前";
    } else if ((u.優先度 || "").includes("抑制付き")) {
      priority = "P1";
      reason = "財務は通過済みでも反応や期待信頼度が弱く、比率抑制の根拠確認が必要。";
      due = "6/18再判定前";
    } else {
      priority = "P2";
      reason = "監視・除外継続のため、初回買付よりも解除根拠の確認が主目的。";
      due = "初回判断後も継続確認";
    }
  }

  return {
    優先度: priority,
    作業番号: `${priority}-${String(index + 1).padStart(2, "0")}`,
    作業チケット: category,
    対象: target,
    入力先: inputFile,
    欠けているもの: missing || "未記載",
    完了条件: complete,
    完了後の扱い: after,
    優先理由: reason,
    期限目安: due,
    現在の影響: row.再判定への影響 || "再判定不可",
    次アクション: next || "不足項目を入力",
  };
}

const tickets = readiness
  .filter((r) => (r.検査結果 || "") !== "OK")
  .map(ticketFor)
  .sort((a, b) => {
    const order = { P0: 0, P1: 1, P2: 2 };
    const numberA = Number(String(a.作業番号).split("-")[1] || 0);
    const numberB = Number(String(b.作業番号).split("-")[1] || 0);
    return (order[a.優先度] ?? 9) - (order[b.優先度] ?? 9) || numberA - numberB;
  });

const summary = [
  {
    項目: "全体停止",
    件数: `${tickets.filter((r) => r.優先度 === "P0").length}件`,
    内容: "イベント入力と本人別口座確認。ここが未完了なら全体または本人別で0円継続。",
  },
  {
    項目: "候補復帰に近い作業",
    件数: `${tickets.filter((r) => r.優先度 === "P1").length}件`,
    内容: "財務補完後に確認できる候補、または抑制理由の確認。",
  },
  {
    項目: "監視・除外の補完",
    件数: `${tickets.filter((r) => r.優先度 === "P2").length}件`,
    内容: "初回買付より後順位。解除根拠がない限り注文票へ入れない。",
  },
  {
    項目: "現在の注文反映",
    件数: "0件",
    内容: "作業チケット完了後に再判定するまで、参考上限は買付金額として扱わない。",
  },
];

writeCsv("unlock_next_action_tickets_20260614.csv", tickets);
writeCsv("unlock_next_action_summary_20260614.csv", summary);

const topTickets = tickets.slice(0, 12);
const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>買付ロック解除 次アクションチケット</title>
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
    .notice{border-left:8px solid var(--red);background:#fff1f1;border-radius:10px;padding:14px 16px;font-weight:900;margin:0 0 14px}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:15px}
    .card strong{display:block;font-size:28px;line-height:1.25;color:var(--blue)}
    .card span{display:block;color:#263e55;font-weight:800}
    .card.bad strong{color:var(--red)}
    .card.warn strong{color:var(--warn)}
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
  <h1>買付ロック解除 次アクションチケット</h1>
  <p>再判定に進むために、何をどの順番で埋めるべきかを作業チケット化した画面です。</p>
</header>
<main>
  <section>
    <h2>現在の結論</h2>
    <p class="notice">現時点では、購入不可・買付上限0円です。P0が残る限り、候補銘柄の良し悪しに関係なく注文票へ進めません。</p>
    <div class="cards">
      ${card("P0 全体停止", `${tickets.filter((r) => r.優先度 === "P0").length}件`, "イベント・本人別口座。最優先", "bad")}
      ${card("P1 候補復帰", `${tickets.filter((r) => r.優先度 === "P1").length}件`, "6503/6762等の財務補完・抑制確認", "warn")}
      ${card("P2 監視補完", `${tickets.filter((r) => r.優先度 === "P2").length}件`, "監視・除外継続銘柄の補助確認")}
      ${card("注文反映", "0件", "再判定完了まで反映しない", "bad")}
    </div>
  </section>

  <section>
    <h2>最優先で見るチケット</h2>
    ${table(topTickets, [
      { key: "優先度", label: "優先度" },
      { key: "作業番号", label: "番号" },
      { key: "作業チケット", label: "作業" },
      { key: "対象", label: "対象" },
      { key: "欠けているもの", label: "欠けているもの" },
      { key: "完了条件", label: "完了条件" },
      { key: "期限目安", label: "期限目安" },
    ])}
  </section>

  <section>
    <h2>全チケット</h2>
    ${table(tickets, [
      { key: "優先度", label: "優先度" },
      { key: "作業番号", label: "番号" },
      { key: "対象", label: "対象" },
      { key: "入力先", label: "入力先" },
      { key: "欠けているもの", label: "欠けているもの" },
      { key: "完了後の扱い", label: "完了後の扱い" },
      { key: "優先理由", label: "優先理由" },
      { key: "次アクション", label: "次アクション" },
    ])}
  </section>

  <section>
    <h2>サマリー</h2>
    ${table(summary, [
      { key: "項目", label: "項目" },
      { key: "件数", label: "件数" },
      { key: "内容", label: "内容" },
    ])}
  </section>

  <section>
    <h2>関連画面</h2>
    <div class="links">
      <a href="daily_practical_compact_board_20260614.html">実用日次ボード</a>
      <a href="unlock_input_workflow_20260614.html">買付ロック解除 入力ワークフロー</a>
      <a href="redecision_readiness_validator_20260614.html">再判定準備バリデーター</a>
      <a href="ticker_unlock_checklist_20260614.html">銘柄別ロック解除チェックリスト</a>
      <a href="redecision_input_workbench_20260614.html">再判定入力作業台</a>
      <a href="redecision_output_preview_20260614.html">再判定出力プレビュー</a>
    </div>
  </section>

  <footer>作成: ${h(generatedAt)} / 本画面は買付指示ではなく、未入力データを買付判断に混ぜないための作業順整理です。</footer>
</main>
</body>
</html>`;

fs.writeFileSync(p("unlock_next_action_tickets_20260614.html"), html, "utf8");

function insertLink(file, marker, htmlToInsert) {
  const full = p(file);
  if (!fs.existsSync(full)) return;
  let text = fs.readFileSync(full, "utf8");
  if (text.includes("unlock_next_action_tickets_20260614.html")) return;
  const idx = text.indexOf(marker);
  if (idx === -1) return;
  text = text.slice(0, idx) + htmlToInsert + text.slice(idx);
  fs.writeFileSync(full, text, "utf8");
}

insertLink(
  "daily_practical_compact_board_20260614.html",
  '<a href="unlock_input_workflow_20260614.html">',
  '<a href="unlock_next_action_tickets_20260614.html">買付ロック解除 次アクションチケット</a>',
);

insertLink(
  "unlock_input_workflow_20260614.html",
  '<a href="daily_practical_compact_board_20260614.html">',
  '<a href="unlock_next_action_tickets_20260614.html">買付ロック解除 次アクションチケット</a>',
);

insertLink(
  "latest_practical_start_20260614.html",
  '<a class="step" href="integrated_purchase_decision_engine_20260614.html">',
  `<a class="step" href="unlock_next_action_tickets_20260614.html">
        <b>6-9. 買付ロック解除 次アクションチケット</b>
        <span>再判定に進むため、今日どの順番で不足項目を埋めるか確認する。</span>
        <em>作業順</em>
      </a>
`,
);

insertLink(
  "index.html",
  '<a class="card" href="unlock_input_workflow_20260614.html">',
  `<a class="card" href="unlock_next_action_tickets_20260614.html">
          <b>買付ロック解除 次アクションチケット</b>
          <span>イベント、口座、財務補完の不足を優先順位付きで確認する。</span>
        </a>

      `,
);

console.log("generated unlock_next_action_tickets_20260614.html");
