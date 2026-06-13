import fs from "node:fs";
import path from "node:path";
import {
  ROOT,
  esc,
  generatedAt,
  insertCardAfter,
  readCsv,
  table,
  writeCsv,
  yen,
} from "./lib/report_utils_20260613.mjs";

const HTML_FILE = "candidate_selection_health_check_20260613.html";
const CSV_FILE = "candidate_selection_health_check_20260613.csv";

const FILES = {
  eventInput: "102_june_event_result_input.csv",
  eventOutput: "106_june_event_engine_output.csv",
  allocation: "108_capital_allocation_by_ticker.csv",
  scenario: "109_capital_scenario_plan.csv",
  finalLogic: "898_final_candidate_selection_logic_20260606.csv",
  workbench: "908_final10_decision_workbench_20260606.csv",
  snapshot: "909_final10_current_snapshot_20260606.csv",
  channels: "889_cross_channel_candidate_comparison_20260605.csv",
  universe: "780_universe100_reselection_metrics_20260528.csv",
  reaction: "869_candidate10_earnings_reaction_rebuild_20260604.csv",
};

function exists(file) {
  return fs.existsSync(path.join(ROOT, file));
}

function number(value) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function byTicker(rows) {
  return new Map(rows.map((row) => [row.ticker, row]));
}

function normalizeChannel(value) {
  return String(value ?? "").replace("半導体材料・製造装置", "半導体製造装置・材料");
}

function makeRow(check, status, purpose, result, action = "") {
  return { check, status, purpose, result, action };
}

const checks = [];
const fileRows = Object.entries(FILES).map(([key, file]) => ({
  key,
  file,
  exists: exists(file),
  rows: exists(file) ? readCsv(file).length : 0,
}));

for (const file of fileRows) {
  checks.push(makeRow(
    `入力ファイル: ${file.file}`,
    file.exists ? "OK" : "NG",
    "候補選定の根拠ファイルが欠けていないか確認する",
    file.exists ? `${file.rows}行` : "ファイルなし",
    file.exists ? "" : "該当ファイルを再生成または復元する",
  ));
}

const allocation = exists(FILES.allocation) ? readCsv(FILES.allocation) : [];
const eventOutput = exists(FILES.eventOutput) ? readCsv(FILES.eventOutput) : [];
const workbench = exists(FILES.workbench) ? readCsv(FILES.workbench) : [];
const snapshot = exists(FILES.snapshot) ? readCsv(FILES.snapshot) : [];
const channels = exists(FILES.channels) ? readCsv(FILES.channels) : [];
const logic = exists(FILES.finalLogic) ? readCsv(FILES.finalLogic) : [];
const universe = exists(FILES.universe) ? readCsv(FILES.universe) : [];
const reaction = exists(FILES.reaction) ? readCsv(FILES.reaction) : [];
const events = exists(FILES.eventInput) ? readCsv(FILES.eventInput) : [];
const scenario = exists(FILES.scenario) ? readCsv(FILES.scenario) : [];

const selectedTickers = allocation.map((row) => row.ticker);
const selectedUnique = unique(selectedTickers);
const duplicateSelected = selectedTickers.filter((ticker, index) => ticker && selectedTickers.indexOf(ticker) !== index);
const targetWeightSum = allocation.reduce((sum, row) => sum + number(row.target_weight_pct), 0);
const currentAllocationSum = allocation.reduce((sum, row) => sum + number(row.current_allocation_yen), 0);
const allPassSum = allocation.reduce((sum, row) => sum + number(row.all_pass_allocation_yen), 0);
const attentionSum = allocation.reduce((sum, row) => sum + number(row.attention_allocation_yen), 0);
const pendingEvents = events.filter((row) => row.current_status === "未入力").length;
const badEvents = events.filter((row) => row.current_status === "悪化").length;

