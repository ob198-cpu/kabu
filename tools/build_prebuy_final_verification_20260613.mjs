import fs from "node:fs";
import path from "node:path";
import {
  ROOT,
  esc,
  generatedAt,
  insertCardAfter,
  pct,
  readCsv,
  table,
  writeCsv,
  yen,
} from "./lib/report_utils_20260613.mjs";

const HTML_FILE = "post_0618_prebuy_final_verification_20260613.html";
const CSV_FILE = "post_0618_prebuy_final_verification_20260613.csv";

const events = readCsv("102_june_event_result_input.csv");
const engineRows = readCsv("106_june_event_engine_output.csv");
const allocationRows = readCsv("108_capital_allocation_by_ticker.csv");
const scenarioRows = readCsv("109_capital_scenario_plan.csv");

const counts = {
  未入力: events.filter((row) => row.current_status === "未入力").length,
  注意: events.filter((row) => row.current_status === "注意").length,
  悪化: events.filter((row) => row.current_status === "悪化").length,
  通過: events.filter((row) => row.current_status === "通過").length,
};

const currentTotal = allocationRows.reduce((sum, row) => sum + Number(row.current_allocation_yen || 0), 0);
const greenTotal = allocationRows.reduce((sum, row) => sum + Number(row.all_pass_allocation_yen || 0), 0);
const yellowTotal = allocationRows.reduce((sum, row) => sum + Number(row.attention_allocation_yen || 0), 0);
const redTotal = allocationRows.reduce((sum, row) => sum + Number(row.bad_event_allocation_yen || 0), 0);

const scenarioNow = scenarioRows.find((row) => row.scenario === "現在") ?? {};
const overallStatus = counts.悪化 > 0
  ? "停止"
  : counts.未入力 > 0
    ? "停止: イベント未入力"
    : counts.注意 > 0
      ? "条件付き: 小比率のみ検討"
      : "通過後確認へ";

const overallReason = counts.悪化 > 0
  ? "悪化イベントがあるため、新規購入は停止します。"
  : counts.未入力 > 0
    ? `E02/E03/E04など未入力イベントが${counts.未入力}件あります。現時点では購入金額を確定しません。`
    : counts.注意 > 0
      ? "注意イベントが残るため、半導体・高PER・高ボラ銘柄は小比率または保留で扱います。"
      : "イベント入力はそろっています。本人操作、NISA口座区分、証券会社画面確認へ進みます。";

const gates = [
  {
    順番: "1",
    ゲート: "6月イベント入力",
    判定: counts.悪化 > 0 ? "停止" : counts.未入力 > 0 ? "未入力" : "入力済み",
    見るもの: "102_june_event_result_input.csv",
    通過条件: "E01〜E04が入力済み。悪化がない。",
    未通過時: "購入金額を確定しない。",
  },
  {
    順番: "2",
    ゲート: "資金配分",
    判定: currentTotal > 0 ? "配分あり" : "現時点0円",
    見るもの: "108_capital_allocation_by_ticker.csv / 109_capital_scenario_plan.csv",
    通過条件: "イベント判定に応じた上限が出ており、現在の上限が説明できる。",
    未通過時: "全銘柄を保留。緑通過時・黄注意時の上限だけ参考表示。",
  },
  {
    順番: "3",
    ゲート: "候補10社の扱い",
    判定: allocationRows.length === 10 ? "10社確認" : "件数要確認",
    見るもの: "106_june_event_engine_output.csv / 当日運用ボード",
    通過条件: "候補10社が中心候補・条件付き候補・保留に分類されている。",
    未通過時: "候補数や分類が崩れていれば注文票に進めない。",
  },
  {
    順番: "4",
    ゲート: "本人操作・NISA口座区分",
    判定: "手動確認必須",
    見るもの: "本人スマホ、本人ログイン、証券会社画面",
    通過条件: "本人が注文画面を開き、口座区分がNISA、数量・金額・残枠を確認する。",
    未通過時: "本人操作・NISA区分・残枠が未確認なら発注しない。",
  },
  {
    順番: "5",
    ゲート: "注文票・記録",
    判定: "手動確認必須",
    見るもの: "本人別注文票、運用記録CSV",
    通過条件: "購入理由、買わない条件、上値・下値ルール、次回確認日が残っている。",
    未通過時: "記録できない注文は行わない。",
  },
];

const eventRows = events.map((row) => ({
  ID: row.event_id,
  日程: row.planned_date,
  イベント: row.event,
  状態: row.current_status,
  入力状況: row.actual_value || "未入力",
  市場反応: row.market_reaction || "未入力",
  失敗時の扱い: row.action_if_fail,
}));

const candidateRows = allocationRows.map((row) => ({
  銘柄: `${row.ticker} ${row.name}`,
  役割: row.role,
  目標比率: pct(row.target_weight_pct),
  現在: row.market_signal,
  現在上限: yen(row.current_allocation_yen),
  緑通過時: yen(row.all_pass_allocation_yen),
  黄注意時: yen(row.attention_allocation_yen),
  確認条件: row.condition_to_use,
}));

