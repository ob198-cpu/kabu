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

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

function write(file, text) {
  fs.writeFileSync(path.join(root, file), text, "utf8");
}

function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
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
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  const header = rows.shift() ?? [];
  return rows
    .filter((r) => r.some((v) => String(v).trim() !== ""))
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows) {
  const header = Object.keys(rows[0] ?? {});
  return `${header.join(",")}\n${rows.map((r) => header.map((h) => csvEscape(r[h])).join(",")).join("\n")}\n`;
}

function num(value) {
  const s = String(value ?? "").replace(/,/g, "").replace(/%/g, "").replace(/倍/g, "").trim();
  if (!s || s === "なし" || s === "PER" || s === "未採点") return null;
  const m = s.match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function round(value, digits = 1) {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(digits)) : "";
}

function mapByTicker(rows) {
  return new Map(rows.map((r) => [r.ticker, r]));
}

const selection = parseCsv(read("657_focus10_recalculated_selection.csv"));
const fundamentals = mapByTicker(parseCsv(read("655_focus10_live_fundamental_metrics.csv")));
const prices = mapByTicker(parseCsv(read("654_focus10_live_price_metrics.csv")));
const reactions = mapByTicker(parseCsv(read("656_focus10_reaction_metrics.csv")));

function flags(row, f, p, r) {
  const out = [];
  if (row.remaining_gap && row.remaining_gap !== "なし") out.push(`未取得: ${row.remaining_gap}`);
  if (row.warning_list && row.warning_list !== "なし") out.push(row.warning_list);
  const has = (pattern) => out.some((item) => item.includes(pattern));
  const reactionScore = num(row.reaction_score);
  if (reactionScore !== null && reactionScore < 45 && !has("決算後反応")) out.push(`決算後反応弱い: ${reactionScore}点`);
  const ret1y = num(p.return_1y_pct);
  if (ret1y !== null && ret1y >= 180 && !has("1年上昇")) out.push(`1年上昇が大きい: ${ret1y}%`);
  const drawdown60 = num(p.max_drawdown_60d_pct);
  if (drawdown60 !== null && drawdown60 <= -25 && !has("60日最大下落")) out.push(`60日最大下落が大きい: ${drawdown60}%`);
  const pbr = num(f.pbr);
  if (pbr !== null && pbr >= 10 && !has("PBR")) out.push(`PBR高め: ${pbr}倍`);
  const profit = num(f.profit_yoy_pct);
  if (profit !== null && profit < 0) out.push(`利益成長マイナス: ${profit}%`);
  return [...new Set(out)];
}

function groupFor(row, f, p, r, flagList) {
  const score = num(row.live_selection_score) ?? 0;
  const complete = row.data_completion === "10/10";
  const noGap = !row.remaining_gap || row.remaining_gap === "なし";
  const noWarn = !row.warning_list || row.warning_list === "なし";
  const reactionScore = num(row.reaction_score);
  const isExisting = row.score_status_before === "既存スコアあり";
  const weakReaction = reactionScore !== null && reactionScore < 45;
  const bigRisk = flagList.some((f2) => /1年上昇|PBR|60日最大下落|利益成長マイナス/.test(f2));

  if (complete && noGap && noWarn && !weakReaction && score >= 57) return "中心候補";
  if (isExisting && score >= 56 && !weakReaction && !bigRisk) return "条件付き中心候補";
  return "監視候補";
}

function decisionReason(row, f, p, r, group, flagList) {
  const score = row.live_selection_score;
  const reaction = row.reaction_score || "未取得";
  const completion = row.data_completion;
  if (group === "中心候補") {
    return `データ充足${completion}、再計算${score}点、決算後反応${reaction}点。大きな警戒表示がなく、6月再判定に残せる。`;
  }
  if (group === "条件付き中心候補") {
    return `再計算${score}点で比較圏内。残課題は${row.remaining_gap || "確認項目"}。不足項目を補完できれば中心候補に近い。`;
  }
  return `再計算${score}点。${flagList.join(" / ") || "追加確認が必要"}のため、中心候補ではなく監視候補として扱う。`;
}

function actionRule(row, group, flagList) {
  if (group === "中心候補") {
    return "6月CPI・日銀・FOMC後に市場ゲートを確認し、指数比較と個別警戒が悪化しなければテスト対象に残す。";
  }
  if (group === "条件付き中心候補") {
    return "PERなど不足項目を補完し、警戒条件が増えなければ中心候補へ戻す。補完できなければ監視に下げる。";
  }
  if (flagList.some((f) => f.includes("1年上昇"))) {
    return "過熱が落ち着く、または決算後20営業日反応と6月イベント後の価格維持を確認するまで中心に置かない。";
  }
  if (flagList.some((f) => f.includes("決算後反応弱い"))) {
    return "20営業日反応、出来高、同業比較で改善が出るまで監視に止める。";
  }
  if (flagList.some((f) => f.includes("60日最大下落"))) {
    return "200日線回復、60日下落率改善、出来高増を確認するまで監視に止める。";
  }
  if (flagList.some((f) => f.includes("PBR高め") || f.includes("未取得"))) {
    return "PER・PBRの妥当性と利益成長による説明ができるまで監視に止める。";
  }
  return "追加データと6月イベント後の反応を見て、中心候補へ上げるか判断する。";
}

