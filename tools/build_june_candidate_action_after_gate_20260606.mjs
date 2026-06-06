import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date());

const rows = [
  {
    ticker: "既存10社",
    name: "現行候補群",
    channel: "総合基準",
    role: "基準",
    ifGreen: "維持しつつ、テーマ候補が上回るか比較する",
    ifYellow: "既存10社を基本維持。攻め枠追加は小比率または保留",
    ifRed: "既存10社を維持、または個別株比率を下げる。新規攻め枠は追加しない",
    requiredProof: "指数比、下落耐性、決算後反応、未取得データの有無",
    maxAction: "基準維持",
    stopRule: "指数を上回る説明が弱い場合は個別株比率を上げない",
  },
  {
    ticker: "6857.T",
    name: "アドバンテスト",
    channel: "半導体製造装置・材料",
    role: "攻め枠",
    ifGreen: "SOX、米金利、候補別反応が良ければ小比率で採用検討",
    ifYellow: "翌営業日以降に再確認。採用しても小比率に限定",
    ifRed: "採用しない",
    requiredProof: "SOX、米10年金利、PER、受注、決算後反応、直近上昇率",
    maxAction: "小比率採用",
    stopRule: "SOX急落、金利急騰、PER過熱、決算後反応悪化",
  },
  {
    ticker: "6146.T",
    name: "ディスコ",
    channel: "半導体製造装置・材料",
    role: "攻め枠",
    ifGreen: "月次・受注・決算反応が良ければ小比率で比較",
    ifYellow: "下落耐性が確認できるまで保留",
    ifRed: "採用しない",
    requiredProof: "月次売上、受注、決算後反応、最大下落率、出来高",
    maxAction: "小比率採用",
    stopRule: "急騰後反落、最大下落リスクが説明できない、決算反応悪化",
  },
  {
    ticker: "8035.T",
    name: "東京エレクトロン",
    channel: "半導体製造装置・材料",
    role: "補欠",
    ifGreen: "半導体設備投資の回復が数字で確認できる場合のみ比較",
    ifYellow: "補欠維持",
    ifRed: "採用しない",
    requiredProof: "設備投資見通し、SOX、米金利、決算ガイダンス、PER",
    maxAction: "補欠から比較候補へ昇格",
    stopRule: "半導体サイクル悪化、金利急騰、ガイダンス弱化",
  },
  {
    ticker: "6501.T",
    name: "日立製作所",
    channel: "データセンター・電力・冷却・電線",
    role: "守り寄り成長",
    ifGreen: "送配電・電力制御・デジタル事業の寄与が確認できれば既存10社と入替比較",
    ifYellow: "既存10社を維持し、事業寄与を追加確認",
    ifRed: "採用を急がない",
    requiredProof: "電力・制御・デジタル事業の受注、利益率、指数差",
    maxAction: "入替候補",
    stopRule: "テーマ寄与が見えない、指数並みの反応に留まる",
  },
  {
    ticker: "5803.T",
    name: "フジクラ",
    channel: "データセンター・電力・冷却・電線",
    role: "攻め枠",
    ifGreen: "受注・利益率・株価反応が良ければ小比率採用を検討",
    ifYellow: "過熱が落ち着くまで保留、または比率上限をかなり低くする",
    ifRed: "採用しない",
    requiredProof: "光通信・電線需要、受注、利益率、過熱、最大下落率",
    maxAction: "小比率採用",
    stopRule: "過熱、急落、テーマ織り込み済み、利益率悪化",
  },
  {
    ticker: "7011.T",
    name: "三菱重工業",
    channel: "データセンター・電力・冷却・電線",
    role: "条件付き",
    ifGreen: "電力・防衛・大型インフラの寄与を分けて確認できれば比較",
    ifYellow: "補完後候補に留める",
    ifRed: "採用しない",
    requiredProof: "電力・防衛・受注残、利益率、直近株価反応、指数差",
    maxAction: "条件付き比較",
    stopRule: "テーマが広すぎて株価理由を分離できない、直近反応が弱い",
  },
  {
    ticker: "6762.T",
    name: "TDK",
    channel: "フィジカルAI",
    role: "代表候補",
    ifGreen: "フィジカルAIを1銘柄だけ入れる場合の代表候補として比較",
    ifYellow: "小比率または保留。電子部品サイクルを追加確認",
    ifRed: "フィジカルAI枠は入れない",
    requiredProof: "電源・センサー寄与、PER/PBR/ROE、電子部品サイクル、決算後反応",
    maxAction: "代表候補として比較",
    stopRule: "テーマ寄与が見えない、電子部品市況悪化、決算反応悪化",
  },
  {
    ticker: "6954.T / 6861.T",
    name: "ファナック / キーエンス",
    channel: "フィジカルAI",
    role: "補完後候補",
    ifGreen: "TDKの次に補完後比較。今すぐ採用しない",
    ifYellow: "未採用維持",
    ifRed: "未採用維持",
    requiredProof: "ロボット受注、FA需要、PER/PBR/ROE、決算後反応、指数差",
    maxAction: "補完後に候補化",
    stopRule: "受注弱化、高PERを説明できない、設備投資サイクル悪化",
  },
  {
    ticker: "6702.T / 6701.T",
    name: "富士通 / NEC",
    channel: "量子コンピューター",
    role: "長期探索",
    ifGreen: "監視継続。購入候補化しない",
    ifYellow: "監視継続",
    ifRed: "監視継続",
    requiredProof: "商用サービス、受注、売上寄与、イベント後株価反応",
    maxAction: "監視のみ",
    stopRule: "6月NISA 1年テストには入れない",
  },
];

