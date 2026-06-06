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

const items = [
  {
    item: "候補10社の公式決算確認",
    status: "一部完了",
    importance: "最重要",
    why: "売上、利益、EPS、ROE、PER/PBRの確認が弱い銘柄は、株価やテーマだけで選んだように見える。",
    done: "最終ロジック、判定ワークベンチ、銘柄別アクション票に未確認データの扱いを反映。",
    next: "中心候補に残す銘柄から公式決算・IR・信頼できる指標を補完する。",
    blocker: "公式資料確認、または信頼できるデータソースの補完が必要。",
    purchaseImpact: "中心候補の必須項目が未確認なら購入判断に進めない。",
  },
  {
    item: "6月イベント後の実データ入力",
    status: "入力待ち",
    importance: "最重要",
    why: "CPI、日銀、FOMC後の金利・為替・指数反応が入らないと、6月に買える環境か判断できない。",
    done: "実数入力シート、イベント判定エンジン、購入前ゲートを作成。",
    next: "6/10、6/15〜16、6/16〜17後に実数を入力し、緑・黄・赤を記録する。",
    blocker: "イベント日到来後の実データが必要。",
    purchaseImpact: "赤なら停止。黄なら保守配分。緑なら候補別に再判定。",
  },
  {
    item: "決算後反応の検証",
    status: "一部完了",
    importance: "高",
    why: "決算数字が良くても株価が買われない場合があるため、決算後1日・5日・20営業日の反応を見る必要がある。",
    done: "決算後反応を判定項目に組み込み、未到達・未確認を別扱いにした。",
    next: "中心候補から順に、決算後反応と指数差を補完する。",
    blocker: "決算日、株価時系列、指数時系列の結合が必要。",
    purchaseImpact: "反応が未確認なら条件付きまたは補欠扱い。",
  },
  {
    item: "質的テーマの実績検証",
    status: "作業中",
    importance: "高",
    why: "半導体、AIインフラ、電力、フィジカルAI、量子を思いつきで加点しないため、仮説と実績を分ける必要がある。",
    done: "3チャンネル、フィジカルAI、量子を分離し、購入候補と監視枠を混同しない構造にした。",
    next: "各テーマのニュース、受注、決算寄与、過去株価反応を別々に記録する。",
    blocker: "ニュース本文、公式IR、過去イベント反応の追加確認が必要。",
    purchaseImpact: "仮説だけのテーマは購入候補ではなく監視枠。",
  },
  {
    item: "100社母集団の固定性",
    status: "一部完了",
    importance: "高",
    why: "母集団が曖昧だと、後から都合の良い銘柄を選んだように見える。",
    done: "100社母集団、3チャンネル、最終ロジックを分けて表示。",
    next: "時価総額、流動性、成長率、除外条件、テーマ分類を固定ルールとして明文化する。",
    blocker: "候補群の採用・除外理由の棚卸しが必要。",
    purchaseImpact: "母集団が説明できない候補は顧客説明で弱くなる。",
  },
  {
    item: "銘柄別配分比率",
    status: "暫定",
    importance: "最重要",
    why: "候補が良くても、比率が大きすぎるとリスクが集中する。",
    done: "スナップショット、ワークベンチ、銘柄別アクション票に配分・扱いの考え方を入れた。",
    next: "市場ゲート緑・黄・赤ごとに、中心候補、条件付き、補欠の上限比率を確定する。",
    blocker: "6月イベント後の市場ゲートが必要。",
    purchaseImpact: "比率未確定なら購入金額を確定できない。",
  },
  {
    item: "上値・下値ルールの銘柄別補正",
    status: "一部完了",
    importance: "高",
    why: "同じ-5%でも、銀行、商社、半導体、電線では意味が違う。",
    done: "共通ルールと銘柄別の停止条件・利確条件を追加。",
    next: "最大下落率、ボラティリティ、決算日、テーマ崩れ条件で銘柄別に補正する。",
    blocker: "過去下落率と決算予定日の追加整理が必要。",
    purchaseImpact: "ルールが粗い銘柄は小口または保留。",
  },
  {
    item: "税制レイヤーの実口座連動",
    status: "確認補助",
    importance: "中",
    why: "NISA向き・課税口座向きの表示はあるが、実際の保有ロットや年間損益とはまだ完全連動していない。",
    done: "NISA向き、課税口座向き、損益通算不可、本人操作の注意を表示。",
    next: "実際の口座区分、保有ロット、年間損益が分かる場合だけ税制確認表へ接続する。",
    blocker: "本人別の証券口座情報は外部確認が必要。",
    purchaseImpact: "税制未確認でも購入候補選定は可能だが、発注前確認は必要。",
  },
  {
    item: "S&P500/TOPIX劣後時の自動分岐",
    status: "暫定",
    importance: "高",
    why: "指数より+1%以上を狙う目的があるため、劣後時に何を下げるかを決めておく必要がある。",
    done: "指数比較と購入前ゲートに、劣後時の比率見直しを入れた。",
    next: "1か月、3か月、6か月、12か月で劣後した場合の個別株比率引き下げルールを固定する。",
    blocker: "比較期間と対象指数の最終決定が必要。",
    purchaseImpact: "運用中の見直しルール。購入前には説明責任として必要。",
  },
  {
    item: "実用画面の整理",
    status: "改善中",
    importance: "中",
    why: "ページが多いと、毎日何を見るべきか分かりにくくなる。",
    done: "ホーム、実用ダッシュボード、スナップショット、最終ゲート、銘柄別票、実数入力シートを追加。",
    next: "実用パートを、今日見る、イベント後に見る、購入前に見る、記録する、の4つにさらに整理する。",
    blocker: "利用者が実際に見る順番の確認が必要。",
    purchaseImpact: "判断品質には影響するが、直接の購入可否条件ではない。",
  },
];

