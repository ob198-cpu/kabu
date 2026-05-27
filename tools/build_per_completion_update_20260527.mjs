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

const perRows = [
  {
    銘柄: "8306.T 三菱UFJ FG",
    状態: "説明補助値あり",
    株価基準日: "2026-05-21",
    基準株価: "3,088円",
    EPS種別: "2026年3月期 実績EPS",
    EPS: "181.68円",
    PER補助値: "17.00倍",
    計算式: "3,088円 ÷ 181.68円 = 17.00倍",
    採点への扱い: "予想PERではないため、購入候補スコアへ直結しない。銀行同業比較の説明補助として使用。",
    次確認: "証券会社画面またはJ-Quantsで予想PER/実績PERの種別を確認する。",
    出典: "三菱UFJ FG 決算短信",
  },
  {
    銘柄: "6146.T ディスコ",
    状態: "説明補助値あり",
    株価基準日: "2026-05-21",
    基準株価: "66,500円",
    EPS種別: "2026年3月期 実績EPS",
    EPS: "1,082.34円",
    PER補助値: "61.44倍",
    計算式: "66,500円 ÷ 1,082.34円 = 61.44倍",
    採点への扱い: "予想PERではないため、購入候補スコアへ直結しない。高PBR・高期待の警戒確認に使用。",
    次確認: "証券会社画面またはJ-Quantsで予想PER/実績PERの種別を確認する。",
    出典: "ディスコ 決算資料",
  },
  {
    銘柄: "9984.T ソフトバンクG",
    状態: "未補完",
    株価基準日: "未設定",
    基準株価: "未設定",
    EPS種別: "未設定",
    EPS: "未取得",
    PER補助値: "未取得",
    計算式: "未計算",
    採点への扱い: "PERだけで評価しにくい投資会社型のため、NAV、保有株価値、Arm評価、AI関連株の変動を別枠で確認する。",
    次確認: "決算短信、投資先評価、純資産価値、保有株式の時価変動を確認する。",
    出典: "未確定",
  },
];

const summaryRows = [
  {
    項目: "PER未取得3社の再確認",
    結果: "2社は公式EPSと既存株価から説明補助値を作成済み。1社は投資会社型のため別評価が必要。",
  },
  {
    項目: "採点への扱い",
    結果: "予想PERと実績PERの種別がそろうまでは、購入候補スコアへ直接混ぜない。",
  },
  {
    項目: "明日の使い方",
    結果: "三菱UFJは銀行同業比較、ディスコは半導体装置の割高警戒、ソフトバンクGはNAV型評価として確認する。",
  },
];

const ruleRows = [
  {
    ルール: "実績PERと予想PERを混在させない",
    理由: "同じPERでも意味が違うため、比較対象がそろうまで点数へ直結しない。",
  },
  {
    ルール: "投資会社型はPER単独で判断しない",
    理由: "保有資産の時価、NAV、投資先株価の影響が大きく、通常企業のPER比較とずれる。",
  },
  {
    ルール: "補助値は説明と警戒条件に使う",
    理由: "高すぎる場合は過熱確認、低い場合は同業比較の材料にするが、最終判定は6月ゲート後に行う。",
  },
];

write("692_per_completion_update_summary.csv", toCsv(summaryRows.map((row) => ({ 作成: generatedAt, ...row }))));
write("693_per_completion_update_detail.csv", toCsv(perRows.map((row) => ({ 作成: generatedAt, ...row }))));
write("694_per_completion_use_rules.csv", toCsv(ruleRows.map((row) => ({ 作成: generatedAt, ...row }))));

