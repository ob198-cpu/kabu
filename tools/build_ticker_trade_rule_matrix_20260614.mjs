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
  const headers = rows[0];
  return rows.slice(1).map((line) => Object.fromEntries(headers.map((h, i) => [h, line[i] ?? ""])));
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, rows, headers = Object.keys(rows[0] ?? {})) {
  const body = rows.map((row) => headers.map((h) => csvCell(row[h])).join(",")).join("\n");
  fs.writeFileSync(path.join(ROOT, file), `\uFEFF${headers.join(",")}\n${body}\n`, "utf8");
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function numberFromPercent(value) {
  const n = Number(String(value ?? "").replace(/[%円,]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function statusClass(value) {
  const s = String(value ?? "");
  if (/不可|停止|除外|売却検討|赤/.test(s)) return "bad";
  if (/保留|確認|条件|監視|注意|縮小/.test(s)) return "warn";
  if (/候補|通過|維持|可/.test(s)) return "ok";
  return "";
}

function table(headers, rows, widths = {}) {
  return `<div class="table-wrap"><table><thead><tr>${headers
    .map((h) => `<th${widths[h] ? ` style="width:${widths[h]}"` : ""}>${esc(h)}</th>`)
    .join("")}</tr></thead><tbody>${rows
    .map(
      (row) =>
        `<tr>${headers
          .map((h) => `<td class="${statusClass(row[h])}">${esc(row[h])}</td>`)
          .join("")}</tr>`,
    )
    .join("")}</tbody></table></div>`;
}

function riskLines(riskTier, universeStatus) {
  if (universeStatus === "除外") {
    return {
      firstBuy: "初回買付不可",
      downside: "購入対象に戻す前に、直近60日・決算後20営業日・最大下落理由を再確認",
      partialExit: "保有していない前提。保有済みなら追加停止し、売却候補として再審査",
      profitTake: "購入対象外のため利確ルールではなく監視ルールで扱う",
      addBuy: "追加不可",
    };
  }
  if (riskTier === "高") {
    return {
      firstBuy: "小口のみ。6月イベントの結果確認後でも予定比率の半分以下から開始",
      downside: "買値から-5%で追加停止、-10%で保有理由を再点検、-15%で縮小候補",
      partialExit: "指数にも劣後、または決算根拠が崩れた場合は一部売却候補",
      profitTake: "+15%以上かつ出来高急増なら、目標比率超過分の利確を確認",
      addBuy: "指数+1%以上の優位、決算後反応改善、材料継続の3条件がそろうまで追加しない",
    };
  }
  if (riskTier === "中高") {
    return {
      firstBuy: "条件付き小口。イベント後に価格と決算反応を再確認",
      downside: "買値から-6%で追加停止、-11%で保有理由を再点検、-15%で縮小候補",
      partialExit: "決算後反応が悪化し、指数にも劣後する場合は一部売却候補",
      profitTake: "+18%以上で目標比率超過なら一部利確を確認",
      addBuy: "指数+1%以上の優位と財務確認がそろった場合のみ追加検討",
    };
  }
  return {
    firstBuy: "中心候補。イベント・口座・指数比較を確認した後に予定比率内で検討",
    downside: "買値から-7%で追加停止、-12%で保有理由を再点検、-18%で縮小候補",
    partialExit: "下方修正、還元姿勢悪化、指数劣後が重なる場合は一部売却候補",
    profitTake: "+20%以上で目標比率超過なら一部利確を確認",
    addBuy: "指数+1%以上の優位が続き、6月ゲートが緑の場合のみ追加検討",
  };
}

const strictRows = parseCsv(readText("candidate10_strict_gate_review_20260613.csv"));
const riskRows = parseCsv(readText("candidate10_risk_trade_rules_20260613.csv"));
const financeRows = parseCsv(readText("candidate10_financial_confirmation_gate_20260614.csv"));
const orderRows = parseCsv(readText("nisa_account_order_ticket_template_20260614.csv"));

const riskByTicker = Object.fromEntries(riskRows.map((r) => [r.ticker, r]));
const financeByTicker = Object.fromEntries(financeRows.map((r) => [r.ticker, r]));
const orderByTicker = Object.groupBy
  ? Object.groupBy(orderRows, (r) => r.ticker)
  : orderRows.reduce((acc, r) => {
      (acc[r.ticker] ||= []).push(r);
      return acc;
    }, {});

const rows = strictRows.map((s) => {
  const risk = riskByTicker[s.ticker] ?? {};
  const finance = financeByTicker[s.ticker] ?? {};
  const ticketRows = orderByTicker[s.ticker] ?? [];
  const orderUpperTotal = ticketRows.reduce((sum, r) => sum + numberFromPercent(r.order_upper_yen), 0);
  const rules = riskLines(risk.risk_tier || "未確認", s.universe_status);
  const financialGate =
    finance.financial_status === "pass"
      ? "財務確認済み"
      : finance.financial_status === "partial"
        ? "財務確認が必要"
        : "未接続";
  const currentOrderStatus = orderUpperTotal > 0 ? "注文票に金額あり" : "現時点は注文不可";
  return {
    銘柄: `${s.ticker} ${s.name}`,
    役割: s.role,
    現在分類: s.universe_status,
    財務ゲート: financialGate,
    リスク: risk.risk_tier || "未確認",
    予定比率: s.target_weight_pct,
    初回買付方針: currentOrderStatus === "現時点は注文不可" ? "イベント・口座未完了のため0円" : rules.firstBuy,
    下値ルール: rules.downside,
    上値ルール: rules.profitTake,
    途中決済: rules.partialExit,
    追加買付: rules.addBuy,
    ストップ安級対応: "当日は買い増し禁止。翌営業日に出来高、気配、指数差、会社発表、テーマ崩れの有無を確認して再判定",
    注文票: currentOrderStatus,
  };
});

const summaryRows = [
  {
    項目: "現在の購入可否",
    内容: "全銘柄、現時点では注文票0円",
    理由: "6月イベント、本人操作、NISA口座区分、NISA残枠が未完了",
  },
  {
    項目: "下値ルール",
    内容: "高リスクほど浅い下落で追加停止",
    理由: "半導体・電線などは上振れも大きい一方、過去最大下落も大きいため同じ損切り線にしない",
  },
  {
    項目: "上値ルール",
    内容: "上昇時は自動売却ではなく目標比率超過分を確認",
    理由: "NISA 1年保有テストなので、短期利確で目的が崩れないようにする",
  },
  {
    項目: "途中決済",
    内容: "下方修正、指数劣後、テーマ崩れが重なった場合に縮小候補",
    理由: "株価だけでなく、当初の選定理由が壊れたかを確認する",
  },
];

writeCsv("ticker_trade_rule_matrix_20260614.csv", rows);
writeCsv("ticker_trade_rule_summary_20260614.csv", summaryRows);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 上値・下値・途中決済ルール</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--warn:#9a5b00;--red:#b42318;--green:#116b4f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.7}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);line-height:1.2;letter-spacing:0}
    header p{margin:0;font-weight:800;max-width:1180px}
    main{max-width:1560px;margin:0 auto;padding:22px}
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
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:10px 12px;vertical-align:top;overflow-wrap:anywhere;word-break:normal}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    td.ok{color:var(--green);font-weight:900}
    td.warn{color:var(--warn);font-weight:900}
    td.bad{color:var(--red);font-weight:900}
    a{color:#005f99;font-weight:900}
    footer{font-size:13px;color:#526b82;margin:20px 0}
    @media(max-width:900px){main{padding:12px}.cards{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:12px;padding:6px 7px}}
  </style>
</head>
<body>
<header>
  <h1>候補10社 上値・下値・途中決済ルール</h1>
  <p>候補10社を買った後に、どの条件で追加停止・縮小候補・利確確認・監視継続に分けるかを整理した実用画面です。</p>
</header>
<main>
  <section>
    <h2>現在の扱い</h2>
    <p class="notice danger">現時点では購入実行画面ではありません。6月イベント、本人操作、NISA口座区分、NISA残枠が未完了のため、注文票は全銘柄0円です。</p>
    <div class="cards">
      <div class="card"><b>注文票</b><strong>0円</strong><span>口座ゲート未完了</span></div>
      <div class="card"><b>主な目的</b><strong>売買後ルール</strong><span>買った後に迷わないため</span></div>
      <div class="card"><b>下値</b><strong>銘柄別</strong><span>高リスクほど浅く停止</span></div>
      <div class="card"><b>上値</b><strong>確認型</strong><span>自動利確ではなく比率超過を確認</span></div>
    </div>
  </section>

  <section>
    <h2>ルールの要点</h2>
    ${table(["項目", "内容", "理由"], summaryRows)}
  </section>

  <section>
    <h2>銘柄別ルール</h2>
    <p class="notice">この表は、買付判断そのものではなく、買付後の運用ルールです。除外・監視・財務未確認の銘柄は、下値ルール以前に購入候補へ戻す条件を満たす必要があります。</p>
    ${table(
      [
        "銘柄",
        "役割",
        "現在分類",
        "財務ゲート",
        "リスク",
        "予定比率",
        "初回買付方針",
        "下値ルール",
        "上値ルール",
        "途中決済",
        "追加買付",
        "ストップ安級対応",
        "注文票",
      ],
      rows,
      {
        銘柄: "170px",
        初回買付方針: "180px",
        下値ルール: "230px",
        上値ルール: "220px",
        途中決済: "230px",
        追加買付: "230px",
      },
    )}
  </section>

  <section>
    <h2>関連画面</h2>
    <ul>
      <li><a href="practical_action_cockpit_20260614.html">実用判断コックピット</a></li>
      <li><a href="nisa_account_execution_gate_20260614.html">NISA口座・本人操作 実行ゲート</a></li>
      <li><a href="stop_limit_stress_protocol_20260614.html">ストップ安・急落対策プロトコル</a></li>
      <li><a href="benchmark_plus1_trade_gate_20260613.html">S&P500/TOPIX +1%目標 接続ゲート</a></li>
    </ul>
  </section>
  <footer>作成: ${esc(generatedAt)} / 本画面は売買指示ではなく、購入後に確認するルールを整理したものです。</footer>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "ticker_trade_rule_matrix_20260614.html"), html, "utf8");

function insertBefore(file, needle, block, marker) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return false;
  let text = fs.readFileSync(full, "utf8");
  if (text.includes(marker)) return false;
  const index = text.indexOf(needle);
  if (index < 0) return false;
  text = `${text.slice(0, index)}${block}\n${text.slice(index)}`;
  fs.writeFileSync(full, text, "utf8");
  return true;
}

const indexCard = `        <a class="card" href="ticker_trade_rule_matrix_20260614.html">
          <b>候補10社 上値・下値・途中決済ルール</b>
          <span>買付後の追加停止、縮小候補、利確確認、ストップ安級対応を銘柄別に整理。</span>
        </a>`;

const hubCard = `        <a class="link-card" href="ticker_trade_rule_matrix_20260614.html">
          <b>候補10社 上値・下値・途中決済ルール</b>
          <span>買付後の追加停止、縮小候補、利確確認、ストップ安級対応を銘柄別に整理。</span>
        </a>`;

const cockpitLink = `    <li><a href="ticker_trade_rule_matrix_20260614.html">候補10社 上値・下値・途中決済ルール</a></li>`;

insertBefore("index.html", '<a class="secondary" href="june_event_gate_engine.html"', `${indexCard}\n`, "ticker_trade_rule_matrix_20260614.html");
insertBefore("896_practical_entry_hub_20260606.html", '<a class="link-card" href="post_0618_prebuy_final_verification_20260613.html"', `${hubCard}\n`, "ticker_trade_rule_matrix_20260614.html");
insertBefore("practical_action_cockpit_20260614.html", "</ul>", `${cockpitLink}\n`, "ticker_trade_rule_matrix_20260614.html");

console.log("generated ticker_trade_rule_matrix_20260614.html");
