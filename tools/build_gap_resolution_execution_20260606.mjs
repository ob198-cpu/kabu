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

const resolutions = [
  {
    no: 1,
    issue: "候補10社の最終確定ロジック",
    implementation: "固定版ロジックを作成し、母集団、必須データ、ハード除外、量的スコア、質的補助、3チャンネル比較、6月イベントゲート、最終分類の順に固定。",
    output: "898_final_candidate_selection_logic_20260606.html",
    pass: "中心候補・条件付き候補・補欠・監視枠・除外を同じルールで分類できる。",
    remaining: "6月イベント後の実数入力で、実際に通過銘柄を確定する。",
  },
  {
    no: 2,
    issue: "公式決算・PER/PBR/ROE補完",
    implementation: "未取得値を推測加点しないゲートへ変更。公式値、取得元、更新日、未取得理由、代替扱いを必須列にする。",
    output: "900_required_data_gate_20260606.csv",
    pass: "PER/PBR/ROE、売上成長、利益成長、決算後反応が未取得なら購入候補ではなく補完待ちに落ちる。",
    remaining: "各社IR、決算短信、証券会社・公式データで入力値を補完する。",
  },
  {
    no: 3,
    issue: "決算後反応の検証",
    implementation: "決算後1日、5日、20営業日の対TOPIX/日経平均超過リターンを最終採点前の確認ゲートにする。",
    output: "901_earnings_reaction_gate_20260606.csv",
    pass: "20営業日未到達は暫定扱い。未到達データを確定スコアに混ぜない。",
    remaining: "到来日ごとに株価時系列と決算日を結合して更新する。",
  },
  {
    no: 4,
    issue: "質的テーマの実績検証",
    implementation: "質的テーマを仮説層と実績層に分離。テーマ名だけの加点を禁止し、公式根拠・過去反応・売上寄与の有無でS/A/B/C上限を決める。",
    output: "902_qualitative_theme_validation_gate_20260606.csv",
    pass: "テーマ仮説だけなら最大B。過去反応か売上寄与がなければ購入候補化しない。",
    remaining: "半導体、AIインフラ、フィジカルAI、量子のイベント履歴と株価反応を追加する。",
  },
  {
    no: 5,
    issue: "量子コンピューター枠",
    implementation: "量子は監視枠として固定。商用売上、受注、株価反応が確認できるまで6月NISA 1年テストの中心候補に入れない。",
    output: "903_quantum_watch_gate_20260606.csv",
    pass: "富士通、NEC等は監視枠表示。購入候補化しない理由を明示。",
    remaining: "量子事業の収益寄与が見える資料を監視する。",
  },
  {
    no: 6,
    issue: "候補群の比率設計",
    implementation: "総合候補、攻め枠、守り枠、補欠、監視枠の比率上限を固定。赤ゲート時は攻め枠ゼロ、黄ゲート時は攻め枠縮小。",
    output: "904_allocation_gate_20260606.csv",
    pass: "市場状態ごとに、個別株比率、攻め枠比率、現金比率が決まる。",
    remaining: "6月イベント後の緑・黄・赤判定を入力して最終配分を出す。",
  },
  {
    no: 7,
    issue: "上値・下値ルールの銘柄別補正",
    implementation: "共通ルールに、最大下落率、60日下落率、ボラティリティ、決算日、テーマ崩れ条件を足して銘柄別補正する。",
    output: "905_ticker_trade_rule_gate_20260606.csv",
    pass: "高ボラ銘柄は損切り・利確幅を機械的に広げず、比率を下げる。決算前後は追加停止を優先。",
    remaining: "各銘柄の最大下落率とボラティリティを最新データで更新する。",
  },
  {
    no: 8,
    issue: "S&P500/TOPIX比較と購入比率の接続",
    implementation: "3か月、6か月、1年の指数劣後時に、個別株比率を下げる分岐を追加。",
    output: "906_benchmark_allocation_gate_20260606.csv",
    pass: "指数に劣後している場合、個別株比率を維持しない。+1%目標に届かない場合はインデックス・現金比率を上げる。",
    remaining: "購入後の実績リターンを運用記録へ入力する。",
  },
  {
    no: 9,
    issue: "税制レイヤーの実運用接続",
    implementation: "税制レイヤーを確認補助から、購入前チェックの停止条件へ接続。NISA口座未確認、口座区分不明、NISA損失リスク、外国源泉税確認をゲート化。",
    output: "907_tax_prebuy_gate_20260606.csv",
    pass: "NISAで買うべきか、課税口座向きか、確認必須かを購入前に表示する。",
    remaining: "実際の保有ロット、年間損益、配当、外国税額控除候補を入力する。",
  },
  {
    no: 10,
    issue: "実用画面の情報量",
    implementation: "毎日見る項目を、今日見る数値、止める条件、次の作業、候補比較、NISA準備に整理。固定ロジックへの導線を追加。",
    output: "practical_action_dashboard_20260528.html",
    pass: "顧客が最初に見る画面から、固定ロジック、候補比較、イベント判定、NISA準備へ進める。",
    remaining: "6月イベント後は、入力結果だけを上部に出すさらに短い実務画面へ更新する。",
  },
];

