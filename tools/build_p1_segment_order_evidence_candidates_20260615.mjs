import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/15 01:35";
const detailCsv = "p1_segment_order_evidence_candidates_20260615.csv";
const summaryCsv = "p1_segment_order_evidence_summary_20260615.csv";
const htmlFile = "p1_segment_order_evidence_candidates_20260615.html";

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

const evidenceRows = [
  {
    ticker: "6503.T",
    銘柄: "三菱電機",
    根拠分類: "実績",
    テーマ: "エネルギーシステム・データセンター周辺",
    公式資料: "2026年3月期 決算説明会資料",
    資料日付: "2026/04/28",
    URL: "https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co2.pdf",
    数値根拠: "エネルギーシステム: 売上高 4,733億円（+771億円）、営業利益 453億円（+178億円）、営業利益率 9.6%（+2.7pt）",
    文章根拠要約: "再生可能エネルギーの拡大やデータセンター増設を背景に需要が堅調。受注高は国内外の発電事業増加などで前年度を上回り、売上高は電力流通事業増加などで前年度を上回った。",
    判定: "補強候補A",
    入力CSV反映: "反映しない",
    反映しない理由: "公式資料の該当ページを目視確認し、入力フォームへ資料日付・URLと一緒に転記するまでは公式確認済みにしない。",
    次作業: "受注またはセグメント寄与欄へ、データセンター増設と電力流通事業増加を要約入力する。",
  },
  {
    ticker: "6503.T",
    銘柄: "三菱電機",
    根拠分類: "実績",
    テーマ: "FAシステム・AI関連半導体投資",
    公式資料: "2026年3月期 決算説明会資料",
    資料日付: "2026/04/28",
    URL: "https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co2.pdf",
    数値根拠: "FAシステム: 売上高 7,982億円（+726億円）、営業利益 766億円（+298億円）、営業利益率 9.6%（+3.2pt）",
    文章根拠要約: "中国のスマートフォン・工作機械関連需要、日本・中国などのAI関連半導体設備投資需要が増加。スマートフォン、AI関連設備投資、工作機械関連需要の増加で受注高・売上高ともに前年度を上回った。",
    判定: "補強候補A",
    入力CSV反映: "反映しない",
    反映しない理由: "テーマ性と実績が接続している候補だが、入力状態はまだ候補値。",
    次作業: "FAシステムの受注・売上増加を、候補復帰の補強材料として入力候補にする。",
  },
  {
    ticker: "6503.T",
    銘柄: "三菱電機",
    根拠分類: "会社予想",
    テーマ: "26年度見通し",
    公式資料: "2026年3月期 決算説明会資料",
    資料日付: "2026/04/28",
    URL: "https://www.mitsubishielectric.co.jp/ja/pr/2026/pdf/0428_co2.pdf",
    数値根拠: "26年度業績見通し: 売上高 6兆2,000億円（前年度比 +3,052億円）、調整後営業利益 5,900億円（前年度比 +887億円）",
    文章根拠要約: "防衛システム事業、FAシステム事業、ライフ部門の拡大により、売上高・調整後営業利益とも過去最高を更新する見通し。中東情勢影響は原材料・物流費高騰として織り込み。",
    判定: "補強候補B",
    入力CSV反映: "反映しない",
    反映しない理由: "会社予想は有用だが、全社見通しであり個別テーマ寄与をさらに分ける必要がある。",
    次作業: "会社予想の裏付け欄へ、FA・防衛・ライフの拡大と中東コスト織り込みを記録する。",
  },
  {
    ticker: "8035.T",
    銘柄: "東京エレクトロン",
    根拠分類: "市場見通し",
    テーマ: "WFE市場・先端半導体投資",
    公式資料: "2026年3月期 決算説明会資料",
    資料日付: "2026/04/30",
    URL: "https://www.tel.co.jp/ir/library/report/jngpc500000000l6-att/fy26q4presentations-j.pdf",
    数値根拠: "CY2026〜2027 WFE市場見通し: 1500〜1700億ドル/年、CY2025比 +20%以上。先端デバイス向けは +30%以上。",
    文章根拠要約: "WFE市場は2026〜2027年に拡大想定。ただし地政学的リスクは要注視。",
    判定: "補強候補A",
    入力CSV反映: "反映しない",
    反映しない理由: "市場見通しは補強材料だが、株価基準日・高PER説明・6月イベント後の半導体指数確認が必要。",
    次作業: "受注または市場見通し欄へ、WFE市場と先端デバイス需要の数値を転記候補にする。",
  },
  {
    ticker: "8035.T",
    銘柄: "東京エレクトロン",
    根拠分類: "製品別成長ドライバー",
    テーマ: "塗布現像・エッチング・先端パッケージング",
    公式資料: "2026年3月期 決算説明会資料",
    資料日付: "2026/04/30",
    URL: "https://www.tel.co.jp/ir/library/report/jngpc500000000l6-att/fy26q4presentations-j.pdf",
    数値根拠: "塗布・現像はマーケットシェア90%以上、FY2027売上 YoY +50%以上。エッチングは絶縁膜エッチングでシェア50%以上、FY2027売上 YoY +25%以上。先端パッケージングはFY2026売上実績 約2,000億円、FY2027売上 YoY +60%以上。",
    文章根拠要約: "DRAM、先端ロジック、HBM、アドバンストパッケージングなどの投資機会を捉える説明がある。",
    判定: "補強候補A",
    入力CSV反映: "反映しない",
    反映しない理由: "高PERを説明する材料候補だが、入力前に該当ページの目視確認と要約が必要。",
    次作業: "高PER説明欄へ、製品別シェアとFY2027成長見通しを要約入力候補にする。",
  },
  {
    ticker: "8035.T",
    銘柄: "東京エレクトロン",
    根拠分類: "会社予想",
    テーマ: "AIサーバー需要・FY2027上期",
    公式資料: "2026年3月期 決算説明会資料",
    資料日付: "2026/04/30",
    URL: "https://www.tel.co.jp/ir/library/report/jngpc500000000l6-att/fy26q4presentations-j.pdf",
    数値根拠: "FY2027上期予想: 売上高 1兆5,700億円、営業利益 4,310億円、営業利益率 27.5%。SPE新規売上は前年同期比 +41%。",
    文章根拠要約: "AIサーバー向け需要が牽引し、過去最高の売上高・売上総利益・営業利益を見込む。2026年後半にかけてDRAM・先端ロジック中心に出荷増加。ただしホルムズ海峡封鎖の影響は要注視。",
    判定: "補強候補A-リスク付き",
    入力CSV反映: "反映しない",
    反映しない理由: "強い根拠候補だが、地政学リスクと高PERのため、小口候補化は6月イベント後の指数確認が必要。",
    次作業: "高PER説明・市場見通し欄へ、AIサーバー需要とホルムズ海峡リスクをセットで記録する。",
  },
];

