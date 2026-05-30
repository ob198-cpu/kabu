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

const meta = {
  "8035.T": { name: "東京エレクトロン", category: "半導体製造装置・材料", role: "前工程装置" },
  "6857.T": { name: "アドバンテスト", category: "半導体製造装置・材料", role: "AI半導体テスター" },
  "7735.T": { name: "SCREEN HD", category: "半導体製造装置・材料", role: "洗浄装置" },
  "6146.T": { name: "ディスコ", category: "半導体製造装置・材料", role: "切断・研削・先端パッケージ" },
  "6525.T": { name: "KOKUSAI ELECTRIC", category: "半導体製造装置・材料", role: "成膜・熱処理" },
  "6920.T": { name: "レーザーテック", category: "半導体製造装置・材料", role: "EUV検査" },
  "4063.T": { name: "信越化学工業", category: "半導体製造装置・材料", role: "ウェハ・材料" },
  "3436.T": { name: "SUMCO", category: "半導体製造装置・材料", role: "シリコンウェハ" },
  "4186.T": { name: "東京応化工業", category: "半導体製造装置・材料", role: "フォトレジスト" },
  "4369.T": { name: "トリケミカル研究所", category: "半導体製造装置・材料", role: "高純度化学品" },
  "5803.T": { name: "フジクラ", category: "データセンター・電力・冷却・電線", role: "光配線・高速ケーブル" },
  "5802.T": { name: "住友電工", category: "データセンター・電力・冷却・電線", role: "光ファイバー・電力ケーブル" },
  "5801.T": { name: "古河電工", category: "データセンター・電力・冷却・電線", role: "光ファイバー・電力線・放熱" },
  "6501.T": { name: "日立製作所", category: "データセンター・電力・冷却・電線", role: "送配電・電力制御" },
  "7011.T": { name: "三菱重工業", category: "データセンター・電力・冷却・電線", role: "電力・冷却・大型インフラ" },
  "6503.T": { name: "三菱電機", category: "データセンター・電力・冷却・電線", role: "電力機器・冷却・FA" },
  "6504.T": { name: "富士電機", category: "データセンター・電力・冷却・電線", role: "UPS・電源設備" },
  "6367.T": { name: "ダイキン工業", category: "データセンター・電力・冷却・電線", role: "空調・冷却" },
  "1969.T": { name: "高砂熱学工業", category: "データセンター・電力・冷却・電線", role: "空調設備工事" },
  "1942.T": { name: "関電工", category: "データセンター・電力・冷却・電線", role: "電気設備工事" },
};

function parseCsv(text) {
  text = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let quote = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quote) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quote = false;
      else cell += ch;
    } else if (ch === '"') quote = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  const headers = rows.shift() || [];
  return rows
    .filter((items) => items.some((item) => String(item).trim() !== ""))
    .map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] || ""])));
}

