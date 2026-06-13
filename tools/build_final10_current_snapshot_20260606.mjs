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

const candidates = [
  ["8053.T", "住友商事", "総合候補", "商社・資源・還元", { data: "pass", financial: "pass", reaction: "partial", theme: "pass", risk: "partial", tax: "partial" }],
  ["8316.T", "三井住友FG", "総合候補", "銀行・金利・還元", { data: "pass", financial: "pass", reaction: "partial", theme: "pass", risk: "partial", tax: "partial" }],
  ["6503.T", "三菱電機", "総合候補", "電力制御・FA・複合", { data: "pass", financial: "partial", reaction: "partial", theme: "pass", risk: "partial", tax: "partial" }],
  ["6857.T", "アドバンテスト", "半導体製造装置・材料", "AI半導体検査", { data: "pass", financial: "partial", reaction: "partial", theme: "pass", risk: "partial", tax: "partial" }],
  ["6146.T", "ディスコ", "半導体製造装置・材料", "切断・研削・先端パッケージ", { data: "partial", financial: "partial", reaction: "partial", theme: "pass", risk: "partial", tax: "partial" }],
  ["8035.T", "東京エレクトロン", "半導体製造装置・材料", "前工程装置", { data: "pass", financial: "partial", reaction: "partial", theme: "pass", risk: "partial", tax: "partial" }],
  ["6501.T", "日立製作所", "データセンター・電力・冷却・電線", "電力網・制御・デジタル", { data: "pass", financial: "pass", reaction: "partial", theme: "pass", risk: "partial", tax: "partial" }],
  ["5803.T", "フジクラ", "データセンター・電力・冷却・電線", "光通信・電線", { data: "partial", financial: "partial", reaction: "partial", theme: "pass", risk: "partial", tax: "partial" }],
  ["7011.T", "三菱重工業", "データセンター・電力・冷却・電線", "電力・冷却・防衛", { data: "pass", financial: "partial", reaction: "partial", theme: "pass", risk: "partial", tax: "partial" }],
  ["6762.T", "TDK", "フィジカルAI", "電源・センサー・電子部品", { data: "pass", financial: "partial", reaction: "partial", theme: "pass", risk: "partial", tax: "partial" }],
  ["6954.T", "ファナック", "フィジカルAI", "FA・ロボット", { data: "partial", financial: "partial", reaction: "partial", theme: "partial", risk: "partial", tax: "partial" }],
  ["6861.T", "キーエンス", "フィジカルAI", "センサー・画像処理", { data: "partial", financial: "partial", reaction: "partial", theme: "partial", risk: "partial", tax: "partial" }],
  ["6702.T", "富士通", "量子コンピューター", "量子・HPC・AI基盤", { data: "partial", financial: "partial", reaction: "partial", theme: "partial", risk: "partial", tax: "partial" }],
  ["6701.T", "NEC", "量子コンピューター", "量子・AI・防衛IT", { data: "partial", financial: "partial", reaction: "partial", theme: "partial", risk: "partial", tax: "partial" }],
];

const scoreMap = { pass: 2, partial: 1, fail: 0 };
const classRank = { center: 1, conditional: 2, backup: 3, watch: 9, exclude: 10 };
const classWeight = { center: 3, conditional: 1.5, backup: 0.5 };
const label = {
  center: "中心候補",
  conditional: "条件付き候補",
  backup: "補欠候補",
  watch: "監視枠",
  exclude: "除外",
};

const esc = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

