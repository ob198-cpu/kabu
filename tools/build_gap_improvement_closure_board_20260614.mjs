import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const generatedAt = "2026/06/14 22:35";

function filePath(file) {
  return path.join(ROOT, file);
}

function readText(file) {
  return fs.existsSync(filePath(file)) ? fs.readFileSync(filePath(file), "utf8").replace(/^\uFEFF/, "") : "";
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
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  row.push(cell.replace(/\r$/, ""));
  if (row.some((value) => value !== "")) rows.push(row);
  if (!rows.length) return [];
  const headers = rows[0].map((value) => value.trim());
  return rows.slice(1).map((line) => Object.fromEntries(headers.map((header, i) => [header, line[i] ?? ""])));
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(file, rows) {
  if (!rows.length) {
    fs.writeFileSync(filePath(file), "", "utf8");
    return;
  }
  const headers = Object.keys(rows[0]);
  const body = rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n");
  fs.writeFileSync(filePath(file), `\uFEFF${headers.join(",")}\n${body}\n`, "utf8");
}

function h(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function statusClass(value) {
  const text = String(value ?? "");
  if (/(購入不可|0円|未確認|未完了|禁止|除外|停止|使わない)/.test(text)) return "bad";
  if (/(改善済み|接続済み|明文化|固定|通過済み|整理済み)/.test(text)) return "ok";
  if (/(条件付き|監視|partial|注意|確認|補完|待ち|仮説)/.test(text)) return "warn";
  return "";
}

function table(rows, columns) {
  return `<div class="table-wrap"><table><thead><tr>${columns.map((column) => `<th>${h(column.label)}</th>`).join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr>${columns.map((column) => `<td class="${statusClass(row[column.key])}">${h(row[column.key])}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

function toNumber(value) {
  const parsed = Number(String(value ?? "").replace(/[%円,]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

const financialRows = parseCsv(readText("candidate10_financial_confirmation_gate_20260614.csv"));
const p1Rows = parseCsv(readText("p1_financial_completion_engine_20260614.csv"));
const strictRows = parseCsv(readText("candidate10_strict_gate_review_20260613.csv"));
const postbuyRows = parseCsv(readText("postbuy_operation_record_template_20260614.csv"));
const returnRows = parseCsv(readText("return_hypothesis_confidence_20260613.csv"));
const themeRows = parseCsv(readText("qualitative_theme_evidence_gate_20260613.csv"));
const universeRows = parseCsv(readText("universe_reproducible_rulebook_v2_20260614.csv"));
const stopRows = parseCsv(readText("stop_limit_stress_protocol_20260614.csv"));

const strictByTicker = Object.fromEntries(strictRows.map((row) => [row.ticker, row]));
const returnByTicker = Object.fromEntries(returnRows.map((row) => [row.ticker, row]));
const stopByTicker = Object.fromEntries(stopRows.map((row) => [row.ticker, row]));

const financialPass = financialRows.filter((row) => row.financial_status === "pass").length;
const financialPartial = financialRows.length - financialPass;
const p1Incomplete = p1Rows.filter((row) => row["不足項目"] && row["不足項目"] !== "なし").length;

const summaryRows = [
  {
    改善対象: "財務データ",
    改善内容: "未確認のPER/PBR/ROE、営業利益率、受注・セグメント寄与をP1で分離。未確認値は点数にも注文票にも混ぜない。",
    現在の状態: `財務pass ${financialPass}/10、partial ${financialPartial}/10、P1未完了 ${p1Incomplete}件`,
    買付への扱い: "未確認が残る銘柄は比率引上げ禁止。現時点は購入不可・買付上限0円。",
    次に必要な入力: "公式IR、決算短信、決算説明資料の日付・URL・対象数値・入力状態",
  },
  {
    改善対象: "リスク評価",
    改善内容: "最大下落、1年/5年の下落、決算後反応、既存の下値・上値ルールを銘柄別に並べ、同じ損切り幅で扱わない形にした。",
    現在の状態: "銘柄別ルール表を作成済み。ただし買付価格が未入力なので実運用値は未確定。",
    買付への扱い: "買付価格が入るまで実損益ラインは確定しない。購入前はルール確認だけに使う。",
    次に必要な入力: "実際の買付価格、数量、買付日、ベンチマーク開始値",
  },
  {
    改善対象: "質的テーマ",
    改善内容: "AI、半導体、電力、フィジカルAI、量子などを仮説層と実績層に分離。テーマ名だけでは加点しない。",
    現在の状態: "テーマ証拠ゲートを作成済み。受注、売上寄与、指数超過、イベント後反応がそろうまで補助評価。",
    買付への扱い: "質的テーマ単独では購入候補へ昇格しない。量的スコア通過後の補助説明に限定。",
    次に必要な入力: "イベント日、ニュース出所、関連銘柄、過去反応、業績寄与の有無",
  },
  {
    改善対象: "ストップ安・急落対策",
    改善内容: "予防、当日、翌営業日、復帰、売却検討の順で対応を分離。急落当日は買い増ししない原則を明文化。",
    現在の状態: "共通ルールと銘柄別補正を接続済み。急落時の行動順序を表にした。",
    買付への扱い: "ストップ安、前日比-10%以上、指数同時急落、材料不明の急落では追加買付停止。",
    次に必要な入力: "当日の値幅、出来高、指数差、会社発表、テーマ崩れ有無",
  },
  {
    改善対象: "100社母集団",
    改善内容: "100社ぴったりではなく80〜120社を許容し、時価総額・流動性・成長・除外条件・手動追加理由を固定条件化。",
    現在の状態: "母集団ルールを固定表に整理済み。次は抽出日と対象一覧の保存を強化する段階。",
    買付への扱い: "母集団外からの手動追加は監視枠。共通ゲートを通るまで購入候補にしない。",
    次に必要な入力: "抽出日、対象銘柄一覧、除外理由、手動追加理由、データ欠損一覧",
  },
];

const riskRows = postbuyRows.map((row) => {
  const strict = strictByTicker[row.ticker] ?? {};
  const ret = returnByTicker[row.ticker] ?? {};
  const stop = stopByTicker[row.ticker] ?? {};
  const maxDrawdown = ret.max_drawdown_5y || stop.five_year_drawdown || "未確認";
  const riskLevel = stop.risk_tier || strict.risk_status || "未確認";
  const currentAmount = row.buy_amount_yen || "0円";
  return {
    ticker: row.ticker,
    銘柄: row.name,
    現在扱い: strict.universe_status || row.role,
    リスク区分: riskLevel,
    現在買付額: currentAmount,
    最大下落: maxDrawdown,
    下値ルール: row.downside_rule || "未設定",
    上値ルール: row.upside_rule || "未設定",
    急落時ルール: "ストップ安または前日比-10%以上は当日買い増し停止。翌営業日に出来高、指数差、会社発表、テーマ崩れを確認。",
    買付反映: toNumber(currentAmount) > 0 ? "要再確認" : "0円維持",
  };
});

const themeGateRows = themeRows.map((row) => ({
  テーマ: row.theme,
  仮説層: row.hypothesis_layer,
  実績層で必要な証拠: row.evidence_required,
  加点条件: "証拠2種類以上、うち1つは会社業績または受注に接続。株価反応だけでは不可。",
  現在の扱い: row.current_status,
  買付への扱い: row.score_treatment,
}));

const stopActionRows = [
  {
    段階: "予防",
    トリガー: "6月イベント未入力、本人別口座未確認、財務partial、注文票0円",
    行動: "購入不可を維持。候補は監視・検証だけに使う。",
    理由: "未確認情報を買付金額に混ぜないため。",
  },
  {
    段階: "当日",
    トリガー: "ストップ安、前日比-10%以上、指数同時急落、材料不明の急落",
    行動: "当日買い増し停止。成行売りも避け、会社発表と指数差を確認。",
    理由: "流動性が薄い場面で不利な価格をつかまないため。",
  },
  {
    段階: "翌営業日",
    トリガー: "急落後の寄付き、出来高急増、リバウンド、追加悪材料",
    行動: "出来高、寄付き気配、指数差、会社発表、テーマ崩れを確認して再判定。",
    理由: "一時的な市場全体の下落か、個別理由の崩れかを分けるため。",
  },
  {
    段階: "復帰",
    トリガー: "指数が戻り、会社発表に悪材料がなく、テーマ根拠が残る",
    行動: "元比率へ一気に戻さず、半分以下の小口から再開候補。",
    理由: "急落直後の反発を過信しないため。",
  },
  {
    段階: "売却検討",
    トリガー: "下方修正、不祥事、資金繰り悪化、テーマ根拠消滅、指数に継続劣後",
    行動: "NISAでも売却または縮小候補。非課税メリットより元本毀損リスクを優先。",
    理由: "非課税枠を理由に悪化銘柄を放置しないため。",
  },
];

const universeRuleRows = [
  ...universeRows,
  {
    項目: "抽出日固定",
    固定条件: "候補抽出日、株価取得日、決算参照日を保存する",
    理由: "後から都合よく銘柄を入れ替えたように見えないようにする",
    出力: "母集団 lineage CSV",
  },
  {
    項目: "手動追加の扱い",
    固定条件: "ニュースやテーマで追加した銘柄は、まず監視枠に入れる",
    理由: "質的テーマだけで購入候補に昇格させないため",
    出力: "監視枠・購入候補の分離",
  },
  {
    項目: "再現可能性",
    固定条件: "時価総額、流動性、業績成長、除外条件、データ欠損を同じ表に残す",
    理由: "同じ条件で再実行したとき近い母集団を再現するため",
    出力: "universe_fixed_rule_v3",
  },
];

writeCsv("gap_improvement_closure_board_20260614.csv", summaryRows);
writeCsv("ticker_risk_rule_matrix_v2_20260614.csv", riskRows);
writeCsv("theme_evidence_gate_v2_20260614.csv", themeGateRows);
writeCsv("stop_limit_action_plan_v2_20260614.csv", stopActionRows);
writeCsv("universe_fixed_rule_v3_20260614.csv", universeRuleRows);

const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>未完成点 改善v2 実用ボード</title>
  <style>
    :root{--ink:#061827;--navy:#103b60;--blue:#0b67a3;--line:#c9dceb;--bg:#f4f8fb;--paper:#fff;--warn:#a85b00;--red:#a01818;--green:#116b4f}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Noto Sans JP",Meiryo,sans-serif;font-size:18px;line-height:1.72}
    header{background:linear-gradient(135deg,#103b60,#0b67a3);color:white;padding:30px}
    header h1{margin:0 0 8px;font-size:clamp(30px,4vw,42px);line-height:1.2;letter-spacing:0}
    header p{margin:0;font-weight:800;max-width:1180px}
    main{max-width:1600px;margin:0 auto;padding:22px}
    section{background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:18px;margin:0 0 18px;box-shadow:0 8px 20px rgba(20,60,90,.08);break-inside:avoid}
    h2{margin:0 0 12px;border-left:8px solid var(--blue);padding-left:12px;color:var(--navy);font-size:25px}
    .notice{border-left:8px solid var(--red);background:#fff1f1;border-radius:10px;padding:14px 16px;font-weight:900;margin:0 0 14px}
    .sub{border-left-color:var(--blue);background:#eef7ff}
    .cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{border:1px solid var(--line);border-radius:10px;background:#fbfdff;padding:14px}
    .card b{display:block;color:var(--navy);font-size:15px}
    .card strong{display:block;font-size:28px;line-height:1.25;color:var(--blue)}
    .card span{display:block;color:#263e55;font-weight:800}
    .links{display:flex;flex-wrap:wrap;gap:10px}
    .links a{display:inline-block;text-decoration:none;border:1px solid #7bb6dd;border-radius:999px;padding:8px 13px;background:#f7fbff;color:#06395f;font-weight:900}
    .table-wrap{overflow-x:auto;border:1px solid var(--line);border-radius:10px;margin-top:10px}
    table{width:100%;border-collapse:collapse;background:#fff;table-layout:auto}
    th,td{border:1px solid var(--line);padding:10px 12px;vertical-align:top;overflow-wrap:anywhere;word-break:normal}
    th{background:#e7f2fb;color:#06395f;text-align:left;font-weight:900}
    td.ok{color:var(--green);font-weight:900}
    td.warn{color:var(--warn);font-weight:900}
    td.bad{color:var(--red);font-weight:900}
    footer{font-size:13px;color:#526b82;margin:20px 0}
    @media(max-width:900px){main{padding:12px}.cards{grid-template-columns:1fr}body{font-size:16px}}
    @media print{body{background:#fff}header,section{box-shadow:none;break-inside:avoid}.table-wrap{overflow:visible}th,td{font-size:11px;padding:6px 7px}}
  </style>
</head>
<body>
<header>
  <h1>未完成点 改善v2 実用ボード</h1>
  <p>財務、リスク、質的テーマ、ストップ安対策、100社母集団の5項目を、買付判断へ混ぜてよいものと、まだ混ぜてはいけないものに分けた実用画面です。</p>
</header>
<main>
  <section>
    <h2>現在の結論</h2>
    <p class="notice">現時点では購入不可・買付上限0円です。今回の改善は「買えるようにした」ものではなく、未確認データを買付判断へ混ぜないための安全装置を強化したものです。</p>
    <div class="cards">
      <div class="card"><b>財務pass</b><strong>${financialPass}/10</strong><span>残りは公式数値待ち</span></div>
      <div class="card"><b>P1未完了</b><strong>${p1Incomplete}件</strong><span>買付金額に反映しない</span></div>
      <div class="card"><b>銘柄別リスク</b><strong>10社</strong><span>下値・上値ルールを接続</span></div>
      <div class="card"><b>母集団</b><strong>固定条件化</strong><span>手動追加は監視枠から</span></div>
    </div>
  </section>

  <section>
    <h2>改善対象の整理</h2>
    ${table(summaryRows, [
      { key: "改善対象", label: "改善対象" },
      { key: "改善内容", label: "改善内容" },
      { key: "現在の状態", label: "現在の状態" },
      { key: "買付への扱い", label: "買付への扱い" },
      { key: "次に必要な入力", label: "次に必要な入力" },
    ])}
  </section>

  <section>
    <h2>銘柄別 リスク・上値下値ルール</h2>
    <p class="notice sub">買付価格が未入力のため、ここでは実損益額ではなくルールの骨格を確認します。実際の買付価格が入るまで、全銘柄の買付額は0円です。</p>
    ${table(riskRows, [
      { key: "ticker", label: "ticker" },
      { key: "銘柄", label: "銘柄" },
      { key: "現在扱い", label: "現在扱い" },
      { key: "リスク区分", label: "リスク区分" },
      { key: "現在買付額", label: "現在買付額" },
      { key: "最大下落", label: "最大下落" },
      { key: "下値ルール", label: "下値ルール" },
      { key: "上値ルール", label: "上値ルール" },
      { key: "急落時ルール", label: "急落時ルール" },
      { key: "買付反映", label: "買付反映" },
    ])}
  </section>

  <section>
    <h2>質的テーマ 実証ゲート</h2>
    ${table(themeGateRows, [
      { key: "テーマ", label: "テーマ" },
      { key: "仮説層", label: "仮説層" },
      { key: "実績層で必要な証拠", label: "実績層で必要な証拠" },
      { key: "加点条件", label: "加点条件" },
      { key: "現在の扱い", label: "現在の扱い" },
      { key: "買付への扱い", label: "買付への扱い" },
    ])}
  </section>

  <section>
    <h2>ストップ安・急落時の行動順序</h2>
    ${table(stopActionRows, [
      { key: "段階", label: "段階" },
      { key: "トリガー", label: "トリガー" },
      { key: "行動", label: "行動" },
      { key: "理由", label: "理由" },
    ])}
  </section>

  <section>
    <h2>100社母集団 固定条件</h2>
    ${table(universeRuleRows, [
      { key: "項目", label: "項目" },
      { key: "固定条件", label: "固定条件" },
      { key: "理由", label: "理由" },
      { key: "出力", label: "出力" },
    ])}
  </section>

  <section>
    <h2>関連CSV</h2>
    <div class="links">
      <a href="gap_improvement_closure_board_20260614.csv">改善サマリーCSV</a>
      <a href="ticker_risk_rule_matrix_v2_20260614.csv">銘柄別リスクv2 CSV</a>
      <a href="theme_evidence_gate_v2_20260614.csv">質的テーマv2 CSV</a>
      <a href="stop_limit_action_plan_v2_20260614.csv">急落対策v2 CSV</a>
      <a href="universe_fixed_rule_v3_20260614.csv">母集団固定v3 CSV</a>
      <a href="p1_financial_completion_engine_20260614.html">P1財務補完</a>
      <a href="daily_practical_compact_board_20260614.html">実用日次ボード</a>
    </div>
  </section>
  <footer>作成: ${h(generatedAt)} / 本画面は買付指示ではなく、未確認データを購入判断へ混ぜないための改善状況確認です。</footer>
</main>
</body>
</html>`;

fs.writeFileSync(filePath("gap_improvement_closure_board_20260614.html"), html, "utf8");

function insertAfterFirstCard(file, href, insertHtml) {
  const target = filePath(file);
  if (!fs.existsSync(target)) return;
  let text = fs.readFileSync(target, "utf8");
  if (text.includes("gap_improvement_closure_board_20260614.html")) return;
  const pos = text.indexOf(`href="${href}"`);
  if (pos < 0) return;
  const end = text.indexOf("</a>", pos);
  if (end < 0) return;
  text = `${text.slice(0, end + 4)}\n${insertHtml}\n${text.slice(end + 4)}`;
  fs.writeFileSync(target, text, "utf8");
}

insertAfterFirstCard(
  "index.html",
  "p1_financial_completion_engine_20260614.html",
  `<a class="card" href="gap_improvement_closure_board_20260614.html">
          <b>未完成点 改善v2 実用ボード</b>
          <span>財務、リスク、質的テーマ、急落対策、100社母集団を買付判断へ混ぜてよい状態か確認する。</span>
        </a>`,
);

insertAfterFirstCard(
  "latest_practical_start_20260614.html",
  "p1_financial_completion_engine_20260614.html",
  `<a class="step" href="gap_improvement_closure_board_20260614.html">
        <b>6-13. 未完成点 改善v2 実用ボード</b>
        <span>財務、リスク、質的テーマ、急落対策、100社母集団の残課題を買付判断へ混ぜないために確認する。</span>
        <em>改善v2</em>
      </a>`,
);

insertAfterFirstCard(
  "daily_practical_compact_board_20260614.html",
  "p1_financial_completion_engine_20260614.html",
  `<a href="gap_improvement_closure_board_20260614.html">未完成点 改善v2 実用ボード</a>`,
);

console.log("generated gap_improvement_closure_board_20260614.html");