const requiredDataRows = [
  ["PER", "公式・証券会社・決算資料", "未取得なら割高判定を確定しない", "必須"],
  ["PBR", "公式・証券会社・決算資料", "未取得なら資産倍率判定を確定しない", "高"],
  ["ROE", "公式決算・有報・決算短信", "未取得なら質/効率点を補完待ちにする", "必須"],
  ["売上成長率", "決算短信・IR", "未取得なら成長点を補完待ちにする", "必須"],
  ["利益成長率", "決算短信・IR", "未取得なら利益成長点を補完待ちにする", "必須"],
  ["決算後1日反応", "株価時系列 + 決算日", "暫定反応として記録", "高"],
  ["決算後5日反応", "株価時系列 + 決算日", "短期反応として記録", "高"],
  ["決算後20日反応", "株価時系列 + 決算日", "未到達なら確定スコアへ混ぜない", "必須"],
  ["最大下落率", "過去株価時系列", "比率・損切り幅・高ボラ判定へ接続", "必須"],
  ["S&P500/TOPIX差", "指数 + 個別株価", "+1%目標と比率調整へ接続", "必須"],
];

const allocationRows = [
  ["緑", "全イベント通過、金利・指数・VIXに重大悪化なし", "最大70%", "最大20%", "最低10%", "中心候補を優先。攻め枠は小さく分散。"],
  ["黄", "一部警戒。金利、SOX、為替、指数のどれかが不安定", "最大45%", "最大8%", "最低30%", "中心候補のみ。攻め枠は原則縮小。"],
  ["赤", "CPI悪化、金利急騰、SOX/NASDAQ急落、日銀ショック等", "0-20%", "0%", "最低60%", "購入判断を止め、再判定まで待つ。"],
];

const tradeRuleRows = [
  ["共通下値", "-5%", "新規追加停止。原因を市場要因・個社要因・テーマ崩れに分類。"],
  ["共通下値", "-10%", "保有再判定。個社悪材料なら比率引き下げまたは除外。"],
  ["高ボラ補正", "最大下落率が大きい銘柄", "損切り幅を広げるのではなく、初期比率を小さくする。"],
  ["決算前", "決算前に急騰・高PER・過去急落がある", "決算通過後まで追加停止。"],
  ["上値", "+15-20%", "一部利確または比率調整を検討。1年保有前提でも過熱時は固定しない。"],
  ["指数劣後", "3か月でS&P500/TOPIXに劣後", "個別株比率を下げる候補にする。"],
];

const benchmarkRows = [
  ["3か月", "個別株平均がS&P500/TOPIXを1%以上下回る", "追加購入停止。敗因を銘柄・テーマ・市場に分類。"],
  ["6か月", "個別株平均がS&P500/TOPIXを2%以上下回る", "個別株比率を20-30%下げ、インデックスまたは現金へ戻す。"],
  ["1年", "S&P500/TOPIXを+1%以上上回れない", "翌年は個別株比率を下げ、効いた指標だけ残す。"],
  ["1年", "S&P500/TOPIXを+1%以上上回る", "有効だった指標と銘柄条件を記録し、翌年の母集団条件へ反映。"],
];

