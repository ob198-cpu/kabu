import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/15 02:05";
const htmlFile = "p1_segment_evidence_input_mapping_20260615.html";
const detailCsv = "p1_segment_evidence_input_mapping_20260615.csv";
const summaryCsv = "p1_segment_evidence_input_mapping_summary_20260615.csv";

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
    証拠候補: "エネルギーシステムの売上高4,733億円、営業利益453億円、営業利益率9.6%。データセンター増設と電力流通事業増加が説明されている。",
    反映先入力欄: "segment_growth_evidence / order_demand_evidence / data_center_power_evidence",
    反映に必要な確認: "決算説明資料の該当ページ、資料日付、対象年度、セグメント名、前年比数値を入力欄へ転記する。",
    反映禁止条件: "データセンター関連の一般論だけで、該当セグメントの売上・利益・受注増加が確認できない場合は反映しない。",
    現在の扱い: "反映待ち",
    復帰への寄与: "テーマ補強。単独ではP1復帰不可。",
    買付上限: "0円",
    次作業: "6503の入力フォームに、エネルギーシステムの数値と資料URLを候補値として登録する。",
  },
  {
    ticker: "6503.T",
    銘柄: "三菱電機",
    証拠候補: "FAシステムの売上高7,982億円、営業利益766億円、営業利益率9.6%。AI関連半導体設備投資需要の増加が説明されている。",
    反映先入力欄: "segment_growth_evidence / semiconductor_capex_evidence / order_demand_evidence",
    反映に必要な確認: "AI関連半導体設備投資需要が、受注高・売上高の増加要因として資料内にあることを確認する。",
    反映禁止条件: "AIという言葉だけで売上・利益・受注との接続が弱い場合は、質的メモに留める。",
    現在の扱い: "反映待ち",
    復帰への寄与: "テーマ補強。財務・イベント・価格確認とセットで評価。",
    買付上限: "0円",
    次作業: "FAシステムの売上増・利益増・AI関連半導体設備投資需要を1行根拠へ圧縮する。",
  },
  {
    ticker: "6503.T",
    銘柄: "三菱電機",
    証拠候補: "26年度見通しは売上高6兆2,000億円、調整後営業利益5,900億円。防衛、FA、ライフの拡大が説明されている。",
    反映先入力欄: "company_guidance_evidence / forecast_quality_note / cost_risk_note",
    反映に必要な確認: "会社予想が通期予想であること、中東情勢による原材料・物流費高騰が織り込まれていることを確認する。",
    反映禁止条件: "全社見通しだけで個別テーマの寄与を断定しない。",
    現在の扱い: "反映待ち",
    復帰への寄与: "会社予想の補強。テーマ根拠とは分ける。",
    買付上限: "0円",
    次作業: "会社予想欄とリスク欄へ、増収増益見通しと中東コスト織り込みを分けて入力する。",
  },
  {
    ticker: "8035.T",
    銘柄: "東京エレクトロン",
    証拠候補: "CY2026〜2027のWFE市場は年1,500〜1,700億ドル、CY2025比20%以上増。先端デバイス向けは30%以上増とされている。",
    反映先入力欄: "market_outlook_evidence / semiconductor_cycle_evidence / high_per_support_note",
    反映に必要な確認: "WFE市場見通し、先端デバイス向け需要、地政学リスク注記を同じ資料から確認する。",
    反映禁止条件: "市場全体の見通しだけで、東京エレクトロンの購入候補化を確定しない。",
    現在の扱い: "反映待ち",
    復帰への寄与: "高PER説明の補助。SOX指数と6月イベント後反応が必要。",
    買付上限: "0円",
    次作業: "市場見通し欄へWFE数値を入れ、リスク欄に地政学リスクを併記する。",
  },
  {
    ticker: "8035.T",
    銘柄: "東京エレクトロン",
    証拠候補: "塗布・現像シェア90%以上、絶縁膜エッチングシェア50%以上、先端パッケージングFY2026売上約2,000億円などの製品別根拠。",
    反映先入力欄: "structural_advantage_evidence / product_share_evidence / high_per_support_note",
    反映に必要な確認: "製品別シェア、売上成長見通し、対象年度が資料内で確認できること。",
    反映禁止条件: "シェアが高いことだけで株価上昇を断定しない。利益率、受注、指数反応と併用する。",
    現在の扱い: "反映待ち",
    復帰への寄与: "構造優位の補強。買付判断ではなく説明可能性を上げる材料。",
    買付上限: "0円",
    次作業: "製品別シェアと成長見通しを、構造優位欄に資料URLつきで候補入力する。",
  },
  {
    ticker: "8035.T",
    銘柄: "東京エレクトロン",
    証拠候補: "FY2027上期予想は売上高1兆5,700億円、営業利益4,310億円、営業利益率27.5%。AIサーバー需要が牽引と説明されている。",
    反映先入力欄: "company_guidance_evidence / ai_server_demand_evidence / geopolitical_risk_note",
    反映に必要な確認: "FY2027上期予想であること、AIサーバー需要、DRAM・先端ロジック出荷増加、ホルムズ海峡リスクをセットで確認する。",
    反映禁止条件: "強い会社予想だけを採用し、ホルムズ海峡や高PERリスクを消さない。",
    現在の扱い: "反映待ち",
    復帰への寄与: "攻め枠の補強候補。リスク付きでのみ扱う。",
    買付上限: "0円",
    次作業: "AIサーバー需要の根拠とホルムズ海峡リスクを同じ入力行に残す。",
  },
];

