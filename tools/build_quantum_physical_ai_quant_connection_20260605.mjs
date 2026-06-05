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

function parseCsv(text) {
  text = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
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
const has = (value) => value !== undefined && value !== null && String(value).trim() !== "";
const round = (value, digits = 1) => value === null || Number.isNaN(value) ? "" : Math.round(value * (10 ** digits)) / (10 ** digits);
const esc = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");
const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const candidates = parseCsv(fs.readFileSync(path.join(ROOT, "886_quantum_physical_ai_screening_20260605.csv"), "utf8"));
const universe = parseCsv(fs.readFileSync(path.join(ROOT, "199_universe100_screening.csv"), "utf8"));
const universeByTicker = new Map(universe.map((row) => [row.ticker, row]));

const requiredFields = [
  ["universe_score_100", "既存100社スコア"],
  ["per_forecast", "PER"],
  ["pbr_actual", "PBR"],
  ["roe_actual_pct", "ROE"],
  ["revenue_yoy_pct", "売上前年比"],
  ["profit_yoy_pct", "利益前年比"],
  ["ret1y_pct", "1年騰落率"],
  ["max_drawdown60_pct", "60日最大下落"],
  ["above_ma200_pct", "200日線乖離"],
];

function judge(row, source) {
  if (!source) {
    return {
      matched: "未接続",
      completeness: 0,
      gate: "数値接続前",
      reason: "既存100社スクリーニング表に同一tickerがないため、購入候補判定には使わない。",
    };
  }
  const filled = requiredFields.filter(([field]) => has(source[field])).length;
  const completeness = Math.round((filled / requiredFields.length) * 100);
  const score = n(source.universe_score_100);
  const riskPenalty = n(source.risk_penalty);
  const drawdown = n(source.max_drawdown60_pct);
  const per = n(source.per_forecast);
  const ret1y = n(source.ret1y_pct);

  const blockers = [];
  if (completeness < 70) blockers.push("主要指標の入力率70%未満");
  if (score !== null && score < 50) blockers.push("既存100社スコア50点未満");
  if (riskPenalty !== null && riskPenalty >= 6) blockers.push("リスク減点が大きい");
  if (drawdown !== null && drawdown <= -30) blockers.push("60日最大下落が深い");
  if (per !== null && per >= 45) blockers.push("PER高め");
  if (ret1y !== null && ret1y >= 150) blockers.push("1年急騰後");

  if (blockers.length) {
    return {
      matched: "接続済み",
      completeness,
      gate: "保留",
      reason: blockers.join(" / "),
    };
  }
  if (score !== null && score >= 60 && completeness >= 70) {
    return {
      matched: "接続済み",
      completeness,
      gate: "数値確認済み",
      reason: "既存100社スコアと主要指標の入力率は確認済み。決算後反応・受注確認へ進める。",
    };
  }
  return {
    matched: "接続済み",
    completeness,
    gate: "観察",
    reason: "数値は接続できたが、購入候補化には追加確認が必要。",
  };
}

const merged = candidates.map((candidate) => {
  const source = universeByTicker.get(candidate.ticker);
  const status = judge(candidate, source);
  return {
    channel: candidate.channel,
    candidateRank: candidate.rank,
    ticker: candidate.ticker,
    name: candidate.name,
    role: candidate.role,
    currentJudgment: candidate.currentJudgment,
    matched: status.matched,
    dataCompletenessPct: status.completeness,
    quantGate: status.gate,
    quantReason: status.reason,
    universeRank: source?.universe_rank || "",
    universeScore: source?.universe_score_100 || "",
    decision: source?.decision || "",
    growthScore: source?.growth_score_25 || "",
    qualityValuationScore: source?.quality_valuation_score_25 || "",
    momentumScore: source?.momentum_score_20 || "",
    riskPenalty: source?.risk_penalty || "",
    per: source?.per_forecast || "",
    pbr: source?.pbr_actual || "",
    roe: source?.roe_actual_pct || "",
    revenueYoy: source?.revenue_yoy_pct || "",
    profitYoy: source?.profit_yoy_pct || "",
    ret60: source?.ret60_pct || "",
    ret1y: source?.ret1y_pct || "",
    aboveMa200: source?.above_ma200_pct || "",
    maxDrawdown60: source?.max_drawdown60_pct || "",
    priceDate: source?.price_date || "",
    nextAction: candidate.nextAction,
  };
});

const outHeaders = [
  "channel",
  "candidateRank",
  "ticker",
  "name",
  "role",
  "currentJudgment",
  "matched",
  "dataCompletenessPct",
  "quantGate",
  "quantReason",
  "universeRank",
  "universeScore",
  "decision",
  "growthScore",
  "qualityValuationScore",
  "momentumScore",
  "riskPenalty",
  "per",
  "pbr",
  "roe",
  "revenueYoy",
  "profitYoy",
  "ret60",
  "ret1y",
  "aboveMa200",
  "maxDrawdown60",
  "priceDate",
  "nextAction",
];

const csv = [
  outHeaders.join(","),
  ...merged.map((row) => outHeaders.map((header) => csvCell(row[header])).join(",")),
].join("\n");

function table(channel) {
  return merged
    .filter((row) => row.channel === channel)
    .sort((a, b) => {
      const order = { "数値確認済み": 1, "観察": 2, "保留": 3, "数値接続前": 4 };
      return (order[a.quantGate] ?? 9) - (order[b.quantGate] ?? 9) || Number(a.candidateRank) - Number(b.candidateRank);
    })
    .map((row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td><b>${esc(row.ticker)} ${esc(row.name)}</b><br><small>${esc(row.role)}</small></td>
        <td><span class="badge ${row.quantGate === "数値確認済み" ? "good" : row.quantGate === "保留" ? "hold" : row.quantGate === "数値接続前" ? "bad" : "watch"}">${esc(row.quantGate)}</span><br><small>${esc(row.matched)} / ${esc(row.dataCompletenessPct)}%</small></td>
        <td>${esc(row.universeScore || "未接続")}</td>
        <td>PER ${esc(row.per || "未取得")}<br>PBR ${esc(row.pbr || "未取得")}<br>ROE ${esc(row.roe || "未取得")}</td>
        <td>売上 ${esc(row.revenueYoy || "未取得")}%<br>利益 ${esc(row.profitYoy || "未取得")}%</td>
        <td>60日 ${esc(row.ret60 || "未取得")}%<br>1年 ${esc(row.ret1y || "未取得")}%</td>
        <td>200日 ${esc(row.aboveMa200 || "未取得")}%<br>最大下落 ${esc(row.maxDrawdown60 || "未取得")}%</td>
        <td>${esc(row.quantReason)}</td>
        <td>${esc(row.nextAction)}</td>
      </tr>
    `).join("");
}

function count(channel, gate) {
  return merged.filter((row) => row.channel === channel && row.quantGate === gate).length;
}

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>フィジカルAI・量子 既存数値接続チェック</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--good:#0b6b4f;--hold:#a85b00;--watch:#455a6f;--bad:#b42318}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;line-height:1.7}
    header{background:var(--navy);color:white;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(28px,4vw,40px);letter-spacing:0;line-height:1.25}
    header p{margin:0;color:white;font-weight:800}
    main{max-width:1460px;margin:0 auto;padding:22px}
    section{background:white;border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:24px}
    .notice{border-left:7px solid #b76500;background:#fff7e7;color:#111;padding:12px 14px;margin:12px 0;font-weight:800;border-radius:8px}
    .summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;padding:13px;background:#fbfdff}
    .card b{display:block;color:var(--navy);font-size:17px;margin-bottom:4px}.card strong{display:block;font-size:28px;color:var(--blue)}
    .links a{display:inline-block;margin:6px 8px 0 0;background:var(--blue);color:white;text-decoration:none;border-radius:8px;padding:9px 12px;font-weight:900}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:white}
    table{width:100%;border-collapse:collapse;min-width:1380px;table-layout:fixed;font-size:13px}
    th,td{border:1px solid var(--line);padding:8px;vertical-align:top;overflow-wrap:anywhere;word-break:break-word;color:#111}
    th{background:#e5f1fa;color:#073b62;text-align:left;font-weight:900}
    .badge{display:inline-block;border-radius:999px;color:white;padding:4px 9px;font-weight:900;font-size:12px}
    .badge.good{background:var(--good)}.badge.hold{background:var(--hold)}.badge.watch{background:var(--watch)}.badge.bad{background:var(--bad)}
    @media(max-width:980px){main{padding:12px}.summary{grid-template-columns:1fr}table{min-width:1180px}}
    @media print{section{box-shadow:none;break-inside:avoid}.panel{display:block}}
  </style>
</head>
<body>
<header>
  <h1>フィジカルAI・量子 既存数値接続チェック</h1>
  <p>作成: ${esc(generatedAt)} / 新しく作ったテーマ候補20社を、既存の100社スクリーニング数値へ接続した確認表です。</p>
</header>
<main>
  <section>
    <h2>1. 結論</h2>
    <p class="notice">この画面では、新しい予測利回りを作っていません。既存の100社スクリーニング表にある実データだけを接続し、数値確認済み、観察、保留、数値接続前に分けています。テーマだけで購入候補に昇格させないための確認画面です。</p>
    <div class="summary">
      <div class="card"><b>フィジカルAI 数値確認済み</b><strong>${count("フィジカルAI", "数値確認済み")}</strong><span>既存100社数値で確認できた件数</span></div>
      <div class="card"><b>フィジカルAI 保留/観察</b><strong>${count("フィジカルAI", "保留") + count("フィジカルAI", "観察")}</strong><span>不足・警戒条件あり</span></div>
      <div class="card"><b>量子 数値確認済み</b><strong>${count("量子コンピューター", "数値確認済み")}</strong><span>現時点では購入候補化しない</span></div>
      <div class="card"><b>量子 接続前/観察</b><strong>${count("量子コンピューター", "数値接続前") + count("量子コンピューター", "観察") + count("量子コンピューター", "保留")}</strong><span>長期探索または追加確認</span></div>
    </div>
    <div class="links">
      <a href="887_quantum_physical_ai_quant_connection_20260605.csv">CSVを開く</a>
      <a href="886_quantum_physical_ai_screening_20260605.html">候補整理へ戻る</a>
      <a href="index.html">ホームへ戻る</a>
    </div>
  </section>

  <section>
    <h2>2. フィジカルAI</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width:46px">順位</th><th style="width:210px">銘柄</th><th style="width:120px">数値ゲート</th><th style="width:80px">既存スコア</th><th style="width:120px">PER/PBR/ROE</th><th style="width:120px">決算成長</th><th style="width:120px">株価反応</th><th style="width:120px">下落/位置</th><th>判定理由</th><th>次アクション</th>
          </tr>
        </thead>
        <tbody>${table("フィジカルAI")}</tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>3. 量子コンピューター</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width:46px">順位</th><th style="width:210px">銘柄</th><th style="width:120px">数値ゲート</th><th style="width:80px">既存スコア</th><th style="width:120px">PER/PBR/ROE</th><th style="width:120px">決算成長</th><th style="width:120px">株価反応</th><th style="width:120px">下落/位置</th><th>判定理由</th><th>次アクション</th>
          </tr>
        </thead>
        <tbody>${table("量子コンピューター")}</tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>4. 次の実作業</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>優先</th><th>作業</th><th>理由</th><th>完了条件</th></tr></thead>
        <tbody>
          <tr><td>1</td><td>フィジカルAIの未接続・保留銘柄にPER/PBR/ROE、受注、利益率を入れる。</td><td>実需に近いため、購入候補化の可能性が量子より高い。</td><td>数値ゲートが「数値確認済み」または「保留理由明確」になる。</td></tr>
          <tr><td>2</td><td>量子は公式IRで商用化・売上寄与・受注を確認する。</td><td>国策テーマでも、1年保有では売上寄与が見えないと購入候補にしにくい。</td><td>量子関連の売上・案件が公式資料で確認できる。</td></tr>
          <tr><td>3</td><td>既存10社、半導体、データセンター、フィジカルAIを横並び比較する。</td><td>テーマ別にバラバラだと、最終10社に入れる理由が弱くなる。</td><td>同じ列、同じゲート、同じ未取得ルールで比較できる。</td></tr>
        </tbody>
      </table>
    </div>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "887_quantum_physical_ai_quant_connection_20260605.csv"), `\uFEFF${csv}\n`, "utf8");
fs.writeFileSync(path.join(ROOT, "887_quantum_physical_ai_quant_connection_20260605.html"), html, "utf8");

const screeningPath = path.join(ROOT, "886_quantum_physical_ai_screening_20260605.html");
if (fs.existsSync(screeningPath)) {
  let text = fs.readFileSync(screeningPath, "utf8");
  if (!text.includes("887_quantum_physical_ai_quant_connection_20260605.html")) {
    text = text.replace(
      '<a href="886_quantum_physical_ai_screening_20260605.csv">CSVを開く</a>',
      '<a href="886_quantum_physical_ai_screening_20260605.csv">CSVを開く</a>\n      <a href="887_quantum_physical_ai_quant_connection_20260605.html">既存数値接続チェック</a>',
    );
    fs.writeFileSync(screeningPath, text, "utf8");
  }
}

for (const file of ["index.html", "practical_action_dashboard_20260528.html"]) {
  const filePath = path.join(ROOT, file);
  if (!fs.existsSync(filePath)) continue;
  let text = fs.readFileSync(filePath, "utf8");
  if (text.includes("887_quantum_physical_ai_quant_connection_20260605.html")) continue;
  const link = '<a class="button secondary" href="887_quantum_physical_ai_quant_connection_20260605.html">フィジカルAI・量子 数値接続</a>';
  if (text.includes("886_quantum_physical_ai_screening_20260605.html")) {
    text = text.replace(/(<a[^>]+href="886_quantum_physical_ai_screening_20260605\.html"[^>]*>.*?<\/a>)/s, `$1\n        ${link}`);
    fs.writeFileSync(filePath, text, "utf8");
  }
}

console.log("wrote 887_quantum_physical_ai_quant_connection_20260605.html");
console.log("wrote 887_quantum_physical_ai_quant_connection_20260605.csv");