checks.push(makeRow(
  "現行候補10社の件数",
  selectedUnique.length === 10 && duplicateSelected.length === 0 ? "OK" : "NG",
  "候補が空欄・重複・不足のまま表示されていないか確認する",
  `${selectedUnique.length}社 / 重複${unique(duplicateSelected).length}件`,
  selectedUnique.length === 10 && duplicateSelected.length === 0 ? "" : "108_capital_allocation_by_ticker.csv を修正する",
));

checks.push(makeRow(
  "目標比率の合計",
  Math.abs(targetWeightSum - 100) < 0.01 ? "OK" : "NG",
  "10社の比率設計が100%に整合しているか確認する",
  `${targetWeightSum.toFixed(2).replace(/\.00$/, "")}%`,
  Math.abs(targetWeightSum - 100) < 0.01 ? "" : "銘柄別比率を再計算する",
));

checks.push(makeRow(
  "イベント未入力時の購入停止",
  pendingEvents > 0 && currentAllocationSum === 0 ? "OK" : pendingEvents === 0 ? "OK" : "NG",
  "未入力イベントが残る間に購入金額が出てしまう事故を防ぐ",
  `未入力${pendingEvents}件 / 悪化${badEvents}件 / 現在上限${yen(currentAllocationSum)}`,
  pendingEvents > 0 && currentAllocationSum !== 0 ? "イベント出力と資金配分を再計算する" : "",
));

checks.push(makeRow(
  "イベント通過時の参考上限",
  allPassSum === 840000 && attentionSum === 360000 ? "OK" : "注意",
  "6/18以降に使う参考上限が、現行の初回35%・注意15%設計と合うか確認する",
  `緑通過時${yen(allPassSum)} / 黄注意時${yen(attentionSum)}`,
  allPassSum === 840000 && attentionSum === 360000 ? "" : "107〜109の資金配分ルールを確認する",
));

const maps = {
  eventOutput: byTicker(eventOutput),
  workbench: byTicker(workbench),
  channels: byTicker(channels),
  reaction: byTicker(reaction),
};

for (const [label, map] of Object.entries(maps)) {
  const missing = selectedUnique.filter((ticker) => !map.has(ticker));
  checks.push(makeRow(
    `現行10社の接続: ${label}`,
    missing.length === 0 ? "OK" : "注意",
    "候補10社が周辺検証データへ接続されているか確認する",
    missing.length === 0 ? "10社すべて接続" : `未接続: ${missing.join(" / ")}`,
    missing.length === 0 ? "" : "該当CSVへ候補を追加、または未接続理由を明記する",
  ));
}

const greenRows = snapshot.filter((row) => row.scenario === "green");
const yellowRows = snapshot.filter((row) => row.scenario === "yellow");
checks.push(makeRow(
  "シナリオ別候補数",
  greenRows.length === 10 && yellowRows.length > 0 ? "OK" : "注意",
  "緑通過時・黄注意時で候補表示が作られているか確認する",
  `green ${greenRows.length}件 / yellow ${yellowRows.length}件`,
  greenRows.length === 10 ? "" : "909_final10_current_snapshot_20260606.csv を再生成する",
));

const roleCounts = allocation.reduce((acc, row) => {
  acc[row.role] = (acc[row.role] ?? 0) + 1;
  return acc;
}, {});
checks.push(makeRow(
  "中心候補と条件付き候補の分離",
  roleCounts["中心候補"] === 3 && roleCounts["条件付き候補"] === 7 ? "OK" : "注意",
  "中心候補を厚く、条件付き候補を薄く扱うルールに合っているか確認する",
  Object.entries(roleCounts).map(([role, count]) => `${role}${count}社`).join(" / "),
  roleCounts["中心候補"] === 3 && roleCounts["条件付き候補"] === 7 ? "" : "役割分類を確認する",
));

