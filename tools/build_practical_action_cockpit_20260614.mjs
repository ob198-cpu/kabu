import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/14 00:10";

function readText(file) {
  const p = path.join(ROOT, file);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8").replace(/^\uFEFF/, "") : "";
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (quote) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quote = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quote = true;
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
  const headers = rows[0].map((v) => v.trim());
  return rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}

function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(file, rows) {
  if (!rows.length) {
    fs.writeFileSync(path.join(ROOT, file), "", "utf8");
    return;
  }
  const headers = Object.keys(rows[0]);
  const text = [headers.join(","), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(","))].join("\n");
  fs.writeFileSync(path.join(ROOT, file), `\uFEFF${text}\n`, "utf8");
}

function h(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function num(value, fallback = 0) {
  const n = Number(String(value ?? "").replace(/[%円,]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function yen(value) {
  return `${Math.round(num(value)).toLocaleString("ja-JP")}円`;
}

function statusClass(v) {
  const s = String(v ?? "");
  if (/(不可|停止|除外|未入力|NG|赤|高リスク)/.test(s)) return "bad";
  if (/(注意|保留|監視|partial|未確認|条件付き|再審査)/.test(s)) return "warn";
  if (/(OK|完了|通過|確認済み|再選定候補|接続済み)/.test(s)) return "ok";
  return "";
}

function table(rows, cols) {
  return `<div class="table-wrap"><table><thead><tr>${cols.map((c) => `<th>${h(c.label)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${cols.map((c) => `<td class="${statusClass(r[c.key])}">${h(r[c.key])}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

function page(title, lead, body) {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${h(title)}</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--warn:#a85b00;--red:#b42318;--green:#116b4f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.75}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:white;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);line-height:1.2;letter-spacing:0}
    header p{margin:0;font-weight:800;max-width:1180px}
    main{max-width:1580px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08)}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:25px}
    .notice{border-left:8px solid var(--warn);background:#fff7e7;border-radius:10px;padding:14px 16px;font-weight:900;margin:0 0 14px}
    .danger{border-left-color:var(--red);background:#fff1f1}
    .okbox{border-left-color:var(--green);background:#eefaf5}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:15px}
    .card strong{display:block;font-size:28px;line-height:1.25;color:var(--blue)}
    .card span{font-weight:800;color:#263e55}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin-top:10px}
    table{width:100%;border-collapse:collapse;table-layout:auto;background:white}
    th,td{border:1px solid var(--line);padding:10px 12px;vertical-align:top;overflow-wrap:anywhere;word-break:normal}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    td.ok{color:var(--green);font-weight:900}
    td.warn{color:var(--warn);font-weight:900}
    td.bad{color:var(--red);font-weight:900}
    a{color:#005f99;font-weight:900}
    footer{font-size:13px;color:#526b82;margin:20px 0}
    @media(max-width:900px){main{padding:12px}.cards{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:white}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:13px;padding:7px 8px}}
  </style>
</head>
<body>
<header><h1>${h(title)}</h1><p>${h(lead)}</p></header>
<main>
${body}
<footer>作成: ${h(generatedAt)} / 本画面は売買指示ではなく、6月イベント後に判断するための確認画面です。</footer>
</main>
</body>
</html>`;
}

const events = parseCsv(readText("102_june_event_result_input.csv"));
const strict = parseCsv(readText("candidate10_strict_gate_review_20260613.csv"));
const risk = parseCsv(readText("candidate10_risk_trade_rules_20260613.csv"));

const missingEvents = events.filter((e) => /未入力/.test(`${e.current_status}${e.actual_value}`) || !String(e.current_status || "").trim());
const attentionEvents = events.filter((e) => /注意/.test(`${e.current_status}${e.market_reaction}`));
const hardStop = missingEvents.length > 0;
const buyLimit = hardStop ? 0 : attentionEvents.length > 0 ? 360000 : 840000;
const decision = hardStop ? "購入不可" : attentionEvents.length > 0 ? "小口のみ検討" : "初回35%上限を検討";
const nextAction = hardStop
  ? "日銀、FOMC、最終購入前確認を入力し、本人操作・NISA口座区分を確認する"
  : attentionEvents.length > 0
    ? "半導体・高PER・高ボラ銘柄を減額し、中心候補だけ小口検討"
    : "候補10社を銘柄別上限内で最終確認";

const actionRows = [
  {
    block: "総合判断",
    status: decision,
    current_value: yen(buyLimit),
    next_action: nextAction,
    stop_condition: "未入力イベント、本人操作未確認、NISA口座区分未確認がある場合は買付しない"
  },
  {
    block: "S&P500/TOPIX +1%目標",
    status: "接続済み",
    current_value: "劣後時は追加停止",
    next_action: "20営業日・60営業日で指数比を確認し、-1%以上劣後なら追加停止",
    stop_condition: "-3%以上劣後で次回追加を半分、-5%以上劣後で個別株追加停止"
  },
  {
    block: "質的テーマ",
    status: "補助扱い",
    current_value: "単純加点しない",
    next_action: "ニュース・連想材料は公式数字、業界指標、株価反応の実績で裏付ける",
    stop_condition: "仮説だけで購入候補に昇格しない"
  },
  {
    block: "税制・口座",
    status: "未連動",
    current_value: "本人別入力が必要",
    next_action: "本人スマホ、本人ログイン、NISA残枠、配当方式、注文画面のNISA区分を確認",
    stop_condition: "本人操作が確認できない口座は購入しない"
  }
];
writeCsv("practical_action_cockpit_20260614.csv", actionRows);

const eventRows = events.map((e) => ({
  date: e.planned_date,
  event: e.event,
  status: e.current_status || "未入力",
  input_required: e.input_required,
  action: e.current_status === "未入力" ? "入力後に再判定" : e.action_if_fail || "確認継続",
}));

const candidateRows = strict.map((s) => {
  const r = risk.find((x) => x.ticker === s.ticker) || {};
  let practical = "購入不可";
  if (!hardStop) {
    if (s.universe_status === "再選定候補" && s.financial_status === "pass") practical = "小口候補";
    else if (s.universe_status === "再選定候補") practical = "財務確認後";
    else if (s.universe_status === "監視") practical = "監視";
    else practical = "初回除外候補";
  }
  return {
    ticker: s.ticker,
    name: s.name,
    role: s.role,
    universe_status: s.universe_status,
    reaction_score: s.reaction_score,
    excess_20d_pct: s.excess_20d_pct,
    risk_tier: r.risk_tier || "未接続",
    risk_cap_pct: r.risk_cap_pct || "未接続",
    current_handling: hardStop ? "購入不可" : practical,
    check_point: s.reason,
  };
});
writeCsv("practical_action_candidate_status_20260614.csv", candidateRows);

const body = `
<section>
  <h2>今日の結論</h2>
  <p class="notice danger">現時点の判断は「${h(decision)}」です。買付上限は ${h(yen(buyLimit))}。理由は、${h(missingEvents.map((e) => e.event).join("、") || "未入力イベントなし")} の確認が残っているためです。</p>
  <div class="cards">
    <div class="card"><b>現判断</b><strong>${h(decision)}</strong><span>注文へ進まない</span></div>
    <div class="card"><b>買付上限</b><strong>${h(yen(buyLimit))}</strong><span>イベント未完了時は0円</span></div>
    <div class="card"><b>候補10社</b><strong>${h(String(candidateRows.length))}</strong><span>全件ゲート接続済み</span></div>
    <div class="card"><b>次の作業</b><strong>入力</strong><span>日銀・FOMC・最終確認</span></div>
  </div>
</section>

<section>
  <h2>今やること</h2>
  ${table(actionRows, [
    { key: "block", label: "区分" },
    { key: "status", label: "状態" },
    { key: "current_value", label: "現在値" },
    { key: "next_action", label: "次の作業" },
    { key: "stop_condition", label: "止める条件" },
  ])}
</section>

<section>
  <h2>6月イベント入力</h2>
  ${table(eventRows, [
    { key: "date", label: "日付" },
    { key: "event", label: "イベント" },
    { key: "status", label: "状態" },
    { key: "input_required", label: "入力する数値" },
    { key: "action", label: "処理" },
  ])}
</section>

<section>
  <h2>候補10社の現時点の扱い</h2>
  <p class="notice">ここは「買う銘柄一覧」ではなく、6/18以降に再判定するための状態表です。100社再選定で監視・除外になっている銘柄は、初回買付でそのまま通しません。</p>
  ${table(candidateRows, [
    { key: "ticker", label: "銘柄" },
    { key: "name", label: "名称" },
    { key: "role", label: "役割" },
    { key: "universe_status", label: "100社扱い" },
    { key: "reaction_score", label: "決算反応" },
    { key: "excess_20d_pct", label: "20日超過" },
    { key: "risk_tier", label: "危険度" },
    { key: "risk_cap_pct", label: "上限" },
    { key: "current_handling", label: "現時点の扱い" },
    { key: "check_point", label: "確認理由" },
  ])}
</section>

<section>
  <h2>関連画面</h2>
  <ul>
    <li><a href="decision_improvement_pack_20260613.html">実用判断 改善パック</a></li>
    <li><a href="candidate10_strict_gate_review_20260613.html">候補10社 厳格ゲートレビュー</a></li>
    <li><a href="candidate10_risk_trade_rules_20260613.html">候補10社 銘柄別リスク・売買ルール</a></li>
    <li><a href="benchmark_plus1_trade_gate_20260613.html">S&P500/TOPIX +1%目標と買付比率ゲート</a></li>
    <li><a href="nisa_account_linkage_template_20260613.html">NISA口座・本人操作 連動テンプレート</a></li>
  </ul>
</section>
`;

fs.writeFileSync(
  path.join(ROOT, "practical_action_cockpit_20260614.html"),
  page("6/18以降 実用判断コックピット", "買う・待つ・止める条件を1画面に集約した実用入口です。現時点では買付不可を明示し、次に入力すべきイベントと口座確認を示します。", body),
  "utf8"
);

function insertCard(file, anchorHref, cls) {
  const p = path.join(ROOT, file);
  let s = fs.readFileSync(p, "utf8");
  if (s.includes("practical_action_cockpit_20260614.html")) return;
  const card = `
        <a class="${cls}" href="practical_action_cockpit_20260614.html">
          <b>6/18以降 実用判断コックピット</b>
          <span>買う・待つ・止める条件、6月イベント入力、候補10社の現時点の扱いを1画面で確認。</span>
        </a>
      `;
  const idx = s.indexOf(anchorHref);
  if (idx >= 0) {
    const end = s.indexOf("</a>", idx);
    if (end >= 0) s = s.slice(0, end + 4) + card + s.slice(end + 4);
  } else {
    s = s.replace("</main>", `<section><h2>実用判断コックピット</h2><div class="link-grid">${card}</div></section>\n</main>`);
  }
  fs.writeFileSync(p, s, "utf8");
}

insertCard("896_practical_entry_hub_20260606.html", "post_0618_operation_board_20260613.html", "link-card");
insertCard("index.html", "896_practical_entry_hub_20260606.html", "card");

console.log("generated practical action cockpit");
