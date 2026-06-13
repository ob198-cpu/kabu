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
  if (/未入力|未確認|不可|停止|NG|必須|0円|空欄/.test(s)) return "bad";
  if (/注意|確認中|補完|条件|黄|任意|監視/.test(s)) return "warn";
  if (/確認済み|OK|通過|入力済み|緑|完了/.test(s)) return "ok";
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

const events = parseCsv(readText("102_june_event_result_input.csv"));
const accounts = parseCsv(readText("nisa_account_execution_gate_20260614.csv"));
const financials = parseCsv(readText("candidate10_financial_confirmation_gate_20260614.csv"));

const eventTemplate = events.map((row) => ({
  event_id: row.event_id,
  日付: row.planned_date,
  イベント: row.event,
  入力する実数: row.actual_value || "",
  市場反応: row.market_reaction || "",
  判定入力: row.current_status === "未入力" ? "" : row.current_status,
  入力候補: "緑 / 黄 / 赤 / 注意 / 未入力",
  合格条件: row.pass_condition,
  失敗時対応: row.action_if_fail,
  入力メモ: "",
}));

const accountTemplate = accounts.map((row) => ({
  account_id: row.account_id,
  本人名: row.owner_name === "未入力" ? "" : row.owner_name,
  証券会社: row.broker === "未入力" ? "" : row.broker,
  NISA口座: row.nisa_status === "未確認" ? "" : row.nisa_status,
  本人スマホ: row.phone_status === "未確認" ? "" : row.phone_status,
  本人銀行口座: row.bank_status === "未確認" ? "" : row.bank_status,
  二段階認証: row.two_factor === "未確認" ? "" : row.two_factor,
  NISA残枠円: row.nisa_remaining_yen === "未入力" ? "" : row.nisa_remaining_yen,
  入力候補: "確認済み / 未確認",
  注文可能判定: "全項目確認済みなら再判定",
  メモ: "",
}));

const financialTemplate = financials
  .filter((row) => row.financial_status !== "pass")
  .map((row) => ({
    ticker: row.ticker,
    銘柄: row.name,
    "100社扱い": row.universe_status,
    期待信頼度: row.confidence,
    確認元: row.source_to_check,
    必須項目: row.required_items,
    PER: "",
    PBR: "",
    ROE_pct: "",
    営業利益率_pct: "",
    今期会社予想_前期比: "",
    受注またはセグメント寄与: "",
    高PER説明: "",
    参照URLまたは資料名: "",
    資料日付: "",
    入力状態: "未確認",
    再判定メモ: "",
  }));

const validationRules = [
  { 対象: "6月イベント", OK条件: "actual_value、market_reaction、判定入力が空欄でない", NG条件: "E02/E03/E04が未入力", 反映: "未入力がある間は全銘柄0円" },
  { 対象: "本人別NISA口座", OK条件: "本人名、証券会社、NISA口座、本人スマホ、本人銀行、二段階認証、残枠が確認済み", NG条件: "本人操作またはNISA区分が未確認", 反映: "該当口座は0円" },
  { 対象: "公式財務", OK条件: "PER/PBR/ROE、利益率、会社予想、必要に応じて受注・高PER説明が公式資料で確認済み", NG条件: "partialのまま、または出所がない", 反映: "比率引上げ禁止、監視または保留" },
  { 対象: "除外・監視銘柄", OK条件: "除外・監視理由が解消し、同じゲートを再通過", NG条件: "価格反応・下落・財務説明が弱いまま", 反映: "初回買付不可または小口保留" },
  { 対象: "再生成", OK条件: "入力後に関連CSVとHTMLを再生成", NG条件: "入力しただけで画面未反映", 反映: "古い判定のままになる" },
];

const workflowRows = [
  { 順番: "1", 作業: "event_actual_input_template を埋める", 使う資料: "CPI、日銀、FOMC、指数、為替、金利", 出力: "6月イベント判定の更新" },
  { 順番: "2", 作業: "account_readiness_input_template を埋める", 使う資料: "本人スマホ、証券会社画面、NISA残枠、本人銀行、二段階認証", 出力: "本人別の購入可否" },
  { 順番: "3", 作業: "financial_partial_input_template を埋める", 使う資料: "公式IR、決算短信、決算説明資料", 出力: "partial銘柄の保留解除可否" },
  { 順番: "4", 作業: "統合購入可否エンジンを再生成", 使う資料: "上記3テンプレートの入力結果", 出力: "0円解除可否、上限、注文票反映" },
];

