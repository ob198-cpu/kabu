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

const sourceRows = [
  { group: "銀行", ticker: "8316.T", name: "三井住友FG", status: "中心確認", per: 13.4, perType: "取得値", pbr: 1.44, roe: 10.38, note: "銀行中心候補。日銀後の銀行株全体と信用コストを確認。" },
  { group: "銀行", ticker: "8306.T", name: "三菱UFJ FG", status: "条件付き確認", per: 17.0, perType: "実績EPS補助値", pbr: 1.54, roe: 11.34, note: "PER補助値は実績EPSベース。種別確認後に比較へ正式接続。" },
  { group: "銀行", ticker: "7173.T", name: "東京きらぼしFG", status: "監視", per: 8.83, perType: "取得値", pbr: 0.96, roe: 10.66, note: "割安に見えるが決算後反応が弱く、回復確認が必要。" },
  { group: "半導体・電子部品", ticker: "6762.T", name: "TDK", status: "追加確認付き中心", per: 31.22, perType: "取得値", pbr: 3.21, roe: 9.81, note: "半導体周辺・電子部品。SOX/NASDAQとAI需要を確認。" },
  { group: "半導体・電子部品", ticker: "6146.T", name: "ディスコ", status: "監視", per: 61.44, perType: "実績EPS補助値", pbr: 12.74, roe: 25.15, note: "技術優位は強いが、PER/PBRが高く、受注・利益率で説明できるか確認。" },
  { group: "半導体・電子部品", ticker: "7735.T", name: "SCREEN HD", status: "監視", per: 19.65, perType: "取得値", pbr: 4.44, roe: 20.28, note: "1日反応は強いが5日反応が弱い。20営業日反応を確認。" },
  { group: "食品・ヘルスケア", ticker: "2802.T", name: "味の素", status: "追加確認付き中心", per: 42.38, perType: "取得値", pbr: 6.6, roe: 17.75, note: "高PER・高PBR。利益成長と決算後反応で説明できる場合のみ維持。" },
  { group: "商社・資源", ticker: "8053.T", name: "住友商事", status: "追加確認付き中心", per: 13.73, perType: "取得値", pbr: 1.87, roe: 12.94, note: "資源価格、為替、株主還元が維持されるか確認。" },
  { group: "重工・防衛", ticker: "7011.T", name: "三菱重工業", status: "監視", per: 34.29, perType: "取得値", pbr: 4.22, roe: 12.22, note: "テーマ性よりも直近下落と200日線回復を優先確認。" },
  { group: "投資会社・AI関連", ticker: "9984.T", name: "ソフトバンクG", status: "監視", per: null, perType: "PER未補完", pbr: 2.45, roe: 34.28, note: "PER単独ではなく、NAV、保有資産評価、Arm、AI関連株の変動を別評価。" },
];

function avg(values) {
  const xs = values.filter((v) => Number.isFinite(v));
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
}

function fmt(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : "未取得";
}

function valuationLabel(row, groupAvg) {
  if (!Number.isFinite(row.per) || !Number.isFinite(groupAvg)) return "別評価";
  if (row.per > groupAvg * 1.25) return "PER高め";
  if (row.per < groupAvg * 0.75) return "PER低め";
  return "同業内おおむね中間";
}

const groups = [...new Set(sourceRows.map((row) => row.group))];
const groupStats = groups.map((group) => {
  const items = sourceRows.filter((row) => row.group === group);
  return {
    group,
    count: items.length,
    avgPer: avg(items.map((row) => row.per)),
    avgPbr: avg(items.map((row) => row.pbr)),
    avgRoe: avg(items.map((row) => row.roe)),
  };
});

const statsByGroup = new Map(groupStats.map((row) => [row.group, row]));

const detailRows = sourceRows.map((row) => {
  const stat = statsByGroup.get(row.group);
  return {
    業種: row.group,
    銘柄: `${row.ticker} ${row.name}`,
    現区分: row.status,
    PER: Number.isFinite(row.per) ? `${fmt(row.per)}倍` : "未取得",
    PER種別: row.perType,
    PBR: `${fmt(row.pbr)}倍`,
    ROE: `${fmt(row.roe)}%`,
    業種内PER平均: Number.isFinite(stat.avgPer) ? `${fmt(stat.avgPer)}倍` : "未取得",
    業種内PBR平均: Number.isFinite(stat.avgPbr) ? `${fmt(stat.avgPbr)}倍` : "未取得",
    業種内ROE平均: Number.isFinite(stat.avgRoe) ? `${fmt(stat.avgRoe)}%` : "未取得",
    判定: valuationLabel(row, stat.avgPer),
    確認点: row.note,
  };
});

const summaryRows = groupStats.map((row) => ({
  業種: row.group,
  候補数: `${row.count}社`,
  PER平均: Number.isFinite(row.avgPer) ? `${fmt(row.avgPer)}倍` : "未取得",
  PBR平均: Number.isFinite(row.avgPbr) ? `${fmt(row.avgPbr)}倍` : "未取得",
  ROE平均: Number.isFinite(row.avgRoe) ? `${fmt(row.avgRoe)}%` : "未取得",
  扱い: row.count >= 3 ? "候補内比較として使用可能。ただし正式な同業母集団は追加予定。" : "候補内の単独または少数比較。外部同業の追加が必要。",
}));

const ruleRows = [
  { ルール: "PER/PBR/ROEは全業種一律で比較しない", 理由: "銀行、商社、食品、半導体装置、投資会社では適正水準が違うため。" },
  { ルール: "3社以上ある業種は候補内平均を暫定基準にする", 理由: "銀行と半導体・電子部品は、候補内で相対比較ができるため。" },
  { ルール: "1社しかない業種は外部同業の追加を前提にする", 理由: "味の素、住友商事、三菱重工業は候補内だけでは比較が弱いため。" },
  { ルール: "投資会社型はPER比較から分ける", 理由: "保有資産価値と投資先株価の影響が大きく、通常企業のPERと意味がずれるため。" },
];

