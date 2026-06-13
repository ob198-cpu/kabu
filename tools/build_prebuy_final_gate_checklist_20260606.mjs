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

const gateRows = [
  {
    gate: "市場イベント確認",
    required: "6月CPI、日銀会合、FOMC後の金利・為替・指数反応を確認する。",
    pass: "CPI悪化、米金利急騰、急な円高、NASDAQ/SOX急落が同時に出ていない。",
    fail: "赤判定なら購入判断停止。黄判定なら個別株比率を落として保守判定へ。",
    output: "6月イベント判定エンジン",
  },
  {
    gate: "候補10社の根拠確認",
    required: "量的スコア、質的テーマ、長期安定性、最大下落率、同業比較を確認する。",
    pass: "採点根拠が説明でき、未取得データが中心候補の致命点になっていない。",
    fail: "根拠不足の銘柄は条件付き、補欠、監視へ下げる。",
    output: "最終10社 判定ワークベンチ",
  },
  {
    gate: "公式決算・指標確認",
    required: "売上、利益、EPS、PER/PBR/ROE、決算後反応の確認状況を確認する。",
    pass: "公式資料または信頼できるデータで確認済み。未確認値を点数に混ぜない。",
    fail: "未確認データが重要項目なら購入候補にしない。",
    output: "候補10社 最終確定ロジック",
  },
  {
    gate: "配分・資金管理",
    required: "1口座240万円の予算、現金待機率、個別株上限、銘柄別上限を確認する。",
    pass: "市場ゲートに応じた上限内。1銘柄集中やテーマ偏重を避けている。",
    fail: "上限超過なら購入金額を下げる。テーマ偏重ならチャンネル別に分散する。",
    output: "現時点 判定スナップショット",
  },
  {
    gate: "上値・下値ルール",
    required: "共通ルールと銘柄別補正を確認する。",
    pass: "5%下落、10%下落、決算前後、指数劣後時の扱いが表に残っている。",
    fail: "途中決済・保留・追加確認のルールがない銘柄は購入判断に進めない。",
    output: "売買ルール・運用表",
  },
  {
    gate: "NISA口座・本人操作",
    required: "本人名義口座、本人ログイン、本人操作、NISA枠、注文口座区分を確認する。",
    pass: "本人が証券会社画面で最終確認し、口座区分がNISAであることを確認できる。",
    fail: "本人操作・口座区分・NISA枠が未確認なら購入停止。",
    output: "NISA口座運用ハブ",
  },
  {
    gate: "税制レイヤー",
    required: "NISA向き、課税口座向き、配当、外国税、損益通算不可を確認する。",
    pass: "税制上の注意が表示され、NISA損失を損益通算できるように扱っていない。",
    fail: "税制確認が必要な銘柄は表示のみ。税務判断として扱わない。",
    output: "税制確認 Phase 1",
  },
  {
    gate: "記録・検証",
    required: "予想、購入理由、買わない条件、購入後の実績を記録する。",
    pass: "購入前に期待、リスク、比較指数、撤退条件が記録されている。",
    fail: "記録できない場合はテストの意味が薄くなるため購入判断を保留する。",
    output: "運用記録CSV",
  },
];

const actionRows = [
  ["6/6〜6/9", "候補と根拠の最終整理", "候補10社、3チャンネル、未確認データ、売買ルールを確認する。", "購入はしない。"],
  ["6/10", "米CPI確認", "金利・為替・NASDAQ/SOX・VIXの反応を入力する。", "赤なら購入判断停止。黄なら保守判定。"],
  ["6/15〜6/16", "日銀会合確認", "円高、国内金利、銀行・商社・半導体への影響を見る。", "急な円高や指数割れなら個別株比率を下げる。"],
  ["6/16〜6/17", "FOMC確認", "米金利、NASDAQ、SOX、VIXの反応を見る。", "金利急騰なら半導体・AI系の比率を抑える。"],
  ["6/18以降", "一次再判定", "市場ゲートと候補ゲートを両方確認する。", "緑なら候補別に小さく実行検討。黄なら保守配分。赤なら停止。"],
  ["購入後", "検証開始", "予想と実績の差、指数との差、下落時対応を記録する。", "S&P500/TOPIXに劣後する場合は個別株比率を見直す。"],
];

const decisionRows = [
  ["緑", "市場イベントを大きな悪化なく通過", "候補10社のうち中心候補を優先。個別上限と現金待機を守る。"],
  ["黄", "一部リスクあり、またはデータ未確認が残る", "個別株比率を落とし、条件付き候補と補欠中心にする。"],
  ["赤", "CPI悪化、金利急騰、急円高、指数急落など", "購入判断停止。監視とデータ更新だけ行う。"],
  ["銘柄別赤", "下方修正、決算後反応悪化、説明不能な高PERなど", "その銘柄は除外または監視へ落とす。ほかの銘柄で埋めない。"],
];

