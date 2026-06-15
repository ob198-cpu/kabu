import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/15 19:25";

const files = {
  issueBoard: "p1_issue_resolution_board_20260615.csv",
  issueSummary: "p1_issue_resolution_summary_20260615.csv",
  perPbrGate: "p1_price_basis_per_pbr_check_20260615.csv",
  transferGate: "p1_official_transfer_promotion_gate_20260615.csv",
  scoreGate: "p1_score_reflection_unlock_gate_20260615.csv",
  html: "p1_issue_resolution_board_20260615.html",
};

function p(file) {
  return path.join(ROOT, file);
}

function exists(file) {
  return fs.existsSync(p(file));
}

function readText(file) {
  return exists(file) ? fs.readFileSync(p(file), "utf8").replace(/^\uFEFF/, "") : "";
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (quoted) {
      if (char === '"' && next === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  const cleanRows = rows.filter((values) => values.some((value) => String(value ?? "").trim() !== ""));
  const headers = cleanRows.shift() ?? [];
  return cleanRows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function readCsv(file) {
  return parseCsv(readText(file));
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, rows, headers = null) {
  const cols = headers ?? Object.keys(rows[0] ?? { empty: "" });
  const body = [cols.join(","), ...rows.map((row) => cols.map((col) => csvCell(row[col])).join(","))].join("\n");
  fs.writeFileSync(p(file), `\uFEFF${body}\n`, "utf8");
}

function h(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function byKey(rows, key) {
  return new Map(rows.map((row) => [row[key], row]));
}

const inputQueue = readCsv("p1_segment_next_gate_input_queue_20260615.csv");
const draftQueue = readCsv("p1_segment_official_input_queue_draft_20260615.csv");
const pdfCheck = readCsv("p1_segment_pdf_official_check_result_20260615.csv");
const perPbrBasis = readCsv("p1_financial_per_pbr_basis_20260615.csv");
const prefill = readCsv("p1_segment_existing_data_prefill_candidates_20260615.csv");
const events = readCsv("102_june_event_result_input.csv");
const engine = readCsv("106_june_event_engine_output.csv");
const themeLedger = readCsv("theme_event_validation_ledger_20260614.csv");
const universeRule = readCsv("universe_reproducible_rulebook_v2_20260614.csv");

const draftById = byKey(draftQueue, "入力ID");
const prefillById = byKey(prefill, "入力ID");

const perPbrRows = perPbrBasis.map((row) => {
  const officialPart = row["計算項目"] === "実績PER" || row["計算項目"] === "予想PER" ? "EPSは公式PDF確認済み" : "BPSは公式PDF確認済み";
  const stockBasis = row["株価基準"] || "株価基準日未確認";
  const canPromote = row["反映可否"] === "反映しない" ? "不可" : "要確認";
  return {
    ticker: row.ticker,
    銘柄: row["銘柄"],
    指標: row["計算項目"],
    候補値: row["計算候補値"],
    公式側: officialPart,
    株価: row["株価"],
    株価基準: stockBasis,
    計算式: row["計算式"],
    現在の扱い: "候補値のみ",
    正式値にする条件: "株価取得元・取得日時・同一基準日を確認し、EPS/BPSの原文確認と組み合わせて再計算する",
    スコア反映: "禁止",
    P1復帰: "0社",
    買付上限: "0円",
    反映可否: canPromote,
  };
});

const officialDraftIds = new Set([
  "6503_roe_official",
  "6503_operating_margin",
  "8035_roe_official",
  "8035_operating_margin",
]);

const transferRows = inputQueue
  .filter((row) => officialDraftIds.has(row["入力ID"]))
  .map((row) => {
    const draft = draftById.get(row["入力ID"]) ?? {};
    const status = draft["転記ステータス"] === "転記案" ? "転記候補" : "未確認";
    return {
      ticker: row.ticker,
      銘柄: row["銘柄"],
      入力ID: row["入力ID"],
      入力項目: row["入力項目"],
      下書き値: draft["入力値"] || "",
      出所: draft["出所URLまたは資料名"] || "",
      確認位置: draft["ページまたは取得日時"] || "",
      現在状態: status,
      原本キューへの扱い: "まだ上書きしない",
      上書き条件: "入力バリデーターで、値・出所・確認位置・公式確認がそろうこと",
      スコア反映: "禁止",
      P1復帰: "0社",
      買付上限: "0円",
    };
  });

const scoreRows = [
  {
    ゲート: "公式財務値",
    必須条件: "PER/PBR/ROE・営業利益率・受注またはセグメント寄与が、公式資料または計算根拠付きでそろう",
    現在: `ROE・営業利益率の転記候補 ${transferRows.length}項目。PER/PBRは候補値のみ`,
    判定: "未通過",
    スコア反映: "0項目",
    P1復帰: "0社",
    買付上限: "0円",
  },
  {
    ゲート: "株価・指数再計算",
    必須条件: "5年CAGR、10年CAGR、S&P差、最大下落率を同一基準日・同一式で再計算する",
    現在: "既存計算値は候補値として保持。正式反映には再現計算が必要",
    判定: "未通過",
    スコア反映: "0項目",
    P1復帰: "0社",
    買付上限: "0円",
  },
  {
    ゲート: "6月イベント後入力",
    必須条件: "CPI、日銀、FOMC、指数反応、個別株反応を入力し、注意/悪化を判定する",
    現在: `${events.filter((row) => row.current_status === "未入力").length}/${events.length}イベントが未入力`,
    判定: "未通過",
    スコア反映: "0項目",
    P1復帰: "0社",
    買付上限: "0円",
  },
  {
    ゲート: "説明可能性",
    必須条件: "テーマ名だけでなく、財務、価格、事業寄与、イベント後反応を1行理由・残す条件・落とす条件へ接続する",
    現在: "説明候補は作成済みだが、公式数値とイベント後反応の接続待ち",
    判定: "未通過",
    スコア反映: "0項目",
    P1復帰: "0社",
    買付上限: "0円",
  },
  {
    ゲート: "購入可否・比率",
    必須条件: "上記ゲート通過後に、指数+1%目標、買わない条件、縮小条件、銘柄別上限を再計算する",
    現在: `${engine.filter((row) => Number(row.current_allocation_yen || 0) > 0).length}/${engine.length}銘柄が買付上限0円超`,
    判定: "未通過",
    スコア反映: "0項目",
    P1復帰: "0社",
    買付上限: "0円",
  },
];

const issueRows = [
  {
    No: 1,
    不備: "PER/PBRがまだ確定値ではない",
    改善内容: "EPS/BPSの公式確認と株価基準日を分離し、PER/PBRは候補値のまま止める専用チェック表を作成",
    現在状態: "改善済み: 候補値と正式値の境界を表示",
    残作業: "株価取得元・取得日時・同一基準日を確認して再計算",
    閉じる条件: "全対象で株価基準日、EPS/BPS、計算式、出所がそろう",
    関連ファイル: files.perPbrGate,
    スコア反映: "禁止",
  },
  {
    No: 2,
    不備: "公式値の転記はまだ下書き段階",
    改善内容: "ROE・営業利益率4項目を、原本上書き前の昇格ゲートとして別CSVに分離",
    現在状態: `改善済み: 転記候補 ${transferRows.length}項目`,
    残作業: "入力バリデーター通過後に原本キューへ反映",
    閉じる条件: "値、出所、確認位置、公式確認がそろう",
    関連ファイル: files.transferGate,
    スコア反映: "禁止",
  },
  {
    No: 3,
    不備: "スコアにはまだ反映していない",
    改善内容: "スコア反映ゲートを作り、未通過項目がある限り0項目のままにする",
    現在状態: "改善済み: 反映解除条件を明文化",
    残作業: "財務・価格・イベント・説明可能性の全通過",
    閉じる条件: "スコア反映ゲートの全行が通過",
    関連ファイル: files.scoreGate,
    スコア反映: "0項目",
  },
  {
    No: 4,
    不備: "P1復帰はまだ0社",
    改善内容: "P1復帰は、公式値が増えただけではなく、買付前ゲート通過後にだけ解除する扱いへ固定",
    現在状態: "改善済み: P1復帰0社を明示",
    残作業: "6503・8035の各ゲート通過後に再判定",
    閉じる条件: "P1復帰理由、落とす条件、買付上限が銘柄別にそろう",
    関連ファイル: "p1_segment_next_gate_input_validator_20260615.csv",
    スコア反映: "禁止",
  },
  {
    No: 5,
    不備: "イベント後データが未入力",
    改善内容: "102のイベント入力状況を改善ボードに接続し、未入力件数と影響を表示",
    現在状態: `改善済み: 未入力 ${events.filter((row) => row.current_status === "未入力").length}/${events.length}`,
    残作業: "日銀、FOMC、最終購入前確認を入力",
    閉じる条件: "各イベントの実数、市場反応、現在状態、失敗時アクションが埋まる",
    関連ファイル: "102_june_event_result_input.csv",
    スコア反映: "禁止",
  },
  {
    No: 6,
    不備: "株価指標の再計算が必要",
    改善内容: "既存値を候補値として残し、正式反映には同一基準日の再現計算が必要と明記",
    現在状態: `改善済み: 補完候補 ${prefill.filter((row) => row["候補値あり"] === "あり").length}/${prefill.length}`,
    残作業: "株価時系列からCAGR、S&P差、最大下落率を再計算",
    閉じる条件: "計算日、式、対象期間、欠損有無がCSVで再現可能",
    関連ファイル: "p1_segment_existing_data_prefill_candidates_20260615.csv",
    スコア反映: "禁止",
  },
  {
    No: 7,
    不備: "1年最大下落率の一部に期間ズレがあった",
    改善内容: "20日最大下落率など期間違いは正式転記禁止に固定",
    現在状態: "改善済み: 6503の20日値は1年値として使わない扱い",
    残作業: "1年最大下落率を同一式で再計算",
    閉じる条件: "20日、60日、1年の列名と値が混ざらない",
    関連ファイル: "p1_segment_existing_data_prefill_candidates_20260615.csv",
    スコア反映: "禁止",
  },
  {
    No: 8,
    不備: "事業寄与の確認がまだ弱い",
    改善内容: "FA・電力制御、WFE・半導体需要を、全社売上・利益へ接続できるか確認する行を維持",
    現在状態: "改善済み: テーマ名だけでは通さない設計",
    残作業: "セグメント売上、営業利益、受注、会社見通しを入力",
    閉じる条件: "テーマが全社業績へどの程度効くか、数値または会社資料で説明できる",
    関連ファイル: "p1_segment_order_evidence_candidates_20260615.csv",
    スコア反映: "禁止",
  },
  {
    No: 9,
    不備: "質的テーマの実証がまだ途中",
    改善内容: "AI、半導体、電力、データセンターは、仮説層と実績層を分けて表示",
    現在状態: `改善済み: テーマ検証行 ${themeLedger.length}件`,
    残作業: "過去イベントと株価反応の結合を増やす",
    閉じる条件: "質的テーマが、受注・売上寄与・過去反応のうち2種類以上で確認される",
    関連ファイル: "theme_event_validation_ledger_20260614.csv",
    スコア反映: "直接加点しない",
  },
  {
    No: 10,
    不備: "買付比率・購入可否への接続が未完成",
    改善内容: "買付比率はイベント後・公式値・再計算通過後だけ再開する設計に固定",
    現在状態: "改善済み: 全銘柄の現時点買付上限0円を維持",
    残作業: "全ゲート通過後に初回比率、縮小条件、見送り条件へ接続",
    閉じる条件: "指数+1%目標、劣後時縮小、銘柄別上限が同じ画面で確認できる",
    関連ファイル: "106_june_event_engine_output.csv / 108_capital_allocation_by_ticker.csv",
    スコア反映: "禁止",
  },
];

const summaryRows = [
  { 項目: "改善対象", 数値: `${issueRows.length}項目`, 状態: "全項目を改善ボード化", 意味: "未確認値をスコアや買付に混ぜないための追跡表を作成" },
  { 項目: "PER/PBR", 数値: `${perPbrRows.length}件`, 状態: "候補値のみ", 意味: "株価基準日確認まで正式値にしない" },
  { 項目: "公式転記候補", 数値: `${transferRows.length}項目`, 状態: "昇格ゲート化", 意味: "原本キュー上書き前に検査する" },
  { 項目: "スコア反映", 数値: "0項目", 状態: "ロック維持", 意味: "不十分な値で点数を動かさない" },
  { 項目: "P1復帰", 数値: "0社", 状態: "ロック維持", 意味: "購入候補へ戻す判断はまだ行わない" },
  { 項目: "買付上限", 数値: "0円", 状態: "ロック維持", 意味: "購入可否と比率はイベント後・公式確認後に再判定" },
];

writeCsv(files.issueBoard, issueRows, ["No", "不備", "改善内容", "現在状態", "残作業", "閉じる条件", "関連ファイル", "スコア反映"]);
writeCsv(files.issueSummary, summaryRows, ["項目", "数値", "状態", "意味"]);
writeCsv(files.perPbrGate, perPbrRows, ["ticker", "銘柄", "指標", "候補値", "公式側", "株価", "株価基準", "計算式", "現在の扱い", "正式値にする条件", "スコア反映", "P1復帰", "買付上限", "反映可否"]);
writeCsv(files.transferGate, transferRows, ["ticker", "銘柄", "入力ID", "入力項目", "下書き値", "出所", "確認位置", "現在状態", "原本キューへの扱い", "上書き条件", "スコア反映", "P1復帰", "買付上限"]);
writeCsv(files.scoreGate, scoreRows, ["ゲート", "必須条件", "現在", "判定", "スコア反映", "P1復帰", "買付上限"]);

function statusClass(value) {
  const text = String(value ?? "");
  if (/禁止|0項目|0社|0円|不可|未通過|未入力|まだ|候補値のみ/.test(text)) return "bad";
  if (/改善済み|転記候補|昇格|候補|注意|要確認/.test(text)) return "warn";
  if (/通過|完了|済み/.test(text)) return "ok";
  return "";
}

function table(rows, columns) {
  return `<div class="table-wrap"><table><thead><tr>${columns.map((col) => `<th>${h(col.label)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((col) => `<td class="${statusClass(row[col.key])}">${h(row[col.key])}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function card(title, value, note, klass = "") {
  return `<div class="card ${klass}"><b>${h(title)}</b><strong>${h(value)}</strong><span>${h(note)}</span></div>`;
}

function writeHtml() {
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>P1未解決10項目 改善ボード</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--red:#b42318;--warn:#9a5b00;--green:#116b4f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.75}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:#fff;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);line-height:1.2;letter-spacing:0}
    header p{margin:0;max-width:1180px;font-weight:850}
    main{max-width:1580px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08)}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:25px}
    .notice{border-left:8px solid var(--red);background:#fff1f1;border-radius:10px;padding:14px 16px;font-weight:900;margin:0 0 14px}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:15px}
    .card strong{display:block;font-size:28px;line-height:1.25;color:var(--blue)}
    .card span{display:block;font-weight:800;color:#263e55;margin-top:4px}
    .bad strong,.bad{color:var(--red)!important;font-weight:900}
    .warn strong,.warn{color:var(--warn)!important;font-weight:900}
    .ok strong,.ok{color:var(--green)!important;font-weight:900}
    .links{display:flex;flex-wrap:wrap;gap:10px}
    .links a{display:inline-block;text-decoration:none;color:#fff;background:var(--blue);border-radius:999px;padding:8px 13px;font-weight:900}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin-top:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:10px 12px;vertical-align:top;overflow-wrap:anywhere;word-break:normal}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    a{color:#064f86;font-weight:900}
    footer{font-size:13px;color:#526b82;margin:20px 0}
    @media(max-width:900px){main{padding:12px}.cards{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:#fff}header,section{break-inside:avoid;box-shadow:none}.table-wrap{overflow:visible}th,td{font-size:10px;padding:5px 6px}}
  </style>
</head>
<body>
<header>
  <h1>P1未解決10項目 改善ボード</h1>
  <p>公式値、株価基準日、イベント後反応、事業寄与、質的テーマ、買付比率を分けて管理し、未確認値がスコアや購入判断へ混ざらないようにするための改善版です。</p>
</header>
<main>
  <section>
    <h2>現在の結論</h2>
    <p class="notice">改善したのは「未確認値を安全に閉じるための仕組み」です。現時点では、スコア反映0項目、P1復帰0社、買付上限0円を維持します。</p>
    <div class="cards">
      ${card("改善対象", `${issueRows.length}項目`, "すべて追跡表へ接続", "warn")}
      ${card("スコア反映", "0項目", "未確認値は混ぜない", "bad")}
      ${card("P1復帰", "0社", "候補復帰はまだしない", "bad")}
      ${card("買付上限", "0円", "購入判断には使わない", "bad")}
    </div>
  </section>

  <section>
    <h2>関連ページ</h2>
    <div class="links">
      <a href="index.html">ホーム</a>
      <a href="latest_practical_start_20260614.html">実用パート入口</a>
      <a href="p1_segment_pdf_official_check_result_20260615.html">PDF公式確認結果</a>
      <a href="p1_segment_official_input_queue_draft_20260615.html">公式入力下書き</a>
      <a href="p1_segment_next_gate_input_validator_20260615.html">入力バリデーター</a>
      <a href="102_june_event_result_input.csv">イベント入力CSV</a>
      <a href="${files.issueBoard}">改善ボードCSV</a>
    </div>
  </section>

  <section>
    <h2>サマリー</h2>
    ${table(summaryRows, [
      { key: "項目", label: "項目" },
      { key: "数値", label: "数値" },
      { key: "状態", label: "状態" },
      { key: "意味", label: "意味" },
    ])}
  </section>

  <section>
    <h2>10項目の改善状況</h2>
    ${table(issueRows, [
      { key: "No", label: "No" },
      { key: "不備", label: "不備" },
      { key: "改善内容", label: "改善内容" },
      { key: "現在状態", label: "現在状態" },
      { key: "残作業", label: "残作業" },
      { key: "閉じる条件", label: "閉じる条件" },
      { key: "関連ファイル", label: "関連ファイル" },
      { key: "スコア反映", label: "スコア反映" },
    ])}
  </section>

  <section>
    <h2>PER/PBR正式化ゲート</h2>
    ${table(perPbrRows, [
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "指標", label: "指標" },
      { key: "候補値", label: "候補値" },
      { key: "公式側", label: "公式側" },
      { key: "株価", label: "株価" },
      { key: "株価基準", label: "株価基準" },
      { key: "計算式", label: "計算式" },
      { key: "正式値にする条件", label: "正式値にする条件" },
      { key: "スコア反映", label: "スコア反映" },
    ])}
  </section>

  <section>
    <h2>公式値の原本キュー昇格ゲート</h2>
    ${table(transferRows, [
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "入力ID", label: "入力ID" },
      { key: "入力項目", label: "入力項目" },
      { key: "下書き値", label: "下書き値" },
      { key: "出所", label: "出所" },
      { key: "確認位置", label: "確認位置" },
      { key: "現在状態", label: "現在状態" },
      { key: "原本キューへの扱い", label: "原本キューへの扱い" },
      { key: "上書き条件", label: "上書き条件" },
      { key: "スコア反映", label: "スコア反映" },
    ])}
  </section>

  <section>
    <h2>スコア反映・P1復帰・買付解除ゲート</h2>
    ${table(scoreRows, [
      { key: "ゲート", label: "ゲート" },
      { key: "必須条件", label: "必須条件" },
      { key: "現在", label: "現在" },
      { key: "判定", label: "判定" },
      { key: "スコア反映", label: "スコア反映" },
      { key: "P1復帰", label: "P1復帰" },
      { key: "買付上限", label: "買付上限" },
    ])}
  </section>

  <section>
    <h2>6月イベント入力状況</h2>
    ${table(events, [
      { key: "event_id", label: "ID" },
      { key: "planned_date", label: "日付" },
      { key: "event", label: "イベント" },
      { key: "actual_value", label: "実数" },
      { key: "market_reaction", label: "市場反応" },
      { key: "current_status", label: "状態" },
      { key: "action_if_fail", label: "失敗時アクション" },
    ])}
  </section>

  <footer>generated: ${h(generatedAt)} / source: P1 input queue, PDF official check, PER/PBR basis, event input, theme ledger. 本ページは判断補助の検査表であり、投資助言・自動売買・購入指示ではありません。</footer>
</main>
</body>
</html>`;
  fs.writeFileSync(p(files.html), `\uFEFF${html}`, "utf8");
}

function insertCard(file, htmlFile, title, body) {
  if (!exists(file)) return;
  const filePath = p(file);
  let content = fs.readFileSync(filePath, "utf8");
  if (content.includes(htmlFile)) return;
  const card = `<a class="card" href="${htmlFile}">
          <b>${title}</b>
          <span>${body}</span>
        </a>`;
  const marker = "</div>";
  const index = content.indexOf(marker);
  if (index === -1) return;
  content = `${content.slice(0, index + marker.length)}\n${card}\n${content.slice(index + marker.length)}`;
  fs.writeFileSync(filePath, content, "utf8");
}

function insertPlainLink(file, htmlFile, title) {
  if (!exists(file)) return;
  const filePath = p(file);
  let content = fs.readFileSync(filePath, "utf8");
  if (content.includes(htmlFile)) return;
  const link = `<a href="${htmlFile}">${title}</a>`;
  const marker = "</div>";
  const index = content.indexOf(marker);
  if (index === -1) return;
  content = `${content.slice(0, index + marker.length)}\n${link}\n${content.slice(index + marker.length)}`;
  fs.writeFileSync(filePath, content, "utf8");
}

writeHtml();
insertCard("index.html", files.html, "P1未解決10項目 改善ボード", "PER/PBR、公式転記、イベント、事業寄与、質的テーマ、買付比率を分けて検査。スコア反映0項目、P1復帰0社、買付上限0円を維持。");
insertCard("latest_practical_start_20260614.html", files.html, "P1未解決10項目 改善ボード", "未確認値を点数や購入金額に混ぜないための、P1復帰前の改善状況一覧。");
insertPlainLink("daily_practical_compact_board_20260614.html", files.html, "P1未解決10項目 改善ボード");

console.log(JSON.stringify({
  html: files.html,
  issueBoard: files.issueBoard,
  issueCount: issueRows.length,
  perPbrRows: perPbrRows.length,
  transferRows: transferRows.length,
  scoreReflected: 0,
  p1Return: 0,
  buyLimit: 0,
}, null, 2));
