import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const generatedAt = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date());

function write(file, text) {
  fs.writeFileSync(path.join(root, file), text, "utf8");
}

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows) {
  const header = Object.keys(rows[0] ?? {});
  return `${header.join(",")}\n${rows.map((row) => header.map((h) => csvEscape(row[h])).join(",")).join("\n")}\n`;
}

const inputCriteria = [
  {
    category: "定量",
    input_value: "良好",
    numeric_rule: "データ10/10、売上前年比+5%以上、利益前年比+10%以上、ROE10%以上、決算後反応スコア60点以上、60日最大下落率-15%以内のうち大半を満たす",
    judgement_use: "企業数字と株価反応が同じ方向にそろっている場合だけ良好にする。",
  },
  {
    category: "定量",
    input_value: "中立",
    numeric_rule: "データ9/10以上、利益成長はプラスだが弱い、決算後反応50-59点、60日最大下落率-15%から-25%程度",
    judgement_use: "悪くはないが、追加確認なしに中心候補へ上げない。",
  },
  {
    category: "定量",
    input_value: "不十分",
    numeric_rule: "重要指標未取得、利益成長マイナス、決算後反応50点未満、60日最大下落率-25%以下、PER/PBRの割高を利益成長で説明できない",
    judgement_use: "再判定では原則として外す。質的イベントだけでは上書きしない。",
  },
  {
    category: "マクロ",
    input_value: "良好",
    numeric_rule: "米CPIが市場予想以下、FOMC後の米10年金利上昇が+10bp以内、日銀後に急激な円高・金利急騰がない",
    judgement_use: "市場全体がリスクを取りやすい状態として扱う。",
  },
  {
    category: "マクロ",
    input_value: "中立",
    numeric_rule: "米CPIが市場予想比+0.1から+0.2pt程度、米10年金利上昇が+10から+25bp程度、為替変動が通常範囲",
    judgement_use: "候補は残せるが、投入判断は市場確認とセットにする。",
  },
  {
    category: "マクロ",
    input_value: "悪化",
    numeric_rule: "米CPIが市場予想比+0.3pt以上、米10年金利が+25bp超上昇、日銀後に円高ショックまたは日本金利急騰",
    judgement_use: "高PER株・半導体・輸出株は特に慎重に扱う。",
  },
  {
    category: "市場",
    input_value: "良好",
    numeric_rule: "日経平均/TOPIXが75日線上、イベント後5営業日で-2%以内、VIX20以下、売買代金が極端に縮小していない",
    judgement_use: "候補スコアをそのまま使いやすい状態。",
  },
  {
    category: "市場",
    input_value: "中立",
    numeric_rule: "75日線近辺、イベント後5営業日で-2%から-5%、VIX20から25",
    judgement_use: "候補を絞るが、全体停止ではない。",
  },
  {
    category: "市場",
    input_value: "悪化",
    numeric_rule: "日経平均/TOPIXが75日線を明確に下回る、イベント後5営業日で-5%超、VIX25超",
    judgement_use: "個別株候補は原則保留または外す。",
  },
  {
    category: "業種",
    input_value: "良好",
    numeric_rule: "対象業種指数または代表ETFがイベント後5営業日でTOPIXを+2%以上上回る。関連マクロも追い風。",
    judgement_use: "同じテーマ内で候補順位を上げる根拠にする。",
  },
  {
    category: "業種",
    input_value: "中立",
    numeric_rule: "対象業種がTOPIX比±2%以内。追い風と逆風が混在。",
    judgement_use: "個別数字を優先して判定する。",
  },
  {
    category: "業種",
    input_value: "悪化",
    numeric_rule: "対象業種がTOPIXを-2%以上下回る。半導体ならSOX急落、銀行なら銀行株指数下落など。",
    judgement_use: "個別に良い材料があっても、候補を一段下げる。",
  },
  {
    category: "個別",
    input_value: "良好",
    numeric_rule: "下方修正なし、決算後20営業日でTOPIXを+3%以上上回る、出来高を伴って75日線上を維持",
    judgement_use: "中心候補へ残す根拠にする。",
  },
  {
    category: "個別",
    input_value: "中立",
    numeric_rule: "決算後反応はTOPIX比±3%以内、悪材料なし、価格位置は横ばい",
    judgement_use: "追加確認が必要な候補として扱う。",
  },
  {
    category: "個別",
    input_value: "悪化",
    numeric_rule: "下方修正、決算後20営業日でTOPIXを-3%以上下回る、75日線を明確に下回る、急落時の出来高増",
    judgement_use: "原則として保留または外す。",
  },
  {
    category: "質的イベント",
    input_value: "追い風",
    numeric_rule: "新製品、TOB、政策、提携、供給不足、価格改定などがあり、対象企業の売上・利益・シェアへつながる経路を説明できる",
    judgement_use: "+3点まで。定量・マクロ・市場の悪化を単独で打ち消さない。",
  },
  {
    category: "質的イベント",
    input_value: "中立",
    numeric_rule: "イベントはあるが、売上・利益への経路や時期が未確認",
    judgement_use: "点数に影響させず、メモとして残す。",
  },
  {
    category: "質的イベント",
    input_value: "逆風",
    numeric_rule: "規制、事故、供給過多、価格下落、競争激化、地政学リスクなどがあり、業績悪化の経路を説明できる",
    judgement_use: "-8点。重大停止に該当する場合は別途カウントする。",
  },
];

