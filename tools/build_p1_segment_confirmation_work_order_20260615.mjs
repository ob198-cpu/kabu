import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/15 03:36";
const sourceCsv = "p1_segment_confirmation_validator_20260615.csv";
const htmlFile = "p1_segment_confirmation_work_order_20260615.html";
const detailCsv = "p1_segment_confirmation_work_order_20260615.csv";
const summaryCsv = "p1_segment_confirmation_work_order_summary_20260615.csv";

const officialSource = {
  "6503.T": {
    document: "三菱電機 2026年3月期 決算説明会資料",
    date: "2026/04/28",
    url: "https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co2.pdf",
  },
  "8035.T": {
    document: "東京エレクトロン 2026年3月期 決算説明会資料",
    date: "2026/04/30",
    url: "https://www.tel.co.jp/ir/library/report/jngpc500000000l6-att/fy26q4presentations-j.pdf",
  },
};

const workDefinition = {
  "6503-energy": {
    checkPoint: "エネルギーシステムの売上高、営業利益、営業利益率、前年比、需要背景",
    targetText: "売上高4,733億円、営業利益453億円、営業利益率9.6%、データセンター増設、電力流通事業増加",
    fillTarget: "確認ページまたは箇所、対象年度確認、単位確認、前年比確認、数値一致確認、注意点併記確認",
    riskNote: "データセンター一般論ではなく、該当セグメントの増収増益・需要背景として確認する。",
  },
  "6503-fa": {
    checkPoint: "FAシステムの売上高、営業利益、営業利益率、AI関連半導体設備投資需要",
    targetText: "売上高7,982億円、営業利益766億円、営業利益率9.6%、AI関連半導体設備投資需要増加",
    fillTarget: "確認ページまたは箇所、対象年度確認、単位確認、前年比確認、数値一致確認、注意点併記確認",
    riskNote: "AIという単語だけでは使わず、受注高・売上高の増加要因として確認する。",
  },
  "6503-guidance": {
    checkPoint: "26年度見通し、全社予想、増収増益要因、コストリスク",
    targetText: "売上高6兆2,000億円、調整後営業利益5,900億円、防衛・FA・ライフ拡大、中東情勢による原材料・物流費高騰織り込み",
    fillTarget: "確認ページまたは箇所、対象年度確認、単位確認、前年比確認、数値一致確認、注意点併記確認",
    riskNote: "全社見通しを、個別テーマ寄与として断定しない。コストリスクを併記する。",
  },
  "8035-wfe": {
    checkPoint: "WFE市場見通し、先端デバイス向け需要、地政学リスク",
    targetText: "CY2026〜2027 WFE市場 年1,500〜1,700億ドル、CY2025比20%以上増、先端デバイス向け30%以上増",
    fillTarget: "確認ページまたは箇所、対象年度確認、単位確認、前年比確認、数値一致確認、注意点併記確認",
    riskNote: "市場全体の見通しだけで購入候補化しない。SOX指数と6月イベント後反応が別途必要。",
  },
  "8035-product-share": {
    checkPoint: "製品別シェア、製品別売上成長、先端パッケージング",
    targetText: "塗布・現像シェア90%以上、絶縁膜エッチングシェア50%以上、先端パッケージングFY2026売上約2,000億円",
    fillTarget: "確認ページまたは箇所、対象年度確認、単位確認、前年比確認、数値一致確認、注意点併記確認",
    riskNote: "シェアが高いことだけで株価上昇を断定しない。利益率・受注・指数反応と併用する。",
  },
  "8035-ai-server": {
    checkPoint: "FY2027上期予想、AIサーバー需要、営業利益率、地政学リスク",
    targetText: "売上高1兆5,700億円、営業利益4,310億円、営業利益率27.5%、AIサーバー需要、ホルムズ海峡リスク",
    fillTarget: "確認ページまたは箇所、対象年度確認、単位確認、前年比確認、数値一致確認、注意点併記確認",
    riskNote: "強い会社予想だけを採用しない。高PERとホルムズ海峡リスクを同じ行に残す。",
  },
};

function p(file) {
  return path.join(ROOT, file);
}

