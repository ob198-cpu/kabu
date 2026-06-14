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
  if (/参考/.test(text)) return "warn";
  if (/購入不可|(^|[^0-9])0円|未入力|未確認|未完了|除外|禁止|反映しない/.test(text) || text === "C" || text.startsWith("C:")) return "bad";
  if (/B|partial|監視|条件付き|注意|参考|抑制|入力後/.test(text)) return "warn";
  if (/A|pass|優先|OK|確認済み|再選定候補/.test(text)) return "ok";
  return "";
}

function table(headers, rows, widths = {}) {
  return `<div class="table-wrap"><table><thead><tr>${headers
    .map((h) => `<th${widths[h] ? ` style="width:${widths[h]}"` : ""}>${esc(h)}</th>`)
    .join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${headers.map((h) => `<td class="${cls(row[h])}">${esc(row[h])}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

const integrated = parseCsv(readText("integrated_purchase_decision_engine_20260614.csv"));
const preview = parseCsv(readText("redecision_output_preview_by_ticker_20260614.csv"));
const risks = parseCsv(readText("ticker_trade_rule_matrix_v2_20260614.csv"));
const financialInputs = parseCsv(readText("redecision_financial_partial_input_template_20260614.csv"));
const previewByTicker = new Map(preview.map((row) => [row.ticker, row]));
const riskByTicker = new Map(risks.map((row) => [row.ticker, row]));
const financialByTicker = new Map(financialInputs.map((row) => [row.ticker, row]));

function priority(row) {
  if (row.財務状態 === "pass" && row["100社扱い"] === "再選定候補" && row.期待信頼度 !== "C" && Number(row.決算後反応) >= 35) return "A: 最短確認候補";
  if (row.財務状態 === "pass") return "B: 抑制付き確認";
  if (row.財務状態 === "partial" && row["100社扱い"] === "再選定候補" && row.期待信頼度 !== "C") return "B: 財務補完後に確認";
  if (row["100社扱い"] === "監視") return "C: 監視継続";
  if (row["100社扱い"] === "除外") return "C: 除外継続";
  return "C: 要再確認";
}

function financialMissing(row) {
  if (row.財務状態 === "pass") return "なし";
  const fin = financialByTicker.get(row.ticker);
  if (!fin) return "公式財務入力欄なし";
  const required = ["PER", "PBR", "ROE_pct", "営業利益率_pct", "今期会社予想_前期比", "参照URLまたは資料名", "資料日付", "入力状態"];
  const items = String(fin.必須項目 ?? "");
  if (/受注|セグメント/.test(items)) required.push("受注またはセグメント寄与");
  if (/高PER|高PBR/.test(items)) required.push("高PER説明");
  const lack = required.filter((key) => !String(fin[key] ?? "").trim() || /未確認|未入力/.test(String(fin[key] ?? "")));
  return lack.length ? lack.join(" / ") : "入力状態の確認";
}

function unlockAction(row) {
  const actions = ["6月イベント結果を入力", "本人別NISA口座・本人操作・残枠を入力"];
  if (row.財務状態 !== "pass") actions.push("公式財務partialを補完");
  if (row["100社扱い"] === "監視" || row["100社扱い"] === "除外") actions.push("監視・除外理由の解除根拠を入力");
  if (row.期待信頼度 === "C") actions.push("期待仮説Cの理由を解消、または比率抑制");
  if (Number(row.決算後反応) < 35) actions.push("決算後反応が弱い理由を確認");
  return actions.join(" / ");
}

const rows = integrated.map((row) => {
  const p = previewByTicker.get(row.ticker) ?? {};
  const r = riskByTicker.get(row.ticker) ?? {};
  return {
    ticker: row.ticker,
    銘柄: row.銘柄,
    優先度: priority(row),
    現在判定: row.現判定,
    現在上限: row.現上限,
    解除後参考上限: `${row.緑時参考上限}（参考）`,
    財務状態: row.財務状態,
    財務不足: financialMissing(row),
    "100社扱い": row["100社扱い"],
    期待信頼度: row.期待信頼度,
    決算後反応: row.決算後反応,
    最大下落: row.最大下落,
    初回比率上限: r.初回比率上限 ?? "",
    解除に必要な作業: unlockAction(row),
    注文票反映: p.注文票反映 || row.注文票反映,
    現在止める理由: p.止める理由 || row.ブロック理由,
  };
});

const summaryRows = [
  {
    項目: "最短確認候補",
    件数: `${rows.filter((row) => row.優先度.startsWith("A")).length}銘柄`,
    内容: "公式財務passで、イベント・口座入力後に最初に再確認する候補",
    扱い: "現時点は0円。条件成立後も証券会社画面で最終確認",
  },
  {
    項目: "財務補完後に確認",
    件数: `${rows.filter((row) => row.優先度.includes("財務補完")).length}銘柄`,
    内容: "PER/PBR/ROE・利益率・受注などの公式資料入力が必要",
    扱い: "入力前は比率引上げ禁止",
  },
  {
    項目: "抑制付き確認",
    件数: `${rows.filter((row) => row.優先度.includes("抑制付き")).length}銘柄`,
    内容: "財務はpassだが、期待信頼度Cや決算後反応の弱さが残る",
    扱い: "イベント・口座入力後も比率抑制または理由確認",
  },
  {
    項目: "監視・除外継続",
    件数: `${rows.filter((row) => row.優先度.startsWith("C")).length}銘柄`,
    内容: "監視・除外理由、期待仮説C、決算後反応弱い等が残る",
    扱い: "解除根拠がない限り初回買付へ入れない",
  },
];

writeCsv("ticker_unlock_checklist_summary_20260614.csv", summaryRows);
writeCsv("ticker_unlock_checklist_20260614.csv", rows);

const css = `
  :root{--ink:#071927;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--red:#b42318;--warn:#9a5b00;--green:#116b4f}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.7}
  header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:30px}
  header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);letter-spacing:0;line-height:1.2}
  header p{margin:0;font-weight:800;max-width:1200px}
  main{max-width:1520px;margin:0 auto;padding:22px}
  section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08)}
  h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:25px}
  .notice{border-left:8px solid var(--red);background:#fff1f1;border-radius:10px;padding:14px 16px;font-weight:900;margin:0 0 14px}
  .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
  .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
  .card b{display:block;color:var(--navy);font-size:15px}
  .card strong{display:block;font-size:26px;line-height:1.25;color:var(--blue)}
  .card span{font-weight:800;color:#263e55}
  .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin-top:10px}
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
  @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:10.5px;padding:6px 7px}}
`;

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>銘柄別ロック解除チェックリスト</title>
  <style>${css}</style>
</head>
<body>
<header>
  <h1>銘柄別ロック解除チェックリスト</h1>
  <p>候補10社について、現在0円で止めている理由と、再判定に必要な入力を銘柄別に整理します。</p>
</header>
<main>
  <section>
    <h2>現在の結論</h2>
    <p class="notice">現時点では全銘柄が購入不可・0円です。この画面は、何を埋めれば候補へ戻せるかを管理するためのチェックリストです。</p>
    <div class="cards">
      <div class="card"><b>最短確認候補</b><strong>${rows.filter((row) => row.優先度.startsWith("A")).length}</strong><span>財務pass中心</span></div>
      <div class="card"><b>財務補完後</b><strong>${rows.filter((row) => row.優先度.includes("財務補完")).length}</strong><span>partial補完が必要</span></div>
      <div class="card"><b>抑制付き確認</b><strong>${rows.filter((row) => row.優先度.includes("抑制付き")).length}</strong><span>比率抑制・理由確認</span></div>
      <div class="card"><b>監視・除外</b><strong>${rows.filter((row) => row.優先度.startsWith("C")).length}</strong><span>根拠解除まで初回買付不可</span></div>
    </div>
  </section>

  <section>
    <h2>優先度サマリー</h2>
    ${table(["項目", "件数", "内容", "扱い"], summaryRows, { "内容": "470px", "扱い": "430px" })}
  </section>

  <section>
    <h2>銘柄別チェックリスト</h2>
    ${table(
      ["ticker", "銘柄", "優先度", "現在判定", "現在上限", "解除後参考上限", "財務状態", "財務不足", "100社扱い", "期待信頼度", "決算後反応", "最大下落", "初回比率上限", "解除に必要な作業", "注文票反映", "現在止める理由"],
      rows,
      { "財務不足": "390px", "解除に必要な作業": "460px", "現在止める理由": "520px" },
    )}
  </section>

  <section>
    <h2>関連画面</h2>
    <div class="links">
      <a href="daily_practical_compact_board_20260614.html">実用日次ボード</a>
      <a href="redecision_input_workbench_20260614.html">入力作業台</a>
      <a href="redecision_readiness_validator_20260614.html">再判定準備バリデーター</a>
      <a href="redecision_output_preview_20260614.html">再判定出力プレビュー</a>
      <a href="ticker_trade_rule_matrix_v2_20260614.html">銘柄別リスク・売買ルールv2</a>
      <a href="latest_practical_start_20260614.html">最新 実用パート入口</a>
    </div>
  </section>
  <footer>作成: ${esc(generatedAt)} / 本画面は購入指示ではなく、再判定に必要な入力を管理する画面です。</footer>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "ticker_unlock_checklist_20260614.html"), html, "utf8");

