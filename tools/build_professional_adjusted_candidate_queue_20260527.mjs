import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const generatedAt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date());

const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const write = (file, text) => fs.writeFileSync(path.join(root, file), text, "utf8");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    const n = text[i + 1];
    if (quoted) {
      if (c === '"' && n === '"') {
        cell += '"';
        i += 1;
      } else if (c === '"') {
        quoted = false;
      } else {
        cell += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += c;
    }
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  const header = rows.shift() ?? [];
  return rows
    .filter((r) => r.some((v) => v !== ""))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows) {
  const header = Object.keys(rows[0] ?? {});
  return `${header.join(",")}\n${rows.map((r) => header.map((h) => csvEscape(r[h])).join(",")).join("\n")}\n`;
}

function pctNumber(value) {
  if (!value) return 0;
  const n = Number(String(value).replace("%", "").replace("+", ""));
  return Number.isFinite(n) ? n : 0;
}

function contributionNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const gateRows = parseCsv(read("647_candidate_professional_reference_gate.csv"));
const importRows = parseCsv(read("648_professional_reference_import_screen.csv"));

const existingByTicker = new Map(gateRows.map((r) => [r.ticker, r]));

const basePriority = {
  "2802.T": 1,
  "6762.T": 2,
  "6146.T": 3,
  "7011.T": 4,
  "8053.T": 5,
  "9984.T": 6,
  "8316.T": 7,
  "8306.T": 8,
  "7735.T": 9,
  "7173.T": 10,
  "8035.T": 11,
  "6516.T": 12,
  "7203.T": 13,
  "4373.T": 14,
  "3612.T": 15,
};

function sourceType(row, isExisting) {
  if (isExisting && row.reference_connection === "未接続") return "既存候補・独立確認";
  if (isExisting && row.reference_connection === "直接一致") return "既存候補・直接参照";
  if (isExisting && row.reference_connection === "テーマ近似") return "既存候補・テーマ参照";
  if (row.screening_stage === "追加候補A") return "追加候補A";
  if (row.screening_stage === "追加候補B") return "追加候補B";
  return "追加確認";
}

function decisionStage(row, isExisting) {
  if (isExisting && row.operation_decision === "警戒") return "警戒解除待ち";
  if (isExisting && row.operation_decision === "保留") return "保留継続";
  if (isExisting && row.operation_decision === "反応再確認") return "反応再確認";
  if (isExisting && row.current_class === "第1候補群") return "既存主候補";
  if (isExisting && row.current_class === "第2候補群") return "第2候補";
  if (row.screening_stage === "追加候補A") return "優先追加確認";
  return "比較追加確認";
}

function requiredChecks(row, isExisting) {
  if (isExisting) {
    const checks = [];
    checks.push("PER/PBR/ROEの同業比較");
    checks.push("直近決算の売上・利益・EPS成長");
    checks.push("決算後1日/5日/20営業日の対指数反応");
    if (row.reference_connection === "テーマ近似") checks.push("テーマが売上・受注・利益率へ接続しているか");
    if (row.operation_decision === "警戒") checks.push("警戒条件の解除可否");
    return checks.join(" / ");
  }
  return row.required_data;
}

function evidenceSummary(row, isExisting) {
  if (isExisting) {
    if (row.reference_connection === "未接続") {
      return "プロ参照では補強できないため、既存の量的データと決算確認で独立評価する。";
    }
    if (row.reference_connection === "直接一致") {
      return `成果ポートフォリオと直接一致。参照リターン${row.reference_return_pct}。ただし現在価格での後追いリスクを別判定する。`;
    }
    return `成果ポートフォリオの近いテーマに接続。参照先は${row.reference_ticker}、テーマは${row.reference_theme}。業績接続の確認が必須。`;
  }
  return `成果ポートフォリオから追加抽出。テーマは${row.theme}、参照リターン${row.source_return_pct}。同じ式へ入れる前の追加確認枠。`;
}

