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

const sections = [
  {
    title: "実用パート",
    lead: "日々の確認、6月イベント後の判定、候補別アクションを見る入口です。",
    primary: true,
    links: [
      ["実用パート入口", "896_practical_entry_hub_20260606.html", "迷ったらここから。実用画面、候補判断、NISA準備、補足資料に分けた入口。"],
      ["候補10社 最終確定ロジック", "898_final_candidate_selection_logic_20260606.html", "約100社から最大10社へ絞る固定ルール。採点、除外条件、6月イベント後の分類を確認。"],
      ["不足点10項目 回収実装", "899_gap_resolution_execution_20260606.html", "不足点を、必須データ、配分、売買、指数比較、税制、実用画面のゲートへ落とした版。"],
      ["不足点10項目 回収トラッカー", "913_gap_closure_tracker_20260606.html", "残っている不足点、次にやること、購入判断への影響を一覧で確認。"],
      ["最終10社 判定ワークベンチ", "908_final10_decision_workbench_20260606.html", "6月イベント後の確認状況を入力し、中心候補・条件付き・補欠・監視・除外へ分類する。"],
      ["現時点 判定スナップショット", "909_final10_current_snapshot_20260606.html", "ワークベンチの初期値をもとに、保守判定と緑通過後の仮判定を固定表示。"],
      ["購入前 最終ゲートチェック", "910_prebuy_final_gate_checklist_20260606.html", "候補、市場、NISA口座、税制、記録がそろっているかを購入前に確認する最終ゲート。"],
      ["候補10社 銘柄別アクション票", "911_ticker_action_tickets_20260606.html", "緑・黄判定時の扱い、停止条件、利確条件、追加確認を銘柄別に確認。"],
      ["6月イベント 実数入力シート", "912_june_event_actual_input_sheet_20260606.html", "CPI・日銀・FOMC後の実数と判定理由を入力し、購入前ゲートへつなげる。"],
      ["6月実行コックピット", "895_june_execution_cockpit_20260606.html", "6月イベント後に何を見るか、何なら止めるか、次に何をするかを見る。"],
      ["6月イベント判定エンジン", "893_june_event_gate_engine_20260606.html", "CPI、金利、SOX、NASDAQ、VIXなどを緑・黄・赤で判定する。"],
      ["6月候補別アクション分岐表", "894_june_candidate_action_after_gate_20260606.html", "市場ゲート後に銘柄ごとの扱いを確認する。"],
    ],
  },
  {
    title: "テーマ候補・選定根拠",
    lead: "既存10社、半導体、データセンター、フィジカルAI、量子を混同せずに確認します。",
    links: [
      ["候補10社 最終確定ロジック 固定版", "898_final_candidate_selection_logic_20260606.html", "選定の手順、スコア構造、ハード除外、最終分類を確認。"],
      ["6月テーマ候補 実行判定表", "891_june_theme_execution_matrix_20260605.html", "テーマ候補ごとの必要データ、通過条件、停止条件。"],
      ["6月テーマ候補 統合ゲート", "890_june_theme_integration_gate_20260605.html", "既存10社を基準に、テーマ枠を入れる条件を確認。"],
      ["テーマ別候補 横並び比較", "889_cross_channel_candidate_comparison_20260605.html", "総合、半導体、データセンター、フィジカルAI、量子を横並び比較。"],
      ["フィジカルAI・量子 昇格作業キュー", "888_quantum_physical_ai_promotion_queue_20260605.html", "購入候補に近いもの、補完後候補、長期探索を分ける。"],
    ],
  },
  {
    title: "NISA準備・口座運用",
    lead: "実際の購入前に、本人操作、証券会社確認、注文票、進捗を整理します。",
    links: [
      ["NISA口座運用ハブ", "882_nisa_account_operation_hub_20260605.html", "本人操作、証券会社確認、提案資料、注文票の入口。"],
      ["NISA購入準備 進捗ダッシュボード", "883_nisa_readiness_dashboard_20260605.html", "本人別の口座準備、スマホ準備、入金、注文票の進捗。"],
      ["NISA証券会社 確認依頼テンプレート", "884_nisa_broker_contact_templates_20260605.html", "証券会社へ確認する内容を整理。"],
      ["NISA本人別 注文票テンプレート", "879_nisa_person_order_ticket_20260605.html", "本人が確認して発注するための注文票。"],
    ],
  },
  {
    title: "記録・補足資料",
    lead: "判断理由、予想と実績、税制確認、注意事項を残すための資料です。",
    links: [
      ["6月イベント後 実データ入力・入替記録", "892_june_event_actual_input_and_replacement_log_20260606.html", "イベント後の実数と、候補を入れ替えた理由を記録。"],
      ["運用記録CSV", "https://raw.githubusercontent.com/ob198-cpu/kabu/main/operation_record_template_20260529.csv", "判断理由、予想、実績、差分を記録するテンプレート。"],
      ["税制レイヤー Phase 1", "842_tax_aware_operation_layer_phase1_20260602.html", "NISA、課税口座、損益通算などの確認補助。"],
      ["NISA口座操作時の注意 PDF", "nisa_multi_account_pc_ip_risk_report_20260531.pdf", "本人操作、別名義口座の注意点、誤解を避ける運用方法。"],
    ],
  },
];

