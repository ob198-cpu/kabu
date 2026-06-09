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
const stockRatio = 0.70;
const cashRatio = 0.30;
const candidateWeights = [
  ["8053.T", "住友商事", 0.1875],
  ["8316.T", "三井住友FG", 0.1875],
  ["6501.T", "日立製作所", 0.1875],
  ["6503.T", "三菱電機", 0.0625],
  ["6857.T", "アドバンテスト", 0.0625],
  ["8035.T", "東京エレクトロン", 0.0625],
  ["7011.T", "三菱重工業", 0.0625],
  ["6762.T", "TDK", 0.0625],
  ["6146.T", "ディスコ", 0.0625],
  ["5803.T", "フジクラ", 0.0625],
];

const phases = [
  ["2026/06/18〜06/24", "初回", 0.35, "CPI、日銀、FOMC後の市場ゲートが緑の場合"],
  ["2026/07/15前後", "第2回", 0.20, "初回後に指数・金利・為替が崩れていない場合"],
  ["2026/08/17〜08/21", "第3回", 0.15, "4〜6月期決算と決算後反応を確認できた場合"],
];

const esc = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");
const fmtYen = (value) => `${Math.round(value).toLocaleString("ja-JP")}円`;
const fmtPct = (value, digits = 1) => `${Number(value).toFixed(digits)}%`;
const num = (value) => {
  const n = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
};

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quote = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quote) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quote = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quote = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  const headers = rows.shift();
  return rows.filter((r) => r.length && r.some(Boolean)).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}

const metricsPath = path.join(ROOT, "780_universe100_reselection_metrics_20260528.csv");
const metricsRows = parseCsv(fs.readFileSync(metricsPath, "utf8"));
const metricsMap = new Map(metricsRows.map((r) => [r["コード"], r]));

function calculateHypothesis(m) {
  const cagr5 = num(m["5年CAGR"]);
  const cagr10 = num(m["10年CAGR"]);
  const ret1y = num(m["直近1年騰落率"]);
  const ret60d = num(m["60日騰落率"]);
  const dd5 = Math.abs(num(m["5年最大下落率"]) ?? 0);
  const dd1 = Math.abs(num(m["直近1年最大下落率"]) ?? 0);
  const win = num(m["月次勝率"]);

  if ([cagr5, cagr10, ret1y, dd5, dd1].some((v) => v === null)) {
    return { conservative: null, note: "必要な過去指標が不足" };
  }

  const conservative = Math.min(cagr5, cagr10, ret1y);
  const reasons = [];
  if (dd5 > 45) reasons.push("5年最大下落が深い");
  if (dd1 > 25) reasons.push("直近1年の下落幅が大きい");
  if (ret60d !== null && ret60d < -10) reasons.push("直近60日が弱い");
  if (win !== null && win >= 65) reasons.push("月次勝率が高い");
  return {
    conservative,
    note: reasons.length ? reasons.join(" / ") : "大きな警戒条件なし",
  };
}

const candidateRows = candidateWeights.map(([ticker, fallbackName, stockWeight]) => {
  const m = metricsMap.get(ticker);
  const calc = m ? calculateHypothesis(m) : { conservative: null, note: "過去指標未取得" };
  return {
    ticker,
    name: m?.["銘柄"] || fallbackName,
    stockWeight,
    capitalWeight: stockRatio * stockWeight,
    cagr5: num(m?.["5年CAGR"]),
    cagr10: num(m?.["10年CAGR"]),
    ret1y: num(m?.["直近1年騰落率"]),
    ret60d: num(m?.["60日騰落率"]),
    sp5: num(m?.["5年S&P差"]),
    sp1: num(m?.["直近1年S&P差"]),
    dd5: num(m?.["5年最大下落率"]),
    dd1: num(m?.["直近1年最大下落率"]),
    win: num(m?.["月次勝率"]),
    conservative: calc.conservative,
    note: calc.note,
  };
});

const portfolioReturn = (field) => candidateRows.reduce((sum, row) => sum + row.stockWeight * (row[field] ?? 0), 0);
const p5 = portfolioReturn("cagr5");
const p10 = portfolioReturn("cagr10");
const pConservative = portfolioReturn("conservative");

