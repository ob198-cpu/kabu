import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/15 03:58";
const htmlFile = "p1_segment_ai_confirmation_draft_20260615.html";
const detailCsv = "p1_segment_ai_confirmation_draft_20260615.csv";
const summaryCsv = "p1_segment_ai_confirmation_draft_summary_20260615.csv";

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
    evidence_id: "6503-energy",
    ticker: "6503.T",
    銘柄: "三菱電機",
    公式資料: "三菱電機 2026年3月期 決算説明会資料",
    資料日付: "2026/04/28",
    URL: "https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co2.pdf",
    確認箇所: "P9 / lines 127-134",
    対象年度: "2025年度実績",
    単位: "億円、%、pt",
    確認した数値: "エネルギーシステム: 売上高4,733億円（+771）、営業利益453億円（+178）、営業利益率9.6%（+2.7pt）。",
    確認した文章: "再生可能エネルギー拡大、データセンター増設を背景に需要が堅調。受注高は国内外の発電事業増加、売上高は電力流通事業増加で前年度を上回る。",
    注意点: "データセンター一般論ではなく、エネルギーシステムの実績・受注・売上増とセットで扱う。",
    AI確認候補: "true",
    人間確認必要: "yes",
    official_confirmed: "false",
    score_reflect: "false",
    buy_limit: "0円",
  },
  {
    evidence_id: "6503-fa",
    ticker: "6503.T",
    銘柄: "三菱電機",
    公式資料: "三菱電機 2026年3月期 決算説明会資料",
    資料日付: "2026/04/28",
    URL: "https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co2.pdf",
    確認箇所: "P10 / lines 150-157",
    対象年度: "2025年度実績",
    単位: "億円、%、pt",
    確認した数値: "FAシステム: 売上高7,982億円（+726）、営業利益766億円（+298）、営業利益率9.6%（+3.2pt）。",
    確認した文章: "中国スマートフォン・工作機械関連需要、日本・中国などのAI関連半導体設備投資需要が増加。受注高・売上高ともに前年度を上回る。",
    注意点: "AIという単語だけではなく、FAシステムの受注高・売上高増加要因として確認する。",
    AI確認候補: "true",
    人間確認必要: "yes",
    official_confirmed: "false",
    score_reflect: "false",
    buy_limit: "0円",
  },
  {
    evidence_id: "6503-guidance",
    ticker: "6503.T",
    銘柄: "三菱電機",
    公式資料: "三菱電機 2026年3月期 決算説明会資料",
    資料日付: "2026/04/28",
    URL: "https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co2.pdf",
    確認箇所: "P3 lines 24-26 / P15 lines 243-250",
    対象年度: "2026年度業績見通し",
    単位: "億円、%、pt",
    確認した数値: "売上高6兆2,000億円（前年度比+3,052億円）、調整後営業利益5,900億円（前年度比+887億円）。P15では売上高62,000億円、調整後営業利益5,900億円。",
    確認した文章: "防衛システム、FAシステム、ライフ部門の拡大で過去最高更新見通し。中東情勢影響は原材料・物流費高騰として織り込み。",
    注意点: "全社見通しであり、個別テーマ寄与として断定しない。中東コストリスクを同じ行に残す。",
    AI確認候補: "true",
    人間確認必要: "yes",
    official_confirmed: "false",
    score_reflect: "false",
    buy_limit: "0円",
  },
  {
    evidence_id: "8035-wfe",
    ticker: "8035.T",
    銘柄: "東京エレクトロン",
    公式資料: "東京エレクトロン 2026年3月期 決算説明会資料",
    資料日付: "2026/04/30",
    URL: "https://www.tel.co.jp/ir/library/report/jngpc500000000l6-att/fy26q4presentations-j.pdf",
    確認箇所: "P14 / lines 349-359",
    対象年度: "CY2026〜2027市場見通し",
    単位: "十億ドル、%",
    確認した数値: "CY2026〜2027 WFE市場は150〜170Bドル/年、CY2025比+20%以上。先端デバイス向けは+30%以上。",
    確認した文章: "WFE市場見通しと同時に、地政学的リスクは要注視と記載。",
    注意点: "市場全体の見通しだけで東京エレクトロンの購入候補化を確定しない。SOX指数と6月イベント後反応が別途必要。",
    AI確認候補: "true",
    人間確認必要: "yes",
    official_confirmed: "false",
    score_reflect: "false",
    buy_limit: "0円",
  },
  {
    evidence_id: "8035-product-share",
    ticker: "8035.T",
    銘柄: "東京エレクトロン",
    公式資料: "東京エレクトロン 2026年3月期 決算説明会資料",
    資料日付: "2026/04/30",
    URL: "https://www.tel.co.jp/ir/library/report/jngpc500000000l6-att/fy26q4presentations-j.pdf",
    確認箇所: "P15 / lines 361-372",
    対象年度: "2027年3月期売上成長ドライバー",
    単位: "%、億円",
    確認した数値: "塗布・現像シェア90%以上、FY2027売上YoY+50%以上。絶縁膜エッチングシェア50%以上、FY2027売上YoY+25%以上。先端パッケージングFY2026売上約2,000億円、FY2027売上YoY+60%以上。",
    確認した文章: "DRAM・先端ロジック投資機会、HARC・配線・GAA、先端ロジック向けプローバやHBM向けボンディング装置に言及。",
    注意点: "シェアが高いことだけで株価上昇を断定しない。利益率・受注・指数反応と併用する。",
    AI確認候補: "true",
    人間確認必要: "yes",
    official_confirmed: "false",
    score_reflect: "false",
    buy_limit: "0円",
  },
  {
    evidence_id: "8035-ai-server",
    ticker: "8035.T",
    銘柄: "東京エレクトロン",
    公式資料: "東京エレクトロン 2026年3月期 決算説明会資料",
    資料日付: "2026/04/30",
    URL: "https://www.tel.co.jp/ir/library/report/jngpc500000000l6-att/fy26q4presentations-j.pdf",
    確認箇所: "P16 / lines 373-425",
    対象年度: "FY2027上期予想",
    単位: "億円、%",
    確認した数値: "FY2027上期予想: 売上高15,700億円、売上総利益7,150億円、営業利益4,310億円、営業利益率27.5%。",
    確認した文章: "AIサーバー向け需要が牽引し、過去最高の売上高・売上総利益・営業利益を見込む。2026年後半はDRAM・先端ロジック中心に出荷増加。ホルムズ海峡封鎖影響は要注視。",
    注意点: "強い会社予想だけを採用しない。高PERとホルムズ海峡リスクを同じ行に残す。",
    AI確認候補: "true",
    人間確認必要: "yes",
    official_confirmed: "false",
    score_reflect: "false",
    buy_limit: "0円",
  },
];

