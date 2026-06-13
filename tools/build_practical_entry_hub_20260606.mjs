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
    title: "まず見る画面",
    purpose: "6月の作業を始める入口。ここから実データ入力、判定、候補別アクションへ進みます。",
    links: [
      ["実用パート 運用フロー", "914_daily_operation_flow_20260606.html", "今日見る、イベント後に見る、購入前に見る、記録する、の4段階で確認する。"],
      ["6月実行コックピット", "895_june_execution_cockpit_20260606.html", "6月イベント後に、何を見るか、何なら止めるか、次に何をするかを1画面で確認する。"],
      ["6月イベント 実数入力シート", "912_june_event_actual_input_sheet_20260606.html", "CPI、日銀、FOMC後の実数と判定を入力し、判定用CSVを出力する。"],
      ["6月イベント実数 反映ワークフロー", "post_0618_event_reflection_workflow_20260613.html", "イベント入力後に、候補10社・資金配分・当日運用ボードへどう反映されるか確認する。"],
      ["銘柄別イベント判定エンジン", "june_event_gate_engine.html", "イベント結果CSVに連動して、銘柄別の延期・保留・候補復帰を確認する。"],
      ["6月ゲート運用表", "june_gate_operation.html", "18日以降に、イベント入力状況、候補10社、停止条件を一画面で確認する。"],
      ["240万円 資金配分ゲート", "capital_allocation_plan.html", "緑・黄・赤の判定に応じた初回投入上限と現金待機額を確認する。"],
      ["購入前 最終ゲートチェック", "910_prebuy_final_gate_checklist_20260606.html", "市場、候補、NISA口座、税制、記録がそろっているか確認する。"],
      ["6月イベント判定エンジン", "893_june_event_gate_engine_20260606.html", "CPI、金利、SOX、NASDAQ、VIXなどを緑・黄・赤で判定する。"],
      ["6月候補別アクション分岐表", "894_june_candidate_action_after_gate_20260606.html", "市場ゲート後に、アドバンテスト、ディスコ、日立、フジクラ、TDKなどをどう扱うか確認する。"],
      ["6月イベント後 実データ入力・入替記録", "892_june_event_actual_input_and_replacement_log_20260606.html", "イベント後の実数と、候補を入れ替えた理由を記録する。"],
    ],
  },
  {
    title: "候補選定・テーマ判断",
    purpose: "既存10社、半導体、データセンター、フィジカルAI、量子を混ぜずに確認します。",
    links: [
      ["6月テーマ候補 実行判定表", "891_june_theme_execution_matrix_20260605.html", "テーマ候補ごとの必要データ、通過条件、停止条件を確認する。"],
      ["6月テーマ候補 統合ゲート", "890_june_theme_integration_gate_20260605.html", "既存10社を基準に、テーマ候補を入れる条件を確認する。"],
      ["テーマ別候補 横並び比較", "889_cross_channel_candidate_comparison_20260605.html", "総合、半導体、データセンター、フィジカルAI、量子の候補を横並びで見る。"],
      ["フィジカルAI・量子 数値接続", "887_quantum_physical_ai_quant_connection_20260605.html", "フィジカルAI・量子候補が既存データに接続できているか確認する。"],
      ["フィジカルAI・量子 昇格作業キュー", "888_quantum_physical_ai_promotion_queue_20260605.html", "購入候補に近いもの、補完後候補、長期探索を分ける。"],
    ],
  },
  {
    title: "NISA準備・口座運用",
    purpose: "購入判断の前に、本人操作、口座区分、証券会社確認、注文票を整理します。",
    links: [
      ["NISA口座運用ハブ", "882_nisa_account_operation_hub_20260605.html", "本人操作、証券会社確認、提案資料、注文票の入口。"],
      ["NISA購入準備 進捗ダッシュボード", "883_nisa_readiness_dashboard_20260605.html", "本人別の口座準備、スマホ準備、入金、注文票の進捗を見る。"],
      ["NISA証券会社 確認依頼テンプレート", "884_nisa_broker_contact_templates_20260605.html", "証券会社へ確認する内容を整理する。"],
      ["NISA本人別 注文票テンプレート", "879_nisa_person_order_ticket_20260605.html", "本人が確認して発注するための注文票を作る。"],
    ],
  },
  {
    title: "補足資料・記録",
    purpose: "説明や検証に必要な資料を確認します。実務判断は上の実用画面を優先します。",
    links: [
      ["NISA 1年テスト運用計画", "nisa_one_year_test_operation_plan_20260527.html", "NISA 1年保有テストの運用目的、記録項目、リスクルールを見る。"],
      ["運用記録CSV", "https://raw.githubusercontent.com/ob198-cpu/kabu/main/operation_record_template_20260529.csv", "判断理由、予想、実績、差分を記録するテンプレート。"],
      ["税制レイヤー Phase 1", "842_tax_aware_operation_layer_phase1_20260602.html", "NISA、課税口座、損益通算などの確認補助。"],
      ["NISA口座操作時の注意 PDF", "nisa_multi_account_pc_ip_risk_report_20260531.pdf", "本人操作、別名義口座の注意点、誤解を避ける運用方法を確認する。"],
    ],
  },
];

