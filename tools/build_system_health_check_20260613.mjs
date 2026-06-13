import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
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

const HTML_FILE = "system_health_check_20260613.html";
const CSV_FILE = "system_health_check_20260613.csv";

const coreScripts = [
  "tools/lib/report_utils_20260613.mjs",
  "tools/apply_event_result_csv_20260613.mjs",
  "tools/build_event_update_runbook_20260613.mjs",
  "tools/build_prebuy_final_verification_20260613.mjs",
  "tools/recalculate_event_outputs_from_102_20260613.mjs",
  "tools/rebuild_june_operation_state_20260613.mjs",
  "tools/check_critical_links_20260613.mjs",
];

const requiredContent = [
  {
    file: "post_0618_prebuy_final_verification_20260613.html",
    patterns: ["停止: イベント未入力", "現時点の投入上限", "本人操作・NISA口座区分", "0円"],
  },
  {
    file: "post_0618_event_csv_apply_helper_20260613.html",
    patterns: ["準備完了", "102_june_event_result_input_to_apply.csv", "未入力3件", "注意1件"],
  },
  {
    file: "post_0618_event_update_runbook_20260613.html",
    patterns: ["現時点の判定", "初回投入上限", "未入力", "購入金額を確定しません"],
  },
];

function runNode(args) {
  try {
    const output = execFileSync("node", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    return { ok: true, output: output.trim() };
  } catch (error) {
    return {
      ok: false,
      output: `${error.stdout?.toString() ?? ""}${error.stderr?.toString() ?? error.message}`.trim(),
    };
  }
}

function row(name, status, purpose, result, action = "") {
  return { name, status, purpose, result, action };
}

const checks = [];

for (const script of coreScripts) {
  const result = runNode(["--check", script]);
  checks.push(row(
    `構文チェック: ${script}`,
    result.ok ? "OK" : "NG",
    "実行前に文法エラーを止める",
    result.ok ? "構文エラーなし" : result.output,
    result.ok ? "" : "該当スクリプトを修正する",
  ));
}

const yenCheck = yen(123456) === "123,456円";
checks.push(row(
  "共通部品: 円表示",
  yenCheck ? "OK" : "NG",
  "金額表示の文字化け・単位欠落を検出する",
  yenCheck ? "123,456円 として出力" : `出力値: ${yen(123456)}`,
  yenCheck ? "" : "report_utils_20260613.mjs の yen() を修正する",
));

for (const args of [
  ["tools/build_event_update_runbook_20260613.mjs"],
  ["tools/apply_event_result_csv_20260613.mjs"],
  ["tools/build_prebuy_final_verification_20260613.mjs"],
  ["tools/check_critical_links_20260613.mjs"],
]) {
  const result = runNode(args);
  checks.push(row(
    `実行チェック: node ${args.join(" ")}`,
    result.ok ? "OK" : "NG",
    "実用導線の生成・リンク検査を実行確認する",
    result.ok ? (result.output || "実行完了") : result.output,
    result.ok ? "" : "エラー箇所を修正して再実行する",
  ));
}

for (const item of requiredContent) {
  const fullPath = path.join(ROOT, item.file);
  const text = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : "";
  const missing = item.patterns.filter((pattern) => !text.includes(pattern));
  checks.push(row(
    `重要文言チェック: ${item.file}`,
    missing.length === 0 ? "OK" : "NG",
    "公開画面に必要な停止条件・金額・操作条件が残っているか確認する",
    missing.length === 0 ? "必要文言あり" : `不足: ${missing.join(" / ")}`,
    missing.length === 0 ? "" : "ページ生成元またはHTMLを確認する",
  ));
}

const events = readCsv("102_june_event_result_input.csv");
const eventIds = new Set(events.map((event) => event.event_id));
const missingEvents = ["E01", "E02", "E03", "E04"].filter((id) => !eventIds.has(id));
const pendingEvents = events.filter((event) => event.current_status === "未入力").length;
const badEvents = events.filter((event) => event.current_status === "悪化").length;
const allocationRows = readCsv("108_capital_allocation_by_ticker.csv");
const currentTotal = allocationRows.reduce((sum, row) => sum + Number(row.current_allocation_yen || 0), 0);
const candidateCount = allocationRows.length;

checks.push(row(
  "イベントCSV: E01〜E04存在",
  missingEvents.length === 0 ? "OK" : "NG",
  "6月イベント判定の必須4項目が欠けていないか確認する",
  missingEvents.length === 0 ? "E01〜E04あり" : `不足: ${missingEvents.join(" / ")}`,
  missingEvents.length === 0 ? "" : "102_june_event_result_input.csv を修正する",
));

checks.push(row(
  "購入停止ゲート: 未入力時の投入上限",
  pendingEvents > 0 && currentTotal === 0 ? "OK" : pendingEvents === 0 ? "OK" : "NG",
  "未入力イベントが残る間に購入金額が出てしまう事故を防ぐ",
  `未入力${pendingEvents}件 / 悪化${badEvents}件 / 現時点上限${yen(currentTotal)}`,
  pendingEvents > 0 && currentTotal !== 0 ? "資金配分再計算を確認する" : "",
));

checks.push(row(
  "候補数チェック",
  candidateCount === 10 ? "OK" : "注意",
  "候補10社の前提が崩れていないか確認する",
  `${candidateCount}社`,
  candidateCount === 10 ? "" : "108_capital_allocation_by_ticker.csv を確認する",
));

const refactoredScripts = [
  "tools/apply_event_result_csv_20260613.mjs",
  "tools/build_event_update_runbook_20260613.mjs",
  "tools/build_prebuy_final_verification_20260613.mjs",
];
const duplicatePatterns = ["function parseCsv", "function writeCsv", "function esc", "function table"];
const duplicateFindings = [];
for (const script of refactoredScripts) {
  const text = fs.readFileSync(path.join(ROOT, script), "utf8");
  for (const pattern of duplicatePatterns) {
    if (text.includes(pattern)) duplicateFindings.push(`${script}: ${pattern}`);
  }
}

checks.push(row(
  "共通部品化チェック",
  duplicateFindings.length === 0 ? "OK" : "注意",
  "最新の実用導線に同じCSV/HTML処理が重複していないか確認する",
  duplicateFindings.length === 0 ? "最新3スクリプトは共通部品を使用" : duplicateFindings.join(" / "),
  duplicateFindings.length === 0 ? "" : "該当関数を tools/lib/report_utils_20260613.mjs に寄せる",
));

const okCount = checks.filter((check) => check.status === "OK").length;
const ngCount = checks.filter((check) => check.status === "NG").length;
const warnCount = checks.filter((check) => check.status === "注意").length;
const overall = ngCount > 0 ? "要修正" : warnCount > 0 ? "注意あり" : "運用可能";

const csvRows = checks.map((check) => ({
  name: check.name,
  status: check.status,
  purpose: check.purpose,
  result: check.result,
  action: check.action,
}));
writeCsv(CSV_FILE, ["name", "status", "purpose", "result", "action"], csvRows);

const displayRows = checks.map((check) => ({
  "確認項目": check.name,
  "状態": check.status,
  "目的": check.purpose,
  "結果": check.result,
  "対応": check.action || "-",
}));

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>システムヘルスチェック</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--red:#a01818;--amber:#a85b00;--green:#116b4f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;line-height:1.7;font-size:18px}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:white;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);line-height:1.2;letter-spacing:0}
    header p{margin:0;font-weight:900}
    main{max-width:1380px;margin:0 auto;padding:22px}
    section{background:white;border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08)}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:25px}
    .summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:15px;margin-bottom:4px}
    .card strong{display:block;font-size:30px;color:var(--blue);line-height:1.2}
    .notice{border-left:8px solid var(--green);background:#effaf5;padding:14px 16px;border-radius:10px;font-weight:900;margin:0 0 14px}
    .notice.warn{border-left-color:var(--amber);background:#fff7e7}
    .notice.bad{border-left-color:var(--red);background:#fff1f1}
    .table-wrap{width:100%;overflow-x:auto;border:1px solid var(--line);border-radius:10px}
    table{border-collapse:collapse;width:100%;min-width:1040px;background:#fff}
    th,td{border-bottom:1px solid var(--line);border-right:1px solid var(--line);padding:10px 11px;text-align:left;vertical-align:top;overflow-wrap:anywhere}
    th{background:#e5f1fb;color:var(--navy);font-weight:900}
    tr:last-child td{border-bottom:0}
    th:last-child,td:last-child{border-right:0}
    .links{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
    .links a{display:inline-flex;align-items:center;min-height:44px;text-decoration:none;border:1px solid #78acd2;color:#06436d;background:#fff;border-radius:9px;padding:9px 15px;font-weight:900}
    @media(max-width:860px){main{padding:12px}.summary{grid-template-columns:1fr}body{font-size:16px}}
  </style>
</head>
<body>
<header>
  <h1>システムヘルスチェック</h1>
  <p>作成: ${esc(generatedAt)} / 6月18日以降に使う実用導線が壊れていないかを確認するページです。</p>
</header>
<main>
  <section>
    <h2>総合判定</h2>
    <p class="notice ${overall === "要修正" ? "bad" : overall === "注意あり" ? "warn" : ""}">${esc(overall)}。OK ${okCount}件、注意 ${warnCount}件、NG ${ngCount}件。</p>
    <div class="summary">
      <div class="card"><b>構文・実行</b><strong>${okCount}/${checks.length}</strong></div>
      <div class="card"><b>未入力イベント</b><strong>${pendingEvents}件</strong></div>
      <div class="card"><b>現時点投入上限</b><strong>${esc(yen(currentTotal))}</strong></div>
      <div class="card"><b>候補数</b><strong>${candidateCount}社</strong></div>
    </div>
    <div class="links">
      <a href="post_0618_prebuy_final_verification_20260613.html">購入前最終確認</a>
      <a href="post_0618_event_csv_apply_helper_20260613.html">イベントCSV反映補助</a>
      <a href="post_0618_event_update_runbook_20260613.html">イベント更新ランブック</a>
      <a href="${CSV_FILE}">検査結果CSV</a>
    </div>
  </section>
  <section>
    <h2>検査結果</h2>
    ${table(["確認項目", "状態", "目的", "結果", "対応"], displayRows, { widths: { "確認項目": "24%", "状態": "8%", "目的": "25%" } })}
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, HTML_FILE), html, "utf8");

insertCardAfter(
  "index.html",
  "post_0618_prebuy_final_verification_20260613.html",
  `<a class="card" href="${HTML_FILE}">
          <b>システムヘルスチェック</b>
          <span>6/18以降に使うイベント更新、CSV反映、購入前最終確認、リンク、重要文言、候補数、投入上限をまとめて検査する画面。</span>
        </a>`,
  HTML_FILE,
);

insertCardAfter(
  "896_practical_entry_hub_20260606.html",
  "post_0618_prebuy_final_verification_20260613.html",
  `<a class="link-card" href="${HTML_FILE}">
          <b>システムヘルスチェック</b>
          <span>6/18以降に使うイベント更新、CSV反映、購入前最終確認、リンク、重要文言、候補数、投入上限をまとめて検査する画面。</span>
        </a>`,
  HTML_FILE,
);

console.log(`generated ${HTML_FILE}`);
console.log(`generated ${CSV_FILE}`);
