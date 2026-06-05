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
    channel: "総合基準",
    ticker: "既存10社",
    name: "現行候補群",
    role: "基準",
    currentStatus: "維持基準",
    requiredData: "6月CPI、日銀、FOMC後の日経平均/TOPIX、S&P500、米10年金利、ドル円、候補銘柄の株価反応",
    passCondition: "指数比で劣後せず、個別株比率を上げる説明が残る",
    failCondition: "指数を上回る説明が弱い、または主要銘柄に下方修正・急落・未確認データが残る",
    juneAction: "テーマ銘柄を入れる場合も、この候補群を上回る説明が必要",
    note: "ここを基準に置かないと、テーマ銘柄を感覚で追加したように見えるため。",
  },
  {
    channel: "半導体製造装置・材料",
    ticker: "6857.T",
    name: "アドバンテスト",
    role: "攻め枠",
    currentStatus: "昇格候補",
    requiredData: "SOX指数、米10年金利、決算ガイダンス、受注、PER、決算後反応、直近上昇率",
    passCondition: "AI向け検査需要の説明が決算・受注で確認でき、金利急騰やSOX急落がない",
    failCondition: "PER過熱、SOX急落、決算後反応悪化、急騰後の大幅反落",
    juneAction: "小比率の攻め枠候補。既存10社より期待値が説明できる場合のみ採用検討",
    note: "AI半導体需要に近い一方、値動きが大きいため全体比率は抑える。",
  },
  {
    channel: "半導体製造装置・材料",
    ticker: "6146.T",
    name: "ディスコ",
    role: "攻め枠",
    currentStatus: "昇格候補",
    requiredData: "月次売上、四半期決算、受注、決算後反応、最大下落率、出来高",
    passCondition: "先端パッケージ・加工需要が数字で確認でき、急落耐性を説明できる",
    failCondition: "急騰後反落、決算反応悪化、下落率が大きくNISA 1年保有に不向き",
    juneAction: "半導体枠の比較候補。採用する場合は比率を小さくする",
    note: "構造需要は強いが、下落幅も大きくなりやすい。",
  },
  {
    channel: "半導体製造装置・材料",
    ticker: "8035.T",
    name: "東京エレクトロン",
    role: "補欠",
    currentStatus: "補完後候補",
    requiredData: "設備投資見通し、SOX指数、米金利、決算ガイダンス、PER、決算後反応",
    passCondition: "半導体設備投資の回復が確認でき、指数・金利条件も悪化していない",
    failCondition: "半導体サイクル悪化、金利急騰、ガイダンス弱化",
    juneAction: "データ補完後にアドバンテスト、ディスコと比較",
    note: "代表性は高いが、6月時点では追加確認を優先する。",
  },
  {
    channel: "データセンター・電力・冷却・電線",
    ticker: "6501.T",
    name: "日立製作所",
    role: "守り寄り成長",
    currentStatus: "昇格候補",
    requiredData: "送配電・電力制御・デジタル事業の受注、利益率、決算後反応、指数差",
    passCondition: "電力・制御・データセンター周辺の寄与が決算で確認できる",
    failCondition: "大型株でテーマ寄与が見えない、指数並みの反応に留まる",
    juneAction: "既存10社との入れ替え候補。守りと成長の両方で比較",
    note: "AIインフラ需要を電力・制御側から見る候補。",
  },
  {
    channel: "データセンター・電力・冷却・電線",
    ticker: "5803.T",
    name: "フジクラ",
    role: "攻め枠",
    currentStatus: "昇格候補",
    requiredData: "光通信・電線需要、受注、利益率、直近上昇率、最大下落率、出来高",
    passCondition: "データセンター需要が受注や利益率に表れ、急騰後でも説明可能",
    failCondition: "過熱、急落、テーマ織り込み済み、利益率悪化",
    juneAction: "攻め枠候補。採用時は比率上限を設定",
    note: "テーマ反応は強いが、過熱管理が必要。",
  },
  {
    channel: "データセンター・電力・冷却・電線",
    ticker: "7011.T",
    name: "三菱重工業",
    role: "条件付き",
    currentStatus: "補完後候補",
    requiredData: "電力・防衛・受注残、利益率、直近株価反応、最大下落率、指数差",
    passCondition: "電力・防衛・大型インフラの寄与が数字で説明できる",
    failCondition: "テーマが広すぎて株価理由を分離できない、直近反応が弱い",
    juneAction: "採用前に寄与事業を分けて確認",
    note: "話題性ではなく、受注・利益率で確認する。",
  },
  {
    channel: "フィジカルAI",
    ticker: "6762.T",
    name: "TDK",
    role: "代表候補",
    currentStatus: "比較対象",
    requiredData: "PER/PBR/ROE、電源・センサー・電子部品寄与、決算後反応、スマホ・AIサーバー需要",
    passCondition: "電子部品サイクルだけでなく、AIサーバー周辺・センサー寄与を説明できる",
    failCondition: "電子部品市況悪化、テーマ寄与が見えない、決算後反応悪化",
    juneAction: "フィジカルAIを1銘柄だけ試す場合の代表候補",
    note: "既存データに接続済みのため、最初に比較しやすい。",
  },
  {
    channel: "フィジカルAI",
    ticker: "6954.T",
    name: "ファナック",
    role: "補完後候補",
    currentStatus: "未採用",
    requiredData: "ロボット受注、工作機械需要、PER/PBR/ROE、決算後反応、指数差",
    passCondition: "産業用ロボット・FA需要の回復が受注で確認できる",
    failCondition: "設備投資サイクル悪化、受注弱化、決算後反応不足",
    juneAction: "データ補完後にTDKと比較",
    note: "テーマ適合はあるが、今すぐ購入候補にしない。",
  },
  {
    channel: "フィジカルAI",
    ticker: "6861.T",
    name: "キーエンス",
    role: "補完後候補",
    currentStatus: "未採用",
    requiredData: "PER、利益率、FA投資回復、海外売上、決算後反応、金利感応度",
    passCondition: "高収益性とFA需要回復が確認でき、割高さを説明できる",
    failCondition: "高PERを説明できない、金利上昇で売られやすい、決算反応が弱い",
    juneAction: "補完後に候補化判断",
    note: "良い会社かどうかではなく、6月から1年で指数を上回る説明が必要。",
  },
  {
    channel: "フィジカルAI",
    ticker: "6506.T / 6594.T",
    name: "安川電機 / ニデック",
    role: "補完後候補",
    currentStatus: "未採用",
    requiredData: "モーター・ロボット関連売上、受注、PER/PBR/ROE、決算後反応、設備投資サイクル",
    passCondition: "物理AI・ロボット需要が売上または受注に確認できる",
    failCondition: "テーマ連想のみ、既存候補より数値が弱い",
    juneAction: "6月購入候補ではなく、補完後の観察候補",
    note: "連想で買わず、決算・受注・株価反応で確認する。",
  },
  {
    channel: "量子コンピューター",
    ticker: "6702.T / 6701.T",
    name: "富士通 / NEC",
    role: "長期探索",
    currentStatus: "購入候補化しない",
    requiredData: "量子関連の商用サービス、受注、売上寄与、決算説明、イベント後株価反応",
    passCondition: "研究開発ではなく、商用化・売上・受注の数字が確認できる",
    failCondition: "国策・研究開発・話題性だけで、1年リターンの説明ができない",
    juneAction: "6月NISA 1年テストには入れない",
    note: "監視価値はあるが、1年保有テストの根拠としてはまだ弱い。",
  },
];

