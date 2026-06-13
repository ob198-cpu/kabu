import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const now = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date());

const TOTAL_CAPITAL = 2_400_000;
const STAGE = {
  allPassPct: 0.35,
  attentionPct: 0.15,
  badPct: 0,
  secondPct: 0.20,
  thirdPct: 0.15,
  reservePct: 0.30,
};

const candidates = [
  {
    rank: 1,
    ticker: "8053.T",
    name: "住友商事",
    channel: "総合候補",
    role: "中心候補",
    tags: ["商社", "資源", "円安", "還元"],
    weight: 0.1875,
    score: 9,
    reason: "商社・資源・株主還元の複数材料を持つ。イベント後は資源価格、為替、商社指数の反応を確認する。",
    stop: "資源価格急落、円高急進、決算で利益見通しが弱い場合は保留。",
  },
  {
    rank: 2,
    ticker: "8316.T",
    name: "三井住友FG",
    channel: "総合候補",
    role: "中心候補",
    tags: ["銀行", "金利", "金融"],
    weight: 0.1875,
    score: 9,
    reason: "金利上昇局面で利ざや改善が期待される一方、信用コストと日銀政策を確認する。",
    stop: "日銀後に銀行株全体が急落、または信用コスト懸念が強まる場合は保留。",
  },
  {
    rank: 3,
    ticker: "6501.T",
    name: "日立製作所",
    channel: "データセンター・電力・冷却・電線",
    role: "中心候補",
    tags: ["AIインフラ", "電力", "データセンター", "総合電機"],
    weight: 0.1875,
    score: 9,
    reason: "AIインフラ・電力・デジタルの横断テーマを持つ。受注と利益率をイベント後に確認する。",
    stop: "大型株指数が弱く、同社が指数より弱い場合は保留。",
  },
  {
    rank: 4,
    ticker: "6503.T",
    name: "三菱電機",
    channel: "総合候補",
    role: "条件付き候補",
    tags: ["FA", "電力", "防衛", "総合電機"],
    weight: 0.0625,
    score: 7,
    reason: "FA、電力、防衛の複数テーマ。景気感応度があるため指数反応を確認する。",
    stop: "FA関連や設備投資関連が弱い場合は小比率または保留。",
  },
  {
    rank: 5,
    ticker: "6857.T",
    name: "アドバンテスト",
    channel: "半導体製造装置・材料",
    role: "条件付き候補",
    tags: ["半導体", "高PER", "高ボラ", "AI"],
    weight: 0.0625,
    score: 7,
    reason: "AI半導体の検査装置テーマ。SOX、NASDAQ、金利に強く反応しやすい。",
    stop: "米金利急騰、SOX急落、株価急騰後の反落リスクが強い場合は買わない。",
  },
  {
    rank: 6,
    ticker: "8035.T",
    name: "東京エレクトロン",
    channel: "半導体製造装置・材料",
    role: "条件付き候補",
    tags: ["半導体", "高PER", "高ボラ", "製造装置"],
    weight: 0.0625,
    score: 7,
    reason: "半導体製造装置の代表候補。SOXと装置株全体の反応を確認する。",
    stop: "SOX/NASDAQが弱い、または高PER株売りが強い場合は保留。",
  },
  {
    rank: 7,
    ticker: "7011.T",
    name: "三菱重工業",
    channel: "データセンター・電力・冷却・電線",
    role: "条件付き候補",
    tags: ["防衛", "電力", "エネルギー"],
    weight: 0.0625,
    score: 7,
    reason: "防衛・電力・エネルギーの構造需要を持つ。直近の過熱と下落率を確認する。",
    stop: "短期過熱後の反落、受注材料の織り込み過多が見える場合は保留。",
  },
  {
    rank: 8,
    ticker: "6762.T",
    name: "TDK",
    channel: "フィジカルAI",
    role: "条件付き候補",
    tags: ["電子部品", "AI端末", "電池", "フィジカルAI"],
    weight: 0.0625,
    score: 7,
    reason: "AI端末、電池、電子部品の複合テーマ。半導体ほど一方向ではないため反応確認を重視する。",
    stop: "電子部品株が指数より弱い、または為替悪化時は保留。",
  },
  {
    rank: 9,
    ticker: "6146.T",
    name: "ディスコ",
    channel: "半導体製造装置・材料",
    role: "条件付き候補",
    tags: ["半導体", "高PER", "高ボラ", "精密加工"],
    weight: 0.0625,
    score: 7,
    reason: "半導体精密加工の構造優位候補。ただし値動きが大きく、イベント後確認が必須。",
    stop: "急騰後、出来高を伴わない上昇、SOX弱化時は保留。",
  },
  {
    rank: 10,
    ticker: "5803.T",
    name: "フジクラ",
    channel: "データセンター・電力・冷却・電線",
    role: "条件付き候補",
    tags: ["電線", "データセンター", "高ボラ", "AIインフラ"],
    weight: 0.0625,
    score: 7,
    reason: "AIデータセンター・電線テーマの代表候補。テーマ性は強いが過熱確認が必要。",
    stop: "データセンター関連が反落、または短期過熱が強い場合は保留。",
  },
];