const statusFields = ["default_data", "default_financial", "default_reaction", "default_theme", "default_risk", "default_tax"];
const dataStatus = allocation.map((row) => {
  const wb = maps.workbench.get(row.ticker);
  const values = statusFields.map((field) => wb?.[field] || "missing");
  const pass = values.filter((value) => value === "pass").length;
  const partial = values.filter((value) => value === "partial").length;
  const missing = values.filter((value) => value === "missing" || value === "").length;
  return { ticker: row.ticker, name: row.name, pass, partial, missing, values };
});
const unresolvedCount = dataStatus.filter((item) => item.partial > 0 || item.missing > 0).length;
checks.push(makeRow(
  "必須データの補完状況",
  unresolvedCount === 0 ? "OK" : "注意",
  "未取得値を点数に混ぜず、補完待ちを補完待ちとして扱っているか確認する",
  unresolvedCount === 0 ? "全10社がpass" : `${unresolvedCount}社にpartialまたはmissingあり`,
  unresolvedCount === 0 ? "" : "6/18の最終確認までに、partialの内訳を注文票に明記する",
));

const logicCounts = logic.reduce((acc, row) => {
  acc[row.section] = (acc[row.section] ?? 0) + 1;
  return acc;
}, {});
checks.push(makeRow(
  "最終ロジックの構成",
  logicCounts.detailed_rule >= 10 && logicCounts.score_structure >= 4 && logicCounts.final_class >= 5 ? "OK" : "注意",
  "母集団、必須データ、ハードゲート、量的/質的/信頼度、最終分類が明文化されているか確認する",
  `詳細ルール${logicCounts.detailed_rule ?? 0} / スコア構造${logicCounts.score_structure ?? 0} / 最終分類${logicCounts.final_class ?? 0}`,
  logicCounts.detailed_rule >= 10 ? "" : "898_final_candidate_selection_logic_20260606.csv を補完する",
));

const channelRoleDiff = allocation
  .map((row) => {
    const ch = maps.channels.get(row.ticker);
    const wb = maps.workbench.get(row.ticker);
    const selectedChannel = wb?.channel || ch?.channel || "";
    if (!ch) return null;
    const diffs = [];
    if (ch.channel && selectedChannel && normalizeChannel(ch.channel) !== normalizeChannel(selectedChannel)) diffs.push(`チャンネル: ${selectedChannel} / ${ch.channel}`);
    if (ch.status && !String(ch.status).includes(row.role.replace("条件付き", "条件"))) {
      if (row.ticker === "8035.T" && ch.status === "補欠候補") diffs.push(`扱い: ${row.role} / チャンネル表は補欠`);
    }
    return diffs.length ? `${row.ticker} ${row.name}: ${diffs.join("、")}` : null;
  })
  .filter(Boolean);
checks.push(makeRow(
  "チャンネル分類の整合性",
  channelRoleDiff.length === 0 ? "OK" : "注意",
  "総合、半導体、データセンター、フィジカルAIを混同していないか確認する",
  channelRoleDiff.length === 0 ? "分類差なし" : channelRoleDiff.join(" / "),
  channelRoleDiff.length === 0 ? "" : "差分は理由を明記し、無説明で中心候補へ昇格しない",
));

const monitorOnly = ["6954.T", "6861.T", "6702.T", "6701.T"];
const leakedMonitor = monitorOnly.filter((ticker) => selectedUnique.includes(ticker));
checks.push(makeRow(
  "監視枠の混入防止",
  leakedMonitor.length === 0 ? "OK" : "NG",
  "量子・フィジカルAI探索枠が、未検証のまま購入候補10社に混ざっていないか確認する",
  leakedMonitor.length === 0 ? "監視枠は購入候補10社に混入なし" : `混入: ${leakedMonitor.join(" / ")}`,
  leakedMonitor.length === 0 ? "" : "購入候補から外し、監視枠へ戻す",
));