function projected(totalCapital, annualPct, years) {
  const stock = totalCapital * stockRatio;
  const cash = totalCapital * cashRatio;
  return cash + stock * Math.pow(1 + annualPct / 100, years);
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

const byTickerCsv = [
  ["ticker", "銘柄", "株式内比率", "元本比率", "5年CAGR", "10年CAGR", "直近1年騰落率", "60日騰落率", "5年S&P差", "直近1年S&P差", "5年最大下落率", "直近1年最大下落率", "月次勝率", "保守実績仮説利回り", "警戒理由"],
  ...candidateRows.map((r) => [
    r.ticker,
    r.name,
    fmtPct(r.stockWeight * 100),
    fmtPct(r.capitalWeight * 100),
    r.cagr5,
    r.cagr10,
    r.ret1y,
    r.ret60d,
    r.sp5,
    r.sp1,
    r.dd5,
    r.dd1,
    r.win,
    r.conservative === null ? "未取得" : r.conservative.toFixed(1),
    r.note,
  ]),
].map((row) => row.map(csvEscape).join(",")).join("\n");

const accountRows = [];
for (let accounts = 1; accounts <= 10; accounts += 1) {
  const total = baseCapital * accounts;
  accountRows.push({
    accounts,
    total,
    phase1: total * phases[0][2],
    phase2: total * phases[1][2],
    phase3: total * phases[2][2],
    invested: total * stockRatio,
    cash: total * cashRatio,
    y1p5: projected(total, p5, 1),
    y1p10: projected(total, p10, 1),
    y1cons: projected(total, pConservative, 1),
    y3cons: projected(total, pConservative, 3),
    y5cons: projected(total, pConservative, 5),
    y10cons: projected(total, pConservative, 10),
  });
}

const accountCsv = [
  ["口座数", "元本合計", "6/18-24初回投入", "7/15前後追加", "8/17-21追加", "株式投入合計", "現金待機", "1年後_5年CAGR継続", "1年後_10年CAGR継続", "1年後_保守実績仮説", "3年後_保守実績仮説", "5年後_保守実績仮説", "10年後_保守実績仮説"],
  ...accountRows.map((r) => [r.accounts, r.total, r.phase1, r.phase2, r.phase3, r.invested, r.cash, r.y1p5, r.y1p10, r.y1cons, r.y3cons, r.y5cons, r.y10cons].map((v, i) => i === 0 ? v : Math.round(v))),
].map((row) => row.map(csvEscape).join(",")).join("\n");

fs.writeFileSync(path.join(ROOT, "932_historical_return_by_ticker_20260609.csv"), "\uFEFF" + byTickerCsv, "utf8");
fs.writeFileSync(path.join(ROOT, "933_historical_return_account_sim_20260609.csv"), "\uFEFF" + accountCsv, "utf8");

const allocationRows = [];
for (let accounts = 1; accounts <= 10; accounts += 1) {
  const total = baseCapital * accounts;
  for (const r of candidateRows) {
    allocationRows.push({
      accounts,
      ticker: r.ticker,
      name: r.name,
      stockWeight: r.stockWeight,
      capitalWeight: r.capitalWeight,
      phase1: total * phases[0][2] * r.stockWeight,
      phase2: total * phases[1][2] * r.stockWeight,
      phase3: total * phases[2][2] * r.stockWeight,
      finalAmount: total * stockRatio * r.stockWeight,
      conservative: r.conservative,
      note: r.note,
    });
  }
}

const allocationCsv = [
  ["口座数", "ticker", "銘柄", "株式内比率", "元本比率", "6/18-24初回購入額", "7/15前後追加購入額", "8/17-21追加購入額", "最終購入額", "保守実績仮説利回り", "警戒理由"],
  ...allocationRows.map((r) => [
    r.accounts,
    r.ticker,
    r.name,
    fmtPct(r.stockWeight * 100),
    fmtPct(r.capitalWeight * 100),
    Math.round(r.phase1),
    Math.round(r.phase2),
    Math.round(r.phase3),
    Math.round(r.finalAmount),
    r.conservative === null ? "未取得" : r.conservative.toFixed(1),
    r.note,
  ]),
].map((row) => row.map(csvEscape).join(",")).join("\n");

fs.writeFileSync(path.join(ROOT, "934_historical_return_ticker_timing_allocation_20260609.csv"), "\uFEFF" + allocationCsv, "utf8");

const tickerRows = candidateRows.map((r) => `
  <tr>
    <td>${esc(r.ticker)}</td>
    <td><b>${esc(r.name)}</b></td>
    <td>${fmtPct(r.stockWeight * 100)}</td>
    <td>${r.cagr5 === null ? "未取得" : fmtPct(r.cagr5)}</td>
    <td>${r.cagr10 === null ? "未取得" : fmtPct(r.cagr10)}</td>
    <td>${r.ret1y === null ? "未取得" : fmtPct(r.ret1y)}</td>
    <td>${r.sp5 === null ? "未取得" : fmtPct(r.sp5)}</td>
    <td>${r.dd5 === null ? "未取得" : fmtPct(r.dd5)}</td>
    <td>${r.win === null ? "未取得" : fmtPct(r.win)}</td>
    <td><b>${r.conservative === null ? "未取得" : fmtPct(r.conservative)}</b></td>
    <td>${esc(r.note)}</td>
  </tr>
`).join("");

const oneAccountBuyRows = allocationRows.filter((r) => r.accounts === 1).map((r) => `
  <tr>
    <td>${esc(r.ticker)}</td>
    <td><b>${esc(r.name)}</b></td>
    <td>${fmtPct(r.stockWeight * 100)}</td>
    <td>${fmtPct(r.capitalWeight * 100)}</td>
    <td>${fmtYen(r.phase1)}</td>
    <td>${fmtYen(r.phase2)}</td>
    <td>${fmtYen(r.phase3)}</td>
    <td><b>${fmtYen(r.finalAmount)}</b></td>
    <td>${r.conservative === null ? "未取得" : fmtPct(r.conservative)}</td>
  </tr>
`).join("");

const accountHtmlRows = accountRows.map((r) => `
  <tr>
    <td>${r.accounts}</td>
    <td>${fmtYen(r.total)}</td>
    <td>${fmtYen(r.phase1)}</td>
    <td>${fmtYen(r.phase2)}</td>
    <td>${fmtYen(r.phase3)}</td>
    <td>${fmtYen(r.invested)}</td>
    <td>${fmtYen(r.cash)}</td>
    <td>${fmtYen(r.y1p5)}</td>
    <td>${fmtYen(r.y1p10)}</td>
    <td>${fmtYen(r.y1cons)}</td>
    <td>${fmtYen(r.y5cons)}</td>
    <td>${fmtYen(r.y10cons)}</td>
  </tr>
`).join("");

const phaseRows = phases.map(([date, label, ratio, condition]) => `
  <tr><td>${esc(date)}</td><td>${esc(label)}</td><td>${fmtPct(ratio * 100)}</td><td>${fmtYen(baseCapital * ratio)}</td><td>${esc(condition)}</td></tr>
`).join("");

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>NISA候補10社 過去実績ベース 複利シミュレーション</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--soft:#eef6fc;--amber:#a85b00;--red:#a01818}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;line-height:1.78;font-size:18px}
    header{background:var(--navy);color:white;padding:34px 40px}
    h1{margin:0 0 12px;font-size:40px;letter-spacing:0}
    header p{margin:0;font-weight:850;color:white;font-size:19px}
    main{max-width:1560px;margin:0 auto;padding:24px}
    section{background:white;border:1px solid var(--line);border-radius:12px;padding:22px;margin:0 0 22px;box-shadow:0 8px 20px rgba(20,60,90,.08)}
    h2{margin:0 0 16px;border-left:10px solid var(--blue);padding-left:14px;color:var(--navy);font-size:31px}
    .lead{font-size:21px;font-weight:900;color:#061827;margin:0 0 16px}
    .note{background:#fff7e7;border-left:8px solid var(--amber);padding:16px;border-radius:8px;font-weight:900;color:#111;margin:0 0 16px;font-size:19px}
    .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
    .metric{background:var(--soft);border:1px solid var(--line);border-radius:10px;padding:15px}
    .metric b{display:block;color:var(--navy);font-size:17px}
    .metric strong{display:block;font-size:31px;margin-top:4px}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px}
    table{width:100%;border-collapse:collapse;background:white}
    th,td{border:1px solid var(--line);padding:10px 12px;text-align:left;vertical-align:top;color:#061827}
    th{background:#e2f0fb;color:#053b63;font-weight:900;white-space:nowrap;font-size:17px}
    td{font-size:17px}
    .formula{background:#f7fbff;border:1px solid var(--line);border-radius:10px;padding:16px;font-weight:900;font-size:19px}
    .explain{display:grid;grid-template-columns:1.1fr 1fr;gap:12px}
    .box{background:#f7fbff;border:1px solid var(--line);border-radius:10px;padding:17px;font-weight:900;font-size:19px}
    .hypothesis-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .hypothesis-card{background:#f7fbff;border:1px solid var(--line);border-radius:10px;padding:17px}
    .hypothesis-card h3{margin:0 0 10px;color:var(--navy);font-size:24px}
    .hypothesis-card p{margin:0;font-weight:850}
    .box b{color:var(--navy)}
    .links a{display:inline-block;margin:0 8px 8px 0;background:#0b67a3;color:#fff;padding:8px 12px;border-radius:8px;text-decoration:none;font-weight:900}
    @media print{body{background:white;font-size:15px}main{max-width:none;padding:8mm}section{box-shadow:none;break-inside:avoid;page-break-inside:avoid;padding:14px}h1{font-size:31px}h2{font-size:24px}.lead{font-size:17px}.table-wrap{overflow:visible}th{font-size:12px;padding:6px}td{font-size:12px;padding:6px}.note,.box,.formula{font-size:15px}.metric strong{font-size:23px}.hypothesis-card h3{font-size:18px}}
    @media(max-width:900px){main{padding:12px}.grid,.explain,.hypothesis-grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
<header>
  <h1>NISA候補10社 過去実績ベース 複利シミュレーション</h1>
  <p>本資料は、NISAで1年保有を検討する候補10社について、過去の株価実績と下落リスクを整理し、240万円を段階投資した場合の資産推移を試算する資料です。</p>
</header>
<main>
  <section>
    <h2>1. CAGRとは</h2>
    <div class="explain">
      <div class="box">
        <b>CAGR</b> は「年平均成長率」のことです。株価が複利で毎年平均何%増えたかを見る指標です。<br>
        例: 100万円が5年後に200万円になった場合、単純に100%÷5年=20%ではなく、複利計算で年約14.9%増えたと見ます。
      </div>
      <div class="box">
        この資料では、各銘柄の <b>過去5年CAGR</b> と <b>過去10年CAGR</b> を使い、短期の急騰だけでなく長期で増えてきたかを確認します。ただし、CAGRは過去実績であり、将来も同じ利回りになる保証ではありません。
      </div>
    </div>
  </section>

  <section>
    <h2>2. この試算で置いている仮説</h2>
    <p class="lead">この資料は「選んだ10社を買えば必ずこの利回りになる」という予測ではありません。過去の株価実績を使い、6月に買う場合の候補銘柄・比率・タイミングを検討するための仮説試算です。</p>
    <div class="hypothesis-grid">
      <div class="hypothesis-card">
        <h3>目的</h3>
        <p>個別株を選ぶ意味があるかを見るため、S&amp;P500や日経平均に対して、候補10社が過去にどの程度上回ってきたかを確認します。</p>
      </div>
      <div class="hypothesis-card">
        <h3>使った実績</h3>
        <p>各銘柄の過去5年CAGR、過去10年CAGR、直近1年騰落率、S&amp;P500との差、最大下落率、月次勝率を使います。</p>
      </div>
      <div class="hypothesis-card">
        <h3>仮説の置き方</h3>
        <p>強気に見せないため、保守実績仮説は「5年CAGR・10年CAGR・直近1年騰落率のうち一番低い値」を採用します。</p>
      </div>
      <div class="hypothesis-card">
        <h3>限界</h3>
        <p>過去実績は将来保証ではありません。6月のCPI、日銀、FOMC、為替、金利、決算反応で条件が崩れた場合は買付を延期します。</p>
      </div>
    </div>
  </section>

  <section>
    <h2>3. 試算の前提</h2>
    <p class="note">対象は、現時点でNISA 1年保有テストの候補として整理している10社です。過去5年・過去10年・直近1年の株価実績を確認し、1口座240万円で段階的に買う場合の資産推移を試算しています。購入を確定する資料ではなく、6月の市場イベント後に再判定するための確認資料です。</p>
    <div class="grid">
      <div class="metric"><b>株式に使う予定比率</b><strong>${fmtPct(stockRatio * 100)}</strong></div>
      <div class="metric"><b>過去5年ペースの場合</b><strong>${fmtPct(p5)}</strong></div>
      <div class="metric"><b>過去10年ペースの場合</b><strong>${fmtPct(p10)}</strong></div>
      <div class="metric"><b>慎重に見た場合</b><strong>${fmtPct(pConservative)}</strong></div>
    </div>
  </section>

  <section>
    <h2>4. 計算式</h2>
    <div class="formula">
      5年CAGR継続 = 過去5年の年平均ペースが続く場合<br>
      10年CAGR継続 = 過去10年の年平均ペースが続く場合<br>
      保守実績仮説利回り = min(5年CAGR, 10年CAGR, 直近1年騰落率)<br>
      最大下落率、60日騰落率、月次勝率は利回りに混ぜず、警戒理由として横に表示する
    </div>
  </section>

  <section>
    <h2>5. 銘柄別の過去実績と仮説利回り</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ticker</th><th>銘柄</th><th>株式内比率</th><th>5年CAGR</th><th>10年CAGR</th><th>直近1年</th><th>5年S&amp;P差</th><th>5年最大下落</th><th>月次勝率</th><th>保守実績仮説</th><th>警戒理由</th></tr></thead>
        <tbody>${tickerRows}</tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>6. 1口座240万円での銘柄別購入予定</h2>
    <p class="note">この表が実務用の中心です。1口座240万円の場合、最終的に株式168万円、現金72万円を残す前提で、各銘柄にいつ・いくら入れるかを示します。10口座の場合は各金額を10倍します。</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>ticker</th><th>銘柄</th><th>株式内比率</th><th>元本比率</th><th>6/18〜24 初回</th><th>7/15前後 追加</th><th>8/17〜21 追加</th><th>最終購入額</th><th>保守実績仮説</th></tr></thead>
        <tbody>${oneAccountBuyRows}</tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>7. 買付タイミング</h2>
    <div class="table-wrap">
      <table><thead><tr><th>予定日</th><th>段階</th><th>元本比率</th><th>1口座240万円</th><th>実行条件</th></tr></thead><tbody>${phaseRows}<tr><td>常時</td><td>現金待機</td><td>${fmtPct(cashRatio * 100)}</td><td>${fmtYen(baseCapital * cashRatio)}</td><td>急落時、イベント悪化時、口座・税制確認未完了時に使わない資金。</td></tr></tbody></table>
    </div>
  </section>

  <section>
    <h2>8. 口座数別の資産推移</h2>
    <p class="note">5年CAGR継続は「過去5年と同じ勢いが1年続いた場合」、10年CAGR継続は「長期平均に戻した場合」、保守実績仮説は「5年・10年・直近1年のうち一番低い実績値を使った場合」です。</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>口座数</th><th>元本合計</th><th>6/18〜24</th><th>7/15前後</th><th>8/17〜21</th><th>株式投入</th><th>現金</th><th>1年後 5年CAGR継続</th><th>1年後 10年CAGR継続</th><th>1年後 保守実績仮説</th><th>5年後 保守実績仮説</th><th>10年後 保守実績仮説</th></tr></thead>
        <tbody>${accountHtmlRows}</tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>9. CSV</h2>
    <div class="links">
      <a href="932_historical_return_by_ticker_20260609.csv">銘柄別 実績・仮説利回りCSV</a>
      <a href="933_historical_return_account_sim_20260609.csv">口座数別 資産推移CSV</a>
      <a href="934_historical_return_ticker_timing_allocation_20260609.csv">口座数別 銘柄購入額CSV</a>
      <a href="historical_return_compound_simulation_20260609.pdf">PDF版</a>
    </div>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "historical_return_compound_simulation_20260609.html"), html, "utf8");

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
    `--print-to-pdf=${path.join(ROOT, "historical_return_compound_simulation_20260609.pdf")}`,
    `file:///${path.join(ROOT, "historical_return_compound_simulation_20260609.html").replace(/\\/g, "/")}`,
  ], { stdio: "inherit" });
}

console.log("Generated historical return compound simulation.");
