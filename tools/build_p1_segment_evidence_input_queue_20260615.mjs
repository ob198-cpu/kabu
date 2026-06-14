import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/15 02:22";
const htmlFile = "p1_segment_evidence_input_queue_20260615.html";
const detailCsv = "p1_segment_evidence_input_queue_20260615.csv";
const summaryCsv = "p1_segment_evidence_input_queue_summary_20260615.csv";

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

const sourceByTicker = {
  "6503.T": {
    source_doc: "三菱電機 2026年3月期 決算説明会資料",
    source_date: "2026/04/28",
    source_url: "https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co2.pdf",
  },
  "8035.T": {
    source_doc: "東京エレクトロン 2026年3月期 決算説明会資料",
    source_date: "2026/04/30",
    source_url: "https://www.tel.co.jp/ir/library/report/jngpc500000000l6-att/fy26q4presentations-j.pdf",
  },
};

const sourceRows = [
  {
    ticker: "6503.T",
    name: "三菱電機",
    evidence_id: "6503-energy",
    evidence_type: "実績",
    candidate_value: "エネルギーシステム: 売上高4,733億円、営業利益453億円、営業利益率9.6%。データセンター増設と電力流通事業増加が需要背景。",
    fields: ["segment_growth_evidence", "order_demand_evidence", "data_center_power_evidence"],
    risk_pair: "データセンター一般論だけでは反映しない。セグメントの売上・利益・受注増加とセットで扱う。",
  },
  {
    ticker: "6503.T",
    name: "三菱電機",
    evidence_id: "6503-fa",
    evidence_type: "実績",
    candidate_value: "FAシステム: 売上高7,982億円、営業利益766億円、営業利益率9.6%。AI関連半導体設備投資需要が増加。",
    fields: ["segment_growth_evidence", "semiconductor_capex_evidence", "order_demand_evidence"],
    risk_pair: "AIという単語だけでは反映しない。受注高・売上高の増加要因として確認できる場合だけ候補入力にする。",
  },
  {
    ticker: "6503.T",
    name: "三菱電機",
    evidence_id: "6503-guidance",
    evidence_type: "会社予想",
    candidate_value: "26年度見通し: 売上高6兆2,000億円、調整後営業利益5,900億円。防衛、FA、ライフの拡大。中東情勢による原材料・物流費高騰を織り込み。",
    fields: ["company_guidance_evidence", "forecast_quality_note", "cost_risk_note"],
    risk_pair: "全社見通しだけで個別テーマ寄与を断定しない。中東コスト織り込みを同じ行に残す。",
  },
  {
    ticker: "8035.T",
    name: "東京エレクトロン",
    evidence_id: "8035-wfe",
    evidence_type: "市場見通し",
    candidate_value: "CY2026〜2027 WFE市場: 年1,500〜1,700億ドル、CY2025比20%以上増。先端デバイス向けは30%以上増。",
    fields: ["market_outlook_evidence", "semiconductor_cycle_evidence", "high_per_support_note"],
    risk_pair: "市場全体の見通しだけで購入候補化を確定しない。SOX指数と6月イベント後反応が必要。",
  },
  {
    ticker: "8035.T",
    name: "東京エレクトロン",
    evidence_id: "8035-product-share",
    evidence_type: "製品別成長ドライバー",
    candidate_value: "塗布・現像シェア90%以上、絶縁膜エッチングシェア50%以上、先端パッケージングFY2026売上約2,000億円。",
    fields: ["structural_advantage_evidence", "product_share_evidence", "high_per_support_note"],
    risk_pair: "シェアが高いことだけで株価上昇を断定しない。利益率、受注、指数反応と併用する。",
  },
  {
    ticker: "8035.T",
    name: "東京エレクトロン",
    evidence_id: "8035-ai-server",
    evidence_type: "会社予想",
    candidate_value: "FY2027上期予想: 売上高1兆5,700億円、営業利益4,310億円、営業利益率27.5%。AIサーバー需要が牽引。",
    fields: ["company_guidance_evidence", "ai_server_demand_evidence", "geopolitical_risk_note"],
    risk_pair: "強い会社予想だけを採用しない。ホルムズ海峡リスクと高PERリスクを同じ行に残す。",
  },
];

const rows = sourceRows.flatMap((row) => {
  const source = sourceByTicker[row.ticker];
  return row.fields.map((field_key) => ({
    evidence_id: row.evidence_id,
    ticker: row.ticker,
    銘柄: row.name,
    入力欄: field_key,
    根拠分類: row.evidence_type,
    候補入力文: row.candidate_value,
    対になる注意点: row.risk_pair,
    公式資料: source.source_doc,
    資料日付: source.source_date,
    URL: source.source_url,
    追加で必要な確認: "該当ページまたは該当箇所、対象年度、単位、前年比の目視確認",
    official_confirmed: "false",
    score_reflect: "false",
    buy_limit: "0円",
    status: "入力前候補",
  }));
});

