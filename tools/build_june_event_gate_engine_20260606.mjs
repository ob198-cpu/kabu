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

const gateInputs = [
  {
    block: "米CPI",
    metric: "CPI前年比・前月比",
    beforeInput: "前回値または市場予想",
    afterInput: "6/10発表値",
    green: "前年比・前月比の両方で再加速が目立たない",
    yellow: "一部で再加速。ただし金利と株価反応が限定的",
    red: "総合・コアの両方で再加速し、金利または株価が悪化",
    reason: "CPI単独ではなく、金利と株価反応を合わせて見る。",
  },
  {
    block: "米金利",
    metric: "米10年金利 変化幅",
    beforeInput: "イベント前の米10年金利",
    afterInput: "イベント後の米10年金利",
    green: "+10bp未満",
    yellow: "+10bp以上 +20bp未満",
    red: "+20bp以上",
    reason: "高PER・半導体・AI関連は金利急騰に弱いため、攻め枠の停止条件に使う。",
  },
  {
    block: "半導体指数",
    metric: "SOX指数 イベント後下落率",
    beforeInput: "イベント前終値",
    afterInput: "イベント後終値",
    green: "-3%以内",
    yellow: "-3%超 -5%以内",
    red: "-5%超",
    reason: "半導体テーマを入れるかどうかの直接ゲート。",
  },
  {
    block: "米ハイテク",
    metric: "NASDAQ イベント後下落率",
    beforeInput: "イベント前終値",
    afterInput: "イベント後終値",
    green: "-2%以内",
    yellow: "-2%超 -4%以内",
    red: "-4%超",
    reason: "AI・半導体・フィジカルAIのリスク許容度を見る。",
  },
  {
    block: "恐怖指数",
    metric: "VIX",
    beforeInput: "イベント前VIX",
    afterInput: "イベント後VIX",
    green: "20未満、または急騰なし",
    yellow: "20以上25未満、または上昇が目立つ",
    red: "25以上、または急騰",
    reason: "全体のリスク回避が強い時は個別株比率を上げない。",
  },
  {
    block: "為替",
    metric: "ドル円 変化",
    beforeInput: "イベント前ドル円",
    afterInput: "イベント後ドル円",
    green: "急な円高なし",
    yellow: "円高方向に動くが指数下落は限定的",
    red: "急な円高と日本株下落が同時に出る",
    reason: "輸出・半導体・商社の短期反応に影響する。",
  },
  {
    block: "日本株指数",
    metric: "日経平均/TOPIX",
    beforeInput: "イベント前終値と75日線",
    afterInput: "イベント後終値",
    green: "75日線を大きく割らず、指数下落が限定的",
    yellow: "75日線近辺まで弱い",
    red: "75日線を明確に下回る、または高値から-10%以上",
    reason: "個別株の前に市場全体の購入環境を確認する。",
  },
  {
    block: "候補銘柄",
    metric: "候補別イベント後反応",
    beforeInput: "イベント前株価・出来高",
    afterInput: "イベント後株価・出来高",
    green: "指数より強い、出来高が伴う、決算・受注の説明がある",
    yellow: "指数並み、または説明材料が不足",
    red: "指数より弱い、急落、悪材料、未確認データが残る",
    reason: "テーマ全体が良くても、その銘柄が買われていなければ採用しない。",
  },
];

const engineRules = [
  {
    step: 1,
    rule: "赤が1つでも出た場合",
    result: "購入候補の追加を停止",
    action: "既存10社を維持、または個別株比率を下げる。攻め枠は入れない。",
    explanation: "6月の目的は無理に買うことではなく、イベント後のリスクを避けること。",
  },
  {
    step: 2,
    rule: "赤なし、黄が2つ以上",
    result: "保留",
    action: "テーマ候補を小比率以下に限定し、翌営業日以降の反応を再確認する。",
    explanation: "市場が完全に悪くない場合でも、不安定な条件が複数あるなら急がない。",
  },
  {
    step: 3,
    rule: "赤なし、黄が0〜1つ",
    result: "入れ替え検討へ進む",
    action: "候補別に、指数超過・下落耐性・決算後反応・事業寄与を既存10社と比較する。",
    explanation: "市場環境が許容範囲なら、銘柄側の確認に進める。",
  },
  {
    step: 4,
    rule: "候補銘柄が既存10社を上回る説明を持つ",
    result: "採用または小比率採用を検討",
    action: "入替前後、比率、採用理由、停止条件を記録する。",
    explanation: "候補を感覚で入れ替えず、比較理由を残す。",
  },
  {
    step: 5,
    rule: "候補銘柄の未確認データが購入判断に残る",
    result: "採用しない",
    action: "補完後候補または探索枠に戻す。",
    explanation: "未取得データを点数に混ぜないため。",
  },
];