const esc = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const sectionHtml = sections.map((section, index) => `
  <section class="${section.primary ? "primary-section" : ""}">
    <div class="section-head">
      <h2>${index + 1}. ${esc(section.title)}</h2>
      ${section.primary ? '<span class="badge">最初に見る</span>' : ""}
    </div>
    <p class="lead">${esc(section.lead)}</p>
    <div class="grid">
      ${section.links.map(([title, url, desc]) => `
        <a class="card" href="${esc(url)}">
          <b>${esc(title)}</b>
          <span>${esc(desc)}</span>
        </a>
      `).join("")}
    </div>
  </section>
`).join("");

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>株式購入判断補助システム</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--amber:#a85b00;--red:#a01818}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;line-height:1.7}
    header{background:var(--navy);color:white;padding:32px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,44px);letter-spacing:0;line-height:1.2}
    header p{margin:0;color:white;font-weight:800;max-width:1100px}
    main{max-width:1380px;margin:0 auto;padding:22px}
    .notice{border-left:7px solid var(--amber);background:#fff7e7;color:#111;padding:12px 14px;margin:0 0 18px;font-weight:900;border-radius:8px}
    .hero-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:18px}
    .hero-actions a{display:block;text-decoration:none;text-align:center;background:var(--blue);color:white;border-radius:10px;padding:14px;font-weight:900}
    .hero-actions a.secondary{background:white;color:var(--blue);border:1px solid var(--blue)}
    section{background:white;border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08)}
    .primary-section{border-color:#7bb6dd;box-shadow:0 0 0 2px rgba(11,103,163,.08),0 8px 20px rgba(20,60,90,.08)}
    .section-head{display:flex;gap:10px;align-items:center;justify-content:space-between;margin-bottom:6px}
    h2{margin:0;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:24px}
    .badge{display:inline-block;background:var(--red);color:white;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:900;white-space:nowrap}
    .lead{margin:0 0 12px;font-weight:800;color:#1b3349}
    .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .card{display:block;text-decoration:none;color:var(--ink);border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card:hover{border-color:var(--blue);box-shadow:0 0 0 2px rgba(11,103,163,.08) inset}
    .card b{display:block;color:var(--navy);font-size:17px;margin-bottom:5px}
    .card span{display:block;color:#263e55;font-size:14px;font-weight:800}
    footer{font-size:13px;color:#526b82;margin:20px 0}
    @media(max-width:860px){main{padding:12px}.grid,.hero-actions{grid-template-columns:1fr}.section-head{align-items:flex-start;flex-direction:column}}
  </style>
</head>
<body>
<header>
  <h1>株式購入判断補助システム</h1>
  <p>NISA 1年保有テストに向けて、候補選定、6月イベント判定、NISA準備、記録を分けて確認するための入口です。</p>
</header>
<main>
  <p class="notice">このシステムは投資助言、自動売買、税務判断を行いません。購入前には、証券会社画面、公式決算、イベント後の実データを確認します。</p>
  <div class="hero-actions">
    <a href="896_practical_entry_hub_20260606.html">実用パート入口</a>
    <a class="secondary" href="895_june_execution_cockpit_20260606.html">6月実行コックピット</a>
    <a class="secondary" href="893_june_event_gate_engine_20260606.html">イベント判定エンジン</a>
  </div>
  ${sectionHtml}
  <footer>公開URL: https://ob198-cpu.github.io/kabu/ / 作成: ${esc(generatedAt)}</footer>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "index.html"), html, "utf8");

console.log("wrote clean index.html");
