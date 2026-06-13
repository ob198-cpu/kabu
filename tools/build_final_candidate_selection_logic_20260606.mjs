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

const steps = [
  {
    step: "1",
    name: "母集団を固定",
    rule: "約100社の母集団を、時価総額、売買代金、業績成長、テーマ関連性、除外条件で固定する。",
    pass: "母集団に入った理由が説明でき、銘柄の追加・削除理由が記録されている。",
    fail: "思いつき、話題性だけ、未記録の手動追加は候補化しない。",
  },
  {
    step: "2",
    name: "必須データを確認",
    rule: "株価、出来高、PER、PBR、ROE、売上成長、利益成長、決算後反応、指数比較、最大下落率を確認する。",
    pass: "主要データが取得済み、または未取得理由と代替扱いが明記されている。",
    fail: "PER/PBR/ROE、決算後反応、下落耐性が欠ける場合は購入候補ではなく補完待ちにする。",
  },
  {
    step: "3",
    name: "ハード除外",
    rule: "赤判定イベント、公式決算未確認、下方修正、説明不能な高PER、急騰後の過熱、流動性不足を除外または保留にする。",
    pass: "停止条件に該当しない。",
    fail: "停止条件に該当する銘柄は、点数が高くても最終10社へ入れない。",
  },
  {
    step: "4",
    name: "量的スコアを作る",
    rule: "財務・成長、価格/長期安定、割安/質、決算後反応、リスク耐性を同じ表で採点する。",
    pass: "同じ列、同じ式、同じ欠損ルールで比較されている。",
    fail: "銘柄ごとに違う式、未取得値の推測加点、説明不能な係数は使わない。",
  },
  {
    step: "5",
    name: "質的テーマを補助判定にする",
    rule: "AI、半導体、電力、フィジカルAI、量子などは、仮説層と実績層に分ける。量的スコアを上書きしない。",
    pass: "公式資料、ニュース、過去株価反応、売上寄与のいずれかで根拠がある。",
    fail: "テーマ名だけ、期待だけ、ニュースだけなら購入候補ではなく観察枠にする。",
  },
  {
    step: "6",
    name: "3チャンネルで比較",
    rule: "総合候補、半導体製造装置・材料、データセンター・電力・冷却・電線を混ぜずに並べる。",
    pass: "各チャンネルで上位候補、補完待ち、監視枠が分かれている。",
    fail: "異なるテーマを1つのランキングに混ぜて、理由の違う銘柄を同列にしない。",
  },
  {
    step: "7",
    name: "6月イベントゲート",
    rule: "6/10 CPI、6/15-16 日銀、6/16-17 FOMC後に、金利、為替、SOX、NASDAQ、日経平均、TOPIX、VIXを入力する。",
    pass: "市場ゲートが緑または黄で、候補別停止条件に触れていない。",
    fail: "赤判定が残る場合は、攻め枠を停止し、総合候補も購入判断へ進めない。",
  },
  {
    step: "8",
    name: "最終10社を出す",
    rule: "通過銘柄だけをスコア順に並べ、中心候補、条件付き候補、補欠、監視枠に分類する。",
    pass: "中心候補と条件付き候補の合計から最大10社を出す。監視枠は10社に入れない。",
    fail: "10社に足りない場合は無理に埋めず、現金またはインデックス比率を上げる。",
  },
  {
    step: "9",
    name: "比率を決める",
    rule: "中心候補を厚く、条件付き候補を薄く、攻め枠は市場ゲート通過後のみ小さく配分する。",
    pass: "1口座240万円の予算に対して、銘柄別上限、現金枠、延期条件が明記されている。",
    fail: "高スコアを理由に一括投入しない。高ボラ銘柄を大きくしすぎない。",
  },
  {
    step: "10",
    name: "記録して検証",
    rule: "選定理由、入力値、除外理由、購入/見送り理由、5営業日・20営業日・3か月・1年結果を記録する。",
    pass: "予想と結果の差が残り、次回の係数やゲート修正に使える。",
    fail: "結果だけ見て後から理由を作らない。",
  },
];