function classify(candidate, marketGate) {
  const [ticker, name, channel, role, values] = candidate;
  if (channel.includes("量子")) {
    return { ticker, name, channel, role, score: 0, cls: "watch", reason: "量子は商用売上・受注・株価反応が不足しており、6月NISA 1年テストでは監視枠。" };
  }
  if (marketGate === "red") {
    return { ticker, name, channel, role, score: 0, cls: "exclude", reason: "赤イベント中のため、購入判断停止。" };
  }
  if (values.data === "fail" || values.financial === "fail" || values.risk === "fail") {
    return { ticker, name, channel, role, score: 0, cls: "exclude", reason: "必須データまたは停止条件に抵触。" };
  }
  const base = ["data", "financial", "reaction", "theme", "risk", "tax"].reduce((sum, key) => sum + scoreMap[values[key]], 0);
  const score = Math.max(0, base - (marketGate === "yellow" ? 1 : 0));
  if (score >= 11 && marketGate === "green") return { ticker, name, channel, role, score, cls: "center", reason: "全体条件が強く、中心候補として扱える。" };
  if (score >= 9) return { ticker, name, channel, role, score, cls: "conditional", reason: "停止条件には触れていないが、決算反応・税制/口座・高ボラ確認が残る。" };
  if (score >= 7) return { ticker, name, channel, role, score, cls: "backup", reason: "補欠候補。追加データ確認後に昇格余地あり。" };
  return { ticker, name, channel, role, score, cls: "exclude", reason: "現時点では最終10社に入れない。" };
}

function selected(results, marketGate) {
  if (marketGate === "red") return [];
  return results
    .filter((row) => ["center", "conditional", "backup"].includes(row.cls))
    .sort((a, b) => classRank[a.cls] - classRank[b.cls] || b.score - a.score)
    .slice(0, 10);
}

function allocationRows(rows, marketGate, budget = 2_400_000) {
  const trancheRatio = marketGate === "green" ? 0.35 : marketGate === "yellow" ? 0.15 : 0;
  const stockBudget = budget * trancheRatio;
  const totalWeight = rows.reduce((sum, row) => sum + classWeight[row.cls], 0) || 1;
  return rows.map((row, index) => ({
    ...row,
    rank: index + 1,
    amount: Math.round(stockBudget * classWeight[row.cls] / totalWeight),
  }));
}

const yellowResults = candidates.map((candidate) => classify(candidate, "yellow"));
const greenResults = candidates.map((candidate) => classify(candidate, "green"));
const yellowSelected = allocationRows(selected(yellowResults, "yellow"), "yellow");
const greenSelected = allocationRows(selected(greenResults, "green"), "green");

function yen(value) {
  return `${Number(value).toLocaleString("ja-JP")}円`;
}

function rowsHtml(rows) {
  if (!rows.length) return '<tr><td colspan="8">通過候補なし</td></tr>';
  return rows.map((row) => `
    <tr>
      <td><b>${row.rank}</b></td>
      <td><b>${esc(row.ticker)}</b><br>${esc(row.name)}</td>
      <td>${esc(row.channel)}<br><span class="muted">${esc(row.role)}</span></td>
      <td>${row.score}</td>
      <td><span class="badge ${esc(row.cls)}">${esc(label[row.cls])}</span></td>
      <td>${esc(yen(row.amount))}</td>
      <td>${esc(row.reason)}</td>
      <td>${row.cls === "conditional" ? "追加確認後に小さく検討" : row.cls === "backup" ? "入替候補" : "中心候補"}</td>
    </tr>
  `).join("");
}

