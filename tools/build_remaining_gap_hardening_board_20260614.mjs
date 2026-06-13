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
  const s = String(value ?? "");
  if (/購入不可|ロック|未完了|未確認|除外|不可|0円|禁止|使わない|停止|遮断/.test(s)) return "bad";
  if (/注意|partial|保留|監視|補助|条件付き|継続/.test(s)) return "warn";
  if (/済み|接続済み|pass|完了|使用可|通過/.test(s)) return "ok";
  return "";
}

function table(headers, rows, widths = {}) {
  return `<div class="table-wrap"><table><thead><tr>${headers
    .map((h) => `<th${widths[h] ? ` style="width:${widths[h]}"` : ""}>${esc(h)}</th>`)
    .join("")}</tr></thead><tbody>${rows
    .map(
      (row) =>
        `<tr>${headers
          .map((h) => `<td class="${cls(row[h])}">${esc(row[h])}</td>`)
          .join("")}</tr>`,
    )
    .join("")}</tbody></table></div>`;
}

function percentNumber(text) {
  const n = Number(String(text ?? "").replace("%", ""));
  return Number.isFinite(n) ? n : null;
}

const financialRows = parseCsv(readText("candidate10_financial_confirmation_gate_20260614.csv"));
const returnRows = parseCsv(readText("return_hypothesis_confidence_20260613.csv"));
const themeRows = parseCsv(readText("qualitative_theme_evidence_gate_20260613.csv"));
const universeRules = parseCsv(readText("universe_reproducible_policy_20260613.csv"));
const accountRows = parseCsv(readText("nisa_account_execution_gate_20260614.csv"));

const returnByTicker = new Map(returnRows.map((row) => [row.ticker, row]));
const passCount = financialRows.filter((row) => row.financial_status === "pass").length;
const partialCount = financialRows.filter((row) => row.financial_status !== "pass").length;
const readyAccounts = accountRows.filter((row) => row.account_ready !== "購入不可").length;
const themeUnverified = themeRows.filter((row) => /加点しない|監視|継続|入口/.test(`${row.score_treatment} ${row.current_status}`)).length;

