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
    step: 1,
    lane: "既存総合候補",
    target: "既存10社",
    currentUse: "基準候補",
    promoteCondition: "6月CPI、日銀、FOMC後に指数急落・金利急騰・円高ショックがない。候補銘柄の決算後反応が悪化していない。",
    rejectCondition: "S&P500/TOPIXを+1%以上上回る説明が弱い、または候補内に未取得データが残る。",
    action: "既存10社を基準に置き、テーマ枠を入れる場合もこの候補群と比較する。",
    reason: "テーマ銘柄だけを追加すると、既存候補より本当に良いか説明できないため。",
  },
  {
    step: 2,
    lane: "半導体材料・製造装置",
    target: "アドバンテスト、ディスコ、東京エレクトロン等",
    currentUse: "攻め枠候補",
    promoteCondition: "SOX指数が崩れていない、米金利が急騰していない、決算ガイダンスまたは受注が悪化していない、急騰後の過熱が許容範囲。",
    rejectCondition: "PER過熱、直近急騰後の反落、決算後反応悪化、最大下落リスクを説明できない。",
    action: "既存10社から攻め枠を増やす場合の比較対象にする。全額投入ではなく小比率候補。",
    reason: "AI需要に接続しやすいが、値動きと金利感応度が大きいため。",
  },
  {
    step: 3,
    lane: "データセンター・電力・冷却・電線",
    target: "日立、フジクラ、三菱重工業等",
    currentUse: "構造需要候補",
    promoteCondition: "電力・送配電・光通信・冷却需要が決算や受注に出ている。直近急騰だけでなく利益率・受注残で説明できる。",
    rejectCondition: "テーマは強いが株価に織り込み済み、急騰後、受注・利益率が確認できない。",
    action: "6月テストで最も現実的に比較するテーマ枠。既存総合候補と重複する銘柄は総合側で扱う。",
    reason: "AI需要からデータセンター、電力、通信、冷却へ資金流入する連鎖を説明しやすい。",
  },
  {
    step: 4,
    lane: "フィジカルAI",
    target: "TDK、ファナック、キーエンス、ニデック、安川電機",
    currentUse: "補完後に昇格検討",
    promoteCondition: "既存100社データに接続済み、PER/PBR/ROE、売上・利益成長、下落率、決算後反応、受注または利益率の確認がそろう。",
    rejectCondition: "テーマだけで事業寄与が確認できない、PER過熱、設備投資サイクル悪化、データ未接続。",
    action: "TDKは代表候補として比較へ進める。ファナック・キーエンス・ニデック・安川電機は不足データ補完後に再判定。",
    reason: "物理空間でAIが動く場合のロボット・制御・センサー需要に接続するが、現時点では全銘柄が購入候補ではないため。",
  },
  {
    step: 5,
    lane: "量子コンピューター",
    target: "富士通、NEC、NTT、日立、三菱電機等",
    currentUse: "長期探索",
    promoteCondition: "量子関連の商用サービス、受注、売上寄与、決算説明での定量開示、イベント後の株価反応が確認できる。",
    rejectCondition: "国策・研究開発・話題性だけで、売上寄与または株価反応が確認できない。",
    action: "6月NISA 1年テストでは購入候補にしない。監視コーナーで継続観察する。",
    reason: "1年保有で指数を上回る説明には、テーマ性だけでなく商用化・売上・株価反応が必要なため。",
  },
  {
    step: 6,
    lane: "最終10社への反映",
    target: "全チャンネル",
    currentUse: "統合判定",
    promoteCondition: "既存候補より、指数超過、下落耐性、決算後反応、事業寄与、データ信頼度で上回る。",
    rejectCondition: "既存候補を上回る説明ができない、または未取得データが購入判断に残る。",
    action: "既存10社を置き換える場合は、置き換え前後の理由を表で残す。",
    reason: "恣意的な銘柄入れ替えに見えないよう、同じ条件で比較するため。",
  },
];

const headers = ["step", "lane", "target", "currentUse", "promoteCondition", "rejectCondition", "action", "reason"];
const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const esc = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

