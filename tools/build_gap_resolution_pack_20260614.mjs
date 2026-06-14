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

function readText(file) {
  const full = path.join(ROOT, file);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8").replace(/^\uFEFF/, "") : "";
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell.replace(/\r$/, ""));
      if (row.some((v) => v !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell.replace(/\r$/, ""));
  if (row.some((v) => v !== "")) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).map((line) => Object.fromEntries(headers.map((h, i) => [h, line[i] ?? ""])));
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, rows, headers = Object.keys(rows[0] ?? {})) {
  const body = rows.map((row) => headers.map((h) => csvCell(row[h])).join(",")).join("\n");
  fs.writeFileSync(path.join(ROOT, file), `\uFEFF${headers.join(",")}\n${body}\n`, "utf8");
}

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cls(value) {
  const text = String(value ?? "");
  if (/未完了|購入不可|0円|停止|除外|NG|未確認|未接続|禁止/.test(text)) return "bad";
  if (/改善済み|実装済み|接続済み|OK|整合/.test(text)) return "ok";
  if (/入力待ち|条件付き|要確認|partial|監視|仮説|試算/.test(text)) return "warn";
  return "";
}

function table(headers, rows, widths = {}) {
  return `<div class="table-wrap"><table><thead><tr>${headers
    .map((h) => `<th${widths[h] ? ` style="width:${widths[h]}"` : ""}>${esc(h)}</th>`)
    .join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${headers.map((h) => `<td class="${cls(row[h])}">${esc(row[h])}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

function pctNumber(value) {
  const n = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

const tickers = parseCsv(readText("candidate10_risk_trade_rules_20260613.csv"));
const integrated = parseCsv(readText("integrated_purchase_decision_engine_20260614.csv"));

const tickerState = new Map(integrated.map((row) => [row.ticker, row]));

const riskRules = tickers.map((row) => {
  const maxDd = Math.abs(pctNumber(row.five_year_drawdown));
  const oneYearDd = Math.abs(pctNumber(row.one_year_drawdown));
  const riskTier = row.risk_tier;
  const stop1 = riskTier === "高" ? -4 : riskTier === "中高" ? -5 : -7;
  const stop2 = riskTier === "高" ? -8 : riskTier === "中高" ? -10 : -12;
  const take1 = riskTier === "高" ? 12 : riskTier === "中高" ? 15 : 20;
  const trail = riskTier === "高" ? 8 : riskTier === "中高" ? 10 : 12;
  const cap = riskTier === "高" ? "初回は3%上限" : riskTier === "中高" ? "初回は6.25%上限" : "中心候補は18.75%枠まで。ただしイベント後";
  return {
    ticker: row.ticker,
    銘柄: row.name,
    リスク階層: riskTier,
    "5年最大下落": row.five_year_drawdown,
    "1年最大下落": row.one_year_drawdown,
    決算後反応: row.reaction_score,
    現在の扱い: "購入不可",
    初回比率上限: cap,
    下値ルール1: `買付後${stop1}%で追加買付停止`,
    下値ルール2: `買付後${stop2}%で保有理由を再確認。指数劣後または悪材料ありなら一部縮小候補`,
    上値ルール: `買付後+${take1}%超で目標比率超過なら一部利確確認。以後、高値から-${trail}%で利益保全確認`,
    ストップ安対応: "当日買い増し禁止。翌営業日に材料、出来高、指数、気配、決算影響を確認して再判定",
    使う条件: "イベント・口座・公式財務のゲートが通るまで注文票へ反映しない",
  };
});

const benchmarkRules = [
  {
    判定: "現在",
    条件: "イベント、本人操作、NISA区分、残枠、財務partialのいずれか未完了",
    個別株比率: "0%",
    実務アクション: "注文票へ金額を出さない",
    撤退・縮小ルール: "なし。買付前なので現金待機",
  },
  {
    判定: "緑",
    条件: "候補バスケットがS&P500/TOPIXへ+1%以上優位、かつ主要イベントに赤なし",
    個別株比率: "最大35%",
    実務アクション: "中心候補を厚め、条件付き候補は小口。高リスク銘柄は銘柄別上限を優先",
    撤退・縮小ルール: "購入後4週で指数に1%以上劣後なら追加停止。8週で2%以上劣後なら個別株比率を15%へ下げる",
  },
  {
    判定: "黄",
    条件: "優位が0〜+1%未満、またはイベント注意が残る",
    個別株比率: "最大15%",
    実務アクション: "中心候補だけ小口。高PER・高ボラ・監視銘柄は0円または半分",
    撤退・縮小ルール: "購入後2週で指数劣後なら追加停止。4週で-1%以上劣後なら0%へ戻す",
  },
  {
    判定: "橙",
    条件: "候補バスケットがS&P500/TOPIXへ-1%以上劣後",
    個別株比率: "0%",
    実務アクション: "初回買付延期。指数投信や現金待機と比較",
    撤退・縮小ルール: "買わない。再判定まで候補入替",
  },
  {
    判定: "赤",
    条件: "候補バスケット-3%以上劣後、主要銘柄下方修正、急落イベント",
    個別株比率: "0%",
    実務アクション: "個別株追加停止。既存保有があれば銘柄別ルールで縮小検討",
    撤退・縮小ルール: "新規買付停止。イベント再確認後まで注文票0円",
  },
];

const accountTaxTemplate = Array.from({ length: 10 }, (_, i) => ({
  account_id: `口座${i + 1}`,
  本人名: "",
  証券会社: "",
  NISA口座状態: "未確認",
  本人スマホ: "未確認",
  本人銀行口座: "未確認",
  二段階認証: "未確認",
  NISA残枠円: "",
  特定口座年間実現損益円: "",
  NISA保有残高円: "",
  課税口座保有残高円: "",
  配当受取方式: "未確認",
  税制確認: "確認補助のみ",
  買付反映: "全項目確認まで0円",
}));

const themeLedger = [
  {
    テーマ: "半導体製造装置・材料",
    仮説データ層: "AI投資が継続するなら、GPU本体だけでなく検査・前工程・研削・材料へ需要が波及する",
    実績データ層: "SOX/NASDAQ、装置受注、会社の受注・粗利率、決算後1/5/20営業日反応を確認",
    採点扱い: "証拠2種類以上まで購入スコアへ加点しない。候補探索の入口に限定",
    現在の扱い: "監視・補助評価",
  },
  {
    テーマ: "AIインフラ・データセンター・電力・冷却・電線",
    仮説データ層: "AI利用増で電力、冷却、電線、光通信、制御機器の需要が増える",
    実績データ層: "電力需要統計、データセンター投資、企業受注、関連銘柄の指数超過を確認",
    採点扱い: "受注・売上寄与が確認できるまで質的補助にとどめる",
    現在の扱い: "監視・補助評価",
  },
  {
    テーマ: "フィジカルAI",
    仮説データ層: "AIが工場・ロボット・現場へ広がるとFA、センサー、電源、モーター周辺に需要が出る",
    実績データ層: "FA受注、設備投資、会社説明資料、過去決算後反応を確認",
    採点扱い: "量的スコアを通るまでNISA購入候補にしない",
    現在の扱い: "探索枠",
  },
  {
    テーマ: "量子コンピューター",
    仮説データ層: "政策・研究・大手提携で期待は出るが、短期売上接続が弱い場合が多い",
    実績データ層: "公式受注、売上寄与、政府予算、株価反応の継続性を確認",
    採点扱い: "原則監視。売上寄与が薄い場合は購入スコアへ入れない",
    現在の扱い: "探索枠",
  },
  {
    テーマ: "金利・銀行",
    仮説データ層: "金利上昇で利ざや改善が期待される",
    実績データ層: "日銀政策、長期金利、銀行株指数、利ざや、信用コストを確認",
    採点扱い: "量的スコアと接続しやすいため中心候補へ接続。ただし信用コスト悪化なら停止",
    現在の扱い: "候補接続済み",
  },
];

const universeRulebook = [
  {
    項目: "母集団",
    固定条件: "国内上場の大型・中型中心。80〜120社程度を許容",
    理由: "100社ぴったりに合わせるための恣意的選定を避ける",
    出力: "universe_reproducible_policy と lineage に残す",
  },
  {
    項目: "最低価格データ",
    固定条件: "株価、出来高、5年CAGR、10年CAGR、S&P差、最大下落、月次勝率",
    理由: "直近だけでなく継続性と下落耐性を見る",
    出力: "100社比較表",
  },
  {
    項目: "最低財務データ",
    固定条件: "PER/PBR/ROE、営業利益率、会社予想、受注またはセグメント寄与",
    理由: "価格だけで選ばず、公式決算との整合性を取る",
    出力: "財務partialゲート",
  },
  {
    項目: "除外・監視",
    固定条件: "指数劣後、決算後反応弱い、最大下落大、財務未確認、テーマ根拠不足",
    理由: "高騰済み銘柄や説明不能銘柄を購入スコアへ混ぜない",
    出力: "監視・除外理由",
  },
];

const dailyBoard = [
  {
    順番: 1,
    見る項目: "今日の結論",
    現在: "購入不可・買付上限0円",
    判断: "イベント、口座、財務が未完了のため注文票へ進めない",
    次作業: "入力作業台、再判定準備、0円ロック監査の順に確認",
  },
  {
    順番: 2,
    見る項目: "イベント",
    現在: "日銀・FOMC・最終確認が未入力",
    判断: "未入力がある間は全銘柄0円",
    次作業: "イベント結果と市場反応を入力",
  },
  {
    順番: 3,
    見る項目: "本人別口座",
    現在: "確認済み0/10口座",
    判断: "本人スマホ、本人銀行、二段階認証、NISA残枠が未確認",
    次作業: "口座別入力テンプレートを埋める",
  },
  {
    順番: 4,
    見る項目: "銘柄別財務",
    現在: "7銘柄partial",
    判断: "partialは比率引上げ禁止",
    次作業: "公式IR、決算短信、受注・利益率を入力",
  },
  {
    順番: 5,
    見る項目: "指数+1%目標",
    現在: "現在は0%",
    判断: "優位性が確認できるまで個別株比率を出さない",
    次作業: "イベント後にS&P500/TOPIX比較で緑・黄・橙・赤を決める",
  },
];

const gapMatrix = [
  {
    課題: "決算後反応",
    以前の状態: "10社すべて20営業日反応まで接続済み",
    今回の改善: "買付判断ではなく、銘柄別停止理由・反応弱い判定へ接続",
    現在の状態: "改善済み",
    次に必要な入力: "新しい決算後は1/5/20営業日で更新",
  },
  {
    課題: "財務データpartial",
    以前の状態: "一部銘柄でPER/PBR/ROE・受注・利益率が未確認",
    今回の改善: "partial銘柄は比率引上げ禁止、公式財務入力欄と再判定ゲートへ接続",
    現在の状態: "入力待ち",
    次に必要な入力: "公式IR・決算短信・資料日付・参照元",
  },
  {
    課題: "銘柄別リスク",
    以前の状態: "最大下落・ボラ・停止条件はあるが粗い",
    今回の改善: "銘柄別の下値1/下値2/上値/ストップ安対応/初回上限をCSV化",
    現在の状態: "実装済み",
    次に必要な入力: "買付後は実際の取得単価を入れて運用",
  },
  {
    課題: "税制・口座",
    以前の状態: "NISA・本人操作チェックはあるが、実口座と未連動",
    今回の改善: "本人別の税制・口座・残枠入力テンプレートを作成。未入力なら0円",
    現在の状態: "入力待ち",
    次に必要な入力: "本人名義スマホ、銀行、二段階認証、NISA残枠",
  },
  {
    課題: "S&P500/TOPIX +1%目標",
    以前の状態: "目標と買付比率・撤退条件の接続が弱い",
    今回の改善: "緑35%、黄15%、橙/赤0%と、2週/4週/8週の縮小条件を明文化",
    現在の状態: "実装済み",
    次に必要な入力: "イベント後の候補バスケット対指数差",
  },
  {
    課題: "質的テーマ検証",
    以前の状態: "テーマ整理はあるが、過去イベント検証が不足",
    今回の改善: "仮説データ層と実績データ層を分け、証拠2種類未満は購入スコア加点禁止",
    現在の状態: "監視・入力待ち",
    次に必要な入力: "受注、売上寄与、指数超過、イベント後反応",
  },
  {
    課題: "ストップ安・急落対策",
    以前の状態: "ルール化途中",
    今回の改善: "当日買い増し禁止、翌営業日再判定、銘柄別下落率ルールを追加",
    現在の状態: "実装済み",
    次に必要な入力: "実際の保有単価と当日材料",
  },
  {
    課題: "税制レイヤー",
    以前の状態: "確認補助で、保有ロット・年間損益・残枠と未連動",
    今回の改善: "口座・税制入力テンプレートでロット、年間損益、残枠を受ける入口を追加",
    現在の状態: "入力待ち",
    次に必要な入力: "実際の保有ロット、年間損益、NISA残枠",
  },
  {
    課題: "実用画面の複雑さ",
    以前の状態: "画面が増え、導線が複雑",
    今回の改善: "毎日見る項目だけの実用日次ボードを作成",
    現在の状態: "実装済み",
    次に必要な入力: "実データ更新",
  },
  {
    課題: "期待リターンの扱い",
    以前の状態: "期待リターンは検証用の仮説として扱う必要がある",
    今回の改善: "仮説と検証済みデータを分け、未検証テーマは購入スコアへ加点禁止",
    現在の状態: "実装済み",
    次に必要な入力: "イベント後リターンと指数比較",
  },
  {
    課題: "100社母集団",
    以前の状態: "条件はあるが完全固定には余地",
    今回の改善: "80〜120社許容、最低データ、除外・監視条件を固定ルールとして再整理",
    現在の状態: "改善済み",
    次に必要な入力: "候補追加時に同じ条件で監査",
  },
];

writeCsv("gap_resolution_matrix_20260614.csv", gapMatrix);
writeCsv("ticker_trade_rule_matrix_v2_20260614.csv", riskRules);
writeCsv("benchmark_purchase_withdrawal_rules_20260614.csv", benchmarkRules);
writeCsv("tax_account_position_link_template_20260614.csv", accountTaxTemplate);
writeCsv("theme_event_validation_ledger_20260614.csv", themeLedger);
writeCsv("universe_reproducible_rulebook_v2_20260614.csv", universeRulebook);
writeCsv("daily_practical_compact_board_20260614.csv", dailyBoard);

const css = `
  :root{--ink:#071927;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--red:#b42318;--warn:#9a5b00;--green:#116b4f}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.7}
  header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:30px}
  header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);letter-spacing:0;line-height:1.2}
  header p{margin:0;font-weight:800;max-width:1200px}
  main{max-width:1500px;margin:0 auto;padding:22px}
  section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08)}
  h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:25px}
  .notice{border-left:8px solid var(--red);background:#fff1f1;border-radius:10px;padding:14px 16px;font-weight:900;margin:0 0 14px}
  .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
  .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
  .card b{display:block;color:var(--navy);font-size:15px}
  .card strong{display:block;font-size:26px;line-height:1.25;color:var(--blue)}
  .card span{font-weight:800;color:#263e55}
  .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin-top:10px}
  table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
  th,td{border:1px solid var(--line);padding:10px 12px;vertical-align:top;overflow-wrap:anywhere;word-break:normal}
  th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
  td.ok{color:var(--green);font-weight:900}
  td.warn{color:var(--warn);font-weight:900}
  td.bad{color:var(--red);font-weight:900}
  .links{display:flex;flex-wrap:wrap;gap:10px}
  .links a{display:inline-block;text-decoration:none;background:#0b67a3;color:#fff;border-radius:9px;padding:10px 13px;font-weight:900}
  footer{font-size:13px;color:#526b82;margin:20px 0}
  @media(max-width:900px){main{padding:12px}.cards{grid-template-columns:1fr}body{font-size:16px}}
  @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:11px;padding:6px 7px}}
`;

function renderPage(file, title, lead, sections) {
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <style>${css}</style>
</head>
<body>
<header>
  <h1>${esc(title)}</h1>
  <p>${esc(lead)}</p>
</header>
<main>
  ${sections.join("\n")}
  <footer>作成: ${esc(generatedAt)} / 本画面は購入指示ではなく、未完成点を購入判断に混ぜないための実用整理です。</footer>
</main>
</body>
</html>`;
  fs.writeFileSync(path.join(ROOT, file), html, "utf8");
}

renderPage("gap_resolution_board_20260614.html", "未完成点 改善ボード", "残っていた課題を、購入判断に混ぜないためのゲート・入力欄・監査画面へ落とした一覧です。", [
  `<section><h2>現在の結論</h2><p class="notice">現時点の実務判断は購入不可・買付上限0円です。改善は、購入可否を拙速に出すためではなく、入力不足や未検証仮説を売買判断へ混ぜないために行っています。</p><div class="cards"><div class="card"><b>実務判断</b><strong>購入不可</strong><span>0円維持</span></div><div class="card"><b>改善対象</b><strong>${gapMatrix.length}</strong><span>課題をゲート化</span></div><div class="card"><b>財務partial</b><strong>7銘柄</strong><span>入力待ち</span></div><div class="card"><b>口座</b><strong>0/10</strong><span>確認済み</span></div></div></section>`,
  `<section><h2>課題別 改善状況</h2>${table(["課題", "以前の状態", "今回の改善", "現在の状態", "次に必要な入力"], gapMatrix, { "以前の状態": "310px", "今回の改善": "430px", "次に必要な入力": "300px" })}</section>`,
  `<section><h2>関連画面</h2><div class="links"><a href="daily_practical_compact_board_20260614.html">実用日次ボード</a><a href="ticker_trade_rule_matrix_v2_20260614.html">銘柄別リスク・売買ルールv2</a><a href="theme_event_validation_ledger_20260614.html">質的テーマ検証台帳</a><a href="tax_account_position_link_template_20260614.csv">税制・口座入力CSV</a><a href="purchase_zero_lock_audit_20260614.html">0円ロック整合性監査</a><a href="latest_practical_start_20260614.html">最新 実用パート入口</a></div></section>`,
]);

renderPage("ticker_trade_rule_matrix_v2_20260614.html", "銘柄別リスク・売買ルール v2", "最大下落、1年下落、決算後反応、リスク階層を使い、銘柄ごとの下値・上値・急落時対応を分けました。", [
  `<section><h2>現在の扱い</h2><p class="notice">全銘柄は現時点で購入不可です。以下は、イベント・口座・公式財務がそろった後に使うためのルールです。</p></section>`,
  `<section><h2>銘柄別ルール</h2>${table(["ticker", "銘柄", "リスク階層", "5年最大下落", "1年最大下落", "現在の扱い", "初回比率上限", "下値ルール1", "下値ルール2", "上値ルール", "ストップ安対応", "使う条件"], riskRules, { "下値ルール2": "360px", "上値ルール": "360px", "ストップ安対応": "380px" })}</section>`,
  `<section><h2>関連画面</h2><div class="links"><a href="gap_resolution_board_20260614.html">未完成点 改善ボード</a><a href="stop_limit_stress_protocol_20260614.html">ストップ安・急落対策</a><a href="integrated_purchase_decision_engine_20260614.html">統合購入可否エンジン</a></div></section>`,
]);

renderPage("benchmark_purchase_withdrawal_rules_20260614.html", "指数+1%目標と買付・撤退ルール", "S&P500/TOPIXを+1%以上上回る目的を、買付比率と縮小条件へ接続した実務ルールです。", [
  `<section><h2>現在の扱い</h2><p class="notice">現在は0%・0円です。緑や黄の比率は、イベント・口座・財務確認後にだけ使います。</p></section>`,
  `<section><h2>比率・撤退ルール</h2>${table(["判定", "条件", "個別株比率", "実務アクション", "撤退・縮小ルール"], benchmarkRules, { "条件": "430px", "実務アクション": "420px", "撤退・縮小ルール": "420px" })}</section>`,
]);

renderPage("theme_event_validation_ledger_20260614.html", "質的テーマ 検証台帳", "テーマの思いつきをそのまま点数に入れず、仮説データ層と実績データ層に分けて確認する台帳です。", [
  `<section><h2>基本方針</h2><p class="notice">質的テーマは候補探索には使いますが、証拠が不足する間は購入スコアへ加点しません。</p></section>`,
  `<section><h2>テーマ別検証</h2>${table(["テーマ", "仮説データ層", "実績データ層", "採点扱い", "現在の扱い"], themeLedger, { "仮説データ層": "390px", "実績データ層": "390px", "採点扱い": "360px" })}</section>`,
]);

renderPage("daily_practical_compact_board_20260614.html", "実用日次ボード", "毎日見る項目だけを、購入判断に直結する順番で並べた画面です。", [
  `<section><h2>今日の結論</h2><p class="notice">現在は購入不可・買付上限0円です。次に進むには、イベント、本人別口座、公式財務partialの入力が必要です。</p></section>`,
  `<section><h2>今日見る項目</h2>${table(["順番", "見る項目", "現在", "判断", "次作業"], dailyBoard, { "判断": "460px", "次作業": "360px" })}</section>`,
  `<section><h2>主要リンク</h2><div class="links"><a href="redecision_input_workbench_20260614.html">入力作業台</a><a href="redecision_readiness_validator_20260614.html">再判定準備バリデーター</a><a href="redecision_output_preview_20260614.html">再判定出力プレビュー</a><a href="purchase_zero_lock_audit_20260614.html">0円ロック整合性監査</a><a href="gap_resolution_board_20260614.html">未完成点 改善ボード</a></div></section>`,
]);

renderPage("universe_reproducible_rulebook_v2_20260614.html", "100社母集団 再現ルール v2", "候補母集団を恣意的に作らないための固定条件です。", [
  `<section><h2>母集団ルール</h2>${table(["項目", "固定条件", "理由", "出力"], universeRulebook, { "固定条件": "430px", "理由": "430px" })}</section>`,
]);

function insertLink(file, anchor, linkHtml) {
  const full = path.join(ROOT, file);
  if (!fs.existsSync(full)) return;
  const text = fs.readFileSync(full, "utf8");
  if (text.includes(linkHtml.match(/href="([^"]+)"/)?.[1] ?? "__missing__")) return;
  fs.writeFileSync(full, text.replace(anchor, `${anchor}\n      ${linkHtml}`), "utf8");
}

insertLink(
  "latest_practical_start_20260614.html",
  '<em>安全監査</em>\n      </a>',
  '<a class="step" href="daily_practical_compact_board_20260614.html">\n        <b>6-5. 実用日次ボード</b>\n        <span>毎日見る項目、止める理由、次の作業だけを確認する。</span>\n        <em>日次実務</em>\n      </a>\n      <a class="step" href="gap_resolution_board_20260614.html">\n        <b>6-6. 未完成点 改善ボード</b>\n        <span>残課題を、ゲート・入力欄・監査画面へどう落としたか確認する。</span>\n        <em>改善状況</em>\n      </a>',
);

insertLink(
  "index.html",
  '<a class="card" href="purchase_zero_lock_audit_20260614.html">',
  '<a class="card" href="daily_practical_compact_board_20260614.html">\n          <b>実用日次ボード</b>\n          <span>今日見る項目、買わない理由、次の入力作業だけを確認する。</span>\n        </a>\n\n        <a class="card" href="gap_resolution_board_20260614.html">\n          <b>未完成点 改善ボード</b>\n          <span>残っていた課題を、ゲート・入力欄・監査画面へ落とした一覧。</span>\n        </a>\n\n        <a class="card" href="purchase_zero_lock_audit_20260614.html">',
);

console.log("generated gap resolution pack");
