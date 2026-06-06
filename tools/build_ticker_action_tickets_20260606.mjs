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

const channels = {
  total: "総合候補",
  semi: "半導体製造装置・材料",
  infra: "データセンター・電力・冷却・電線",
  physical: "フィジカルAI",
};

const tickers = [
  {
    ticker: "8053.T",
    name: "住友商事",
    channel: "total",
    role: "商社・資源・還元の総合候補",
    green: "少額から中心候補として検討。資源価格、円相場、株主還元方針を同時確認。",
    yellow: "保守候補。資源価格や商社全体が弱い場合は比率を下げる。",
    stop: "決算で利益見通し悪化、資源価格急落、日経平均/TOPIXより大きく劣後する場合は追加停止。",
    profit: "短期急騰時は一部利益確定を検討し、残りは1年保有テストで検証。",
    confirm: "PER/PBR/ROE、セグメント利益、株主還元、同業商社との比較。",
  },
  {
    ticker: "8316.T",
    name: "三井住友FG",
    channel: "total",
    role: "銀行・金利上昇耐性候補",
    green: "日銀後の金利環境が悪化していなければ中心候補として検討。",
    yellow: "金融政策が不明瞭なら小さく扱う。信用コスト増加の兆候を確認。",
    stop: "急な金利低下、信用コスト悪化、銀行株全体の下落が続く場合は追加停止。",
    profit: "銀行株全体が過熱し、短期で指数を大きく上回った場合は一部利益確定候補。",
    confirm: "利ざや、与信費用、自己資本、配当方針、日銀政策後の銀行指数反応。",
  },
  {
    ticker: "6503.T",
    name: "三菱電機",
    channel: "infra",
    role: "電力制御・FA・社会インフラ候補",
    green: "AIインフラ、電力制御、FA需要が崩れていなければ候補継続。",
    yellow: "設備投資関連が弱い場合は条件付き。決算確認後に扱う。",
    stop: "受注鈍化、利益率低下、FA関連の需要悪化が出る場合は追加停止。",
    profit: "電力・FAテーマで短期上昇が強い場合は、決算前に一部利確も検討。",
    confirm: "受注、営業利益率、FA・社会システムの伸び、同業比較。",
  },
  {
    ticker: "6857.T",
    name: "アドバンテスト",
    channel: "semi",
    role: "AI半導体検査装置候補",
    green: "SOX/NASDAQが崩れず、AI半導体需要が継続する場合のみ候補。",
    yellow: "高PER・高ボラを前提に小さく扱う。指数が弱い場合は保留。",
    stop: "米金利急騰、SOX急落、決算後反応悪化、高PER説明不能なら追加停止。",
    profit: "急騰時は利益確定を優先し、1年保有比率を上げすぎない。",
    confirm: "PER、受注、検査装置需要、SOXとの連動、決算後1日/5日/20日反応。",
  },
  {
    ticker: "6146.T",
    name: "ディスコ",
    channel: "semi",
    role: "切断・研削・先端パッケージ候補",
    green: "半導体製造の構造需要が強く、株価が過熱しすぎていない場合に候補。",
    yellow: "未確認データが残る場合は補欠。高値追いは避ける。",
    stop: "SOX急落、決算後失速、受注・利益率の鈍化が見える場合は追加停止。",
    profit: "高値更新後の急伸は一部利確を検討し、反落耐性を確認。",
    confirm: "受注、利益率、PER/PBR/ROE、過去最大下落率、同業装置株との比較。",
  },
  {
    ticker: "8035.T",
    name: "東京エレクトロン",
    channel: "semi",
    role: "前工程装置の代表候補",
    green: "半導体製造装置全体が買われ、米金利・SOXが悪化していなければ候補。",
    yellow: "半導体指数が弱い場合は保留寄り。買う場合も分割前提。",
    stop: "SOX/NASDAQが大きく崩れる、受注見通し悪化、決算後反応悪化なら追加停止。",
    profit: "半導体テーマが過熱した場合は比率調整し、指数劣後を監視。",
    confirm: "受注、売上見通し、PER、SOX連動、決算後反応。",
  },
  {
    ticker: "6501.T",
    name: "日立製作所",
    channel: "infra",
    role: "電力網・制御・デジタルインフラ候補",
    green: "電力網、制御、AIインフラ需要が強い場合に中心候補として検討。",
    yellow: "株価が過熱している場合は条件付き。決算・受注確認後に扱う。",
    stop: "大型案件の鈍化、利益率低下、指数に対する劣後が続く場合は追加停止。",
    profit: "インフラテーマで短期急伸した場合は一部利確し、残りで検証。",
    confirm: "受注、営業利益率、電力・デジタル部門、5年/10年CAGR、最大下落率。",
  },
  {
    ticker: "5803.T",
    name: "フジクラ",
    channel: "infra",
    role: "光通信・電線・データセンター候補",
    green: "データセンター・光通信需要が継続し、過熱が許容範囲なら候補。",
    yellow: "上昇が急すぎる場合は補欠。反落時の下値ルールを優先。",
    stop: "光通信需要の鈍化、急落、決算後反応悪化、過熱指標が強い場合は追加停止。",
    profit: "短期上昇幅が大きい場合は一部利確を優先し、残りを検証。",
    confirm: "売上成長、利益率、光通信関連、最大下落率、出来高急増の持続性。",
  },
  {
    ticker: "7011.T",
    name: "三菱重工業",
    channel: "infra",
    role: "電力・冷却・防衛・大型インフラ候補",
    green: "電力・防衛・大型インフラ需要が継続し、直近の弱さが致命的でない場合に候補。",
    yellow: "直近調整が続く場合は補欠。反転確認なしの高比率は避ける。",
    stop: "直近下落が継続、決算後反応悪化、テーマ過熱の剥落が見える場合は追加停止。",
    profit: "大型テーマで急騰した場合は一部利益確定し、下落耐性を確認。",
    confirm: "受注残、利益率、電力・防衛・冷却関連、直近60日騰落、最大下落率。",
  },
  {
    ticker: "6762.T",
    name: "TDK",
    channel: "physical",
    role: "電源・センサー・電子部品候補",
    green: "AI端末、電源、センサー需要が強く、電子部品市況が悪化していなければ候補。",
    yellow: "電子部品市況の確認が弱い場合は条件付き。",
    stop: "電子部品需要悪化、為替逆風、決算後反応悪化なら追加停止。",
    profit: "テーマ上昇後は比率を抑え、1年保有の検証を優先。",
    confirm: "受注、在庫、営業利益率、為替感応度、同業電子部品比較。",
  },
];