const taxRows = [
  ["NISA口座未確認", "購入停止", "口座区分が確認できるまで注文候補にしない。"],
  ["注文画面の口座区分不明", "購入停止", "NISA/特定/一般の誤発注を避ける。"],
  ["NISAで高ボラ個別株", "保留または小さく", "NISA損失は損益通算できないため。"],
  ["外国株・海外ETF", "外国源泉税確認", "NISAでも外国税の扱いを確認する。"],
  ["課税口座の含み損益あり", "年末レビュー", "損益通算・損失繰越の確認候補にする。"],
];

function table(columns, rows) {
  return `
    <table>
      <thead><tr>${columns.map((col) => `<th>${esc(col)}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("")}</tbody>
    </table>
  `;
}

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>不足点10項目 回収実装</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--amber:#a85b00;--green:#0b6b4f;--red:#a01818}
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
    table{width:100%;border-collapse:collapse;table-layout:fixed;margin-top:10px}
    th,td{border:1px solid var(--line);padding:9px;vertical-align:top;overflow-wrap:anywhere;color:#111}
    th{background:#e5f1fb;color:var(--navy);text-align:left;font-weight:900}
    tr{break-inside:avoid}
    .links a{display:inline-block;margin:6px 8px 0 0;background:var(--blue);color:white;text-decoration:none;border-radius:8px;padding:9px 12px;font-weight:900}
    @media(max-width:980px){main{padding:12px}table{font-size:14px}}
  </style>
</head>
<body>
<header>
  <h1>不足点10項目 回収実装</h1>
  <p>作成: ${esc(generatedAt)} / 不足点を実用ルール・ゲート・記録項目へ落とした版です。</p>
</header>
<main>
  <section>
    <h2>1. 結論</h2>
    <p class="ok">10項目は、購入判断の前に止めるためのゲートとして実装しました。データが未取得の項目を「完了」と見せず、補完待ち・監視枠・購入停止・比率縮小へ自動的に落とす設計です。</p>
    <p class="notice">この画面は購入確定ではありません。6月イベント後の実数、公式決算、証券会社画面を確認してから、固定ロジックに沿って候補を再判定します。</p>
    <div class="links">
      <a href="898_final_candidate_selection_logic_20260606.html">候補10社 最終確定ロジック</a>
      <a href="practical_action_dashboard_20260528.html">実用ダッシュボード</a>
      <a href="899_gap_resolution_execution_20260606.csv">CSVを開く</a>
    </div>
  </section>

  <section>
    <h2>2. 10項目の回収状況</h2>
    <table>
      <thead><tr><th style="width:5%">No</th><th style="width:19%">不足点</th><th>実装内容</th><th style="width:20%">出力</th><th>通過条件</th><th>残作業</th></tr></thead>
      <tbody>${resolutions.map((row) => `
        <tr>
          <td><b>${esc(row.no)}</b></td>
          <td><b>${esc(row.issue)}</b></td>
          <td>${esc(row.implementation)}</td>
          <td>${esc(row.output)}</td>
          <td>${esc(row.pass)}</td>
          <td>${esc(row.remaining)}</td>
        </tr>
      `).join("")}</tbody>
    </table>
  </section>

  <section>
    <h2>3. 必須データゲート</h2>
    ${table(["項目", "取得元", "未取得時の扱い", "重要度"], requiredDataRows)}
  </section>

  <section>
    <h2>4. 配分ゲート</h2>
    ${table(["市場判定", "条件", "個別株上限", "攻め枠上限", "現金目安", "扱い"], allocationRows)}
  </section>

  <section>
    <h2>5. 上値・下値ルール</h2>
    ${table(["区分", "条件", "行動"], tradeRuleRows)}
  </section>

  <section>
    <h2>6. S&P500/TOPIX比較と比率調整</h2>
    ${table(["期間", "条件", "行動"], benchmarkRows)}
  </section>

  <section>
    <h2>7. 税制ゲート</h2>
    ${table(["確認項目", "判定", "理由"], taxRows)}
  </section>
</main>
</body>
</html>`;

