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

const companyMeta = {
  "5803.T": { name: "フジクラ", theme: "データセンター・電力・電線", role: "光配線・高速ケーブル" },
  "5801.T": { name: "古河電工", theme: "データセンター・電力・電線", role: "光ファイバー・電力線・放熱" },
  "5802.T": { name: "住友電工", theme: "データセンター・電力・電線", role: "光ファイバー・電力ケーブル" },
  "1942.T": { name: "関電工", theme: "データセンター・電力・設備", role: "電気設備工事" },
  "7011.T": { name: "三菱重工業", theme: "電力・冷却・インフラ", role: "電力・冷却・大型インフラ" },
  "6857.T": { name: "アドバンテスト", theme: "半導体製造装置", role: "AI半導体テスター" },
  "6503.T": { name: "三菱電機", theme: "電力・冷却・FA", role: "電力機器・冷却・FA" },
  "4186.T": { name: "東京応化工業", theme: "半導体材料", role: "フォトレジスト" },
  "6501.T": { name: "日立製作所", theme: "電力・データセンター", role: "送配電・電力制御" },
  "6146.T": { name: "ディスコ", theme: "半導体製造装置", role: "切断・研削・先端パッケージ" },
  "6525.T": { name: "KOKUSAI ELECTRIC", theme: "半導体製造装置", role: "成膜・熱処理" },
  "8035.T": { name: "東京エレクトロン", theme: "半導体製造装置", role: "前工程装置" },
  "1969.T": { name: "高砂熱学工業", theme: "データセンター冷却", role: "空調設備工事" },
  "7735.T": { name: "SCREEN HD", theme: "半導体製造装置", role: "洗浄装置" },
  "6920.T": { name: "レーザーテック", theme: "半導体製造装置", role: "EUV検査" },
  "6367.T": { name: "ダイキン工業", theme: "データセンター冷却", role: "空調・冷却" },
  "6504.T": { name: "富士電機", theme: "データセンター電源", role: "UPS・電源設備" },
  "4063.T": { name: "信越化学工業", theme: "半導体材料", role: "ウェハ・材料" },
  "3436.T": { name: "SUMCO", theme: "半導体材料", role: "シリコンウェハ" },
  "4369.T": { name: "トリケミカル研究所", theme: "半導体材料", role: "高純度化学品" },
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
  if (cell.length || row.length) row.push(cell.replace(/\r$/, ""));
  const headers = rows.shift() || [];
  return rows
    .filter((items) => items.some((item) => String(item).trim() !== ""))
    .map((items) => Object.fromEntries(headers.map((header, index) => [header, items[index] || ""])));
}

