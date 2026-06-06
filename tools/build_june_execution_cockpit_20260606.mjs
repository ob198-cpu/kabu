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

const cards = [
  {
    title: "6/10 米CPI",
    status: "入力待ち",
    watch: "CPI、米10年金利、SOX、NASDAQ、ドル円",
    stop: "金利急騰、SOX急落、NASDAQ急落",
    next: "結果入力後、半導体・AI枠を止めるか判定",
  },
  {
    title: "6/15〜16 日銀",
    status: "入力待ち",
    watch: "政策金利、声明文、ドル円、日本10年金利、日経/TOPIX",
    stop: "急な円高、75日線割れ、銀行・輸出株の悪化",
    next: "金融・商社・輸出・半導体の扱いを再判定",
  },
  {
    title: "6/16〜17 FOMC",
    status: "入力待ち",
    watch: "政策金利、ドットプロット、FRB議長会見、米10年金利、VIX",
    stop: "金利急騰、VIX急騰、NASDAQ/SOX急落",
    next: "攻め枠を入れるか、既存10社維持かを決める",
  },
  {
    title: "6/18以降 一次再判定",
    status: "実施予定",
    watch: "3イベントの色判定、候補別反応、指数差、出来高",
    stop: "赤イベントあり、または既存10社を上回る説明がない",
    next: "入れ替え候補、保留候補、除外候補を記録",
  },
];

const actionRows = [
  {
    item: "赤が1つ以上",
    action: "攻め枠追加停止",
    target: "半導体、フジクラ、TDKなどテーマ枠",
    note: "既存10社維持、または個別株比率を下げる。",
  },
  {
    item: "黄が2つ以上",
    action: "保留",
    target: "全テーマ候補",
    note: "翌営業日以降に反応を再確認。小比率でも急がない。",
  },
  {
    item: "赤なし・黄0〜1",
    action: "候補別比較へ進む",
    target: "アドバンテスト、ディスコ、日立、フジクラ、TDK",
    note: "既存10社より指数差・下落耐性・事業寄与で上回るか確認。",
  },
  {
    item: "未確認データあり",
    action: "採用しない",
    target: "ファナック、キーエンス、安川電機、ニデック等",
    note: "補完後候補に戻す。未取得データは点数に混ぜない。",
  },
  {
    item: "量子コンピューター",
    action: "監視のみ",
    target: "富士通、NECなど",
    note: "6月NISA 1年テストには入れない。",
  },
];

const linkRows = [
  {
    title: "6月イベント判定エンジン",
    url: "893_june_event_gate_engine_20260606.html",
    use: "緑・黄・赤の市場ゲートを確認する",
  },
  {
    title: "6月候補別アクション分岐表",
    url: "894_june_candidate_action_after_gate_20260606.html",
    use: "市場ゲート後に、銘柄ごとの扱いを見る",
  },
  {
    title: "6月イベント後 実データ入力・入替記録",
    url: "892_june_event_actual_input_and_replacement_log_20260606.html",
    use: "イベント後の実数と入れ替え理由を記録する",
  },
  {
    title: "6月テーマ候補 実行判定表",
    url: "891_june_theme_execution_matrix_20260605.html",
    use: "テーマ候補ごとの必要データと停止条件を見る",
  },
  {
    title: "6月テーマ候補 統合ゲート",
    url: "890_june_theme_integration_gate_20260605.html",
    use: "既存10社とテーマ枠の関係を確認する",
  },
];

const esc = (value) => String(value ?? "")
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;");
const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const cardHtml = cards.map((card) => `
  <article class="event-card">
    <div class="event-head">
      <h3>${esc(card.title)}</h3>
      <span>${esc(card.status)}</span>
    </div>
    <dl>
      <dt>見る数値</dt><dd>${esc(card.watch)}</dd>
      <dt>止める条件</dt><dd>${esc(card.stop)}</dd>
      <dt>次にすること</dt><dd>${esc(card.next)}</dd>
    </dl>
  </article>
`).join("");

const actionHtml = actionRows.map((row) => `
  <tr>
    <td><b>${esc(row.item)}</b></td>
    <td>${esc(row.action)}</td>
    <td>${esc(row.target)}</td>
    <td>${esc(row.note)}</td>
  </tr>
`).join("");