function h(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function parseCsv(text) {
  const clean = String(text ?? "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let quote = false;
  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i];
    const next = clean[i + 1];
    if (quote) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quote = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      quote = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  const headers = rows.shift() ?? [];
  return rows
    .filter((values) => values.some((value) => String(value ?? "").trim() !== ""))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function readCsv(file) {
  return parseCsv(fs.readFileSync(p(file), "utf8"));
}

function writeCsv(file, rows) {
  const headers = Object.keys(rows[0] ?? { empty: "" });
  const body = [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
  fs.writeFileSync(p(file), `\uFEFF${body}\n`, "utf8");
}

function buildRows(sourceRows) {
  return sourceRows.map((row, index) => {
    const source = officialSource[row.ticker] ?? {};
    const work = workDefinition[row.evidence_id] ?? {};
    return {
      優先順: String(index + 1),
      evidence_id: row.evidence_id,
      ticker: row.ticker,
      銘柄: row.銘柄,
      公式資料: source.document ?? "",
      資料日付: source.date ?? "",
      URL: source.url ?? "",
      確認する箇所: work.checkPoint ?? "",
      探す数値または表現: work.targetText ?? "",
      埋める欄: work.fillTarget ?? "",
      注意して併記する内容: work.riskNote ?? "",
      現在の不足: row.不足項目,
      作業状態: "未着手",
      公式確認済み: "false",
      反映可否: "不可",
      買付上限: "0円",
    };
  });
}

function buildSummary(rows) {
  return [
    { 項目: "作業票", 値: `${rows.length}件`, 判定: "作成済み", 説明: "公式確認バリデーターで止まった6件を、確認作業に使える単位へ整理した。" },
    { 項目: "公式確認済み", 値: "0件", 判定: "未完了", 説明: "まだ該当箇所の確認ページ・年度・単位・前年比を埋めていない。" },
    { 項目: "反映可", 値: "0件", 判定: "不可", 説明: "作業票の段階ではスコアへ反映しない。" },
    { 項目: "P1復帰", 値: "0社", 判定: "不可", 説明: "公式確認後も、財務・価格・イベント後判定が別途必要。" },
    { 項目: "買付上限", 値: "0円", 判定: "維持", 説明: "購入判断に使える段階ではない。" },
  ];
}

function statusClass(value) {
  const text = String(value ?? "");
  if (/0円|0件|0社|不可|未完了|未着手|false/.test(text)) return "bad";
  if (/確認|必要|作成済み|併記|不足/.test(text)) return "warn";
  if (/完了|true/.test(text)) return "ok";
  return "";
}

function table(data, columns) {
  return `<div class="table-wrap"><table><thead><tr>${columns.map((column) => `<th>${h(column.label)}</th>`).join("")}</tr></thead><tbody>${data.map((row) => `<tr>${columns.map((column) => {
    const value = row[column.key];
    const cls = statusClass(value);
    if (column.link && value) return `<td class="${cls}"><a href="${h(value)}" target="_blank" rel="noopener">${h(value)}</a></td>`;
    return `<td class="${cls}">${h(value)}</td>`;
  }).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function card(title, value, note, className = "") {
  return `<div class="card ${className}"><b>${h(title)}</b><strong>${h(value)}</strong><span>${h(note)}</span></div>`;
}

function writeHtml(rows, summaryRows) {
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>P1 事業寄与 公式確認 作業票</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--warn:#9a5b00;--red:#b42318;--green:#116b4f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.75}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);line-height:1.2;letter-spacing:0}
    header p{margin:0;font-weight:850;max-width:1180px}
    main{max-width:1440px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08)}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:25px}
    .notice{border-left:8px solid var(--red);background:#fff1f1;border-radius:10px;padding:14px 16px;font-weight:900;margin:0 0 14px}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:15px}
    .card strong{display:block;font-size:28px;line-height:1.25;color:var(--blue)}
    .card span{display:block;font-weight:800;color:#263e55;margin-top:4px}
    .bad strong,.bad{color:var(--red)!important;font-weight:900}
    .warn strong,.warn{color:var(--warn)!important;font-weight:900}
    .ok strong,.ok{color:var(--green)!important;font-weight:900}
    .links{display:flex;flex-wrap:wrap;gap:10px}
    .links a{display:inline-block;text-decoration:none;color:#fff;background:var(--blue);border-radius:999px;padding:8px 13px;font-weight:900}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin-top:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:10px 12px;vertical-align:top;overflow-wrap:anywhere;word-break:normal}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    a{color:#005f99;font-weight:900}
    footer{font-size:13px;color:#526b82;margin:20px 0}
    @media(max-width:900px){main{padding:12px}.cards{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:12px;padding:6px 7px}}
  </style>
</head>
<body>
<header>
  <h1>P1 事業寄与 公式確認 作業票</h1>
  <p>公式確認バリデーターで止まっている6件について、何を見れば確認を進められるかを整理した作業票です。</p>
</header>
<main>
  <section>
    <h2>結論</h2>
    <p class="notice">これは確認作業票です。まだ公式確認済み0件、反映可0件、P1復帰0社、買付上限0円を維持します。</p>
    <div class="cards">
      ${card("作業票", `${rows.length}件`, "公式資料確認用", "warn")}
      ${card("公式確認済み", "0件", "未完了", "bad")}
      ${card("反映可", "0件", "不可", "bad")}
      ${card("買付上限", "0円", "継続", "bad")}
    </div>
  </section>

  <section>
    <h2>確認導線</h2>
    <div class="links">
      <a href="index.html">ホーム</a>
      <a href="latest_practical_start_20260614.html">実用パート入口</a>
      <a href="p1_segment_confirmation_validator_20260615.html">公式確認バリデーター</a>
      <a href="p1_segment_official_confirmation_sheet_20260615.html">公式確認チェックシート</a>
      <a href="p1_segment_evidence_reflection_gate_20260615.html">反映ゲート</a>
    </div>
  </section>

  <section>
    <h2>サマリー</h2>
    ${table(summaryRows, [
      { key: "項目", label: "項目" },
      { key: "値", label: "値" },
      { key: "判定", label: "判定" },
      { key: "説明", label: "説明" },
    ])}
  </section>

  <section>
    <h2>公式確認 作業票</h2>
    ${table(rows, [
      { key: "優先順", label: "優先順" },
      { key: "evidence_id", label: "evidence_id" },
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "公式資料", label: "公式資料" },
      { key: "資料日付", label: "資料日付" },
      { key: "URL", label: "URL", link: true },
      { key: "確認する箇所", label: "確認する箇所" },
      { key: "探す数値または表現", label: "探す数値または表現" },
      { key: "埋める欄", label: "埋める欄" },
      { key: "注意して併記する内容", label: "注意して併記する内容" },
      { key: "現在の不足", label: "現在の不足" },
      { key: "作業状態", label: "作業状態" },
      { key: "公式確認済み", label: "公式確認済み" },
      { key: "反映可否", label: "反映可否" },
      { key: "買付上限", label: "買付上限" },
    ])}
  </section>

  <section>
    <h2>作業順</h2>
    <ul>
      <li>URLを開き、確認する箇所に該当するページまたはセクションを探す。</li>
      <li>探す数値または表現が資料内にあるか確認する。</li>
      <li>対象年度、単位、前年比、注意点を同時に確認する。</li>
      <li>確認できた場合だけ、公式確認チェックシートに反映する。</li>
    </ul>
  </section>

  <footer>generated: ${h(generatedAt)} / source: ${h(sourceCsv)}</footer>
</main>
</body>
</html>
`;
  fs.writeFileSync(p(htmlFile), html, "utf8");
}

function insertOnce(file, markerHref, insertion) {
  const target = p(file);
  if (!fs.existsSync(target)) return;
  let text = fs.readFileSync(target, "utf8");
  if (text.includes(htmlFile)) return;
  const marker = `href="${markerHref}"`;
  const markerIndex = text.indexOf(marker);
  if (markerIndex < 0) return;
  const closeIndex = text.indexOf("</a>", markerIndex);
  if (closeIndex < 0) return;
  const insertAt = closeIndex + "</a>".length;
  text = `${text.slice(0, insertAt)}\n${insertion}\n${text.slice(insertAt)}`;
  fs.writeFileSync(target, text, "utf8");
}

function updateNavigation() {
  insertOnce("index.html", "p1_segment_confirmation_validator_20260615.html", `<a class="card" href="${htmlFile}">
          <b>P1 事業寄与 公式確認 作業票</b>
          <span>公式確認バリデーターで止まった6件について、何を見て何を埋めるか整理する。</span>
        </a>`);

  insertOnce("latest_practical_start_20260614.html", "p1_segment_confirmation_validator_20260615.html", `<a class="step" href="${htmlFile}">
        <b>6-12p. P1 事業寄与 公式確認 作業票</b>
        <span>公式資料の確認箇所、探す数値、埋める欄、併記すべき注意点を確認する。</span>
        <em>確認作業票</em>
      </a>`);

  insertOnce("daily_practical_compact_board_20260614.html", "p1_segment_confirmation_validator_20260615.html", `<a href="${htmlFile}">P1 事業寄与 公式確認 作業票</a>`);
}

function main() {
  const sourceRows = readCsv(sourceCsv);
  const rows = buildRows(sourceRows);
  const summaryRows = buildSummary(rows);
  writeCsv(detailCsv, rows);
  writeCsv(summaryCsv, summaryRows);
  writeHtml(rows, summaryRows);
  updateNavigation();
  console.log(JSON.stringify({ htmlFile, detailCsv, summaryCsv, rows: rows.length, buyLimit: "0円" }, null, 2));
}

main();