const summaryRows = [
  { 項目: "公式資料確認", 値: "2社", 判定: "証拠候補あり", メモ: "三菱電機、東京エレクトロンの決算説明資料で事業寄与の候補を確認。" },
  { 項目: "証拠候補", 値: `${evidenceRows.length}件`, 判定: "作成済み", メモ: "実績、会社予想、市場見通し、製品別成長ドライバーに分類。" },
  { 項目: "入力CSV反映", 値: "0件", 判定: "反映しない", メモ: "目視確認と入力フォーム更新前のため。" },
  { 項目: "P1復帰可能", 値: "0社", 判定: "不可", メモ: "この段階では証拠候補。公式確認済み入力とイベント後判定が必要。" },
  { 項目: "買付上限", 値: "0円", 判定: "維持", メモ: "事業寄与の候補が取れても、購入判断にはまだ進めない。" },
];

function statusClass(value) {
  const text = String(value ?? "");
  if (/0円|不可|反映しない|要注視|リスク|まだ進めない/.test(text)) return "bad";
  if (/候補|確認|小口|必要|補強候補B/.test(text)) return "warn";
  if (/補強候補A|証拠候補あり|作成済み/.test(text)) return "ok";
  return "";
}

function table(rows, columns) {
  return `<div class="table-wrap"><table><thead><tr>${columns.map((column) => `<th>${h(column.label)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((column) => {
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
  <title>P1 受注・セグメント寄与 証拠候補</title>
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
  <h1>P1 受注・セグメント寄与 証拠候補</h1>
  <p>三菱電機・東京エレクトロンについて、テーマ性が売上・利益・受注・市場見通しに接続しているかを公式資料から整理した画面です。</p>
</header>
<main>
  <section>
    <h2>結論</h2>
    <p class="notice">事業寄与の証拠候補は取れました。ただし、まだ入力CSVへは反映せず、P1復帰可能0社・買付上限0円を維持します。</p>
    <div class="cards">
      ${card("証拠候補", `${evidenceRows.length}件`, "公式決算説明資料から整理", "ok")}
      ${card("入力反映", "0件", "目視確認・転記前", "bad")}
      ${card("P1復帰", "0社", "まだ不可", "bad")}
      ${card("買付上限", "0円", "維持", "bad")}
    </div>
  </section>

  <section>
    <h2>確認導線</h2>
    <div class="links">
      <a href="index.html">ホーム</a>
      <a href="latest_practical_start_20260614.html">最新 実用パート入口</a>
      <a href="p1_segment_order_queue_20260615.html">受注・セグメント確認キュー</a>
      <a href="p1_financial_per_pbr_basis_20260615.html">PER/PBR計算候補</a>
      <a href="p1_financial_input_validator_20260614.html">入力バリデーター</a>
    </div>
  </section>

  <section>
    <h2>全体サマリー</h2>
    ${table(summaryRows, [
      { key: "項目", label: "項目" },
      { key: "値", label: "値" },
      { key: "判定", label: "判定" },
      { key: "メモ", label: "メモ" },
    ])}
  </section>

  <section>
    <h2>証拠候補一覧</h2>
    ${table(evidenceRows, [
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "根拠分類", label: "根拠分類" },
      { key: "テーマ", label: "テーマ" },
      { key: "数値根拠", label: "数値根拠" },
      { key: "文章根拠要約", label: "文章根拠要約" },
      { key: "判定", label: "判定" },
      { key: "入力CSV反映", label: "入力CSV反映" },
      { key: "反映しない理由", label: "反映しない理由" },
      { key: "次作業", label: "次作業" },
      { key: "公式資料", label: "公式資料" },
      { key: "資料日付", label: "資料日付" },
      { key: "URL", label: "URL", link: true },
    ])}
  </section>

  <section>
    <h2>次の扱い</h2>
    <ul>
      <li>この画面の数値は、候補復帰の材料候補であり、まだ購入判断ではない。</li>
      <li>入力フォームへ反映する場合は、資料日付、URL、対象ページ、入力状態をそろえる。</li>
      <li>東京エレクトロンは根拠が強い一方、高PER・高PBR・地政学リスクがあるため、6月イベント後の指数確認を必須にする。</li>
      <li>三菱電機はエネルギー・FAの事業寄与が見えるが、最終的にはPER/PBR、口座、イベントゲートと合わせて判定する。</li>
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
  insertOnce("index.html", "p1_segment_order_queue_20260615.html", `<a class="card" href="${htmlFile}">
          <b>P1 受注・セグメント寄与 証拠候補</b>
          <span>公式決算説明資料から、テーマが売上・利益・受注・市場見通しに接続しているかを整理する。</span>
        </a>`);

  insertOnce("latest_practical_start_20260614.html", "p1_segment_order_queue_20260615.html", `<a class="step" href="${htmlFile}">
        <b>6-12j. P1 受注・セグメント寄与 証拠候補</b>
        <span>三菱電機と東京エレクトロンの事業寄与候補を、公式資料ベースで確認する。</span>
        <em>証拠候補</em>
      </a>`);

  insertOnce("daily_practical_compact_board_20260614.html", "p1_segment_order_queue_20260615.html", `<a href="${htmlFile}">P1 受注・セグメント寄与 証拠候補</a>`);
}

function main() {
  writeCsv(detailCsv, evidenceRows);
  writeCsv(summaryCsv, summaryRows);
  writeHtml();
  updateNavigation();
  console.log(JSON.stringify({ htmlFile, detailCsv, summaryCsv, evidenceRows: evidenceRows.length, buyLimit: "0円" }, null, 2));
}

main();