const commonRules = [
  ["-5%下落", "市場全体も下げているか、銘柄固有かを確認。固有悪材料なら追加停止。"],
  ["-10%下落", "購入理由が崩れていないか再判定。崩れていれば損切り候補、崩れていなければ保留・小口確認。"],
  ["指数比 -3%以上劣後", "S&P500、TOPIX、日経平均のどれに劣後したかを記録し、次回配分を下げる候補にする。"],
  ["決算前", "未確認リスクが大きい銘柄は比率を落とす。決算またぎを目的にしない。"],
  ["決算後", "1日、5日、20営業日の反応を記録し、候補継続・保留・除外を再分類する。"],
  ["短期急騰", "急騰の理由が決算・受注・政策で説明できるか確認。説明不能なら一部利益確定候補。"],
];

const rowHtml = tickers.map((row, index) => `
  <tr>
    <td><b>${index + 1}</b></td>
    <td><b>${esc(row.ticker)}</b><br>${esc(row.name)}</td>
    <td>${esc(channels[row.channel])}<br><span class="muted">${esc(row.role)}</span></td>
    <td>${esc(row.green)}</td>
    <td>${esc(row.yellow)}</td>
    <td>${esc(row.stop)}</td>
    <td>${esc(row.profit)}</td>
    <td>${esc(row.confirm)}</td>
  </tr>
`).join("");

