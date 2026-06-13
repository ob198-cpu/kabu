import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/14 01:05";

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

function num(value, fallback = 0) {
  const n = Number(String(value ?? "").replace(/[%円,]/g, ""));
  return Number.isFinite(n) ? n : fallback;
}

function yen(value) {
  return `${Math.round(num(value)).toLocaleString("ja-JP")}円`;
}

function statusClass(value) {
  const s = String(value ?? "");
  if (/(不可|未入力|未確認|停止|NG|0円)/.test(s)) return "bad";
  if (/(注意|一部|要確認|確認中|保留)/.test(s)) return "warn";
  if (/(可能|確認済み|OK|完了|通過)/.test(s)) return "ok";
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
<footer>作成: ${h(generatedAt)} / 本画面は口座状態と本人操作の確認表であり、代理操作や自動売買を行うものではありません。</footer>
</main>
</body>
</html>`;
}

const accounts = parseCsv(readText("nisa_account_linkage_template_20260613.csv"));
const events = parseCsv(readText("102_june_event_result_input.csv"));
const allocation = parseCsv(readText("108_capital_allocation_by_ticker.csv"));

const hasMissingEvents = events.some((e) => /未入力/.test(`${e.current_status}${e.actual_value}`) || !String(e.current_status || "").trim());
const hasAttention = events.some((e) => /注意/.test(`${e.current_status}${e.market_reaction}`));
const eventScenario = hasMissingEvents ? "未入力あり" : hasAttention ? "注意あり" : "全通過";
const baseUpper = hasMissingEvents ? 0 : hasAttention ? 360000 : 840000;

function isReady(row) {
  return row.owner_name !== "未入力"
    && row.broker !== "未入力"
    && /確認済み|OK|開設済み/.test(row.nisa_status)
    && /確認済み|OK|準備済み/.test(row.phone_status)
    && /確認済み|OK|準備済み/.test(row.bank_status)
    && /確認済み|OK|設定済み/.test(row.two_factor)
    && num(row.nisa_remaining_yen, -1) > 0
    && /本人操作/.test(row.order_authority);
}

function missing(row) {
  const items = [];
  if (row.owner_name === "未入力") items.push("本人名");
  if (row.broker === "未入力") items.push("証券会社");
  if (!/確認済み|OK|開設済み/.test(row.nisa_status)) items.push("NISA口座");
  if (!/確認済み|OK|準備済み/.test(row.phone_status)) items.push("本人スマホ");
  if (!/確認済み|OK|準備済み/.test(row.bank_status)) items.push("本人銀行口座");
  if (!/確認済み|OK|設定済み/.test(row.two_factor)) items.push("二段階認証");
  if (num(row.nisa_remaining_yen, -1) <= 0) items.push("NISA残枠");
  if (!/本人操作/.test(row.order_authority)) items.push("本人操作");
  return items;
}

const accountRows = accounts.map((row) => {
  const ready = isReady(row);
  const miss = missing(row);
  const accountUpper = ready ? Math.min(baseUpper, num(row.nisa_remaining_yen)) : 0;
  return {
    account_id: row.account_id,
    owner_name: row.owner_name,
    broker: row.broker,
    nisa_status: row.nisa_status,
    phone_status: row.phone_status,
    bank_status: row.bank_status,
    two_factor: row.two_factor,
    nisa_remaining_yen: row.nisa_remaining_yen,
    event_scenario: eventScenario,
    account_ready: ready ? "購入準備OK" : "購入不可",
    account_buy_upper_yen: yen(accountUpper),
    missing_items: miss.join(" / ") || "なし",
    next_action: ready ? "6月イベント通過後に本人が注文票を確認して発注" : `${miss.join("、")}を確認`,
    operation_rule: "本人名義スマホ・本人ログイン・本人操作。第三者がID/PWを預からない",
  };
});

writeCsv("nisa_account_execution_gate_20260614.csv", accountRows);

const orderRows = [];
for (const account of accountRows) {
  for (const ticker of allocation) {
    const upper = num(account.account_buy_upper_yen);
    const weight = num(ticker.target_weight_pct);
    const amount = upper > 0 ? Math.floor((upper * weight) / 100) : 0;
    orderRows.push({
      account_id: account.account_id,
      owner_name: account.owner_name,
      ticker: ticker.ticker,
      name: ticker.name,
      role: ticker.role,
      target_weight_pct: `${weight}%`,
      order_upper_yen: yen(amount),
      order_status: amount > 0 ? "本人確認後に注文候補" : "注文不可",
      required_screen_check: "証券会社画面で口座区分がNISAになっていることを本人が確認",
    });
  }
}
writeCsv("nisa_account_order_ticket_template_20260614.csv", orderRows);

const summaryRows = [
  { item: "口座数", count: `${accountRows.length}`, meaning: "本人別に確認する枠" },
  { item: "購入準備OK", count: `${accountRows.filter((r) => r.account_ready === "購入準備OK").length}/${accountRows.length}`, meaning: "本人操作・NISA残枠まで通った口座" },
  { item: "現在の口座別上限", count: yen(accountRows.reduce((sum, r) => sum + num(r.account_buy_upper_yen), 0)), meaning: "未入力イベントまたは口座未確認があるため現状は0円" },
  { item: "イベント状態", count: eventScenario, meaning: "日銀・FOMC・最終購入前確認が未入力なら買付不可" },
];

const html = page(
  "NISA口座・本人操作 実行ゲート",
  "本人別のNISA口座、本人スマホ、本人ログイン、銀行口座、二段階認証、NISA残枠を購入上限へ接続します。未確認の口座は注文候補を0円にします。",
  [
    `<section><h2>現在の結論</h2><p class="notice danger">現時点では、口座別の購入上限は合計 ${h(yen(accountRows.reduce((sum, r) => sum + num(r.account_buy_upper_yen), 0)))} です。イベント未入力または本人別確認が未完了のため、本人ごとの注文票には進みません。</p><div class="cards">${summaryRows.map((r) => `<div class="card"><b>${h(r.item)}</b><strong>${h(r.count)}</strong><span>${h(r.meaning)}</span></div>`).join("")}</div></section>`,
    `<section><h2>本人別 実行ゲート</h2>${table(accountRows, [
      { key: "account_id", label: "口座" },
      { key: "owner_name", label: "本人" },
      { key: "broker", label: "証券会社" },
      { key: "nisa_status", label: "NISA" },
      { key: "phone_status", label: "本人スマホ" },
      { key: "bank_status", label: "銀行口座" },
      { key: "two_factor", label: "二段階認証" },
      { key: "nisa_remaining_yen", label: "NISA残枠" },
      { key: "event_scenario", label: "イベント" },
      { key: "account_ready", label: "判定" },
      { key: "account_buy_upper_yen", label: "口座別上限" },
      { key: "missing_items", label: "未確認" },
      { key: "next_action", label: "次の作業" },
      { key: "operation_rule", label: "操作ルール" },
    ])}</section>`,
    `<section><h2>注文票テンプレートへの接続</h2><p>本人別ゲートが通過した口座だけ、候補10社の比率に応じた注文上限を出します。現時点では全口座0円です。</p><p><a href="nisa_account_order_ticket_template_20260614.csv">本人別注文票CSVを開く</a></p></section>`,
    `<section><h2>関連</h2><ul><li><a href="practical_action_cockpit_20260614.html">6/18以降 実用判断コックピット</a></li><li><a href="nisa_account_linkage_template_20260613.html">NISA口座・本人操作 連動テンプレート</a></li><li><a href="nisa_account_execution_gate_20260614.csv">口座ゲートCSVを開く</a></li></ul></section>`,
  ]
);

fs.writeFileSync(path.join(ROOT, "nisa_account_execution_gate_20260614.html"), html, "utf8");

function insertCard(file, anchorHref, cls) {
  const full = path.join(ROOT, file);
  let s = fs.readFileSync(full, "utf8");
  if (s.includes("nisa_account_execution_gate_20260614.html")) return;
  const card = `
        <a class="${cls}" href="nisa_account_execution_gate_20260614.html">
          <b>NISA口座・本人操作 実行ゲート</b>
          <span>本人別のNISA口座、本人スマホ、銀行口座、二段階認証、残枠を購入上限へ接続。</span>
        </a>
      `;
  const idx = s.indexOf(anchorHref);
  if (idx >= 0) {
    const end = s.indexOf("</a>", idx);
    if (end >= 0) s = s.slice(0, end + 4) + card + s.slice(end + 4);
  }
  fs.writeFileSync(full, s, "utf8");
}

insertCard("practical_action_cockpit_20260614.html", "nisa_account_linkage_template_20260613.html", "link-card");
insertCard("896_practical_entry_hub_20260606.html", "stop_limit_stress_protocol_20260614.html", "link-card");
insertCard("index.html", "stop_limit_stress_protocol_20260614.html", "card");

console.log("generated nisa account execution gate");
