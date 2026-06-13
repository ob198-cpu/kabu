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

function cls(value) {
  const s = String(value ?? "");
  if (/購入不可|0円|除外|停止|禁止|未確認|未入力|不可|ロック|C/.test(s)) return "bad";
  if (/条件付き|保留|監視|注意|partial|黄|補完/.test(s)) return "warn";
  if (/候補|pass|済み|緑|通過|A|B/.test(s)) return "ok";
  return "";
}

function table(headers, rows, widths = {}) {
  return `<div class="table-wrap"><table><thead><tr>${headers
    .map((h) => `<th${widths[h] ? ` style="width:${widths[h]}"` : ""}>${esc(h)}</th>`)
    .join("")}</tr></thead><tbody>${rows
    .map(
      (row) =>
        `<tr>${headers
          .map((h) => `<td class="${cls(row[h])}">${esc(row[h])}</td>`)
          .join("")}</tr>`,
    )
    .join("")}</tbody></table></div>`;
}

function yenNumber(text) {
  const n = Number(String(text ?? "").replace(/[円,"]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function yen(value) {
  return `${Math.round(Number(value) || 0).toLocaleString("ja-JP")}円`;
}

const allocations = parseCsv(readText("108_capital_allocation_by_ticker.csv"));
const benchmarkRows = parseCsv(readText("benchmark_allocation_by_ticker_20260614.csv"));
const locks = parseCsv(readText("remaining_gap_purchase_lock_by_ticker_20260614.csv"));
const scenarios = parseCsv(readText("june_event_input_scenarios_20260614.csv"));
const accounts = parseCsv(readText("nisa_account_execution_gate_20260614.csv"));
const financialRows = parseCsv(readText("candidate10_financial_confirmation_gate_20260614.csv"));

const benchmarkByTicker = new Map(
  benchmarkRows.map((row) => {
    const code = String(row.銘柄 ?? "").split(" ")[0];
    return [code, row];
  }),
);
const lockByTicker = new Map(locks.map((row) => [row.ticker, row]));
const financialByTicker = new Map(financialRows.map((row) => [row.ticker, row]));

const currentScenario = scenarios.find((row) => row.判定 === "現在") ?? {};
const currentScenarioUpper = yenNumber(currentScenario.個別株上限);
const readyAccounts = accounts.filter((row) => row.account_ready !== "購入不可").length;
const accountReady = readyAccounts === accounts.length && accounts.length > 0;
const eventReady = currentScenario.判定 !== "現在" && currentScenarioUpper > 0;

const decisionRows = allocations.map((row) => {
  const code = row.ticker;
  const benchmark = benchmarkByTicker.get(code) ?? {};
  const lock = lockByTicker.get(code) ?? {};
  const financial = financialByTicker.get(code) ?? {};
  const blockers = [];
  if (!eventReady) blockers.push("6月イベント未完了");
  if (!accountReady) blockers.push("本人別NISA口座未確認");
  if (financial.financial_status !== "pass") blockers.push("公式財務がpartial");
  if (/除外/.test(financial.universe_status ?? lock["100社扱い"] ?? "")) blockers.push("100社再選定で除外");
  if (/監視/.test(financial.universe_status ?? lock["100社扱い"] ?? "")) blockers.push("監視扱い");
  if (/C/.test(lock.期待仮説信頼度 ?? "")) blockers.push("期待仮説信頼度C");
  if (/決算後反応が弱い/.test(lock.ロック内容 ?? "")) blockers.push("決算後反応が弱い");
  if (/過去最大下落が大きい/.test(lock.ロック内容 ?? "")) blockers.push("過去最大下落が大きい");

  let gate = "購入不可";
  if (eventReady && accountReady && financial.financial_status === "pass" && !/除外|監視/.test(financial.universe_status ?? "")) {
    gate = "購入候補";
  } else if (eventReady && accountReady && financial.financial_status === "pass") {
    gate = "条件付き保留";
  }

  const green = yenNumber(benchmark.緑判定上限 || row.all_pass_allocation_yen);
  const yellow = yenNumber(benchmark.黄判定上限 || row.attention_allocation_yen);
  const simulatedUpper = gate === "購入候補" ? green : 0;
  const yellowUpper = gate === "購入候補" || gate === "条件付き保留" ? yellow : 0;
  const recover = [];
  if (!eventReady) recover.push("日銀・FOMC・最終確認を入力");
  if (!accountReady) recover.push("本人別NISA口座・本人操作・残枠を確認");
  if (financial.financial_status !== "pass") recover.push("公式IRでPER/PBR/ROE・利益率・受注等を補完");
  if (/除外|監視/.test(financial.universe_status ?? "")) recover.push("100社再選定の除外・監視理由が解消するまで保留");
  if ((lock.期待仮説信頼度 ?? "") === "C") recover.push("期待仮説信頼度Cの理由を解消または比率抑制");

  return {
    ticker: code,
    銘柄: row.name,
    役割: row.role,
    現判定: gate,
    現上限: "0円",
    緑時参考上限: yen(green),
    黄時参考上限: yen(yellowUpper),
    ブロック理由: blockers.join(" / ") || "イベント・口座・財務がそろえば再判定",
    解除条件: recover.join(" / ") || "全ゲート通過後に注文票へ反映",
    "100社扱い": financial.universe_status || lock["100社扱い"] || "",
    財務状態: financial.financial_status || lock.財務状態 || "",
    期待信頼度: lock.期待仮説信頼度 || "",
    決算後反応: lock.決算後反応 || "",
    最大下落: lock.最大下落 || "",
    注文票反映: simulatedUpper > 0 ? "候補" : "反映しない",
  };
});

const summaryRows = [
  {
    項目: "現在の総合判定",
    状態: "購入不可",
    数値: "買付上限0円",
    理由: "6月イベント・本人別NISA口座・一部公式財務が未完了のため",
  },
  {
    項目: "口座準備",
    状態: `${readyAccounts}/${accounts.length}口座確認済み`,
    数値: accountReady ? "通過" : "0円ロック",
    理由: "本人スマホ、本人ログイン、NISA残枠、注文画面のNISA区分が未確認なら注文へ進めない",
  },
  {
    項目: "イベント準備",
    状態: currentScenario.判定 || "現在",
    数値: currentScenario.個別株上限 || "0円",
    理由: currentScenario.実務 || "日銀・FOMC・最終購入前確認を入力するまで買付しない",
  },
  {
    項目: "銘柄ゲート",
    状態: `${decisionRows.filter((row) => row.財務状態 === "pass").length}/10 財務pass`,
    数値: `${decisionRows.filter((row) => row["100社扱い"] === "再選定候補").length}/10 再選定候補`,
    理由: "財務partial、監視、除外、期待信頼度Cは予定比率を上げない",
  },
];

const flowRows = [
  { 順番: "1", 作業: "6月イベント入力", 通過条件: "日銀・FOMC・最終購入前確認が緑または黄", 失敗時: "全銘柄0円" },
  { 順番: "2", 作業: "本人別NISA口座確認", 通過条件: "本人スマホ・本人ログイン・NISA残枠・注文画面区分確認", 失敗時: "該当口座は0円" },
  { 順番: "3", 作業: "銘柄別ロック確認", 通過条件: "財務pass、再選定候補、期待信頼度A/B、反応弱すぎない", 失敗時: "保留・監視・除外" },
  { 順番: "4", 作業: "資金配分反映", 通過条件: "Green/Yellowの上限内で注文票を作る", 失敗時: "注文票へ反映しない" },
  { 順番: "5", 作業: "購入後記録", 通過条件: "購入理由・指数比・予測誤差・途中決済理由を記録", 失敗時: "次回追加停止" },
];

writeCsv("integrated_purchase_decision_engine_20260614.csv", decisionRows);
writeCsv("integrated_purchase_decision_summary_20260614.csv", summaryRows);
writeCsv("integrated_purchase_decision_flow_20260614.csv", flowRows);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>統合購入可否エンジン</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--warn:#9a5b00;--red:#b42318;--green:#116b4f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.7}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);line-height:1.2;letter-spacing:0}
    header p{margin:0;font-weight:800;max-width:1200px}
    main{max-width:1600px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08)}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:25px}
    .notice{border-left:8px solid var(--red);background:#fff1f1;border-radius:10px;padding:14px 16px;font-weight:900;margin:0 0 14px}
    .sub{border-left-color:var(--blue);background:#eef7ff}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:15px}
    .card strong{display:block;font-size:28px;line-height:1.25;color:var(--blue)}
    .card span{display:block;font-weight:800;color:#263e55}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin-top:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:10px 12px;vertical-align:top;overflow-wrap:anywhere;word-break:normal}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    td.ok{color:var(--green);font-weight:900}
    td.warn{color:var(--warn);font-weight:900}
    td.bad{color:var(--red);font-weight:900}
    .links{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .links a{display:block;text-decoration:none;color:var(--ink);border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:12px;font-weight:900}
    footer{font-size:13px;color:#526b82;margin:20px 0}
    @media(max-width:900px){main{padding:12px}.cards,.links{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:12px;padding:6px 7px}}
  </style>
</head>
<body>
<header>
  <h1>統合購入可否エンジン</h1>
  <p>イベント、口座、財務、100社扱い、期待仮説、急落リスクをまとめて、各銘柄の現上限とブロック理由を出す実用画面です。</p>
</header>
<main>
  <section>
    <h2>現在の結論</h2>
    <p class="notice">現在は全銘柄「購入不可」、現上限は0円です。6月イベント、本人別NISA口座、公式財務の未完了が残っているため、注文票へ金額を反映しません。</p>
    <div class="cards">
      <div class="card"><b>総合判定</b><strong>購入不可</strong><span>全銘柄0円</span></div>
      <div class="card"><b>イベント上限</b><strong>${esc(currentScenario.個別株上限 || "0円")}</strong><span>${esc(currentScenario.判定 || "現在")}</span></div>
      <div class="card"><b>口座確認</b><strong>${readyAccounts}/${accounts.length}</strong><span>未確認は0円</span></div>
      <div class="card"><b>財務pass</b><strong>${summaryRows[3].状態.split(" ")[0]}</strong><span>partialは比率引上げ禁止</span></div>
    </div>
  </section>

  <section>
    <h2>統合サマリー</h2>
    ${table(["項目", "状態", "数値", "理由"], summaryRows, { 項目: "180px", 状態: "220px", 数値: "160px", 理由: "700px" })}
  </section>

  <section>
    <h2>候補10社 現在の購入可否</h2>
    <p class="notice sub">緑時・黄時の金額は参考上限です。現在はイベントと口座が未完了のため、現上限は全て0円です。</p>
    ${table(["ticker", "銘柄", "役割", "現判定", "現上限", "緑時参考上限", "黄時参考上限", "ブロック理由", "解除条件", "100社扱い", "財務状態", "期待信頼度", "決算後反応", "最大下落", "注文票反映"], decisionRows, {
      ticker: "92px",
      銘柄: "130px",
      現判定: "100px",
      現上限: "80px",
      緑時参考上限: "110px",
      黄時参考上限: "110px",
      ブロック理由: "360px",
      解除条件: "360px",
    })}
  </section>

  <section>
    <h2>実行の順番</h2>
    ${table(["順番", "作業", "通過条件", "失敗時"], flowRows, { 順番: "60px", 作業: "220px", 通過条件: "520px", 失敗時: "260px" })}
  </section>

  <section>
    <h2>関連画面</h2>
    <div class="links">
      <a href="latest_practical_start_20260614.html">最新 実用パート入口</a>
      <a href="remaining_gap_hardening_board_20260614.html">未完了改善・購入ロック一覧</a>
      <a href="june_event_input_decision_board_20260614.html">6月イベント入力・判定ボード</a>
      <a href="nisa_account_execution_gate_20260614.html">NISA口座・本人操作 実行ゲート</a>
      <a href="benchmark_allocation_switchboard_20260614.html">S&P500/TOPIX +1% 資金配分スイッチ</a>
      <a href="postbuy_operation_record_board_20260614.html">購入後 運用記録・予実管理ボード</a>
    </div>
  </section>
  <footer>作成: ${esc(generatedAt)} / 本画面は購入推奨ではありません。各ゲートの未完了を買付上限へ反映するための実用画面です。</footer>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "integrated_purchase_decision_engine_20260614.html"), html, "utf8");

function insertCard(file, marker, card) {
  const full = path.join(ROOT, file);
  let text = fs.readFileSync(full, "utf8");
  if (text.includes("integrated_purchase_decision_engine_20260614.html")) return false;
  const index = text.indexOf(marker);
  if (index === -1) return false;
  text = `${text.slice(0, index + marker.length)}\n${card}\n${text.slice(index + marker.length)}`;
  fs.writeFileSync(full, text, "utf8");
  return true;
}

function insertBefore(file, marker, card) {
  const full = path.join(ROOT, file);
  let text = fs.readFileSync(full, "utf8");
  if (text.includes("integrated_purchase_decision_engine_20260614.html")) return false;
  const index = text.indexOf(marker);
  if (index === -1) return false;
  text = `${text.slice(0, index)}${card}\n${text.slice(index)}`.replace(/日々見る画面を9個/g, "日々見る画面を10個");
  fs.writeFileSync(full, text, "utf8");
  return true;
}

insertCard(
  "index.html",
  `<span>買う・待つ・止める条件、6月イベント入力、候補10社の現時点の扱いを1画面で確認。</span>
        </a>`,
  `
        <a class="card" href="integrated_purchase_decision_engine_20260614.html">
          <b>統合購入可否エンジン</b>
          <span>イベント、口座、財務、100社扱い、期待仮説をまとめて、各銘柄の0円理由と解除条件を表示。</span>
        </a>`,
);

insertCard(
  "896_practical_entry_hub_20260606.html",
  `<span>買う・待つ・止める条件、6月イベント入力、候補10社の現時点の扱いを1画面で確認。</span>
        </a>`,
  `
        <a class="link-card" href="integrated_purchase_decision_engine_20260614.html">
          <b>統合購入可否エンジン</b>
          <span>イベント、口座、財務、100社扱い、期待仮説をまとめて、各銘柄の0円理由と解除条件を表示。</span>
        </a>`,
);

insertCard(
  "practical_action_cockpit_20260614.html",
  `<li><a href="decision_improvement_pack_20260613.html">実用判断 改善パック</a></li>`,
  `
    <li><a href="integrated_purchase_decision_engine_20260614.html">統合購入可否エンジン</a></li>`,
);

insertBefore(
  "latest_practical_start_20260614.html",
  `<a class="step" href="remaining_gap_hardening_board_20260614.html">`,
  `<a class="step" href="integrated_purchase_decision_engine_20260614.html">
        <b>6. 統合購入可否エンジン</b>
        <span>イベント、口座、財務、100社扱い、期待仮説をまとめて、各銘柄の0円理由と解除条件を確認する。</span>
        <em>購入前</em>
      </a>`,
);

{
  const latestFile = path.join(ROOT, "latest_practical_start_20260614.html");
  let latest = fs.readFileSync(latestFile, "utf8");
  latest = latest
    .replace(/日々見る画面を9個/g, "日々見る画面を10個")
    .replace("<b>6. 未完了改善・購入ロック一覧</b>", "<b>7. 未完了改善・購入ロック一覧</b>")
    .replace("<b>7. 候補10社 上値・下値・途中決済ルール</b>", "<b>8. 候補10社 上値・下値・途中決済ルール</b>")
    .replace("<b>8. ストップ安・急落対策プロトコル</b>", "<b>9. ストップ安・急落対策プロトコル</b>")
    .replace("<b>9. 購入後 運用記録・予実管理ボード</b>", "<b>10. 購入後 運用記録・予実管理ボード</b>");
  fs.writeFileSync(latestFile, latest, "utf8");
}

for (const file of ["index.html", "896_practical_entry_hub_20260606.html"]) {
  const full = path.join(ROOT, file);
  let text = fs.readFileSync(full, "utf8");
  text = text.replace(/日々見る画面を8個/g, "日々見る画面を10個");
  fs.writeFileSync(full, text, "utf8");
}

console.log("generated integrated_purchase_decision_engine_20260614.html");