function table(rows, cls = "") {
  const header = Object.keys(rows[0] ?? {});
  return `<div class="table-wrap ${cls}"><table><thead><tr>${header.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${header.map((h) => `<td>${esc(row[h])}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

function stateClass(status) {
  if (status.includes("補助値")) return "good";
  if (status.includes("未補完")) return "warn";
  return "muted";
}

const cards = perRows.map((row) => `<article class="card">
  <div class="card-head">
    <h3>${esc(row.銘柄)}</h3>
    <span class="pill ${stateClass(row.状態)}">${esc(row.状態)}</span>
  </div>
  <div class="formula">${esc(row.計算式)}</div>
  <dl>
    <div><dt>PER補助値</dt><dd>${esc(row.PER補助値)}</dd></div>
    <div><dt>EPS</dt><dd>${esc(row.EPS)}</dd></div>
    <div><dt>基準株価</dt><dd>${esc(row.基準株価)}</dd></div>
  </dl>
  <p><b>扱い:</b> ${esc(row.採点への扱い)}</p>
  <p><b>次確認:</b> ${esc(row.次確認)}</p>
</article>`).join("");

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PER補完進捗</title>
  <style>
    :root {
      --ink:#071d33;
      --navy:#082f53;
      --blue:#0b5e94;
      --line:#c7dceb;
      --bg:#f5f8fb;
      --green:#087a55;
      --orange:#b45f06;
    }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:"Yu Gothic","Meiryo",Arial,sans-serif; line-height:1.75; }
    header { background:#082f53; color:#fff; padding:32px 34px; }
    header h1 { margin:0 0 8px; font-size:clamp(28px,4vw,40px); line-height:1.2; letter-spacing:0; }
    header p { margin:0; color:#fff; font-weight:800; max-width:1040px; }
    main { max-width:1200px; margin:0 auto; padding:22px; }
    section { background:#fff; border:1px solid var(--line); border-radius:12px; padding:20px; margin:0 0 18px; box-shadow:0 8px 20px rgba(20,60,90,.08); break-inside:avoid; page-break-inside:avoid; }
    h2 { margin:0 0 12px; border-left:8px solid var(--blue); padding-left:12px; font-size:23px; line-height:1.35; }
    h3 { margin:0; font-size:18px; color:#06395b; line-height:1.4; }
    p { color:#111; }
    .lead { font-size:17px; font-weight:800; margin:0; }
    .grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:12px; }
    .card { border:1px solid var(--line); border-radius:10px; background:#fbfdff; padding:14px; break-inside:avoid; }
    .card-head { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom:10px; }
    .pill { display:inline-block; padding:3px 9px; border-radius:999px; font-size:12px; font-weight:900; border:1px solid var(--line); white-space:nowrap; }
    .pill.good { background:#e9f8f2; color:#087a55; border-color:#9bd1be; }
    .pill.warn { background:#fff4df; color:#9a5205; border-color:#efc98e; }
    .formula { background:#eef7ff; border:1px solid #b8d8ed; border-radius:8px; padding:9px; font-weight:900; color:#06395b; margin-bottom:10px; }
    dl { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin:8px 0 10px; }
    dt { font-size:11px; color:#3c5268; font-weight:900; }
    dd { margin:0; font-weight:900; color:#061d33; }
    .card p { margin:8px 0 0; font-size:13px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; min-width:980px; font-size:13px; background:#fff; }
    th, td { border-bottom:1px solid var(--line); border-right:1px solid var(--line); padding:8px; vertical-align:top; overflow-wrap:anywhere; word-break:break-word; color:#111; }
    th { background:#e7f1fa; color:#06395b; text-align:left; font-weight:900; }
    .links a { display:inline-block; margin:4px 8px 4px 0; padding:9px 12px; border:1px solid #8bb9d6; border-radius:8px; color:#064f79; text-decoration:none; background:#fff; font-weight:900; }
    @media (max-width:920px){ header{padding:24px 18px;} main{padding:12px;} .grid{grid-template-columns:1fr;} dl{grid-template-columns:1fr;} table{font-size:12px;} }
  </style>
</head>
<body>
  <header>
    <h1>PER補完進捗</h1>
    <p>作成: ${esc(generatedAt)} / PER未取得3社について、既存データから補助値を作れるものと、まだ別評価が必要なものを分けました。</p>
  </header>
  <main>
    <section>
      <h2>1. 結論</h2>
      <p class="lead">三菱UFJ FGとディスコは公式EPSと既存株価からPER補助値を計算済みです。ただし、予想PERと実績PERが混在するため、スコアには直結せず説明補助・警戒条件として使います。</p>
    </section>
    <section>
      <h2>2. 銘柄別の補完状況</h2>
      <div class="grid">${cards}</div>
    </section>
    <section>
      <h2>3. 詳細表</h2>
      ${table(perRows)}
    </section>
    <section>
      <h2>4. 使用ルール</h2>
      ${table(ruleRows, "narrow")}
    </section>
    <section>
      <h2>5. 関連CSV</h2>
      <div class="links">
        <a href="692_per_completion_update_summary.csv">概要CSV</a>
        <a href="693_per_completion_update_detail.csv">詳細CSV</a>
        <a href="694_per_completion_use_rules.csv">使用ルールCSV</a>
        <a href="next_execution_board_20260527.html">明日以降 実行ボード</a>
      </div>
    </section>
  </main>
</body>
</html>`;

write("per_completion_update_20260527.html", html);

console.log(JSON.stringify({
  generatedAt,
  output: "per_completion_update_20260527.html",
  rows: perRows.length,
  assisted: perRows.filter((row) => row.状態.includes("補助値")).length,
}, null, 2));
