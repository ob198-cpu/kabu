import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const generatedAt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date());

const baseCapital = 2_400_000;
const finalStockRatio = 0.70;
const cashRatio = 0.30;
const phases = [
  { id: "phase1", date: "2026/06/18〜06/24", label: "初回", capitalRatio: 0.35, condition: "6月CPI、日銀、FOMC後に市場ゲートが緑の場合" },
  { id: "phase2", date: "2026/07/15前後", label: "第2回", capitalRatio: 0.20, condition: "初回後に指数・金利・為替が崩れていない場合" },
  { id: "phase3", date: "2026/08/17〜08/21", label: "第3回", capitalRatio: 0.15, condition: "4〜6月期決算と決算後反応を確認できた場合" },
];

const candidates = [
  { ticker: "8053.T", name: "住友商事", channel: "総合候補", weight: 0.1875, expected: "7〜10%", role: "商社・資源・還元" },
  { ticker: "8316.T", name: "三井住友FG", channel: "総合候補", weight: 0.1875, expected: "7〜11%", role: "銀行・金利・還元" },
  { ticker: "6501.T", name: "日立製作所", channel: "データセンター・電力・冷却・電線", weight: 0.1875, expected: "8〜12%", role: "電力網・制御・デジタル" },
  { ticker: "6503.T", name: "三菱電機", channel: "総合候補", weight: 0.0625, expected: "7〜11%", role: "電力制御・FA・複合" },
  { ticker: "6857.T", name: "アドバンテスト", channel: "半導体製造装置・材料", weight: 0.0625, expected: "10〜18%", role: "AI半導体検査" },
  { ticker: "8035.T", name: "東京エレクトロン", channel: "半導体製造装置・材料", weight: 0.0625, expected: "9〜16%", role: "前工程装置" },
  { ticker: "7011.T", name: "三菱重工業", channel: "データセンター・電力・冷却・電線", weight: 0.0625, expected: "6〜12%", role: "電力・冷却・防衛" },
  { ticker: "6762.T", name: "TDK", channel: "フィジカルAI", weight: 0.0625, expected: "7〜12%", role: "電源・センサー・電子部品" },
  { ticker: "6146.T", name: "ディスコ", channel: "半導体製造装置・材料", weight: 0.0625, expected: "10〜18%", role: "切断・研削・先端PKG" },
  { ticker: "5803.T", name: "フジクラ", channel: "データセンター・電力・冷却・電線", weight: 0.0625, expected: "10〜20%", role: "光通信・電線" },
];

const scenarios = [
  { key: "low", label: "弱め", annualReturn: 0.08 },
  { key: "base", label: "基準", annualReturn: 0.10 },
  { key: "high", label: "強め", annualReturn: 0.12 },
];

const fmtYen = (value) => `${Math.round(value).toLocaleString("ja-JP")}円`;
const fmtPct = (value) => `${(value * 100).toFixed(value * 100 % 1 === 0 ? 0 : 1)}%`;
const esc = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