function finalScore(row, group, flagList) {
  let score = num(row.live_selection_score) ?? 0;
  if (row.remaining_gap && row.remaining_gap !== "なし") score -= 4;
  if (flagList.some((f) => f.includes("1年上昇"))) score -= 8;
  if (flagList.some((f) => f.includes("決算後反応弱い"))) score -= 10;
  if (flagList.some((f) => f.includes("PBR"))) score -= 6;
  if (flagList.some((f) => f.includes("60日最大下落"))) score -= 7;
  if (flagList.some((f) => f.includes("利益成長マイナス"))) score -= 5;
  if (group === "中心候補") score += 3;
  return Math.max(0, round(score, 1));
}

const rows = selection.map((row) => {
  const f = fundamentals.get(row.ticker) ?? {};
  const p = prices.get(row.ticker) ?? {};
  const r = reactions.get(row.ticker) ?? {};
  const flagList = flags(row, f, p, r);
  const group = groupFor(row, f, p, r, flagList);
  return {
    generated_at: generatedAt,
    ticker: row.ticker,
    company: row.company,
    final_group: group,
    live_selection_score: row.live_selection_score,
    final_selection_score: finalScore(row, group, flagList),
    data_completion: row.data_completion,
    per: f.per || "",
    pbr: f.pbr || "",
    roe_pct: f.roe_pct || "",
    sales_yoy_pct: f.sales_yoy_pct || "",
    profit_yoy_pct: f.profit_yoy_pct || "",
    return_1y_pct: p.return_1y_pct || "",
    max_drawdown_60d_pct: p.max_drawdown_60d_pct || "",
    ma200_gap_pct: p.ma200_gap_pct || "",
    reaction_score: row.reaction_score || "",
    warning_items: flagList.join(" / ") || "なし",
    reason: decisionReason(row, f, p, r, group, flagList),
    action_rule: actionRule(row, group, flagList),
  };
});

const groupOrder = { "中心候補": 0, "条件付き中心候補": 1, "監視候補": 2 };
const sorted = rows
  .sort((a, b) => {
    const ga = groupOrder[a.final_group] ?? 9;
    const gb = groupOrder[b.final_group] ?? 9;
    return ga - gb || (num(b.final_selection_score) ?? 0) - (num(a.final_selection_score) ?? 0);
  })
  .map((row, index) => ({ final_rank: index + 1, ...row }));

const reasonCards = sorted.map((row) => ({
  generated_at: generatedAt,
  ticker: row.ticker,
  company: row.company,
  final_group: row.final_group,
  key_numbers: `再計算${row.live_selection_score}点 / 最終補正${row.final_selection_score}点 / 充足${row.data_completion} / 反応${row.reaction_score || "未取得"}点`,
  positive_basis: [
    row.sales_yoy_pct ? `売上${row.sales_yoy_pct}%` : "",
    row.profit_yoy_pct ? `利益${row.profit_yoy_pct}%` : "",
    row.roe_pct ? `ROE${row.roe_pct}%` : "",
    row.return_1y_pct ? `1年${row.return_1y_pct}%` : "",
  ].filter(Boolean).join(" / "),
  caution_basis: row.warning_items,
  explanation: row.reason,
}));

const actionRows = [
  {
    generated_at: generatedAt,
    phase: "5月末",
    action: "中心候補と監視候補を分け、未取得PER・過熱・決算後反応弱さを記録する。",
    pass_condition: "10社すべてに価格、業績、決算後反応が入り、警戒項目が分離されている。",
  },
  {
    generated_at: generatedAt,
    phase: "6月上旬",
    action: "米CPI前に、中心候補の株価維持、出来高、日経平均比を更新する。",
    pass_condition: "中心候補が日経平均比で大きく劣後せず、未取得項目が増えない。",
  },
  {
    generated_at: generatedAt,
    phase: "6月中旬イベント後",
    action: "CPI、日銀、FOMC後に市場ゲートと銘柄別ゲートを再判定する。",
    pass_condition: "日経平均75日線、米金利急騰、円高ショック、個別下方修正が停止条件に該当しない。",
  },
  {
    generated_at: generatedAt,
    phase: "購入検討前",
    action: "中心候補からテスト対象を選び、監視候補は条件改善時だけ上げる。",
    pass_condition: "S&P500投信・日経平均/TOPIXに対して+1%を狙う根拠が説明できる。",
  },
];