const statusClass = {
  "一部完了": "partial",
  "入力待ち": "wait",
  "作業中": "progress",
  "暫定": "temp",
  "確認補助": "support",
  "改善中": "progress",
};

const summary = items.reduce((acc, item) => {
  acc[item.status] = (acc[item.status] || 0) + 1;
  return acc;
}, {});

const rowsHtml = items.map((row, index) => `
  <tr>
    <td><b>${index + 1}</b></td>
    <td><b>${esc(row.item)}</b><br><span class="importance">${esc(row.importance)}</span></td>
    <td><span class="badge ${statusClass[row.status] || ""}">${esc(row.status)}</span></td>
    <td>${esc(row.why)}</td>
    <td>${esc(row.done)}</td>
    <td>${esc(row.next)}</td>
    <td>${esc(row.blocker)}</td>
    <td>${esc(row.purchaseImpact)}</td>
  </tr>
`).join("");

const summaryHtml = Object.entries(summary).map(([status, count]) => `
  <div class="box"><span>${esc(status)}</span><b>${count}</b></div>
`).join("");

const csvRows = [
  ["no", "item", "status", "importance", "why_it_matters", "done", "next_action", "blocker", "purchase_impact"],
  ...items.map((row, index) => [index + 1, row.item, row.status, row.importance, row.why, row.done, row.next, row.blocker, row.purchaseImpact]),
];

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>不足点10項目 回収トラッカー</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--amber:#a85b00;--red:#a01818;--green:#0b6b4f;--gray:#46596b}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;line-height:1.6}
    header{background:var(--navy);color:white;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);letter-spacing:0;line-height:1.2}
    header p{margin:0;color:white;font-weight:800}
    main{max-width:1580px;margin:0 auto;padding:22px}
    section{background:white;border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:24px}
    .notice{border-left:7px solid var(--amber);background:#fff7e7;color:#111;padding:12px 14px;margin:0 0 14px;font-weight:900;border-radius:8px}
    .links a{display:inline-block;margin:6px 8px 0 0;background:var(--blue);color:white;text-decoration:none;border-radius:8px;padding:9px 12px;font-weight:900}
    .summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;margin-top:12px}
    .box{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:12px}
    .box span{display:block;font-weight:900;color:#263e55}
    .box b{display:block;color:var(--navy);font-size:28px}
    table{width:100%;border-collapse:collapse;table-layout:fixed}
    th,td{border:1px solid var(--line);padding:9px;vertical-align:top;overflow-wrap:anywhere;color:#111}
    th{background:#e5f1fb;color:var(--navy);text-align:left;font-weight:900}
    tr{break-inside:avoid}
    .badge{display:inline-block;border-radius:999px;color:white;padding:4px 9px;font-weight:900;background:var(--gray)}
    .partial{background:var(--blue)}.wait{background:var(--amber)}.progress{background:var(--green)}.temp{background:#744fa8}.support{background:#566b7c}
    .importance{display:inline-block;margin-top:4px;color:var(--red);font-weight:900}
    @media(max-width:980px){main{padding:12px}table{font-size:14px}.summary{grid-template-columns:1fr}}
  </style>
</head>
<body>
<header>
  <h1>不足点10項目 回収トラッカー</h1>
  <p>作成: ${esc(generatedAt)} / 何が残っていて、何が購入判断を止めるのかを確認する実用管理表です。</p>
</header>
<main>
  <section>
    <h2>1. 位置づけ</h2>
    <p class="notice">このページは、現状の不足点を「課題」として放置せず、購入前ゲート・実数入力・銘柄別アクションへ接続するための管理表です。最重要項目が未確認のままなら、購入判断には進めません。</p>
    <div class="links">
      <a href="910_prebuy_final_gate_checklist_20260606.html">購入前 最終ゲート</a>
      <a href="912_june_event_actual_input_sheet_20260606.html">6月イベント 実数入力</a>
      <a href="911_ticker_action_tickets_20260606.html">銘柄別アクション票</a>
      <a href="913_gap_closure_tracker_20260606.csv">CSV</a>
    </div>
    <div class="summary">${summaryHtml}</div>
  </section>

  <section>
    <h2>2. 不足点10項目と回収方針</h2>
    <table>
      <thead><tr><th style="width:46px">No</th><th style="width:190px">不足点</th><th style="width:90px">状態</th><th>なぜ必要か</th><th>現状できたこと</th><th>次にやること</th><th>残る条件</th><th>購入判断への影響</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </section>
</main>
</body>
</html>`;

fs.writeFileSync(path.join(ROOT, "913_gap_closure_tracker_20260606.csv"), `\uFEFF${csvRows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`, "utf8");
fs.writeFileSync(path.join(ROOT, "913_gap_closure_tracker_20260606.html"), html, "utf8");

console.log("wrote 913_gap_closure_tracker_20260606.html");
console.log("wrote 913_gap_closure_tracker_20260606.csv");