function tableRows() {
  return rows.map((row) => `
    <tr>
      <td>${esc(row.step)}</td>
      <td><b>${esc(row.lane)}</b><br><small>${esc(row.target)}</small></td>
      <td><span class="badge ${row.currentUse.includes("基準") || row.currentUse.includes("構造") ? "good" : row.currentUse.includes("長期") ? "watch" : "hold"}">${esc(row.currentUse)}</span></td>
      <td>${esc(row.promoteCondition)}</td>
      <td>${esc(row.rejectCondition)}</td>
      <td>${esc(row.action)}</td>
      <td>${esc(row.reason)}</td>
    </tr>
  `).join("");
}

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月テーマ候補 統合ゲート</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--good:#0b6b4f;--hold:#a85b00;--watch:#455a6f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;line-height:1.7}
    header{background:var(--navy);color:white;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(28px,4vw,40px);letter-spacing:0;line-height:1.25}
    header p{margin:0;color:white;font-weight:800}
    main{max-width:1460px;margin:0 auto;padding:22px}
    section{background:white;border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:24px}
    .notice{border-left:7px solid #b76500;background:#fff7e7;color:#111;padding:12px 14px;margin:12px 0;font-weight:800;border-radius:8px}
    .cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.card{border:1px solid var(--line);border-radius:10px;padding:13px;background:#fbfdff}.card b{display:block;color:var(--navy);font-size:17px}.card strong{display:block;font-size:28px;color:var(--blue)}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:white}
    table{width:100%;border-collapse:collapse;min-width:1320px;table-layout:fixed;font-size:13px}
    th,td{border:1px solid var(--line);padding:8px;vertical-align:top;overflow-wrap:anywhere;word-break:break-word;color:#111}
    th{background:#e5f1fa;color:#073b62;text-align:left;font-weight:900}
    .badge{display:inline-block;border-radius:999px;color:white;padding:4px 9px;font-weight:900;font-size:12px}.badge.good{background:var(--good)}.badge.hold{background:var(--hold)}.badge.watch{background:var(--watch)}
    .links a{display:inline-block;margin:6px 8px 0 0;background:var(--blue);color:white;text-decoration:none;border-radius:8px;padding:9px 12px;font-weight:900}
    @media(max-width:980px){main{padding:12px}.cards{grid-template-columns:1fr}table{min-width:1120px}}
  </style>
</head>
<body>
<header>
  <h1>6月テーマ候補 統合ゲート</h1>
  <p>作成: ${esc(generatedAt)} / テーマ候補を6月NISAテストに入れるかどうかを、既存候補と同じ条件で判断するための表です。</p>
</header>
<main>
  <section>
    <h2>1. 結論</h2>
    <p class="notice">6月テストでは、既存総合候補を基準に置き、半導体・データセンター・フィジカルAIのうち、実データで既存候補を上回る説明ができるものだけを追加検討します。量子コンピューターは長期探索枠で、現時点では購入候補にしません。</p>
    <div class="cards">
      <div class="card"><b>基準</b><strong>既存10社</strong><span>ここを上回る説明が必要</span></div>
      <div class="card"><b>追加検討</b><strong>3テーマ</strong><span>半導体、データセンター、フィジカルAI</span></div>
      <div class="card"><b>探索</b><strong>量子</strong><span>6月購入候補には入れない</span></div>
    </div>
    <div class="links">
      <a href="890_june_theme_integration_gate_20260605.csv">CSVを開く</a>
      <a href="889_cross_channel_candidate_comparison_20260605.html">テーマ別候補 横並び比較</a>
      <a href="888_quantum_physical_ai_promotion_queue_20260605.html">フィジカルAI・量子 昇格作業キュー</a>
      <a href="index.html">ホームへ戻る</a>
    </div>
  </section>

  <section>
    <h2>2. 統合ゲート</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th style="width:48px">順</th><th style="width:210px">枠/対象</th><th style="width:120px">現時点の扱い</th><th>昇格条件</th><th>見送り条件</th><th>実行すること</th><th>理由</th></tr>
        </thead>
        <tbody>${tableRows()}</tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>3. 実務上の答え</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>問い</th><th>答え</th></tr></thead>
        <tbody>
          <tr><td>フィジカルAIは6月テストに入れるか</td><td>今すぐ全体を入れない。TDKを代表候補として比較し、ファナック・キーエンス・安川電機はデータ補完後に再判定する。</td></tr>
          <tr><td>量子コンピューターは6月テストに入れるか</td><td>入れない。長期監視はするが、商用売上・受注・株価反応が弱い段階ではNISA 1年候補にしない。</td></tr>
          <tr><td>テーマ枠を既存10社にどう反映するか</td><td>既存10社より、指数超過、下落耐性、決算後反応、事業寄与で上回る場合だけ、入れ替えまたは少額テーマ枠として検討する。</td></tr>
        </tbody>
      </table>
    </div>
  </section>
</main>
</body>
</html>`;

const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
fs.writeFileSync(path.join(ROOT, "890_june_theme_integration_gate_20260605.csv"), `\uFEFF${csv}\n`, "utf8");
fs.writeFileSync(path.join(ROOT, "890_june_theme_integration_gate_20260605.html"), html, "utf8");

for (const file of ["index.html", "practical_action_dashboard_20260528.html", "889_cross_channel_candidate_comparison_20260605.html"]) {
  const filePath = path.join(ROOT, file);
  if (!fs.existsSync(filePath)) continue;
  let text = fs.readFileSync(filePath, "utf8");
  if (text.includes("890_june_theme_integration_gate_20260605.html")) continue;
  const link = '<a class="button secondary" href="890_june_theme_integration_gate_20260605.html">6月テーマ候補 統合ゲート</a>';
  if (text.includes("889_cross_channel_candidate_comparison_20260605.html")) {
    text = text.replace(/(<a[^>]+href="889_cross_channel_candidate_comparison_20260605\.html"[^>]*>.*?<\/a>)/s, `$1\n      ${link}`);
  } else if (text.includes("</section>")) {
    text = text.replace("</section>", `<div class="links">${link}</div></section>`);
  }
  fs.writeFileSync(filePath, text, "utf8");
}

console.log("wrote 890_june_theme_integration_gate_20260605.html");
console.log("wrote 890_june_theme_integration_gate_20260605.csv");