write("659_focus10_core_watch_selection.csv", toCsv(sorted));
write("660_focus10_selection_reason_cards.csv", toCsv(reasonCards));
write("661_focus10_june_test_action_rules.csv", toCsv(actionRows));

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (m) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[m]));

function table(tableRows) {
  const header = Object.keys(tableRows[0] ?? {});
  return `<table><thead><tr>${header.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${tableRows
    .map((r) => `<tr>${header.map((h) => `<td>${esc(r[h])}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

const counts = sorted.reduce((acc, row) => {
  acc[row.final_group] = (acc[row.final_group] ?? 0) + 1;
  return acc;
}, {});

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>優先10社 中心候補・監視候補 2026年5月27日</title>
  <style>
    :root { --ink:#071f36; --blue:#0b6fa4; --line:#c9daea; --bg:#f7fafc; --green:#087443; --orange:#9a4d00; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:"Yu Gothic","Meiryo",Arial,sans-serif; color:var(--ink); background:var(--bg); line-height:1.7; }
    header { background:#123f63; color:#fff; padding:28px 32px; }
    h1 { margin:0 0 8px; font-size:28px; }
    main { max-width:1220px; margin:0 auto; padding:24px; }
    section { background:#fff; border:1px solid var(--line); border-radius:10px; padding:22px; margin:0 0 18px; page-break-inside:avoid; }
    h2 { margin:0 0 12px; font-size:22px; border-left:8px solid var(--blue); padding-left:12px; }
    .grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; }
    .card { border:1px solid var(--line); border-radius:8px; padding:14px; background:#f9fcff; }
    .num { font-size:28px; font-weight:800; color:#064f79; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:12.5px; }
    th, td { border:1px solid var(--line); padding:7px; vertical-align:top; word-break:break-word; overflow-wrap:anywhere; }
    th { background:#e7f1fa; text-align:left; color:#06395b; }
    .note { border-left:6px solid #d88b1f; background:#fff9ef; padding:12px 14px; margin-top:10px; color:#111; }
    .links a { display:inline-block; margin:4px 8px 4px 0; padding:8px 12px; border:1px solid #8bb9d6; border-radius:8px; color:#064f79; text-decoration:none; background:#fff; font-weight:700; }
    @media (max-width:760px){ .grid{grid-template-columns:1fr;} main{padding:14px;} table{font-size:12px;} }
  </style>
</head>
<body>
  <header>
    <h1>優先10社 中心候補・監視候補</h1>
    <div>作成: ${esc(generatedAt)} / 目的: 候補10社を、6月再判定に向けて中心候補と監視候補へ分ける</div>
  </header>
  <main>
    <section>
      <h2>1. 結論</h2>
      <div class="grid">
        <div class="card"><div class="num">${counts["中心候補"] ?? 0}</div><div><b>中心候補</b></div><div>データ充足、警戒なし、比較継続に適する候補</div></div>
        <div class="card"><div class="num">${counts["条件付き中心候補"] ?? 0}</div><div><b>条件付き中心候補</b></div><div>不足項目を補完できれば中心へ戻せる候補</div></div>
        <div class="card"><div class="num">${counts["監視候補"] ?? 0}</div><div><b>監視候補</b></div><div>過熱、決算後反応、下落率などの確認が必要</div></div>
        <div class="card"><div class="num">0</div><div><b>購入確定</b></div><div>この資料だけで確定する銘柄はなし</div></div>
      </div>
      <div class="note">スコアが高くても、未取得PER、過熱、決算後反応の弱さ、直近下落がある銘柄は中心候補にしません。6月の市場イベント後に再判定します。</div>
    </section>
    <section>
      <h2>2. 中心候補・監視候補 表</h2>
      ${table(sorted)}
    </section>
    <section>
      <h2>3. 銘柄別の説明カード</h2>
      ${table(reasonCards)}
    </section>
    <section>
      <h2>4. 6月に向けた運用ルール</h2>
      ${table(actionRows)}
      <div class="links">
        <a href="659_focus10_core_watch_selection.csv">中心・監視候補CSV</a>
        <a href="660_focus10_selection_reason_cards.csv">説明カードCSV</a>
        <a href="661_focus10_june_test_action_rules.csv">運用ルールCSV</a>
      </div>
    </section>
  </main>
</body>
</html>`;

write("focus10_core_watch_selection_20260527.html", html);

console.log(JSON.stringify({
  generatedAt,
  center: counts["中心候補"] ?? 0,
  conditional: counts["条件付き中心候補"] ?? 0,
  watch: counts["監視候補"] ?? 0,
  output: "focus10_core_watch_selection_20260527.html",
}, null, 2));
