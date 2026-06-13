import {
  esc,
  generatedAt,
  insertCardAfter,
  readCsv,
  table,
  writeCsv,
} from "./lib/report_utils_20260613.mjs";

const CSV_FILE = "candidate10_partial_resolution_20260613.csv";
const HTML_FILE = "candidate10_partial_resolution_20260613.html";

const allocation = readCsv("108_capital_allocation_by_ticker.csv");
const workbench = readCsv("908_final10_decision_workbench_20260606.csv");
const engine = readCsv("106_june_event_engine_output.csv");
const reaction = readCsv("candidate10_reaction_backfill_20260613.csv");
const events = readCsv("102_june_event_result_input.csv");

const workbenchByTicker = new Map(workbench.map((row) => [row.ticker, row]));
const engineByTicker = new Map(engine.map((row) => [row.ticker, row]));
const reactionByTicker = new Map(reaction.map((row) => [row.ticker, row]));

const fieldLabels = {
  default_data: "価格・出来高データ",
  default_financial: "財務・公式決算",
  default_reaction: "決算後反応",
  default_theme: "テーマ適合",
  default_risk: "リスク・下落耐性",
  default_tax: "NISA・税制・本人操作",
};

const fieldMeaning = {
  default_data: "最新株価、出来高、指数差、短期過熱の確認。partialの場合は、6/18以降の最新値で再確認する。",
  default_financial: "公式決算、PER/PBR/ROE、セグメント寄与、受注・利益率の確認。partialの場合は、注文票に未確認範囲を明記する。",
  default_reaction: "決算後1日・5日・20営業日の対日経平均反応。現在は10社すべて20営業日到達済み。",
  default_theme: "半導体、AIインフラ、金融、商社、フィジカルAIなどの時流仮説。現在候補10社はテーマ分類済み。",
  default_risk: "最大下落、ボラティリティ、イベント後の急落、指数劣後、ストップ安・大幅下落時の対応確認。",
  default_tax: "NISA口座区分、本人スマホ、本人ログイン、本人操作、NISA枠、配当受取方式の確認。",
};

function value(row, key) {
  return row?.[key] || "missing";
}

function partialFields(wb) {
  return Object.keys(fieldLabels).filter((field) => value(wb, field) !== "pass");
}

function actionFor(field, row, wb, engineRow, reactionRow) {
  if (field === "default_data") {
    return "6/18以降に最新株価、5日/20日騰落、出来高、日経平均・TOPIXとの差を確認する。急騰直後または指数より弱い場合は小口または保留。";
  }
  if (field === "default_financial") {
    return "公式決算短信・IRでPER/PBR/ROE、営業利益率、受注・セグメント寄与を確認する。確認できない項目は推測で点数化しない。";
  }
  if (field === "default_reaction") {
    return reactionRow?.reaction_status === "20営業日到達"
      ? `20営業日反応は接続済み。反応点 ${reactionRow.reaction_score} 点を補助材料として扱う。`
      : "20営業日反応が未到達なら、購入判断では補完待ちとして扱う。";
  }
  if (field === "default_theme") {
    return "テーマは単独加点しない。売上・受注・利益率・株価反応のいずれかで裏付けがある場合だけ補助評価に使う。";
  }
  if (field === "default_risk") {
    return `${engineRow?.stop_condition || row.max_position_note || "イベント後の下落条件を確認する。"} 6/18以降に米金利、為替、日経平均、関連指数の悪化があれば保留。`;
  }
  if (field === "default_tax") {
    return "本人名義のNISA口座、本人スマホ、本人ログイン、本人操作、注文画面の口座区分、NISA残枠、配当金受取方式を確認する。未確認なら購入しない。";
  }
  return "最終確認で説明を残す。";
}

function severity(field) {
  if (field === "default_tax") return "停止条件";
  if (field === "default_risk") return "重要";
  if (field === "default_financial") return "重要";
  if (field === "default_data") return "確認";
  return "補助";
}

