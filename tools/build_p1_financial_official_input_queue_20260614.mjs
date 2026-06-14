import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/14 23:05";

function p(file) {
  return path.join(ROOT, file);
}

function readText(file) {
  return fs.existsSync(p(file)) ? fs.readFileSync(p(file), "utf8").replace(/^\uFEFF/, "") : "";
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
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell.replace(/\r$/, ""));
  if (row.some((value) => value !== "")) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map((value) => value.trim());
  return rows.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header, line[index] ?? ""])));
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, rows) {
  if (!rows.length) {
    fs.writeFileSync(p(file), "", "utf8");
    return;
  }
  const headers = Object.keys(rows[0]);
  fs.writeFileSync(p(file), `\uFEFF${[headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n")}\n`, "utf8");
}

function h(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusClass(value) {
  const text = String(value ?? "");
  if (/(未入力|未確認|反映しない|禁止|不可|0円|使わない|除外)/.test(text)) return "bad";
  if (/(P1|確認|補完|参考|監視|条件付き|計算|注意)/.test(text)) return "warn";
  if (/(入力済み|完了|通過|使用可|候補復帰)/.test(text)) return "ok";
  return "";
}

function table(rows, columns) {
  return `<div class="table-wrap"><table><thead><tr>${columns.map((column) => `<th>${h(column.label)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${columns.map((column) => `<td class="${statusClass(row[column.key])}">${h(row[column.key])}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

const fieldRules = {
  PER: {
    入力する値: "株価 ÷ 会社予想EPS、または証券会社・JPX・Yahoo等のPER値。算定日を必ず残す。",
    許容出所: "会社予想EPSは決算短信・説明資料。PER値を外部サイトから入れる場合は参考値として出所を明記。",
    入力条件: "対象年度、株価基準日、EPSの種類をそろえる。取得元が違うPERを混在させない。",
    未入力時の扱い: "割高・割安判断に使わない。比率引上げ禁止。",
  },
  PBR: {
    入力する値: "株価 ÷ 1株純資産、または証券会社・JPX・Yahoo等のPBR値。算定日を必ず残す。",
    許容出所: "BPSは決算短信・有価証券報告書。外部サイト値を使う場合は参考値として出所を明記。",
    入力条件: "株価基準日とBPS対象期をそろえる。",
    未入力時の扱い: "資産価値・過熱判断に使わない。比率引上げ禁止。",
  },
  ROE_pct: {
    入力する値: "ROE%。会社資料の値、または親会社株主帰属利益 ÷ 自己資本で計算。",
    許容出所: "決算短信、決算説明資料、有価証券報告書、統合報告書。",
    入力条件: "計算した場合は分子・分母・対象期をメモに残す。",
    未入力時の扱い: "収益性スコアに使わない。候補復帰は保留。",
  },
  "営業利益率_pct": {
    入力する値: "営業利益 ÷ 売上高。IFRS企業は事業利益・営業利益の定義を資料に合わせる。",
    許容出所: "決算短信、決算説明資料、補足資料。",
    入力条件: "売上高と利益の単位・対象期間を一致させる。",
    未入力時の扱い: "利益率改善の根拠に使わない。候補復帰は保留。",
  },
  "今期会社予想_前期比": {
    入力する値: "会社予想の売上・利益・EPSの前期比。上方/据置/下方の分類も残す。",
    許容出所: "決算短信の業績予想、決算説明資料、会社発表。",
    入力条件: "通期予想か四半期予想かを明記する。",
    未入力時の扱い: "1年保有の先行き根拠に使わない。候補復帰は保留。",
  },
  "受注またはセグメント寄与": {
    入力する値: "受注高、受注残、セグメント売上/利益、AI・電力・半導体等の寄与説明。",
    許容出所: "決算説明資料、補足資料、統合報告書、会社IR。",
    入力条件: "テーマと業績の接続が読める記述または数値を入れる。",
    未入力時の扱い: "質的テーマを買付理由にしない。監視または補助説明に限定。",
  },
  "高PER説明": {
    入力する値: "高PER・高PBRを説明できる利益成長、受注、粗利率、会社予想、構造優位の根拠。",
    許容出所: "会社IR、決算説明資料、受注・利益率・会社予想。ニュースだけでは不可。",
    入力条件: "高PERでも買える理由ではなく、高PERを許容できるかの検証として書く。",
    未入力時の扱い: "高PER銘柄は追い買い禁止。初回買付または比率引上げは保留。",
  },
  "参照URLまたは資料名": {
    入力する値: "参照した公式資料名またはURL。",
    許容出所: "会社IR、TDnet、EDINET、JPX、証券会社画面、Yahoo等の参考サイト。",
    入力条件: "公式資料か参考値かを分ける。",
    未入力時の扱い: "検算不能のため買付判断に使わない。",
  },
  "資料日付": {
    入力する値: "資料公表日または確認日。",
    許容出所: "資料表紙、TDnet公表日、IR掲載日。",
    入力条件: "古い資料と最新資料を混ぜないため必須。",
    未入力時の扱い: "いつの数字か不明なので買付判断に使わない。",
  },
  "入力状態": {
    入力する値: "未確認、参考値入力、公式確認済み、要再確認のいずれか。",
    許容出所: "作業者入力。",
    入力条件: "公式確認済み以外は買付解除に使わない。",
    未入力時の扱い: "未確認として扱い、注文票に反映しない。",
  },
};

function normalizeField(field) {
  const f = String(field ?? "").trim();
  if (f === "ROE") return "ROE_pct";
  if (f === "営業利益率") return "営業利益率_pct";
  if (f === "今期会社予想" || f === "前期比増減") return "今期会社予想_前期比";
  return f;
}

function actionForPriority(priority) {
  if (priority.startsWith("P1")) return "公式確認済みになれば候補復帰を再判定。未確認の間は比率引上げ禁止。";
  return "初回買付より後順位。公式確認済みになっても、価格・反応・テーマ根拠を再確認するまで注文票へ入れない。";
}

const p1Rows = parseCsv(readText("p1_financial_completion_engine_20260614.csv"));
const queueRows = [];

for (const row of p1Rows) {
  const fields = String(row["不足項目"] ?? "")
    .split("/")
    .map((field) => normalizeField(field))
    .filter(Boolean);
  for (const field of fields) {
    const rule = fieldRules[field] ?? {
      入力する値: `${field}の公式または算定根拠付きの値`,
      許容出所: row["確認元"] || "公式IR・決算資料",
      入力条件: "資料名、日付、算定方法を残す。",
      未入力時の扱い: "未確認として買付判断に使わない。",
    };
    queueRows.push({
      優先区分: row["優先区分"],
      ticker: row.ticker,
      銘柄: row["銘柄"],
      現在扱い: row["現在扱い"],
      入力項目: field,
      入力する値: rule.入力する値,
      公式確認元: row["確認元"],
      許容出所: rule.許容出所,
      入力条件: rule.入力条件,
      未入力時の扱い: rule.未入力時の扱い,
      完了後の反映: actionForPriority(row["優先区分"] || ""),
      状態: "未入力",
    });
  }
}

const p1Count = queueRows.filter((row) => row.優先区分.startsWith("P1")).length;
const p2Count = queueRows.filter((row) => row.優先区分.startsWith("P2")).length;
const summaryRows = [
  { 項目: "入力項目合計", 件数: `${queueRows.length}項目`, 扱い: "未入力", 意味: "7銘柄の財務partialを、入力項目単位に分解した件数。" },
  { 項目: "P1候補復帰確認", 件数: `${p1Count}項目`, 扱い: "候補復帰の前提", 意味: "6503・6762など、公式確認済みになれば候補復帰を再判定できる層。" },
  { 項目: "P2監視・除外補完", 件数: `${p2Count}項目`, 扱い: "監視・除外継続", 意味: "公式確認済みになっても、価格・反応・テーマ根拠を再確認するまで注文票へ入れない層。" },
  { 項目: "注文票反映", 件数: "0件", 扱い: "反映しない", 意味: "公式確認済みになるまで買付金額へ反映しない。" },
];

writeCsv("p1_financial_official_input_queue_20260614.csv", queueRows);
writeCsv("p1_financial_official_input_queue_summary_20260614.csv", summaryRows);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>P1 財務公式入力キュー</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--warn:#a85b00;--red:#a01818;--green:#116b4f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.75}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:white;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);line-height:1.2;letter-spacing:0}
    header p{margin:0;font-weight:800;max-width:1180px}
    main{max-width:1660px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:25px}
    .notice{border-left:8px solid var(--red);background:#fff1f1;border-radius:10px;padding:14px 16px;font-weight:900;margin:0 0 14px}
    .sub{border-left-color:var(--warn);background:#fff7e7}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:15px}
    .card strong{display:block;font-size:28px;line-height:1.25;color:var(--blue)}
    .card span{display:block;color:#263e55;font-weight:800}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin-top:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:10px 12px;vertical-align:top;overflow-wrap:anywhere;word-break:normal}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    td.ok{color:var(--green);font-weight:900}
    td.warn{color:var(--warn);font-weight:900}
    td.bad{color:var(--red);font-weight:900}
    .links{display:flex;flex-wrap:wrap;gap:10px}
    .links a{display:inline-block;text-decoration:none;border:1px solid #7bb6dd;border-radius:999px;padding:8px 13px;background:#f7fbff;color:#06395f;font-weight:900}
    footer{font-size:13px;color:#526b82;margin:20px 0}
    @media(max-width:900px){main{padding:12px}.cards{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:#fff}header,section{box-shadow:none;break-inside:avoid}.table-wrap{overflow:visible}th,td{font-size:11px;padding:6px 7px}}
  </style>
</head>
<body>
<header>
  <h1>P1 財務公式入力キュー</h1>
  <p>7銘柄の財務partialを、PER/PBR/ROE、営業利益率、会社予想、受注、参照資料などの入力項目単位に分解した画面です。未入力の間は注文票へ反映しません。</p>
</header>
<main>
  <section>
    <h2>現在の扱い</h2>
    <p class="notice">この画面は買付解除ではありません。公式確認済みの数値が入るまで、未確認値を点数にも注文票にも混ぜません。現時点の買付上限は0円です。</p>
    <div class="cards">
      <div class="card"><b>入力項目合計</b><strong>${queueRows.length}</strong><span>公式確認待ち</span></div>
      <div class="card"><b>P1項目</b><strong>${p1Count}</strong><span>候補復帰の前提</span></div>
      <div class="card"><b>P2項目</b><strong>${p2Count}</strong><span>監視・除外補完</span></div>
      <div class="card"><b>注文票反映</b><strong>0件</strong><span>未入力のため反映しない</span></div>
    </div>
  </section>

  <section>
    <h2>入力ルール</h2>
    <p class="notice sub">PER/PBRは会社IRに直接載らない場合があります。その場合は、公式EPS/BPSと株価基準日から計算するか、証券会社・JPX・Yahoo等の参考値として出所を明記します。公式値と参考値は混ぜて「確認済み」にしません。</p>
    ${table(summaryRows, [
      { key: "項目", label: "項目" },
      { key: "件数", label: "件数" },
      { key: "扱い", label: "扱い" },
      { key: "意味", label: "意味" },
    ])}
  </section>

  <section>
    <h2>公式入力キュー</h2>
    ${table(queueRows, [
      { key: "優先区分", label: "優先区分" },
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "現在扱い", label: "現在扱い" },
      { key: "入力項目", label: "入力項目" },
      { key: "入力する値", label: "入力する値" },
      { key: "公式確認元", label: "公式確認元" },
      { key: "許容出所", label: "許容出所" },
      { key: "入力条件", label: "入力条件" },
      { key: "未入力時の扱い", label: "未入力時の扱い" },
      { key: "完了後の反映", label: "完了後の反映" },
      { key: "状態", label: "状態" },
    ])}
  </section>

  <section>
    <h2>関連</h2>
    <div class="links">
      <a href="p1_financial_official_input_queue_20260614.csv">入力キューCSV</a>
      <a href="p1_financial_completion_engine_20260614.html">P1財務補完 判定エンジン</a>
      <a href="gap_improvement_closure_board_20260614.html">未完成点 改善v2</a>
      <a href="redecision_financial_partial_input_template_20260614.csv">財務partial入力テンプレート</a>
      <a href="daily_practical_compact_board_20260614.html">実用日次ボード</a>
    </div>
  </section>
  <footer>作成: ${h(generatedAt)} / 本画面は買付指示ではなく、公式財務入力の作業順序と未確認値の遮断条件を確認するための画面です。</footer>
</main>
</body>
</html>`;

fs.writeFileSync(p("p1_financial_official_input_queue_20260614.html"), html, "utf8");

function insertAfterHref(file, href, insertHtml) {
  const target = p(file);
  if (!fs.existsSync(target)) return;
  let text = fs.readFileSync(target, "utf8");
  if (text.includes("p1_financial_official_input_queue_20260614.html")) return;
  const pos = text.indexOf(`href="${href}"`);
  if (pos < 0) return;
  const end = text.indexOf("</a>", pos);
  if (end < 0) return;
  text = `${text.slice(0, end + 4)}\n${insertHtml}\n${text.slice(end + 4)}`;
  fs.writeFileSync(target, text, "utf8");
}

insertAfterHref(
  "index.html",
  "p1_financial_completion_engine_20260614.html",
  `<a class="card" href="p1_financial_official_input_queue_20260614.html">
          <b>P1 財務公式入力キュー</b>
          <span>PER/PBR/ROE、営業利益率、会社予想、受注などを項目単位で入力する。</span>
        </a>`,
);

insertAfterHref(
  "latest_practical_start_20260614.html",
  "p1_financial_completion_engine_20260614.html",
  `<a class="step" href="p1_financial_official_input_queue_20260614.html">
        <b>6-12b. P1 財務公式入力キュー</b>
        <span>7銘柄partialを、公式資料で確認する入力項目単位に分解する。</span>
        <em>P1入力</em>
      </a>`,
);

insertAfterHref(
  "daily_practical_compact_board_20260614.html",
  "p1_financial_completion_engine_20260614.html",
  `<a href="p1_financial_official_input_queue_20260614.html">P1 財務公式入力キュー</a>`,
);

console.log("generated p1_financial_official_input_queue_20260614.html");