const csvRows = [
  ["scenario", "rank", "ticker", "name", "channel", "score", "class", "allocation_yen", "reason"],
  ...yellowSelected.map((row) => ["yellow", row.rank, row.ticker, row.name, row.channel, row.score, label[row.cls], row.amount, row.reason]),
  ...greenSelected.map((row) => ["green", row.rank, row.ticker, row.name, row.channel, row.score, label[row.cls], row.amount, row.reason]),
];

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>現時点 判定スナップショット</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--amber:#a85b00;--green:#0b6b4f;--red:#a01818;--gray:#455a6f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;line-height:1.7}
    header{background:var(--navy);color:white;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);letter-spacing:0;line-height:1.2}
    header p{margin:0;color:white;font-weight:800}
    main{max-width:1460px;margin:0 auto;padding:22px}
    section{background:white;border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:24px}
    .notice{border-left:7px solid var(--amber);background:#fff7e7;color:#111;padding:12px 14px;margin:12px 0;font-weight:900;border-radius:8px}
    .links a{display:inline-block;margin:6px 8px 0 0;background:var(--blue);color:white;text-decoration:none;border-radius:8px;padding:9px 12px;font-weight:900}
    table{width:100%;border-collapse:collapse;table-layout:fixed}
    th,td{border:1px solid var(--line);padding:9px;vertical-align:top;overflow-wrap:anywhere;color:#111}
    th{background:#e5f1fb;color:var(--navy);text-align:left;font-weight:900}
    .muted{color:#526b82;font-size:12px;font-weight:800}
    .badge{display:inline-block;border-radius:999px;color:white;padding:4px 9px;font-weight:900}
    .conditional{background:var(--amber)}.backup{background:var(--gray)}.center{background:var(--green)}.watch{background:#6d4aa3}.exclude{background:var(--red)}
    @media(max-width:980px){main{padding:12px}table{font-size:14px}}
  </style>
</head>
<body>
<header>
  <h1>現時点 判定スナップショット</h1>
  <p>作成: ${esc(generatedAt)} / ワークベンチの初期値をもとに、保守判定と緑通過後の仮判定を並べた確認表です。</p>
</header>
<main>
  <section>
    <h2>1. 位置づけ</h2>
    <p class="notice">このページは購入確定ではありません。6月イベント前の保守判定では、攻め枠を抑え、データ未確認の銘柄を補欠または除外寄りに扱います。緑通過後の仮判定は、CPI・日銀・FOMC後に市場が崩れていない場合の見え方です。</p>
    <div class="links">
      <a href="908_final10_decision_workbench_20260606.html">判定ワークベンチで調整</a>
      <a href="898_final_candidate_selection_logic_20260606.html">最終確定ロジック</a>
      <a href="909_final10_current_snapshot_20260606.csv">CSVを開く</a>
      <a href="practical_action_dashboard_20260528.html">実用ダッシュボード</a>
    </div>
  </section>

  <section>
    <h2>2. 保守判定: 市場ゲート黄</h2>
    <p>市場に警戒が残る場合の見え方です。配分目安は<strong>初回投入枠15%(36万円上限)</strong>内の銘柄別配分です。</p>
    <table>
      <thead><tr><th style="width:55px">順</th><th style="width:150px">銘柄</th><th style="width:190px">枠</th><th style="width:70px">点</th><th style="width:120px">分類</th><th style="width:120px">配分目安</th><th>理由</th><th style="width:150px">扱い</th></tr></thead>
      <tbody>${rowsHtml(yellowSelected)}</tbody>
    </table>
  </section>

  <section>
    <h2>3. 仮判定: 市場ゲート緑</h2>
    <p>6月イベント後に市場が崩れていない場合の見え方です。配分目安は<strong>初回投入枠35%(84万円上限)</strong>内の銘柄別配分です。第2回(20%)・第3回(15%)は別途。</p>
    <table>
      <thead><tr><th style="width:55px">順</th><th style="width:150px">銘柄</th><th style="width:190px">枠</th><th style="width:70px">点</th><th style="width:120px">分類</th><th style="width:120px">配分目安</th><th>理由</th><th style="width:150px">扱い</th></tr></thead>
      <tbody>${rowsHtml(greenSelected)}</tbody>
    </table>
  </section>

  <section>
    <h2>4. 説明文</h2>
    <p>現時点では、6月イベント前の保守判定と、イベント通過後の仮判定を分けて確認しています。黄判定では個別株比率を抑え、中心候補を無理に作りません。緑判定になった場合でも、決算後反応、税制/口座確認、高ボラ確認が残る銘柄は条件付きまたは補欠として扱います。量子コンピューターは長期テーマとして監視しますが、1年NISAテストの購入候補にはまだ入れません。</p>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "909_final10_current_snapshot_20260606.csv"), `\uFEFF${csvRows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`, "utf8");
fs.writeFileSync(path.join(ROOT, "909_final10_current_snapshot_20260606.html"), html, "utf8");

console.log("wrote 909_final10_current_snapshot_20260606.html");
console.log("wrote 909_final10_current_snapshot_20260606.csv");