function orderAction(row, wb, partials) {
  const taxOpen = partials.includes("default_tax");
  const riskOpen = partials.includes("default_risk");
  const financialOpen = partials.includes("default_financial");
  if (taxOpen) return "NISA・本人操作の確認が終わるまで注文不可";
  if (riskOpen || financialOpen) return "6/18以降の最終確認後に小口判断";
  return row.role === "中心候補" ? "イベント通過後に中心候補として検討" : "イベント通過後に小口候補として検討";
}

const detailRows = allocation.flatMap((row) => {
  const wb = workbenchByTicker.get(row.ticker);
  const engineRow = engineByTicker.get(row.ticker);
  const reactionRow = reactionByTicker.get(row.ticker);
  const partials = partialFields(wb);
  return partials.map((field) => ({
    updated_at: generatedAt,
    ticker: row.ticker,
    name: row.name,
    role: row.role,
    target_weight_pct: row.target_weight_pct,
    remaining_item: fieldLabels[field],
    status: value(wb, field),
    severity: severity(field),
    order_action: orderAction(row, wb, partials),
    confirmation: actionFor(field, row, wb, engineRow, reactionRow),
  }));
});

const summaryRows = allocation.map((row) => {
  const wb = workbenchByTicker.get(row.ticker);
  const partials = partialFields(wb);
  const passCount = Object.keys(fieldLabels).filter((field) => value(wb, field) === "pass").length;
  const critical = partials.filter((field) => ["default_tax", "default_risk", "default_financial"].includes(field));
  return {
    updated_at: generatedAt,
    ticker: row.ticker,
    name: row.name,
    role: row.role,
    pass_count: passCount,
    partial_count: partials.length,
    remaining_items: partials.map((field) => fieldLabels[field]).join(" / "),
    order_action: orderAction(row, wb, partials),
    critical_open_count: critical.length,
  };
});

writeCsv(CSV_FILE, [
  "updated_at",
  "ticker",
  "name",
  "role",
  "target_weight_pct",
  "remaining_item",
  "status",
  "severity",
  "order_action",
  "confirmation",
], detailRows);

const htmlSummaryRows = summaryRows.map((row) => ({
  銘柄: `${row.ticker} ${row.name}`,
  役割: row.role,
  "pass": `${row.pass_count}/6`,
  "残り": `${row.partial_count}項目`,
  "残項目": row.remaining_items,
  "注文前の扱い": row.order_action,
}));

const htmlDetailRows = detailRows.map((row) => ({
  銘柄: `${row.ticker} ${row.name}`,
  残項目: row.remaining_item,
  重要度: row.severity,
  扱い: row.order_action,
  確認内容: row.confirmation,
}));

const metricCards = [
  { label: "対象", value: `${allocation.length}社`, note: "現行候補10社" },
  { label: "決算反応", value: "10社接続", note: "20営業日反応まで確認済み" },
  { label: "注文可否", value: "まだ0円", note: "6/18以降のイベント・本人操作確認まで購入しない" },
  { label: "残る性質", value: "実務確認", note: "リスク、税制、口座、財務補足を注文票で確認" },
];