function insertLink(file, anchor, linkHtml) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return;
  const text = fs.readFileSync(full, "utf8");
  if (text.includes("ticker_unlock_checklist_20260614.html")) return;
  fs.writeFileSync(full, text.replace(anchor, `${anchor}\n      ${linkHtml}`), "utf8");
}

insertLink(
  "daily_practical_compact_board_20260614.html",
  '<a href="gap_resolution_board_20260614.html">未完成点 改善ボード</a>',
  '<a href="ticker_unlock_checklist_20260614.html">銘柄別ロック解除チェックリスト</a>',
);

insertLink(
  "latest_practical_start_20260614.html",
  '<em>改善状況</em>\n      </a>',
  '<a class="step" href="ticker_unlock_checklist_20260614.html">\n        <b>6-7. 銘柄別ロック解除チェックリスト</b>\n        <span>10社それぞれの停止理由と、候補へ戻すための入力を確認する。</span>\n        <em>銘柄別</em>\n      </a>',
);

insertLink(
  "index.html",
  '<a class="card" href="gap_resolution_board_20260614.html">',
  '<a class="card" href="ticker_unlock_checklist_20260614.html">\n          <b>銘柄別ロック解除チェックリスト</b>\n          <span>10社それぞれの停止理由、解除条件、財務不足、参考上限を確認する。</span>\n        </a>\n\n        <a class="card" href="gap_resolution_board_20260614.html">',
);

console.log("generated ticker_unlock_checklist_20260614.html");
