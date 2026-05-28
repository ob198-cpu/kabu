import fs from "fs";
import path from "path";

const ROOT = process.cwd();

const readCsv = (file) => {
  const text = fs.readFileSync(path.join(ROOT, file), "utf8").replace(/^\uFEFF/, "");
  const lines = text.trim().split(/\r?\n/);
  const headers = parseLine(lines[0]);
  return lines.slice(1).filter(Boolean).map((line) => {
    const values = parseLine(line);
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] ?? "";
    });
    return row;
  });
};

function parseLine(line) {
  const out = [];
  let cur = "";
  let quote = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quote && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        quote = !quote;
      }
    } else if (ch === "," && !quote) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

const num = (value) => {
  const text = String(value ?? "").replace(/,/g, "").replace(/%/g, "").trim();
  if (!text) return null;
  const n = Number(text);
  return Number.isFinite(n) ? n : null;
};

const round1 = (value) => (value == null ? "" : Math.round(value * 10) / 10);
const pct = (value) => (value == null ? "未取得" : `${round1(value)}%`);
const point = (value) => (value == null ? "未取得" : `${round1(value)}点`);

const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const existingRows = readCsv("199_universe100_screening.csv");
const longRows = readCsv("728_universe100_long_term_stability_score.csv");
const morningRows = readCsv("780_universe100_reselection_metrics_20260528.csv");
const oldCandidateSet = new Set([
  ...readCsv("764_morning_recalc_top10.csv").map((row) => row.ticker),
  ...readCsv("741_top10_selection_gate.csv").map((row) => row.ticker),
  ...readCsv("657_focus10_recalculated_selection.csv").map((row) => row.ticker),
].filter(Boolean));

const byTicker = new Map();
const merge = (ticker, patch) => {
  if (!ticker) return;
  byTicker.set(ticker, { ...(byTicker.get(ticker) || {}), ticker, ...patch });
};

for (const row of existingRows) {
  merge(row.ticker, {
    existingScore: num(row.universe_score_100),
    oldRank: num(row.screening_rank),
    oldDecision: row.decision,
    oldCandidate: oldCandidateSet.has(row.ticker),
    oldSource: "199_universe100_screening.csv",
  });
}

for (const row of longRows) {
  merge(row["コード"], {
    company: row["銘柄"],
    longTermScore: num(row["長期安定性スコア"]),
    cagr5: num(row["5年CAGR"]),
    cagr10: num(row["10年CAGR"]),
    sp5Diff: num(row["5年S&P差"]),
    dd5: num(row["5年最大下落率"]),
    monthlyWin: num(row["月次勝率"]),
  });
}

for (const row of morningRows) {
  merge(row["コード"], {
    company: row["銘柄"],
    previous10: row["旧10社"] || "",
    morningRank: num(row["再計算順位"]),
    morningScore: num(row["再選定点"]),
    morningStatus: row["最終扱い"],
    cagr5: num(row["5年CAGR"]),
    cagr10: num(row["10年CAGR"]),
    ret1y: num(row["直近1年騰落率"]),
    ret60d: num(row["60日騰落率"]),
    sp5Diff: num(row["5年S&P差"]),
    sp1yDiff: num(row["直近1年S&P差"]),
    dd5: num(row["5年最大下落率"]),
    dd1y: num(row["直近1年最大下落率"]),
    monthlyWin: num(row["月次勝率"]),
    missingCount: num(row["取得項目数"]),
    morningExcludeReason: row["除外理由"] || "",
    morningNote: row["確認事項"] || "",
  });
}

const rows = Array.from(byTicker.values()).filter((row) => row.existingScore != null && row.longTermScore != null);

const percentileScores = (values, higherBetter = true) => {
  const valid = values.filter((item) => item.value != null);
  const sorted = valid.slice().sort((a, b) => higherBetter ? b.value - a.value : a.value - b.value);
  const scores = new Map();
  const n = sorted.length;
  sorted.forEach((item, index) => {
    scores.set(item.ticker, n <= 1 ? 100 : 100 - (index / (n - 1)) * 100);
  });
  return scores;
};

