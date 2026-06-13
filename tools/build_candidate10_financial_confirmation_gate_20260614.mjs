import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/14 00:25";

function readText(file) {
  const p = path.join(ROOT, file);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8").replace(/^\uFEFF/, "") : "";
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
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
  const head = rows[0].map((v) => v.trim());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

function csvCell(value) {
  const s = String(value ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function writeCsv(file, rows) {
  if (!rows.length) {
    fs.writeFileSync(path.join(ROOT, file), "", "utf8");
    return;
  }
  const head = Object.keys(rows[0]);
  fs.writeFileSync(path.join(ROOT, file), `\uFEFF${[head.join(","), ...rows.map((r) => head.map((h) => csvCell(r[h])).join(","))].join("\n")}\n`, "utf8");
}

function h(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusClass(v) {
  const s = String(v ?? "");
  if (/(購入不可|不可|停止|未確認|未入力|要確認|除外|C)/.test(s)) return "bad";
  if (/(partial|条件付き|保留|監視|B|確認中)/.test(s)) return "warn";
  if (/(pass|確認済み|A|完了|再選定候補)/.test(s)) return "ok";
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
<footer>作成: ${h(generatedAt)} / 本画面は売買指示ではなく、購入前に財務確認を通すための確認表です。</footer>
</main>
</body>
</html>`;
}

const workbench = parseCsv(readText("908_final10_decision_workbench_20260606.csv"));
const strict = parseCsv(readText("candidate10_strict_gate_review_20260613.csv"));
const allocation = parseCsv(readText("108_capital_allocation_by_ticker.csv"));
const reaction = parseCsv(readText("candidate10_reaction_backfill_20260613.csv"));
const confidence = parseCsv(readText("return_hypothesis_confidence_20260613.csv"));

const byTicker = (rows, key = "ticker") => Object.fromEntries(rows.map((r) => [r[key], r]));
const wb = byTicker(workbench);
const st = byTicker(strict);
const rx = byTicker(reaction);
const cf = byTicker(confidence);

const knownSource = {
  "8053.T": "住友商事IR/決算資料",
  "8316.T": "三井住友FG IR/決算短信",
  "6501.T": "日立製作所IR/決算説明会資料",
  "6503.T": "三菱電機IR/決算短信・説明資料",
  "6857.T": "アドバンテストIR/決算資料",
  "8035.T": "東京エレクトロンIR/決算短信",
  "7011.T": "三菱重工IR/決算資料",
  "6762.T": "TDK IR/決算短信",
  "6146.T": "ディスコIR/決算説明資料",
  "5803.T": "フジクラIR/決算短信",
};

function requiredItems(ticker, row) {
  const base = ["PER", "PBR", "ROE", "営業利益率", "今期会社予想", "前期比増減"];
  if (["6503.T", "6857.T", "8035.T", "7011.T", "6762.T", "6146.T", "5803.T"].includes(ticker)) {
    base.push("受注またはセグメント寄与");
  }
  if (["6857.T", "8035.T", "6146.T", "5803.T"].includes(ticker)) {
    base.push("高PER・高PBRを説明できる成長根拠");
  }
  if (["8053.T", "8316.T"].includes(ticker)) {
    base.push("配当・自社株買い・還元方針");
  }
  return base.join(" / ");
}

const rows = allocation.map((a) => {
  const w = wb[a.ticker] || {};
  const s = st[a.ticker] || {};
  const r = rx[a.ticker] || {};
  const c = cf[a.ticker] || {};
  const financialStatus = w.default_financial || s.financial_status || "未接続";
  let gate = "財務確認後";
  let action = "公式資料で数値を入れる";
  if (financialStatus === "pass") {
    gate = "財務確認済み";
    action = "6月イベント・口座確認後に再判定";
  }
  if (s.universe_status === "除外") {
    gate = "初回買付不可";
    action = "財務確認しても、価格・反応・下落理由が解消するまで監視";
  } else if (s.universe_status === "監視") {
    gate = "監視";
    action = "財務確認しても小口候補へ上げるには指数・反応改善が必要";
  }
  if (r.reaction_score && Number(r.reaction_score) < 40) {
    gate = gate === "財務確認済み" ? "反応再確認" : gate;
  }
  return {
    ticker: a.ticker,
    name: a.name,
    role: a.role,
    financial_status: financialStatus,
    universe_status: s.universe_status || "未接続",
    reaction_score: r.reaction_score || "未接続",
    confidence: c.confidence || "未接続",
    required_items: requiredItems(a.ticker, w),
    source_to_check: knownSource[a.ticker] || "公式IR",
    gate,
    action,
    purchase_effect: financialStatus === "pass"
      ? "財務は通過。ただしイベント・口座・指数比較が未完了なら買付不可"
      : "未確認数値を点数に混ぜない。確認完了まで予定比率を上げない",
  };
});

writeCsv("candidate10_financial_confirmation_gate_20260614.csv", rows);

const summary = [
  { item: "財務pass", count: `${rows.filter((r) => r.financial_status === "pass").length}/10`, meaning: "公式決算・主要財務が現行スコア上は通過扱い" },
  { item: "財務partial", count: `${rows.filter((r) => r.financial_status !== "pass").length}/10`, meaning: "PER/PBR/ROE・利益率・受注/セグメント寄与などを購入前に確認" },
  { item: "初回買付不可", count: `${rows.filter((r) => r.gate === "初回買付不可").length}/10`, meaning: "100社再選定・下落・反応の理由で、財務確認だけでは通せない" },
  { item: "監視", count: `${rows.filter((r) => r.gate === "監視").length}/10`, meaning: "テーマ性はあるが初回比率を上げるには追加根拠が必要" },
];

const html = page(
  "候補10社 財務確認ゲート",
  "PER/PBR/ROEだけでなく、利益率、受注、セグメント寄与、高PER説明可否を購入前ゲートとして整理します。未確認数値はスコアに混ぜません。",
  [
    `<section><h2>現在の整理</h2><p class="notice">財務データがpartialの銘柄は、未確認数値を点数に入れず、購入前ゲートで止めます。財務確認済みでも、6月イベント・本人操作・NISA口座区分が未完了なら買付不可です。</p><div class="cards">${summary.map((r) => `<div class="card"><b>${h(r.item)}</b><strong>${h(r.count)}</strong><span>${h(r.meaning)}</span></div>`).join("")}</div></section>`,
    `<section><h2>銘柄別 財務確認ゲート</h2>${table(rows, [
      { key: "ticker", label: "銘柄" },
      { key: "name", label: "名称" },
      { key: "role", label: "役割" },
      { key: "financial_status", label: "財務状態" },
      { key: "universe_status", label: "100社扱い" },
      { key: "reaction_score", label: "決算反応" },
      { key: "confidence", label: "仮説信頼度" },
      { key: "required_items", label: "確認する数値" },
      { key: "source_to_check", label: "確認元" },
      { key: "gate", label: "ゲート" },
      { key: "action", label: "次の作業" },
      { key: "purchase_effect", label: "購入判断への影響" },
    ])}</section>`,
    `<section><h2>関連</h2><ul><li><a href="practical_action_cockpit_20260614.html">6/18以降 実用判断コックピット</a></li><li><a href="candidate10_strict_gate_review_20260613.html">候補10社 厳格ゲートレビュー</a></li><li><a href="candidate10_financial_confirmation_gate_20260614.csv">CSVを開く</a></li></ul></section>`
  ]
);

fs.writeFileSync(path.join(ROOT, "candidate10_financial_confirmation_gate_20260614.html"), html, "utf8");

function insertCard(file, anchorHref, cls) {
  const p = path.join(ROOT, file);
  let s = fs.readFileSync(p, "utf8");
  if (s.includes("candidate10_financial_confirmation_gate_20260614.html")) return;
  const card = `
        <a class="${cls}" href="candidate10_financial_confirmation_gate_20260614.html">
          <b>候補10社 財務確認ゲート</b>
          <span>PER/PBR/ROE・利益率・受注/セグメント寄与・高PER説明可否を購入前確認に接続。</span>
        </a>
      `;
  const idx = s.indexOf(anchorHref);
  if (idx >= 0) {
    const end = s.indexOf("</a>", idx);
    if (end >= 0) s = s.slice(0, end + 4) + card + s.slice(end + 4);
  }
  fs.writeFileSync(p, s, "utf8");
}

insertCard("practical_action_cockpit_20260614.html", "candidate10_strict_gate_review_20260613.html", "link-card");
insertCard("896_practical_entry_hub_20260606.html", "practical_action_cockpit_20260614.html", "link-card");
insertCard("index.html", "practical_action_cockpit_20260614.html", "card");

console.log("generated candidate10 financial confirmation gate");