const gateHtml = gateRows.map((row, index) => `
  <tr>
    <td><b>${index + 1}</b></td>
    <td><b>${esc(row.gate)}</b></td>
    <td>${esc(row.required)}</td>
    <td>${esc(row.pass)}</td>
    <td>${esc(row.fail)}</td>
    <td>${esc(row.output)}</td>
  </tr>
`).join("");

const actionHtml = actionRows.map((row) => `
  <tr>
    <td><b>${esc(row[0])}</b></td>
    <td>${esc(row[1])}</td>
    <td>${esc(row[2])}</td>
    <td>${esc(row[3])}</td>
  </tr>
`).join("");

const decisionHtml = decisionRows.map((row) => `
  <tr>
    <td><span class="pill">${esc(row[0])}</span></td>
    <td>${esc(row[1])}</td>
    <td>${esc(row[2])}</td>
  </tr>
`).join("");

const csvRows = [
  ["section", "item", "required", "pass_condition", "fail_action", "output"],
  ...gateRows.map((row) => ["gate", row.gate, row.required, row.pass, row.fail, row.output]),
  ...actionRows.map((row) => ["schedule", row[0], row[1], row[2], row[3], ""]),
  ...decisionRows.map((row) => ["decision", row[0], row[1], row[2], "", ""]),
];

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>購入前 最終ゲートチェック</title>
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
    .links a{display:inline-block;margin:6px 8px 0 0;background:var(--blue);color:white;text-decoration:none;border-radius:8px;padding:9px 12px;font-weight:900}
    table{width:100%;border-collapse:collapse;table-layout:fixed}
    th,td{border:1px solid var(--line);padding:9px;vertical-align:top;overflow-wrap:anywhere;color:#111}
    th{background:#e5f1fb;color:var(--navy);text-align:left;font-weight:900}
    tr{break-inside:avoid}
    .pill{display:inline-block;background:var(--navy);color:white;border-radius:999px;padding:4px 10px;font-weight:900}
    .red{color:var(--red);font-weight:900}
    .green{color:var(--green);font-weight:900}
    @media(max-width:980px){main{padding:12px}table{font-size:14px}}
  </style>
</head>
<body>
<header>
  <h1>購入前 最終ゲートチェック</h1>
  <p>作成: ${esc(generatedAt)} / 候補が見えても、購入判断に進む前に確認する項目を一枚にまとめた実務用ページです。</p>
</header>
<main>
  <section>
    <h2>1. このページの目的</h2>
    <p class="notice">このページは購入確定用ではありません。6月イベント後に、候補10社・市場環境・NISA口座・税制・記録の確認がそろっているかを確認するための最終ゲートです。</p>
    <div class="links">
      <a href="909_final10_current_snapshot_20260606.html">現時点 判定スナップショット</a>
      <a href="908_final10_decision_workbench_20260606.html">最終10社 判定ワークベンチ</a>
      <a href="895_june_execution_cockpit_20260606.html">6月実行コックピット</a>
      <a href="910_prebuy_final_gate_checklist_20260606.csv">CSV</a>
    </div>
  </section>

  <section>
    <h2>2. 購入前ゲート</h2>
    <table>
      <thead><tr><th style="width:46px">No</th><th style="width:150px">ゲート</th><th>確認すること</th><th>通過条件</th><th>通過しない場合</th><th style="width:160px">確認先</th></tr></thead>
      <tbody>${gateHtml}</tbody>
    </table>
  </section>

  <section>
    <h2>3. 日付入り作業予定</h2>
    <table>
      <thead><tr><th style="width:120px">日程</th><th style="width:170px">作業</th><th>内容</th><th>扱い</th></tr></thead>
      <tbody>${actionHtml}</tbody>
    </table>
  </section>

  <section>
    <h2>4. 最終分岐</h2>
    <table>
      <thead><tr><th style="width:90px">判定</th><th>状態</th><th>実行方針</th></tr></thead>
      <tbody>${decisionHtml}</tbody>
    </table>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "910_prebuy_final_gate_checklist_20260606.csv"), `\uFEFF${csvRows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`, "utf8");
fs.writeFileSync(path.join(ROOT, "910_prebuy_final_gate_checklist_20260606.html"), html, "utf8");

console.log("wrote 910_prebuy_final_gate_checklist_20260606.html");
console.log("wrote 910_prebuy_final_gate_checklist_20260606.csv");
