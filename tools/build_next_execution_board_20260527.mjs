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

const currentDate = "2026-05-27";
const jpMarketHolidays2026 = new Set([
  "2026-01-01",
  "2026-01-12",
  "2026-02-11",
  "2026-02-23",
  "2026-03-20",
  "2026-04-29",
  "2026-05-04",
  "2026-05-05",
  "2026-05-06",
  "2026-07-20",
  "2026-08-11",
  "2026-09-21",
  "2026-09-22",
  "2026-09-23",
  "2026-10-12",
  "2026-11-03",
  "2026-11-23",
]);

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

function addBusinessDays(dateText, businessDays) {
  const d = new Date(`${dateText}T00:00:00+09:00`);
  let added = 0;
  while (added < businessDays) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const date = String(d.getDate()).padStart(2, "0");
    const key = `${y}-${m}-${date}`;
    if (day !== 0 && day !== 6 && !jpMarketHolidays2026.has(key)) added += 1;
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function dateCompare(a, b) {
  return new Date(`${a}T00:00:00+09:00`).getTime() - new Date(`${b}T00:00:00+09:00`).getTime();
}

const candidates = [
  {
    rank: 1,
    ticker: "8316.T",
    name: "三井住友FG",
    bucket: "中心確認",
    score: 64.1,
    data: "10/10",
    per: "13.40倍",
    pbr: "1.44倍",
    roe: "10.38%",
    sector: "銀行",
    next: "日銀会合後に銀行株全体が崩れていないか、信用コスト悪化が出ていないかを確認する。",
  },
  {
    rank: 2,
    ticker: "2802.T",
    name: "味の素",
    bucket: "追加確認付き中心",
    score: 66.4,
    data: "10/10",
    per: "42.38倍",
    pbr: "6.60倍",
    roe: "17.75%",
    sector: "食品・ヘルスケア",
    next: "高PERと高PBRを、利益成長と決算後反応で説明できるかを確認する。",
  },
  {
    rank: 3,
    ticker: "6762.T",
    name: "TDK",
    bucket: "追加確認付き中心",
    score: 63.2,
    data: "10/10",
    per: "31.22倍",
    pbr: "3.21倍",
    roe: "9.81%",
    sector: "電子部品・半導体周辺",
    next: "SOX、NASDAQ、円高影響、AI関連需要の継続を確認する。",
  },
  {
    rank: 4,
    ticker: "8053.T",
    name: "住友商事",
    bucket: "追加確認付き中心",
    score: 60.8,
    data: "10/10",
    per: "13.73倍",
    pbr: "1.87倍",
    roe: "12.94%",
    sector: "商社・資源",
    next: "資源価格、為替、株主還元姿勢が維持されているかを確認する。",
  },
  {
    rank: 5,
    ticker: "8306.T",
    name: "三菱UFJ FG",
    bucket: "条件付き確認",
    score: 54.4,
    data: "9/10",
    per: "補助値17.00倍",
    pbr: "1.54倍",
    roe: "11.34%",
    sector: "銀行",
    next: "実績EPSベースのPER補助値は作成済み。予想PER/実績PERの種別をそろえ、三井住友FGとの比較で割高・割安を確認する。",
  },
  {
    rank: 6,
    ticker: "7173.T",
    name: "東京きらぼしFG",
    bucket: "監視",
    score: 66.4,
    data: "10/10",
    per: "8.83倍",
    pbr: "0.96倍",
    roe: "10.66%",
    sector: "地方銀行",
    next: "決算後反応が弱いため、銀行テーマ全体の改善があるかを確認する。",
  },
  {
    rank: 7,
    ticker: "9984.T",
    name: "ソフトバンクG",
    bucket: "監視",
    score: 61.8,
    data: "9/10",
    per: "未取得",
    pbr: "2.45倍",
    roe: "34.28%",
    sector: "投資会社・AI関連",
    next: "PERよりもNAV、保有株価値、Arm評価、AI関連株の下落耐性、過熱感を確認する。",
  },
  {
    rank: 8,
    ticker: "7735.T",
    name: "SCREEN HD",
    bucket: "監視",
    score: 49.1,
    data: "10/10",
    per: "19.65倍",
    pbr: "4.44倍",
    roe: "20.28%",
    sector: "半導体製造装置",
    next: "利益成長のマイナス要因、SOX連動、決算後5日反応の弱さを確認する。",
  },
  {
    rank: 9,
    ticker: "6146.T",
    name: "ディスコ",
    bucket: "監視",
    score: 46.2,
    data: "9/10",
    per: "補助値61.44倍",
    pbr: "12.74倍",
    roe: "25.15%",
    sector: "半導体製造装置",
    next: "実績EPSベースのPER補助値は作成済み。予想PER/実績PERの種別をそろえ、高PBRを受注・利益率・決算後反応で説明できるかを確認する。",
  },
  {
    rank: 10,
    ticker: "7011.T",
    name: "三菱重工業",
    bucket: "監視",
    score: 35.9,
    data: "10/10",
    per: "34.29倍",
    pbr: "4.22倍",
    roe: "12.22%",
    sector: "重工・防衛",
    next: "60日最大下落と200日線割れの有無、防衛テーマの再評価を確認する。",
  },
];

const reactionRows = [
  { ticker: "2802.T", name: "味の素", eventDate: "2026-05-07", excess1d: 1.64, excess5d: 12.07, score: 65.8 },
  { ticker: "6762.T", name: "TDK", eventDate: "2026-04-28", excess1d: 9.03, excess5d: 5.5, score: 63.8 },
  { ticker: "6146.T", name: "ディスコ", eventDate: "2026-04-24", excess1d: 4.66, excess5d: 1.6, score: 55.6 },
  { ticker: "7011.T", name: "三菱重工業", eventDate: "2026-05-12", excess1d: 1.62, excess5d: -0.55, score: 50.6 },
  { ticker: "8053.T", name: "住友商事", eventDate: "2026-05-01", excess1d: 2.61, excess5d: 6.24, score: 59.6 },
  { ticker: "9984.T", name: "ソフトバンクG", eventDate: "2026-05-11", excess1d: 3.73, excess5d: -0.05, score: 52.9 },
  { ticker: "8316.T", name: "三井住友FG", eventDate: "2026-05-13", excess1d: -2.05, excess5d: 5.99, score: 55.5 },
  { ticker: "8306.T", name: "三菱UFJ FG", eventDate: "2026-05-15", excess1d: 3.22, excess5d: 2.39, score: 55.4 },
  { ticker: "7735.T", name: "SCREEN HD", eventDate: "2026-05-13", excess1d: 9.8, excess5d: -0.49, score: 57.3 },
  { ticker: "7173.T", name: "東京きらぼしFG", eventDate: "2026-05-08", excess1d: -10.58, excess5d: -5.84, score: 34.5 },
].map((row) => {
  const dueDate = addBusinessDays(row.eventDate, 20);
  const status = dateCompare(dueDate, currentDate) <= 0 ? "確認可能" : "未到達";
  return {
    ...row,
    dueDate,
    status,
    note: status === "確認可能" ? "株価と日経平均/TOPIXを接続して20営業日反応を計算する。" : "到達日以降に20営業日反応を入力する。",
  };
});

const perFollowUp = candidates.filter((row) => row.per === "未取得" || row.per.includes("補助値"));
const missingPer = candidates.filter((row) => row.per === "未取得");

const summaryRows = [
  {
    項目: "明日最優先",
    件数: `${perFollowUp.length}社`,
    内容: "PER未取得または未接続の確認。2社は実績EPSベースの補助値あり、1社は別評価が必要。",
  },
  {
    項目: "20営業日反応",
    件数: `${reactionRows.length}社`,
    内容: "現時点では全社で20営業日反応を未反映。到達日ごとに追加計算する。",
  },
  {
    項目: "中心確認",
    件数: `${candidates.filter((row) => row.bucket.includes("中心")).length}社`,
    内容: "現時点で前面に出せる候補。ただし購入確定ではなく、6月イベント後に再判定する。",
  },
  {
    項目: "監視",
    件数: `${candidates.filter((row) => row.bucket === "監視").length}社`,
    内容: "テーマや個別材料はあるが、過熱、反応悪化、未取得指標を確認する。",
  },
];

const taskRows = [
  {
    優先: 1,
    作業: "PER未取得・未接続の補完",
    対象: perFollowUp.map((row) => `${row.ticker} ${row.name}`).join(" / "),
    取得先: "証券会社画面、J-Quants、会社IRのEPSと株価による確認",
    使い道: "割高判定、業種別比較、保留/外す条件",
    目安: "5/28午前",
    完了条件: "未取得または未接続のまま点数に混ぜず、取得値、補助値、代替評価の根拠を分けて記録する。",
  },
  {
    優先: 2,
    作業: "20営業日反応の到達確認",
    対象: "10社すべて",
    取得先: "株価時系列、日経平均/TOPIXの時系列",
    使い道: "決算後反応スコア、残す/保留/外すの再判定",
    目安: "到達日順",
    完了条件: "1日、5日、20営業日の超過リターンを同じ式で計算する。",
  },
  {
    優先: 3,
    作業: "業種別比較",
    対象: "銀行、半導体製造装置、電子部品、商社、食品、重工",
    取得先: "同業のPER/PBR/ROE、指数、決算後反応",
    使い道: "PER/PBR/ROEを全業種一律に比べる弱点を下げる。",
    目安: "5/28午後",
    完了条件: "同業内の順位と、業種平均からの乖離を候補表に追加する。",
  },
  {
    優先: 4,
    作業: "6月市場ゲート入力準備",
    対象: "米CPI、FOMC、日銀、米10年金利、ドル円、VIX、日経平均/TOPIX 75日線",
    取得先: "FRED、日銀、FRB、Yahoo Finance等",
    使い道: "市場全体が追い風か逆風かを判定する。",
    目安: "6月イベント前後",
    完了条件: "市場ゲートが悪化なら候補数や投入比率を下げる判断に接続する。",
  },
  {
    優先: 5,
    作業: "候補10社の説明更新",
    対象: "中心確認、追加確認付き中心、条件付き確認、監視の全候補",
    取得先: "補完済みデータと再判定シート",
    使い道: "なぜ候補に残すか、なぜ保留するかを数字で説明する。",
    目安: "5/28夕方",
    完了条件: "各社に、量的根拠、質的確認条件、除外条件、6月確認項目を1行で入れる。",
  },
];

const missingRows = perFollowUp.map((row) => ({
  銘柄: `${row.ticker} ${row.name}`,
  不足項目: row.per === "未取得" ? "PER" : "比較PERへの接続",
  現在の扱い: row.per === "未取得" ? "未取得として扱い、購入候補スコアには直接混ぜない。" : `${row.per}は説明補助値として扱い、購入候補スコアには直接混ぜない。`,
  補完方法: row.per === "未取得" ? "EPS実績/予想と株価、または証券会社画面のPERを確認する。" : "予想PER/実績PERの種別を確認し、同業比較に接続する。",
  影響: "割高判定と業種別比較の精度に影響する。",
}));

const reactionDueRows = reactionRows
  .sort((a, b) => dateCompare(a.dueDate, b.dueDate))
  .map((row) => ({
    銘柄: `${row.ticker} ${row.name}`,
    決算日: row.eventDate,
    "1日超過": `${row.excess1d}%`,
    "5日超過": `${row.excess5d}%`,
    "現反応点": `${row.score}点`,
    "20営業日目安": row.dueDate,
    状態: row.status,
    次作業: row.note,
  }));

const sectorRows = [
  {
    業種: "銀行",
    対象: "8316 三井住友FG / 8306 三菱UFJ FG / 7173 東京きらぼしFG",
    見る指標: "PER、PBR、ROE、利ざや、信用コスト、日銀後反応",
    判定の考え方: "金利上昇メリットが残り、日銀後に銀行株全体が崩れなければ候補維持。信用コスト悪化なら保留。",
  },
  {
    業種: "半導体製造装置・電子部品",
    対象: "6762 TDK / 6146 ディスコ / 7735 SCREEN HD",
    見る指標: "SOX、NASDAQ、PER/PBR、受注、利益率、決算後反応",
    判定の考え方: "AI需要があっても高PER・高PBRを利益成長で説明できない場合は保留または監視。",
  },
  {
    業種: "商社・資源",
    対象: "8053 住友商事",
    見る指標: "資源価格、為替、株主還元、決算後反応",
    判定の考え方: "資源・為替・還元姿勢が崩れない場合は分散候補。商品市況悪化なら保留。",
  },
  {
    業種: "食品・ヘルスケア",
    対象: "2802 味の素",
    見る指標: "PER、PBR、ROE、利益成長、ABF/ヘルスケア、決算後反応",
    判定の考え方: "高PERを利益成長と決算後反応で説明できる場合のみ中心候補に残す。",
  },
  {
    業種: "重工・防衛",
    対象: "7011 三菱重工業",
    見る指標: "60日最大下落、200日線、PER、受注、防衛テーマ",
    判定の考え方: "テーマ性よりも直近下落と過熱解消を優先。反発確認前は監視。",
  },
];

const doneRows = [
  { 完了条件: "PER未取得3社の補完", 判定: "取得値または代替評価を記録し、未取得のままスコアに混ぜない。" },
  { 完了条件: "20営業日反応の反映", 判定: "到達済み銘柄から順に、指数超過リターンを追加する。" },
  { 完了条件: "業種別比較の追加", 判定: "PER/PBR/ROEを業種内で比較し、業種差による誤判定を減らす。" },
  { 完了条件: "6月市場ゲートの入力", 判定: "CPI、日銀、FOMC、金利、為替、指数の状態を入力し、再判定する。" },
  { 完了条件: "候補10社の最終更新", 判定: "残す、保留、外すを数字と確認条件で説明する。" },
];

write("686_next_execution_summary.csv", toCsv(summaryRows.map((row) => ({ 作成: generatedAt, ...row }))));
write("687_next_execution_task_board.csv", toCsv(taskRows.map((row) => ({ 作成: generatedAt, ...row }))));
write("688_missing_data_by_ticker.csv", toCsv(missingRows.map((row) => ({ 作成: generatedAt, ...row }))));
write("689_reaction_20d_due_board.csv", toCsv(reactionDueRows.map((row) => ({ 作成: generatedAt, ...row }))));
write("690_sector_comparison_plan.csv", toCsv(sectorRows.map((row) => ({ 作成: generatedAt, ...row }))));
write("691_next_execution_done_definition.csv", toCsv(doneRows.map((row) => ({ 作成: generatedAt, ...row }))));

function table(rows, cls = "") {
  const header = Object.keys(rows[0] ?? {});
  return `<div class="table-wrap ${cls}"><table><thead><tr>${header.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${header.map((h) => `<td>${esc(row[h])}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

function badge(label) {
  if (label.includes("中心")) return "good";
  if (label.includes("条件")) return "warn";
  if (label.includes("確認可能")) return "blue";
  if (label.includes("未取得") || label.includes("未到達")) return "muted";
  return "plain";
}

const candidateCards = candidates.map((row) => `<article class="candidate-card">
  <div class="candidate-top">
    <span class="rank">${row.rank}</span>
    <span class="pill ${badge(row.bucket)}">${esc(row.bucket)}</span>
  </div>
  <h3>${esc(row.ticker)} ${esc(row.name)}</h3>
  <dl>
    <div><dt>補正後</dt><dd>${esc(row.score)}点</dd></div>
    <div><dt>PER</dt><dd>${esc(row.per)}</dd></div>
    <div><dt>PBR</dt><dd>${esc(row.pbr)}</dd></div>
    <div><dt>ROE</dt><dd>${esc(row.roe)}</dd></div>
  </dl>
  <p>${esc(row.next)}</p>
</article>`).join("");

const reactionCards = reactionDueRows.map((row) => `<article class="mini-card">
  <div class="mini-title">${esc(row["20営業日目安"])} <span class="pill ${badge(row.状態)}">${esc(row.状態)}</span></div>
  <strong>${esc(row.銘柄)}</strong>
  <p>1日超過 ${esc(row["1日超過"])} / 5日超過 ${esc(row["5日超過"])} / 現反応点 ${esc(row["現反応点"])}</p>
</article>`).join("");

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>明日以降 実行ボード</title>
  <style>
    :root {
      --ink:#071d33;
      --muted:#2f4356;
      --navy:#082f53;
      --blue:#0b5e94;
      --line:#c7dceb;
      --bg:#f5f8fb;
      --soft:#eef7ff;
      --green:#087a55;
      --orange:#b45f06;
      --red:#b42318;
      --gray:#5f6f7f;
    }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",Arial,sans-serif; line-height:1.75; }
    header { background:linear-gradient(135deg,#082f53,#0b5e94); color:#fff; padding:34px 36px; }
    header h1 { margin:0 0 8px; font-size:clamp(28px,4vw,42px); line-height:1.2; letter-spacing:0; }
    header p { margin:0; color:#fff; font-weight:800; max-width:1000px; }
    main { max-width:1240px; margin:0 auto; padding:22px; }
    section { background:#fff; border:1px solid var(--line); border-radius:12px; padding:20px; margin:0 0 18px; box-shadow:0 8px 20px rgba(20,60,90,.08); break-inside:avoid; page-break-inside:avoid; }
    h2 { margin:0 0 12px; border-left:8px solid var(--blue); padding-left:12px; font-size:23px; line-height:1.35; color:#061d33; }
    h3 { margin:0 0 8px; font-size:18px; color:#06395b; line-height:1.4; }
    p { color:#111; }
    .lead { font-weight:800; font-size:17px; margin:0; color:#111; }
    .summary-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-top:14px; }
    .summary-card { border:1px solid var(--line); border-radius:10px; padding:14px; background:#fbfdff; min-height:128px; }
    .summary-card strong { display:block; font-size:15px; color:#06395b; }
    .summary-card .num { font-size:32px; line-height:1.1; font-weight:900; color:#082f53; margin:6px 0; }
    .summary-card p { margin:0; font-size:13px; }
    .flow { display:grid; grid-template-columns:repeat(5,minmax(0,1fr)); gap:10px; align-items:stretch; }
    .step { border:2px solid #b7d4e8; background:#f8fcff; border-radius:10px; padding:12px; position:relative; min-height:130px; }
    .step:not(:last-child)::after { content:""; position:absolute; right:-10px; top:50%; transform:translateY(-50%); border-left:10px solid #0b5e94; border-top:9px solid transparent; border-bottom:9px solid transparent; }
    .step b { display:block; color:#06395b; margin-bottom:6px; }
    .step p { margin:0; font-size:13px; }
    .candidates { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
    .candidate-card, .mini-card { border:1px solid var(--line); border-radius:10px; background:#fbfdff; padding:14px; break-inside:avoid; }
    .candidate-top { display:flex; justify-content:space-between; gap:8px; align-items:center; margin-bottom:8px; }
    .rank { display:inline-grid; place-items:center; width:32px; height:32px; border-radius:50%; background:#082f53; color:#fff; font-weight:900; }
    .pill { display:inline-block; padding:3px 9px; border-radius:999px; font-size:12px; font-weight:900; border:1px solid var(--line); background:#fff; color:#111; }
    .pill.good { background:#e9f8f2; color:#087a55; border-color:#9bd1be; }
    .pill.warn { background:#fff4df; color:#9a5205; border-color:#efc98e; }
    .pill.blue { background:#e8f4ff; color:#075985; border-color:#9fc7e7; }
    .pill.muted { background:#f1f5f9; color:#334155; border-color:#cbd5e1; }
    dl { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:6px; margin:8px 0 10px; }
    dt { font-size:11px; color:#3c5268; font-weight:900; }
    dd { margin:0; font-weight:900; color:#061d33; }
    .candidate-card p, .mini-card p { margin:0; font-size:13px; }
    .mini-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px; }
    .mini-title { display:flex; justify-content:space-between; gap:8px; align-items:center; margin-bottom:6px; font-weight:900; color:#06395b; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; min-width:1080px; font-size:13px; background:#fff; }
    th, td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:8px; vertical-align:top; overflow-wrap:anywhere; word-break:break-word; color:#111; }
    th { background:#e7f1fa; color:#06395b; text-align:left; font-weight:900; }
    .narrow table { min-width:840px; }
    .note { background:#fff8ec; border:1px solid #efc98e; border-radius:10px; padding:12px 14px; color:#111; font-weight:800; }
    .links a { display:inline-block; margin:4px 8px 4px 0; padding:9px 12px; border:1px solid #8bb9d6; border-radius:8px; color:#064f79; text-decoration:none; background:#fff; font-weight:900; }
    @media (max-width:940px){
      header{padding:24px 18px;}
      main{padding:12px;}
      .summary-grid,.flow,.candidates,.mini-grid{grid-template-columns:1fr;}
      .step:not(:last-child)::after{display:none;}
      dl{grid-template-columns:repeat(2,minmax(0,1fr));}
      table{font-size:12px;}
    }
    @media print {
      body { background:#fff; }
      main { max-width:none; padding:10mm; }
      section { box-shadow:none; }
      a { color:#064f79; text-decoration:none; }
    }
  </style>
</head>
<body>
  <header>
    <h1>明日以降 実行ボード</h1>
    <p>作成: ${esc(generatedAt)} / 16:00報告後の実務を、PER補完、20営業日反応、業種別比較、6月市場ゲートに分けて処理するための作業表です。</p>
  </header>
  <main>
    <section>
      <h2>1. このボードの目的</h2>
      <p class="lead">NISA 1年保有テストに向けて、候補10社を購入確定ではなく「6月イベント後に再判定できる状態」へ進める。</p>
      <div class="summary-grid">
        ${summaryRows.map((row) => `<div class="summary-card"><strong>${esc(row.項目)}</strong><div class="num">${esc(row.件数)}</div><p>${esc(row.内容)}</p></div>`).join("")}
      </div>
    </section>

    <section>
      <h2>2. 作業の流れ</h2>
      <div class="flow">
      <div class="step"><b>1. 不足値を埋める</b><p>PER未取得・未接続3社を先に確認し、未接続のまま点数に混ぜない。</p></div>
        <div class="step"><b>2. 反応を計算する</b><p>決算後1日、5日、20営業日の指数超過リターンを同じ式で見る。</p></div>
        <div class="step"><b>3. 業種内で比べる</b><p>PER/PBR/ROEを全業種一律ではなく、同業比較に直す。</p></div>
        <div class="step"><b>4. 6月市場ゲート</b><p>CPI、日銀、FOMC、金利、為替、指数を入力する。</p></div>
        <div class="step"><b>5. 再判定</b><p>残す、保留、外すを数字と条件で更新する。</p></div>
      </div>
    </section>

    <section>
      <h2>3. 現在の10社と明日の確認点</h2>
      <div class="candidates">${candidateCards}</div>
    </section>

    <section>
      <h2>4. 明日の作業ボード</h2>
      ${table(taskRows)}
    </section>

    <section>
      <h2>5. PER未取得・未接続の補完対象</h2>
      ${table(missingRows, "narrow")}
    </section>

    <section>
      <h2>6. 20営業日反応の確認日</h2>
      <div class="note">20営業日は日本市場の主な休場日を除いて計算しています。臨時休場や銘柄ごとの取引停止がある場合は、実計算時に取引日カレンダーで再確認します。</div>
      <div class="mini-grid" style="margin-top:12px">${reactionCards}</div>
      <div style="margin-top:12px">${table(reactionDueRows)}</div>
    </section>

    <section>
      <h2>7. 業種別比較の設計</h2>
      ${table(sectorRows)}
    </section>

    <section>
      <h2>8. 完了条件</h2>
      ${table(doneRows, "narrow")}
    </section>

    <section>
      <h2>9. 関連資料</h2>
      <div class="links">
        <a href="final_report_1600_20260527.html">本日報告 16:00版 HTML</a>
        <a href="final_report_1600_20260527.pdf">本日報告 16:00版 PDF</a>
        <a href="oral_briefing_1600_20260527.html">16:00説明用スクリプト</a>
        <a href="june_event_recheck_sheet_20260527.html">6月イベント後 再判定シート</a>
        <a href="june_recheck_input_criteria_20260527.html">6月再判定 入力基準表</a>
        <a href="per_completion_update_20260527.html">PER補完進捗</a>
        <a href="686_next_execution_summary.csv">概要CSV</a>
        <a href="687_next_execution_task_board.csv">作業CSV</a>
        <a href="688_missing_data_by_ticker.csv">不足CSV</a>
        <a href="689_reaction_20d_due_board.csv">20営業日CSV</a>
        <a href="690_sector_comparison_plan.csv">業種比較CSV</a>
      </div>
    </section>
  </main>
</body>
</html>`;

write("next_execution_board_20260527.html", html);

console.log(JSON.stringify({
  generatedAt,
  output: "next_execution_board_20260527.html",
  tasks: taskRows.length,
  candidates: candidates.length,
  perFollowUp: missingRows.length,
  reactionDue: reactionDueRows.length,
}, null, 2));
