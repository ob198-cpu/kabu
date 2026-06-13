import fs from "node:fs";
import path from "node:path";
import {
  ROOT,
  esc,
  generatedAt,
  insertCardAfter as insertReportCardAfter,
  readCsvWithHeaders,
  table,
  writeCsv,
} from "./lib/report_utils_20260613.mjs";

const RESULT_FILE = "102_june_event_result_input.csv";
const RUNBOOK_HTML = "post_0618_event_update_runbook_20260613.html";
const RUNBOOK_CSV = "post_0618_event_update_runbook_20260613.csv";
const APPLY_HELPER_HTML = "post_0618_event_csv_apply_helper_20260613.html";
const APPLY_INPUT_CSV = "102_june_event_result_input_to_apply.csv";
const REQUIRED_HEADERS = [
  "event_id",
  "planned_date",
  "event",
  "input_required",
  "actual_value",
  "market_reaction",
  "pass_condition",
  "current_status",
  "action_if_fail",
];
const REQUIRED_EVENTS = ["E01", "E02", "E03", "E04"];
const ALLOWED_STATUSES = ["未入力", "通過", "注意", "悪化"];

function insertRunbookCard(file, href, cardHtml) {
  insertReportCardAfter(file, href, cardHtml, RUNBOOK_HTML);
}

function insertAfterLink(file, href, html) {
  const fullPath = path.join(ROOT, file);
  if (!fs.existsSync(fullPath)) return;
  let text = fs.readFileSync(fullPath, "utf8");
  if (text.includes(RUNBOOK_HTML)) return;
  const regex = new RegExp(`(<a[^>]+href="${href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>.*?</a>)`, "s");
  if (regex.test(text)) {
    text = text.replace(regex, `$1\n      ${html}`);
    fs.writeFileSync(fullPath, text, "utf8");
  }
}

const { headers, rows: events } = readCsvWithHeaders(RESULT_FILE);

const headerChecks = REQUIRED_HEADERS.map((header) => ({
  "確認項目": header,
  "状態": headers.includes(header) ? "OK" : "不足",
  "対応": headers.includes(header) ? "そのまま使用" : "CSV列を復元してから再計算",
}));

const statusCounts = Object.fromEntries(ALLOWED_STATUSES.map((status) => [status, 0]));
for (const row of events) {
  statusCounts[row.current_status] = (statusCounts[row.current_status] ?? 0) + 1;
}

const missingEventIds = REQUIRED_EVENTS.filter((eventId) => !events.some((row) => row.event_id === eventId));
const invalidStatuses = events.filter((row) => !ALLOWED_STATUSES.includes(row.current_status));
const blankRequired = events.flatMap((row) => REQUIRED_HEADERS
  .filter((header) => (row[header] ?? "") === "")
  .map((header) => ({ event: row.event_id || "(IDなし)", header })));

const gate = (() => {
  if (missingEventIds.length > 0 || invalidStatuses.length > 0) {
    return {
      "判定": "CSV修正が先",
      "初回投入上限": "0円",
      "理由": "必須イベントまたはステータスに不備があります。",
      "次の操作": "CSVの列・イベントID・ステータスを直してから再生成します。",
      className: "bad",
    };
  }
  if ((statusCounts["悪化"] ?? 0) > 0) {
    return {
      "判定": "新規購入停止",
      "初回投入上限": "0円",
      "理由": "悪化イベントがあります。",
      "次の操作": "監視と記録のみ。再判定日まで注文金額を確定しません。",
      className: "bad",
    };
  }
  if ((statusCounts["未入力"] ?? 0) > 0) {
    return {
      "判定": "購入判断へ進めない",
      "初回投入上限": "0円",
      "理由": "未入力イベントがあります。",
      "次の操作": "日銀、FOMC、最終購入前確認を入力してから再判定します。",
      className: "pending",
    };
  }
  if ((statusCounts["注意"] ?? 0) > 0) {
    return {
      "判定": "小さく検討",
      "初回投入上限": "360,000円",
      "理由": "注意イベントがあります。",
      "次の操作": "高PER・高ボラ・半導体比率を抑え、本人操作と証券会社画面確認を終えてから検討します。",
      className: "warn",
    };
  }
  return {
    "判定": "初回投入検討可",
    "初回投入上限": "840,000円",
    "理由": "E01からE04が通過です。",
    "次の操作": "銘柄別ゲート、資金配分、本人操作、NISA口座区分を確認してから進めます。",
    className: "ok",
  };
})();