const commonHtml = commonRules.map((row) => `
  <tr>
    <td><b>${esc(row[0])}</b></td>
    <td>${esc(row[1])}</td>
  </tr>
`).join("");

const csvRows = [
  ["rank", "ticker", "name", "channel", "role", "green_action", "yellow_action", "stop_rule", "profit_rule", "required_confirmation"],
  ...tickers.map((row, index) => [index + 1, row.ticker, row.name, channels[row.channel], row.role, row.green, row.yellow, row.stop, row.profit, row.confirm]),
  [],
  ["common_trigger", "action"],
  ...commonRules,
];

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 銘柄別アクション票</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--amber:#a85b00;--red:#a01818}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;line-height:1.6}
    header{background:var(--navy);color:white;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);letter-spacing:0;line-height:1.2}
    header p{margin:0;color:white;font-weight:800}
    main{max-width:1540px;margin:0 auto;padding:22px}
    section{background:white;border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:24px}
    .notice{border-left:7px solid var(--amber);background:#fff7e7;color:#111;padding:12px 14px;margin:0 0 14px;font-weight:900;border-radius:8px}
    .links a{display:inline-block;margin:6px 8px 0 0;background:var(--blue);color:white;text-decoration:none;border-radius:8px;padding:9px 12px;font-weight:900}
    table{width:100%;border-collapse:collapse;table-layout:fixed}
    th,td{border:1px solid var(--line);padding:9px;vertical-align:top;overflow-wrap:anywhere;color:#111}
    th{background:#e5f1fb;color:var(--navy);text-align:left;font-weight:900}
    tr{break-inside:avoid}
    .muted{color:#526b82;font-size:12px;font-weight:800}
    .red{color:var(--red);font-weight:900}
    @media(max-width:980px){main{padding:12px}table{font-size:14px}}
  </style>
</head>
<body>
<header>
  <h1>候補10社 銘柄別アクション票</h1>
  <p>作成: ${esc(generatedAt)} / 6月イベント後に、銘柄ごとにどう扱うかを確認する実務用ページです。</p>
</header>
<main>
  <section>
    <h2>1. 位置づけ</h2>
    <p class="notice">これは購入確定ではありません。市場ゲートが緑または黄になった場合に、各銘柄を中心候補、条件付き、補欠、監視へ分けるための確認票です。未確認データが残る銘柄は、スコアが高くても購入判断に進めません。</p>
    <div class="links">
      <a href="910_prebuy_final_gate_checklist_20260606.html">購入前 最終ゲート</a>
      <a href="909_final10_current_snapshot_20260606.html">現時点 判定スナップショット</a>
      <a href="908_final10_decision_workbench_20260606.html">判定ワークベンチ</a>
      <a href="911_ticker_action_tickets_20260606.csv">CSV</a>
    </div>
  </section>

  <section>
    <h2>2. 銘柄別アクション</h2>
    <table>
      <thead><tr><th style="width:46px">No</th><th style="width:130px">銘柄</th><th style="width:170px">枠・役割</th><th>緑判定なら</th><th>黄判定なら</th><th>停止条件</th><th>利確条件</th><th>追加確認</th></tr></thead>
      <tbody>${rowHtml}</tbody>
    </table>
  </section>

  <section>
    <h2>3. 共通の上値・下値ルール</h2>
    <table>
      <thead><tr><th style="width:170px">トリガー</th><th>対応</th></tr></thead>
      <tbody>${commonHtml}</tbody>
    </table>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "911_ticker_action_tickets_20260606.csv"), `\uFEFF${csvRows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`, "utf8");
fs.writeFileSync(path.join(ROOT, "911_ticker_action_tickets_20260606.html"), html, "utf8");

console.log("wrote 911_ticker_action_tickets_20260606.html");
console.log("wrote 911_ticker_action_tickets_20260606.csv");