const eventRows = [
  {
    event_id: "E01",
    planned_date: "2026-06-10",
    event: "米5月CPI",
    input_required: "CPI前年比・前月比、米10年金利、NASDAQ、SOX、VIX、ドル円",
    actual_value: "入力済み/確認中",
    market_reaction: "注意",
    pass_condition: "インフレ再加速と米金利急騰が同時に起きず、NASDAQ/SOXが大崩れしない",
    current_status: "注意",
    action_if_fail: "半導体・高PER・高ボラ候補は買付前ゲートを厳格化",
  },
  {
    event_id: "E02",
    planned_date: "2026-06-15〜2026-06-16",
    event: "日銀会合",
    input_required: "政策変更、ドル円、日経平均/TOPIX、銀行・商社・輸出株反応",
    actual_value: "",
    market_reaction: "",
    pass_condition: "急な円高ショックと日本株指数の大幅下落が同時に出ない",
    current_status: "未入力",
    action_if_fail: "日本株の予定買付を延期、または比率を下げる",
  },
  {
    event_id: "E03",
    planned_date: "2026-06-16〜2026-06-17",
    event: "FOMC",
    input_required: "政策金利見通し、米10年金利、NASDAQ、SOX、ドル円",
    actual_value: "",
    market_reaction: "",
    pass_condition: "米長期金利が急騰せず、ハイテク株のリスク許容度が崩れない",
    current_status: "未入力",
    action_if_fail: "半導体・高PER・高ボラ候補を延期",
  },
  {
    event_id: "E04",
    planned_date: "2026-06-18以降",
    event: "最終購入前確認",
    input_required: "候補別株価、PER/PBR/ROE、直近下落率、未確認データ、証券会社画面",
    actual_value: "",
    market_reaction: "",
    pass_condition: "停止条件なし、未確認データを点数に混ぜない、本人操作とNISA口座区分を確認",
    current_status: "未入力",
    action_if_fail: "監視継続または初回除外",
  },
];

const marketUpdatePath = path.join(ROOT, "data", "market_update.json");
const marketUpdate = fs.existsSync(marketUpdatePath)
  ? JSON.parse(fs.readFileSync(marketUpdatePath, "utf8"))
  : { updatedAt: now, stocks: [], markets: [], summary: "" };

const stockSignal = new Map((marketUpdate.stocks || []).map((row) => [row.symbol, row]));
const unresolvedEvents = eventRows.filter((row) => row.current_status === "未入力").length;
const hasAttention = eventRows.some((row) => row.current_status === "注意");
const overallStatus = unresolvedEvents > 0 ? "保留" : hasAttention ? "注意" : "通過";

function eventImpact(candidate) {
  if (unresolvedEvents > 0) return "イベント未入力のため購入停止";
  if (hasAttention && candidate.tags.some((tag) => ["半導体", "高PER", "高ボラ", "AI"].includes(tag))) {
    return "注意: 高PER・半導体・高ボラのため小比率または保留";
  }
  return "通過候補";
}