const n = (value) => {
  const parsed = Number(String(value ?? "").replace(/,/g, "").replace(/%/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
};
const round = (value, digits = 1) => value == null || Number.isNaN(value) ? "" : Math.round(value * (10 ** digits)) / (10 ** digits);
const pct = (value) => n(value) == null ? "未取得" : `${round(n(value), 1)}%`;
const point = (value) => n(value) == null ? "未取得" : `${round(n(value), 1)}点`;
const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const csvCell = (value) => /[",\n\r]/.test(String(value ?? "")) ? `"${String(value ?? "").replace(/"/g, '""')}"` : String(value ?? "");

const rows = parseCsv(fs.readFileSync(path.join(ROOT, "786_theme20_ai_infra_screening_20260529.csv"), "utf8")).map((row) => {
  const ticker = row["コード"];
  const m = meta[ticker] || { name: row["銘柄"], category: row["テーマ群"], role: row["役割"] };
  const score = n(row["実用スコア"]);
  const confidence = n(row["信頼度"]) || 0;
  const available = row["充足項目"] || "";
  const per = n(row["PER"]);
  const pbr = n(row["PBR"]);
  const roe = n(row["ROE"]);
  const ret1y = n(row["1年騰落"]);
  const ret60 = n(row["60日騰落"]);
  const dd5 = n(row["5年最大下落"]);
  const dd1 = n(row["1年最大下落"]);
  const vol = n(row["1年ボラ"]);
  const issues = [];
  if (confidence < 90) issues.push("信頼度90未満");
  if (available !== "4/4") issues.push("主要4項目未充足");
  if ([per, pbr, roe].filter((v) => v !== null).length < 2) issues.push("PER/PBR/ROE不足");
  if (ret1y !== null && ret1y >= 150) issues.push("1年急騰");
  if (ret60 !== null && ret60 >= 30) issues.push("60日急騰");
  if (dd5 !== null && dd5 <= -55) issues.push("5年下落深い");
  if (dd1 !== null && dd1 <= -30) issues.push("1年下落深い");
  if (vol !== null && vol >= 65) issues.push("ボラ高い");
  let status = "除外";
  if (score !== null && confidence >= 90 && available === "4/4" && score >= 50 && [per, pbr, roe].filter((v) => v !== null).length >= 2) {
    status = issues.some((x) => /急騰|下落深い|ボラ高い/.test(x)) ? "条件付きテスト候補" : "テスト候補";
  } else if (score !== null && confidence >= 90 && available === "4/4" && score >= 44) {
    status = "補欠";
  } else if (score !== null && score >= 50) {
    status = "データ補完後に再判定";
  }
  return { ...row, ticker, name: m.name, category: m.category, role: m.role, score, confidence, issues, status };
});

const statusRank = { "テスト候補": 0, "条件付きテスト候補": 1, "補欠": 2, "データ補完後に再判定": 3, "除外": 4 };
const byCategory = (category) => rows
  .filter((row) => row.category === category)
  .sort((a, b) => (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9) || (b.score ?? -1) - (a.score ?? -1))
  .map((row, index) => ({ ...row, categoryRank: index + 1 }));

const semi = byCategory("半導体製造装置・材料");
const infra = byCategory("データセンター・電力・冷却・電線");
const all = [...semi, ...infra];

function reason(row) {
  const parts = [
    `実用スコア${point(row.score)}`,
    `5年CAGR${pct(row["5年CAGR"])}`,
    `10年CAGR${pct(row["10年CAGR"])}`,
    `5年S&P差${pct(row["5年S&P差"])}`,
    `5年最大下落${pct(row["5年最大下落"])}`,
  ];
  return `${parts.join("、")}。警戒点: ${row.issues.join("、") || "重大な警戒表示なし"}。`;
}

const csvRows = all.map((row) => ({
  "分野": row.category,
  "分野内順位": row.categoryRank,
  "コード": row.ticker,
  "銘柄": row.name,
  "役割": row.role,
  "扱い": row.status,
  "実用スコア": round(row.score),
  "4項目平均": row["4項目平均"],
  "信頼度": row.confidence,
  "5年CAGR": row["5年CAGR"],
  "10年CAGR": row["10年CAGR"],
  "1年騰落": row["1年騰落"],
  "60日騰落": row["60日騰落"],
  "5年S&P差": row["5年S&P差"],
  "5年最大下落": row["5年最大下落"],
  "1年最大下落": row["1年最大下落"],
  "PER": row["PER"],
  "PBR": row["PBR"],
  "ROE": row["ROE"],
  "警戒点": row.issues.join(" / "),
  "判断理由": reason(row),
}));
const headers = Object.keys(csvRows[0]);
fs.writeFileSync(path.join(ROOT, "788_theme20_separate_screened10_20260529.csv"), `\uFEFF${[headers.join(","), ...csvRows.map((row) => headers.map((h) => csvCell(row[h])).join(","))].join("\n")}\n`, "utf8");

function tableRows(list) {
  return list.map((row) => `
    <tr class="${row.status === "テスト候補" ? "pass" : row.status === "条件付きテスト候補" ? "conditional" : row.status === "補欠" ? "reserve" : row.status === "データ補完後に再判定" ? "review" : "drop"}">
      <td>${row.categoryRank}</td>
      <td><b>${esc(row.ticker)} ${esc(row.name)}</b><br><small>${esc(row.role)}</small></td>
      <td>${esc(row.status)}</td>
      <td>${point(row.score)}</td>
      <td>${esc(row["信頼度"])}</td>
      <td>${pct(row["5年CAGR"])}<br><small>10年 ${pct(row["10年CAGR"])}</small></td>
      <td>${pct(row["5年S&P差"])}<br><small>1年 ${pct(row["1年S&P差"])}</small></td>
      <td>${pct(row["5年最大下落"])}<br><small>1年 ${pct(row["1年最大下落"])}</small></td>
      <td>PER ${esc(row["PER"] || "未取得")}<br>PBR ${esc(row["PBR"] || "未取得")}<br>ROE ${esc(row["ROE"] ? `${row["ROE"]}%` : "未取得")}</td>
      <td>${esc(row.issues.join(" / ") || "重大な警戒表示なし")}</td>
    </tr>
    <tr class="reason"><td></td><td colspan="9">${esc(reason(row))}</td></tr>
  `).join("");
}

function summary(list) {
  const count = (status) => list.filter((row) => row.status === status).length;
  return `テスト候補${count("テスト候補")}社 / 条件付きテスト候補${count("条件付きテスト候補")}社 / 補欠${count("補欠")}社 / データ補完${count("データ補完後に再判定")}社 / 除外${count("除外")}社`;
}

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AIインフラ関連 分野別スクリーニング10社ずつ</title>
  <style>
    :root{--ink:#061827;--navy:#0b3556;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--pass:#eaf8f0;--cond:#fff8e8;--reserve:#eef5ff;--review:#fffaf1;--drop:#fff1f1}
    *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--ink);font-family:"Yu Gothic","Meiryo",Arial,sans-serif;line-height:1.65}
    header{background:var(--navy);color:#fff;padding:28px 32px} header h1{margin:0 0 8px;font-size:clamp(28px,4vw,40px);line-height:1.2;letter-spacing:0} header p{margin:0;color:#fff;font-weight:800}
    main{max-width:1440px;margin:0 auto;padding:22px} section{background:#fff;border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08)}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;font-size:24px}.note{border-left:7px solid #b76500;background:#fff7e7;padding:12px;margin:12px 0;color:#111;font-weight:800}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.card{border:1px solid var(--line);border-radius:10px;padding:12px;background:#fbfdff}.card b{display:block;color:#0b3556;font-size:18px}.card span{font-weight:900;color:#111}
    .links a{display:inline-block;margin:6px 8px 0 0;background:#0b67a3;color:#fff;text-decoration:none;border-radius:8px;padding:9px 12px;font-weight:900}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:#fff} table{width:100%;border-collapse:collapse;min-width:1320px;font-size:13px;table-layout:fixed}
    th,td{border:1px solid var(--line);padding:8px;vertical-align:top;overflow-wrap:anywhere;word-break:break-word;color:#111} th{background:#e5f1fa;color:#073b62;text-align:left;font-weight:900}
    tr.pass td{background:var(--pass)} tr.conditional td{background:var(--cond)} tr.reserve td{background:var(--reserve)} tr.review td{background:var(--review)} tr.drop td{background:var(--drop)} tr.reason td{background:#fff;border-top:0;font-size:12px;color:#222}
    @media(max-width:980px){main{padding:12px}.grid{grid-template-columns:1fr}table{font-size:12px;min-width:1180px}}
  </style>
</head>
<body>
<header>
  <h1>AIインフラ関連 分野別スクリーニング10社ずつ</h1>
  <p>作成: ${esc(generatedAt)} / 20社を混ぜず、半導体製造装置・材料10社とデータセンター・電力・冷却・電線10社を分けて判定</p>
</header>
<main>
  <section>
    <h2>1. 結論</h2>
    <p class="note">前回の「総合10社」は2分野を混ぜた一覧でした。このページは分野を混ぜず、それぞれ10社を最後まで同じゲートで評価した一覧です。購入確定ではなく、6月の主要イベント確認後に再判定するテスト候補の優先順位です。</p>
    <div class="grid">
      <div class="card"><b>半導体製造装置・材料</b><span>${esc(summary(semi))}</span></div>
      <div class="card"><b>データセンター・電力・冷却・電線</b><span>${esc(summary(infra))}</span></div>
    </div>
    <div class="links">
      <a href="788_theme20_separate_screened10_20260529.csv">分野別CSV</a>
      <a href="786_theme20_ai_infra_screening_20260529.csv">元データCSV</a>
    </div>
  </section>

  <section id="semiconductor">
    <h2>2. 半導体製造装置・材料 10社</h2>
    <div class="table-wrap"><table>
      <thead><tr><th style="width:48px">順位</th><th style="width:210px">銘柄</th><th style="width:110px">扱い</th><th style="width:90px">実用</th><th style="width:70px">信頼度</th><th style="width:110px">CAGR</th><th style="width:110px">S&P差</th><th style="width:110px">最大下落</th><th style="width:120px">PER/PBR/ROE</th><th>警戒点</th></tr></thead>
      <tbody>${tableRows(semi)}</tbody>
    </table></div>
  </section>

  <section id="datacenter">
    <h2>3. データセンター・電力・冷却・電線 10社</h2>
    <div class="table-wrap"><table>
      <thead><tr><th style="width:48px">順位</th><th style="width:210px">銘柄</th><th style="width:110px">扱い</th><th style="width:90px">実用</th><th style="width:70px">信頼度</th><th style="width:110px">CAGR</th><th style="width:110px">S&P差</th><th style="width:110px">最大下落</th><th style="width:120px">PER/PBR/ROE</th><th>警戒点</th></tr></thead>
      <tbody>${tableRows(infra)}</tbody>
    </table></div>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "theme20_separate_screened10_20260529.html"), html, "utf8");
console.log("wrote 788_theme20_separate_screened10_20260529.csv");
console.log("wrote theme20_separate_screened10_20260529.html");
console.log("半導体製造装置・材料");
console.log(semi.map((row) => `${row.categoryRank}. ${row.ticker} ${row.name} ${row.status} ${round(row.score)}点`).join("\n"));
console.log("データセンター・電力・冷却・電線");
console.log(infra.map((row) => `${row.categoryRank}. ${row.ticker} ${row.name} ${row.status} ${round(row.score)}点`).join("\n"));
