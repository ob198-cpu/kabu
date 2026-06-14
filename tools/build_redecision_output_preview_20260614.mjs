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
  const text = String(value ?? "");
  if (/不可|停止|0円|NG|赤|未入力|未確認|除外|反映しない|確認済み口座なし|0口座|全銘柄0円/.test(text)) return "bad";
  if (/条件付き|注意|黄|保留|partial|監視|要確認|抑制/.test(text)) return "warn";
  if (/OK|可能|確認済み|緑|pass|反映候補/.test(text)) return "ok";
  return "";
}

function table(headers, rows, widths = {}) {
  return `<div class="table-wrap"><table><thead><tr>${headers
    .map((h) => `<th${widths[h] ? ` style="width:${widths[h]}"` : ""}>${esc(h)}</th>`)
    .join("")}</tr></thead><tbody>${rows
    .map(
      (row) =>
        `<tr>${headers.map((h) => `<td class="${cls(row[h])}">${esc(row[h])}</td>`).join("")}</tr>`,
    )
    .join("")}</tbody></table></div>`;
}

function numberFromYen(value) {
  const n = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function yen(value) {
  return `${Math.round(Number(value) || 0).toLocaleString("ja-JP")}円`;
}

function hasValue(value) {
  const text = String(value ?? "").trim();
  return text !== "" && !/未入力|未確認/.test(text);
}

function isGreen(value) {
  return /緑|OK|確認済み|通過/.test(String(value ?? ""));
}

function isWarning(value) {
  return /黄|注意|条件付き/.test(String(value ?? ""));
}

function isRed(value) {
  return /赤|停止|NG|不可/.test(String(value ?? ""));
}

const baseRows = parseCsv(readText("integrated_purchase_decision_engine_20260614.csv"));
const allocations = parseCsv(readText("108_capital_allocation_by_ticker.csv"));
const events = parseCsv(readText("redecision_event_input_template_20260614.csv"));
const accounts = parseCsv(readText("redecision_account_input_template_20260614.csv"));
const financialInputs = parseCsv(readText("redecision_financial_partial_input_template_20260614.csv"));
const readinessSummary = parseCsv(readText("redecision_readiness_summary_20260614.csv"));

const allocationByTicker = new Map(allocations.map((row) => [row.ticker, row]));
const financialInputByTicker = new Map(financialInputs.map((row) => [row.ticker, row]));

function eventState() {
  const missing = [];
  const warnings = [];
  const reds = [];
  for (const row of events) {
    const name = `${row.event_id} ${row.イベント}`;
    if (!hasValue(row.入力する実数) || !hasValue(row.市場反応) || !hasValue(row.判定入力)) {
      missing.push(name);
    } else if (isRed(row.判定入力) || isRed(row.市場反応)) {
      reds.push(name);
    } else if (isWarning(row.判定入力) || isWarning(row.市場反応)) {
      warnings.push(name);
    } else if (!isGreen(row.判定入力) && !isGreen(row.市場反応)) {
      warnings.push(name);
    }
  }
  if (missing.length) return { mode: "未入力", label: "イベント未入力", cap: "0円", items: missing };
  if (reds.length) return { mode: "赤", label: "イベント停止", cap: "0円", items: reds };
  if (warnings.length) return { mode: "注意", label: "注意・条件付き", cap: "注意時上限", items: warnings };
  return { mode: "緑", label: "イベント確認済み", cap: "全確認後上限", items: [] };
}

function accountState() {
  const ready = [];
  const missing = [];
  for (const row of accounts) {
    const required = ["本人名", "証券会社", "NISA口座", "本人スマホ", "本人銀行口座", "二段階認証"];
    const lack = required.filter((key) => !hasValue(row[key]));
    const limit = numberFromYen(row.NISA残枠円);
    if (!lack.length && limit > 0) {
      ready.push({ ...row, limit });
    } else {
      missing.push(`${row.account_id}: ${lack.concat(limit > 0 ? [] : ["NISA残枠円"]).join(" / ")}`);
    }
  }
  return { ready, missing };
}

function financialState(base) {
  if (base.財務状態 === "pass") return { ok: true, label: "公式財務pass", reason: "既存ゲートで確認済み" };
  const row = financialInputByTicker.get(base.ticker);
  if (!row) return { ok: false, label: "財務未確認", reason: "入力テンプレートに該当なし" };
  const required = ["PER", "PBR", "ROE_pct", "営業利益率_pct", "今期会社予想_前期比", "参照URLまたは資料名", "資料日付", "入力状態"];
  const items = String(row.必須項目 ?? "");
  if (/受注|セグメント/.test(items)) required.push("受注またはセグメント寄与");
  if (/高PER|高PBR/.test(items)) required.push("高PER説明");
  const lack = required.filter((key) => !hasValue(row[key]));
  const okState = /確認済み|入力済み|pass/.test(String(row.入力状態 ?? ""));
  if (!lack.length && okState) return { ok: true, label: "公式財務補完済み", reason: "テンプレート入力済み" };
  return { ok: false, label: "財務未確認", reason: lack.length ? lack.join(" / ") : "入力状態が確認済みではない" };
}

function universeState(base) {
  if (base["100社扱い"] === "除外") return { ok: false, label: "除外継続", reason: "100社再選定で除外。解除根拠の入力が必要" };
  if (base["100社扱い"] === "監視") return { ok: false, label: "監視継続", reason: "監視扱い。初回買付では0円または小口再審査" };
  return { ok: true, label: "再選定候補", reason: "100社扱いは候補" };
}

const ev = eventState();
const ac = accountState();
const anyAccountReady = ac.ready.length > 0;

const outputRows = baseRows.map((base) => {
  const alloc = allocationByTicker.get(base.ticker) ?? {};
  const fin = financialState(base);
  const uni = universeState(base);
  const reasons = [];
  let finalDecision = "購入不可";
  let orderAmount = 0;
  let orderReflection = "反映しない";

  if (ev.mode === "未入力") reasons.push("6月イベント未入力");
  if (ev.mode === "赤") reasons.push("6月イベント赤判定");
  if (!anyAccountReady) reasons.push("本人別NISA口座未確認");
  if (!fin.ok) reasons.push(fin.reason);
  if (!uni.ok) reasons.push(uni.reason);
  if (base.期待信頼度 === "C") reasons.push("期待仮説信頼度Cのため抑制");
  if (Number(base.決算後反応) < 35) reasons.push("決算後反応が弱い");

  if (reasons.length === 0) {
    finalDecision = ev.mode === "注意" ? "条件付き反映候補" : "反映候補";
    orderAmount =
      ev.mode === "注意"
        ? numberFromYen(alloc.attention_allocation_yen)
        : numberFromYen(alloc.all_pass_allocation_yen);
    orderReflection = orderAmount > 0 ? "注文票反映候補" : "反映しない";
  }

  return {
    ticker: base.ticker,
    銘柄: base.銘柄,
    役割: base.役割,
    イベント判定: ev.label,
    口座確認: anyAccountReady ? `${ac.ready.length}口座確認済み` : "0口座",
    財務判定: fin.label,
    "100社扱い": uni.label,
    再判定結果: finalDecision,
    出力金額: yen(orderAmount),
    注文票反映: orderReflection,
    止める理由: reasons.length ? reasons.join(" / ") : "入力ゲート上は反映候補。ただし証券会社画面で最終確認",
  };
});

const summaryRows = [
  {
    項目: "総合結果",
    内容: outputRows.some((row) => row.再判定結果.includes("反映候補")) ? "反映候補あり" : "全銘柄0円",
    数値: `${outputRows.filter((row) => row.再判定結果.includes("反映候補")).length}銘柄 / ${outputRows.length}銘柄`,
    次の扱い: outputRows.some((row) => row.再判定結果.includes("反映候補"))
      ? "注文票へ移す前に本人別残枠と証券会社画面で最終確認"
      : "注文票へ金額を出さない",
  },
  {
    項目: "イベント入力",
    内容: ev.label,
    数値: ev.items.length ? `${ev.items.length}件要対応` : "不足なし",
    次の扱い: ev.mode === "緑" || ev.mode === "注意" ? "口座・財務へ進む" : "イベント入力を完了するまで全銘柄0円",
  },
  {
    項目: "本人別口座",
    内容: anyAccountReady ? "確認済み口座あり" : "確認済み口座なし",
    数値: `${ac.ready.length} / ${accounts.length}口座`,
    次の扱い: anyAccountReady ? "口座別残枠内でのみ検討" : "本人スマホ・本人銀行・二段階認証・NISA残枠を入力",
  },
  {
    項目: "公式財務partial",
    内容: `${outputRows.filter((row) => row.財務判定.includes("未確認")).length}銘柄が未確認`,
    数値: "partialは比率引上げ不可",
    次の扱い: "公式IR・決算短信の入力後に再生成",
  },
];

writeCsv("redecision_output_preview_summary_20260614.csv", summaryRows);
writeCsv("redecision_output_preview_by_ticker_20260614.csv", outputRows);

const css = `
  :root{--ink:#071927;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--red:#b42318;--warn:#9a5b00;--green:#116b4f}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.7}
  header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:30px}
  header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);letter-spacing:0;line-height:1.2}
  header p{margin:0;font-weight:800;max-width:1180px}
  main{max-width:1480px;margin:0 auto;padding:22px}
  section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08)}
  h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:25px}
  .notice{border-left:8px solid var(--red);background:#fff1f1;border-radius:10px;padding:14px 16px;font-weight:900;margin:0 0 14px}
  .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
  .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
  .card b{display:block;color:var(--navy);font-size:15px}
  .card strong{display:block;font-size:26px;line-height:1.25;color:var(--blue)}
  .card span{font-weight:800;color:#263e55}
  .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px}
  table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
  th,td{border:1px solid var(--line);padding:10px 12px;vertical-align:top;overflow-wrap:anywhere;word-break:normal}
  th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
  td.ok{color:var(--green);font-weight:900}
  td.warn{color:var(--warn);font-weight:900}
  td.bad{color:var(--red);font-weight:900}
  .links{display:flex;flex-wrap:wrap;gap:10px}
  .links a{display:inline-block;text-decoration:none;background:#0b67a3;color:#fff;border-radius:9px;padding:10px 13px;font-weight:900}
  footer{font-size:13px;color:#526b82;margin:20px 0}
  @media(max-width:900px){main{padding:12px}.cards{grid-template-columns:1fr}body{font-size:16px}}
  @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:11px;padding:6px 7px}}
`;

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>再判定出力プレビュー</title>
  <style>${css}</style>
</head>
<body>
<header>
  <h1>再判定出力プレビュー</h1>
  <p>イベント・本人別NISA口座・公式財務入力をもとに、注文票へ金額を出せるかを仮計算します。未入力がある場合は0円を維持します。</p>
</header>
<main>
  <section>
    <h2>現在の結論</h2>
    <p class="notice">この画面は購入指示ではありません。入力ゲートを満たさない限り、注文票への金額反映は行いません。</p>
    <div class="cards">
      <div class="card"><b>総合</b><strong>${esc(summaryRows[0].内容)}</strong><span>${esc(summaryRows[0].数値)}</span></div>
      <div class="card"><b>イベント</b><strong>${esc(ev.label)}</strong><span>${esc(ev.items.length ? ev.items.join(" / ") : "不足なし")}</span></div>
      <div class="card"><b>口座</b><strong>${esc(`${ac.ready.length}/${accounts.length}`)}</strong><span>本人別NISA口座</span></div>
      <div class="card"><b>出力</b><strong>${esc(outputRows.some((row) => row.再判定結果.includes("反映候補")) ? "候補あり" : "0円")}</strong><span>注文票反映</span></div>
    </div>
  </section>

  <section>
    <h2>再判定サマリー</h2>
    ${table(["項目", "内容", "数値", "次の扱い"], summaryRows, { "次の扱い": "640px" })}
  </section>

  <section>
    <h2>銘柄別 出力プレビュー</h2>
    ${table(
      ["ticker", "銘柄", "役割", "イベント判定", "口座確認", "財務判定", "100社扱い", "再判定結果", "出力金額", "注文票反映", "止める理由"],
      outputRows,
      { "止める理由": "520px", "出力金額": "120px", "再判定結果": "150px" },
    )}
  </section>

  <section>
    <h2>関連画面</h2>
    <div class="links">
      <a href="redecision_readiness_validator_20260614.html">再判定準備バリデーター</a>
      <a href="redecision_input_workbench_20260614.html">6/18再判定 入力作業台</a>
      <a href="integrated_purchase_decision_engine_20260614.html">統合購入可否エンジン</a>
      <a href="purchase_unlock_input_queue_20260614.html">購入ロック解除 入力キュー</a>
      <a href="latest_practical_start_20260614.html">最新 実用パート入口</a>
    </div>
  </section>

  <footer>作成: ${esc(generatedAt)} / 入力未完了時は0円を維持する安全側の出力です。</footer>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "redecision_output_preview_20260614.html"), html, "utf8");