const hardeningRows = [
  {
    改善対象: "決算後反応",
    現状: "10社すべて20営業日反応まで接続済み",
    改善した処理: "反応値は参考指標として使い、単独で購入可にしない。反応が弱い銘柄は予定比率を上げない。",
    買付判断への接続: "20営業日で日経平均に大きく劣後、または反応スコア40未満なら追加停止・比率縮小候補。",
    未完了時の扱い: "接続済み。ただし次回決算後も同じ形式で更新が必要。",
    次の入力: "次回決算後1日・5日・20営業日の指数比を追加入力",
  },
  {
    改善対象: "財務データ",
    現状: `確認済み ${passCount}/10、未確認または部分確認 ${partialCount}/10`,
    改善した処理: "PER/PBR/ROE・利益率・受注・セグメント寄与が未確認の銘柄は、点数を上げる材料に使わない。",
    買付判断への接続: "partial銘柄は、イベント後に株価が良くても予定比率の引上げ禁止。公式IR確認後に再判定。",
    未完了時の扱い: "未確認値をスコアに混ぜない。画面では未確認として残す。",
    次の入力: "公式決算短信、決算説明資料、IR資料から不足項目を入力",
  },
  {
    改善対象: "リスク評価",
    現状: "最大下落・ボラティリティ・停止条件は接続済み。銘柄別の精密補正は改善中。",
    改善した処理: "銘柄別売買ルール表と接続し、高リスク銘柄は初回比率の上限を低くする。",
    買付判断への接続: "高リスク、最大下落が大きい、または短期反応が弱い場合は、追加停止・縮小候補。",
    未完了時の扱い: "共通ルールを優先し、個別補正が未完成なら買付上限を上げない。",
    次の入力: "銘柄別の過去急落率、売買代金、決算日、値幅制限確認",
  },
  {
    改善対象: "税制・口座",
    現状: `NISA・本人操作チェックはあるが、実口座準備は ${readyAccounts}/${accountRows.length}。保有ロットとは未連動。`,
    改善した処理: "口座未確認なら買付上限を0円に固定。税制レイヤーは確認補助に限定する。",
    買付判断への接続: "本人スマホ、本人ログイン、NISA口座区分、残枠、注文票が未確認なら購入不可。",
    未完了時の扱い: "税制最適化とは表示しない。保有ロット・年間損益・NISA残枠入力後にだけ年末レビューへ接続。",
    次の入力: "本人別口座状態、NISA残枠、注文画面の口座区分、保有ロット、年間損益",
  },
  {
    改善対象: "S&P500/TOPIX +1%目標",
    現状: "資金配分スイッチは作成済み。実買付比率・撤退条件への接続を強化。",
    改善した処理: "Green/Yellow/Redの3段階で個別株投入上限を固定し、劣後時の追加停止条件を明文化。",
    買付判断への接続: "開始時点・20営業日・60営業日の指数比で、追加・半減・停止を判定。",
    未完了時の扱い: "指数比較の開始値が未入力なら、+1%達成見込みを断定しない。",
    次の入力: "購入日のS&P500、TOPIX、日経平均、為替、候補10社価格",
  },
  {
    改善対象: "質的テーマ",
    現状: `テーマゲート ${themeRows.length}件。うち ${themeUnverified}件は証拠不足または監視扱い。`,
    改善した処理: "AI、半導体、電力、フィジカルAI、量子などは、仮説・実績・公式数字・株価反応に分ける。",
    買付判断への接続: "ニュースや連想材料は候補探索の入口。2種類以上の証拠と過去反応がない限り、購入候補スコアへ足さない。",
    未完了時の扱い: "単純加点しない。監視枠に置き、量的スクリーニングを通った場合だけ再確認。",
    次の入力: "イベント日、ニュース出所、対象セクター、関連企業、業界指標、イベント後リターン",
  },
  {
    改善対象: "ストップ安・急落対策",
    現状: "共通プロトコルは作成済み。銘柄別の値幅・流動性補正は継続。",
    改善した処理: "急落時の当日買い増し禁止、翌営業日確認、追加停止、縮小、売却検討の順番を固定。",
    買付判断への接続: "ストップ安級、出来高急増、指数同時急落、材料不明の急落は自動で追加停止扱い。",
    未完了時の扱い: "銘柄別補正が未入力なら、安全側の共通ルールを使う。",
    次の入力: "値幅制限、過去急落日、売買代金、材料別の回復日数",
  },
  {
    改善対象: "期待リターン",
    現状: "過去5年・10年CAGR、S&P差、最大下落率、反応スコアはあるが、勝率証明ではない。",
    改善した処理: "期待リターンをA/B/C信頼度で表示し、利回り保証や確率的勝利として扱わない。",
    買付判断への接続: "信頼度C、最大下落が大きい、反応が弱い銘柄は比率を抑える。",
    未完了時の扱い: "説明は『検証用仮説』に限定。確定利回りとして使わない。",
    次の入力: "購入後の実績、指数比、予測誤差、継続期待の再計算",
  },
  {
    改善対象: "100社母集団",
    現状: `条件方針 ${universeRules.length}項目あり。ただし入力版・抽出日・除外理由の固定が必要。`,
    改善した処理: "対象市場、最低データ、除外条件、テーマ枠の扱いを明文化し、80〜120社の再現可能な母集団に寄せる。",
    買付判断への接続: "母集団外からの手動追加は監視枠に置き、同じゲートを通るまで購入候補にしない。",
    未完了時の扱い: "母集団の抽出条件が未記録なら、選定理由に『暫定』を残す。",
    次の入力: "抽出日、対象銘柄一覧、採用条件、除外条件、データ欠損一覧",
  },
  {
    改善対象: "実用画面",
    現状: "画面数が多く、見る順番が散らばりやすい。",
    改善した処理: "最新実用入口、実用判断コックピット、今回の未完了改善ゲートを接続。",
    買付判断への接続: "毎日見る画面では、購入可否、0円理由、次の入力、止める条件を先頭に置く。",
    未完了時の扱い: "資料画面を見なくても、実用画面だけで購入不可理由が分かるようにする。",
    次の入力: "6/18以降の実データ反映後に入口の表示を更新",
  },
];

