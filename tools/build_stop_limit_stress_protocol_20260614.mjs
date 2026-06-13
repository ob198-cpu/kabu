import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/14 00:45";

function readText(file) {
  const full = path.join(ROOT, file);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8").replace(/^\uFEFF/, "") : "";
}

function parseCsv(text) {
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
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell.replace(/\r$/, ""));
  if (row.some((v) => v !== "")) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map((v) => v.trim());
  return rows.slice(1).map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}

function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(file, rows) {
  const headers = Object.keys(rows[0] ?? {});
  const text = rows.length ? [headers.join(","), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(","))].join("\n") : "";
  fs.writeFileSync(path.join(ROOT, file), `\uFEFF${text}\n`, "utf8");
}

function h(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function n(value, fallback = 0) {
  const parsed = Number(String(value ?? "").replace(/[%円,]/g, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 1) {
  return Number(value.toFixed(digits));
}

function statusClass(value) {
  const s = String(value ?? "");
  if (/(高|購入不可|停止|初回除外|除外|赤|禁止)/.test(s)) return "bad";
  if (/(中|注意|保留|監視|再確認|警戒)/.test(s)) return "warn";
  if (/(低|確認済み|OK|通過|候補)/.test(s)) return "ok";
  return "";
}

function table(rows, cols) {
  return `<div class="table-wrap"><table><thead><tr>${cols.map((c) => `<th>${h(c.label)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${cols.map((c) => `<td class="${statusClass(r[c.key])}">${h(r[c.key])}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

function page(title, lead, sections) {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${h(title)}</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--warn:#a85b00;--red:#b42318;--green:#116b4f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.75}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:white;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);line-height:1.2;letter-spacing:0}
    header p{margin:0;font-weight:800;max-width:1180px}
    main{max-width:1580px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08)}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:25px}
    .notice{border-left:8px solid var(--warn);background:#fff7e7;border-radius:10px;padding:14px 16px;font-weight:900;margin:0 0 14px}
    .danger{border-left-color:var(--red);background:#fff1f1}
    .okbox{border-left-color:var(--green);background:#eefaf5}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:15px}
    .card strong{display:block;font-size:28px;line-height:1.25;color:var(--blue)}
    .card span{font-weight:800;color:#263e55}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin-top:10px}
    table{width:100%;border-collapse:collapse;table-layout:auto;background:#fff}
    th,td{border:1px solid var(--line);padding:10px 12px;vertical-align:top;overflow-wrap:anywhere;word-break:normal}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    td.ok{color:var(--green);font-weight:900}
    td.warn{color:var(--warn);font-weight:900}
    td.bad{color:var(--red);font-weight:900}
    a{color:#005f99;font-weight:900}
    footer{font-size:13px;color:#526b82;margin:20px 0}
    @media(max-width:900px){main{padding:12px}.cards{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:13px;padding:7px 8px}}
  </style>
</head>
<body>
<header><h1>${h(title)}</h1><p>${h(lead)}</p></header>
<main>
${sections.join("\n")}
<footer>作成: ${h(generatedAt)} / 本画面は急落時の行動ルールであり、損失回避を保証するものではありません。</footer>
</main>
</body>
</html>`;
}

const risk = parseCsv(readText("candidate10_risk_trade_rules_20260613.csv"));
const strict = parseCsv(readText("candidate10_strict_gate_review_20260613.csv"));
const universe = parseCsv(readText("780_universe100_reselection_metrics_20260528.csv"));
const strictByTicker = Object.fromEntries(strict.map((r) => [r.ticker, r]));
const universeByTicker = Object.fromEntries(universe.map((r) => [r["コード"], r]));

function hazard(row) {
  const un = universeByTicker[row.ticker] || {};
  const st = strictByTicker[row.ticker] || {};
  const fiveDd = Math.abs(n(row.five_year_drawdown));
  const oneDd = Math.abs(n(row.one_year_drawdown));
  const sixty = n(row.sixty_day_return);
  const reaction = n(row.reaction_score, 50);
  const excess20 = n(st.excess_20d_pct);
  let score = 0;
  score += clamp(fiveDd, 0, 80) * 0.45;
  score += clamp(oneDd, 0, 50) * 0.55;
  if (sixty < -10) score += 12;
  if (sixty < -20) score += 10;
  if (reaction < 40) score += 12;
  if (reaction < 25) score += 10;
  if (excess20 < -10) score += 10;
  if ((un["最終扱い"] || "") === "除外") score += 12;
  if ((un["最終扱い"] || "") === "監視") score += 6;
  return round(clamp(score, 0, 100), 1);
}

function level(score) {
  if (score >= 75) return "高";
  if (score >= 55) return "中高";
  if (score >= 35) return "中";
  return "低";
}

function initialTreatment(levelText, universeStatus) {
  if (universeStatus === "除外") return "初回除外";
  if (levelText === "高") return "小口または見送り";
  if (levelText === "中高") return "小口上限";
  return "通常確認";
}

const rows = risk.map((r) => {
  const st = strictByTicker[r.ticker] || {};
  const un = universeByTicker[r.ticker] || {};
  const score = hazard(r);
  const lv = level(score);
  return {
    ticker: r.ticker,
    name: r.name,
    universe_status: st.universe_status || un["最終扱い"] || "未接続",
    risk_tier: r.risk_tier,
    acute_warning_score: score,
    acute_warning_level: lv,
    risk_cap_pct: r.risk_cap_pct,
    five_year_drawdown: r.five_year_drawdown,
    one_year_drawdown: r.one_year_drawdown,
    sixty_day_return: r.sixty_day_return,
    reaction_score: r.reaction_score,
    initial_treatment: initialTreatment(lv, st.universe_status || un["最終扱い"]),
    intraday_rule: "ストップ安または前日比-10%以上の日は買い増し禁止。成行売りも避け、材料確認を優先",
    next_day_rule: "翌営業日に出来高、寄付き気配、指数差、会社発表、テーマ崩れを確認して再判定",
    add_rule: lv === "高" ? "追加買付は原則停止。再開は指数回復と材料確認後" : lv === "中高" ? "追加は半分以下。指数劣後なら停止" : "共通ゲート通過後のみ追加可",
    exit_rule: "下方修正、粉飾・不祥事、資金繰り悪化、テーマ根拠消滅ならNISAでも売却検討",
  };
});

writeCsv("stop_limit_stress_protocol_20260614.csv", rows);

const summaryRows = [
  { item: "急落警戒度 高", count: `${rows.filter((r) => r.acute_warning_level === "高").length}/10`, meaning: "初回買付を小口または見送り。追加買付は原則停止" },
  { item: "初回除外", count: `${rows.filter((r) => r.initial_treatment === "初回除外").length}/10`, meaning: "100社再選定側で除外。財務確認だけでは復帰させない" },
  { item: "買い増し禁止条件", count: "共通", meaning: "ストップ安または前日比-10%以上なら当日買い増し禁止" },
  { item: "翌営業日確認", count: "共通", meaning: "出来高、気配、指数差、会社発表、テーマ崩れを確認" },
];

const commonRules = [
  { trigger: "ストップ安、または前日比-10%以上", action: "当日買い増し禁止", reason: "落ちる理由が判明する前に平均単価を下げに行かない" },
  { trigger: "指数は横ばいなのに個別だけ急落", action: "個別材料を確認。会社発表・決算・需給を調べる", reason: "市場全体ではなく銘柄固有リスクの可能性" },
  { trigger: "SOX/NASDAQ/日経平均も同時に急落", action: "全体リスクとして追加停止。半導体・高ボラは一段厳格化", reason: "個別株で取り返す局面ではない可能性" },
  { trigger: "2営業日連続で大幅下落", action: "保有継続理由を再確認。指数劣後なら一部縮小候補", reason: "単発ノイズではなくトレンド変化の可能性" },
  { trigger: "下方修正・不祥事・資金繰り悪化", action: "NISAでも売却検討", reason: "非課税メリットより元本毀損リスクを優先" },
];

const html = page(
  "ストップ安・急落対策プロトコル",
  "過去最大下落、直近下落、決算後反応、100社再選定での扱いから急落警戒度を出し、当日・翌営業日・追加買付・売却検討の行動を分けます。",
  [
    `<section><h2>この画面の使い方</h2><p class="notice danger">急落警戒度は「ストップ安になる確率」ではありません。過去データと現時点の弱点から、買い増しを止めるべき銘柄を見分けるための安全側スコアです。</p><div class="cards">${summaryRows.map((r) => `<div class="card"><b>${h(r.item)}</b><strong>${h(r.count)}</strong><span>${h(r.meaning)}</span></div>`).join("")}</div></section>`,
    `<section><h2>共通ルール</h2>${table(commonRules, [
      { key: "trigger", label: "トリガー" },
      { key: "action", label: "行動" },
      { key: "reason", label: "理由" },
    ])}</section>`,
    `<section><h2>銘柄別 急落警戒度</h2>${table(rows, [
      { key: "ticker", label: "銘柄" },
      { key: "name", label: "名称" },
      { key: "universe_status", label: "100社扱い" },
      { key: "acute_warning_score", label: "警戒度" },
      { key: "acute_warning_level", label: "警戒ランク" },
      { key: "risk_cap_pct", label: "上限" },
      { key: "five_year_drawdown", label: "5年最大下落" },
      { key: "one_year_drawdown", label: "1年最大下落" },
      { key: "sixty_day_return", label: "60日騰落" },
      { key: "reaction_score", label: "決算反応" },
      { key: "initial_treatment", label: "初回扱い" },
      { key: "intraday_rule", label: "当日対応" },
      { key: "next_day_rule", label: "翌営業日対応" },
      { key: "add_rule", label: "追加ルール" },
      { key: "exit_rule", label: "売却検討" },
    ])}</section>`,
    `<section><h2>関連</h2><ul><li><a href="practical_action_cockpit_20260614.html">6/18以降 実用判断コックピット</a></li><li><a href="candidate10_risk_trade_rules_20260613.html">候補10社 銘柄別リスク・売買ルール</a></li><li><a href="stop_limit_stress_protocol_20260614.csv">CSVを開く</a></li></ul></section>`,
  ]
);

fs.writeFileSync(path.join(ROOT, "stop_limit_stress_protocol_20260614.html"), html, "utf8");

function insertCard(file, anchorHref, cls) {
  const full = path.join(ROOT, file);
  let s = fs.readFileSync(full, "utf8");
  if (s.includes("stop_limit_stress_protocol_20260614.html")) return;
  const card = `
        <a class="${cls}" href="stop_limit_stress_protocol_20260614.html">
          <b>ストップ安・急落対策プロトコル</b>
          <span>急落警戒度、当日買い増し禁止、翌営業日確認、追加停止、売却検討条件を銘柄別に整理。</span>
        </a>
      `;
  const idx = s.indexOf(anchorHref);
  if (idx >= 0) {
    const end = s.indexOf("</a>", idx);
    if (end >= 0) s = s.slice(0, end + 4) + card + s.slice(end + 4);
  }
  fs.writeFileSync(full, s, "utf8");
}

insertCard("practical_action_cockpit_20260614.html", "candidate10_risk_trade_rules_20260613.html", "link-card");
insertCard("896_practical_entry_hub_20260606.html", "candidate10_financial_confirmation_gate_20260614.html", "link-card");
insertCard("index.html", "candidate10_financial_confirmation_gate_20260614.html", "card");

console.log("generated stop-limit stress protocol");