checks.push(makeRow(
  "100社母集団データ",
  universe.length >= 80 ? "OK" : "注意",
  "現行10社が小さすぎる母集団から恣意的に選ばれていないか確認する",
  `${universe.length}行`,
  universe.length >= 80 ? "" : "母集団ファイルを再確認する",
));

const selectedRows = allocation.map((row) => {
  const engine = maps.eventOutput.get(row.ticker) ?? {};
  const wb = maps.workbench.get(row.ticker) ?? {};
  const ch = maps.channels.get(row.ticker) ?? {};
  const react = maps.reaction.get(row.ticker) ?? {};
  const pass = statusFields.filter((field) => wb[field] === "pass").length;
  const partial = statusFields.filter((field) => wb[field] === "partial").length;
  return {
    "銘柄": `${row.ticker} ${row.name}`,
    "チャンネル": wb.channel || ch.channel || "",
    "役割": row.role,
    "比率": `${row.target_weight_pct}%`,
    "現在上限": yen(row.current_allocation_yen),
    "緑通過時": yen(row.all_pass_allocation_yen),
    "スコア": engine.reference_score || "",
    "データ": `pass ${pass}/6・partial ${partial}/6`,
    "決算反応": react.status || "未接続",
    "チャンネル上の扱い": ch.status || "未接続",
    "停止条件": row.max_position_note,
  };
});

const dataRows = dataStatus.map((item) => ({
  "銘柄": `${item.ticker} ${item.name}`,
  "pass": item.pass,
  "partial": item.partial,
  "missing": item.missing,
  "内訳": statusFields.map((field, index) => `${field}:${item.values[index]}`).join(" / "),
}));

const issueRows = checks
  .filter((check) => check.status !== "OK")
  .map((check) => ({
    "確認項目": check.check,
    "状態": check.status,
    "結果": check.result,
    "対応": check.action || "-",
  }));
if (issueRows.length === 0) {
  issueRows.push({ "確認項目": "未解決注意", "状態": "OK", "結果": "重大な未接続はなし", "対応": "-" });
}

const okCount = checks.filter((check) => check.status === "OK").length;
const warnCount = checks.filter((check) => check.status === "注意").length;
const ngCount = checks.filter((check) => check.status === "NG").length;
const overall = ngCount > 0 ? "要修正" : warnCount > 0 ? "注意あり" : "運用可能";