const tickerRows = financialRows.map((row) => {
  const ret = returnByTicker.get(row.ticker) ?? {};
  const locks = [];
  if (row.financial_status !== "pass") locks.push("財務未確認を理由に比率引上げ禁止");
  if (/除外/.test(row.universe_status)) locks.push("100社再選定で除外のため初回買付不可");
  if (/監視/.test(row.universe_status)) locks.push("監視扱いのため少額または保留");
  if (ret.confidence === "C") locks.push("期待リターン信頼度Cのため保守扱い");
  if ((percentNumber(ret.max_drawdown_5y) ?? 0) <= -40) locks.push("過去最大下落が大きいため上限抑制");
  if ((Number(row.reaction_score) || 0) < 40) locks.push("決算後反応が弱いため追加停止候補");
  return {
    ticker: row.ticker,
    銘柄: row.name,
    役割: row.role,
    財務状態: row.financial_status,
    "100社扱い": row.universe_status,
    期待仮説信頼度: ret.confidence || "未接続",
    決算後反応: row.reaction_score,
    最大下落: ret.max_drawdown_5y || "未接続",
    ロック内容: locks.length ? locks.join(" / ") : "財務確認済み。ただしイベント・口座未完了中は購入不可",
    現時点の扱い: "購入不可",
    次アクション: row.financial_status === "pass" ? "6月イベント・口座確認後に再判定" : "公式IR不足項目を補完してから再判定",
  };
});

const inputRows = [
  { 入力対象: "公式財務", 必須項目: "PER/PBR/ROE、営業利益率、受注、セグメント寄与、会社予想", 使い方: "未確認なら点数を上げない", 優先度: "最重要" },
  { 入力対象: "イベント後実データ", 必須項目: "日銀、FOMC、米金利、為替、指数、候補10社価格", 使い方: "6/18以降の購入可否と上限を再判定", 優先度: "最重要" },
  { 入力対象: "本人別口座", 必須項目: "本人スマホ、本人ログイン、NISA口座区分、残枠、銀行口座、二段階認証", 使い方: "未確認なら買付上限0円", 優先度: "最重要" },
  { 入力対象: "税制ロット", 必須項目: "保有ロット、取得単価、年間損益、配当、外国税、NISA残枠", 使い方: "年末レビューと税制確認補助に使用", 優先度: "高" },
  { 入力対象: "質的テーマ実績", 必須項目: "イベント日、公式出所、対象業界、過去反応、関連企業", 使い方: "探索枠。購入スコアへは直接足さない", 優先度: "高" },
  { 入力対象: "母集団固定", 必須項目: "抽出日、80〜120社の一覧、採用条件、除外条件、欠損データ", 使い方: "恣意的選定に見えないようにする", 優先度: "高" },
];