function allocationFor(candidate, scenario) {
  const investPct = scenario === "all" ? STAGE.allPassPct : scenario === "attention" ? STAGE.attentionPct : STAGE.badPct;
  return Math.round(TOTAL_CAPITAL * investPct * candidate.weight);
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, headers, rows) {
  const text = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")),
  ].join("\n");
  fs.writeFileSync(path.join(ROOT, file), `\uFEFF${text}\n`, "utf8");
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const checklist = [
  ["市場イベント", "米CPI、日銀会合、FOMC後の金利・為替・指数反応を確認", "赤判定なし。黄判定なら保守配分", "赤なら購入停止"],
  ["候補10社", "現在の10社とチャンネルを確認", "中心候補・条件付き候補・監視を分ける", "未確認値を点数に混ぜる銘柄は購入候補にしない"],
  ["資金配分", "240万円、初回35%上限、保守時15%上限、現金待機を確認", "ゲートに応じて上限内で分割", "比率未定なら注文金額を確定しない"],
  ["NISA口座", "本人名義、本人ログイン、本人操作、NISA口座区分、残枠を確認", "本人が証券会社画面で発注", "本人操作・口座区分・残枠未確認なら停止"],
  ["記録", "購入理由、買わない条件、期待値、比較指数、撤退条件を記録", "運用記録CSVに残す", "記録できない場合はテスト価値が下がるため保留"],
].map(([section, required, pass_condition, fail_action]) => ({
  updated_at: now,
  section,
  required,
  pass_condition,
  fail_action,
}));

const blockers = [
  ["赤", "E02またはE03で金利・為替・指数が大きく悪化", "新規購入停止"],
  ["赤", "日経平均/TOPIXが75日線を明確に下回る", "個別株買付停止"],
  ["赤", "候補銘柄に下方修正、決算悪化、重大悪材料", "該当銘柄を初回除外"],
  ["赤", "本人操作・NISA口座区分・残枠が未確認", "購入停止"],
  ["黄", "CPI後に高PER・半導体が不安定", "半導体・高ボラ候補を小比率または保留"],
  ["黄", "データ未確認が残る", "条件付き候補へ下げる"],
].map(([severity, condition, action]) => ({ updated_at: now, severity, condition, action }));

const finalGate = [
  ["市場ゲート", overallStatus, unresolvedEvents === 0 ? "イベント入力済み" : `未入力イベント ${unresolvedEvents} 件`, "6/18以降に更新"],
  ["候補ゲート", "条件付き", "10社は現行候補だが、イベント後反応と証券会社画面確認が必要", "中心候補と条件付き候補を分ける"],
  ["配分ゲート", "保留", "現時点の購入額は0円。全イベント確認後に初回35%上限を検討", "保守時は15%上限"],
  ["NISAゲート", "未確認", "本人操作・口座区分・残枠確認が必要", "未確認なら買わない"],
].map(([gate, status, reason, action]) => ({ updated_at: now, gate, status, reason, action }));

const rules = [
  ["E01", "米CPI", "米10年金利+15bp以上、またはNASDAQ/SOX日次-3%以上", "米10年金利+8bp以上、またはNASDAQ/SOX日次-1.5%以上", "半導体/高PER/高ボラ", "注意なら影響タグ銘柄を保守", "悪化なら影響タグ銘柄を延期", "高"],
  ["E02", "日銀会合", "急な円高と日経平均/TOPIX急落が同時発生", "円高方向だが指数下落は限定的", "日本株/銀行/商社/輸出", "予定買付を保守", "日本株買付停止または延期", "高"],
  ["E03", "FOMC", "米10年金利+15bp以上、またはNASDAQ/SOX日次-3%以上", "米10年金利+8bp以上、またはNASDAQ/SOX日次-1.5%以上", "半導体/高PER/高ボラ/輸出", "影響タグ銘柄を保守", "影響タグ銘柄を延期", "高"],
  ["E04", "最終購入前確認", "停止条件1件以上、または未確認データが重要項目に残る", "中重要度の未確認項目が残る", "全銘柄", "該当銘柄を保留", "該当銘柄を初回除外", "最重要"],
].map(([event_id, event, bad_signal, attention_signal, affected_tags, if_attention, if_bad, severity]) => ({
  event_id, event, bad_signal, attention_signal, affected_tags, if_attention, if_bad, severity,
}));

const candidateMatrix = candidates.map((c) => ({
  updated_at: now,
  rank: c.rank,
  ticker: c.ticker,
  name: c.name,
  channel: c.channel,
  role: c.role,
  score: c.score,
  target_weight_pct: (c.weight * 100).toFixed(2),
  tags: c.tags.join("/"),
  reason: c.reason,
  stop_condition: c.stop,
}));