const scoreRows = [
  {
    block: "量的スコア",
    weight: "70%",
    detail: "財務・成長20、価格/長期安定20、割安/質15、決算後反応10、下落耐性5。",
    reason: "NISA 1年保有では、話題性よりも実データと下落耐性を主軸にするため。",
  },
  {
    block: "質的テーマ補助",
    weight: "20%",
    detail: "構造優位、政策、需給、技術優位、イベント仮説をS/A/B/Cで評価。ただし売上寄与や過去反応が弱い場合は上限をBにする。",
    reason: "テーマは候補発見には有効だが、単独で購入候補にしないため。",
  },
  {
    block: "データ信頼度",
    weight: "10%",
    detail: "公式資料、取得元、更新日、欠損有無、手入力有無で採点する。未取得値は推測で埋めない。",
    reason: "計算したふりを避け、説明責任を残すため。",
  },
  {
    block: "ハードゲート",
    weight: "点数とは別",
    detail: "赤イベント、下方修正、公式未確認、説明不能な高PER、急落、流動性不足は点数に関係なく保留または除外。",
    reason: "高スコアでも買ってはいけない状態を止めるため。",
  },
];

const finalClasses = [
  {
    className: "中心候補",
    condition: "量的スコア上位、必須データ確認済み、赤ゲートなし、説明可能な成長または割安性あり。",
    action: "6月イベント後に、購入比率の中心として検討する。",
  },
  {
    className: "条件付き候補",
    condition: "テーマ性や成長性は強いが、高PER、急騰、下落耐性、決算後反応に追加確認が必要。",
    action: "通過条件を満たした場合だけ小さく扱う。",
  },
  {
    className: "補欠候補",
    condition: "候補価値はあるが、中心候補よりデータ不足またはリスクが大きい。",
    action: "中心候補が落ちた場合の入替候補として残す。",
  },
  {
    className: "監視枠",
    condition: "量子コンピューターなど、テーマは重要だが1年NISAの利益根拠がまだ弱い。",
    action: "ニュースと実績を監視し、6月の購入候補にはしない。",
  },
  {
    className: "除外",
    condition: "停止条件に該当、公式確認不足、下方修正、説明不能な割高、指数劣後が大きい。",
    action: "最終10社には入れない。",
  },
];

