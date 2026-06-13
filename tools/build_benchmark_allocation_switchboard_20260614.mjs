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

function yen(value) {
  return `${Math.round(Number(value || 0)).toLocaleString("ja-JP")}円`;
}

function percentNumber(value) {
  const n = Number(String(value ?? "").replace(/[%円,]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function statusClass(value) {
  const s = String(value ?? "");
  if (/0円|停止|見送り|赤|不可|下げる/.test(s)) return "bad";
  if (/注意|半分|確認|保留|小口|黄/.test(s)) return "warn";
  if (/実行候補|維持|緑|可能|優位/.test(s)) return "ok";
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

const allocationRows = parseCsv(readText("108_capital_allocation_by_ticker.csv"));
const riskRows = parseCsv(readText("candidate10_risk_trade_rules_20260613.csv"));
const riskByTicker = Object.fromEntries(riskRows.map((r) => [r.ticker, r]));
const capital = 2_400_000;

const scenarioRows = [
  {
    判定: "現在",
    条件: "6月イベント、本人操作、NISA口座区分、残枠のいずれかが未確認",
    個別株比率: "0%",
    個別株上限: yen(0),
    現金または指数待機: yen(capital),
    実務アクション: "買付0円。注文票を作らない",
    意味: "市場以前の実行条件が未完了",
  },
  {
    判定: "緑",
    条件: "6月イベント結果確認、本人操作、NISA区分がそろい、候補バスケットがS&P500/TOPIXへ+1%以上優位",
    個別株比率: "35%",
    個別株上限: yen(capital * 0.35),
    現金または指数待機: yen(capital * 0.65),
    実務アクション: "初回35%上限。中心候補を厚め、条件付き候補は小口",
    意味: "個別株を選ぶ説明が成立しやすい",
  },
  {
    判定: "黄",
    条件: "優位が0〜+1%未満、またはイベントに注意判定が残る",
    個別株比率: "15%",
    個別株上限: yen(capital * 0.15),
    現金または指数待機: yen(capital * 0.85),
    実務アクション: "初回15%上限。高リスク銘柄はさらに半分",
    意味: "勝ち筋はあるが、指数を明確に上回る根拠が弱い",
  },
  {
    判定: "橙",
    条件: "候補バスケットがS&P500/TOPIXへ-1%以上劣後",
    個別株比率: "0%",
    個別株上限: yen(0),
    現金または指数待機: yen(capital),
    実務アクション: "初回買付を延期。高リスク銘柄を候補から外す",
    意味: "個別株を選ぶ理由が薄い",
  },
  {
    判定: "赤",
    条件: "候補バスケットが-3%以上劣後、または主要銘柄が下方修正",
    個別株比率: "0%",
    個別株上限: yen(0),
    現金または指数待機: yen(capital),
    実務アクション: "個別株追加停止。現金または指数投信を比較候補にする",
    意味: "S&P500/TOPIX +1%目標から外れる可能性が高い",
  },
];

const greenBudget = capital * 0.35;
const yellowBudget = capital * 0.15;

const tickerRows = allocationRows.map((row) => {
  const ticker = row.ticker;
  const risk = riskByTicker[ticker] ?? {};
  const weight = percentNumber(row.target_weight_pct) / 100;
  const rawGreen = greenBudget * weight;
  const rawYellow = yellowBudget * weight;
  const riskCut = risk.risk_tier === "高" ? 0.5 : risk.risk_tier === "中高" ? 0.7 : 1;
  return {
    銘柄: `${ticker} ${row.name}`,
    役割: row.role,
    予定比率: `${percentNumber(row.target_weight_pct)}%`,
    リスク: risk.risk_tier || "未確認",
    緑判定上限: yen(rawGreen),
    黄判定上限: yen(rawYellow * riskCut),
    劣後時: "0円・追加停止",
    比率を下げる意味: "予定していた個別株予算を使わず、現金または指数比較へ戻す",
  };
});

const definitionRows = [
  {
    用語: "個別株比率を下げる",
    意味: "予定していた個別株の買付金額を減らし、未使用分を現金または指数投信の比較枠に戻すこと",
    例: "35%予定なら84万円、15%なら36万円、0%なら買付なし",
  },
  {
    用語: "+1%以上優位",
    意味: "候補10社の合成リターンが、S&P500/TOPIXなどの比較対象を1%以上上回ること",
    例: "候補10社+3%、比較指数+1.5%なら差は+1.5%",
  },
  {
    用語: "劣後",
    意味: "候補10社が比較指数より悪い成績になること",
    例: "候補10社-1%、比較指数+1%なら差は-2%",
  },
  {
    用語: "指数退避",
    意味: "個別株で無理に買わず、S&P500/TOPIX連動投信や現金待機を比較すること",
    例: "個別株が-3%以上劣後なら、追加資金は個別株に入れない",
  },
];

writeCsv("benchmark_allocation_switchboard_20260614.csv", scenarioRows);
writeCsv("benchmark_allocation_by_ticker_20260614.csv", tickerRows);
writeCsv("benchmark_allocation_terms_20260614.csv", definitionRows);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>S&P500/TOPIX +1%目標 資金配分スイッチ</title>
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
  <h1>S&P500/TOPIX +1%目標 資金配分スイッチ</h1>
  <p>個別株が指数を上回る根拠が弱い場合に、どの金額を止め、どの金額を現金または指数比較へ戻すかを明確にした実用画面です。</p>
</header>
<main>
  <section>
    <h2>現在の扱い</h2>
    <p class="notice danger">現時点では、6月イベント・本人操作・NISA口座確認が未完了のため、個別株買付上限は0円です。ここでは、条件がそろった後の資金配分ルールを示します。</p>
    <div class="cards">
      <div class="card"><b>現在</b><strong>0円</strong><span>実行条件未完了</span></div>
      <div class="card"><b>緑判定</b><strong>84万円</strong><span>240万円の35%</span></div>
      <div class="card"><b>黄判定</b><strong>36万円</strong><span>240万円の15%</span></div>
      <div class="card"><b>劣後時</b><strong>0円</strong><span>追加停止</span></div>
    </div>
  </section>

  <section>
    <h2>分岐表</h2>
    ${table(["判定", "条件", "個別株比率", "個別株上限", "現金または指数待機", "実務アクション", "意味"], scenarioRows, {
      条件: "330px",
      実務アクション: "260px",
      意味: "260px",
    })}
  </section>

  <section>
    <h2>銘柄別の上限</h2>
    <p class="notice">黄判定では高リスク銘柄をさらに抑えます。これは売買指示ではなく、6月イベント結果と口座確認が完了した後に使う上限表です。</p>
    ${table(["銘柄", "役割", "予定比率", "リスク", "緑判定上限", "黄判定上限", "劣後時", "比率を下げる意味"], tickerRows, {
      銘柄: "180px",
      比率を下げる意味: "300px",
    })}
  </section>

  <section>
    <h2>用語の意味</h2>
    ${table(["用語", "意味", "例"], definitionRows)}
  </section>

  <section>
    <h2>関連画面</h2>
    <ul>
      <li><a href="practical_action_cockpit_20260614.html">実用判断コックピット</a></li>
      <li><a href="ticker_trade_rule_matrix_20260614.html">候補10社 上値・下値・途中決済ルール</a></li>
      <li><a href="benchmark_plus1_trade_gate_20260613.html">S&P500/TOPIX +1%目標 接続ゲート</a></li>
      <li><a href="nisa_account_execution_gate_20260614.html">NISA口座・本人操作 実行ゲート</a></li>
    </ul>
  </section>
  <footer>作成: ${esc(generatedAt)} / 本画面は投資助言ではなく、指数比較に応じた資金配分の確認表です。</footer>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "benchmark_allocation_switchboard_20260614.html"), html, "utf8");

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

const indexCard = `        <a class="card" href="benchmark_allocation_switchboard_20260614.html">
          <b>S&P500/TOPIX +1%目標 資金配分スイッチ</b>
          <span>指数比較に応じて、個別株を84万円・36万円・0円へ切り替える実務表。</span>
        </a>`;
const hubCard = `        <a class="link-card" href="benchmark_allocation_switchboard_20260614.html">
          <b>S&P500/TOPIX +1%目標 資金配分スイッチ</b>
          <span>指数比較に応じて、個別株を84万円・36万円・0円へ切り替える実務表。</span>
        </a>`;
const cockpitLink = `    <li><a href="benchmark_allocation_switchboard_20260614.html">S&P500/TOPIX +1%目標 資金配分スイッチ</a></li>`;

insertBefore("index.html", '<a class="secondary" href="june_event_gate_engine.html"', `${indexCard}\n`, "benchmark_allocation_switchboard_20260614.html");
insertBefore("896_practical_entry_hub_20260606.html", '<a class="link-card" href="post_0618_prebuy_final_verification_20260613.html"', `${hubCard}\n`, "benchmark_allocation_switchboard_20260614.html");
insertBefore("practical_action_cockpit_20260614.html", "</ul>", `${cockpitLink}\n`, "benchmark_allocation_switchboard_20260614.html");

console.log("generated benchmark_allocation_switchboard_20260614.html");
