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
  { target: "8316.T 三井住友FG", group: "銀行", peer: "8306.T 三菱UFJ FG", role: "大手銀行比較", per: "補助値17.00倍", pbr: "1.54倍", roe: "11.34%", status: "補助値あり", use: "三井住友FGの割安/割高度、銀行株内の順位を見る。" },
  { target: "8316.T 三井住友FG", group: "銀行", peer: "8411.T みずほFG", role: "大手銀行比較", per: "13.79倍", pbr: "1.58倍", roe: "11.48%", status: "既存100社データあり", use: "銀行3メガ比較の基準にする。" },
  { target: "8316.T 三井住友FG", group: "銀行", peer: "7173.T 東京きらぼしFG", role: "地銀比較", per: "8.83倍", pbr: "0.96倍", roe: "10.66%", status: "既存候補データあり", use: "地銀の割安さと決算後反応の弱さを分けて見る。" },

  { target: "6762.T TDK", group: "半導体・電子部品", peer: "6981.T 村田製作所", role: "電子部品比較", per: "41.64倍", pbr: "4.49倍", roe: "8.83%", status: "既存100社データあり", use: "TDKのPER/PBRが電子部品内で高いか低いかを見る。" },
  { target: "6762.T TDK", group: "半導体・電子部品", peer: "6971.T 京セラ", role: "電子部品比較", per: "27.62倍", pbr: "1.17倍", roe: "4.30%", status: "既存100社データあり", use: "利益率と評価倍率の比較に使う。" },
  { target: "6146.T ディスコ", group: "半導体製造装置", peer: "6857.T アドバンテスト", role: "AI半導体検査", per: "42.00倍", pbr: "24.55倍", roe: "57.65%", status: "既存100社データあり", use: "高成長・高バリュエーション銘柄との比較に使う。" },
  { target: "6146.T ディスコ", group: "半導体製造装置", peer: "6920.T レーザーテック", role: "EUV検査", per: "47.95倍", pbr: "15.28倍", roe: "46.88%", status: "既存100社データあり", use: "過熱・高PER・高PBRの警戒基準に使う。" },
  { target: "7735.T SCREEN HD", group: "半導体製造装置", peer: "8035.T 東京エレクトロン", role: "半導体製造装置大手", per: "未取得", pbr: "10.80倍", roe: "29.56%", status: "PER未取得", use: "同業最大手とのPBR/ROE比較。PERは追加取得が必要。" },

  { target: "2802.T 味の素", group: "食品・ヘルスケア", peer: "2801.T キッコーマン", role: "食品・海外比率比較", per: "未取得", pbr: "未取得", roe: "未取得", status: "公式値追加取得", use: "高PERを食品内で説明できるかを見る。" },
  { target: "2802.T 味の素", group: "食品・ヘルスケア", peer: "2503.T キリンHD", role: "食品・飲料比較", per: "未取得", pbr: "未取得", roe: "未取得", status: "公式値追加取得", use: "生活必需品寄りの安定性比較に使う。" },
  { target: "2802.T 味の素", group: "食品・ヘルスケア", peer: "2502.T アサヒGHD", role: "食品・飲料比較", per: "未取得", pbr: "未取得", roe: "未取得", status: "公式値追加取得", use: "食品/飲料大型株との評価差を見る。" },

  { target: "8053.T 住友商事", group: "商社", peer: "8058.T 三菱商事", role: "総合商社比較", per: "18.06倍", pbr: "2.10倍", roe: "8.51%", status: "既存100社データあり", use: "総合商社内での割安/還元/資源感応度を見る。" },
  { target: "8053.T 住友商事", group: "商社", peer: "8031.T 三井物産", role: "総合商社比較", per: "17.54倍", pbr: "1.84倍", roe: "10.22%", status: "既存100社データあり", use: "商社内の収益性比較に使う。" },
  { target: "8053.T 住友商事", group: "商社", peer: "8001.T 伊藤忠商事", role: "総合商社比較", per: "14.35倍", pbr: "2.07倍", roe: "14.59%", status: "既存100社データあり", use: "非資源寄り・高ROE商社との比較に使う。" },
  { target: "8053.T 住友商事", group: "商社", peer: "8002.T 丸紅", role: "総合商社比較", per: "15.01倍", pbr: "1.99倍", roe: "13.61%", status: "既存20社データあり", use: "候補から落ちた商社との比較に使う。" },

  { target: "7011.T 三菱重工業", group: "重工・防衛", peer: "7012.T 川崎重工業", role: "重工・防衛比較", per: "21.60倍", pbr: "2.71倍", roe: "13.68%", status: "既存100社データあり", use: "防衛/水素テーマ内での評価差を見る。" },
  { target: "7011.T 三菱重工業", group: "重工・防衛", peer: "7013.T IHI", role: "重工・防衛比較", per: "16.88倍", pbr: "4.27倍", roe: "28.39%", status: "既存100社データあり", use: "重工内でのROE・PBR・下落率比較に使う。" },

  { target: "9984.T ソフトバンクG", group: "投資会社・AI関連", peer: "9434.T ソフトバンク", role: "通信子会社比較", per: "19.25倍", pbr: "4.09倍", roe: "19.32%", status: "既存100社データあり", use: "投資会社本体ではなく、事業会社部分の比較参考にする。" },
  { target: "9984.T ソフトバンクG", group: "投資会社・AI関連", peer: "4755.T 楽天グループ", role: "投資/通信/EC比較", per: "未取得", pbr: "未取得", roe: "未取得", status: "公式値追加取得", use: "PERではなく、財務リスクと投資先評価の比較対象にする。" },
];

