import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const generatedAt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date());

function write(file, text) {
  fs.writeFileSync(path.join(root, file), text, "utf8");
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows) {
  const header = Object.keys(rows[0] ?? {});
  return `${header.join(",")}\n${rows.map((row) => header.map((h) => csvEscape(row[h])).join(",")).join("\n")}\n`;
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));
}

const rows = [
  { date: "2026-05-28", ticker: "6146.T", name: "ディスコ", eventDate: "2026-04-24", excess1d: "4.66%", excess5d: "1.60%", currentScore: "55.6点", action: "最初の20営業日確認。株価と日経平均/TOPIXを接続して反応を更新する。" },
  { date: "2026-06-01", ticker: "6762.T", name: "TDK", eventDate: "2026-04-28", excess1d: "9.03%", excess5d: "5.50%", currentScore: "63.8点", action: "20営業日反応を確認。SOX/NASDAQの同時悪化がないかも見る。" },
  { date: "2026-06-03", ticker: "8053.T", name: "住友商事", eventDate: "2026-05-01", excess1d: "2.61%", excess5d: "6.24%", currentScore: "59.6点", action: "商社・資源テーマの持続性と、株主還元評価が続くか確認する。" },
  { date: "2026-06-04", ticker: "2802.T", name: "味の素", eventDate: "2026-05-07", excess1d: "1.64%", excess5d: "12.07%", currentScore: "65.8点", action: "5日反応が強いため、20営業日でも日経平均/TOPIXを上回るか確認する。" },
  { date: "2026-06-05", ticker: "7173.T", name: "東京きらぼしFG", eventDate: "2026-05-08", excess1d: "-10.58%", excess5d: "-5.84%", currentScore: "34.5点", action: "反応悪化の回復有無を確認。改善がなければ監視継続または外す候補。" },
  { date: "2026-06-08", ticker: "9984.T", name: "ソフトバンクG", eventDate: "2026-05-11", excess1d: "3.73%", excess5d: "-0.05%", currentScore: "52.9点", action: "AI関連株と投資先評価の変動を確認。PERではなくNAV型の扱いを継続する。" },
  { date: "2026-06-09", ticker: "7011.T", name: "三菱重工業", eventDate: "2026-05-12", excess1d: "1.62%", excess5d: "-0.55%", currentScore: "50.6点", action: "防衛・重工テーマより、直近下落と200日線の回復を優先確認する。" },
  { date: "2026-06-10", ticker: "8316.T", name: "三井住友FG", eventDate: "2026-05-13", excess1d: "-2.05%", excess5d: "5.99%", currentScore: "55.5点", action: "CPI直後の金利反応と、銀行株全体の崩れがないかを確認する。" },
  { date: "2026-06-10", ticker: "7735.T", name: "SCREEN HD", eventDate: "2026-05-13", excess1d: "9.80%", excess5d: "-0.49%", currentScore: "57.3点", action: "1日反応後に失速しているため、20営業日で持ち直すか確認する。" },
  { date: "2026-06-12", ticker: "8306.T", name: "三菱UFJ FG", eventDate: "2026-05-15", excess1d: "3.22%", excess5d: "2.39%", currentScore: "55.4点", action: "日銀前の銀行株反応を確認。三井住友FGとの比較に接続する。" },
];

const calendarRows = rows.map((row, index) => ({
  順番: index + 1,
  確認日: row.date,
  銘柄: `${row.ticker} ${row.name}`,
  決算日: row.eventDate,
  "1日超過": row.excess1d,
  "5日超過": row.excess5d,
  現反応点: row.currentScore,
  作業: row.action,
}));

const summaryRows = [
  { 項目: "修正内容", 内容: "20営業日到達日を、土日だけでなく2026年の主な日本市場休場日も除いて再計算した。" },
  { 項目: "最初の確認日", 内容: "ディスコは2026年5月28日、TDKは2026年6月1日。" },
  { 項目: "使い方", 内容: "確認日に株価と日経平均/TOPIXを接続し、20営業日超過リターンを追加する。" },
  { 項目: "注意点", 内容: "臨時休場、取引停止、データ取得時点の差は別途確認する。" },
];

const ruleRows = [
  { ルール: "20営業日反応 = 個別株20営業日リターン - 指数20営業日リターン", 理由: "市場全体が上がっただけか、個別が強かったかを分けるため。" },
  { ルール: "20営業日未到達の銘柄は、反応点を暫定扱いにする", 理由: "1日/5日反応だけで1年保有候補を強く評価しすぎないため。" },
  { ルール: "1日が強く5日が弱い銘柄は警戒を付ける", 理由: "決算直後の期待だけで、その後に売られている可能性があるため。" },
  { ルール: "20営業日でも指数超過がプラスなら、決算後反応を候補維持の根拠にできる", 理由: "決算後に市場平均を上回る持続性が確認できるため。" },
];

write("695_reaction_20d_calendar_summary.csv", toCsv(summaryRows.map((row) => ({ 作成: generatedAt, ...row }))));
write("696_reaction_20d_calendar_detail.csv", toCsv(calendarRows.map((row) => ({ 作成: generatedAt, ...row }))));
write("697_reaction_20d_calendar_rules.csv", toCsv(ruleRows.map((row) => ({ 作成: generatedAt, ...row }))));