const actionRows = [
  {
    時点: "6/15〜6/16",
    作業: "日銀会合後の入力",
    内容: "ドル円、日経平均/TOPIX、銀行・商社・輸出株の反応をE02へ入力。",
    止める条件: "急な円高、指数大幅下落、日本株全体のリスクオフ。",
  },
  {
    時点: "6/16〜6/17",
    作業: "FOMC後の入力",
    内容: "米10年金利、NASDAQ、SOX、ドル円の反応をE03へ入力。",
    止める条件: "米長期金利急騰、NASDAQ/SOX急落、高PER株売り。",
  },
  {
    時点: "6/18以降",
    作業: "最終購入前確認",
    内容: "候補別株価、PER/PBR/ROE、直近下落率、未確認データ、証券会社画面をE04へ入力。",
    止める条件: "未確認データを点数に混ぜる必要がある、本人操作やNISA区分が未確認。",
  },
  {
    時点: "入力後",
    作業: "CSV正本反映",
    内容: "102_june_event_result_input_to_apply.csvを反映補助で検査し、102正本へ反映。",
    止める条件: "列名不一致、E01〜E04欠落、状態分類の不正、悪化イベント。",
  },
  {
    時点: "反映後",
    作業: "注文票へ進むか判定",
    内容: "この最終検査ボード、資金配分、当日運用ボードを確認する。",
    止める条件: "現在上限0円、本人操作未確認、注文票未作成。",
  },
];

const manualRows = [
  { 確認欄: "□", 項目: "本人スマホ・本人ログイン", 内容: "本人が自分の端末で証券会社アプリまたはWebにログインする。" },
  { 確認欄: "□", 項目: "NISA口座区分", 内容: "注文画面で口座区分がNISAになっていることを本人が確認する。" },
  { 確認欄: "□", 項目: "NISA残枠", 内容: "注文予定金額が年間枠・成長投資枠・残枠を超えていないことを確認する。" },
  { 確認欄: "□", 項目: "注文内容", 内容: "銘柄、数量、概算金額、成行/指値、手数料、受渡日を確認する。" },
  { 確認欄: "□", 項目: "買わない条件", 内容: "当日急落、イベント悪化、候補別停止条件に該当しないか確認する。" },
  { 確認欄: "□", 項目: "記録", 内容: "購入理由、見送り理由、次回確認日を運用記録に残す。" },
];