const hardStops = [
  {
    item: "下方修正・減益見通し",
    trigger: "会社予想の下方修正、または次期利益見通しが市場期待を明確に下回る",
    action: "重大停止1件。購入候補から原則外す方向で再評価。",
  },
  {
    item: "市場全体の崩れ",
    trigger: "日経平均/TOPIXが75日線を明確に下回り、5営業日で-5%超",
    action: "個別株選定を一時停止し、指数・現金比率の再確認へ移す。",
  },
  {
    item: "金利急騰",
    trigger: "FOMC後またはCPI後に米10年金利が+25bp超上昇",
    action: "高PER、半導体、AI関連を一段下げる。",
  },
  {
    item: "円高ショック",
    trigger: "日銀後にドル円が短期で2%以上円高方向に動く",
    action: "輸出・海外売上比率の高い銘柄は保留へ下げる。",
  },
  {
    item: "決算後の指数劣後",
    trigger: "決算後20営業日でTOPIX比-3%以上。出来高増を伴う場合はより重く扱う",
    action: "個別確認を悪化にし、必要なら重大停止1件。",
  },
  {
    item: "過熱の反動",
    trigger: "1年上昇率100%超かつ決算後反応が50点台以下、または60日最大下落率-25%以下",
    action: "中心候補にしない。監視または保留。",
  },
];

const sectorCriteria = [
  {
    sector: "銀行",
    watch_data: "日銀方針、日本10年金利、銀行株指数、信用コスト、PBR、ROE",
    positive_condition: "金利上昇メリットがあり、銀行株指数がTOPIXを上回り、信用コスト悪化が見えない",
    negative_condition: "日銀後に銀行株が崩れる、信用コスト懸念、金利上昇メリットの後退",
  },
  {
    sector: "半導体・電子部品",
    watch_data: "SOX指数、NASDAQ、米金利、受注、設備投資、PER/PBR、決算後反応",
    positive_condition: "SOXがTOPIX比で強く、受注・利益成長で高PER/PBRを説明できる",
    negative_condition: "米金利上昇、SOX急落、決算後反応の指数劣後、利益成長鈍化",
  },
  {
    sector: "商社・資源",
    watch_data: "資源価格、為替、株主還元、自社株買い、PBR、海外投資家動向",
    positive_condition: "還元姿勢が維持され、資源・為替が大きく逆風でなく、商社株全体が崩れていない",
    negative_condition: "資源価格下落、円高、還元期待の後退、商社株全体の指数劣後",
  },
  {
    sector: "食品・生活防衛",
    watch_data: "原材料価格、為替、値上げ浸透、営業利益率、PER、決算後反応",
    positive_condition: "値上げ・原価管理・高付加価値事業で高PERを説明できる",
    negative_condition: "原価上昇、値上げ限界、利益成長鈍化、高PERの調整",
  },
  {
    sector: "防衛・重工",
    watch_data: "防衛予算、受注、工事進捗、PER、下落率、出来高",
    positive_condition: "政策テーマと受注が維持され、直近下落が止まり、出来高を伴って反転する",
    negative_condition: "直近下落継続、200日線割れ、政策期待だけで利益成長が追いつかない",
  },
];