const eventView = events.map((row) => ({
  "ID": row.event_id,
  "日程": row.planned_date,
  "イベント": row.event,
  "状態": row.current_status,
  "入力済み内容": row.actual_value || "未入力",
  "市場反応": row.market_reaction || "未入力",
  "失敗時の扱い": row.action_if_fail,
}));

const validationRows = [
  {
    "確認": "必須列",
    "結果": headerChecks.every((row) => row["状態"] === "OK") ? "OK" : "不足あり",
    "対応": headerChecks.every((row) => row["状態"] === "OK") ? "再計算可能" : "列名を直す",
  },
  {
    "確認": "必須イベント",
    "結果": missingEventIds.length === 0 ? "OK" : `不足: ${missingEventIds.join(" / ")}`,
    "対応": missingEventIds.length === 0 ? "再計算可能" : "E01からE04をそろえる",
  },
  {
    "確認": "ステータス",
    "結果": invalidStatuses.length === 0 ? "OK" : `不正: ${invalidStatuses.map((row) => `${row.event_id}:${row.current_status}`).join(" / ")}`,
    "対応": "未入力・通過・注意・悪化のいずれかにする",
  },
  {
    "確認": "空欄",
    "結果": blankRequired.length === 0 ? "OK" : `${blankRequired.length}件`,
    "対応": "空欄があっても未入力扱い。ただし根拠説明には入力が必要",
  },
];

const steps = [
  {
    "順番": "1",
    "作業": "イベント実数を入力",
    "対象": "912_june_event_actual_input_sheet_20260606.html",
    "確認": "CPI、日銀、FOMC、最終確認の実数・市場反応・状態を入れる。",
    "止める条件": "実数が未確認、または悪化判定を説明できない場合は進めない。",
  },
  {
    "順番": "2",
    "作業": "判定用CSVを正本CSVへ反映",
    "対象": "102_june_event_result_input.csv",
    "確認": "ブラウザで出したCSVを、公開フォルダの正本CSVへ反映する。",
    "止める条件": "列名が変わった、E01からE04が欠けた、状態が4分類以外になった場合は反映しない。",
  },
  {
    "順番": "3",
    "作業": "CSV状態を検証",
    "対象": RUNBOOK_HTML,
    "確認": "このページで、未入力・注意・悪化・通過の件数と初回投入上限を見る。",
    "止める条件": "未入力または悪化がある場合は、購入金額を確定しない。",
  },
  {
    "順番": "4",
    "作業": "関連ページを再生成",
    "対象": "イベント判定、資金配分、当日運用ボード",
    "確認": "再生成後に、当日運用ボードの投入上限と銘柄別扱いが更新されたか確認する。",
    "止める条件": "古い時刻、古いCSV、リンク切れがある場合は使わない。",
  },
  {
    "順番": "5",
    "作業": "購入前の最終確認",
    "対象": "証券会社画面、本人操作、NISA口座区分",
    "確認": "このシステムは判断補助。注文は本人が証券会社画面で確認して行う。",
    "止める条件": "本人操作・口座区分・注文数量・NISA枠が確認できない場合は発注しない。",
  },
];

const commands = [
  {
    "目的": "このページを再生成",
    "コマンド": "node tools/build_event_update_runbook_20260613.mjs",
    "注意": "CSVを上書きせず、状態確認ページだけ作ります。",
  },
  {
    "目的": "イベント結果を候補・資金配分へ反映",
    "コマンド": "node tools/recalculate_event_outputs_from_102_20260613.mjs",
    "注意": "102を読み、106/108/109と資金配分ページを更新します。102自体は上書きしません。",
  },
  {
    "目的": "判定CSVを正本へ反映",
    "コマンド": `node tools/apply_event_result_csv_20260613.mjs ${APPLY_INPUT_CSV}`,
    "注意": "検査OKなら102をバックアップしてから更新し、関連CSV・関連ページを再生成します。",
  },
  {
    "目的": "当日運用ボードを再生成",
    "コマンド": "node tools/build_post_0618_operation_board_20260613.mjs",
    "注意": "102/106/108/109 CSVを読んで、当日ボードを更新します。",
  },
  {
    "目的": "イベント反映ワークフローを再生成",
    "コマンド": "node tools/build_event_reflection_workflow_20260613.mjs",
    "注意": "102から108/109/当日ボードへの反映状況を更新します。",
  },
  {
    "目的": "リンク切れ確認",
    "コマンド": "node tools/check_critical_links_20260613.mjs",
    "注意": "主要ページのリンク切れを検査します。",
  },
];