function insertLink(file, anchor, linkHtml) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return;
  const text = fs.readFileSync(full, "utf8");
  if (text.includes("redecision_output_preview_20260614.html")) return;
  const next = text.replace(anchor, `${anchor}\n      ${linkHtml}`);
  fs.writeFileSync(full, next, "utf8");
}

insertLink(
  "redecision_readiness_validator_20260614.html",
  '<a href="integrated_purchase_decision_engine_20260614.html">統合購入可否エンジン</a>',
  '<a href="redecision_output_preview_20260614.html">再判定出力プレビュー</a>',
);

insertLink(
  "redecision_input_workbench_20260614.html",
  '<a href="integrated_purchase_decision_engine_20260614.html">統合購入可否エンジン</a>',
  '<a href="redecision_output_preview_20260614.html">再判定出力プレビュー</a>',
);

insertLink(
  "latest_practical_start_20260614.html",
  '<em>入力後確認</em>\n      </a>',
  '<a class="step" href="redecision_output_preview_20260614.html">\n        <b>6-3. 再判定出力プレビュー</b>\n        <span>入力内容をもとに、注文票へ金額を出せるかを仮計算する。</span>\n        <em>出力確認</em>\n      </a>',
);

insertLink(
  "index.html",
  '<a class="card" href="redecision_readiness_validator_20260614.html">',
  '<a class="card" href="redecision_output_preview_20260614.html">\n          <b>再判定出力プレビュー</b>\n          <span>入力後に、銘柄別の出力金額と注文票反映可否を0円維持ルール込みで確認する。</span>\n        </a>\n\n        <a class="card" href="redecision_readiness_validator_20260614.html">',
);

console.log("generated redecision_output_preview_20260614.html");