function numericScore(row, isExisting) {
  if (isExisting) {
    const q = Number(row.quant_score || 0);
    const qual = Number(row.qualitative_score || 0);
    const conf = Number(row.data_confidence || 0);
    const ref = Number(row.reference_support_score || 0);
    const warningPenalty = row.operation_decision === "警戒" ? 12 : row.operation_decision === "保留" ? 8 : 0;
    const missingPenalty = conf < 70 ? 10 : 0;
    return Math.max(0, Math.min(100, q * 0.45 + qual * 0.25 + conf * 0.15 + ref * 0.15 - warningPenalty - missingPenalty));
  }
  const returnScore = Math.min(100, pctNumber(row.source_return_pct) / 6);
  const contribScore = Math.min(100, contributionNumber(row.estimated_total_contribution) / 40);
  const stageBonus = row.screening_stage === "追加候補A" ? 12 : 0;
  const etfPenalty = row.theme === "指数・ETF" ? 25 : 0;
  return Math.max(0, Math.min(100, returnScore * 0.35 + contribScore * 0.45 + stageBonus - etfPenalty));
}

const existingRows = gateRows.map((row) => {
  const score = numericScore(row, true);
  return {
    generated_at: generatedAt,
    priority_group: decisionStage(row, true),
    ticker: row.ticker,
    company: row.company,
    source_type: sourceType(row, true),
    reference_effect: row.reference_effect,
    current_decision: row.operation_decision,
    score_status: "既存スコアあり",
    existing_adjusted_score: score.toFixed(1),
    reference_priority_score: row.reference_support_score,
    evidence_summary: evidenceSummary(row, true),
    required_checks: requiredChecks(row, true),
    june_use: row.final_use,
    note: "既存候補側の数値が優先。プロ参照は説明補強・警戒確認に使う。",
  };
});

const importCandidateRows = importRows
  .filter((row) => row.screening_stage !== "既存候補照合" && row.theme !== "指数・ETF")
  .map((row) => {
    const score = numericScore(row, false);
    return {
      generated_at: generatedAt,
      priority_group: decisionStage(row, false),
      ticker: row.ticker,
      company: row.company,
      source_type: sourceType(row, false),
      reference_effect: `${row.theme} / ${row.role}`,
      current_decision: "未採点・追加確認",
      score_status: "追加データ未投入",
      existing_adjusted_score: "未採点",
      reference_priority_score: score.toFixed(1),
      evidence_summary: evidenceSummary(row, false),
      required_checks: requiredChecks(row, false),
      june_use: row.use_for_june,
      note: "追加データを取得してから既存候補と同じ式へ入れる。",
    };
  });

const allRows = [...existingRows, ...importCandidateRows]
  .sort((a, b) => {
    const pa = basePriority[a.ticker] ?? 99;
    const pb = basePriority[b.ticker] ?? 99;
    if (pa !== pb) return pa - pb;
    return Number(b.reference_priority_score || 0) - Number(a.reference_priority_score || 0);
  })
  .map((row, i) => ({ candidate_order: i + 1, ...row }));

const focusTen = allRows
  .filter((row) => !["保留継続"].includes(row.priority_group))
  .slice(0, 10)
  .map((row, i) => ({
    focus_rank: i + 1,
    ticker: row.ticker,
    company: row.company,
    priority_group: row.priority_group,
    source_type: row.source_type,
    score_status: row.score_status,
    existing_adjusted_score: row.existing_adjusted_score,
    reference_priority_score: row.reference_priority_score,
    evidence_summary: row.evidence_summary,
    required_checks: row.required_checks,
    decision_rule: row.current_decision === "警戒" || row.priority_group === "警戒解除待ち"
      ? "解除条件を満たすまで購入候補にしない"
      : "公式数値がそろった後に量的スコアへ再投入する",
  }));

const summaryRows = [
  {
    item: "目的",
    detail: "成果の出たポートフォリオを、6月のNISA 1年保有テスト候補選定へ接続する。",
  },
  {
    item: "使い方",
    detail: "直接加点ではなく、既存候補の補強、警戒解除、追加候補発見、後追い注意に分けて使う。",
  },
  {
    item: "現在の重点",
    detail: "味の素、TDK、ディスコ、三菱重工業、住友商事、ソフトバンクG、三井住友FG、三菱UFJ、SCREEN、東京きらぼしFGを優先確認する。",
  },
  {
    item: "次に必要",
    detail: "PER/PBR/ROE、直近決算成長率、決算後反応、下落率、出来高倍率を同じ形式で補完する。",
  },
];

write("650_professional_adjusted_candidate_queue.csv", toCsv(allRows));
write("651_professional_adjusted_focus10.csv", toCsv(focusTen));
write("652_professional_adjusted_summary.csv", toCsv(summaryRows));

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (m) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[m]));