writeCsv(CSV_FILE, ["check", "status", "purpose", "result", "action"], checks);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 選定ロジック検査</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--red:#a01818;--amber:#a85b00;--green:#116b4f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;line-height:1.7;font-size:18px}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:white;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);line-height:1.2;letter-spacing:0}
    header p{margin:0;font-weight:900}
    main{max-width:1480px;margin:0 auto;padding:22px}
    section{background:white;border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08)}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:25px}
    .notice{border-left:8px solid var(--green);background:#effaf5;padding:14px 16px;border-radius:10px;font-weight:900;margin:0 0 14px}
    .notice.warn{border-left-color:var(--amber);background:#fff7e7}
    .notice.bad{border-left-color:var(--red);background:#fff1f1}
    .summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:15px;margin-bottom:4px}
    .card strong{display:block;font-size:28px;color:var(--blue);line-height:1.2}
    .table-wrap{width:100%;overflow-x:auto;border:1px solid var(--line);border-radius:10px}
    table{border-collapse:collapse;width:100%;min-width:1100px;background:#fff}
    th,td{border-bottom:1px solid var(--line);border-right:1px solid var(--line);padding:10px 11px;text-align:left;vertical-align:top;overflow-wrap:anywhere}
    th{background:#e5f1fb;color:var(--navy);font-weight:900}
    tr:last-child td{border-bottom:0}
    th:last-child,td:last-child{border-right:0}
    .links{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
    .links a{display:inline-flex;align-items:center;min-height:44px;text-decoration:none;border:1px solid #78acd2;color:#06436d;background:#fff;border-radius:9px;padding:9px 15px;font-weight:900}
    @media(max-width:900px){main{padding:12px}.summary{grid-template-columns:1fr}body{font-size:16px}}
  </style>
</head>
<body>
<header>
  <h1>候補10社 選定ロジック検査</h1>
  <p>作成: ${esc(generatedAt)} / 現行10社が、最終ロジック・チャンネル比較・決算反応・資金配分に整合しているかを確認する画面です。</p>
</header>
<main>
  <section>
    <h2>総合判定</h2>
    <p class="notice ${overall === "要修正" ? "bad" : overall === "注意あり" ? "warn" : ""}">${esc(overall)}。OK ${okCount}件、注意 ${warnCount}件、NG ${ngCount}件。注意は「購入不可」ではなく、6/18以降の最終確認で説明を残すべき項目です。</p>
    <div class="summary">
      <div class="card"><b>現行候補</b><strong>${selectedUnique.length}社</strong></div>
      <div class="card"><b>比率合計</b><strong>${targetWeightSum.toFixed(0)}%</strong></div>
      <div class="card"><b>中心候補</b><strong>${roleCounts["中心候補"] ?? 0}社</strong></div>
      <div class="card"><b>条件付き候補</b><strong>${roleCounts["条件付き候補"] ?? 0}社</strong></div>
      <div class="card"><b>現在上限</b><strong>${esc(yen(currentAllocationSum))}</strong></div>
    </div>
    <div class="links">
      <a href="898_final_candidate_selection_logic_20260606.html">最終選定ロジック</a>
      <a href="908_final10_decision_workbench_20260606.html">最終10社ワークベンチ</a>
      <a href="909_final10_current_snapshot_20260606.html">現時点スナップショット</a>
      <a href="889_cross_channel_candidate_comparison_20260605.html">チャンネル比較</a>
      <a href="${CSV_FILE}">検査CSV</a>
    </div>
  </section>

  <section>
    <h2>未解決・注意点</h2>
    ${table(["確認項目", "状態", "結果", "対応"], issueRows, { widths: { "確認項目": "30%", "状態": "10%" } })}
  </section>

  <section>
    <h2>現行10社の接続状況</h2>
    ${table(["銘柄", "チャンネル", "役割", "比率", "現在上限", "緑通過時", "スコア", "データ", "決算反応", "チャンネル上の扱い", "停止条件"], selectedRows, { widths: { "銘柄": "15%", "チャンネル": "15%", "停止条件": "22%" } })}
  </section>

  <section>
    <h2>必須データの補完状況</h2>
    <p class="notice warn">partial は購入候補から即除外する意味ではありません。ただし、partial が残る項目は6/18以降の注文票で「何を確認したか」を明記する必要があります。未取得値を推測で点数に混ぜる扱いはしません。</p>
    ${table(["銘柄", "pass", "partial", "missing", "内訳"], dataRows, { widths: { "銘柄": "18%", "pass": "8%", "partial": "8%", "missing": "8%" } })}
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, HTML_FILE), html, "utf8");

insertCardAfter(
  "index.html",
  "system_health_check_20260613.html",
  `<a class="card" href="${HTML_FILE}">
          <b>候補10社 選定ロジック検査</b>
          <span>現行10社が、最終ロジック、チャンネル比較、決算反応、資金配分、未補完データに整合しているかを確認する画面。</span>
        </a>`,
  HTML_FILE,
);

insertCardAfter(
  "896_practical_entry_hub_20260606.html",
  "system_health_check_20260613.html",
  `<a class="link-card" href="${HTML_FILE}">
          <b>候補10社 選定ロジック検査</b>
          <span>現行10社が、最終ロジック、チャンネル比較、決算反応、資金配分、未補完データに整合しているかを確認する画面。</span>
        </a>`,
  HTML_FILE,
);

console.log(`generated ${HTML_FILE}`);
console.log(`generated ${CSV_FILE}`);