write("668_june_recheck_input_criteria.csv", toCsv(inputCriteria));
write("669_june_recheck_hard_stop_criteria.csv", toCsv(hardStops));
write("670_june_recheck_sector_criteria.csv", toCsv(sectorCriteria));

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (m) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
}[m]));

function table(rows) {
  const header = Object.keys(rows[0] ?? {});
  return `<table><thead><tr>${header.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${header.map((h) => `<td>${esc(row[h])}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
}

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>6月再判定 入力基準表</title>
  <style>
    :root { --ink:#061d33; --blue:#0b6fa4; --line:#c9dced; --bg:#f6f9fc; --warn:#b45f06; --red:#b42318; }
    * { box-sizing:border-box; }
    body { margin:0; font-family:"Yu Gothic","Meiryo",Arial,sans-serif; color:var(--ink); background:var(--bg); line-height:1.7; }
    header { background:#123f63; color:#fff; padding:28px 32px; }
    h1 { margin:0 0 8px; font-size:28px; }
    main { max-width:1280px; margin:0 auto; padding:22px; }
    section { background:#fff; border:1px solid var(--line); border-radius:10px; padding:20px; margin:0 0 18px; break-inside:avoid; }
    h2 { margin:0 0 12px; padding-left:12px; border-left:8px solid var(--blue); font-size:22px; }
    .lead { font-size:16px; color:#111; }
    .note { background:#fff8ec; border:1px solid #efc98e; border-radius:8px; padding:12px; color:#111; }
    .danger { background:#fff0ef; border:1px solid #efaaa3; border-radius:8px; padding:12px; color:#111; }
    .wide { overflow-x:auto; }
    table { width:100%; border-collapse:collapse; table-layout:fixed; font-size:13px; min-width:1080px; }
    th, td { border:1px solid var(--line); padding:8px; vertical-align:top; overflow-wrap:anywhere; word-break:break-word; }
    th { background:#e7f1fa; color:#06395b; text-align:left; }
    a.button { display:inline-block; margin:4px 8px 4px 0; padding:8px 12px; border:1px solid #8bb9d6; border-radius:8px; color:#064f79; text-decoration:none; font-weight:700; background:#fff; }
    @media (max-width:760px){ main{padding:12px;} header{padding:22px 18px;} h1{font-size:24px;} table{font-size:12px;} }
  </style>
</head>
<body>
  <header>
    <h1>6月再判定 入力基準表</h1>
    <div>作成: ${esc(generatedAt)} / 再判定シートの入力を主観でなく数値基準に近づけるための基準表</div>
  </header>
  <main>
    <section>
      <h2>1. 位置づけ</h2>
      <p class="lead">この基準表は、10社を6月イベント後に再判定する際、担当者によって「良好」「中立」「悪化」の判断がブレないようにするための資料です。</p>
      <div class="note">質的イベントは補助点です。新製品、提携、政策、供給不足などがあっても、売上・利益・株価反応へつながる経路が説明できない場合は加点しません。定量、マクロ、市場の悪化を質的イベントだけで上書きしない設計です。</div>
    </section>
    <section>
      <h2>2. 入力基準</h2>
      <div class="wide">${table(inputCriteria)}</div>
    </section>
    <section>
      <h2>3. 重大停止条件</h2>
      <div class="danger">重大停止が2件以上ある場合は、再判定点が高くても原則として「外す」にします。NISA 1年保有テストでは、短期の期待よりも大きな損失回避を優先します。</div>
      <div class="wide" style="margin-top:12px">${table(hardStops)}</div>
    </section>
    <section>
      <h2>4. 業種別の確認項目</h2>
      <div class="wide">${table(sectorCriteria)}</div>
    </section>
    <section>
      <h2>5. CSV</h2>
      <a class="button" href="668_june_recheck_input_criteria.csv">入力基準CSV</a>
      <a class="button" href="669_june_recheck_hard_stop_criteria.csv">重大停止CSV</a>
      <a class="button" href="670_june_recheck_sector_criteria.csv">業種別基準CSV</a>
      <a class="button" href="june_event_recheck_sheet_20260527.html">再判定シートへ戻る</a>
    </section>
  </main>
</body>
</html>`;

write("june_recheck_input_criteria_20260527.html", html);

console.log(JSON.stringify({
  generatedAt,
  inputCriteria: inputCriteria.length,
  hardStops: hardStops.length,
  sectorCriteria: sectorCriteria.length,
  output: "june_recheck_input_criteria_20260527.html",
}, null, 2));
