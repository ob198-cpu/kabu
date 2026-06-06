import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date());

const esc = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const blocks = [
  {
    title: "今日見る",
    purpose: "市場が荒れていないか、候補の扱いを変える必要がないかを確認する。",
    action: "まず現時点スナップショットを確認し、必要なら不足点トラッカーを見る。",
    pages: [
      ["現時点 判定スナップショット", "909_final10_current_snapshot_20260606.html", "現時点の保守判定と緑通過後の仮判定を見る。"],
      ["不足点10項目 回収トラッカー", "913_gap_closure_tracker_20260606.html", "残っている不足点と、購入判断への影響を見る。"],
      ["実用ダッシュボード", "practical_action_dashboard_20260528.html", "全体入口に戻る。"],
    ],
    stop: "赤要素、未確認の必須データ、説明できない急落がある場合は購入判断へ進めない。",
  },
  {
    title: "イベント後に見る",
    purpose: "CPI・日銀・FOMC後の実数を入れて、緑・黄・赤を判定する。",
    action: "実数入力シートに数値と判断理由を入れ、イベント判定エンジンと照合する。",
    pages: [
      ["6月イベント 実数入力シート", "912_june_event_actual_input_sheet_20260606.html", "CPI・日銀・FOMC後の実数と理由を入力する。"],
      ["6月イベント判定エンジン", "893_june_event_gate_engine_20260606.html", "市場ゲートを緑・黄・赤に整理する。"],
      ["6月実行コックピット", "895_june_execution_cockpit_20260606.html", "イベント後に見る指標と停止条件を確認する。"],
    ],
    stop: "CPI悪化、米金利急騰、急な円高、NASDAQ/SOX急落が重なる場合は停止。",
  },
  {
    title: "購入前に見る",
    purpose: "候補・配分・NISA口座・税制・記録がそろっているか最終確認する。",
    action: "購入前ゲートを確認し、銘柄別アクション票で扱いを決める。",
    pages: [
      ["購入前 最終ゲートチェック", "910_prebuy_final_gate_checklist_20260606.html", "購入前に必要な確認がそろっているか確認する。"],
      ["購入準備 判定ボード", "916_purchase_readiness_board_20260606.html", "進める、保留、停止を一画面で確認する。"],
      ["候補10社 銘柄別アクション票", "911_ticker_action_tickets_20260606.html", "緑・黄判定時の扱い、停止条件、利確条件を見る。"],
      ["最終10社 判定ワークベンチ", "908_final10_decision_workbench_20260606.html", "確認状況を入れて中心候補・条件付き・補欠へ分類する。"],
      ["NISA口座運用ハブ", "882_nisa_account_operation_hub_20260605.html", "本人操作、口座区分、注文票を確認する。"],
    ],
    stop: "本人操作、NISA口座区分、購入金額、記録条件が未確認なら購入判断に進めない。",
  },
  {
    title: "記録する",
    purpose: "予想と実績の差を残し、S&P500/TOPIXに勝てているか検証する。",
    action: "購入理由、買わない条件、実績、指数との差、次回修正を記録する。",
    pages: [
      ["6月イベント後 実データ入力・入替記録", "892_june_event_actual_input_and_replacement_log_20260606.html", "実数と候補入替理由を記録する。"],
      ["指数劣後時の比率引き下げルール", "915_benchmark_underperformance_rules_20260606.html", "指数に劣後した場合の個別株比率調整を確認する。"],
      ["運用記録CSV", "https://raw.githubusercontent.com/ob198-cpu/kabu/main/operation_record_template_20260529.csv", "予想、実績、差分を記録するCSV。"],
      ["税制レイヤー Phase 1", "842_tax_aware_operation_layer_phase1_20260602.html", "NISA・課税口座・損益通算不可などの確認補助を見る。"],
    ],
    stop: "記録できない場合は、テストとしての検証価値が下がるため、購入後の評価に進めない。",
  },
];