writeCsv("remaining_gap_hardening_board_20260614.csv", hardeningRows);
writeCsv("remaining_gap_purchase_lock_by_ticker_20260614.csv", tickerRows);
writeCsv("remaining_gap_required_inputs_20260614.csv", inputRows);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>未完了改善・購入ロック一覧</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--warn:#9a5b00;--red:#b42318;--green:#116b4f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.7}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);line-height:1.2;letter-spacing:0}
    header p{margin:0;font-weight:800;max-width:1200px}
    main{max-width:1540px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08)}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:25px}
    .notice{border-left:8px solid var(--red);background:#fff1f1;border-radius:10px;padding:14px 16px;font-weight:900;margin:0 0 14px}
    .sub{border-left-color:var(--blue);background:#eef7ff}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:15px}
    .card strong{display:block;font-size:28px;line-height:1.25;color:var(--blue)}
    .card span{display:block;font-weight:800;color:#263e55}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin-top:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:10px 12px;vertical-align:top;overflow-wrap:anywhere;word-break:normal}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    td.ok{color:var(--green);font-weight:900}
    td.warn{color:var(--warn);font-weight:900}
    td.bad{color:var(--red);font-weight:900}
    .links{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .links a{display:block;text-decoration:none;color:var(--ink);border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:12px;font-weight:900}
    .links a:hover{border-color:var(--blue)}
    footer{font-size:13px;color:#526b82;margin:20px 0}
    @media(max-width:900px){main{padding:12px}.cards,.links{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:12px;padding:6px 7px}}
  </style>
</head>
<body>
<header>
  <h1>未完了改善・購入ロック一覧</h1>
  <p>未確認データや未検証テーマが、購入判断や買付比率に混ざらないようにするための実用ゲートです。</p>
</header>
<main>
  <section>
    <h2>現在の結論</h2>
    <p class="notice">現時点では購入不可です。買付上限は0円です。理由は、6月イベントの入力、本人別NISA口座確認、公式財務の補完、税制・保有ロット連動がまだ完了していないためです。</p>
    <div class="cards">
      <div class="card"><b>財務確認済み</b><strong>${passCount}/10</strong><span>未確認値は点数に混ぜない</span></div>
      <div class="card"><b>財務未確認</b><strong>${partialCount}/10</strong><span>比率引上げ禁止</span></div>
      <div class="card"><b>口座準備</b><strong>${readyAccounts}/${accountRows.length}</strong><span>未確認なら0円</span></div>
      <div class="card"><b>質的テーマ</b><strong>補助</strong><span>単純加点しない</span></div>
    </div>
  </section>

  <section>
    <h2>改善した内容</h2>
    <p class="notice sub">下表は「まだできていない部分」を、実務上のロック条件へ変換したものです。未完了なら購入を進めるのではなく、何を止めるかまで表示します。</p>
    ${table(["改善対象", "現状", "改善した処理", "買付判断への接続", "未完了時の扱い", "次の入力"], hardeningRows, {
      改善対象: "150px",
      現状: "220px",
      改善した処理: "300px",
      買付判断への接続: "300px",
      未完了時の扱い: "250px",
      次の入力: "250px",
    })}
  </section>

  <section>
    <h2>候補10社への購入ロック反映</h2>
    <p class="notice sub">この表は、現10社を強く見せるための表ではありません。未確認・監視・除外・下落リスクがある場合に、どの理由で購入判断を止めるかを見える化する表です。</p>
    ${table(["ticker", "銘柄", "役割", "財務状態", "100社扱い", "期待仮説信頼度", "決算後反応", "最大下落", "ロック内容", "現時点の扱い", "次アクション"], tickerRows, {
      ticker: "92px",
      銘柄: "140px",
      役割: "120px",
      財務状態: "90px",
      "100社扱い": "110px",
      期待仮説信頼度: "110px",
      ロック内容: "360px",
      次アクション: "250px",
    })}
  </section>

  <section>
    <h2>次に入力するデータ</h2>
    ${table(["入力対象", "必須項目", "使い方", "優先度"], inputRows, {
      入力対象: "160px",
      必須項目: "430px",
      使い方: "360px",
      優先度: "100px",
    })}
  </section>

  <section>
    <h2>関連する実用画面</h2>
    <div class="links">
      <a href="latest_practical_start_20260614.html">最新 実用パート入口</a>
      <a href="practical_action_cockpit_20260614.html">6/18以降 実用判断コックピット</a>
      <a href="candidate10_financial_confirmation_gate_20260614.html">候補10社 財務確認ゲート</a>
      <a href="ticker_trade_rule_matrix_20260614.html">候補10社 上値・下値・途中決済ルール</a>
      <a href="benchmark_allocation_switchboard_20260614.html">S&P500/TOPIX +1% 資金配分スイッチ</a>
      <a href="nisa_account_execution_gate_20260614.html">NISA口座・本人操作 実行ゲート</a>
    </div>
  </section>
  <footer>作成: ${esc(generatedAt)} / 本画面は購入推奨ではありません。未確認データを購入判断から遮断するための実用ゲートです。</footer>
</main>
</body>
</html>
`;

fs.writeFileSync(path.join(ROOT, "remaining_gap_hardening_board_20260614.html"), html, "utf8");

function insertCard(file, marker, card) {
  const full = path.join(ROOT, file);
  let text = fs.readFileSync(full, "utf8");
  if (text.includes("remaining_gap_hardening_board_20260614.html")) return false;
  const index = text.indexOf(marker);
  if (index === -1) return false;
  const insertAt = index + marker.length;
  text = `${text.slice(0, insertAt)}\n${card}\n${text.slice(insertAt)}`;
  fs.writeFileSync(full, text, "utf8");
  return true;
}

function insertBefore(file, marker, card) {
  const full = path.join(ROOT, file);
  let text = fs.readFileSync(full, "utf8");
  if (text.includes("remaining_gap_hardening_board_20260614.html")) return false;
  const index = text.indexOf(marker);
  if (index === -1) return false;
  text = `${text.slice(0, index)}${card}\n${text.slice(index)}`.replace(/日々見る画面を8個/g, "日々見る画面を9個");
  fs.writeFileSync(full, text, "utf8");
  return true;
}

insertCard(
  "index.html",
  `<span>PER/PBR/ROE・利益率・受注/セグメント寄与・高PER説明可否を購入前確認に接続。</span>
        </a>`,
  `
        <a class="card" href="remaining_gap_hardening_board_20260614.html">
          <b>未完了改善・購入ロック一覧</b>
          <span>財務未確認、質的テーマ未検証、税制・口座未連動などを購入判断へ混ぜないための実用ゲート。</span>
        </a>`,
);

insertCard(
  "896_practical_entry_hub_20260606.html",
  `<span>PER/PBR/ROE・利益率・受注/セグメント寄与・高PER説明可否を購入前確認に接続。</span>
        </a>`,
  `
        <a class="link-card" href="remaining_gap_hardening_board_20260614.html">
          <b>未完了改善・購入ロック一覧</b>
          <span>財務未確認、質的テーマ未検証、税制・口座未連動などを購入判断へ混ぜないための実用ゲート。</span>
        </a>`,
);

insertCard(
  "practical_action_cockpit_20260614.html",
  `<span>PER/PBR/ROE・利益率・受注/セグメント寄与・高PER説明可否を購入前確認に接続。</span>
        </a>`,
  `
        <a class="link-card" href="remaining_gap_hardening_board_20260614.html">
          <b>未完了改善・購入ロック一覧</b>
          <span>財務未確認、質的テーマ未検証、税制・口座未連動などを購入判断へ混ぜないための実用ゲート。</span>
        </a>`,
);

insertBefore(
  "latest_practical_start_20260614.html",
  `<a class="step" href="ticker_trade_rule_matrix_20260614.html">`,
  `<a class="step" href="remaining_gap_hardening_board_20260614.html">
        <b>6. 未完了改善・購入ロック一覧</b>
        <span>財務未確認、質的テーマ未検証、税制・口座未連動などを購入判断へ混ぜないための実用ゲート。</span>
        <em>購入前</em>
      </a>`,
);

{
  const latestFile = path.join(ROOT, "latest_practical_start_20260614.html");
  let latest = fs.readFileSync(latestFile, "utf8");
  latest = latest
    .replace(/日々見る画面を8個/g, "日々見る画面を9個")
    .replace("<b>6. 候補10社 上値・下値・途中決済ルール</b>", "<b>7. 候補10社 上値・下値・途中決済ルール</b>")
    .replace("<b>7. ストップ安・急落対策プロトコル</b>", "<b>8. ストップ安・急落対策プロトコル</b>")
    .replace("<b>8. 購入後 運用記録・予実管理ボード</b>", "<b>9. 購入後 運用記録・予実管理ボード</b>");
  fs.writeFileSync(latestFile, latest, "utf8");
}

console.log("generated remaining_gap_hardening_board_20260614.html");