const targetSummary = [...new Set(rows.map((row) => row.target))].map((target) => {
  const items = rows.filter((row) => row.target === target);
  const usable = items.filter((row) => row.status.includes("既存") || row.status.includes("補助値")).length;
  const missing = items.length - usable;
  return {
    対象候補: target,
    同業候補数: `${items.length}社`,
    既存データあり: `${usable}社`,
    追加取得必要: `${missing}社`,
    次作業: missing > 0 ? "公式値または証券会社画面で不足値を補完する。" : "既存データで暫定比較を作成できる。",
  };
});

const priorityRows = [
  { 優先: 1, 作業: "食品同業の公式値取得", 対象: "2801 キッコーマン / 2503 キリンHD / 2502 アサヒGHD", 理由: "味の素の高PER・高PBRを食品内で説明できるかが重要。" },
  { 優先: 2, 作業: "東京エレクトロンのPER補完", 対象: "8035 東京エレクトロン", 理由: "半導体製造装置の最大手比較がないと、ディスコ・SCREENの説明が弱い。" },
  { 優先: 3, 作業: "ソフトバンクGのNAV型評価", 対象: "9984 ソフトバンクG", 理由: "PERではなく保有資産価値、Arm、AI関連株の下落耐性を確認する必要がある。" },
  { 優先: 4, 作業: "商社比較の正式化", 対象: "8058 / 8031 / 8001 / 8002", 理由: "住友商事が本当に商社内で見劣りしないかを確認する。" },
];

write("701_external_peer_expansion_summary.csv", toCsv(targetSummary.map((row) => ({ 作成: generatedAt, ...row }))));
write("702_external_peer_expansion_detail.csv", toCsv(rows.map((row) => ({ 作成: generatedAt, ...row }))));
write("703_external_peer_expansion_priority.csv", toCsv(priorityRows.map((row) => ({ 作成: generatedAt, ...row }))));

