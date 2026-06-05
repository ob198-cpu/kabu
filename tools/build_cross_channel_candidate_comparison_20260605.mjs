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
    channel: "総合候補",
    priority: 1,
    ticker: "8053.T",
    name: "住友商事",
    status: "主候補",
    basis: "既存10社側で、商社・資源・還元・長期株価の総合確認に使う。",
    strength: "指数比較、資源価格、株主還元、景気循環を見やすい。",
    risk: "資源価格・為替・景気循環に左右される。",
    nextCheck: "6月イベント後に資源価格、ドル円、日経/TOPIX、決算後反応を確認。",
    juneUse: "比較軸",
  },
  {
    channel: "総合候補",
    priority: 2,
    ticker: "8316.T",
    name: "三井住友FG",
    status: "主候補",
    basis: "金利・銀行・配当/還元の軸として、既存10社側で中心確認。",
    strength: "金利上昇時の利ざや改善、低PER寄り、配当・還元を説明しやすい。",
    risk: "日銀方針、信用コスト、景気悪化、銀行株全体の反応。",
    nextCheck: "日銀会合後の金利、銀行株指数、信用コスト見通しを確認。",
    juneUse: "比較軸",
  },
  {
    channel: "総合候補",
    priority: 3,
    ticker: "6503.T",
    name: "三菱電機",
    status: "複合候補",
    basis: "総合、データセンター/電力、フィジカルAI、量子周辺の複合テーマにまたがる。",
    strength: "電力制御、FA、冷却・データセンター周辺、防衛/安全保障にも接続。",
    risk: "テーマが広いため、どの事業が実際に伸びているか分離が必要。",
    nextCheck: "セグメント別売上、受注、営業利益率、電力/FAの寄与を確認。",
    juneUse: "比較軸",
  },
  {
    channel: "半導体材料・製造装置",
    priority: 1,
    ticker: "6857.T",
    name: "アドバンテスト",
    status: "条件付き候補",
    basis: "AI半導体テスター需要に直接接続するが、直近急騰と高PERを確認する。",
    strength: "AI/HPC向け検査需要と連動しやすい。",
    risk: "急騰後の反落、高PER、半導体サイクルの悪化。",
    nextCheck: "決算後反応、SOX指数、米金利、受注・ガイダンスを確認。",
    juneUse: "攻め枠候補",
  },
  {
    channel: "半導体材料・製造装置",
    priority: 2,
    ticker: "6146.T",
    name: "ディスコ",
    status: "条件付き候補",
    basis: "切断・研削・先端パッケージで構造需要に接続。",
    strength: "AI半導体の高度化・先端パッケージに連動しやすい。",
    risk: "値動きが大きく、過去最大下落も深い。",
    nextCheck: "月次/四半期売上、受注、決算後反応、下落耐性を確認。",
    juneUse: "攻め枠候補",
  },
  {
    channel: "半導体材料・製造装置",
    priority: 3,
    ticker: "8035.T",
    name: "東京エレクトロン",
    status: "補欠候補",
    basis: "前工程装置の中核。AI半導体設備投資の代表候補。",
    strength: "半導体設備投資全体に乗りやすい。",
    risk: "半導体サイクル、高PER確認、SOX指数悪化。",
    nextCheck: "SOX指数、米金利、設備投資見通し、決算ガイダンスを確認。",
    juneUse: "補欠",
  },
  {
    channel: "データセンター・電力・冷却・電線",
    priority: 1,
    ticker: "6501.T",
    name: "日立製作所",
    status: "主候補",
    basis: "電力網、変圧器、制御、デジタル基盤の複合テーマ。",
    strength: "AIデータセンター拡大による電力・制御需要に接続。",
    risk: "大型株でテーマ寄与の分離が必要。",
    nextCheck: "電力・送配電・デジタル事業の受注と利益率を確認。",
    juneUse: "守り寄り成長候補",
  },
  {
    channel: "データセンター・電力・冷却・電線",
    priority: 2,
    ticker: "5803.T",
    name: "フジクラ",
    status: "条件付き候補",
    basis: "高速ケーブル、光通信、データセンター需要に直接接続。",
    strength: "AIデータセンターの通信・電線テーマとして反応が大きい。",
    risk: "直近急騰、過熱、下落時の振れ幅。",
    nextCheck: "受注、利益率、急騰後の押し目、出来高を確認。",
    juneUse: "攻め枠候補",
  },
  {
    channel: "データセンター・電力・冷却・電線",
    priority: 3,
    ticker: "7011.T",
    name: "三菱重工業",
    status: "条件付き候補",
    basis: "電力、冷却、大型インフラ、防衛の複合テーマ。",
    strength: "AIインフラだけでなく、防衛・発電・大型設備に接続。",
    risk: "テーマが広く、直近値動きと事業寄与の分離が必要。",
    nextCheck: "電力・防衛・受注残、直近株価反応を確認。",
    juneUse: "条件付き",
  },
  {
    channel: "フィジカルAI",
    priority: 1,
    ticker: "6762.T",
    name: "TDK",
    status: "数値確認済み",
    basis: "既存100社データに接続済み。電源、センサー、電子部品、AIサーバー周辺の複合候補。",
    strength: "既存スコア66、PER/PBR/ROE等の主要指標が接続済み。",
    risk: "電子部品サイクル、スマホ需要、テーマ別売上寄与の分離。",
    nextCheck: "電源・センサー寄与、決算後反応、電子部品サイクルを確認。",
    juneUse: "フィジカルAI代表候補",
  },
  {
    channel: "フィジカルAI",
    priority: 2,
    ticker: "6954.T",
    name: "ファナック",
    status: "昇格検討",
    basis: "FA、CNC、産業用ロボット。実需に近いが追加確認が必要。",
    strength: "ロボット需要・工作機械需要に直接接続。",
    risk: "既存スコア52、PER38.82、設備投資サイクル、決算後反応不足。",
    nextCheck: "ロボット受注、工作機械需要、決算後反応、指数差を確認。",
    juneUse: "補完後候補",
  },
  {
    channel: "フィジカルAI",
    priority: 3,
    ticker: "6861.T",
    name: "キーエンス",
    status: "昇格検討",
    basis: "センサー、画像処理、FAデータ取得。物理空間のAI入力側。",
    strength: "高収益・高品質企業として説明しやすい。",
    risk: "PER未取得、高PERになりやすい、金利上昇時の下落リスク。",
    nextCheck: "PER、利益率、海外売上、FA投資回復、決算後反応を確認。",
    juneUse: "補完後候補",
  },
  {
    channel: "量子コンピューター",
    priority: 1,
    ticker: "6702.T",
    name: "富士通",
    status: "長期探索",
    basis: "国産量子、HPC、AI基盤。既存数値は接続済みだが、量子売上寄与は未分離。",
    strength: "国策・研究開発テーマとして監視価値がある。",
    risk: "1年NISAでは量子単独の株価説明力が弱い。",
    nextCheck: "量子関連の商用サービス、受注、売上寄与を確認。",
    juneUse: "購入候補化しない",
  },
  {
    channel: "量子コンピューター",
    priority: 2,
    ticker: "6701.T",
    name: "NEC",
    status: "長期探索",
    basis: "量子、AI、防衛ITの複合テーマ。",
    strength: "安全保障・AI基盤・ITサービスと複合評価できる。",
    risk: "量子単独の寄与が見えにくく、既存スコアも強くない。",
    nextCheck: "量子案件、防衛IT、AI基盤の売上寄与を分ける。",
    juneUse: "購入候補化しない",
  },
];