const engineRows = candidates.map((c) => {
  const quote = stockSignal.get(c.ticker) || {};
  const impact = eventImpact(c);
  const status = unresolvedEvents > 0 ? "保留" : impact.startsWith("注意") ? "確認" : "候補";
  return {
    updated_at: now,
    ticker: c.ticker,
    name: c.name,
    channel: c.channel,
    role: c.role,
    market_signal: quote.signal || "未取得",
    one_day_change_pct: Number.isFinite(quote.changePct) ? quote.changePct.toFixed(2) : "",
    event_status: overallStatus,
    engine_status_now: status,
    prebuy_gate: unresolvedEvents > 0 ? "イベント未入力" : impact,
    reference_score: c.score,
    data_coverage_points: status === "保留" ? 70 : 80,
    risk_tags: c.tags.join("/"),
    current_allocation_yen: 0,
    reason: c.reason,
    stop_condition: c.stop,
  };
});

const allocationRows = candidates.map((c) => {
  const quote = stockSignal.get(c.ticker) || {};
  return {
    updated_at: now,
    ticker: c.ticker,
    name: c.name,
    role: c.role,
    target_weight_pct: (c.weight * 100).toFixed(2),
    market_signal: quote.signal || "未取得",
    current_allocation_yen: 0,
    current_cash_yen: TOTAL_CAPITAL,
    all_pass_allocation_yen: allocationFor(c, "all"),
    attention_allocation_yen: allocationFor(c, "attention"),
    bad_event_allocation_yen: allocationFor(c, "bad"),
    max_position_note: "全イベント確認後のみ初回35%上限。注意時は15%上限。赤判定時は0円。",
    condition_to_use: "E02/E03/E04入力、本人操作、NISA口座区分、証券会社画面確認",
  };
});

const scenarioRows = [
  {
    updated_at: now,
    scenario: "緑: 全イベント確認後",
    stock_investment_yen: Math.round(TOTAL_CAPITAL * STAGE.allPassPct),
    cash_yen: TOTAL_CAPITAL - Math.round(TOTAL_CAPITAL * STAGE.allPassPct),
    action: "初回35%上限。中心候補を厚め、条件付き候補を小比率。",
  },
  {
    updated_at: now,
    scenario: "黄: 注意あり",
    stock_investment_yen: Math.round(TOTAL_CAPITAL * STAGE.attentionPct),
    cash_yen: TOTAL_CAPITAL - Math.round(TOTAL_CAPITAL * STAGE.attentionPct),
    action: "初回15%上限。半導体・高PER・高ボラは保留または小比率。",
  },
  {
    updated_at: now,
    scenario: "赤: 悪化",
    stock_investment_yen: 0,
    cash_yen: TOTAL_CAPITAL,
    action: "新規購入停止。監視と記録のみ。",
  },
  {
    updated_at: now,
    scenario: "第2回",
    stock_investment_yen: Math.round(TOTAL_CAPITAL * STAGE.secondPct),
    cash_yen: "",
    action: "初回後の実績、指数比較、決算後反応を確認して追加上限20%。",
  },
  {
    updated_at: now,
    scenario: "第3回",
    stock_investment_yen: Math.round(TOTAL_CAPITAL * STAGE.thirdPct),
    cash_yen: "",
    action: "さらに確認後の追加上限15%。最低30%は現金待機。",
  },
];

const riskTransferRows = [
  ["個別株がS&P500/TOPIXに1か月で2%以上劣後", "追加購入を止める", "原因を指数・業種・個別決算に分解"],
  ["個別株が3か月でS&P500/TOPIXに5%以上劣後", "個別株比率を下げる", "候補10社の入替または投信比率増加を検討"],
  ["候補銘柄が購入後-5%", "理由確認", "指数連動なら保留、個別悪材料なら縮小"],
  ["候補銘柄が購入後-10%", "追加停止", "決算・下方修正・テーマ崩れを確認"],
  ["ストップ安または重大悪材料", "新規買付停止", "成行売却は避け、寄付き後の流動性と開示を確認"],
].map(([trigger, action, note]) => ({ updated_at: now, trigger, action, note }));

const operationLog = [
  ["2026-06-13", "運用整理", "旧候補が残る6月ゲート運用表を現在10社に更新", "完了"],
  ["2026-06-13", "市場データ", "market_update.jsonを再取得し、候補別の確認判定を反映", "完了"],
  ["2026-06-18以降", "購入前", "E02/E03/E04を入力し、資金配分を再判定", "予定"],
].map(([date, category, action, status]) => ({ date, category, action, status }));