const csvRows = [
  { section: "summary", item: "status", value: gate["判定"], note: gate["理由"] },
  { section: "summary", item: "initial_limit", value: gate["初回投入上限"], note: gate["次の操作"] },
  ...Object.entries(statusCounts).map(([status, count]) => ({
    section: "status_count",
    item: status,
    value: `${count}件`,
    note: "",
  })),
  ...validationRows.map((row) => ({
    section: "validation",
    item: row["確認"],
    value: row["結果"],
    note: row["対応"],
  })),
  ...steps.map((row) => ({
    section: "operation_step",
    item: row["順番"],
    value: row["作業"],
    note: `${row["対象"]} / ${row["確認"]}`,
  })),
];
writeCsv(RUNBOOK_CSV, ["section", "item", "value", "note"], csvRows);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月イベントCSV 反映・再生成ランブック</title>
  <style>
    :root { --ink:#061a2f; --blue:#0b4b78; --line:#c7d9ea; --soft:#f4f8fc; --bad:#b42318; --warn:#b76e00; --ok:#067647; }
    * { box-sizing: border-box; }
    body { margin:0; font-family: "Yu Gothic", "Meiryo", Arial, sans-serif; color:var(--ink); background:#edf4fa; line-height:1.75; font-size:18px; }
    header { background:#0d3f66; color:#fff; padding:32px 44px; }
    header h1 { margin:0 0 10px; font-size:34px; letter-spacing:0; }
    header p { margin:0; max-width:1100px; font-size:19px; }
    main { max-width:1220px; margin:0 auto; padding:28px 24px 56px; }
    section { background:#fff; border:1px solid var(--line); border-radius:10px; padding:24px; margin:0 0 22px; page-break-inside:avoid; break-inside:avoid; }
    h2 { margin:0 0 14px; font-size:25px; border-left:8px solid var(--blue); padding-left:12px; }
    .links { display:flex; flex-wrap:wrap; gap:10px; margin-top:16px; }
    .links a { display:inline-flex; align-items:center; min-height:44px; padding:9px 15px; border:1px solid #78acd2; border-radius:9px; color:#06436d; text-decoration:none; font-weight:700; background:#fff; }
    .summary-grid { display:grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap:12px; }
    .summary-card { border:1px solid var(--line); background:var(--soft); border-radius:10px; padding:16px; min-height:112px; }
    .summary-card b { display:block; font-size:17px; margin-bottom:6px; }
    .summary-card strong { display:block; font-size:28px; }
    .status-box { border:2px solid var(--line); border-radius:12px; padding:18px; background:#fff; }
    .status-box.bad { border-color:#f1a7a0; background:#fff5f5; }
    .status-box.warn { border-color:#f4c47c; background:#fff9ee; }
    .status-box.ok { border-color:#9bd8ba; background:#f0fff7; }
    .status-box.pending { border-color:#94b9db; background:#f4f8fc; }
    .status-line { display:grid; grid-template-columns: 170px 1fr; gap:12px; margin:8px 0; }
    .table-wrap { width:100%; overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { border-collapse:collapse; width:100%; min-width:900px; background:#fff; }
    th, td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:12px 13px; vertical-align:top; text-align:left; word-break:normal; overflow-wrap:anywhere; }
    th { background:#e2f0fb; font-weight:800; }
    tr:last-child td { border-bottom:0; }
    td:last-child, th:last-child { border-right:0; }
    code { display:block; white-space:normal; overflow-wrap:anywhere; background:#f7fafc; border:1px solid #d8e6f1; border-radius:8px; padding:9px 10px; font-size:16px; }
    .note { border-left:5px solid var(--blue); background:#f7fbff; padding:14px 16px; margin:12px 0 0; }
    @media (max-width: 860px) {
      body { font-size:16px; }
      header { padding:24px 20px; }
      header h1 { font-size:28px; }
      main { padding:18px 12px 40px; }
      section { padding:18px; }
      .summary-grid { grid-template-columns:1fr; }
      .status-line { grid-template-columns:1fr; }
    }
    @media print {
      body { background:#fff; font-size:14px; }
      header { padding:18px 24px; }
      section { border:1px solid #ccd8e3; border-radius:0; margin-bottom:14px; page-break-inside:avoid; break-inside:avoid; }
      .links { display:none; }
      .table-wrap { overflow:visible; }
      table { min-width:0; font-size:12px; }
      th, td { padding:7px; }
    }
  </style>
</head>
<body>
<header>
  <h1>6月イベントCSV 反映・再生成ランブック</h1>
  <p>イベント実数を入力した後、どのCSVを正本にして、どのページを再生成し、どの条件なら購入判断へ進めないかを確認する実務用ページです。現在の判定は ${esc(RESULT_FILE)} を読み込んで作成しています。</p>
</header>
<main>
  <section>
    <h2>現在の反映状態</h2>
    <div class="summary-grid">
      <div class="summary-card"><b>未入力</b><strong>${statusCounts["未入力"] ?? 0}件</strong></div>
      <div class="summary-card"><b>注意</b><strong>${statusCounts["注意"] ?? 0}件</strong></div>
      <div class="summary-card"><b>悪化</b><strong>${statusCounts["悪化"] ?? 0}件</strong></div>
      <div class="summary-card"><b>通過</b><strong>${statusCounts["通過"] ?? 0}件</strong></div>
    </div>
    <div class="status-box ${gate.className}">
      <div class="status-line"><b>現時点の判定</b><span>${esc(gate["判定"])}</span></div>
      <div class="status-line"><b>初回投入上限</b><span>${esc(gate["初回投入上限"])}</span></div>
      <div class="status-line"><b>理由</b><span>${esc(gate["理由"])}</span></div>
      <div class="status-line"><b>次の操作</b><span>${esc(gate["次の操作"])}</span></div>
    </div>
    <div class="links">
      <a href="912_june_event_actual_input_sheet_20260606.html">イベント実数入力</a>
      <a href="post_0618_event_reflection_workflow_20260613.html">反映ワークフロー</a>
      <a href="${APPLY_HELPER_HTML}">CSV正本反映補助</a>
      <a href="post_0618_operation_board_20260613.html">当日運用ボード</a>
      <a href="${RUNBOOK_CSV}">CSV</a>
    </div>
  </section>

  <section>
    <h2>CSV検証</h2>
    ${table(["確認", "結果", "対応"], validationRows, { widths: { "確認": "18%", "結果": "28%" } })}
    <p class="note">未入力が残る間は、銘柄がよく見えても購入金額を確定しません。悪化が1件でもあれば、新規購入停止を優先します。</p>
  </section>

  <section>
    <h2>イベント別の入力状況</h2>
    ${table(["ID", "日程", "イベント", "状態", "入力済み内容", "市場反応", "失敗時の扱い"], eventView, { widths: { "ID": "7%", "日程": "14%", "状態": "10%" } })}
  </section>

  <section>
    <h2>操作手順</h2>
    ${table(["順番", "作業", "対象", "確認", "止める条件"], steps, { widths: { "順番": "6%", "作業": "18%", "対象": "22%" } })}
  </section>

  <section>
    <h2>再生成コマンド</h2>
    ${table(["目的", "コマンド", "注意"], commands, { widths: { "目的": "24%", "コマンド": "38%" } })}
    <p class="note">一括再構築系の処理は、入力CSVを初期値で上書きする可能性があるため、イベント実数入力後はこの表の対象ページだけを再生成します。</p>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, RUNBOOK_HTML), html, "utf8");

const navLink = `<a href="${RUNBOOK_HTML}">CSV反映ランブック</a>`;
insertAfterLink("912_june_event_actual_input_sheet_20260606.html", "post_0618_event_reflection_workflow_20260613.html", navLink);
insertAfterLink("post_0618_operation_board_20260613.html", "post_0618_event_reflection_workflow_20260613.html", navLink);
insertAfterLink("post_0618_event_reflection_workflow_20260613.html", "912_june_event_actual_input_sheet_20260606.html", navLink);

insertRunbookCard(
  "index.html",
  "post_0618_event_reflection_workflow_20260613.html",
  `<a class="card" href="${RUNBOOK_HTML}">
          <b>6月イベントCSV 反映・再生成ランブック</b>
          <span>イベント実数CSVを反映した後、未入力・注意・悪化の件数、初回投入上限、再生成手順を確認する。</span>
        </a>`,
);

insertRunbookCard(
  "896_practical_entry_hub_20260606.html",
  "post_0618_event_reflection_workflow_20260613.html",
  `<a class="link-card" href="${RUNBOOK_HTML}">
          <b>6月イベントCSV 反映・再生成ランブック</b>
          <span>イベント入力後に、CSV反映、再生成、購入停止条件を順番に確認する。</span>
        </a>`,
);

console.log(`generated ${RUNBOOK_HTML}`);
console.log(`generated ${RUNBOOK_CSV}`);