const csvRows = [
  { section: "summary", item: "overall_status", status: overallStatus, value: yen(currentTotal), note: overallReason },
  { section: "summary", item: "pending_events", status: String(counts.未入力), value: "", note: "未入力が残る間は購入金額を確定しない。" },
  { section: "summary", item: "attention_events", status: String(counts.注意), value: "", note: "注意が残る場合は小比率または保留。" },
  { section: "summary", item: "green_initial_upper", status: "参考", value: yen(greenTotal), note: "全イベント確認後のみ使う上限。" },
  { section: "summary", item: "yellow_initial_upper", status: "参考", value: yen(yellowTotal), note: "注意が残る場合の保守上限。" },
  ...gates.map((row) => ({ section: "gate", item: row.ゲート, status: row.判定, value: row.見るもの, note: row.未通過時 })),
  ...candidateRows.map((row) => ({ section: "candidate", item: row.銘柄, status: row.現在, value: row.現在上限, note: row.確認条件 })),
];
writeCsv(CSV_FILE, ["section", "item", "status", "value", "note"], csvRows);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月18日以降 購入前・最終検査ボード</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--amber:#a85b00;--red:#a01818;--green:#116b4f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;line-height:1.7;font-size:18px}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);line-height:1.2;letter-spacing:0}
    header p{margin:0;color:#fff;font-weight:900}
    main{max-width:1440px;margin:0 auto;padding:22px}
    section{background:#fff;border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:25px}
    .notice{border-left:8px solid var(--amber);background:#fff7e7;padding:14px 16px;border-radius:10px;font-weight:900;color:#111;margin:0 0 14px}
    .notice.bad{border-left-color:var(--red);background:#fff1f1}
    .notice.ok{border-left-color:var(--green);background:#effaf5}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px;min-height:112px}
    .card b{display:block;color:var(--navy);font-size:15px;margin-bottom:4px}
    .card strong{display:block;font-size:28px;color:var(--blue);line-height:1.2}
    .card span{display:block;font-size:14px;font-weight:800;color:#41566c;margin-top:6px}
    .links{display:flex;flex-wrap:wrap;gap:10px;margin-top:14px}
    .links a{display:inline-flex;align-items:center;min-height:44px;text-decoration:none;border:1px solid #78acd2;color:#06436d;background:#fff;border-radius:9px;padding:9px 15px;font-weight:900}
    .table-wrap{width:100%;overflow-x:auto;border:1px solid var(--line);border-radius:10px}
    table{border-collapse:collapse;width:100%;min-width:980px;background:#fff}
    th,td{border-bottom:1px solid var(--line);border-right:1px solid var(--line);padding:10px 11px;text-align:left;vertical-align:top;overflow-wrap:anywhere}
    th{background:#e5f1fb;color:var(--navy);font-weight:900}
    tr:last-child td{border-bottom:0}
    th:last-child,td:last-child{border-right:0}
    .pill{display:inline-block;border-radius:999px;padding:3px 9px;color:#fff;font-weight:900;font-size:14px;background:#50677c}
    .pill.bad{background:var(--red)}
    .pill.warn{background:var(--amber)}
    .pill.ok{background:var(--green)}
    @media(max-width:860px){main{padding:12px}.cards{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:#fff;font-size:13px}header{padding:18px 22px}section{box-shadow:none;border-radius:0;break-inside:avoid}.links{display:none}.table-wrap{overflow:visible}table{min-width:0;font-size:11px}th,td{padding:6px}}
  </style>
</head>
<body>
<header>
  <h1>6月18日以降 購入前・最終検査ボード</h1>
  <p>作成: ${esc(generatedAt)} / イベント、候補10社、資金配分、本人操作、NISA口座区分、記録がそろうまで発注へ進まないための実務画面です。</p>
</header>
<main>
  <section>
    <h2>現在の結論</h2>
    <p class="notice ${overallStatus.startsWith("停止") ? "bad" : overallStatus.startsWith("通過") ? "ok" : ""}">${esc(overallStatus)}。${esc(overallReason)}</p>
    <div class="cards">
      <div class="card"><b>現時点の投入上限</b><strong>${esc(yen(currentTotal))}</strong><span>${esc(scenarioNow.action || "イベント未入力中")}</span></div>
      <div class="card"><b>未入力イベント</b><strong>${counts.未入力}件</strong><span>E02/E03/E04が残る間は停止</span></div>
      <div class="card"><b>緑通過時の参考上限</b><strong>${esc(yen(greenTotal))}</strong><span>全イベント確認後のみ</span></div>
      <div class="card"><b>黄注意時の参考上限</b><strong>${esc(yen(yellowTotal))}</strong><span>注意が残る場合の保守上限</span></div>
    </div>
    <div class="links">
      <a href="post_0618_event_csv_apply_helper_20260613.html">CSV正本反映補助</a>
      <a href="post_0618_event_update_runbook_20260613.html">CSV反映ランブック</a>
      <a href="post_0618_operation_board_20260613.html">当日運用ボード</a>
      <a href="capital_allocation_plan.html">資金配分</a>
      <a href="${CSV_FILE}">検査結果CSV</a>
    </div>
  </section>

  <section>
    <h2>最終ゲート</h2>
    ${table(["順番", "ゲート", "判定", "見るもの", "通過条件", "未通過時"], gates, { "順番": "6%", "ゲート": "16%", "判定": "12%", "見るもの": "20%" })}
  </section>

  <section>
    <h2>イベント入力状況</h2>
    ${table(["ID", "日程", "イベント", "状態", "入力状況", "市場反応", "失敗時の扱い"], eventRows, { "ID": "7%", "日程": "14%", "状態": "10%" })}
  </section>

  <section>
    <h2>候補10社と投入上限</h2>
    ${table(["銘柄", "役割", "目標比率", "現在", "現在上限", "緑通過時", "黄注意時", "確認条件"], candidateRows, { "銘柄": "17%", "役割": "12%", "現在上限": "10%" })}
  </section>

  <section>
    <h2>6/18以降の操作順</h2>
    ${table(["時点", "作業", "内容", "止める条件"], actionRows, { "時点": "12%", "作業": "18%" })}
  </section>

  <section>
    <h2>本人操作・注文前チェック</h2>
    <p class="notice">この欄は自動判定ではありません。発注前に、本人が証券会社画面で確認する項目です。ここが埋まらない場合は、イベントが通過していても注文に進みません。</p>
    ${table(["確認欄", "項目", "内容"], manualRows, { "確認欄": "8%", "項目": "22%" })}
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, HTML_FILE), html, "utf8");

insertCardAfter(
  "index.html",
  "post_0618_operation_board_20260613.html",
  `<a class="card" href="${HTML_FILE}">
          <b>6月18日以降 購入前・最終検査ボード</b>
          <span>イベント、候補10社、資金配分、本人操作、NISA区分、記録がそろうまで止める直前検査。</span>
        </a>`,
  HTML_FILE,
);

insertCardAfter(
  "896_practical_entry_hub_20260606.html",
  "post_0618_operation_board_20260613.html",
  `<a class="link-card" href="${HTML_FILE}">
          <b>6月18日以降 購入前・最終検査ボード</b>
          <span>イベント、候補10社、資金配分、本人操作、NISA区分、記録がそろうまで止める直前検査。</span>
        </a>`,
  HTML_FILE,
);

console.log(`generated ${HTML_FILE}`);
console.log(`generated ${CSV_FILE}`);