const channelActions = [
  {
    channel: "半導体製造装置・材料",
    ifGreen: "SOX・米金利・候補別反応が緑なら、小比率の攻め枠として比較",
    ifYellow: "比率を抑える、または翌営業日まで保留",
    ifRed: "攻め枠は入れない",
  },
  {
    channel: "データセンター・電力・冷却・電線",
    ifGreen: "受注・利益率・指数差が確認できれば、既存10社との入れ替え候補",
    ifYellow: "既存10社を維持し、事業寄与の確認を優先",
    ifRed: "テーマ織り込み済みまたは急落リスクとして保留",
  },
  {
    channel: "フィジカルAI",
    ifGreen: "TDKのみ代表候補として比較。FA/ロボットは補完後",
    ifYellow: "TDKも小比率または保留。ファナック・キーエンス等は未採用",
    ifRed: "フィジカルAI枠は入れない",
  },
  {
    channel: "量子コンピューター",
    ifGreen: "監視継続。購入候補化はしない",
    ifYellow: "監視継続",
    ifRed: "監視のみ。購入候補とは分離",
  },
];

const inputTemplateRows = [
  {
    date: "2026-06-10",
    event: "米CPI",
    cpiYoY: "",
    cpiMoM: "",
    coreCpiYoY: "",
    coreCpiMoM: "",
    us10yBefore: "",
    us10yAfter: "",
    soxBefore: "",
    soxAfter: "",
    nasdaqBefore: "",
    nasdaqAfter: "",
    vixAfter: "",
    usdjpyBefore: "",
    usdjpyAfter: "",
    nikkeiBefore: "",
    nikkeiAfter: "",
    gateColor: "",
    note: "",
  },
  {
    date: "2026-06-15〜2026-06-16",
    event: "日銀会合",
    cpiYoY: "",
    cpiMoM: "",
    coreCpiYoY: "",
    coreCpiMoM: "",
    us10yBefore: "",
    us10yAfter: "",
    soxBefore: "",
    soxAfter: "",
    nasdaqBefore: "",
    nasdaqAfter: "",
    vixAfter: "",
    usdjpyBefore: "",
    usdjpyAfter: "",
    nikkeiBefore: "",
    nikkeiAfter: "",
    gateColor: "",
    note: "",
  },
  {
    date: "2026-06-16〜2026-06-17",
    event: "FOMC",
    cpiYoY: "",
    cpiMoM: "",
    coreCpiYoY: "",
    coreCpiMoM: "",
    us10yBefore: "",
    us10yAfter: "",
    soxBefore: "",
    soxAfter: "",
    nasdaqBefore: "",
    nasdaqAfter: "",
    vixAfter: "",
    usdjpyBefore: "",
    usdjpyAfter: "",
    nikkeiBefore: "",
    nikkeiAfter: "",
    gateColor: "",
    note: "",
  },
];