const fieldGuide = Object.entries(fieldLabels).map(([key, label]) => ({
  項目: label,
  意味: fieldMeaning[key],
}));

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 注文前未解決項目チェック</title>
  <style>
    :root { --ink:#061827; --navy:#103b60; --blue:#0b67a3; --line:#c9dceb; --bg:#f4f8fb; --paper:#fff; --warn:#a85b00; --red:#b42318; --green:#116b4f; }
    * { box-sizing: border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif; font-size:18px; line-height:1.75; }
    header { background:linear-gradient(135deg,#103b60,#0b67a3); color:#fff; padding:30px; }
    header h1 { margin:0 0 8px; font-size:clamp(30px,4vw,42px); line-height:1.2; letter-spacing:0; }
    header p { margin:0; font-weight:800; }
    main { max-width:1500px; margin:0 auto; padding:22px; }
    section { background:var(--paper); border:1px solid var(--line); border-radius:12px; padding:18px; margin:0 0 18px; box-shadow:0 8px 20px rgba(20,60,90,.08); }
    h2 { margin:0 0 12px; border-left:8px solid var(--blue); padding-left:12px; color:var(--navy); font-size:25px; }
    .cards { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .card { border:1px solid var(--line); border-radius:10px; background:#fbfdff; padding:14px; }
    .card b { display:block; color:var(--navy); font-size:15px; }
    .card strong { display:block; font-size:29px; line-height:1.25; color:var(--blue); }
    .notice { border-left:8px solid var(--warn); background:#fff7e7; border-radius:10px; padding:14px 16px; font-weight:900; margin:0 0 14px; }
    .ok { color:var(--green); font-weight:900; }
    .bad { color:var(--red); font-weight:900; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; margin-top:10px; }
    table { width:100%; border-collapse:collapse; table-layout:auto; background:#fff; }
    th,td { border:1px solid var(--line); padding:10px 12px; vertical-align:top; overflow-wrap:anywhere; word-break:normal; }
    th { background:#e7f2fb; color:#06395f; text-align:left; font-weight:900; }
    a { color:#005f99; font-weight:900; }
    @media (max-width:900px){ .cards{grid-template-columns:1fr 1fr;} body{font-size:16px;} }
    @media print{ body{background:#fff;} header,section{break-inside:avoid; box-shadow:none;} .table-wrap{overflow:visible;} }
  </style>
</head>
<body>
<header>
  <h1>候補10社 注文前未解決項目チェック</h1>
  <p>作成: ${esc(generatedAt)} / 「何が未解決で、何を確認すれば注文へ進めるか」を銘柄別に整理した画面です。</p>
</header>
<main>
  <section>
    <div class="cards">${metricCards.map((card) => `<div class="card"><b>${esc(card.label)}</b><strong>${esc(card.value)}</strong><span>${esc(card.note)}</span></div>`).join("")}</div>
  </section>

  <section>
    <h2>結論</h2>
    <p class="notice">現時点では購入上限は0円のままです。候補10社の決算後反応は接続済みですが、6/18以降の市場イベント、本人操作、NISA口座区分、銘柄別リスク確認が終わるまで注文金額は確定しません。</p>
    <p>この画面は、未解決項目を「なんとなく注意」ではなく、注文前に確認する作業へ変換するためのものです。未確認値を推測で点数に混ぜる扱いはしません。</p>
  </section>

  <section>
    <h2>10社の残項目サマリー</h2>
    ${table(["銘柄", "役割", "pass", "残り", "残項目", "注文前の扱い"], htmlSummaryRows, { widths: { 銘柄: "18%", 残項目: "30%", "注文前の扱い": "24%" } })}
  </section>

  <section>
    <h2>銘柄別に確認すること</h2>
    ${table(["銘柄", "残項目", "重要度", "扱い", "確認内容"], htmlDetailRows, { widths: { 銘柄: "16%", 残項目: "12%", 重要度: "9%", 扱い: "22%" } })}
  </section>

  <section>
    <h2>項目の意味</h2>
    ${table(["項目", "意味"], fieldGuide, { widths: { 項目: "20%" } })}
  </section>

  <section>
    <h2>CSV</h2>
    <p><a href="${CSV_FILE}">候補10社 注文前未解決項目CSV</a></p>
  </section>
</main>
</body>
</html>
`;

await Promise.all([
  import("node:fs").then((fs) => fs.writeFileSync(HTML_FILE, html, "utf8")),
]);

const card = `<a class="card" href="${HTML_FILE}">
          <b>候補10社 注文前未解決項目</b>
          <span>残るpartialを銘柄別の注文前確認項目に変換した実務画面。</span>
        </a>`;

insertCardAfter("index.html", "candidate_selection_health_check_20260613.html", card, HTML_FILE);
insertCardAfter("896_practical_entry_hub_20260606.html", "candidate_selection_health_check_20260613.html", card.replace('class="card"', 'class="link-card"'), HTML_FILE);

console.log(`generated ${HTML_FILE}`);
console.log(`generated ${CSV_FILE}`);
