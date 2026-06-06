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

const esc = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const primaryLinks = [
  ["実用パート入口", "896_practical_entry_hub_20260606.html", "毎日見る画面と補足資料を分けた入口。迷ったらここから確認する。"],
  ["6月実行コックピット", "895_june_execution_cockpit_20260606.html", "6月のイベント、見る指標、止める条件、次の作業を1画面で確認する。"],
  ["6月イベント判定エンジン", "893_june_event_gate_engine_20260606.html", "CPI、日銀、FOMC後の市場状態を緑・黄・赤で整理する。"],
  ["候補別アクション分岐表", "894_june_candidate_action_after_gate_20260606.html", "イベント後に各候補を残す、保留、落とすのどれで扱うか確認する。"],
];

const scheduleRows = [
  {
    date: "6/10",
    event: "米CPI",
    watch: "CPI、米10年金利、SOX、NASDAQ、VIX、ドル円",
    stop: "CPI悪化と米金利急騰が同時に出る場合、半導体・AI関連の追加判断を止める。",
    next: "数値をイベント判定エンジンへ入力し、テーマ候補の扱いを再判定する。",
  },
  {
    date: "6/15-16",
    event: "日銀会合",
    watch: "政策金利、声明文、ドル円、日本10年金利、日経平均、TOPIX",
    stop: "急な円高、銀行・輸出・半導体への大きな逆風が出る場合は購入判断を保留する。",
    next: "金融、商社、輸出、半導体装置の扱いを分けて確認する。",
  },
  {
    date: "6/16-17",
    event: "FOMC",
    watch: "政策金利、ドットプロット、FRB議長会見、米10年金利、VIX、NASDAQ",
    stop: "米金利急騰、VIX急騰、NASDAQ/SOX急落が重なる場合は攻め枠を止める。",
    next: "6/18以降の一次再判定で、候補10社とテーマ候補を分けて処理する。",
  },
  {
    date: "6/18以降",
    event: "一次再判定",
    watch: "3イベント後の色判定、候補別スコア、指数差、直近下落、未確認データ",
    stop: "赤判定が残る、または根拠不足の銘柄は購入候補に進めない。",
    next: "候補別の購入可否、保留理由、入れ替え候補を記録する。",
  },
];

const candidateRows = [
  {
    group: "チャンネル1 総合候補",
    role: "既存の総合候補を基準にする",
    use: "量的スコア、長期安定性、指数比較、下落耐性を優先して見る。",
    caution: "未確認データが残る銘柄は、スコアが高くても購入確定にしない。",
  },
  {
    group: "チャンネル2 半導体製造装置・材料",
    role: "半導体テーマの攻め枠",
    use: "SOX、NASDAQ、米金利、受注・利益率、PER/PBR/ROEを確認して扱う。",
    caution: "高PER、高ボラ、直近過熱が強い場合は比率を下げるか保留する。",
  },
  {
    group: "チャンネル3 データセンター・電力・冷却・電線",
    role: "AI需要の周辺インフラ枠",
    use: "電力需要、冷却、電線、データセンター投資の構造需要を確認する。",
    caution: "テーマが正しくても株価に織り込み済みの場合があるため、過熱確認を必須にする。",
  },
  {
    group: "フィジカルAI",
    role: "補完後に昇格候補",
    use: "FA、センサー、ロボット、電子部品の実需と決算成長を分けて見る。",
    caution: "テーマ名だけでは採用しない。決算と株価反応の両方が必要。",
  },
  {
    group: "量子コンピューター",
    role: "監視枠",
    use: "ニュース、提携、研究開発、関連部材を観察する。",
    caution: "現時点では6月NISA 1年テストの中心候補ではなく、作業中の探索枠とする。",
  },
];

const nisaLinks = [
  ["NISA口座運用ハブ", "882_nisa_account_operation_hub_20260605.html", "本人操作、証券会社確認、注文票、口座区分の入口。"],
  ["NISA購入準備ダッシュボード", "883_nisa_readiness_dashboard_20260605.html", "本人別の準備状況、スマホ、入金、注文票の進捗を見る。"],
  ["証券会社確認テンプレート", "884_nisa_broker_contact_templates_20260605.html", "代理人登録、本人操作、注文時の確認事項を証券会社へ聞くための整理。"],
  ["本人別注文票テンプレート", "879_nisa_person_order_ticket_20260605.html", "本人が確認して発注するための注文票。"],
];