const summaryRows = [
  { 項目: "証拠候補", 件数: `${rows.length}件`, 状態: "反映待ち", 説明: "公式資料から取った候補値を、入力欄ごとに分解した。" },
  { 項目: "入力CSV反映", 件数: "0件", 状態: "未反映", 説明: "入力フォームへの転記と目視確認が終わるまで、公式確認済みにしない。" },
  { 項目: "P1復帰", 件数: "0社", 状態: "不可", 説明: "事業寄与の証拠候補だけでは復帰させない。財務・価格・イベント後判定と併用する。" },
  { 項目: "買付上限", 件数: "0円", 状態: "維持", 説明: "候補値の整理段階であり、買付金額は出さない。" },
  { 項目: "次の処理", 件数: "6入力欄", 状態: "入力候補", 説明: "segment_growth、order_demand、market_outlook、structural_advantage、company_guidance、risk_noteへ分ける。" },
];

function statusClass(value) {
  const text = String(value ?? "");
  if (/0円|不可|未反映|反映待ち|禁止|断定しない/.test(text)) return "bad";
  if (/候補|リスク|補強|併用/.test(text)) return "warn";
  if (/確認|入力欄|分解/.test(text)) return "ok";
  return "";
}

function table(data, columns) {
  return `<div class="table-wrap"><table><thead><tr>${columns.map((column) => `<th>${h(column.label)}</th>`).join("")}</tr></thead><tbody>${data.map((row) => `<tr>${columns.map((column) => {
    const value = row[column.key];
    const cls = statusClass(value);
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
  <title>P1 事業寄与証拠 入力反映マップ</title>
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
    footer{font-size:13px;color:#526b82;margin:20px 0}
    @media(max-width:900px){main{padding:12px}.cards{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:12px;padding:6px 7px}}
  </style>
</head>
<body>
<header>
  <h1>P1 事業寄与証拠 入力反映マップ</h1>
  <p>公式資料から取れた事業寄与の証拠候補を、入力欄・反映条件・反映禁止条件へ分解した画面です。</p>
</header>
<main>
  <section>
    <h2>結論</h2>
    <p class="notice">このページは入力前の審査表です。証拠候補は取れましたが、入力CSVへはまだ反映せず、P1復帰0社・買付上限0円を維持します。</p>
    <div class="cards">
      ${card("証拠候補", `${rows.length}件`, "入力欄へ分解済み", "warn")}
      ${card("入力CSV反映", "0件", "公式確認済み扱いにしない", "bad")}
      ${card("P1復帰", "0社", "まだ不可", "bad")}
      ${card("買付上限", "0円", "継続", "bad")}
    </div>
  </section>

  <section>
    <h2>確認導線</h2>
    <div class="links">
      <a href="index.html">ホーム</a>
      <a href="latest_practical_start_20260614.html">実用パート入口</a>
      <a href="p1_segment_order_evidence_candidates_20260615.html">事業寄与 証拠候補</a>
      <a href="p1_financial_input_validator_20260614.html">財務入力バリデーター</a>
      <a href="p1_financial_completion_engine_20260614.html">P1 財務補完 判定エンジン</a>
    </div>
  </section>

  <section>
    <h2>サマリー</h2>
    ${table(summaryRows, [
      { key: "項目", label: "項目" },
      { key: "件数", label: "件数" },
      { key: "状態", label: "状態" },
      { key: "説明", label: "説明" },
    ])}
  </section>

  <section>
    <h2>入力反映マップ</h2>
    ${table(rows, [
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "証拠候補", label: "証拠候補" },
      { key: "反映先入力欄", label: "反映先入力欄" },
      { key: "反映に必要な確認", label: "反映に必要な確認" },
      { key: "反映禁止条件", label: "反映禁止条件" },
      { key: "現在の扱い", label: "現在の扱い" },
      { key: "復帰への寄与", label: "復帰への寄与" },
      { key: "買付上限", label: "買付上限" },
      { key: "次作業", label: "次作業" },
    ])}
  </section>

  <section>
    <h2>運用上の扱い</h2>
    <ul>
      <li>テーマ性は、売上・利益・受注・会社予想・市場見通しへ接続できる場合だけ補強材料にする。</li>
      <li>「AI」「半導体」「データセンター」という言葉だけでは加点しない。</li>
      <li>高PER銘柄は、成長根拠とリスク注記をセットで残す。</li>
      <li>この画面の段階では、候補復帰・購入判断・資金配分へ進めない。</li>
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
  insertOnce("index.html", "p1_segment_order_evidence_candidates_20260615.html", `<a class="card" href="${htmlFile}">
          <b>P1 事業寄与証拠 入力反映マップ</b>
          <span>公式資料から取れた証拠候補を、入力欄・反映条件・反映禁止条件に分解する。</span>
        </a>`);

  insertOnce("latest_practical_start_20260614.html", "p1_segment_order_evidence_candidates_20260615.html", `<a class="step" href="${htmlFile}">
        <b>6-12k. P1 事業寄与証拠 入力反映マップ</b>
        <span>証拠候補をどの入力欄へ入れるか、何を確認するまで反映しないかを確認する。</span>
        <em>入力反映前</em>
      </a>`);

  insertOnce("daily_practical_compact_board_20260614.html", "p1_segment_order_evidence_candidates_20260615.html", `<a href="${htmlFile}">P1 事業寄与証拠 入力反映マップ</a>`);
}

function main() {
  writeCsv(detailCsv, rows);
  writeCsv(summaryCsv, summaryRows);
  writeHtml();
  updateNavigation();
  console.log(JSON.stringify({ htmlFile, detailCsv, summaryCsv, rows: rows.length, buyLimit: "0円" }, null, 2));
}

main();