const linkHtml = linkRows.map((row) => `
  <a class="link-card" href="${esc(row.url)}">
    <b>${esc(row.title)}</b>
    <span>${esc(row.use)}</span>
  </a>
`).join("");

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月実行コックピット</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--ok:#0b6b4f;--warn:#a85b00;--stop:#a01818}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;line-height:1.7}
    header{background:var(--navy);color:white;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);letter-spacing:0;line-height:1.2}
    header p{margin:0;color:white;font-weight:800}
    main{max-width:1450px;margin:0 auto;padding:22px}
    section{background:white;border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:24px}
    .lead{border-left:7px solid #b76500;background:#fff7e7;color:#111;padding:12px 14px;margin:12px 0;font-weight:900;border-radius:8px}
    .event-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .event-card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:13px}
    .event-head{display:flex;gap:8px;justify-content:space-between;align-items:flex-start;margin-bottom:8px}
    .event-head h3{margin:0;color:var(--navy);font-size:18px;line-height:1.35}
    .event-head span{background:#e6f1fb;color:var(--navy);border:1px solid #bad4e8;border-radius:999px;padding:3px 8px;font-size:12px;font-weight:900;white-space:nowrap}
    dl{margin:0}dt{font-weight:900;color:var(--navy);margin-top:6px}dd{margin:0;color:#111;font-size:13px}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:white}
    table{width:100%;border-collapse:collapse;min-width:980px;table-layout:fixed;font-size:14px}
    th,td{border:1px solid var(--line);padding:9px;vertical-align:top;overflow-wrap:anywhere;word-break:break-word;color:#111}
    th{background:#e5f1fa;color:#073b62;text-align:left;font-weight:900}
    .links{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .link-card{display:block;text-decoration:none;color:var(--ink);background:#fbfdff;border:1px solid var(--line);border-radius:10px;padding:13px}
    .link-card b{display:block;color:var(--navy);font-size:16px}.link-card span{display:block;color:#293f55;font-size:13px;font-weight:800;margin-top:4px}
    .decision{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    .decision div{border-radius:10px;padding:13px;color:white;font-weight:900}.green{background:var(--ok)}.yellow{background:var(--warn)}.red{background:var(--stop)}
    @media(max-width:980px){main{padding:12px}.event-grid,.links,.decision{grid-template-columns:1fr}table{min-width:860px}}
  </style>
</head>
<body>
<header>
  <h1>6月実行コックピット</h1>
  <p>作成: ${esc(generatedAt)} / 6月イベント後に、何を入力し、何なら止め、どの候補を比較するかを見る実用画面です。</p>
</header>
<main>
  <section>
    <h2>1. この画面の目的</h2>
    <p class="lead">この画面は、購入を決める画面ではありません。CPI、日銀、FOMC後の実データを入れて、攻め枠を入れてよい環境か、保留すべきか、追加を止めるべきかを判断するための入口です。</p>
    <div class="decision">
      <div class="green">緑: 候補別比較へ進む</div>
      <div class="yellow">黄: 保留または小比率に限定</div>
      <div class="red">赤: 攻め枠追加停止</div>
    </div>
  </section>

  <section>
    <h2>2. 今日から見るイベント</h2>
    <div class="event-grid">${cardHtml}</div>
  </section>

  <section>
    <h2>3. 判定後のアクション</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>条件</th><th>アクション</th><th>対象</th><th>補足</th></tr></thead>
        <tbody>${actionHtml}</tbody>
      </table>
    </div>
  </section>

  <section>
    <h2>4. 詳細ページ</h2>
    <div class="links">${linkHtml}</div>
  </section>
</main>
</body>
</html>`;

const csvRows = [
  ["section", "title", "status", "watch", "stop", "next"],
  ...cards.map((card) => ["event", card.title, card.status, card.watch, card.stop, card.next]),
  ...actionRows.map((row) => ["action", row.item, row.action, row.target, row.note, ""]),
  ...linkRows.map((row) => ["link", row.title, row.url, row.use, "", ""]),
];
const csv = csvRows.map((row) => row.map(csvCell).join(",")).join("\n");
fs.writeFileSync(path.join(ROOT, "895_june_execution_cockpit_20260606.csv"), `\uFEFF${csv}\n`, "utf8");
fs.writeFileSync(path.join(ROOT, "895_june_execution_cockpit_20260606.html"), html, "utf8");

const link = '<a class="button secondary" href="895_june_execution_cockpit_20260606.html">6月実行コックピット</a>';
for (const file of ["index.html", "practical_action_dashboard_20260528.html", "894_june_candidate_action_after_gate_20260606.html"]) {
  const filePath = path.join(ROOT, file);
  if (!fs.existsSync(filePath)) continue;
  let text = fs.readFileSync(filePath, "utf8");
  if (text.includes("895_june_execution_cockpit_20260606.html")) continue;
  if (text.includes("894_june_candidate_action_after_gate_20260606.html")) {
    text = text.replace(/(<a[^>]+href="894_june_candidate_action_after_gate_20260606\.html"[^>]*>.*?<\/a>)/s, `$1\n      ${link}`);
  } else if (text.includes("</section>")) {
    text = text.replace("</section>", `<div class="links">${link}</div></section>`);
  }
  fs.writeFileSync(filePath, text, "utf8");
}

console.log("wrote 895_june_execution_cockpit_20260606.html");
console.log("wrote 895_june_execution_cockpit_20260606.csv");