function table(rows, cls = "") {
  const header = Object.keys(rows[0] ?? {});
  return `<div class="table-wrap ${cls}"><table><thead><tr>${header.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${header.map((h) => `<td>${esc(row[h])}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

const grouped = rows.reduce((acc, row) => {
  if (!acc.has(row.date)) acc.set(row.date, []);
  acc.get(row.date).push(row);
  return acc;
}, new Map());

const dateCards = [...grouped.entries()].map(([date, items]) => `<article class="date-card">
  <div class="date">${esc(date)}</div>
  ${items.map((item) => `<div class="ticker-row"><strong>${esc(item.ticker)} ${esc(item.name)}</strong><span>${esc(item.currentScore)}</span><p>${esc(item.action)}</p></div>`).join("")}
</article>`).join("");

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>20営業日反応 確認カレンダー</title>
  <style>
    :root {
      --ink:#071d33;
      --navy:#082f53;
      --blue:#0b5e94;
      --line:#c7dceb;
      --bg:#f5f8fb;
      --soft:#eef7ff;
      --orange:#b45f06;
    }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",Arial,sans-serif; line-height:1.75; }
    header { background:linear-gradient(135deg,#082f53,#0b5e94); color:#fff; padding:34px; }
    header h1 { margin:0 0 8px; font-size:clamp(28px,4vw,42px); line-height:1.2; letter-spacing:0; }
    header p { margin:0; color:#fff; font-weight:800; max-width:1040px; }
    main { max-width:1220px; margin:0 auto; padding:22px; }
    section { background:#fff; border:1px solid var(--line); border-radius:12px; padding:20px; margin:0 0 18px; box-shadow:0 8px 20px rgba(20,60,90,.08); break-inside:avoid; page-break-inside:avoid; }
    h2 { margin:0 0 12px; border-left:8px solid var(--blue); padding-left:12px; font-size:23px; line-height:1.35; }
    p { color:#111; }
    .lead { font-size:17px; font-weight:900; margin:0; }
    .calendar { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
    .date-card { border:1px solid var(--line); border-radius:10px; background:#fbfdff; padding:14px; break-inside:avoid; }
    .date { display:inline-block; background:#082f53; color:#fff; font-weight:900; padding:5px 10px; border-radius:8px; margin-bottom:10px; }
    .ticker-row { border-top:1px solid var(--line); padding:9px 0 0; margin-top:9px; }
    .ticker-row:first-of-type { border-top:0; margin-top:0; }
    .ticker-row strong { color:#06395b; }
    .ticker-row span { float:right; font-weight:900; color:#0b5e94; }
    .ticker-row p { clear:both; margin:4px 0 0; font-size:13px; }
    .note { background:#fff8ec; border:1px solid #efc98e; border-radius:10px; padding:12px 14px; color:#111; font-weight:800; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; min-width:1080px; font-size:13px; background:#fff; }
    th, td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:8px; vertical-align:top; overflow-wrap:anywhere; word-break:break-word; color:#111; }
    th { background:#e7f1fa; color:#06395b; text-align:left; font-weight:900; }
    .links a { display:inline-block; margin:4px 8px 4px 0; padding:9px 12px; border:1px solid #8bb9d6; border-radius:8px; color:#064f79; text-decoration:none; background:#fff; font-weight:900; }
    @media (max-width:920px){ header{padding:24px 18px;} main{padding:12px;} .calendar{grid-template-columns:1fr;} table{font-size:12px;} }
  </style>
</head>
<body>
  <header>
    <h1>20営業日反応 確認カレンダー</h1>
    <p>作成: ${esc(generatedAt)} / 決算後反応を1日・5日だけで判断しないため、20営業日の確認日を日本市場休場日込みで整理しました。</p>
  </header>
  <main>
    <section>
      <h2>1. 目的</h2>
      <p class="lead">決算直後の一時的な反応ではなく、約1か月後も指数を上回っているかを確認し、6月の再判定に接続します。</p>
      <div class="note" style="margin-top:12px">前の目安は土日だけを除外していました。今回は2026年4月29日、5月4日、5月5日、5月6日などの日本市場休場日を反映しています。</div>
    </section>
    <section>
      <h2>2. 確認カレンダー</h2>
      <div class="calendar">${dateCards}</div>
    </section>
    <section>
      <h2>3. 詳細表</h2>
      ${table(calendarRows)}
    </section>
    <section>
      <h2>4. 計算ルール</h2>
      ${table(ruleRows)}
    </section>
    <section>
      <h2>5. 関連CSV</h2>
      <div class="links">
        <a href="695_reaction_20d_calendar_summary.csv">概要CSV</a>
        <a href="696_reaction_20d_calendar_detail.csv">詳細CSV</a>
        <a href="697_reaction_20d_calendar_rules.csv">ルールCSV</a>
        <a href="next_execution_board_20260527.html">明日以降 実行ボード</a>
      </div>
    </section>
  </main>
</body>
</html>`;

write("reaction_20d_calendar_20260527.html", html);

console.log(JSON.stringify({
  generatedAt,
  output: "reaction_20d_calendar_20260527.html",
  rows: rows.length,
  firstDate: rows[0].date,
}, null, 2));
