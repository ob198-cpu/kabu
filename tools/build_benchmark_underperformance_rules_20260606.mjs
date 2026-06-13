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

const reviewRules = [
  {
    timing: "購入前",
    compare: "候補10社の期待値が、S&P500・TOPIX・日経平均の想定値を+1%以上上回る説明になるか。",
    condition: "+1%以上の説明が成立しない",
    action: "個別株比率を上げない。指数投信・現金比率を増やし、候補は監視に戻す。",
    reason: "個別株を選ぶ手間とリスクを取る理由が弱くなるため。",
  },
  {
    timing: "1か月後",
    compare: "個別株ポートフォリオと、S&P500/TOPIX/日経平均のうち最も強い指数を比較。",
    condition: "指数に-3%以上劣後",
    action: "追加購入を停止し、劣後銘柄とテーマの原因を確認する。",
    reason: "短期ノイズもあるため即売却ではなく、追加を止めて原因を切り分ける。",
  },
  {
    timing: "3か月後",
    compare: "3か月リターン、最大下落率、決算後反応、指数との差を比較。",
    condition: "指数に-5%以上劣後、または説明不能な下落が複数銘柄で発生",
    action: "攻め枠の比率を下げ、中心候補と指数投信寄りに戻す。",
    reason: "テーマ仮説が機能していない可能性があるため。",
  },
  {
    timing: "6か月後",
    compare: "半年リターン、S&P500との差、TOPIXとの差、銘柄別寄与度を比較。",
    condition: "指数に-7%以上劣後、または+1%目標に届く根拠が消えた",
    action: "個別株比率を大きく引き下げる。残す銘柄は決算と株価反応で再選定する。",
    reason: "1年テストの途中でも、劣後が構造的なら損失拡大を防ぐ必要がある。",
  },
  {
    timing: "12か月後",
    compare: "年間リターンと、S&P500/TOPIX/日経平均の最強指数+1%を比較。",
    condition: "+1%目標を達成できない",
    action: "個別株比率を下げ、指数投信中心へ戻す。個別株は改善済みモデルで再テストする。",
    reason: "この運用の目的は、個別株選定で指数を上回ることだから。",
  },
];

// 「+1%」「-3%劣後」等の判定が人によってぶれないよう、測定方法を固定する。
const measurementDefs = [
  ["測定期間", "初回投入日(2026/06/18)から判定日までの同一期間で、ポートフォリオと指数を比較する。期間をずらした比較はしない。"],
  ["ポートフォリオリターン", "(判定日の評価額合計+期間中の受取配当-投入元本累計)÷投入元本累計。段階投入分も投入後は元本に含める。"],
  ["指数リターン", "同一期間の終値ベース騰落率。S&P500は円換算(期首・期末のドル円で換算)し、TOPIX・日経平均は円のまま使う。"],
  ["比較対象", "S&P500(円換算)・TOPIX・日経平均のうち、同一期間で最も騰落率が高い指数(最強指数)を基準にする。"],
  ["評価タイミング", "判定日の終値で評価する。日中値・気配値では判定しない。"],
  ["配当の扱い", "ポートフォリオ側は受取配当を含める。指数側は価格指数のままとし、その分ポートフォリオに有利なことを認識して判定する。"],
];

const actionLevels = [
  ["達成", "個別株が最強指数+1%以上", "継続。ただし過熱銘柄は利確・比率調整を検討。"],
  ["注意", "最強指数との差が0〜+1%未満", "個別株を選ぶ優位性が薄い。追加購入は慎重にする。"],
  ["劣後小", "最強指数に0〜-3%劣後", "記録と原因確認。追加購入は一時停止。"],
  ["劣後中", "最強指数に-3〜-7%劣後", "攻め枠を縮小し、指数・現金比率を増やす。"],
  ["劣後大", "最強指数に-7%以上劣後", "購入方針を見直し。個別株比率を大きく下げる。"],
];

const ruleRows = reviewRules.map((row) => `
  <tr>
    <td><b>${esc(row.timing)}</b></td>
    <td>${esc(row.compare)}</td>
    <td>${esc(row.condition)}</td>
    <td>${esc(row.action)}</td>
    <td>${esc(row.reason)}</td>
  </tr>
`).join("");

const levelRows = actionLevels.map((row) => `
  <tr>
    <td><b>${esc(row[0])}</b></td>
    <td>${esc(row[1])}</td>
    <td>${esc(row[2])}</td>
  </tr>
`).join("");

const measurementRows = measurementDefs.map((row) => `
  <tr>
    <td><b>${esc(row[0])}</b></td>
    <td>${esc(row[1])}</td>
  </tr>
`).join("");

