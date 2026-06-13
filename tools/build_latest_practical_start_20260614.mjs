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

function statusClass(value) {
  const s = String(value ?? "");
  if (/購入不可|0円|未完了|未入力|未確認|停止|不可/.test(s)) return "bad";
  if (/注意|確認|一部|保留|予定|補助/.test(s)) return "warn";
  if (/完了|接続済み|作成済み|利用/.test(s)) return "ok";
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

const cockpit = parseCsv(readText("practical_action_cockpit_20260614.csv"));
const closure = parseCsv(readText("prebuy_readiness_closure_board_20260614.csv"));
const scenarios = parseCsv(readText("june_event_input_scenarios_20260614.csv"));
const accounts = parseCsv(readText("nisa_account_execution_gate_20260614.csv"));

const mainDecision = cockpit.find((r) => r.block === "総合判断") ?? {};
const currentScenario = scenarios.find((r) => r.判定 === "現在") ?? {};
const eventGate = closure.find((r) => r.項目 === "6月イベント") ?? {};
const accountGate = closure.find((r) => r.項目 === "NISA口座・本人操作") ?? {};
const readyAccounts = accounts.filter((a) => a.account_ready !== "購入不可");

const summaryRows = [
  {
    項目: "現在の結論",
    状態: mainDecision.status || "購入不可",
    内容: `買付上限 ${mainDecision.current_value || "0円"}`,
    次にすること: mainDecision.next_action || "イベントと口座を確認する",
  },
  {
    項目: "6月イベント",
    状態: eventGate.現状 || "未完了",
    内容: currentScenario.条件 || "未入力あり",
    次にすること: eventGate.次の作業 || "実数入力",
  },
  {
    項目: "NISA口座",
    状態: accountGate.現状 || `未確認 ${readyAccounts.length}/${accounts.length}`,
    内容: `確認済み ${readyAccounts.length}/${accounts.length}口座`,
    次にすること: accountGate.次の作業 || "本人別に口座情報を入力",
  },
  {
    項目: "注文票",
    状態: "全行0円",
    内容: "イベントゲートと口座ゲートがそろうまで金額を出さない",
    次にすること: "6/18以降に再生成",
  },
];

const practicalLinks = [
  {
    順番: "1",
    画面: "実行準備クロージングボード",
    URL: "prebuy_readiness_closure_board_20260614.html",
    目的: "何が未完了で、なぜ今0円なのかを見る",
    使う場面: "毎回最初",
  },
  {
    順番: "2",
    画面: "6月イベント入力・判定ボード",
    URL: "june_event_input_decision_board_20260614.html",
    目的: "日銀・FOMC・最終確認を緑/黄/赤にする",
    使う場面: "6/15〜6/18",
  },
  {
    順番: "3",
    画面: "NISA口座・本人操作 実行ゲート",
    URL: "nisa_account_execution_gate_20260614.html",
    目的: "本人名義スマホ、本人ログイン、NISA残枠を確認する",
    使う場面: "口座ごと",
  },
  {
    順番: "4",
    画面: "S&P500/TOPIX +1%目標 資金配分スイッチ",
    URL: "benchmark_allocation_switchboard_20260614.html",
    目的: "84万円・36万円・0円のどれにするか決める",
    使う場面: "イベント結果確認後",
  },
  {
    順番: "5",
    画面: "候補10社 財務確認ゲート",
    URL: "candidate10_financial_confirmation_gate_20260614.html",
    目的: "財務確認済みと未確認を分け、未確認値を点数に混ぜない",
    使う場面: "銘柄別確認",
  },
  {
    順番: "6",
    画面: "候補10社 上値・下値・途中決済ルール",
    URL: "ticker_trade_rule_matrix_20260614.html",
    目的: "買付後の追加停止、縮小、利確確認を銘柄別に見る",
    使う場面: "買付前・保有中",
  },
  {
    順番: "7",
    画面: "ストップ安・急落対策プロトコル",
    URL: "stop_limit_stress_protocol_20260614.html",
    目的: "急落時に当日買い増し禁止、翌営業日確認の流れを使う",
    使う場面: "急落時",
  },
  {
    順番: "8",
    画面: "購入後 運用記録・予実管理ボード",
    URL: "postbuy_operation_record_board_20260614.html",
    目的: "買った理由、指数差、予測誤差、途中決済理由を残す",
    使う場面: "購入後",
  },
];

writeCsv("latest_practical_start_20260614.csv", summaryRows);
writeCsv("latest_practical_start_links_20260614.csv", practicalLinks);

const linkCards = practicalLinks
  .map(
    (link) => `<a class="step" href="${esc(link.URL)}">
        <b>${esc(link.順番)}. ${esc(link.画面)}</b>
        <span>${esc(link.目的)}</span>
        <em>${esc(link.使う場面)}</em>
      </a>`,
  )
  .join("\n");

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>最新 実用パート入口</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--warn:#9a5b00;--red:#b42318;--green:#116b4f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.7}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);line-height:1.2;letter-spacing:0}
    header p{margin:0;font-weight:800;max-width:1180px}
    main{max-width:1440px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08)}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:25px}
    .notice{border-left:8px solid var(--red);background:#fff1f1;border-radius:10px;padding:14px 16px;font-weight:900;margin:0 0 14px}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:15px}
    .card strong{display:block;font-size:28px;line-height:1.25;color:var(--blue)}
    .card span{font-weight:800;color:#263e55}
    .steps{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .step{display:block;text-decoration:none;color:var(--ink);border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .step:hover{border-color:var(--blue);box-shadow:0 0 0 2px rgba(11,103,163,.08) inset}
    .step b{display:block;color:var(--navy);font-size:18px;margin-bottom:6px}
    .step span{display:block;font-weight:800;color:#263e55}
    .step em{display:inline-block;margin-top:8px;font-style:normal;font-size:13px;font-weight:900;color:#fff;background:var(--blue);border-radius:999px;padding:3px 9px}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin-top:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:10px 12px;vertical-align:top;overflow-wrap:anywhere;word-break:normal}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    td.ok{color:var(--green);font-weight:900}
    td.warn{color:var(--warn);font-weight:900}
    td.bad{color:var(--red);font-weight:900}
    a{color:#005f99;font-weight:900}
    footer{font-size:13px;color:#526b82;margin:20px 0}
    @media(max-width:900px){main{padding:12px}.cards,.steps{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:12px;padding:6px 7px}}
  </style>
</head>
<body>
<header>
  <h1>最新 実用パート入口</h1>
  <p>日々見る画面を8個に絞った入口です。資料を探す前に、まずこの順番で確認します。</p>
</header>
<main>
  <section>
    <h2>今の結論</h2>
    <p class="notice">現在は購入不可です。買付上限は0円です。理由は、6月イベント未入力、本人別NISA口座未確認、注文票0円が残っているためです。</p>
    <div class="cards">
      <div class="card"><b>総合判断</b><strong>${esc(mainDecision.status || "購入不可")}</strong><span>${esc(mainDecision.current_value || "0円")}</span></div>
      <div class="card"><b>6月イベント</b><strong>${esc(eventGate.買付への影響 || "0円")}</strong><span>${esc(eventGate.現状 || "未完了")}</span></div>
      <div class="card"><b>NISA口座</b><strong>${readyAccounts.length}/${accounts.length}</strong><span>確認済み口座</span></div>
      <div class="card"><b>注文票</b><strong>0円</strong><span>イベント・口座確認後に再生成</span></div>
    </div>
  </section>

  <section>
    <h2>見る順番</h2>
    <div class="steps">
      ${linkCards}
    </div>
  </section>

  <section>
    <h2>現状サマリー</h2>
    ${table(["項目", "状態", "内容", "次にすること"], summaryRows, {
      内容: "360px",
      次にすること: "360px",
    })}
  </section>

  <section>
    <h2>補足</h2>
    <p>資料パートは詳細確認用です。実務では、この入口から「未完了を埋める」「0円の理由を消す」「買付上限を再計算する」「購入後に記録する」の順で使います。</p>
  </section>
  <footer>作成: ${esc(generatedAt)} / 本画面は売買指示ではなく、実用パートの入口整理です。</footer>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "latest_practical_start_20260614.html"), html, "utf8");

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

const indexCard = `        <a class="card" href="latest_practical_start_20260614.html">
          <b>最新 実用パート入口</b>
          <span>日々見る画面を8個に整理。まずここから未完了、0円理由、次の作業を確認。</span>
        </a>`;
const hubCard = `        <a class="link-card" href="latest_practical_start_20260614.html">
          <b>最新 実用パート入口</b>
          <span>日々見る画面を8個に整理。まずここから未完了、0円理由、次の作業を確認。</span>
        </a>`;
const cockpitLink = `    <li><a href="latest_practical_start_20260614.html">最新 実用パート入口</a></li>`;

insertBefore("index.html", '<a href="896_practical_entry_hub_20260606.html">', `${indexCard}\n`, "latest_practical_start_20260614.html");
insertBefore("896_practical_entry_hub_20260606.html", '<a class="link-card" href="post_0618_operation_board_20260613.html"', `${hubCard}\n`, "latest_practical_start_20260614.html");
insertBefore("practical_action_cockpit_20260614.html", "</ul>", `${cockpitLink}\n`, "latest_practical_start_20260614.html");

console.log("generated latest_practical_start_20260614.html");