const candidateReviewLinks = [
  ["3チャンネル横並び比較", "889_cross_channel_candidate_comparison_20260605.html", "総合、半導体製造装置・材料、データセンター・電力・冷却・電線を混ぜずに比較する。"],
  ["100社母集団からの再選定10社", "universe100_reselected_10_candidates_20260528.html", "約100社の母集団から、量的指標を使って候補を絞った表を確認する。"],
  ["統合再計算10社", "integrated_recalculated_10_20260528.html", "既存選定スコアと追加指標を並べ、総合候補として残った銘柄を確認する。"],
  ["半導体・AIインフラ 分野別10社", "theme20_separate_screened10_20260529.html", "半導体製造装置・材料と、データセンター・電力・冷却・電線を分けて見る。"],
  ["フィジカルAI・量子 候補整理", "886_quantum_physical_ai_screening_20260605.html", "探索枠の候補を購入候補と混同せず、作業中の候補として確認する。"],
  ["フィジカルAI・量子 数値接続", "887_quantum_physical_ai_quant_connection_20260605.html", "テーマ候補を既存の量的データへ接続できるか確認する。"],
];

const detailLinks = [
  ["テーマ候補 実行判定表", "891_june_theme_execution_matrix_20260605.html", "各テーマ候補を残す条件、止める条件、必要データを確認する。"],
  ["テーマ候補 統合ゲート", "890_june_theme_integration_gate_20260605.html", "既存10社とテーマ候補を混ぜずに比較するためのゲート。"],
  ["イベント実数入力・入替記録", "892_june_event_actual_input_and_replacement_log_20260606.html", "イベント後の実数、候補入替、理由を記録する。"],
  ["税制確認 Phase 1", "842_tax_aware_operation_layer_phase1_20260602.html", "NISA向き、課税口座向き、損益通算などの確認補助。"],
  ["NISA口座注意PDF", "nisa_multi_account_pc_ip_risk_report_20260531.pdf", "本人操作、別名義口座、誤解を避ける運用方法の確認資料。"],
];

const cardLinks = (links) => links.map(([title, url, desc]) => `
  <a class="card" href="${esc(url)}">
    <b>${esc(title)}</b>
    <span>${esc(desc)}</span>
  </a>
`).join("");

const scheduleHtml = scheduleRows.map((row) => `
  <tr>
    <td><b>${esc(row.date)}</b></td>
    <td>${esc(row.event)}</td>
    <td>${esc(row.watch)}</td>
    <td>${esc(row.stop)}</td>
    <td>${esc(row.next)}</td>
  </tr>
`).join("");