const pageCards = (pages) => pages.map(([title, url, desc]) => `
  <a class="card" href="${esc(url)}">
    <b>${esc(title)}</b>
    <span>${esc(desc)}</span>
  </a>
`).join("");

const blockHtml = blocks.map((block, index) => `
  <section>
    <div class="flow-head">
      <span class="step">${index + 1}</span>
      <h2>${esc(block.title)}</h2>
    </div>
    <div class="cols">
      <div class="explain">
        <p><b>目的:</b> ${esc(block.purpose)}</p>
        <p><b>作業:</b> ${esc(block.action)}</p>
        <p class="stop"><b>止める条件:</b> ${esc(block.stop)}</p>
      </div>
      <div class="cards">${pageCards(block.pages)}</div>
    </div>
  </section>
`).join("");

const csvRows = [
  ["step", "category", "purpose", "action", "stop_condition", "page_title", "page_url", "page_description"],
  ...blocks.flatMap((block, index) => block.pages.map(([title, url, desc]) => [
    index + 1,
    block.title,
    block.purpose,
    block.action,
    block.stop,
    title,
    url,
    desc,
  ])),
];

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>実用パート 運用フロー</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--amber:#a85b00;--red:#a01818}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;line-height:1.65}
    header{background:var(--navy);color:white;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);letter-spacing:0;line-height:1.2}
    header p{margin:0;color:white;font-weight:800}
    main{max-width:1400px;margin:0 auto;padding:22px}
    section{background:white;border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0;color:var(--navy);font-size:25px}
    .notice{border-left:7px solid var(--amber);background:#fff7e7;color:#111;padding:12px 14px;margin:0 0 18px;font-weight:900;border-radius:8px}
    .flow-head{display:flex;align-items:center;gap:12px;margin-bottom:12px}
    .step{display:inline-grid;place-items:center;width:42px;height:42px;border-radius:50%;background:var(--blue);color:white;font-weight:900;font-size:21px}
    .cols{display:grid;grid-template-columns:minmax(260px,.85fr) minmax(420px,1.15fr);gap:14px}
    .explain{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .explain p{margin:0 0 10px}
    .stop{color:var(--red);font-weight:900}
    .cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
    .card{display:block;text-decoration:none;color:var(--ink);border:1px solid var(--line);border-radius:10px;background:#fff;padding:13px}
    .card:hover{border-color:var(--blue);box-shadow:0 0 0 2px rgba(11,103,163,.08) inset}
    .card b{display:block;color:var(--navy);font-size:16px;margin-bottom:4px}
    .card span{display:block;color:#263e55;font-size:13px;font-weight:800}
    .toplinks a{display:inline-block;margin:6px 8px 0 0;background:var(--blue);color:white;text-decoration:none;border-radius:8px;padding:9px 12px;font-weight:900}
    @media(max-width:980px){main{padding:12px}.cols,.cards{grid-template-columns:1fr}}
  </style>
</head>
<body>
<header>
  <h1>実用パート 運用フロー</h1>
  <p>作成: ${esc(generatedAt)} / ページが多い状態を、毎日使う順番に整理した入口です。</p>
</header>
<main>
  <p class="notice">迷ったらこの順番で確認します。今日見る、イベント後に見る、購入前に見る、記録する、の4段階に分けています。</p>
  <div class="toplinks">
    <a href="index.html">ホーム</a>
    <a href="practical_action_dashboard_20260528.html">実用ダッシュボード</a>
    <a href="914_daily_operation_flow_20260606.csv">CSV</a>
  </div>
  ${blockHtml}
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "914_daily_operation_flow_20260606.csv"), `\uFEFF${csvRows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`, "utf8");
fs.writeFileSync(path.join(ROOT, "914_daily_operation_flow_20260606.html"), html, "utf8");

console.log("wrote 914_daily_operation_flow_20260606.html");
console.log("wrote 914_daily_operation_flow_20260606.csv");
