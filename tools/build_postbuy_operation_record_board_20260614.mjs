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

function pctNum(value) {
  const parsed = Number(String(value ?? "").replace(/[%円,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function statusClass(value) {
  const s = String(value ?? "");
  if (/停止|不可|見送り|要入力|未開始|0円|赤|Fail/.test(s)) return "bad";
  if (/確認|注意|保留|縮小|Caution|未入力|予定/.test(s)) return "warn";
  if (/維持|完了|Pass|利用可|記録済み/.test(s)) return "ok";
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

const candidates = parseCsv(readText("108_capital_allocation_by_ticker.csv"));
const tradeRules = parseCsv(readText("ticker_trade_rule_matrix_20260614.csv"));
const strictRows = parseCsv(readText("candidate10_strict_gate_review_20260613.csv"));
const tradeByTicker = Object.fromEntries(tradeRules.map((r) => [String(r.銘柄 || "").split(" ")[0], r]));
const strictByTicker = Object.fromEntries(strictRows.map((r) => [r.ticker, r]));

const recordRows = candidates.map((c) => {
  const t = tradeByTicker[c.ticker] ?? {};
  const s = strictByTicker[c.ticker] ?? {};
  return {
    ticker: c.ticker,
    name: c.name,
    role: c.role,
    planned_weight_pct: c.target_weight_pct,
    buy_status: "未開始",
    account_id: "未入力",
    buy_date: "未入力",
    buy_amount_yen: "0円",
    buy_price: "未入力",
    quantity: "未入力",
    benchmark_primary: "S&P500",
    benchmark_secondary: "TOPIX",
    benchmark_start_value: "未入力",
    buy_reason: "未入力",
    no_buy_condition: "未入力",
    downside_rule: t.下値ルール || "未接続",
    upside_rule: t.上値ルール || "未接続",
    review_status: s.universe_status === "除外" ? "初回買付不可" : "記録待ち",
  };
});

const scheduleRows = [
  {
    timing: "購入日",
    purpose: "買付根拠を固定",
    input: "買付日、口座、金額、単価、数量、比較指数の開始値、買った理由、買わない条件",
    formula: "記録のみ",
    action: "記録できない場合は買付しない",
  },
  {
    timing: "翌営業日",
    purpose: "初期反応と急落確認",
    input: "終値、出来高、指数差、材料の真偽",
    formula: "銘柄リターン - 比較指数リターン",
    action: "ストップ安級・前日比-10%以上なら追加停止",
  },
  {
    timing: "5営業日",
    purpose: "初動の過熱・失望を確認",
    input: "5日リターン、指数差、出来高変化",
    formula: "5日超過リターン",
    action: "-1%以上劣後なら追加停止候補",
  },
  {
    timing: "20営業日",
    purpose: "月次の合格確認",
    input: "20日リターン、S&P500/TOPIX差、決算後反応",
    formula: "超過リターン = 銘柄/バスケット - 比較指数",
    action: "-1%以上劣後で追加停止、-3%以上劣後で次回追加を半分",
  },
  {
    timing: "60営業日",
    purpose: "中期の仮説確認",
    input: "60日リターン、最大下落、テーマ継続、会社発表",
    formula: "超過リターン、最大下落率、ボラティリティ",
    action: "-5%以上劣後または下方修正で個別株追加停止",
  },
  {
    timing: "1年",
    purpose: "NISA 1年保有テストの評価",
    input: "1年リターン、配当、比較指数、途中売買理由",
    formula: "税引前リターン、指数差、予測誤差",
    action: "S&P500/TOPIX +1%以上を達成できたか評価",
  },
];

const formulaRows = [
  {
    item: "銘柄リターン",
    formula: "(現在値 - 買値 + 受取配当) ÷ 買値",
    use: "その銘柄が買値から何%増減したかを見る",
  },
  {
    item: "比較指数リターン",
    formula: "(現在の指数値 - 購入日の指数値) ÷ 購入日の指数値",
    use: "S&P500/TOPIXにただ投資した場合との比較",
  },
  {
    item: "超過リターン",
    formula: "銘柄またはバスケットのリターン - 比較指数リターン",
    use: "+1%以上なら個別株を選ぶ根拠が残る。マイナスなら追加停止候補",
  },
  {
    item: "予測誤差",
    formula: "実績リターン - 事前に置いた期待レンジ",
    use: "予想がどれだけ外れたかを記録し、次のモデル修正に使う",
  },
  {
    item: "最大下落率",
    formula: "期間中の高値から安値までの最大下落",
    use: "ストップ安級、追加停止、途中決済ルールの厳しさを調整",
  },
];

const actionRows = [
  {
    condition: "超過リターン +1%以上",
    action: "維持。追加はイベント・口座・銘柄別ルール確認後",
    reason: "個別株を選ぶ目的と整合する",
  },
  {
    condition: "超過リターン 0〜+1%未満",
    action: "維持は可。追加は急がない",
    reason: "指数を明確に上回る根拠がまだ弱い",
  },
  {
    condition: "超過リターン -1%以下",
    action: "追加買付停止",
    reason: "S&P500/TOPIX +1%目標と逆方向",
  },
  {
    condition: "超過リターン -3%以下",
    action: "次回追加比率を半分へ下げる",
    reason: "個別株比率を下げる具体処理",
  },
  {
    condition: "超過リターン -5%以下、または下方修正",
    action: "個別株追加停止。現金または指数比較へ戻す",
    reason: "当初仮説が壊れている可能性が高い",
  },
  {
    condition: "ストップ安級、または前日比-10%以上",
    action: "当日買い増し禁止。翌営業日に出来高、気配、会社発表を確認",
    reason: "理由が分からない急落に反射的に資金を入れない",
  },
];

writeCsv("postbuy_operation_record_template_20260614.csv", recordRows);
writeCsv("postbuy_review_schedule_20260614.csv", scheduleRows);
writeCsv("postbuy_return_formula_rules_20260614.csv", formulaRows);
writeCsv("postbuy_action_rules_20260614.csv", actionRows);

const positiveRecords = recordRows.filter((r) => r.buy_status !== "未開始");

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>購入後 運用記録・予実管理ボード</title>
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
  <h1>購入後 運用記録・予実管理ボード</h1>
  <p>購入した後に、買付根拠、指数比較、超過リターン、途中決済理由、予測誤差を記録するための実用画面です。</p>
</header>
<main>
  <section>
    <h2>現在の状態</h2>
    <p class="notice danger">現時点では購入実績は未開始です。6月イベント、本人操作、NISA口座確認が未完了のため、買付金額は0円のままです。</p>
    <div class="cards">
      <div class="card"><b>購入記録</b><strong>${positiveRecords.length}件</strong><span>現時点は未開始</span></div>
      <div class="card"><b>対象銘柄</b><strong>${recordRows.length}社</strong><span>現在候補10社</span></div>
      <div class="card"><b>確認タイミング</b><strong>${scheduleRows.length}回</strong><span>翌営業日〜1年</span></div>
      <div class="card"><b>目的</b><strong>予実管理</strong><span>予想との差を残す</span></div>
    </div>
  </section>

  <section>
    <h2>購入時に記録する項目</h2>
    <p class="notice">買付理由と買わない条件を残せない場合は、後から検証できないため、テストとしての価値が下がります。</p>
    ${table(["ticker", "name", "role", "planned_weight_pct", "buy_status", "account_id", "buy_date", "buy_amount_yen", "buy_price", "quantity", "benchmark_primary", "benchmark_secondary", "benchmark_start_value", "buy_reason", "no_buy_condition", "review_status"], recordRows, {
      buy_reason: "240px",
      no_buy_condition: "240px",
    })}
  </section>

  <section>
    <h2>確認スケジュール</h2>
    ${table(["timing", "purpose", "input", "formula", "action"], scheduleRows, {
      input: "430px",
      action: "300px",
    })}
  </section>

  <section>
    <h2>計算式</h2>
    ${table(["item", "formula", "use"], formulaRows, { formula: "360px", use: "430px" })}
  </section>

  <section>
    <h2>実績に応じたアクション</h2>
    ${table(["condition", "action", "reason"], actionRows, { action: "360px", reason: "430px" })}
  </section>

  <section>
    <h2>関連画面</h2>
    <ul>
      <li><a href="prebuy_readiness_closure_board_20260614.html">6/18前 実行準備クロージングボード</a></li>
      <li><a href="benchmark_allocation_switchboard_20260614.html">S&P500/TOPIX +1%目標 資金配分スイッチ</a></li>
      <li><a href="ticker_trade_rule_matrix_20260614.html">候補10社 上値・下値・途中決済ルール</a></li>
      <li><a href="nisa_account_execution_gate_20260614.html">NISA口座・本人操作 実行ゲート</a></li>
    </ul>
  </section>
  <footer>作成: ${esc(generatedAt)} / 本画面は購入後の記録・検証用であり、売買指示ではありません。</footer>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "postbuy_operation_record_board_20260614.html"), html, "utf8");

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

const indexCard = `        <a class="card" href="postbuy_operation_record_board_20260614.html">
          <b>購入後 運用記録・予実管理ボード</b>
          <span>買付根拠、指数比較、超過リターン、途中決済理由、予測誤差を記録。</span>
        </a>`;
const hubCard = `        <a class="link-card" href="postbuy_operation_record_board_20260614.html">
          <b>購入後 運用記録・予実管理ボード</b>
          <span>買付根拠、指数比較、超過リターン、途中決済理由、予測誤差を記録。</span>
        </a>`;
const cockpitLink = `    <li><a href="postbuy_operation_record_board_20260614.html">購入後 運用記録・予実管理ボード</a></li>`;

insertBefore("index.html", '<a class="secondary" href="june_event_gate_engine.html"', `${indexCard}\n`, "postbuy_operation_record_board_20260614.html");
insertBefore("896_practical_entry_hub_20260606.html", '<a class="link-card" href="post_0618_prebuy_final_verification_20260613.html"', `${hubCard}\n`, "postbuy_operation_record_board_20260614.html");
insertBefore("practical_action_cockpit_20260614.html", "</ul>", `${cockpitLink}\n`, "postbuy_operation_record_board_20260614.html");

console.log("generated postbuy_operation_record_board_20260614.html");