writeCsv("100_june_event_gate_checklist.csv", ["updated_at", "section", "required", "pass_condition", "fail_action"], checklist);
writeCsv("101_june_gate_blockers.csv", ["updated_at", "severity", "condition", "action"], blockers);
writeCsv("102_june_event_result_input.csv", ["event_id", "planned_date", "event", "input_required", "actual_value", "market_reaction", "pass_condition", "current_status", "action_if_fail"], eventRows);
writeCsv("103_june_final_gate_template.csv", ["updated_at", "gate", "status", "reason", "action"], finalGate);
writeCsv("104_june_event_gate_rules.csv", ["event_id", "event", "bad_signal", "attention_signal", "affected_tags", "if_attention", "if_bad", "severity"], rules);
writeCsv("105_june_event_candidate_matrix.csv", ["updated_at", "rank", "ticker", "name", "channel", "role", "score", "target_weight_pct", "tags", "reason", "stop_condition"], candidateMatrix);
writeCsv("106_june_event_engine_output.csv", ["updated_at", "ticker", "name", "channel", "role", "market_signal", "one_day_change_pct", "event_status", "engine_status_now", "prebuy_gate", "reference_score", "data_coverage_points", "risk_tags", "current_allocation_yen", "reason", "stop_condition"], engineRows);
writeCsv("107_capital_allocation_rules.csv", ["updated_at", "rule", "value", "description"], [
  { updated_at: now, rule: "total_capital_yen", value: TOTAL_CAPITAL, description: "1口座あたりの想定資金" },
  { updated_at: now, rule: "first_all_pass_pct", value: "35%", description: "全イベント確認後の初回投入上限" },
  { updated_at: now, rule: "first_attention_pct", value: "15%", description: "注意判定が残る場合の初回投入上限" },
  { updated_at: now, rule: "bad_event_pct", value: "0%", description: "赤判定時は買わない" },
  { updated_at: now, rule: "reserve_pct", value: "30%以上", description: "現金待機。急落・再判定用" },
]);
writeCsv("108_capital_allocation_by_ticker.csv", ["updated_at", "ticker", "name", "role", "target_weight_pct", "market_signal", "current_allocation_yen", "current_cash_yen", "all_pass_allocation_yen", "attention_allocation_yen", "bad_event_allocation_yen", "max_position_note", "condition_to_use"], allocationRows);
writeCsv("109_capital_scenario_plan.csv", ["updated_at", "scenario", "stock_investment_yen", "cash_yen", "action"], scenarioRows);
writeCsv("110_capital_risk_transfer_rules.csv", ["updated_at", "trigger", "action", "note"], riskTransferRows);
writeCsv("111_operation_decision_log.csv", ["date", "category", "action", "status"], operationLog);