function num(value) {
  const n = Number(String(value ?? "").replace(/,/g, "").replace(/%/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function round(value, digits = 1) {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  const m = 10 ** digits;
  return Math.round(Number(value) * m) / m;
}

function fmtPct(value) {
  const n = num(value);
  return n === null ? "未取得" : `${round(n, 1)}%`;
}

function fmtPoint(value) {
  const n = num(value);
  return n === null ? "未取得" : `${round(n, 1)}点`;
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, rows, headers) {
  const body = [headers.join(",")]
    .concat(rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")))
    .join("\n");
  fs.writeFileSync(path.join(ROOT, file), `\uFEFF${body}\n`, "utf8");
}

const source = parseCsv(fs.readFileSync(path.join(ROOT, "786_theme20_ai_infra_screening_20260529.csv"), "utf8"));

const enriched = source.map((row) => {
  const ticker = row["コード"];
  const meta = companyMeta[ticker] || { name: row["銘柄"], theme: row["テーマ群"], role: row["役割"] };
  const score = num(row["実用スコア"]);
  const gross = num(row["4項目平均"]);
  const confidence = num(row["信頼度"]) || 0;
  const available = row["充足項目"] || "";
  const cagr5 = num(row["5年CAGR"]);
  const cagr10 = num(row["10年CAGR"]);
  const ret1y = num(row["1年騰落"]);
  const ret60 = num(row["60日騰落"]);
  const dd5 = num(row["5年最大下落"]);
  const dd1 = num(row["1年最大下落"]);
  const vol1y = num(row["1年ボラ"]);
  const per = num(row["PER"]);
  const pbr = num(row["PBR"]);
  const roe = num(row["ROE"]);
  const issues = [];

  if (confidence < 90) issues.push("信頼度90未満");
  if (available !== "4/4") issues.push("主要4項目未充足");
  if ([per, pbr, roe].filter((v) => v !== null).length < 2) issues.push("PER/PBR/ROE不足");
  if (ret1y !== null && ret1y >= 150) issues.push("1年急騰");
  if (ret60 !== null && ret60 >= 30) issues.push("60日急騰");
  if (dd5 !== null && dd5 <= -55) issues.push("5年下落深い");
  if (dd1 !== null && dd1 <= -30) issues.push("1年下落深い");
  if (vol1y !== null && vol1y >= 65) issues.push("ボラ高い");

  let passLevel = "除外";
  if (score !== null && confidence >= 90 && available === "4/4" && score >= 50 && [per, pbr, roe].filter((v) => v !== null).length >= 2) {
    passLevel = issues.some((x) => /急騰|下落深い|ボラ高い/.test(x)) ? "条件付きテスト候補" : "テスト候補";
  } else if (score !== null && confidence >= 90 && available === "4/4" && score >= 44) {
    passLevel = "補欠";
  } else if (score !== null && confidence >= 50 && score >= 50) {
    passLevel = "データ補完後に再判定";
  }

  return {
    ...row,
    ticker,
    name: meta.name,
    theme: meta.theme,
    role: meta.role,
    score,
    gross,
    confidence,
    cagr5,
    cagr10,
    ret1y,
    ret60,
    dd5,
    dd1,
    vol1y,
    per,
    pbr,
    roe,
    passLevel,
    issues,
  };
});

const levelPriority = { "テスト候補": 0, "条件付きテスト候補": 1, "補欠": 2, "データ補完後に再判定": 3, "除外": 4 };
const final10 = enriched
  .slice()
  .sort((a, b) => {
    const lp = (levelPriority[a.passLevel] ?? 9) - (levelPriority[b.passLevel] ?? 9);
    if (lp !== 0) return lp;
    return (b.score ?? -1) - (a.score ?? -1);
  })
  .slice(0, 10)
  .map((row, index) => ({
    finalRank: index + 1,
    ...row,
  }));

const excluded = enriched
  .filter((row) => !final10.some((item) => item.ticker === row.ticker))
  .sort((a, b) => (levelPriority[a.passLevel] ?? 9) - (levelPriority[b.passLevel] ?? 9) || (b.score ?? -1) - (a.score ?? -1));

function selectionReason(row) {
  const positives = [];
  if (row.score !== null) positives.push(`実用スコア${round(row.score)}点`);
  if (row.cagr5 !== null) positives.push(`5年CAGR${round(row.cagr5)}%`);
  if (row.cagr10 !== null) positives.push(`10年CAGR${round(row.cagr10)}%`);
  if (num(row["5年S&P差"]) !== null) positives.push(`5年S&P差${round(num(row["5年S&P差"]))}%`);
  const risk = row.issues.length ? row.issues.join("、") : "重大な警戒表示なし";
  return `${positives.join("、")}。警戒点: ${risk}。`;
}

const csvRows = final10.map((row) => ({
  "順位": row.finalRank,
  "コード": row.ticker,
  "銘柄": row.name,
  "テーマ": row.theme,
  "役割": row.role,
  "最終扱い": row.passLevel,
  "実用スコア": round(row.score),
  "4項目平均": round(row.gross),
  "信頼度": row.confidence,
  "5年CAGR": round(row.cagr5),
  "10年CAGR": round(row.cagr10),
  "1年騰落": round(row.ret1y),
  "60日騰落": round(row.ret60),
  "5年最大下落": round(row.dd5),
  "1年最大下落": round(row.dd1),
  "1年ボラ": round(row.vol1y),
  "PER": row.per === null ? "" : round(row.per, 2),
  "PBR": row.pbr === null ? "" : round(row.pbr, 2),
  "ROE": row.roe === null ? "" : round(row.roe, 2),
  "警戒点": row.issues.join(" / "),
  "選定理由": selectionReason(row),
}));

writeCsv("787_theme20_final_screened10_20260529.csv", csvRows, Object.keys(csvRows[0]));

function mainRows(rows) {
  return rows.map((row) => `
    <tr class="${row.passLevel === "テスト候補" ? "pass" : row.passLevel === "条件付きテスト候補" ? "conditional" : row.passLevel === "補欠" ? "reserve" : "review"}">
      <td>${row.finalRank ?? ""}</td>
      <td><b>${esc(row.ticker)} ${esc(row.name)}</b><br><small>${esc(row.theme)} / ${esc(row.role)}</small></td>
      <td>${esc(row.passLevel)}</td>
      <td>${fmtPoint(row.score)}</td>
      <td>${fmtPoint(row.gross)}</td>
      <td>${esc(row.confidence)}</td>
      <td>${fmtPct(row.cagr5)}<br><small>10年 ${fmtPct(row.cagr10)}</small></td>
      <td>${fmtPct(row["5年S&P差"])}<br><small>1年 ${fmtPct(row["1年S&P差"])}</small></td>
      <td>${fmtPct(row.dd5)}<br><small>1年 ${fmtPct(row.dd1)}</small></td>
      <td>PER ${row.per === null ? "未取得" : round(row.per, 2)}<br>PBR ${row.pbr === null ? "未取得" : round(row.pbr, 2)}<br>ROE ${row.roe === null ? "未取得" : `${round(row.roe, 2)}%`}</td>
      <td>${esc(row.issues.join(" / ") || "重大な警戒表示なし")}</td>
    </tr>
    <tr class="reason">
      <td></td>
      <td colspan="10">${esc(selectionReason(row))}</td>
    </tr>
  `).join("");
}

function excludedRows(rows) {
  return rows.map((row) => `
    <tr>
      <td>${esc(row.ticker)} ${esc(row.name)}</td>
      <td>${esc(row.passLevel)}</td>
      <td>${fmtPoint(row.score)}</td>
      <td>${esc(row.confidence)}</td>
      <td>${esc(row.issues.join(" / ") || "スコア下位")}</td>
    </tr>
  `).join("");
}

const count = (level) => enriched.filter((row) => row.passLevel === level).length;

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AIインフラ関連20社 最終スクリーニング後10社</title>
  <style>
    :root{--ink:#061827;--navy:#0b3556;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--pass:#eaf8f0;--cond:#fff8e8;--reserve:#eef5ff;--review:#fff1f1}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:"Yu Gothic","Meiryo",Arial,sans-serif;line-height:1.65}
    header{background:var(--navy);color:#fff;padding:28px 32px}
    header h1{margin:0 0 8px;font-size:clamp(28px,4vw,40px);line-height:1.2;letter-spacing:0}
    header p{margin:0;color:#fff;font-weight:800}
    main{max-width:1420px;margin:0 auto;padding:22px}
    section{background:#fff;border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08)}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;font-size:24px}
    .cards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
    .card{border:1px solid var(--line);border-radius:10px;padding:12px;background:#fbfdff}
    .card b{display:block;color:#345}.card span{display:block;font-size:26px;font-weight:900;color:var(--blue)}
    .note{border-left:7px solid #b76500;background:#fff7e7;padding:12px;margin:12px 0;color:#111;font-weight:800}
    .rule{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
    .rule div{border:1px solid var(--line);border-radius:10px;padding:10px;background:#f8fbfe}
    .rule b{display:block;color:#0b3556;margin-bottom:4px}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:#fff}
    table{width:100%;border-collapse:collapse;min-width:1320px;font-size:13px;table-layout:fixed}
    th,td{border:1px solid var(--line);padding:8px;vertical-align:top;overflow-wrap:anywhere;word-break:break-word;color:#111}
    th{background:#e5f1fa;color:#073b62;text-align:left;font-weight:900}
    tr.pass td{background:var(--pass)} tr.conditional td{background:var(--cond)} tr.reserve td{background:var(--reserve)} tr.review td{background:var(--review)}
    tr.reason td{background:#fff;border-top:0;font-size:12px;color:#222}
    .links a{display:inline-block;margin:6px 8px 0 0;background:#0b67a3;color:#fff;text-decoration:none;border-radius:8px;padding:9px 12px;font-weight:900}
    @media(max-width:1000px){main{padding:12px}.cards,.rule{grid-template-columns:1fr}table{font-size:12px;min-width:1180px}}
  </style>
</head>
<body>
  <header>
    <h1>AIインフラ関連20社 最終スクリーニング後10社</h1>
    <p>作成: ${esc(generatedAt)} / 対象: 半導体製造装置・材料10社、データセンター・電力・冷却・電線10社</p>
  </header>
  <main>
    <section>
      <h2>1. 結論</h2>
      <div class="cards">
        <div class="card"><b>対象</b><span>20社</span></div>
        <div class="card"><b>テスト候補</b><span>${count("テスト候補")}社</span></div>
        <div class="card"><b>条件付きテスト候補</b><span>${count("条件付きテスト候補")}社</span></div>
        <div class="card"><b>補欠</b><span>${count("補欠")}社</span></div>
        <div class="card"><b>今回の10社</b><span>10社</span></div>
      </div>
      <p class="note">この10社は「購入確定」ではありません。20社を最後まで通した結果、現時点でNISA 1年保有テストの検討対象に残せる順番です。6月のCPI・日銀・FOMC後に、指数・為替・金利・各社の追加データを入れて再判定します。</p>
      <div class="links">
        <a href="787_theme20_final_screened10_20260529.csv">最終10社CSV</a>
        <a href="786_theme20_ai_infra_screening_20260529.csv">20社全件CSV</a>
      </div>
    </section>

    <section>
      <h2>2. 今回の通過条件</h2>
      <div class="rule">
        <div><b>母集団</b>AIインフラに構造的に関係する20社のみ。質的テーマは入口で使い、点数に直接加算しない。</div>
        <div><b>主要4項目</b>既存選定、長期安定、S&P比較、下落耐性の4項目を確認する。</div>
        <div><b>信頼度</b>原則90以上を優先。90未満は点数が高くてもデータ補完扱いにする。</div>
        <div><b>警戒点</b>急騰、最大下落、ボラティリティ、PER/PBR/ROE不足を表示し、買い判断へ直結させない。</div>
      </div>
    </section>

    <section>
      <h2>3. 最終スクリーニング後の10社</h2>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th style="width:48px">順位</th>
              <th style="width:210px">銘柄</th>
              <th style="width:90px">扱い</th>
              <th style="width:90px">実用</th>
              <th style="width:90px">4項目</th>
              <th style="width:70px">信頼度</th>
              <th style="width:110px">CAGR</th>
              <th style="width:110px">S&P差</th>
              <th style="width:110px">最大下落</th>
              <th style="width:120px">PER/PBR/ROE</th>
              <th>警戒点</th>
            </tr>
          </thead>
          <tbody>${mainRows(final10)}</tbody>
        </table>
      </div>
    </section>

    <section>
      <h2>4. 今回10社から外した主な銘柄</h2>
      <div class="table-wrap">
        <table>
          <thead><tr><th>銘柄</th><th>扱い</th><th>実用スコア</th><th>信頼度</th><th>理由</th></tr></thead>
          <tbody>${excludedRows(excluded)}</tbody>
        </table>
      </div>
    </section>
  </main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "theme20_final_screened10_20260529.html"), html, "utf8");

console.log("wrote 787_theme20_final_screened10_20260529.csv");
console.log("wrote theme20_final_screened10_20260529.html");
console.log(final10.map((row) => `${row.finalRank}. ${row.ticker} ${row.name} ${row.passLevel} ${round(row.score)}点`).join("\n"));