const summaryRows = [
  { 項目: "AI確認下書き", 値: `${rows.length}件`, 判定: "作成済み", 説明: "公式資料内の確認箇所・数値・注意点を下書き化した。" },
  { 項目: "人間確認必要", 値: `${rows.length}件`, 判定: "必要", 説明: "最終的な公式確認済み化は人間の目視確認後に行う。" },
  { 項目: "official_confirmed", 値: "0件", 判定: "false維持", 説明: "AI確認候補の段階では true にしない。" },
  { 項目: "score_reflect", 値: "0件", 判定: "false維持", 説明: "まだ点数へ混ぜない。" },
  { 項目: "P1復帰", 値: "0社", 判定: "不可", 説明: "人間確認・財務・価格・イベント後判定が必要。" },
  { 項目: "買付上限", 値: "0円", 判定: "維持", 説明: "購入判断に使える段階ではない。" },
];

function statusClass(value) {
  const text = String(value ?? "");
  if (/0円|0件|0社|不可|false|必要/.test(text)) return "bad";
  if (/候補|作成済み|確認|注意|下書き/.test(text)) return "warn";
  if (/true|完了/.test(text)) return "ok";
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
  <title>P1 事業寄与 AI確認下書き</title>
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
  <h1>P1 事業寄与 AI確認下書き</h1>
  <p>公式資料から確認できた箇所・数値・注意点を下書き化した画面です。人間の最終確認前なので、公式確認済みにはしません。</p>
</header>
<main>
  <section>
    <h2>結論</h2>
    <p class="notice">AI確認下書きは作成済みです。ただし official_confirmed=false、score_reflect=false、P1復帰0社、買付上限0円を維持します。</p>
    <div class="cards">
      ${card("AI確認下書き", `${rows.length}件`, "公式資料の箇所つき", "warn")}
      ${card("人間確認必要", `${rows.length}件`, "最終確認前", "bad")}
      ${card("スコア反映", "0件", "false維持", "bad")}
      ${card("買付上限", "0円", "継続", "bad")}
    </div>
  </section>

  <section>
    <h2>確認導線</h2>
    <div class="links">
      <a href="index.html">ホーム</a>
      <a href="latest_practical_start_20260614.html">実用パート入口</a>
      <a href="p1_segment_confirmation_work_order_20260615.html">公式確認 作業票</a>
      <a href="p1_segment_confirmation_validator_20260615.html">公式確認バリデーター</a>
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
    <h2>AI確認下書き</h2>
    ${table(rows, [
      { key: "evidence_id", label: "evidence_id" },
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "公式資料", label: "公式資料" },
      { key: "資料日付", label: "資料日付" },
      { key: "URL", label: "URL", link: true },
      { key: "確認箇所", label: "確認箇所" },
      { key: "対象年度", label: "対象年度" },
      { key: "単位", label: "単位" },
      { key: "確認した数値", label: "確認した数値" },
      { key: "確認した文章", label: "確認した文章" },
      { key: "注意点", label: "注意点" },
      { key: "AI確認候補", label: "AI確認候補" },
      { key: "人間確認必要", label: "人間確認必要" },
      { key: "official_confirmed", label: "official_confirmed" },
      { key: "score_reflect", label: "score_reflect" },
      { key: "buy_limit", label: "buy_limit" },
    ])}
  </section>

  <section>
    <h2>次の扱い</h2>
    <ul>
      <li>この下書きを見て、人間が公式資料の該当箇所を確認する。</li>
      <li>確認できた根拠だけ、公式確認チェックシートの該当項目を「済」にする。</li>
      <li>official_confirmed を true にするのは、人間確認後だけにする。</li>
      <li>この下書き単独では、スコアにも購入判断にも使わない。</li>
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
  insertOnce("index.html", "p1_segment_confirmation_work_order_20260615.html", `<a class="card" href="${htmlFile}">
          <b>P1 事業寄与 AI確認下書き</b>
          <span>公式資料から確認できた箇所・数値・注意点を下書き化し、人間確認前の誤反映を止める。</span>
        </a>`);

  insertOnce("latest_practical_start_20260614.html", "p1_segment_confirmation_work_order_20260615.html", `<a class="step" href="${htmlFile}">
        <b>6-12q. P1 事業寄与 AI確認下書き</b>
        <span>公式資料の確認箇所、数値、注意点を下書き化する。人間確認前なので反映はしない。</span>
        <em>確認下書き</em>
      </a>`);

  insertOnce("daily_practical_compact_board_20260614.html", "p1_segment_confirmation_work_order_20260615.html", `<a href="${htmlFile}">P1 事業寄与 AI確認下書き</a>`);
}

function main() {
  writeCsv(detailCsv, rows);
  writeCsv(summaryCsv, summaryRows);
  writeHtml();
  updateNavigation();
  console.log(JSON.stringify({ htmlFile, detailCsv, summaryCsv, rows: rows.length, buyLimit: "0円" }, null, 2));
}

main();