write("698_sector_peer_comparison_summary.csv", toCsv(summaryRows.map((row) => ({ 作成: generatedAt, ...row }))));
write("699_sector_peer_comparison_detail.csv", toCsv(detailRows.map((row) => ({ 作成: generatedAt, ...row }))));
write("700_sector_peer_comparison_rules.csv", toCsv(ruleRows.map((row) => ({ 作成: generatedAt, ...row }))));

function table(rows, cls = "") {
  const header = Object.keys(rows[0] ?? {});
  return `<div class="table-wrap ${cls}"><table><thead><tr>${header.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${header.map((h) => `<td>${esc(row[h])}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

const groupCards = summaryRows.map((row) => `<article class="group-card">
  <h3>${esc(row.業種)}</h3>
  <div class="metrics">
    <div><span>候補数</span><strong>${esc(row.候補数)}</strong></div>
    <div><span>PER平均</span><strong>${esc(row.PER平均)}</strong></div>
    <div><span>PBR平均</span><strong>${esc(row.PBR平均)}</strong></div>
    <div><span>ROE平均</span><strong>${esc(row.ROE平均)}</strong></div>
  </div>
  <p>${esc(row.扱い)}</p>
</article>`).join("");

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>業種別比較 2026年5月27日</title>
  <style>
    :root {
      --ink:#071d33;
      --navy:#082f53;
      --blue:#0b5e94;
      --line:#c7dceb;
      --bg:#f5f8fb;
      --soft:#eef7ff;
    }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",Arial,sans-serif; line-height:1.75; }
    header { background:#082f53; color:#fff; padding:34px; }
    header h1 { margin:0 0 8px; font-size:clamp(28px,4vw,42px); line-height:1.2; letter-spacing:0; }
    header p { margin:0; color:#fff; font-weight:800; max-width:1040px; }
    main { max-width:1240px; margin:0 auto; padding:22px; }
    section { background:#fff; border:1px solid var(--line); border-radius:12px; padding:20px; margin:0 0 18px; box-shadow:0 8px 20px rgba(20,60,90,.08); break-inside:avoid; page-break-inside:avoid; }
    h2 { margin:0 0 12px; border-left:8px solid var(--blue); padding-left:12px; font-size:23px; line-height:1.35; }
    h3 { margin:0 0 8px; color:#06395b; }
    p { color:#111; }
    .lead { font-size:17px; font-weight:900; margin:0; }
    .grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
    .group-card { border:1px solid var(--line); border-radius:10px; background:#fbfdff; padding:14px; break-inside:avoid; }
    .metrics { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin:10px 0; }
    .metrics div { background:#eef7ff; border:1px solid #b8d8ed; border-radius:8px; padding:8px; }
    .metrics span { display:block; font-size:11px; font-weight:900; color:#3c5268; }
    .metrics strong { display:block; font-size:17px; color:#082f53; }
    .group-card p { margin:0; font-size:13px; }
    .note { background:#fff8ec; border:1px solid #efc98e; border-radius:10px; padding:12px 14px; color:#111; font-weight:800; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; min-width:1160px; font-size:13px; background:#fff; }
    th, td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:8px; vertical-align:top; overflow-wrap:anywhere; word-break:break-word; color:#111; }
    th { background:#e7f1fa; color:#06395b; text-align:left; font-weight:900; }
    .links a { display:inline-block; margin:4px 8px 4px 0; padding:9px 12px; border:1px solid #8bb9d6; border-radius:8px; color:#064f79; text-decoration:none; background:#fff; font-weight:900; }
    @media (max-width:920px){ header{padding:24px 18px;} main{padding:12px;} .grid{grid-template-columns:1fr;} table{font-size:12px;} }
  </style>
</head>
<body>
  <header>
    <h1>業種別比較</h1>
    <p>作成: ${esc(generatedAt)} / PER・PBR・ROEを全業種一律に扱わず、候補10社の業種ごとに比較します。</p>
  </header>
  <main>
    <section>
      <h2>1. 目的</h2>
      <p class="lead">銀行、半導体装置、食品、商社、重工、投資会社では評価指標の意味が違うため、同業内での比較に切り替えます。</p>
      <div class="note" style="margin-top:12px">この表は候補10社内の暫定比較です。1社しかない業種は、外部同業を追加して正式比較に広げる必要があります。</div>
    </section>
    <section>
      <h2>2. 業種別の見え方</h2>
      <div class="grid">${groupCards}</div>
    </section>
    <section>
      <h2>3. 銘柄別比較表</h2>
      ${table(detailRows)}
    </section>
    <section>
      <h2>4. 使用ルール</h2>
      ${table(ruleRows, "narrow")}
    </section>
    <section>
      <h2>5. 関連CSV</h2>
      <div class="links">
        <a href="698_sector_peer_comparison_summary.csv">概要CSV</a>
        <a href="699_sector_peer_comparison_detail.csv">詳細CSV</a>
        <a href="700_sector_peer_comparison_rules.csv">ルールCSV</a>
        <a href="next_execution_board_20260527.html">明日以降 実行ボード</a>
      </div>
    </section>
  </main>
</body>
</html>`;

write("sector_peer_comparison_20260527.html", html);

console.log(JSON.stringify({
  generatedAt,
  output: "sector_peer_comparison_20260527.html",
  rows: detailRows.length,
  groups: summaryRows.length,
}, null, 2));