const esc = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");

const sectionHtml = sections.map((section, index) => `
  <section>
    <h2>${index + 1}. ${esc(section.title)}</h2>
    <p class="purpose">${esc(section.purpose)}</p>
    <div class="link-grid">
      ${section.links.map(([title, url, desc]) => `
        <a class="link-card" href="${esc(url)}">
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
  <title>実用パート入口</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--amber:#a85b00;--red:#a01818}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;line-height:1.7}
    header{background:var(--navy);color:white;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);letter-spacing:0;line-height:1.2}
    header p{margin:0;color:white;font-weight:800}
    main{max-width:1360px;margin:0 auto;padding:22px}
    .notice{border-left:7px solid var(--amber);background:#fff7e7;color:#111;padding:12px 14px;margin:0 0 18px;font-weight:900;border-radius:8px}
    section{background:white;border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08)}
    h2{margin:0 0 8px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:24px}
    .purpose{margin:0 0 12px;font-weight:800;color:#1b3349}
    .link-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .link-card{display:block;text-decoration:none;color:var(--ink);border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .link-card:hover{border-color:var(--blue);box-shadow:0 0 0 2px rgba(11,103,163,.08) inset}
    .link-card b{display:block;color:var(--navy);font-size:17px;margin-bottom:5px}
    .link-card span{display:block;color:#263e55;font-size:14px;font-weight:800}
    .top-actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:18px}
    .top-actions a{display:block;text-align:center;text-decoration:none;background:var(--blue);color:white;border-radius:10px;padding:12px;font-weight:900}
    .top-actions a.secondary{background:white;color:var(--blue);border:1px solid var(--blue)}
    footer{font-size:13px;color:#526b82;margin:20px 0}
    @media(max-width:860px){main{padding:12px}.link-grid,.top-actions{grid-template-columns:1fr}}
  </style>
</head>
<body>
<header>
  <h1>実用パート入口</h1>
  <p>作成: ${esc(generatedAt)} / 6月NISA 1年テストに向けて、日々見る画面と補足資料を分けた入口です。</p>
</header>
<main>
  <p class="notice">最初は「6月実行コックピット」を見ます。詳細が必要な時だけ、判定エンジン、候補別分岐表、NISA準備画面へ進みます。購入確定や自動売買の画面ではありません。</p>
  <div class="top-actions">
    <a href="914_daily_operation_flow_20260606.html">実用フロー</a>
    <a class="secondary" href="june_gate_operation.html">6月ゲート運用表</a>
    <a class="secondary" href="capital_allocation_plan.html">資金配分</a>
  </div>
  ${sectionHtml}
  <footer>未確認データ、公式決算、証券会社画面の確認が残る場合は、購入判断に進めません。</footer>
</main>
</body>
</html>`;

const csvRows = [["section", "title", "url", "description"]];
sections.forEach((section) => {
  section.links.forEach(([title, url, desc]) => csvRows.push([section.title, title, url, desc]));
});
const csv = csvRows.map((row) => row.map((cell) => {
  const text = String(cell ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}).join(",")).join("\n");

fs.writeFileSync(path.join(ROOT, "896_practical_entry_hub_20260606.csv"), `\uFEFF${csv}\n`, "utf8");
fs.writeFileSync(path.join(ROOT, "896_practical_entry_hub_20260606.html"), html, "utf8");

const link = '<a class="button secondary" href="896_practical_entry_hub_20260606.html">実用パート入口</a>';
for (const file of ["index.html", "practical_action_dashboard_20260528.html", "895_june_execution_cockpit_20260606.html"]) {
  const filePath = path.join(ROOT, file);
  if (!fs.existsSync(filePath)) continue;
  let text = fs.readFileSync(filePath, "utf8");
  if (text.includes("896_practical_entry_hub_20260606.html")) continue;
  if (text.includes("895_june_execution_cockpit_20260606.html")) {
    text = text.replace(/(<a[^>]+href="895_june_execution_cockpit_20260606\.html"[^>]*>.*?<\/a>)/s, `$1\n      ${link}`);
  } else if (text.includes("</section>")) {
    text = text.replace("</section>", `<div class="links">${link}</div></section>`);
  }
  fs.writeFileSync(filePath, text, "utf8");
}

console.log("wrote 896_practical_entry_hub_20260606.html");
console.log("wrote 896_practical_entry_hub_20260606.csv");