function projectedValue(totalCapital, annualReturn, years) {
  const stock = totalCapital * finalStockRatio;
  const cash = totalCapital * cashRatio;
  return cash + stock * Math.pow(1 + annualReturn, years);
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

const summaryRows = [];
for (let accounts = 1; accounts <= 10; accounts += 1) {
  const totalCapital = baseCapital * accounts;
  const invested = totalCapital * finalStockRatio;
  const cash = totalCapital * cashRatio;
  const row = {
    accounts,
    capital: totalCapital,
    phase1: totalCapital * 0.35,
    phase2Add: totalCapital * 0.20,
    phase3Add: totalCapital * 0.15,
    invested,
    cash,
    m3Base: projectedValue(totalCapital, 0.10, 0.25),
    m6Base: projectedValue(totalCapital, 0.10, 0.50),
    y1Low: projectedValue(totalCapital, 0.08, 1),
    y1Base: projectedValue(totalCapital, 0.10, 1),
    y1High: projectedValue(totalCapital, 0.12, 1),
    y3Base: projectedValue(totalCapital, 0.10, 3),
    y5Base: projectedValue(totalCapital, 0.10, 5),
    y10Base: projectedValue(totalCapital, 0.10, 10),
  };
  summaryRows.push(row);
}

const allocationRows = [];
for (let accounts = 1; accounts <= 10; accounts += 1) {
  const totalCapital = baseCapital * accounts;
  for (const c of candidates) {
    const target = totalCapital * finalStockRatio * c.weight;
    allocationRows.push({
      accounts,
      ticker: c.ticker,
      name: c.name,
      channel: c.channel,
      role: c.role,
      stockWeight: c.weight,
      capitalWeight: finalStockRatio * c.weight,
      target,
      phase1: target * (0.35 / finalStockRatio),
      phase2: target * (0.20 / finalStockRatio),
      phase3: target * (0.15 / finalStockRatio),
      expected: c.expected,
    });
  }
}

const summaryCsv = [
  ["口座数", "元本合計", "6/18-24初回投入", "7/15前後追加", "8/17-21追加", "最終株式投入", "現金待機", "3か月基準", "6か月基準", "1年弱め8%", "1年基準10%", "1年強め12%", "3年基準10%", "5年基準10%", "10年基準10%"],
  ...summaryRows.map((r) => [r.accounts, r.capital, r.phase1, r.phase2Add, r.phase3Add, r.invested, r.cash, r.m3Base, r.m6Base, r.y1Low, r.y1Base, r.y1High, r.y3Base, r.y5Base, r.y10Base].map((value, index) => index === 0 ? value : Math.round(value))),
].map((row) => row.map(csvEscape).join(",")).join("\n");

const allocationCsv = [
  ["口座数", "ticker", "銘柄", "チャンネル", "役割", "株式内比率", "元本比率", "最終投入額", "6/18-24初回", "7/15前後追加", "8/17-21追加", "1年想定レンジ"],
  ...allocationRows.map((r) => [r.accounts, r.ticker, r.name, r.channel, r.role, fmtPct(r.stockWeight), fmtPct(r.capitalWeight), Math.round(r.target), Math.round(r.phase1), Math.round(r.phase2), Math.round(r.phase3), r.expected]),
].map((row) => row.map(csvEscape).join(",")).join("\n");

fs.writeFileSync(path.join(ROOT, "930_multi_account_compound_summary_20260609.csv"), "\uFEFF" + summaryCsv, "utf8");
fs.writeFileSync(path.join(ROOT, "931_multi_account_ticker_allocation_20260609.csv"), "\uFEFF" + allocationCsv, "utf8");

const accountSummaryRows = summaryRows.map((r) => `
  <tr>
    <td>${r.accounts}</td>
    <td>${fmtYen(r.capital)}</td>
    <td>${fmtYen(r.phase1)}</td>
    <td>${fmtYen(r.phase2Add)}</td>
    <td>${fmtYen(r.phase3Add)}</td>
    <td>${fmtYen(r.invested)}</td>
    <td>${fmtYen(r.cash)}</td>
    <td>${fmtYen(r.y1Low)}</td>
    <td>${fmtYen(r.y1Base)}</td>
    <td>${fmtYen(r.y1High)}</td>
    <td>${fmtYen(r.y5Base)}</td>
    <td>${fmtYen(r.y10Base)}</td>
  </tr>
`).join("");

const oneAccountAllocationRows = allocationRows.filter((r) => r.accounts === 1).map((r) => `
  <tr>
    <td>${esc(r.ticker)}</td>
    <td><b>${esc(r.name)}</b><br><span>${esc(r.role)}</span></td>
    <td>${esc(r.channel)}</td>
    <td>${fmtPct(r.stockWeight)}</td>
    <td>${fmtPct(r.capitalWeight)}</td>
    <td>${fmtYen(r.target)}</td>
    <td>${fmtYen(r.phase1)}</td>
    <td>${fmtYen(r.phase2)}</td>
    <td>${fmtYen(r.phase3)}</td>
    <td>${esc(r.expected)}</td>
  </tr>
`).join("");

const phaseRows = phases.map((p) => `
  <tr>
    <td>${esc(p.date)}</td>
    <td>${esc(p.label)}</td>
    <td>${fmtPct(p.capitalRatio)}</td>
    <td>${fmtYen(baseCapital * p.capitalRatio)}</td>
    <td>${esc(p.condition)}</td>
  </tr>
`).join("");

const scenarioRows = scenarios.map((s) => {
  const one = projectedValue(baseCapital, s.annualReturn, 1);
  const ten = projectedValue(baseCapital * 10, s.annualReturn, 1);
  return `
    <tr>
      <td>${esc(s.label)}</td>
      <td>${fmtPct(s.annualReturn)}</td>
      <td>${fmtYen(one)}</td>
      <td>${fmtYen(one - baseCapital)}</td>
      <td>${fmtYen(ten)}</td>
      <td>${fmtYen(ten - baseCapital * 10)}</td>
    </tr>
  `;
}).join("");

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>240万円×1〜10口座 複利シミュレーション サンプル</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--soft:#eef6fc;--amber:#a85b00;--red:#a01818;--green:#00725a}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;line-height:1.65}
    header{background:var(--navy);color:white;padding:28px 34px}
    h1{margin:0 0 8px;font-size:30px;letter-spacing:0}
    header p{margin:0;font-weight:800;color:white}
    main{max-width:1380px;margin:0 auto;padding:22px}
    section{background:white;border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08)}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:22px}
    .lead{font-weight:900;color:#122f47;margin:0 0 12px}
    .note{background:#fff7e7;border-left:7px solid var(--amber);padding:12px;border-radius:8px;font-weight:900;color:#111;margin:0 0 12px}
    .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
    .metric{background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:12px}
    .metric b{display:block;color:var(--navy);font-size:13px}
    .metric strong{display:block;font-size:22px;margin-top:4px}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px}
    table{width:100%;border-collapse:collapse;background:white}
    th,td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top;color:#061827}
    th{background:#e2f0fb;color:#053b63;font-weight:900;white-space:nowrap}
    td{font-size:14px}
    td span{color:#273f56;font-weight:800}
    .small{font-size:13px;color:#253e55;font-weight:800}
    .ok{color:var(--green);font-weight:900}
    .danger{color:var(--red);font-weight:900}
    .links a{display:inline-block;margin:0 8px 8px 0;background:#0b67a3;color:#fff;padding:8px 12px;border-radius:8px;text-decoration:none;font-weight:900}
    @media print{
      body{background:white}
      main{max-width:none;padding:10mm}
      section{box-shadow:none;break-inside:avoid;page-break-inside:avoid}
      .table-wrap{overflow:visible}
      th,td{font-size:11px;padding:5px}
    }
    @media(max-width:900px){main{padding:12px}.grid{grid-template-columns:1fr 1fr}}
  </style>
</head>
<body>
<header>
  <h1>240万円×1〜10口座 複利シミュレーション サンプル</h1>
  <p>1口座240万円を基準に、最大10口座まで同じ候補10社・同じ買付タイミングで拡張した場合の資産推移を確認する資料です。</p>
</header>
<main>
  <section>
    <h2>1. 前提</h2>
    <p class="note">これは購入判断の確定値ではなく、6月イベント後に実データを入れる前の説明用サンプルです。正式な投入はCPI、日銀、FOMC、指数、金利、為替、候補銘柄の反応を確認してから判断します。</p>
    <div class="grid">
      <div class="metric"><b>1口座あたり元本</b><strong>${fmtYen(baseCapital)}</strong></div>
      <div class="metric"><b>株式投入上限</b><strong>${fmtPct(finalStockRatio)}</strong></div>
      <div class="metric"><b>現金待機</b><strong>${fmtPct(cashRatio)}</strong></div>
      <div class="metric"><b>基準シナリオ</b><strong>株式部分 年10%</strong></div>
    </div>
  </section>

  <section>
    <h2>2. 買付タイミング</h2>
    <p class="lead">最初から全額を入れず、6月イベント後に段階投入する前提です。</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>予定日</th><th>段階</th><th>元本比率</th><th>1口座240万円の場合</th><th>実行条件</th></tr></thead>
        <tbody>${phaseRows}<tr><td>常時</td><td>現金待機</td><td>${fmtPct(cashRatio)}</td><td>${fmtYen(baseCapital * cashRatio)}</td><td>下落時、イベント悪化時、口座・税制確認未完了時に無理に使わない資金。</td></tr></tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>3. 1口座あたりの銘柄比率・投入予定</h2>
    <p class="lead">1口座240万円のうち、株式投入予定は168万円、現金待機は72万円です。10口座の場合は各金額を10倍します。</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ticker</th><th>銘柄</th><th>区分</th><th>株式内比率</th><th>元本比率</th><th>最終投入額</th><th>6/18〜24</th><th>7/15前後</th><th>8/17〜21</th><th>1年想定レンジ</th></tr></thead>
        <tbody>${oneAccountAllocationRows}</tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>4. 口座数別の資産推移</h2>
    <p class="lead">株式部分だけが8〜12%動く前提です。30%の現金は増減しないため、全体の増加率は株式利回りより低く見えます。</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>口座数</th><th>元本合計</th><th>初回投入</th><th>第2回</th><th>第3回</th><th>最終株式投入</th><th>現金</th><th>1年弱め8%</th><th>1年基準10%</th><th>1年強め12%</th><th>5年基準10%</th><th>10年基準10%</th></tr></thead>
        <tbody>${accountSummaryRows}</tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>5. 1年後の利益イメージ</h2>
    <p class="lead">10口座の場合でも、利回りは同じです。違うのは元本規模と利益額です。</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>シナリオ</th><th>株式部分の年率</th><th>1口座の1年後</th><th>1口座の利益</th><th>10口座の1年後</th><th>10口座の利益</th></tr></thead>
        <tbody>${scenarioRows}</tbody>
      </table>
    </div>
    <p class="small">例: 基準10%の場合、株式70%だけが10%上がるため、全体では約7%増です。1口座240万円なら約16.8万円、10口座2,400万円なら約168万円の利益イメージです。</p>
  </section>

  <section>
    <h2>6. 使用方法</h2>
    <p class="lead">この資料は、人数・口座数が増えた時に「いくら入るか」「いつ入るか」「どの銘柄にいくら入るか」を確認するためのサンプルです。</p>
    <div class="links">
      <a href="930_multi_account_compound_summary_20260609.csv">口座数別CSV</a>
      <a href="931_multi_account_ticker_allocation_20260609.csv">銘柄別配分CSV</a>
      <a href="multi_account_compound_simulation_20260609.pdf">PDF版</a>
    </div>
    <p class="small">正式運用では、6月イベント後の市場ゲート、本人ごとのNISA口座準備、購入前チェック、銘柄別停止条件を通過したものだけを使います。</p>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "multi_account_compound_simulation_20260609.html"), html, "utf8");

const chromeCandidates = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
];
const chrome = chromeCandidates.find((p) => fs.existsSync(p));
if (chrome) {
  execFileSync(chrome, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--print-to-pdf-no-header",
    `--print-to-pdf=${path.join(ROOT, "multi_account_compound_simulation_20260609.pdf")}`,
    `file:///${path.join(ROOT, "multi_account_compound_simulation_20260609.html").replace(/\\/g, "/")}`,
  ], { stdio: "inherit" });
}

console.log("Generated multi-account compound simulation.");