const headers = ["channel", "priority", "ticker", "name", "status", "basis", "strength", "risk", "nextCheck", "juneUse"];
const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const esc = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

function tableRows(list) {
  return list.map((row) => `
    <tr>
      <td>${esc(row.channel)}</td>
      <td>${esc(row.priority)}</td>
      <td><b>${esc(row.ticker)} ${esc(row.name)}</b></td>
      <td><span class="badge ${row.status.includes("主") || row.status.includes("数値") ? "good" : row.status.includes("長期") || row.status.includes("しない") ? "watch" : "hold"}">${esc(row.status)}</span></td>
      <td>${esc(row.basis)}</td>
      <td>${esc(row.strength)}</td>
      <td>${esc(row.risk)}</td>
      <td>${esc(row.nextCheck)}</td>
      <td>${esc(row.juneUse)}</td>
    </tr>
  `).join("");
}

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>テーマ別候補 横並び比較</title>
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
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.card{border:1px solid var(--line);border-radius:10px;padding:13px;background:#fbfdff}.card b{display:block;color:var(--navy);font-size:17px}.card strong{display:block;font-size:28px;color:var(--blue)}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:white}
    table{width:100%;border-collapse:collapse;min-width:1380px;table-layout:fixed;font-size:13px}
    th,td{border:1px solid var(--line);padding:8px;vertical-align:top;overflow-wrap:anywhere;word-break:break-word;color:#111}
    th{background:#e5f1fa;color:#073b62;text-align:left;font-weight:900}
    .badge{display:inline-block;border-radius:999px;color:white;padding:4px 9px;font-weight:900;font-size:12px}.badge.good{background:var(--good)}.badge.hold{background:var(--hold)}.badge.watch{background:var(--watch)}
    .links a{display:inline-block;margin:6px 8px 0 0;background:var(--blue);color:white;text-decoration:none;border-radius:8px;padding:9px 12px;font-weight:900}
    @media(max-width:980px){main{padding:12px}.cards{grid-template-columns:1fr}table{min-width:1180px}}
  </style>
</head>
<body>
<header>
  <h1>テーマ別候補 横並び比較</h1>
  <p>作成: ${esc(generatedAt)} / 総合候補、半導体材料・製造装置、データセンター・電力、フィジカルAI、量子を同じ画面で確認します。</p>
</header>
<main>
  <section>
    <h2>1. 結論</h2>
    <p class="notice">6月テスト候補に近いのは、既存の総合候補、半導体/データセンターの条件付き候補、フィジカルAIの数値確認済み・補完可能銘柄です。量子コンピューターは重要テーマですが、現時点では購入候補ではなく長期探索枠として扱います。</p>
    <div class="cards">
      <div class="card"><b>総合候補</b><strong>3</strong><span>既存10社側の代表確認</span></div>
      <div class="card"><b>AIインフラ</b><strong>6</strong><span>半導体・データセンター側</span></div>
      <div class="card"><b>フィジカルAI</b><strong>3</strong><span>数値補完後に昇格検討</span></div>
      <div class="card"><b>量子</b><strong>2</strong><span>購入候補化しない探索枠</span></div>
    </div>
    <div class="links">
      <a href="889_cross_channel_candidate_comparison_20260605.csv">CSVを開く</a>
      <a href="888_quantum_physical_ai_promotion_queue_20260605.html">フィジカルAI・量子 昇格作業キュー</a>
      <a href="887_quantum_physical_ai_quant_connection_20260605.html">既存数値接続チェック</a>
      <a href="index.html">ホームへ戻る</a>
    </div>
  </section>

  <section>
    <h2>2. 横並び比較</h2>
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th style="width:150px">枠</th><th style="width:55px">順</th><th style="width:180px">銘柄</th><th style="width:120px">扱い</th><th>根拠</th><th>強み</th><th>リスク</th><th>次に見る数字</th><th style="width:120px">6月での扱い</th></tr>
        </thead>
        <tbody>${tableRows(rows)}</tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>3. 次の判断</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>判断</th><th>内容</th><th>理由</th></tr></thead>
        <tbody>
          <tr><td>購入候補に近い</td><td>既存総合候補、TDK、日立、フジクラ、アドバンテスト、ディスコなど</td><td>既に数値接続済み、またはテーマと事業の接続が比較的明確。</td></tr>
          <tr><td>補完後に検討</td><td>ファナック、キーエンス、安川電機、東京エレクトロン、三菱重工業など</td><td>テーマは強いが、受注、決算後反応、割高度、下落耐性の確認が必要。</td></tr>
          <tr><td>探索枠</td><td>量子コンピューター銘柄</td><td>話題性はあるが、1年NISAの購入候補にするには商用売上と株価反応の証拠が不足。</td></tr>
        </tbody>
      </table>
    </div>
  </section>
</main>
</body>
</html>`;

const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))].join("\n");
fs.writeFileSync(path.join(ROOT, "889_cross_channel_candidate_comparison_20260605.csv"), `\uFEFF${csv}\n`, "utf8");
fs.writeFileSync(path.join(ROOT, "889_cross_channel_candidate_comparison_20260605.html"), html, "utf8");

for (const file of ["index.html", "practical_action_dashboard_20260528.html", "888_quantum_physical_ai_promotion_queue_20260605.html"]) {
  const filePath = path.join(ROOT, file);
  if (!fs.existsSync(filePath)) continue;
  let text = fs.readFileSync(filePath, "utf8");
  if (text.includes("889_cross_channel_candidate_comparison_20260605.html")) continue;
  const link = '<a class="button secondary" href="889_cross_channel_candidate_comparison_20260605.html">テーマ別候補 横並び比較</a>';
  if (text.includes("888_quantum_physical_ai_promotion_queue_20260605.html")) {
    text = text.replace(/(<a[^>]+href="888_quantum_physical_ai_promotion_queue_20260605\.html"[^>]*>.*?<\/a>)/s, `$1\n      ${link}`);
  } else if (text.includes("886_quantum_physical_ai_screening_20260605.html")) {
    text = text.replace(/(<a[^>]+href="886_quantum_physical_ai_screening_20260605\.html"[^>]*>.*?<\/a>)/s, `$1\n      ${link}`);
  }
  fs.writeFileSync(filePath, text, "utf8");
}

console.log("wrote 889_cross_channel_candidate_comparison_20260605.html");
console.log("wrote 889_cross_channel_candidate_comparison_20260605.csv");