function rowsHtml(rows, columns) {
  return rows.map((row) => `
    <tr>${columns.map((column) => `<td>${esc(row[column])}</td>`).join("")}</tr>
  `).join("");
}

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>候補10社 最終確定ロジック 固定版</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--amber:#a85b00;--red:#a01818;--green:#0b6b4f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;line-height:1.7}
    header{background:var(--navy);color:white;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);letter-spacing:0;line-height:1.2}
    header p{margin:0;color:white;font-weight:800}
    main{max-width:1460px;margin:0 auto;padding:22px}
    section{background:white;border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:24px}
    .notice{border-left:7px solid var(--amber);background:#fff7e7;color:#111;padding:12px 14px;margin:12px 0;font-weight:900;border-radius:8px}
    .ok{border-left:7px solid var(--green);background:#effaf5;color:#111;padding:12px 14px;margin:12px 0;font-weight:900;border-radius:8px}
    .flow{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
    .box{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:12px;font-weight:800}
    .box b{display:block;color:var(--navy);font-size:17px;margin-bottom:5px}
    table{width:100%;border-collapse:collapse;table-layout:fixed}
    th,td{border:1px solid var(--line);padding:9px;vertical-align:top;overflow-wrap:anywhere;color:#111}
    th{background:#e5f1fb;color:var(--navy);text-align:left;font-weight:900}
    tr{break-inside:avoid}
    .links a{display:inline-block;margin:6px 8px 0 0;background:var(--blue);color:white;text-decoration:none;border-radius:8px;padding:9px 12px;font-weight:900}
    @media(max-width:980px){main{padding:12px}.flow{grid-template-columns:1fr}table{font-size:14px}}
  </style>
</head>
<body>
<header>
  <h1>候補10社 最終確定ロジック 固定版</h1>
  <p>作成: ${esc(generatedAt)} / 顧客へ説明するために、候補10社をどう確定するかを固定したルールです。</p>
</header>
<main>
  <section>
    <h2>1. 現在の結論</h2>
    <p class="ok">候補10社を確定するロジックは、この画面のルールで固定します。今後「まだ出来ていない」と表現する対象は、ロジックではなく、6月イベント後の実数入力と候補通過結果です。</p>
    <p class="notice">この画面は購入確定ではありません。購入前には、6月CPI、日銀、FOMC後の実数、公式決算、証券会社画面を確認します。</p>
    <div class="links">
      <a href="practical_action_dashboard_20260528.html">実用ダッシュボードへ</a>
      <a href="889_cross_channel_candidate_comparison_20260605.html">3チャンネル比較へ</a>
      <a href="893_june_event_gate_engine_20260606.html">6月イベント判定へ</a>
      <a href="898_final_candidate_selection_logic_20260606.csv">CSVを開く</a>
    </div>
  </section>

  <section>
    <h2>2. 10社確定までの流れ</h2>
    <div class="flow">
      <div class="box"><b>母集団</b>約100社を固定</div>
      <div class="box"><b>必須データ</b>欠損を確認</div>
      <div class="box"><b>ハード除外</b>危険銘柄を止める</div>
      <div class="box"><b>採点</b>量的主軸で順位化</div>
      <div class="box"><b>6月ゲート</b>実数入力後に最大10社</div>
    </div>
  </section>

  <section>
    <h2>3. 詳細ルール</h2>
    <table>
      <thead><tr><th style="width:6%">順</th><th style="width:18%">工程</th><th>ルール</th><th>通過条件</th><th>止める条件</th></tr></thead>
      <tbody>${steps.map((row) => `
        <tr>
          <td><b>${esc(row.step)}</b></td>
          <td><b>${esc(row.name)}</b></td>
          <td>${esc(row.rule)}</td>
          <td>${esc(row.pass)}</td>
          <td>${esc(row.fail)}</td>
        </tr>
      `).join("")}</tbody>
    </table>
  </section>

  <section>
    <h2>4. 採点構造</h2>
    <table>
      <thead><tr><th style="width:18%">区分</th><th style="width:12%">比重</th><th>内容</th><th>理由</th></tr></thead>
      <tbody>${rowsHtml(scoreRows, ["block", "weight", "detail", "reason"])}</tbody>
    </table>
  </section>

  <section>
    <h2>5. 最終分類</h2>
    <table>
      <thead><tr><th style="width:18%">分類</th><th>条件</th><th>扱い</th></tr></thead>
      <tbody>${rowsHtml(finalClasses, ["className", "condition", "action"])}</tbody>
    </table>
  </section>

  <section>
    <h2>6. 顧客向けの説明</h2>
    <p>候補10社の選定は、感覚や話題性ではなく、約100社の母集団から、同じ条件でデータを確認し、停止条件を通したうえで最大10社に絞る方式です。半導体、AIインフラ、フィジカルAI、量子などの質的テーマは、候補発見の補助には使いますが、未検証のまま点数へ混ぜません。</p>
    <p>現時点で固定したのは「10社をどう確定するか」という手続きです。6月の市場イベント後に実数を入力し、赤判定やデータ不足がある銘柄は最終10社から外します。10社に足りない場合は、無理に埋めず、現金またはインデックス比率を上げる方針です。</p>
  </section>
</main>
</body>
</html>`;

const csvRows = [
  ["section", "item", "weight_or_step", "rule", "pass_or_condition", "fail_or_action"],
  ...steps.map((row) => ["detailed_rule", row.name, row.step, row.rule, row.pass, row.fail]),
  ...scoreRows.map((row) => ["score_structure", row.block, row.weight, row.detail, row.reason, ""]),
  ...finalClasses.map((row) => ["final_class", row.className, "", row.condition, row.action, ""]),
];

fs.writeFileSync(path.join(ROOT, "898_final_candidate_selection_logic_20260606.csv"), `\uFEFF${csvRows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`, "utf8");
fs.writeFileSync(path.join(ROOT, "898_final_candidate_selection_logic_20260606.html"), html, "utf8");

console.log("wrote 898_final_candidate_selection_logic_20260606.html");
console.log("wrote 898_final_candidate_selection_logic_20260606.csv");