function table(rows) {
  const header = Object.keys(rows[0] ?? {});
  return `<table><thead><tr>${header.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${header.map((h) => `<td>${esc(r[h])}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>プロ参照反映後 候補キュー 2026年5月27日</title>
  <style>
    :root { --ink:#071f36; --blue:#0b6fa4; --line:#c9daea; --bg:#f7fafc; --warn:#9a4d00; --ok:#087443; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:"Yu Gothic","Meiryo",Arial,sans-serif; color:var(--ink); background:var(--bg); line-height:1.7; }
    header { background:#123f63; color:#fff; padding:28px 32px; }
    h1 { margin:0 0 8px; font-size:28px; }
    main { max-width:1180px; margin:0 auto; padding:24px; }
    section { background:#fff; border:1px solid var(--line); border-radius:10px; padding:22px; margin:0 0 18px; page-break-inside:avoid; }
    h2 { margin:0 0 12px; font-size:22px; border-left:8px solid var(--blue); padding-left:12px; }
    .grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .card { border:1px solid var(--line); border-radius:8px; padding:14px; background:#f9fcff; }
    .num { font-size:26px; font-weight:800; color:#064f79; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:13px; }
    th, td { border:1px solid var(--line); padding:8px; vertical-align:top; word-break:break-word; overflow-wrap:anywhere; }
    th { background:#e7f1fa; text-align:left; color:#06395b; }
    .note { border-left:6px solid #d88b1f; background:#fff9ef; padding:12px 14px; margin-top:10px; }
    .links a { display:inline-block; margin:4px 8px 4px 0; padding:8px 12px; border:1px solid #8bb9d6; border-radius:8px; color:#064f79; text-decoration:none; background:#fff; font-weight:700; }
    @media (max-width:760px){ .grid{grid-template-columns:1fr;} main{padding:14px;} table{font-size:12px;} }
  </style>
</head>
<body>
  <header>
    <h1>プロ参照反映後 候補キュー</h1>
    <div>作成: ${esc(generatedAt)} / 目的: 成果の出たポートフォリオを、購入判断ではなく候補選定の根拠整理へ接続する</div>
  </header>
  <main>
    <section>
      <h2>1. 位置づけ</h2>
      <div class="grid">
        <div class="card"><div class="num">${gateRows.length}</div><div>既存候補の照合件数</div></div>
        <div class="card"><div class="num">${importCandidateRows.length}</div><div>ETFを除く追加確認候補</div></div>
        <div class="card"><div class="num">${focusTen.length}</div><div>明日優先確認する候補数</div></div>
        <div class="card"><div class="num">0</div><div>この資料だけで購入確定する銘柄</div></div>
      </div>
      <div class="note">成果ポートフォリオは有用な参照情報ですが、同じ銘柄を現在価格で採用する根拠にはなりません。使い道は、勝ち筋の確認、既存候補の説明補強、追加候補の発見、後追いリスクの確認です。</div>
    </section>

    <section>
      <h2>2. 優先確認10社</h2>
      ${table(focusTen)}
    </section>

    <section>
      <h2>3. 全候補キュー</h2>
      ${table(allRows)}
    </section>

    <section>
      <h2>4. 運用ルール</h2>
      <ul>
        <li>プロ参照は直接点数に足しません。既存の量的スコア、決算、PER/PBR/ROE、決算後反応が優先です。</li>
        <li>直接一致銘柄は説明力が上がりますが、過去に上がった事実は後追いリスクにもなります。</li>
        <li>テーマ近似銘柄は、売上、受注、利益率、同業株反応に接続できた場合だけ候補に残します。</li>
        <li>警戒銘柄は、警戒解除条件を満たすまで購入候補にしません。</li>
        <li>追加候補は、既存候補と同じ計算表に入れてから比較します。</li>
      </ul>
      <div class="links">
        <a href="650_professional_adjusted_candidate_queue.csv">全候補キューCSV</a>
        <a href="651_professional_adjusted_focus10.csv">優先10社CSV</a>
        <a href="652_professional_adjusted_summary.csv">要約CSV</a>
      </div>
    </section>
  </main>
</body>
</html>
`;

write("professional_adjusted_candidate_queue_20260527.html", html);

console.log(JSON.stringify({
  generatedAt,
  allRows: allRows.length,
  focusTen: focusTen.length,
  output: "professional_adjusted_candidate_queue_20260527.html",
}, null, 2));