const csvRows = [
  ["type", "timing_or_level", "compare_or_condition", "trigger", "action", "reason"],
  ...measurementDefs.map((row) => ["measurement_def", row[0], row[1], "", "", ""]),
  ...reviewRules.map((row) => ["review_rule", row.timing, row.compare, row.condition, row.action, row.reason]),
  ...actionLevels.map((row) => ["action_level", row[0], row[1], "", row[2], ""]),
];

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>指数劣後時の比率引き下げルール</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--amber:#a85b00;--red:#a01818;--green:#0b6b4f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;line-height:1.65}
    header{background:var(--navy);color:white;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);letter-spacing:0;line-height:1.2}
    header p{margin:0;color:white;font-weight:800}
    main{max-width:1480px;margin:0 auto;padding:22px}
    section{background:white;border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:24px}
    .notice{border-left:7px solid var(--amber);background:#fff7e7;color:#111;padding:12px 14px;margin:0 0 14px;font-weight:900;border-radius:8px}
    .links a,.btn{display:inline-block;margin:6px 8px 0 0;background:var(--blue);color:white;text-decoration:none;border:0;border-radius:8px;padding:9px 12px;font-weight:900;cursor:pointer}
    table{width:100%;border-collapse:collapse;table-layout:fixed}
    th,td{border:1px solid var(--line);padding:9px;vertical-align:top;overflow-wrap:anywhere;color:#111}
    th{background:#e5f1fb;color:var(--navy);text-align:left;font-weight:900}
    tr{break-inside:avoid}
    .calc{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:8px}
    label{font-weight:900;color:var(--navy)}
    input{width:100%;border:1px solid var(--line);border-radius:8px;padding:9px;font:inherit}
    .result{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:12px;margin-top:12px;font-weight:900}
    .red{color:var(--red)}.green{color:var(--green)}.amber{color:var(--amber)}
    @media(max-width:980px){main{padding:12px}table{font-size:14px}.calc{grid-template-columns:1fr}}
  </style>
</head>
<body>
<header>
  <h1>指数劣後時の比率引き下げルール</h1>
  <p>作成: ${esc(generatedAt)} / 目的である「指数より最低+1%以上」を購入後の運用ルールへ接続するページです。</p>
</header>
<main>
  <section>
    <h2>1. 目的</h2>
    <p class="notice">個別株を選ぶ意味は、S&P500投信・TOPIX・日経平均連動の無難な運用を上回る説明がある場合に限ります。劣後した場合は、感覚ではなくルールで個別株比率を下げます。</p>
    <div class="links">
      <a href="910_prebuy_final_gate_checklist_20260606.html">購入前 最終ゲート</a>
      <a href="914_daily_operation_flow_20260606.html">実用パート 運用フロー</a>
      <a href="913_gap_closure_tracker_20260606.html">不足点トラッカー</a>
      <a href="915_benchmark_underperformance_rules_20260606.csv">CSV</a>
    </div>
  </section>

  <section>
    <h2>2. 測定の定義</h2>
    <p class="notice">以下の定義で測定したリターン同士のみを比較します。期間・換算・配当の扱いを変えた比較は無効とします。</p>
    <table>
      <thead><tr><th style="width:170px">項目</th><th>定義</th></tr></thead>
      <tbody>${measurementRows}</tbody>
    </table>
  </section>

  <section>
    <h2>3. 確認タイミング別ルール</h2>
    <table>
      <thead><tr><th style="width:105px">時点</th><th>比較すること</th><th>発動条件</th><th>対応</th><th>理由</th></tr></thead>
      <tbody>${ruleRows}</tbody>
    </table>
  </section>

  <section>
    <h2>4. 判定レベル</h2>
    <table>
      <thead><tr><th style="width:100px">判定</th><th>条件</th><th>扱い</th></tr></thead>
      <tbody>${levelRows}</tbody>
    </table>
  </section>

  <section>
    <h2>5. 簡易判定 calculator</h2>
    <p class="notice">入力する数値は「2. 測定の定義」に従って算出した同一期間のリターン(%)です。</p>
    <div class="calc">
      <div><label>個別株%</label><input id="portfolio" type="number" step="0.1" value="0"></div>
      <div><label>S&P500%</label><input id="sp" type="number" step="0.1" value="0"></div>
      <div><label>TOPIX%</label><input id="topix" type="number" step="0.1" value="0"></div>
      <div><label>日経平均%</label><input id="nikkei" type="number" step="0.1" value="0"></div>
      <div><label>目標超過%</label><input id="target" type="number" step="0.1" value="1"></div>
    </div>
    <button class="btn" type="button" id="calcBtn">判定する</button>
    <div class="result" id="result">数値を入れて判定してください。</div>
  </section>
</main>
<script>
function judge(){
  const p = Number(document.getElementById("portfolio").value || 0);
  const sp = Number(document.getElementById("sp").value || 0);
  const topix = Number(document.getElementById("topix").value || 0);
  const nikkei = Number(document.getElementById("nikkei").value || 0);
  const target = Number(document.getElementById("target").value || 1);
  const best = Math.max(sp, topix, nikkei);
  const diff = p - best;
  const targetDiff = p - (best + target);
  let label = "達成";
  let cls = "green";
  let action = "継続。ただし過熱銘柄は利確・比率調整を検討。";
  if (targetDiff < 0 && diff >= 0) { label = "注意"; cls = "amber"; action = "指数には勝っているが目標未達。追加購入は慎重にする。"; }
  if (diff < 0 && diff >= -3) { label = "劣後小"; cls = "amber"; action = "記録と原因確認。追加購入は一時停止。"; }
  if (diff < -3 && diff >= -7) { label = "劣後中"; cls = "red"; action = "攻め枠を縮小し、指数・現金比率を増やす。"; }
  if (diff < -7) { label = "劣後大"; cls = "red"; action = "購入方針を見直し、個別株比率を大きく下げる。"; }
  document.getElementById("result").innerHTML = '<span class="'+cls+'">'+label+'</span> / 最強指数との差: ' + diff.toFixed(1) + '% / 目標との差: ' + targetDiff.toFixed(1) + '%<br>' + action;
}
document.getElementById("calcBtn").addEventListener("click", judge);
</script>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "915_benchmark_underperformance_rules_20260606.csv"), `\uFEFF${csvRows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`, "utf8");
fs.writeFileSync(path.join(ROOT, "915_benchmark_underperformance_rules_20260606.html"), html, "utf8");

console.log("wrote 915_benchmark_underperformance_rules_20260606.html");
console.log("wrote 915_benchmark_underperformance_rules_20260606.csv");