const headers = ["channel", "ticker", "name", "role", "currentStatus", "requiredData", "passCondition", "failCondition", "juneAction", "note"];
const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const esc = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const badgeClass = (status) => {
  if (status.includes("昇格") || status.includes("比較対象") || status.includes("維持")) return "good";
  if (status.includes("補完") || status.includes("未採用")) return "hold";
  return "stop";
};

const htmlRows = rows.map((row) => `
  <tr>
    <td><b>${esc(row.channel)}</b></td>
    <td><b>${esc(row.ticker)}</b><br>${esc(row.name)}</td>
    <td>${esc(row.role)}</td>
    <td><span class="badge ${badgeClass(row.currentStatus)}">${esc(row.currentStatus)}</span></td>
    <td>${esc(row.requiredData)}</td>
    <td>${esc(row.passCondition)}</td>
    <td>${esc(row.failCondition)}</td>
    <td>${esc(row.juneAction)}</td>
    <td>${esc(row.note)}</td>
  </tr>
`).join("");

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月テーマ候補 実行判定表</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--good:#0b6b4f;--hold:#a85b00;--stop:#a01818}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;line-height:1.72}
    header{background:var(--navy);color:white;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(28px,4vw,40px);letter-spacing:0;line-height:1.25}
    header p{margin:0;color:white;font-weight:800}
    main{max-width:1500px;margin:0 auto;padding:22px}
    section{background:white;border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:24px}
    .lead{border-left:7px solid #b76500;background:#fff7e7;color:#111;padding:12px 14px;margin:12px 0;font-weight:900;border-radius:8px}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;padding:13px;background:#fbfdff}
    .card b{display:block;color:var(--navy);font-size:16px}
    .card strong{display:block;font-size:28px;color:var(--blue)}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:white}
    table{width:100%;border-collapse:collapse;min-width:1450px;table-layout:fixed;font-size:13px}
    th,td{border:1px solid var(--line);padding:8px;vertical-align:top;overflow-wrap:anywhere;word-break:break-word;color:#111}
    th{background:#e5f1fa;color:#073b62;text-align:left;font-weight:900}
    .badge{display:inline-block;border-radius:999px;color:white;padding:4px 9px;font-weight:900;font-size:12px}
    .badge.good{background:var(--good)}.badge.hold{background:var(--hold)}.badge.stop{background:var(--stop)}
    .links a{display:inline-block;margin:6px 8px 0 0;background:var(--blue);color:white;text-decoration:none;border-radius:8px;padding:9px 12px;font-weight:900}
    .small{font-size:13px;color:#26394a}
    @media(max-width:980px){main{padding:12px}.cards{grid-template-columns:1fr}table{min-width:1200px}}
  </style>
</head>
<body>
<header>
  <h1>6月テーマ候補 実行判定表</h1>
  <p>作成: ${esc(generatedAt)} / テーマ候補を、6月に採用・保留・除外するための実務判定表です。</p>
</header>
<main>
  <section>
    <h2>1. 目的</h2>
    <p class="lead">この表は、半導体・データセンター・フィジカルAI・量子コンピューターを、購入候補と探索枠に混ぜないための表です。既存10社を基準にし、同じ確認項目で上回る場合だけ入れ替えまたは小比率採用を検討します。</p>
    <div class="cards">
      <div class="card"><b>基準</b><strong>既存10社</strong><span>ここを上回る説明が必要</span></div>
      <div class="card"><b>6月に比較</b><strong>半導体 / DC / TDK</strong><span>実データで確認</span></div>
      <div class="card"><b>補完後</b><strong>FA / ロボット</strong><span>受注・PER・反応待ち</span></div>
      <div class="card"><b>探索</b><strong>量子</strong><span>6月購入候補にしない</span></div>
    </div>
    <div class="links">
      <a href="891_june_theme_execution_matrix_20260605.csv">CSVを開く</a>
      <a href="890_june_theme_integration_gate_20260605.html">6月テーマ候補 統合ゲート</a>
      <a href="889_cross_channel_candidate_comparison_20260605.html">テーマ別候補 横並び比較</a>
      <a href="index.html">ホームへ戻る</a>
    </div>
  </section>

  <section>
    <h2>2. 銘柄別 実行判定</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th style="width:160px">テーマ</th>
            <th style="width:150px">銘柄</th>
            <th style="width:105px">役割</th>
            <th style="width:115px">現在の扱い</th>
            <th>必要データ</th>
            <th>通過条件</th>
            <th>停止条件</th>
            <th>6月の扱い</th>
            <th>理由</th>
          </tr>
        </thead>
        <tbody>${htmlRows}</tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>3. 使い方</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>手順</th><th>内容</th><th>判断</th></tr></thead>
        <tbody>
          <tr><td>1</td><td>6月CPI、日銀、FOMC後の市場データを入れる。</td><td>金利急騰、円高ショック、指数急落があれば候補追加を止める。</td></tr>
          <tr><td>2</td><td>テーマ候補ごとに、受注・利益率・PER/PBR/ROE・決算後反応を確認する。</td><td>未確認のまま購入候補へ昇格させない。</td></tr>
          <tr><td>3</td><td>既存10社と、指数超過・下落耐性・事業寄与・データ信頼度で比較する。</td><td>既存10社を上回る説明ができる場合だけ入れ替えまたは小比率採用を検討する。</td></tr>
          <tr><td>4</td><td>量子コンピューターは商用化・受注・売上寄与が出るまで監視枠に置く。</td><td>話題性だけで6月NISA 1年テストに入れない。</td></tr>
        </tbody>
      </table>
    </div>
    <p class="small">この表は投資判断の確定表ではありません。6月イベント後に実データを入れ、証券会社画面と公式決算を確認した上で最終判断します。</p>
  </section>
</main>
</body>
</html>`;

const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
fs.writeFileSync(path.join(ROOT, "891_june_theme_execution_matrix_20260605.csv"), `\uFEFF${csv}\n`, "utf8");
fs.writeFileSync(path.join(ROOT, "891_june_theme_execution_matrix_20260605.html"), html, "utf8");

const link = '<a class="button secondary" href="891_june_theme_execution_matrix_20260605.html">6月テーマ候補 実行判定表</a>';
for (const file of ["index.html", "practical_action_dashboard_20260528.html", "890_june_theme_integration_gate_20260605.html"]) {
  const filePath = path.join(ROOT, file);
  if (!fs.existsSync(filePath)) continue;
  let text = fs.readFileSync(filePath, "utf8");
  if (text.includes("891_june_theme_execution_matrix_20260605.html")) continue;
  if (text.includes("890_june_theme_integration_gate_20260605.html")) {
    text = text.replace(/(<a[^>]+href="890_june_theme_integration_gate_20260605\.html"[^>]*>.*?<\/a>)/s, `$1\n      ${link}`);
  } else if (text.includes("</section>")) {
    text = text.replace("</section>", `<div class="links">${link}</div></section>`);
  }
  fs.writeFileSync(filePath, text, "utf8");
}

console.log("wrote 891_june_theme_execution_matrix_20260605.html");
console.log("wrote 891_june_theme_execution_matrix_20260605.csv");