function table(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${headers.map((h) => `<td>${esc(row[h])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function pageShell(title, lead, body) {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
:root{--navy:#123b5d;--blue:#0f6f9e;--green:#16805d;--amber:#d88700;--red:#b43c3c;--line:#d9e4ef;--bg:#f5f8fb}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:#172033;font-family:"Yu Gothic","Meiryo",Arial,sans-serif;line-height:1.7}
header{background:linear-gradient(135deg,#123b5d,#0f6f9e);color:#fff;padding:30px 22px}main{max-width:1320px;margin:auto;padding:22px}
h1{margin:0 0 8px;font-size:clamp(24px,4vw,38px)}h2{margin:28px 0 10px;border-left:8px solid var(--blue);padding-left:12px;color:#083a5b}.lead{max-width:980px;color:#e8f6ff;font-weight:800}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:12px}.card,.box{background:#fff;border:1px solid var(--line);border-radius:14px;padding:15px 17px;box-shadow:0 3px 12px rgba(20,50,80,.05)}
.card b{display:block;font-size:30px;color:var(--blue)}.warn{border-left:8px solid var(--amber);background:#fff8ea}.bad{border-left:8px solid var(--red);background:#fff1f1}.ok{border-left:8px solid var(--green);background:#effaf5}
.table-wrap{overflow:auto;border:1px solid var(--line);border-radius:14px;background:#fff;margin:12px 0 24px}
table{border-collapse:collapse;width:100%;min-width:980px;table-layout:fixed}th,td{border:1px solid var(--line);padding:10px;text-align:left;vertical-align:top;overflow-wrap:anywhere;word-break:break-word}th{background:#e8f3fb;color:#083a5b}
.links a{display:inline-block;margin:6px 8px 0 0;background:var(--blue);color:white;text-decoration:none;border-radius:8px;padding:9px 12px;font-weight:900}
.pill{display:inline-block;border-radius:999px;color:#fff;padding:4px 10px;font-weight:900}.hold{background:var(--amber)}.go{background:var(--green)}.stop{background:var(--red)}
@media(max-width:860px){main{padding:12px}table{min-width:900px}}
</style>
</head>
<body>
<header><h1>${esc(title)}</h1><p class="lead">${esc(lead)}</p></header>
<main>
<div class="links">
  <a href="index.html">ホーム</a>
  <a href="914_daily_operation_flow_20260606.html">実用フロー</a>
  <a href="june_event_gate_engine.html">銘柄別イベント判定</a>
  <a href="capital_allocation_plan.html">資金配分</a>
</div>
${body}
</main>
</body>
</html>`;
}

const gateSummaryCards = `
<section class="box warn">
  <h2>現在の扱い</h2>
  <div class="grid">
    <div class="card"><span>イベント状態</span><b>${esc(overallStatus)}</b><p>未入力イベント: ${unresolvedEvents} 件</p></div>
    <div class="card"><span>現時点の購入額</span><b>0円</b><p>6/18以降の最終確認まで買付額は確定しません。</p></div>
    <div class="card"><span>緑判定時</span><b>${Math.round(TOTAL_CAPITAL * STAGE.allPassPct).toLocaleString("ja-JP")}円</b><p>初回35%上限。</p></div>
    <div class="card"><span>黄判定時</span><b>${Math.round(TOTAL_CAPITAL * STAGE.attentionPct).toLocaleString("ja-JP")}円</b><p>初回15%上限。</p></div>
  </div>
</section>`;

const gateHtml = pageShell(
  "6月ゲート運用表",
  `作成: ${now} / 18日以降に、CPI・日銀・FOMC・最終購入前確認を通して「買う・保留・止める」を判断する表です。`,
  `${gateSummaryCards}
  <section class="box"><h2>1. 6月イベント入力状況</h2>${table(["event_id", "planned_date", "event", "current_status", "pass_condition", "action_if_fail"], eventRows)}</section>
  <section class="box"><h2>2. 現在の候補10社</h2>${table(["rank", "ticker", "name", "channel", "role", "score", "target_weight_pct", "reason", "stop_condition"], candidateMatrix)}</section>
  <section class="box"><h2>3. 銘柄別の現時点判定</h2>${table(["ticker", "name", "channel", "role", "market_signal", "one_day_change_pct", "engine_status_now", "prebuy_gate", "current_allocation_yen"], engineRows)}</section>
  <section class="box"><h2>4. 停止条件</h2>${table(["severity", "condition", "action"], blockers)}</section>`
);

const allocationHtml = pageShell(
  "240万円 資金配分ゲート",
  `作成: ${now} / 6月イベント後の判定に応じて、1口座240万円の初回投入上限を切り替える表です。`,
  `<section class="box warn"><h2>現在の扱い</h2><p>現時点ではE02・E03・E04が未入力のため、現在の購入額は0円です。6/18以降にイベント結果、候補別反応、本人操作、NISA口座区分、証券会社画面を確認してから上限を使います。</p></section>
  <section class="box"><h2>1. シナリオ別配分</h2>${table(["scenario", "stock_investment_yen", "cash_yen", "action"], scenarioRows)}</section>
  <section class="box"><h2>2. 銘柄別配分上限</h2>${table(["ticker", "name", "role", "target_weight_pct", "market_signal", "current_allocation_yen", "all_pass_allocation_yen", "attention_allocation_yen", "bad_event_allocation_yen", "condition_to_use"], allocationRows)}</section>
  <section class="box"><h2>3. 比率引き下げ・途中停止ルール</h2>${table(["trigger", "action", "note"], riskTransferRows)}</section>`
);

fs.writeFileSync(path.join(ROOT, "june_gate_operation.html"), gateHtml, "utf8");
fs.writeFileSync(path.join(ROOT, "capital_allocation_plan.html"), allocationHtml, "utf8");

console.log("rebuilt June operation state");
console.log(`overallStatus=${overallStatus}, unresolvedEvents=${unresolvedEvents}`);