const headers = ["ticker", "name", "channel", "role", "ifGreen", "ifYellow", "ifRed", "requiredProof", "maxAction", "stopRule"];
const esc = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");
const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const badgeClass = (role) => role.includes("攻め") ? "attack" : role.includes("長期") ? "watch" : role.includes("補") ? "hold" : "base";

const htmlRows = rows.map((row) => `
  <tr>
    <td><b>${esc(row.ticker)}</b><br>${esc(row.name)}</td>
    <td>${esc(row.channel)}</td>
    <td><span class="badge ${badgeClass(row.role)}">${esc(row.role)}</span></td>
    <td><span class="ok">緑</span>${esc(row.ifGreen)}</td>
    <td><span class="warn">黄</span>${esc(row.ifYellow)}</td>
    <td><span class="stop">赤</span>${esc(row.ifRed)}</td>
    <td>${esc(row.requiredProof)}</td>
    <td>${esc(row.maxAction)}</td>
    <td>${esc(row.stopRule)}</td>
  </tr>
`).join("");

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月候補別アクション分岐表</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--ok:#0b6b4f;--warn:#a85b00;--stop:#a01818;--gray:#455a6f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;line-height:1.7}
    header{background:var(--navy);color:white;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(28px,4vw,40px);letter-spacing:0;line-height:1.25}
    header p{margin:0;color:white;font-weight:800}
    main{max-width:1500px;margin:0 auto;padding:22px}
    section{background:white;border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:24px}
    .lead{border-left:7px solid #b76500;background:#fff7e7;color:#111;padding:12px 14px;margin:12px 0;font-weight:900;border-radius:8px}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:white}
    table{width:100%;border-collapse:collapse;min-width:1450px;table-layout:fixed;font-size:13px}
    th,td{border:1px solid var(--line);padding:8px;vertical-align:top;overflow-wrap:anywhere;word-break:break-word;color:#111}
    th{background:#e5f1fa;color:#073b62;text-align:left;font-weight:900}
    .ok,.warn,.stop,.badge{display:inline-block;color:white;border-radius:999px;padding:2px 7px;margin-right:5px;font-weight:900;font-size:12px}
    .ok{background:var(--ok)}.warn{background:var(--warn)}.stop{background:var(--stop)}
    .badge.base{background:var(--blue)}.badge.attack{background:#8a4a00}.badge.hold{background:var(--gray)}.badge.watch{background:#6b5876}
    .links a{display:inline-block;margin:6px 8px 0 0;background:var(--blue);color:white;text-decoration:none;border-radius:8px;padding:9px 12px;font-weight:900}
    .cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.card{border:1px solid var(--line);border-radius:10px;padding:13px;background:#fbfdff}.card b{display:block;color:var(--navy)}.card strong{display:block;font-size:26px;color:var(--blue)}
    @media(max-width:980px){main{padding:12px}.cards{grid-template-columns:1fr}table{min-width:1180px}}
  </style>
</head>
<body>
<header>
  <h1>6月候補別アクション分岐表</h1>
  <p>作成: ${esc(generatedAt)} / 6月イベント判定エンジンの結果を、銘柄ごとの扱いに変換する表です。</p>
</header>
<main>
  <section>
    <h2>1. 目的</h2>
    <p class="lead">市場ゲートが緑・黄・赤のどれになったかに応じて、候補銘柄を採用検討、保留、停止に分けます。ここでも購入を確定しません。最終判断には、イベント後の実データ、公式決算、証券会社画面での確認が必要です。</p>
    <div class="cards">
      <div class="card"><b>緑</b><strong>比較へ進む</strong><span>既存10社を上回るか確認</span></div>
      <div class="card"><b>黄</b><strong>保留・小比率</strong><span>翌営業日以降に再確認</span></div>
      <div class="card"><b>赤</b><strong>追加停止</strong><span>攻め枠は入れない</span></div>
    </div>
    <div class="links">
      <a href="894_june_candidate_action_after_gate_20260606.csv">CSVを開く</a>
      <a href="893_june_event_gate_engine_20260606.html">6月イベント判定エンジン</a>
      <a href="892_june_event_actual_input_and_replacement_log_20260606.html">6月イベント後 実データ入力・入替記録</a>
      <a href="index.html">ホームへ戻る</a>
    </div>
  </section>
  <section>
    <h2>2. 銘柄別アクション</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width:155px">銘柄</th>
            <th style="width:190px">テーマ</th>
            <th style="width:105px">役割</th>
            <th>緑の場合</th>
            <th>黄の場合</th>
            <th>赤の場合</th>
            <th>必要な根拠</th>
            <th style="width:135px">最大アクション</th>
            <th>停止ルール</th>
          </tr>
        </thead>
        <tbody>${htmlRows}</tbody>
      </table>
    </div>
  </section>
</main>
</body>
</html>`;

const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
fs.writeFileSync(path.join(ROOT, "894_june_candidate_action_after_gate_20260606.csv"), `\uFEFF${csv}\n`, "utf8");
fs.writeFileSync(path.join(ROOT, "894_june_candidate_action_after_gate_20260606.html"), html, "utf8");

const link = '<a class="button secondary" href="894_june_candidate_action_after_gate_20260606.html">6月候補別アクション分岐表</a>';
for (const file of ["index.html", "practical_action_dashboard_20260528.html", "893_june_event_gate_engine_20260606.html"]) {
  const filePath = path.join(ROOT, file);
  if (!fs.existsSync(filePath)) continue;
  let text = fs.readFileSync(filePath, "utf8");
  if (text.includes("894_june_candidate_action_after_gate_20260606.html")) continue;
  if (text.includes("893_june_event_gate_engine_20260606.html")) {
    text = text.replace(/(<a[^>]+href="893_june_event_gate_engine_20260606\.html"[^>]*>.*?<\/a>)/s, `$1\n      ${link}`);
  } else if (text.includes("</section>")) {
    text = text.replace("</section>", `<div class="links">${link}</div></section>`);
  }
  fs.writeFileSync(filePath, text, "utf8");
}

console.log("wrote 894_june_candidate_action_after_gate_20260606.html");
console.log("wrote 894_june_candidate_action_after_gate_20260606.csv");