const csvRows = [
  ["section", "item1", "item2", "item3", "item4", "item5"],
  ...resolutions.map((row) => ["resolution", row.no, row.issue, row.implementation, row.pass, row.remaining]),
  ...requiredDataRows.map((row) => ["required_data", ...row, ""]),
  ...allocationRows.map((row) => ["allocation_gate", ...row]),
  ...tradeRuleRows.map((row) => ["trade_rule", ...row, "", ""]),
  ...benchmarkRows.map((row) => ["benchmark_gate", ...row, "", ""]),
  ...taxRows.map((row) => ["tax_gate", ...row, "", ""]),
];

fs.writeFileSync(path.join(ROOT, "899_gap_resolution_execution_20260606.csv"), `\uFEFF${csvRows.map((row) => row.map(csvCell).join(",")).join("\n")}\n`, "utf8");
fs.writeFileSync(path.join(ROOT, "899_gap_resolution_execution_20260606.html"), html, "utf8");

fs.writeFileSync(path.join(ROOT, "900_required_data_gate_20260606.csv"), `\uFEFF${[["item","source","if_missing","importance"], ...requiredDataRows].map((row) => row.map(csvCell).join(",")).join("\n")}\n`, "utf8");
fs.writeFileSync(path.join(ROOT, "901_earnings_reaction_gate_20260606.csv"), `\uFEFF${[["item","rule"], ["1day","record_as_short_reaction"], ["5day","record_as_short_reaction"], ["20day","use_only_after_arrival"], ["missing","do_not_mix_into_final_score"]].map((row) => row.map(csvCell).join(",")).join("\n")}\n`, "utf8");
fs.writeFileSync(path.join(ROOT, "902_qualitative_theme_validation_gate_20260606.csv"), `\uFEFF${[["layer","rule"], ["hypothesis","theme_name_only_max_B"], ["evidence","official_source_or_past_reaction_required"], ["actual","sales_or_order_connection_required_for_A"], ["missing","watch_only"]].map((row) => row.map(csvCell).join(",")).join("\n")}\n`, "utf8");
fs.writeFileSync(path.join(ROOT, "903_quantum_watch_gate_20260606.csv"), `\uFEFF${[["ticker","treatment","reason"], ["6702.T","watch_only","quantum_sales_contribution_not_enough_for_1y_nisa"], ["6701.T","watch_only","quantum_theme_not_purchase_candidate_yet"]].map((row) => row.map(csvCell).join(",")).join("\n")}\n`, "utf8");
fs.writeFileSync(path.join(ROOT, "904_allocation_gate_20260606.csv"), `\uFEFF${[["market_gate","condition","stock_limit","attack_limit","cash"], ...allocationRows.map((row) => row.slice(0,5))].map((row) => row.map(csvCell).join(",")).join("\n")}\n`, "utf8");
fs.writeFileSync(path.join(ROOT, "905_ticker_trade_rule_gate_20260606.csv"), `\uFEFF${[["type","condition","action"], ...tradeRuleRows].map((row) => row.map(csvCell).join(",")).join("\n")}\n`, "utf8");
fs.writeFileSync(path.join(ROOT, "906_benchmark_allocation_gate_20260606.csv"), `\uFEFF${[["period","condition","action"], ...benchmarkRows].map((row) => row.map(csvCell).join(",")).join("\n")}\n`, "utf8");
fs.writeFileSync(path.join(ROOT, "907_tax_prebuy_gate_20260606.csv"), `\uFEFF${[["check","decision","reason"], ...taxRows].map((row) => row.map(csvCell).join(",")).join("\n")}\n`, "utf8");

console.log("wrote 899_gap_resolution_execution_20260606.html");
console.log("wrote 899_gap_resolution_execution_20260606.csv");
console.log("wrote 900-907 gate csv files");