const candidateHtml = candidateRows.map((row) => `
  <tr>
    <td><b>${esc(row.group)}</b></td>
    <td>${esc(row.role)}</td>
    <td>${esc(row.use)}</td>
    <td>${esc(row.caution)}</td>
  </tr>
`).join("");

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>実用ダッシュボード</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--amber:#a85b00;--red:#a01818}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;line-height:1.7}
    header{background:var(--navy);color:white;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);letter-spacing:0;line-height:1.2}
    header p{margin:0;color:white;font-weight:800}
    main{max-width:1450px;margin:0 auto;padding:22px}
    section{background:white;border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08)}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:24px;line-height:1.35}
    .notice{border-left:7px solid var(--amber);background:#fff7e7;color:#111;padding:12px 14px;margin:0 0 18px;font-weight:900;border-radius:8px}
    .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .card{display:block;text-decoration:none;color:var(--ink);border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card:hover{border-color:var(--blue);box-shadow:0 0 0 2px rgba(11,103,163,.08) inset}
    .card b{display:block;color:var(--navy);font-size:17px;margin-bottom:5px}
    .card span{display:block;color:#263e55;font-size:14px;font-weight:800}
    .quick{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:18px}
    .quick a{display:block;text-align:center;text-decoration:none;background:var(--blue);color:white;border-radius:10px;padding:12px;font-weight:900}
    table{width:100%;border-collapse:collapse;table-layout:fixed}
    th,td{border:1px solid var(--line);padding:10px;vertical-align:top;overflow-wrap:anywhere}
    th{background:#e5f1fb;color:var(--navy);text-align:left}
    tr{break-inside:avoid}
    .small{font-size:13px;color:#354b60;font-weight:800}
    .red{color:var(--red);font-weight:900}
    footer{font-size:13px;color:#526b82;margin:20px 0}
    @media(max-width:980px){main{padding:12px}.grid,.quick{grid-template-columns:1fr}table{font-size:14px}}
  </style>
</head>
<body>
<header>
  <h1>6月NISA 1年テスト 実用ダッシュボード</h1>
  <p>作成: ${esc(generatedAt)} / 毎日見る項目、止める条件、次に行う作業を1画面で確認する入口です。</p>
</header>
<main>
  <p class="notice">この画面は購入確定、投資助言、自動売買の画面ではありません。購入前には証券会社画面、公式決算資料、6月イベント後の実データを確認します。</p>

  <div class="quick">
    <a href="896_practical_entry_hub_20260606.html">実用パート入口</a>
    <a href="895_june_execution_cockpit_20260606.html">実行コックピット</a>
    <a href="893_june_event_gate_engine_20260606.html">イベント判定</a>
    <a href="894_june_candidate_action_after_gate_20260606.html">候補別分岐</a>
  </div>

  <section>
    <h2>1. 今日最初に見る画面</h2>
    <div class="grid">${cardLinks(primaryLinks)}</div>
  </section>

  <section>
    <h2>2. 6月の確認順</h2>
    <table>
      <thead><tr><th style="width:8%">日付</th><th style="width:12%">イベント</th><th>見る数値</th><th>止める条件</th><th>次の作業</th></tr></thead>
      <tbody>${scheduleHtml}</tbody>
    </table>
  </section>

  <section>
    <h2>3. 候補の扱い</h2>
    <table>
      <thead><tr><th style="width:25%">区分</th><th style="width:18%">役割</th><th>使い方</th><th>注意点</th></tr></thead>
      <tbody>${candidateHtml}</tbody>
    </table>
  </section>

  <section>
    <h2>4. 候補比較へ進む</h2>
    <p class="small">候補は1つの表で混ぜず、総合候補、半導体製造装置・材料、データセンター・電力・冷却・電線、探索枠に分けて確認します。</p>
    <div class="grid">${cardLinks(candidateReviewLinks)}</div>
  </section>

  <section>
    <h2>5. NISA準備・口座運用</h2>
    <p class="small"><span class="red">本人操作、本人確認、口座区分の確認を前提にします。</span> ここは購入前の実務準備を整理する場所です。</p>
    <div class="grid">${cardLinks(nisaLinks)}</div>
  </section>

  <section>
    <h2>6. 補足資料・記録</h2>
    <div class="grid">${cardLinks(detailLinks)}</div>
  </section>

  <footer>未確認データ、公式決算、証券会社画面の確認が残る場合は、購入判断に進めません。</footer>
</main>
</body>
</html>`;

const csvRows = [
  ["category", "title_or_date", "url_or_event", "description_1", "description_2"],
  ...primaryLinks.map(([title, url, desc]) => ["primary_link", title, url, desc, ""]),
  ...scheduleRows.map((row) => ["schedule", row.date, row.event, row.watch, `${row.stop} / ${row.next}`]),
  ...candidateRows.map((row) => ["candidate_handling", row.group, row.role, row.use, row.caution]),
  ...candidateReviewLinks.map(([title, url, desc]) => ["candidate_review_link", title, url, desc, ""]),
  ...nisaLinks.map(([title, url, desc]) => ["nisa_link", title, url, desc, ""]),
  ...detailLinks.map(([title, url, desc]) => ["detail_link", title, url, desc, ""]),
];

fs.writeFileSync(path.join(ROOT, "897_practical_dashboard_links_20260606.csv"), `\uFEFF${csvRows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`, "utf8");
fs.writeFileSync(path.join(ROOT, "practical_action_dashboard_20260528.html"), html, "utf8");

console.log("wrote practical_action_dashboard_20260528.html");
console.log("wrote 897_practical_dashboard_links_20260606.csv");