writeCsv("redecision_event_input_template_20260614.csv", eventTemplate);
writeCsv("redecision_account_input_template_20260614.csv", accountTemplate);
writeCsv("redecision_financial_partial_input_template_20260614.csv", financialTemplate);
writeCsv("redecision_validation_rules_20260614.csv", validationRules);
writeCsv("redecision_workflow_20260614.csv", workflowRows);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6/18再判定 入力作業台</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--warn:#9a5b00;--red:#b42318;--green:#116b4f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.7}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);line-height:1.2;letter-spacing:0}
    header p{margin:0;font-weight:800;max-width:1180px}
    main{max-width:1600px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08)}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:25px}
    .notice{border-left:8px solid var(--red);background:#fff1f1;border-radius:10px;padding:14px 16px;font-weight:900;margin:0 0 14px}
    .sub{border-left-color:var(--blue);background:#eef7ff}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin-top:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:10px 12px;vertical-align:top;overflow-wrap:anywhere;word-break:normal}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    td.ok{color:var(--green);font-weight:900}
    td.warn{color:var(--warn);font-weight:900}
    td.bad{color:var(--red);font-weight:900}
    .links{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .links a{display:block;text-decoration:none;color:var(--ink);border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:12px;font-weight:900}
    .downloads{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .downloads a{display:block;text-decoration:none;background:#0b67a3;color:#fff;border-radius:10px;padding:14px;font-weight:900;text-align:center}
    footer{font-size:13px;color:#526b82;margin:20px 0}
    @media(max-width:900px){main{padding:12px}.links,.downloads{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:12px;padding:6px 7px}}
  </style>
</head>
<body>
<header>
  <h1>6/18再判定 入力作業台</h1>
  <p>6/18以降に実データを入れて、購入不可0円を解除できるかを再判定するための入力テンプレートです。</p>
</header>
<main>
  <section>
    <h2>この画面の役割</h2>
    <p class="notice">ここは購入判断の画面ではありません。イベント、本人別口座、公式財務の入力漏れをなくし、入力後に統合購入可否エンジンへ反映するための作業台です。</p>
    <div class="downloads">
      <a href="redecision_event_input_template_20260614.csv">イベント入力CSV</a>
      <a href="redecision_account_input_template_20260614.csv">本人別口座入力CSV</a>
      <a href="redecision_financial_partial_input_template_20260614.csv">財務partial補完CSV</a>
    </div>
  </section>

  <section>
    <h2>作業順序</h2>
    ${table(["順番", "作業", "使う資料", "出力"], workflowRows, { 順番: "60px", 作業: "320px", 使う資料: "520px", 出力: "360px" })}
  </section>

  <section>
    <h2>イベント入力テンプレート</h2>
    <p class="notice sub">E02、E03、E04が空欄のままだと全銘柄0円です。実数と市場反応を入力してから再判定します。</p>
    ${table(["event_id", "日付", "イベント", "入力する実数", "市場反応", "判定入力", "入力候補", "合格条件", "失敗時対応", "入力メモ"], eventTemplate, {
      event_id: "70px",
      日付: "130px",
      イベント: "150px",
      入力する実数: "220px",
      市場反応: "160px",
      判定入力: "100px",
      合格条件: "360px",
      失敗時対応: "300px",
    })}
  </section>

  <section>
    <h2>本人別口座入力テンプレート</h2>
    <p class="notice sub">本人操作とNISA口座区分が確認できない口座は0円です。ここは口座ごとの実務確認に使います。</p>
    ${table(["account_id", "本人名", "証券会社", "NISA口座", "本人スマホ", "本人銀行口座", "二段階認証", "NISA残枠円", "入力候補", "注文可能判定", "メモ"], accountTemplate, {
      account_id: "80px",
      本人名: "120px",
      証券会社: "120px",
      NISA残枠円: "120px",
      注文可能判定: "220px",
    })}
  </section>

  <section>
    <h2>財務partial補完テンプレート</h2>
    <p class="notice sub">partial銘柄は、公式IRで数値確認できるまで比率を上げません。空欄のままなら、監視または保留の扱いを残します。</p>
    ${table(["ticker", "銘柄", "100社扱い", "期待信頼度", "確認元", "必須項目", "PER", "PBR", "ROE_pct", "営業利益率_pct", "今期会社予想_前期比", "受注またはセグメント寄与", "高PER説明", "参照URLまたは資料名", "資料日付", "入力状態", "再判定メモ"], financialTemplate, {
      ticker: "90px",
      銘柄: "130px",
      "100社扱い": "100px",
      確認元: "200px",
      必須項目: "360px",
      高PER説明: "220px",
      参照URLまたは資料名: "220px",
    })}
  </section>

  <section>
    <h2>検算ルール</h2>
    ${table(["対象", "OK条件", "NG条件", "反映"], validationRules, { 対象: "160px", OK条件: "460px", NG条件: "340px", 反映: "300px" })}
  </section>

  <section>
    <h2>関連画面</h2>
    <div class="links">
      <a href="purchase_unlock_input_queue_20260614.html">購入ロック解除 入力キュー</a>
      <a href="integrated_purchase_decision_engine_20260614.html">統合購入可否エンジン</a>
      <a href="june_event_input_decision_board_20260614.html">6月イベント入力・判定ボード</a>
      <a href="nisa_account_execution_gate_20260614.html">NISA口座・本人操作 実行ゲート</a>
      <a href="candidate10_financial_confirmation_gate_20260614.html">候補10社 財務確認ゲート</a>
      <a href="latest_practical_start_20260614.html">最新 実用パート入口</a>
    </div>
  </section>
  <footer>作成: ${esc(generatedAt)} / 入力テンプレートは購入推奨ではありません。再判定に必要な実データを漏れなく集めるための作業台です。</footer>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "redecision_input_workbench_20260614.html"), html, "utf8");

function insertCard(file, marker, card) {
  const full = path.join(ROOT, file);
  let text = fs.readFileSync(full, "utf8");
  if (text.includes("redecision_input_workbench_20260614.html")) return false;
  const index = text.indexOf(marker);
  if (index === -1) return false;
  text = `${text.slice(0, index + marker.length)}\n${card}\n${text.slice(index + marker.length)}`;
  fs.writeFileSync(full, text, "utf8");
  return true;
}

insertCard(
  "purchase_unlock_input_queue_20260614.html",
  `<a href="integrated_purchase_decision_engine_20260614.html">統合購入可否エンジン</a>`,
  `
      <a href="redecision_input_workbench_20260614.html">6/18再判定 入力作業台</a>`,
);

insertCard(
  "integrated_purchase_decision_engine_20260614.html",
  `<a href="remaining_gap_hardening_board_20260614.html">未完了改善・購入ロック一覧</a>`,
  `
      <a href="redecision_input_workbench_20260614.html">6/18再判定 入力作業台</a>`,
);

console.log("generated redecision_input_workbench_20260614.html");