const summaryRows = [
  { 項目: "候補入力行", 値: `${rows.length}行`, 状態: "作成済み", 説明: "6件の証拠候補を、入力欄単位へ分解した。" },
  { 項目: "公式確認済み", 値: "0行", 状態: "未確認", 説明: "該当ページ・単位・対象年度の目視確認前のため。" },
  { 項目: "スコア反映", 値: "0行", 状態: "反映不可", 説明: "候補入力文は作ったが、まだ点数へ混ぜない。" },
  { 項目: "P1復帰", 値: "0社", 状態: "不可", 説明: "財務、価格、イベント後判定、本人別口座確認が別途必要。" },
  { 項目: "買付上限", 値: "0円", 状態: "維持", 説明: "購入判断に使える段階ではない。" },
];

function statusClass(value) {
  const text = String(value ?? "");
  if (/false|0円|0行|0社|未確認|反映不可|不可|入力前候補/.test(text)) return "bad";
  if (/候補|注意|リスク|必要|併用/.test(text)) return "warn";
  if (/作成済み|資料|確認/.test(text)) return "ok";
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
  <title>P1 事業寄与証拠 入力キュー</title>
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
  <h1>P1 事業寄与証拠 入力キュー</h1>
  <p>公式資料から取れた証拠候補を、入力フォームへ転記する前の候補行として整理した画面です。</p>
</header>
<main>
  <section>
    <h2>結論</h2>
    <p class="notice">候補入力文は作成済みです。ただし、official_confirmed=false、score_reflect=false、買付上限0円を維持します。</p>
    <div class="cards">
      ${card("候補入力行", `${rows.length}行`, "入力欄単位へ分解", "warn")}
      ${card("公式確認済み", "0行", "該当箇所確認前", "bad")}
      ${card("スコア反映", "0行", "まだ反映不可", "bad")}
      ${card("買付上限", "0円", "継続", "bad")}
    </div>
  </section>

  <section>
    <h2>確認導線</h2>
    <div class="links">
      <a href="index.html">ホーム</a>
      <a href="latest_practical_start_20260614.html">実用パート入口</a>
      <a href="p1_segment_evidence_input_mapping_20260615.html">入力反映マップ</a>
      <a href="p1_segment_order_evidence_candidates_20260615.html">事業寄与 証拠候補</a>
      <a href="p1_financial_input_validator_20260614.html">財務入力バリデーター</a>
    </div>
  </section>

  <section>
    <h2>サマリー</h2>
    ${table(summaryRows, [
      { key: "項目", label: "項目" },
      { key: "値", label: "値" },
      { key: "状態", label: "状態" },
      { key: "説明", label: "説明" },
    ])}
  </section>

  <section>
    <h2>入力キュー</h2>
    ${table(rows, [
      { key: "evidence_id", label: "evidence_id" },
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "入力欄", label: "入力欄" },
      { key: "根拠分類", label: "根拠分類" },
      { key: "候補入力文", label: "候補入力文" },
      { key: "対になる注意点", label: "対になる注意点" },
      { key: "公式資料", label: "公式資料" },
      { key: "資料日付", label: "資料日付" },
      { key: "URL", label: "URL", link: true },
      { key: "追加で必要な確認", label: "追加で必要な確認" },
      { key: "official_confirmed", label: "official_confirmed" },
      { key: "score_reflect", label: "score_reflect" },
      { key: "buy_limit", label: "buy_limit" },
      { key: "status", label: "status" },
    ])}
  </section>

  <section>
    <h2>反映ルール</h2>
    <ul>
      <li>official_confirmed が true になるまでは、候補復帰にもスコアにも使わない。</li>
      <li>候補入力文には、必ず対になる注意点を残す。</li>
      <li>テーマ性は、売上・利益・受注・会社予想・市場見通しのどれかに接続できる場合だけ入力候補にする。</li>
      <li>入力キューの段階では、買付金額を出さない。</li>
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
  insertOnce("index.html", "p1_segment_evidence_input_mapping_20260615.html", `<a class="card" href="${htmlFile}">
          <b>P1 事業寄与証拠 入力キュー</b>
          <span>証拠候補を入力欄単位の候補行へ分解し、公式確認済み前の誤反映を止める。</span>
        </a>`);

  insertOnce("latest_practical_start_20260614.html", "p1_segment_evidence_input_mapping_20260615.html", `<a class="step" href="${htmlFile}">
        <b>6-12l. P1 事業寄与証拠 入力キュー</b>
        <span>候補入力文、注意点、official_confirmed=false、score_reflect=falseを確認する。</span>
        <em>入力候補</em>
      </a>`);

  insertOnce("daily_practical_compact_board_20260614.html", "p1_segment_evidence_input_mapping_20260615.html", `<a href="${htmlFile}">P1 事業寄与証拠 入力キュー</a>`);
}

function main() {
  writeCsv(detailCsv, rows);
  writeCsv(summaryCsv, summaryRows);
  writeHtml();
  updateNavigation();
  console.log(JSON.stringify({ htmlFile, detailCsv, summaryCsv, rows: rows.length, buyLimit: "0円" }, null, 2));
}

main();
