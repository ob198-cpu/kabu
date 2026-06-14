import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/15 01:12";
const detailCsv = "p1_segment_order_queue_20260615.csv";
const summaryCsv = "p1_segment_order_queue_summary_20260615.csv";
const htmlFile = "p1_segment_order_queue_20260615.html";

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

function writeCsv(file, rows) {
  const headers = Object.keys(rows[0] ?? { empty: "" });
  const body = [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
  fs.writeFileSync(p(file), `\uFEFF${body}\n`, "utf8");
}

const rows = [
  {
    ticker: "6503.T",
    銘柄: "三菱電機",
    確認テーマ: "AI電力・FA・データセンター周辺",
    入力したい項目: "受注またはセグメント寄与",
    必要な根拠: "セグメント別売上、セグメント別営業利益、FA/電力/社会インフラ/データセンター周辺の増減理由",
    見る資料: "決算説明資料、決算短信のセグメント情報、統合報告書、事業説明資料",
    入口URL: "https://www.mitsubishielectric.co.jp/ir/library/",
    現在状態: "未入力",
    反映可否: "反映しない",
    判定に使える条件: "該当セグメントの売上または利益が増加し、増加理由が設備投資・電力・FA需要と説明できる場合だけ補強材料にする。",
    止める条件: "全社好調でも該当セグメントの寄与が不明、または利益率低下・受注鈍化がある場合は比率引上げに使わない。",
    次作業: "セグメント表を目視確認し、増減率と会社コメントを入力する。",
  },
  {
    ticker: "6503.T",
    銘柄: "三菱電機",
    確認テーマ: "会社予想の質",
    入力したい項目: "会社予想の裏付け",
    必要な根拠: "通期会社予想の売上・営業利益・EPSと、増益の前提になっている事業分野",
    見る資料: "決算短信の通期予想欄、決算説明資料の見通しページ",
    入口URL: "https://www.mitsubishielectric.co.jp/ir/library/",
    現在状態: "一部候補あり",
    反映可否: "反映しない",
    判定に使える条件: "増益予想が全社一過性ではなく、候補テーマと同じ事業の継続需要で説明できる場合に補強材料にする。",
    止める条件: "為替・一過性・コスト戻りだけで増益している場合は、時流テーマの根拠として使わない。",
    次作業: "通期予想の前提コメントを抜き出し、テーマ連動か一過性かを分類する。",
  },
  {
    ticker: "8035.T",
    銘柄: "東京エレクトロン",
    確認テーマ: "半導体製造装置・AI投資",
    入力したい項目: "受注または市場見通し",
    必要な根拠: "WFE/半導体製造装置市場の見通し、AI・先端ロジック・メモリ投資の需要説明、地域別または装置別の増減",
    見る資料: "決算説明資料、決算短信の今後の見通し、IR説明会資料",
    入口URL: "https://www.tel.co.jp/ir/library/",
    現在状態: "未入力",
    反映可否: "反映しない",
    判定に使える条件: "会社が市場回復・AI関連投資・先端半導体投資を具体的に示し、売上または利益見通しと接続できる場合だけ補強材料にする。",
    止める条件: "株価上昇だけ、SOX上昇だけ、または通期予想未開示のままでは比率引上げに使わない。",
    次作業: "決算説明資料から市場見通し、受注、装置別需要、会社コメントを抽出する。",
  },
  {
    ticker: "8035.T",
    銘柄: "東京エレクトロン",
    確認テーマ: "高PER説明",
    入力したい項目: "高PER説明",
    必要な根拠: "実績PER、PBR、利益率、予想成長率、会社予想の範囲、半導体サイクル上の位置",
    見る資料: "決算短信、決算説明資料、株価基準日つきPER/PBR計算表",
    入口URL: "https://www.tel.co.jp/ir/library/",
    現在状態: "一部候補あり",
    反映可否: "反映しない",
    判定に使える条件: "高PERを利益成長・受注・高利益率・市場回復で説明でき、かつ6月イベント後も半導体指数が崩れていない場合だけ小口候補に残す。",
    止める条件: "PER/PBRが高いだけで、通期予想・受注・市場見通しの裏付けがない場合は監視継続。",
    次作業: "PER/PBR候補表と決算説明資料を結合し、高PERを説明できるかをA/B/Cで分類する。",
  },
];

const summary = [
  { 項目: "対象銘柄", 値: "2社", 判定: "確認キュー作成", メモ: "6503 三菱電機、8035 東京エレクトロン" },
  { 項目: "確認項目", 値: `${rows.length}件`, 判定: "未入力", メモ: "受注、セグメント寄与、会社予想の質、高PER説明" },
  { 項目: "入力CSV反映", 値: "0件", 判定: "反映しない", メモ: "会社資料の目視確認前。" },
  { 項目: "P1復帰可能", 値: "0社", 判定: "不可", メモ: "セグメント・受注根拠が埋まるまで不可。" },
  { 項目: "買付上限", 値: "0円", 判定: "維持", メモ: "このキューは購入判断ではなく、未確認を潰すための作業表。" },
];

function statusClass(value) {
  const text = String(value ?? "");
  if (/0円|不可|未入力|反映しない|使わない|監視継続/.test(text)) return "bad";
  if (/候補|確認|一部|分類|条件/.test(text)) return "warn";
  if (/作成|増加|補強/.test(text)) return "ok";
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

function writeHtml() {
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>P1 受注・セグメント寄与 確認キュー</title>
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
  <h1>P1 受注・セグメント寄与 確認キュー</h1>
  <p>PER/PBRやROEだけでは足りないため、候補テーマが実際の売上・利益・受注に結びついているかを確認する作業表です。</p>
</header>
<main>
  <section>
    <h2>結論</h2>
    <p class="notice">現時点では、受注・セグメント寄与は未入力です。テーマ性だけで候補復帰させず、会社資料で事業寄与を確認するまで買付上限0円を維持します。</p>
    <div class="cards">
      ${card("確認項目", `${rows.length}件`, "受注・セグメント・高PER説明", "warn")}
      ${card("入力反映", "0件", "目視確認前", "bad")}
      ${card("P1復帰", "0社", "まだ不可", "bad")}
      ${card("買付上限", "0円", "維持", "bad")}
    </div>
  </section>

  <section>
    <h2>確認導線</h2>
    <div class="links">
      <a href="index.html">ホーム</a>
      <a href="latest_practical_start_20260614.html">最新 実用パート入口</a>
      <a href="p1_financial_per_pbr_basis_20260615.html">PER/PBR計算候補</a>
      <a href="p1_financial_pdf_to_input_review_20260615.html">PDF→入力レビュー</a>
      <a href="p1_financial_input_validator_20260614.html">入力バリデーター</a>
    </div>
  </section>

  <section>
    <h2>全体サマリー</h2>
    ${table(summary, [
      { key: "項目", label: "項目" },
      { key: "値", label: "値" },
      { key: "判定", label: "判定" },
      { key: "メモ", label: "メモ" },
    ])}
  </section>

  <section>
    <h2>確認キュー</h2>
    ${table(rows, [
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "確認テーマ", label: "確認テーマ" },
      { key: "入力したい項目", label: "入力したい項目" },
      { key: "必要な根拠", label: "必要な根拠" },
      { key: "見る資料", label: "見る資料" },
      { key: "入口URL", label: "入口URL", link: true },
      { key: "現在状態", label: "現在状態" },
      { key: "反映可否", label: "反映可否" },
      { key: "判定に使える条件", label: "判定に使える条件" },
      { key: "止める条件", label: "止める条件" },
      { key: "次作業", label: "次作業" },
    ])}
  </section>

  <section>
    <h2>運用上の扱い</h2>
    <ul>
      <li>テーマ性は、会社資料の事業寄与が確認できるまで補助材料に止める。</li>
      <li>セグメントや受注が確認できても、PER/PBR、イベント、口座確認が未完了なら買付へ進めない。</li>
      <li>高PER銘柄は、利益成長・受注・市場見通しがそろわない限り監視継続にする。</li>
    </ul>
  </section>

  <footer>generated: ${h(generatedAt)}</footer>
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
  insertOnce("index.html", "p1_financial_per_pbr_basis_20260615.html", `<a class="card" href="${htmlFile}">
          <b>P1 受注・セグメント寄与 確認キュー</b>
          <span>テーマ性を売上・利益・受注に接続できるかを確認し、未確認なら買付判断へ混ぜない。</span>
        </a>`);

  insertOnce("latest_practical_start_20260614.html", "p1_financial_per_pbr_basis_20260615.html", `<a class="step" href="${htmlFile}">
        <b>6-12i. P1 受注・セグメント寄与 確認キュー</b>
        <span>三菱電機と東京エレクトロンのテーマ根拠を、事業寄与で説明できるか確認する。</span>
        <em>事業寄与確認</em>
      </a>`);

  insertOnce("daily_practical_compact_board_20260614.html", "p1_financial_per_pbr_basis_20260615.html", `<a href="${htmlFile}">P1 受注・セグメント寄与 確認キュー</a>`);
}

function main() {
  writeCsv(detailCsv, rows);
  writeCsv(summaryCsv, summary);
  writeHtml();
  updateNavigation();
  console.log(JSON.stringify({ htmlFile, detailCsv, summaryCsv, rows: rows.length, buyLimit: "0円" }, null, 2));
}

main();
