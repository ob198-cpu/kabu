import fs from "node:fs";
import {
  esc,
  generatedAt,
  insertCardAfter,
  readCsv,
  table,
  writeCsv,
} from "./lib/report_utils_20260613.mjs";

const current = readCsv("108_capital_allocation_by_ticker.csv");
const workbench = readCsv("908_final10_decision_workbench_20260606.csv");
const universe = readCsv("780_universe100_reselection_metrics_20260528.csv");
const channel = readCsv("889_cross_channel_candidate_comparison_20260605.csv");
const partial = readCsv("candidate10_partial_resolution_20260613.csv");

const universeByTicker = new Map(universe.map((row) => [row["コード"], row]));
const workbenchByTicker = new Map(workbench.map((row) => [row.ticker, row]));
const partialByTicker = new Map();
for (const row of partial) {
  if (!partialByTicker.has(row.ticker)) partialByTicker.set(row.ticker, []);
  partialByTicker.get(row.ticker).push(row);
}

function number(value) {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function yen(value) {
  return `${Math.round(number(value)).toLocaleString("ja-JP")}円`;
}

function pct(value, digits = 1) {
  const n = number(value);
  return `${n.toFixed(digits).replace(/\.0$/, "")}%`;
}

function abs(value) {
  return Math.abs(number(value));
}

function round(value, digits = 1) {
  return Number(value.toFixed(digits));
}

function universeAction(status) {
  if (status === "再選定候補") return "候補維持";
  if (status === "監視") return "初回買付から外し監視";
  if (status === "除外") return "初回買付対象から外す";
  return "根拠不足で保留";
}

function canInitialBuy(status) {
  return status === "再選定候補";
}

function confidence(row) {
  const checks = [
    number(row["5年S&P差"]) > 0,
    number(row["直近1年S&P差"]) > 0,
    number(row["5年CAGR"]) > 10,
    number(row["10年CAGR"]) > 10,
    number(row["直近1年最大下落率"]) > -40,
    number(row["月次勝率"]) >= 60,
    row["最終扱い"] === "再選定候補",
  ];
  const score = checks.filter(Boolean).length;
  if (score >= 6) return { rank: "A", score };
  if (score >= 5) return { rank: "B", score };
  if (score >= 4) return { rank: "C", score };
  return { rank: "D", score };
}

function riskRules(row, allocationRow) {
  const oneYearMaxDd = abs(row?.["直近1年最大下落率"]);
  const fiveYearMaxDd = abs(row?.["5年最大下落率"]);
  const status = row?.["最終扱い"] || "未接続";
  const watchLoss = -round(Math.max(5, Math.min(12, oneYearMaxDd * 0.3 || 8)));
  const reduceLoss = -round(Math.max(8, Math.min(18, oneYearMaxDd * 0.5 || 12)));
  const stopLoss = -round(Math.max(12, Math.min(25, oneYearMaxDd * 0.7 || 16)));
  const isCenter = allocationRow.role === "中心候補";
  return {
    watchLoss,
    reduceLoss,
    stopLoss,
    upperReview: isCenter ? 12 : 8,
    upperProfit: isCenter ? 20 : 15,
    volatilityBucket: fiveYearMaxDd >= 50 || oneYearMaxDd >= 30 ? "高" : fiveYearMaxDd >= 35 ? "中" : "低",
    action: canInitialBuy(status) ? "買付後の監視ルールに使用" : "初回買付は保留し、監視ルールだけ残す",
  };
}

function writeHtml(file, title, intro, sections) {
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <style>
    :root { --ink:#061827; --navy:#103b60; --blue:#0b67a3; --line:#c9dceb; --bg:#f4f8fb; --paper:#fff; --warn:#a85b00; --red:#b42318; --green:#116b4f; }
    * { box-sizing:border-box; }
    body { margin:0; background:var(--bg); color:var(--ink); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif; font-size:18px; line-height:1.75; }
    header { background:linear-gradient(135deg,#103b60,#0b67a3); color:#fff; padding:30px; }
    header h1 { margin:0 0 8px; font-size:clamp(30px,4vw,42px); line-height:1.2; letter-spacing:0; }
    header p { margin:0; font-weight:800; }
    main { max-width:1540px; margin:0 auto; padding:22px; }
    section { background:var(--paper); border:1px solid var(--line); border-radius:12px; padding:18px; margin:0 0 18px; box-shadow:0 8px 20px rgba(20,60,90,.08); }
    h2 { margin:0 0 12px; border-left:8px solid var(--blue); padding-left:12px; color:var(--navy); font-size:25px; }
    .notice { border-left:8px solid var(--warn); background:#fff7e7; border-radius:10px; padding:14px 16px; font-weight:900; margin:0 0 14px; }
    .ok { color:var(--green); font-weight:900; }
    .bad { color:var(--red); font-weight:900; }
    .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(250px,1fr)); gap:12px; }
    .link-card { display:block; padding:14px; border:1px solid var(--line); border-radius:10px; color:var(--ink); text-decoration:none; background:#fbfdff; }
    .link-card b { display:block; color:var(--navy); font-size:20px; margin-bottom:4px; }
    .table-wrap { overflow-x:auto; border:1px solid var(--line); border-radius:10px; margin-top:10px; }
    table { width:100%; border-collapse:collapse; table-layout:auto; background:#fff; }
    th,td { border:1px solid var(--line); padding:10px 12px; vertical-align:top; overflow-wrap:anywhere; word-break:normal; }
    th { background:#e7f2fb; color:#06395f; text-align:left; font-weight:900; }
    a { color:#005f99; font-weight:900; }
    @media print { body { background:#fff; } header,section { break-inside:avoid; box-shadow:none; } .table-wrap { overflow:visible; } }
  </style>
</head>
<body>
<header>
  <h1>${esc(title)}</h1>
  <p>作成: ${esc(generatedAt)} / ${esc(intro)}</p>
</header>
<main>
${sections.join("\n")}
</main>
</body>
</html>`;
  fs.writeFileSync(file, html, "utf8");
}

const strictRows = current.map((row) => {
  const u = universeByTicker.get(row.ticker);
  const status = u?.["最終扱い"] || "未接続";
  const action = universeAction(status);
  return {
    updated_at: generatedAt,
    ticker: row.ticker,
    name: row.name,
    current_role: row.role,
    current_green_yen: row.all_pass_allocation_yen,
    strict_green_yen: canInitialBuy(status) ? row.all_pass_allocation_yen : "0",
    current_yellow_yen: row.attention_allocation_yen,
    strict_yellow_yen: canInitialBuy(status) ? row.attention_allocation_yen : "0",
    universe_status: status,
    universe_score: u?.["再選定点"] || "",
    five_year_cagr_pct: u?.["5年CAGR"] || "",
    one_year_return_pct: u?.["直近1年騰落率"] || "",
    one_year_sp_diff_pct: u?.["直近1年S&P差"] || "",
    one_year_max_drawdown_pct: u?.["直近1年最大下落率"] || "",
    action,
    reason: u?.["除外理由"] || u?.["確認事項"] || "主要指標で通過",
  };
});

writeCsv("candidate10_strict_gate_review_20260613.csv", [
  "updated_at", "ticker", "name", "current_role", "current_green_yen", "strict_green_yen",
  "current_yellow_yen", "strict_yellow_yen", "universe_status", "universe_score",
  "five_year_cagr_pct", "one_year_return_pct", "one_year_sp_diff_pct",
  "one_year_max_drawdown_pct", "action", "reason",
], strictRows);

writeHtml(
  "candidate10_strict_gate_review_20260613.html",
  "候補10社 厳格ゲート再確認",
  "100社再選定データと現行10社を突合し、監視・除外扱いの銘柄を初回買付から外すための安全側チェックです。",
  [
    `<section><h2>結論</h2><p class="notice">現行10社をそのまま買付候補にせず、100社再選定側で「再選定候補」になっているものだけを初回買付対象にする厳格ゲートを追加しました。この表は現行比率を自動上書きせず、6/18以降の最終判断で使う安全側チェックです。</p></section>`,
    `<section><h2>厳格ゲート表</h2>${table(["銘柄", "現行役割", "100社側扱い", "現行緑上限", "厳格緑上限", "現行黄上限", "厳格黄上限", "判断", "理由"], strictRows.map((row) => ({
      銘柄: `${row.ticker} ${row.name}`,
      現行役割: row.current_role,
      "100社側扱い": row.universe_status,
      現行緑上限: yen(row.current_green_yen),
      厳格緑上限: yen(row.strict_green_yen),
      現行黄上限: yen(row.current_yellow_yen),
      厳格黄上限: yen(row.strict_yellow_yen),
      判断: row.action,
      理由: row.reason,
    })), { widths: { 銘柄: "14%", 理由: "20%", 判断: "18%" } })}</section>`,
    `<section><h2>CSV</h2><p><a href="candidate10_strict_gate_review_20260613.csv">CSVを開く</a></p></section>`,
  ],
);

const riskRows = current.map((row) => {
  const u = universeByTicker.get(row.ticker);
  const rules = riskRules(u, row);
  return {
    updated_at: generatedAt,
    ticker: row.ticker,
    name: row.name,
    role: row.role,
    universe_status: u?.["最終扱い"] || "未接続",
    one_year_max_drawdown_pct: u?.["直近1年最大下落率"] || "",
    five_year_max_drawdown_pct: u?.["5年最大下落率"] || "",
    volatility_bucket: rules.volatilityBucket,
    lower_watch_pct: String(rules.watchLoss),
    lower_reduce_pct: String(rules.reduceLoss),
    lower_stop_pct: String(rules.stopLoss),
    upper_review_pct: String(rules.upperReview),
    upper_profit_take_pct: String(rules.upperProfit),
    action: rules.action,
  };
});

writeCsv("candidate10_risk_trade_rules_20260613.csv", [
  "updated_at", "ticker", "name", "role", "universe_status", "one_year_max_drawdown_pct",
  "five_year_max_drawdown_pct", "volatility_bucket", "lower_watch_pct", "lower_reduce_pct",
  "lower_stop_pct", "upper_review_pct", "upper_profit_take_pct", "action",
], riskRows);

writeHtml(
  "candidate10_risk_trade_rules_20260613.html",
  "候補10社 下値・上値ルール",
  "銘柄ごとの過去最大下落率を使って、買付後の警戒・減額・停止・利確確認の水準を明文化しました。",
  [
    `<section><h2>使い方</h2><p class="notice">この水準は利益予測ではなく、買った後に何を見るかの運用ルールです。100社側で監視・除外になっている銘柄は、初回買付ではなく監視ルールだけ残します。</p></section>`,
    `<section><h2>銘柄別ルール</h2>${table(["銘柄", "100社側扱い", "変動区分", "警戒下落", "減額下落", "停止下落", "上値確認", "一部利確確認", "扱い"], riskRows.map((row) => ({
      銘柄: `${row.ticker} ${row.name}`,
      "100社側扱い": row.universe_status,
      変動区分: row.volatility_bucket,
      警戒下落: `${row.lower_watch_pct}%`,
      減額下落: `${row.lower_reduce_pct}%`,
      停止下落: `${row.lower_stop_pct}%`,
      上値確認: `+${row.upper_review_pct}%`,
      一部利確確認: `+${row.upper_profit_take_pct}%`,
      扱い: row.action,
    })), { widths: { 銘柄: "16%", 扱い: "24%" } })}</section>`,
    `<section><h2>CSV</h2><p><a href="candidate10_risk_trade_rules_20260613.csv">CSVを開く</a></p></section>`,
  ],
);

const benchmarkRows = [
  {
    updated_at: generatedAt,
    timing: "購入前",
    condition: "E02〜E04未入力、または赤判定",
    action: "個別株購入0円",
    reason: "イベント未確認の状態で比率を確定しない",
  },
  {
    updated_at: generatedAt,
    timing: "購入後5営業日",
    condition: "候補バスケットがS&P500/TOPIX/日経平均の比較対象に対して-1%以上劣後",
    action: "追加買付停止",
    reason: "初動で指数に負けている場合は、個別株比率を増やさない",
  },
  {
    updated_at: generatedAt,
    timing: "購入後20営業日",
    condition: "比較対象に対して-3%以上劣後",
    action: "次回追加枠を半分にする",
    reason: "目標+1%に対して逆方向に進んだ場合、個別株比率を下げる",
  },
  {
    updated_at: generatedAt,
    timing: "購入後60営業日",
    condition: "比較対象に対して-5%以上劣後、または赤イベント発生",
    action: "個別株の追加停止。現金または指数投信比率を上げる",
    reason: "個別株選定の優位性が確認できない場合は、無理に継続しない",
  },
  {
    updated_at: generatedAt,
    timing: "四半期レビュー",
    condition: "比較対象を+1%以上上回り、停止条件なし",
    action: "現行比率を維持。追加は上限内で再判定",
    reason: "勝っていても一括投入せず、イベントとリスクを再確認する",
  },
];
writeCsv("benchmark_plus1_trade_gate_20260613.csv", ["updated_at", "timing", "condition", "action", "reason"], benchmarkRows);
writeHtml(
  "benchmark_plus1_trade_gate_20260613.html",
  "S&P500/TOPIX +1% 接続ルール",
  "指数を上回る目標を、買付比率・追加停止・比率引下げルールに接続しました。",
  [
    `<section><h2>目的</h2><p class="notice">個別株を選ぶ目的は、既存の無難な運用を少なくとも+1%以上上回ることです。指数に劣後した場合は、個別株比率を上げず、追加枠を減らします。</p></section>`,
    `<section><h2>運用ルール</h2>${table(["確認時点", "条件", "アクション", "理由"], benchmarkRows.map((row) => ({
      確認時点: row.timing,
      条件: row.condition,
      アクション: row.action,
      理由: row.reason,
    })), { widths: { 確認時点: "14%", アクション: "24%" } })}</section>`,
    `<section><h2>CSV</h2><p><a href="benchmark_plus1_trade_gate_20260613.csv">CSVを開く</a></p></section>`,
  ],
);

const themeRows = channel.map((row) => ({
  updated_at: generatedAt,
  channel: row.channel,
  ticker: row.ticker,
  name: row.name,
  qualitative_hypothesis: row.basis,
  required_evidence: row.nextCheck,
  score_use: "単純加点しない。公式数字、関連指数、株価反応のうち少なくとも2種類の裏付けがある場合だけ補助評価に使う。",
  fail_action: row.risk,
}));
writeCsv("qualitative_theme_evidence_gate_20260613.csv", [
  "updated_at", "channel", "ticker", "name", "qualitative_hypothesis", "required_evidence", "score_use", "fail_action",
], themeRows);
writeHtml(
  "qualitative_theme_evidence_gate_20260613.html",
  "質的テーマ 実績検証ゲート",
  "半導体・AIインフラ・フィジカルAIなどの質的テーマを、単純加点ではなく裏付け確認のゲートとして扱う表です。",
  [
    `<section><h2>改善点</h2><p class="notice">質的テーマは思いつきで点数を足しません。仮説層と実績層を分け、公式数字・関連指数・株価反応で裏付けが取れた場合だけ補助評価に使います。</p></section>`,
    `<section><h2>テーマ別ゲート</h2>${table(["テーマ", "銘柄", "仮説", "必要な実績確認", "スコアでの扱い", "崩れる条件"], themeRows.map((row) => ({
      テーマ: row.channel,
      銘柄: `${row.ticker} ${row.name}`,
      仮説: row.qualitative_hypothesis,
      必要な実績確認: row.required_evidence,
      スコアでの扱い: row.score_use,
      崩れる条件: row.fail_action,
    })), { widths: { テーマ: "13%", 銘柄: "13%", スコアでの扱い: "20%" } })}</section>`,
    `<section><h2>CSV</h2><p><a href="qualitative_theme_evidence_gate_20260613.csv">CSVを開く</a></p></section>`,
  ],
);

const accountRows = Array.from({ length: 10 }, (_, index) => {
  const account = `account_${String(index + 1).padStart(2, "0")}`;
  return {
    updated_at: generatedAt,
    account_id: account,
    person_name: "",
    broker: "",
    nisa_opened: "未入力",
    nisa_growth_remaining_yen: "",
    person_smartphone_ready: "未入力",
    person_login_ready: "未入力",
    bank_account_ready: "未入力",
    dividend_method_checked: "未入力",
    order_permission: "未入力",
    gate: "未入力なら購入不可",
  };
});
writeCsv("nisa_account_linkage_template_20260613.csv", [
  "updated_at", "account_id", "person_name", "broker", "nisa_opened", "nisa_growth_remaining_yen",
  "person_smartphone_ready", "person_login_ready", "bank_account_ready", "dividend_method_checked", "order_permission", "gate",
], accountRows);
writeHtml(
  "nisa_account_linkage_template_20260613.html",
  "NISA口座・本人操作 連動テンプレート",
  "税制・口座チェックを実際の本人別入力欄へ接続しました。",
  [
    `<section><h2>目的</h2><p class="notice">税制レイヤーを確認補助で終わらせず、本人別にNISA口座、本人スマホ、本人ログイン、銀行口座、配当金受取方式、注文許可を入力する表にしました。未入力なら購入不可です。</p></section>`,
    `<section><h2>本人別入力欄</h2>${table(["口座ID", "氏名", "証券会社", "NISA", "残枠", "本人スマホ", "本人ログイン", "銀行口座", "配当方式", "注文可否", "ゲート"], accountRows.map((row) => ({
      口座ID: row.account_id,
      氏名: row.person_name,
      証券会社: row.broker,
      NISA: row.nisa_opened,
      残枠: row.nisa_growth_remaining_yen,
      本人スマホ: row.person_smartphone_ready,
      本人ログイン: row.person_login_ready,
      銀行口座: row.bank_account_ready,
      配当方式: row.dividend_method_checked,
      注文可否: row.order_permission,
      ゲート: row.gate,
    })))}</section>`,
    `<section><h2>CSV</h2><p><a href="nisa_account_linkage_template_20260613.csv">CSVを開く</a></p></section>`,
  ],
);

const universePolicyRows = [
  { updated_at: generatedAt, item: "母集団件数", rule: "厳密に100社固定ではなく、80〜120社程度。現行ファイルは100行。", reason: "きっちり100社に合わせるための恣意的な銘柄追加を避ける。" },
  { updated_at: generatedAt, item: "必要な価格指標", rule: "5年CAGR、10年CAGR、直近1年騰落率、60日騰落率、5年S&P差、直近1年S&P差、最大下落率、月次勝率を必須化。", reason: "短期急騰だけで選ばないため。" },
  { updated_at: generatedAt, item: "除外条件", rule: "直近60日が弱い、直近1年でS&P500に劣後、最大下落率が大きい、急騰後反動が強い銘柄は初回買付から外す。", reason: "上がった実績だけを過大評価しないため。" },
  { updated_at: generatedAt, item: "テーマ条件", rule: "テーマは公式数字、関連指数、株価反応の裏付けがない限り単独加点しない。", reason: "連想ゲームだけで候補化しないため。" },
  { updated_at: generatedAt, item: "再現性", rule: "候補10社を出す時は、母集団ファイル名、使用列、除外理由、順位を残す。", reason: "後からなぜ選んだか説明できるようにするため。" },
];
writeCsv("universe_reproducible_policy_20260613.csv", ["updated_at", "item", "rule", "reason"], universePolicyRows);
writeHtml(
  "universe_reproducible_policy_20260613.html",
  "100社母集団 再現ルール",
  "候補選定が恣意的に見えないよう、母集団条件と除外条件を固定しました。",
  [
    `<section><h2>方針</h2><p class="notice">母集団は「だいたい100社」でよく、件数合わせよりも再現性を優先します。使用指標、除外条件、順位、理由を残すことを必須にします。</p></section>`,
    `<section><h2>固定ルール</h2>${table(["項目", "ルール", "理由"], universePolicyRows.map((row) => ({ 項目: row.item, ルール: row.rule, 理由: row.reason })), { widths: { 項目: "18%" } })}</section>`,
    `<section><h2>CSV</h2><p><a href="universe_reproducible_policy_20260613.csv">CSVを開く</a></p></section>`,
  ],
);

const returnRows = current.map((row) => {
  const u = universeByTicker.get(row.ticker);
  const conf = u ? confidence(u) : { rank: "D", score: 0 };
  return {
    updated_at: generatedAt,
    ticker: row.ticker,
    name: row.name,
    universe_status: u?.["最終扱い"] || "未接続",
    confidence_rank: conf.rank,
    evidence_score_7: String(conf.score),
    five_year_cagr_pct: u?.["5年CAGR"] || "",
    ten_year_cagr_pct: u?.["10年CAGR"] || "",
    one_year_return_pct: u?.["直近1年騰落率"] || "",
    five_year_sp_diff_pct: u?.["5年S&P差"] || "",
    one_year_sp_diff_pct: u?.["直近1年S&P差"] || "",
    one_year_max_drawdown_pct: u?.["直近1年最大下落率"] || "",
    monthly_win_rate_pct: u?.["月次勝率"] || "",
    use_in_explanation: conf.rank === "A" || conf.rank === "B" ? "説明材料に使用可" : "期待リターン説明では慎重扱い",
  };
});
writeCsv("return_hypothesis_confidence_20260613.csv", [
  "updated_at", "ticker", "name", "universe_status", "confidence_rank", "evidence_score_7",
  "five_year_cagr_pct", "ten_year_cagr_pct", "one_year_return_pct", "five_year_sp_diff_pct",
  "one_year_sp_diff_pct", "one_year_max_drawdown_pct", "monthly_win_rate_pct", "use_in_explanation",
], returnRows);
writeHtml(
  "return_hypothesis_confidence_20260613.html",
  "期待リターン仮説 信頼度チェック",
  "期待リターンを確定値として扱わず、過去実績・S&P差・下落耐性・月次勝率から説明可能性を判定します。",
  [
    `<section><h2>改善点</h2><p class="notice">期待リターンは「確率的に勝てる証明」ではありません。この画面では、説明に使える銘柄と慎重扱いにする銘柄を分けます。</p></section>`,
    `<section><h2>銘柄別信頼度</h2>${table(["銘柄", "100社側扱い", "信頼度", "証拠数", "5年CAGR", "10年CAGR", "1年S&P差", "1年最大下落", "月次勝率", "説明での扱い"], returnRows.map((row) => ({
      銘柄: `${row.ticker} ${row.name}`,
      "100社側扱い": row.universe_status,
      信頼度: row.confidence_rank,
      証拠数: `${row.evidence_score_7}/7`,
      "5年CAGR": pct(row.five_year_cagr_pct),
      "10年CAGR": pct(row.ten_year_cagr_pct),
      "1年S&P差": pct(row.one_year_sp_diff_pct),
      "1年最大下落": pct(row.one_year_max_drawdown_pct),
      月次勝率: pct(row.monthly_win_rate_pct),
      説明での扱い: row.use_in_explanation,
    })), { widths: { 銘柄: "14%", 説明での扱い: "18%" } })}</section>`,
    `<section><h2>CSV</h2><p><a href="return_hypothesis_confidence_20260613.csv">CSVを開く</a></p></section>`,
  ],
);

const hubLinks = [
  ["candidate10_strict_gate_review_20260613.html", "候補10社 厳格ゲート再確認", "100社再選定側で監視・除外になっている銘柄を初回買付から外す安全側チェック。"],
  ["candidate10_risk_trade_rules_20260613.html", "候補10社 下値・上値ルール", "過去最大下落率を使った警戒・減額・停止・利確確認ルール。"],
  ["benchmark_plus1_trade_gate_20260613.html", "S&P500/TOPIX +1% 接続ルール", "指数に劣後した場合の追加停止・比率引下げルール。"],
  ["qualitative_theme_evidence_gate_20260613.html", "質的テーマ 実績検証ゲート", "テーマを単純加点せず、公式数字・指数・株価反応で裏付ける表。"],
  ["nisa_account_linkage_template_20260613.html", "NISA口座・本人操作 連動テンプレート", "本人別のNISA口座・本人スマホ・ログイン・残枠入力欄。"],
  ["universe_reproducible_policy_20260613.html", "100社母集団 再現ルール", "母集団条件、必要指標、除外条件の固定。"],
  ["return_hypothesis_confidence_20260613.html", "期待リターン仮説 信頼度チェック", "期待リターンを確定値にせず、説明可能性をランク化。"],
];

writeHtml(
  "decision_improvement_pack_20260613.html",
  "運用判断 改善パック",
  "不備として残っていた買付比率、撤退条件、質的テーマ、税制・口座、母集団、期待リターン仮説を実務画面へ接続しました。",
  [
    `<section><h2>改善した範囲</h2><p class="notice">現行候補10社をそのまま買うのではなく、厳格ゲート、下値・上値ルール、指数劣後時の比率引下げ、質的テーマの裏付け、NISA本人操作、母集団再現性、期待リターン信頼度を別々に確認できるようにしました。</p></section>`,
    `<section><h2>確認画面</h2><div class="cards">${hubLinks.map(([href, label, note]) => `<a class="link-card" href="${href}"><b>${esc(label)}</b><span>${esc(note)}</span></a>`).join("")}</div></section>`,
  ],
);

const hubCard = `<a class="card" href="decision_improvement_pack_20260613.html">
          <b>運用判断 改善パック</b>
          <span>厳格ゲート、撤退条件、質的テーマ検証、NISA連動、母集団再現性、期待リターン信頼度を整理。</span>
        </a>`;

insertCardAfter("index.html", "post0618_prebuy_ticket_20260613.html", hubCard, "decision_improvement_pack_20260613.html");
insertCardAfter("896_practical_entry_hub_20260606.html", "post0618_prebuy_ticket_20260613.html", hubCard.replace('class="card"', 'class="link-card"'), "decision_improvement_pack_20260613.html");

console.log("generated decision improvement pack");