const esc = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");
const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
function toCsv(headers, rows) {
  return [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
}

const gateHeaders = ["block", "metric", "beforeInput", "afterInput", "green", "yellow", "red", "reason"];
const ruleHeaders = ["step", "rule", "result", "action", "explanation"];
const channelHeaders = ["channel", "ifGreen", "ifYellow", "ifRed"];
const templateHeaders = Object.keys(inputTemplateRows[0]);

const gateRowsHtml = gateInputs.map((row) => `
  <tr>
    <td><b>${esc(row.block)}</b></td>
    <td>${esc(row.metric)}</td>
    <td>${esc(row.beforeInput)}</td>
    <td>${esc(row.afterInput)}</td>
    <td><span class="ok">緑</span>${esc(row.green)}</td>
    <td><span class="warn">黄</span>${esc(row.yellow)}</td>
    <td><span class="stop">赤</span>${esc(row.red)}</td>
    <td>${esc(row.reason)}</td>
  </tr>
`).join("");

const ruleRowsHtml = engineRules.map((row) => `
  <tr>
    <td>${esc(row.step)}</td>
    <td>${esc(row.rule)}</td>
    <td><b>${esc(row.result)}</b></td>
    <td>${esc(row.action)}</td>
    <td>${esc(row.explanation)}</td>
  </tr>
`).join("");

const channelRowsHtml = channelActions.map((row) => `
  <tr>
    <td><b>${esc(row.channel)}</b></td>
    <td>${esc(row.ifGreen)}</td>
    <td>${esc(row.ifYellow)}</td>
    <td>${esc(row.ifRed)}</td>
  </tr>
`).join("");

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月イベント判定エンジン</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--ok:#0b6b4f;--warn:#a85b00;--stop:#a01818}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;line-height:1.7}
    header{background:var(--navy);color:white;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(28px,4vw,40px);letter-spacing:0;line-height:1.25}
    header p{margin:0;color:white;font-weight:800}
    main{max-width:1500px;margin:0 auto;padding:22px}
    section{background:white;border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:24px}
    .lead{border-left:7px solid #b76500;background:#fff7e7;color:#111;padding:12px 14px;margin:12px 0;font-weight:900;border-radius:8px}
    .cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;padding:13px;background:#fbfdff}
    .card b{display:block;color:var(--navy);font-size:16px}.card strong{display:block;font-size:26px;color:var(--blue)}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:white}
    table{width:100%;border-collapse:collapse;min-width:1300px;table-layout:fixed;font-size:13px}
    th,td{border:1px solid var(--line);padding:8px;vertical-align:top;overflow-wrap:anywhere;word-break:break-word;color:#111}
    th{background:#e5f1fa;color:#073b62;text-align:left;font-weight:900}
    .ok,.warn,.stop{display:inline-block;color:white;border-radius:999px;padding:2px 7px;margin-right:5px;font-weight:900;font-size:12px}
    .ok{background:var(--ok)}.warn{background:var(--warn)}.stop{background:var(--stop)}
    .links a{display:inline-block;margin:6px 8px 0 0;background:var(--blue);color:white;text-decoration:none;border-radius:8px;padding:9px 12px;font-weight:900}
    .small{font-size:13px;color:#26394a}
    @media(max-width:980px){main{padding:12px}.cards{grid-template-columns:1fr}table{min-width:1150px}}
  </style>
</head>
<body>
<header>
  <h1>6月イベント判定エンジン</h1>
  <p>作成: ${esc(generatedAt)} / CPI、日銀、FOMC後に「進む・保留・止める」を決めるための安全側ゲートです。</p>
</header>
<main>
  <section>
    <h2>1. 目的</h2>
    <p class="lead">このページは、利回りを予測するものではありません。6月の大きなイベント後に、個別株比率やテーマ枠を上げてよい環境かを判定するための停止ゲートです。未検証の固定係数で期待利回りを作るのではなく、実データで危険条件を確認します。</p>
    <div class="cards">
      <div class="card"><b>入力</b><strong>実データ</strong><span>CPI、金利、指数、為替、VIX</span></div>
      <div class="card"><b>判定</b><strong>緑・黄・赤</strong><span>進む、保留、停止</span></div>
      <div class="card"><b>出力</b><strong>アクション</strong><span>入替検討、保留、比率抑制</span></div>
    </div>
    <div class="links">
      <a href="893_june_event_gate_engine_20260606.csv">CSVを開く</a>
      <a href="892_june_event_actual_input_and_replacement_log_20260606.html">6月イベント後 実データ入力・入替記録</a>
      <a href="891_june_theme_execution_matrix_20260605.html">6月テーマ候補 実行判定表</a>
      <a href="index.html">ホームへ戻る</a>
    </div>
  </section>

  <section>
    <h2>2. 判定に使う入力項目</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th style="width:125px">分類</th><th style="width:160px">指標</th><th>イベント前入力</th><th>イベント後入力</th><th>緑</th><th>黄</th><th>赤</th><th>理由</th></tr>
        </thead>
        <tbody>${gateRowsHtml}</tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>3. 判定ロジック</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th style="width:60px">順</th><th>条件</th><th>結果</th><th>アクション</th><th>説明</th></tr></thead>
        <tbody>${ruleRowsHtml}</tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>4. テーマ別の扱い</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th style="width:240px">テーマ</th><th>緑の場合</th><th>黄の場合</th><th>赤の場合</th></tr></thead>
        <tbody>${channelRowsHtml}</tbody>
      </table>
    </div>
    <p class="small">しきい値は、購入を促すための期待値計算ではなく、イベント直後の過剰リスクを避けるための暫定運用ゲートです。運用後は予測と実績の差を記録し、必要に応じて見直します。</p>
  </section>
</main>
</body>
</html>`;

const csv = [
  "# gate_inputs",
  toCsv(gateHeaders, gateInputs),
  "",
  "# engine_rules",
  toCsv(ruleHeaders, engineRules),
  "",
  "# channel_actions",
  toCsv(channelHeaders, channelActions),
  "",
  "# input_template",
  toCsv(templateHeaders, inputTemplateRows),
].join("\n");

fs.writeFileSync(path.join(ROOT, "893_june_event_gate_engine_20260606.csv"), `\uFEFF${csv}\n`, "utf8");
fs.writeFileSync(path.join(ROOT, "893_june_event_gate_engine_20260606.html"), html, "utf8");

const link = '<a class="button secondary" href="893_june_event_gate_engine_20260606.html">6月イベント判定エンジン</a>';
for (const file of ["index.html", "practical_action_dashboard_20260528.html", "892_june_event_actual_input_and_replacement_log_20260606.html"]) {
  const filePath = path.join(ROOT, file);
  if (!fs.existsSync(filePath)) continue;
  let text = fs.readFileSync(filePath, "utf8");
  if (text.includes("893_june_event_gate_engine_20260606.html")) continue;
  if (text.includes("892_june_event_actual_input_and_replacement_log_20260606.html")) {
    text = text.replace(/(<a[^>]+href="892_june_event_actual_input_and_replacement_log_20260606\.html"[^>]*>.*?<\/a>)/s, `$1\n      ${link}`);
  } else if (text.includes("</section>")) {
    text = text.replace("</section>", `<div class="links">${link}</div></section>`);
  }
  fs.writeFileSync(filePath, text, "utf8");
}

console.log("wrote 893_june_event_gate_engine_20260606.html");
console.log("wrote 893_june_event_gate_engine_20260606.csv");