const sp5Scores = percentileScores(rows.map((row) => ({ ticker: row.ticker, value: row.sp5Diff })), true);
const sp1Scores = percentileScores(rows.map((row) => ({ ticker: row.ticker, value: row.sp1yDiff })), true);
const dd5Scores = percentileScores(rows.map((row) => ({ ticker: row.ticker, value: row.dd5 })), true);
const dd1Scores = percentileScores(rows.map((row) => ({ ticker: row.ticker, value: row.dd1y })), true);

const averageAvailable = (...values) => {
  const valid = values.filter((value) => value != null && Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
};

const integratedRows = rows.map((row) => {
  const spScore = averageAvailable(sp5Scores.get(row.ticker), sp1Scores.get(row.ticker));
  const downsideScore = averageAvailable(dd5Scores.get(row.ticker), dd1Scores.get(row.ticker));
  const totalScore = row.existingScore + row.longTermScore + (spScore ?? 0) + (downsideScore ?? 0);
  const integratedScore = totalScore / 4;

  const hardReasons = [];
  if (row.morningExcludeReason) hardReasons.push(row.morningExcludeReason);
  if (row.ret60d != null && row.ret60d < -15) hardReasons.push("直近60日が弱い");
  if (row.dd1y != null && row.dd1y < -30) hardReasons.push("直近1年の最大下落率が大きい");
  if (row.dd5 != null && row.dd5 < -60) hardReasons.push("過去5年の最大下落率が大きい");

  let finalStatus = "候補";
  if (hardReasons.length) finalStatus = "除外";
  else if (row.morningStatus === "監視" || row.ret1y > 250 || row.dd5 < -45) finalStatus = "監視";

  let reason = "既存スコアを土台に、長期安定性・S&P比較・下落耐性を加えて再評価。";
  if (finalStatus === "除外") {
    reason = `除外条件: ${[...new Set(hardReasons)].join(" / ")}`;
  } else if (finalStatus === "監視") {
    reason = "総合点は高いが、急騰後反動または下落幅の確認が必要。";
  } else if (row.oldCandidate || row.previous10) {
    reason = "旧候補にも残り、追加指標でも候補圏を維持。";
  } else {
    reason = "旧候補外だが、既存スコアと追加指標の合算で候補圏に浮上。";
  }

  return {
    ...row,
    spScore,
    downsideScore,
    totalScore,
    integratedScore,
    finalStatus,
    finalReason: reason,
  };
});

integratedRows.sort((a, b) => b.integratedScore - a.integratedScore);
integratedRows.forEach((row, index) => row.integratedRank = index + 1);

const selected = integratedRows.filter((row) => row.finalStatus === "候補").slice(0, 10);
selected.forEach((row, index) => row.selectedRank = index + 1);

const headers = [
  "統合順位",
  "統合10社順位",
  "コード",
  "銘柄",
  "旧候補",
  "統合扱い",
  "4項目合計",
  "総合スコア100点換算",
  "既存選定スコア",
  "長期安定性",
  "S&P比較",
  "下落耐性",
  "5年CAGR",
  "10年CAGR",
  "直近1年",
  "60日",
  "5年S&P差",
  "直近1年S&P差",
  "5年最大下落",
  "直近1年最大下落",
  "理由",
];

const toCsvCell = (value) => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const csvRows = integratedRows.map((row) => ({
  "統合順位": row.integratedRank,
  "統合10社順位": selected.includes(row) ? row.selectedRank : "",
  "コード": row.ticker,
  "銘柄": row.company,
  "旧候補": row.oldCandidate || row.previous10 ? "旧候補" : "",
  "統合扱い": row.finalStatus,
  "4項目合計": round1(row.totalScore),
  "総合スコア100点換算": round1(row.integratedScore),
  "既存選定スコア": round1(row.existingScore),
  "長期安定性": round1(row.longTermScore),
  "S&P比較": round1(row.spScore),
  "下落耐性": round1(row.downsideScore),
  "5年CAGR": round1(row.cagr5),
  "10年CAGR": round1(row.cagr10),
  "直近1年": round1(row.ret1y),
  "60日": round1(row.ret60d),
  "5年S&P差": round1(row.sp5Diff),
  "直近1年S&P差": round1(row.sp1yDiff),
  "5年最大下落": round1(row.dd5),
  "直近1年最大下落": round1(row.dd1y),
  "理由": row.finalReason,
}));

fs.writeFileSync(
  path.join(ROOT, "784_integrated_recalculation_scores_20260528.csv"),
  [headers.join(","), ...csvRows.map((row) => headers.map((header) => toCsvCell(row[header])).join(","))].join("\n"),
  "utf8"
);

fs.writeFileSync(
  path.join(ROOT, "785_integrated_recalculated_10_20260528.csv"),
  [
    headers.join(","),
    ...csvRows
      .filter((row) => row["統合10社順位"])
      .sort((a, b) => Number(a["統合10社順位"]) - Number(b["統合10社順位"]))
      .map((row) => headers.map((header) => toCsvCell(row[header])).join(",")),
  ].join("\n"),
  "utf8"
);

const selectedTable = selected.map((row) => `
  <tr>
    <td>${row.selectedRank}</td>
    <td>${escapeHtml(row.ticker)} ${escapeHtml(row.company)}</td>
    <td>${point(row.totalScore)}</td>
    <td>${point(row.integratedScore)}</td>
    <td>${point(row.existingScore)}</td>
    <td>${point(row.longTermScore)}</td>
    <td>${point(row.spScore)}</td>
    <td>${point(row.downsideScore)}</td>
    <td>${escapeHtml(row.oldCandidate || row.previous10 ? "旧候補" : "新規浮上")}</td>
    <td>${escapeHtml(row.finalReason)}</td>
  </tr>
`).join("");

const comparisonRows = integratedRows.slice(0, 30).map((row) => `
  <tr class="${row.finalStatus === "除外" ? "drop" : row.finalStatus === "監視" ? "watch" : ""}">
    <td>${row.integratedRank}</td>
    <td>${escapeHtml(row.ticker)} ${escapeHtml(row.company)}</td>
    <td>${escapeHtml(row.finalStatus)}</td>
    <td>${point(row.totalScore)}</td>
    <td>${point(row.integratedScore)}</td>
    <td>${point(row.existingScore)}</td>
    <td>${point(row.longTermScore)}</td>
    <td>${point(row.spScore)}</td>
    <td>${point(row.downsideScore)}</td>
    <td>${pct(row.cagr5)}</td>
    <td>${pct(row.cagr10)}</td>
    <td>${pct(row.ret1y)}</td>
    <td>${pct(row.ret60d)}</td>
    <td>${pct(row.sp5Diff)}</td>
    <td>${pct(row.sp1yDiff)}</td>
    <td>${pct(row.dd5)}</td>
    <td>${pct(row.dd1y)}</td>
    <td>${escapeHtml(row.finalReason)}</td>
  </tr>
`).join("");

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>統合再計算 10社候補 2026年5月28日</title>
  <style>
    body{margin:0;background:#f4f7fb;color:#071624;font-family:"Yu Gothic","Meiryo",Arial,sans-serif;line-height:1.65}
    main{max-width:1240px;margin:0 auto;padding:28px}
    h1{margin:0;color:#123d63;font-size:32px}
    h2{margin:24px 0 10px;color:#123d63;border-left:8px solid #0b5f96;padding-left:12px}
    .lead{background:#123d63;color:#fff;border-radius:14px;padding:20px;margin-bottom:16px}
    .lead p{margin:8px 0 0;color:#e7f1fb}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:14px 0}
    .card{background:#fff;border:1px solid #d5e2ee;border-radius:12px;padding:14px}
    .card b{display:block;color:#456}
    .card span{display:block;font-size:28px;font-weight:900;color:#0b5f96}
    .note{background:#fff8eb;border-left:7px solid #c06b00;padding:12px;margin:12px 0}
    .table-wrap{overflow-x:auto;background:#fff;border:1px solid #d5e2ee;border-radius:12px}
    table{width:100%;border-collapse:collapse;min-width:1060px}
    th,td{border:1px solid #d5e2ee;padding:8px;vertical-align:top;font-size:13px}
    th{background:#e6f1fb;color:#123d63;text-align:left}
    tr.watch td{background:#fffaf1}
    tr.drop td{background:#fff5f5;color:#6c1f1f}
    .links{display:flex;gap:10px;flex-wrap:wrap;margin:12px 0}
    .button{display:inline-block;background:#0b5f96;color:#fff;text-decoration:none;border-radius:9px;padding:9px 12px;font-weight:800}
    code{background:#edf3f8;border:1px solid #d5e2ee;border-radius:6px;padding:2px 5px}
  </style>
</head>
<body>
<main>
  <section class="lead">
    <h1>統合再計算 10社候補</h1>
    <p>昨日までの既存選定スコアを土台に残し、今朝追加した長期安定性・S&P比較・下落耐性を補助指標として統合しました。今朝の指標だけで選び直したものではありません。</p>
  </section>
  <div class="cards">
    <div class="card"><b>対象母集団</b><span>${integratedRows.length}</span><p>既存スコアと追加指標が突合できた銘柄数</p></div>
    <div class="card"><b>計算方法</b><span>合計</span><p>任意の重み付けは使わない</p></div>
    <div class="card"><b>評価項目</b><span>4</span><p>既存、長期、S&P、下落耐性</p></div>
    <div class="card"><b>統合候補</b><span>${selected.length}</span><p>除外・監視を外した上位</p></div>
  </div>
  <p class="note">計算式: <code>総合スコア = 既存選定スコア + 長期安定性 + S&P比較 + 下落耐性</code>。表では4項目合計と、比較しやすい100点換算値を併記しています。S&P比較と下落耐性は100社内順位点に変換して使用しています。</p>
  <div class="links">
    <a class="button" href="784_integrated_recalculation_scores_20260528.csv">全件CSV</a>
    <a class="button" href="785_integrated_recalculated_10_20260528.csv">統合10社CSV</a>
    <a class="button" href="universe100_reselected_10_candidates_20260528.html">今朝の再選定結果</a>
  </div>
  <h2>1. 統合後の10社</h2>
  <div class="table-wrap"><table>
    <thead><tr><th>順位</th><th>銘柄</th><th>4項目合計</th><th>100点換算</th><th>既存</th><th>長期</th><th>S&P</th><th>下落耐性</th><th>区分</th><th>理由</th></tr></thead>
    <tbody>${selectedTable}</tbody>
  </table></div>
  <h2>2. 上位30社の比較</h2>
  <div class="table-wrap"><table>
    <thead><tr><th>統合順位</th><th>銘柄</th><th>扱い</th><th>4項目合計</th><th>100点換算</th><th>既存</th><th>長期</th><th>S&P</th><th>下落耐性</th><th>5年CAGR</th><th>10年CAGR</th><th>直近1年</th><th>60日</th><th>5年S&P差</th><th>1年S&P差</th><th>5年最大下落</th><th>1年最大下落</th><th>理由</th></tr></thead>
    <tbody>${comparisonRows}</tbody>
  </table></div>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "integrated_recalculated_10_20260528.html"), html, "utf8");

console.log("wrote 784_integrated_recalculation_scores_20260528.csv");
console.log("wrote 785_integrated_recalculated_10_20260528.csv");
console.log("wrote integrated_recalculated_10_20260528.html");
console.log(selected.map((row) => `${row.selectedRank}. ${row.ticker} ${row.company} ${round1(row.integratedScore)}`).join("\n"));