function table(tableRows, cls = "") {
  const header = Object.keys(tableRows[0] ?? {});
  return `<div class="table-wrap ${cls}"><table><thead><tr>${header.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${tableRows
    .map((row) => `<tr>${header.map((h) => `<td>${esc(row[h])}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

const summaryCards = targetSummary.map((row) => `<article class="summary-card">
  <h3>${esc(row.対象候補)}</h3>
  <dl>
    <div><dt>同業候補</dt><dd>${esc(row.同業候補数)}</dd></div>
    <div><dt>既存データ</dt><dd>${esc(row.既存データあり)}</dd></div>
    <div><dt>追加取得</dt><dd>${esc(row.追加取得必要)}</dd></div>
  </dl>
  <p>${esc(row.次作業)}</p>
</article>`).join("");

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>外部同業比較 追加キュー</title>
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
    header { background:linear-gradient(135deg,#082f53,#0b5e94); color:#fff; padding:34px; }
    header h1 { margin:0 0 8px; font-size:clamp(28px,4vw,42px); line-height:1.2; letter-spacing:0; }
    header p { margin:0; color:#fff; font-weight:800; max-width:1040px; }
    main { max-width:1240px; margin:0 auto; padding:22px; }
    section { background:#fff; border:1px solid var(--line); border-radius:12px; padding:20px; margin:0 0 18px; box-shadow:0 8px 20px rgba(20,60,90,.08); break-inside:avoid; page-break-inside:avoid; }
    h2 { margin:0 0 12px; border-left:8px solid var(--blue); padding-left:12px; font-size:23px; line-height:1.35; }
    h3 { margin:0 0 8px; color:#06395b; line-height:1.4; }
    p { color:#111; }
    .lead { font-size:17px; font-weight:900; margin:0; }
    .grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
    .summary-card { border:1px solid var(--line); border-radius:10px; background:#fbfdff; padding:14px; }
    dl { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin:10px 0; }
    dt { font-size:11px; color:#3c5268; font-weight:900; }
    dd { margin:0; font-size:18px; font-weight:900; color:#082f53; }
    .summary-card p { margin:0; font-size:13px; }
    .note { background:#fff8ec; border:1px solid #efc98e; border-radius:10px; padding:12px 14px; color:#111; font-weight:800; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; min-width:1180px; font-size:13px; background:#fff; }
    th, td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:8px; vertical-align:top; overflow-wrap:anywhere; word-break:break-word; color:#111; }
    th { background:#e7f1fa; color:#06395b; text-align:left; font-weight:900; }
    .narrow table { min-width:880px; }
    .links a { display:inline-block; margin:4px 8px 4px 0; padding:9px 12px; border:1px solid #8bb9d6; border-radius:8px; color:#064f79; text-decoration:none; background:#fff; font-weight:900; }
    @media (max-width:920px){ header{padding:24px 18px;} main{padding:12px;} .grid{grid-template-columns:1fr;} dl{grid-template-columns:1fr;} table{font-size:12px;} }
  </style>
</head>
<body>
  <header>
    <h1>外部同業比較 追加キュー</h1>
    <p>作成: ${esc(generatedAt)} / 候補10社だけでは比較が弱い業種について、追加する同業と取得すべき数値を整理しました。</p>
  </header>
  <main>
    <section>
      <h2>1. 目的</h2>
      <p class="lead">候補10社内だけの比較から、同業ベンチマーク比較へ広げ、PER/PBR/ROEの説明力を上げます。</p>
      <div class="note" style="margin-top:12px">既存100社データで使える数値は暫定比較に使います。公式値が未取得の同業は、採点に混ぜず追加取得キューとして扱います。</div>
    </section>
    <section>
      <h2>2. 対象候補ごとの追加状況</h2>
      <div class="grid">${summaryCards}</div>
    </section>
    <section>
      <h2>3. 外部同業キュー</h2>
      ${table(rows)}
    </section>
    <section>
      <h2>4. 優先作業</h2>
      ${table(priorityRows, "narrow")}
    </section>
    <section>
      <h2>5. 関連CSV</h2>
      <div class="links">
        <a href="701_external_peer_expansion_summary.csv">概要CSV</a>
        <a href="702_external_peer_expansion_detail.csv">同業キューCSV</a>
        <a href="703_external_peer_expansion_priority.csv">優先作業CSV</a>
        <a href="sector_peer_comparison_20260527.html">業種別比較</a>
      </div>
    </section>
  </main>
</body>
</html>`;

write("external_peer_expansion_20260527.html", html);

console.log(JSON.stringify({
  generatedAt,
  output: "external_peer_expansion_20260527.html",
  rows: rows.length,
  targets: targetSummary.length,
}, null, 2));
